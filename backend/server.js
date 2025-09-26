import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import PQueue from 'p-queue';
import schedule from 'node-schedule';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });

// Session tracking for kiosks
const activeSessions = new Map();
const kioskStats = {
  'kiosk-1': { total: 0, completed: 0, failed: 0, lastActive: null },
  'kiosk-2': { total: 0, completed: 0, failed: 0, lastActive: null },
  'kiosk-3': { total: 0, completed: 0, failed: 0, lastActive: null },
  'kiosk-4': { total: 0, completed: 0, failed: 0, lastActive: null }
};

// Processing queue - limit concurrent Gemini API calls
const generationQueue = new PQueue({ 
  concurrency: 2, // Process 2 images at once
  interval: 1000, // 1 second interval
  intervalCap: 3  // Max 3 per second
});

// Rate limiter per kiosk
const kioskLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 requests per minute per kiosk
  keyGenerator: (req) => req.headers['x-kiosk-id'] || 'unknown',
  message: 'Too many requests from this kiosk, please wait',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/outputs', express.static('outputs'));
app.use('/backgrounds', express.static('backgrounds'));
app.use('/overlays', express.static('overlays'));

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Ensure directories exist
async function ensureDir(dir) {
  try { 
    await fs.mkdir(path.join(__dirname, dir), { recursive: true }); 
  } catch {}
}

// Initialize directories
await ensureDir('outputs');
await ensureDir('uploads');
await ensureDir('backgrounds');
await ensureDir('overlays');
await ensureDir('logs');

// Your existing helper functions
async function fileToInlineData(buffer, mimeType = "image/jpeg") {
  const b64 = buffer.toString("base64");
  return { inlineData: { mimeType, data: b64 } };
}

async function applyOverlay(generatedImageBuffer) {
  try {
    const overlayPath = path.join(__dirname, 'overlays', 'amsterdam-marathon-2025.png');
    
    try {
      await fs.access(overlayPath);
    } catch {
      console.log('Overlay not found, returning original image');
      return generatedImageBuffer;
    }

    const generatedMetadata = await sharp(generatedImageBuffer).metadata();
    
    const overlayBuffer = await sharp(overlayPath)
      .resize(generatedMetadata.width, generatedMetadata.height, {
        fit: 'fill',
        position: 'center'
      })
      .toBuffer();

    const compositeImage = await sharp(generatedImageBuffer)
      .composite([{
        input: overlayBuffer,
        top: 0,
        left: 0,
        blend: 'over'
      }])
      .png()
      .toBuffer();

    return compositeImage;
  } catch (error) {
    console.error('Error applying overlay:', error);
    return generatedImageBuffer;
  }
}

// Enhanced BACKGROUNDS configuration with time period
const BACKGROUNDS = {
  "amsterdam-canal": {
    name: "Amsterdam Canal - Historic",
    file: "amsterdam-canal.png",
    description: "Historic Amsterdam canal with traditional Dutch houses, flower market scene",
    lighting: "overcast Northern European light, soft shadows",
    colorTreatment: "sepia vintage filter with muted browns and yellows",
    composition: "canal on left, street path on right side",
    timePeriod: "past",
    era: "early 1900s"
  },
  "vondelpark": {
    name: "Vondelpark - Modern",
    file: "vondelpark.jpg",
    description: "Green park setting with trees and pathways",
    lighting: "dappled sunlight through trees, natural green tones",
    colorTreatment: "full color natural tones",
    composition: "centered park path",
    timePeriod: "present",
    era: "2025"
  },
  "dam-square": {
    name: "Dam Square - Contemporary",
    file: "dam-square.jpg",
    description: "Bustling city center with historic buildings",
    lighting: "urban daylight, mixed shadows from buildings",
    colorTreatment: "full color modern photography",
    composition: "wide open square, centered composition",
    timePeriod: "present",
    era: "2025"
  },
  "olympic-stadium": {
    name: "Olympic Stadium - Future",
    file: "olympic-stadium.png",
    description: "Futuristic stadium setting with advanced architecture",
    lighting: "bright athletic venue lighting",
    colorTreatment: "full color vibrant tones",
    composition: "stadium entrance, centered",
    timePeriod: "future",
    era: "2050s"
  }
};

// Helper function to get period-appropriate GENDER-NEUTRAL athletic wear
function getPeriodAppropriateClothing(timePeriod, era) {
  const clothingByPeriod = {
    past: [
      "HISTORICAL ATHLETIC ATTIRE (Early 1900s) - GENDER NEUTRAL:",
      "- Simple white or cream cotton athletic shirt (not too fitted, not too loose)",
      "- Dark colored knee-length athletic shorts or knickerbockers (navy, black, or brown)",
      "- Long dark socks pulled up to just below the knees",
      "- Simple canvas or leather lace-up athletic shoes/plimsolls",
      "- Natural fabrics only (cotton, wool, linen) - no synthetic materials",
      "- Modest, practical fit appropriate for 1900s athletics",
      "- No modern logos, text, or branding",
      "- Overall appearance of an early Olympic athlete or physical culture enthusiast"
    ],
    present: [
      "MODERN ATHLETIC ATTIRE (2025) - GENDER NEUTRAL:",
      "- Contemporary moisture-wicking running t-shirt in solid athletic colors",
      "- Modern running shorts (mid-thigh length, not too short or long)",
      "- Current model running shoes (subtle design, no excessive branding)",
      "- Optional: simple running watch or fitness tracker",
      "- Technical athletic fabrics with natural drape",
      "- Comfortable, functional fit suitable for marathon running",
      "- Clean, minimalist athletic aesthetic"
    ],
    future: [
      "FUTURISTIC ATHLETIC ATTIRE (2050s) - GENDER NEUTRAL:",
      "- Sleek bio-responsive athletic top with subtle geometric patterns",
      "- Streamlined running shorts with integrated smart fabric technology",
      "- Advanced cushioning running shoes with minimal, elegant design",
      "- Subtle holographic or bioluminescent accent lines (not overwhelming)",
      "- Matte or subtly iridescent fabric finishes",
      "- Form-following (not form-fitting) silhouette",
      "- Clean, minimalist future aesthetic without excessive tech elements",
      "- Unified, genderless design language"
    ]
  };

  return clothingByPeriod[timePeriod] || clothingByPeriod.present;
}

// Enhanced prompt generation function with gender-neutral clothing
function generateGenderAwarePrompt(gender, backgroundInfo) {
  // Gender instructions for body/feature preservation ONLY, not clothing
  const genderSpecific = {
    male: "Preserve masculine facial features, body build, and proportions from the original photo.",
    female: "Preserve feminine facial features, body build, and proportions from the original photo.",
    "non-binary": "Preserve the exact facial features, body build, and proportions from the original photo.",
    trans: "Respectfully preserve the facial features, body build, and proportions from the original photo."
  };

  const genderInstruction = genderSpecific[gender] || genderSpecific["non-binary"];

  // Get period-appropriate GENDER-NEUTRAL clothing
  const periodClothing = getPeriodAppropriateClothing(
    backgroundInfo.timePeriod || "present",
    backgroundInfo.era || "2025"
  );

  // Determine color treatment instructions
  let colorTreatmentInstructions = "";
  if (backgroundInfo.colorTreatment) {
    if (backgroundInfo.colorTreatment.includes("sepia") || backgroundInfo.colorTreatment.includes("vintage")) {
      colorTreatmentInstructions = [
        "CRITICAL COLOR MATCHING:",
        "- Apply SEPIA TONE to the entire generated person to match the vintage background filter",
        "- Convert all colors to warm browns, yellows, and muted earth tones",
        "- NO vibrant or saturated colors - everything must have vintage/antique coloring",
        "- Athletic wear should appear in muted, desaturated tones matching the sepia filter",
        "- Skin tones should have the warm, golden-brown cast of sepia photography",
        "- The person must look like they belong in the same vintage photograph",
        ""
      ].join("\n");
    } else if (backgroundInfo.colorTreatment.includes("black and white") || backgroundInfo.colorTreatment.includes("monochrome")) {
      colorTreatmentInstructions = [
        "CRITICAL COLOR MATCHING:",
        "- Convert the entire person to BLACK AND WHITE/GRAYSCALE",
        "- NO color should remain on the person - full monochrome treatment",
        "- Match the contrast levels of the background",
        "- Athletic wear appears in shades of gray",
        "- The person must look like part of the same black and white photograph",
        ""
      ].join("\n");
    }
  }

  // Determine composition instructions
  let compositionInstructions = "";
  if (backgroundInfo.composition) {
    if (backgroundInfo.composition.includes("right side")) {
      compositionInstructions = [
        "COMPOSITION PLACEMENT:",
        "- Position the runner on the RIGHT SIDE of the frame where the path/street is",
        "- Do not center the runner - they should be running along the right pathway",
        "- Follow the natural flow of the street/path composition",
        ""
      ].join("\n");
    } else if (backgroundInfo.composition.includes("left side")) {
      compositionInstructions = [
        "COMPOSITION PLACEMENT:",
        "- Position the runner on the LEFT SIDE of the frame where the path/street is",
        "- Do not center the runner - they should be running along the left pathway",
        "- Follow the natural flow of the street/path composition",
        ""
      ].join("\n");
    }
  }

  // Religious wear preservation with time period context
  const religiousWearInstructions = [
    "RELIGIOUS AND CULTURAL WEAR PRESERVATION:",
    "If the subject wears religious or cultural head covering (hijab, turban, yarmulke, etc.):",
    "- KEEP IT EXACTLY AS WORN regardless of time period",
    "- Religious wear transcends time periods and must be respected",
    backgroundInfo.timePeriod === "past" ? 
      "- Apply the same color treatment (sepia/B&W) to religious wear" : "",
    backgroundInfo.timePeriod === "future" ? 
      "- Religious wear remains traditional even in futuristic settings" : "",
    "- Never remove or alter religious/cultural clothing",
    "- The athletic wear below should still be gender-neutral",
    ""
  ].filter(Boolean).join("\n");

  const promptLines = [
    "Photoreal multi-image fusion for Amsterdam Marathon through time.",
    "",
    
    // Shadow analysis instruction - MOVED TO TOP
    "FIRST PRIORITY - ANALYZE BACKGROUND SHADOWS:",
    "- Identify shadow direction from existing people/objects in background",
    "- Note shadow SOFTNESS and diffusion level",
    "- Observe how shadows blend with the ground texture",
    "- Notice that real shadows are SOFT and GRADUAL, never harsh",
    "- Runner must have equally SOFT, BLENDED shadows",
    "",
    
    // Time period context
    `TIME PERIOD: ${backgroundInfo.era || "Present day"}`,
    `Setting: ${backgroundInfo.timePeriod === "past" ? "Historical" : 
               backgroundInfo.timePeriod === "future" ? "Futuristic" : "Contemporary"} Amsterdam`,
    "",
    
    // Add color treatment instructions at the very beginning if needed
    colorTreatmentInstructions,
    
    // CRITICAL NO BIB INSTRUCTION
    "CRITICAL INSTRUCTION - NO RACE BIBS:",
    "- DO NOT add any bib number, race number, or participant number",
    "- The runner's chest area must be completely clear of any numbers or race identifiers",
    backgroundInfo.timePeriod === "past" ? 
      "- Historical runners did not wear race bibs like modern races" : "",
    "- ABSOLUTELY NO numerical identifiers on the clothing",
    "",
    
    // Identity preservation
    "FIRST image: person. Preserve identity exactly: face, skin tone, facial hair, hair texture/coverage, body shape, height proportions, hands, and any visible distinguishing features.",
    "",
    
    // Apply filter to preserved features if needed
    backgroundInfo.colorTreatment?.includes("sepia") ? 
      "Apply sepia/vintage filter to ALL preserved features to match background aesthetics." : "",
    backgroundInfo.colorTreatment?.includes("black") ? 
      "Convert ALL preserved features to black and white/grayscale to match background." : "",
    "",
    
    // Gender-aware instruction for BODY ONLY
    "BODY AND FACIAL FEATURES:",
    genderInstruction,
    "NOTE: Clothing should be gender-neutral athletic wear regardless of gender selection.",
    "",
    
    // Religious wear preservation
    religiousWearInstructions,
    
    // GENDER-NEUTRAL period-appropriate clothing
    "CRITICAL CLOTHING INSTRUCTION:",
    "ALL runners wear the SAME STYLE of gender-neutral athletic clothing.",
    "Do not vary clothing based on gender - use unified athletic wear for everyone.",
    "",
    ...periodClothing,
    "",
    
    // Add composition instructions if needed
    compositionInstructions,
    
    // CRITICAL SCALE REQUIREMENTS
    "CRITICAL SCALE REQUIREMENTS:",
    "- The runner MUST be at REALISTIC HUMAN SCALE relative to the background",
    "- If there are buildings, the person should be appropriately small compared to them",
    "- If there are other people visible, the runner must be similar size to them",
    backgroundInfo.timePeriod === "past" ? 
      "- Match the scale of any historical figures in the scene" : "",
    "- NEVER make the person unnaturally large or dominant in the frame",
    "",
    
    // Eyewear handling
    "If the subject wears eyeglasses in the FIRST image:",
    backgroundInfo.timePeriod === "past" ? 
      "- Adapt glasses to period-appropriate style (round wire frames, pince-nez)" : 
    backgroundInfo.timePeriod === "future" ? 
      "- Make glasses subtly futuristic (thin frames, smart glass appearance)" : 
      "- Keep modern glasses unchanged",
    "If the subject is NOT wearing eyeglasses, do not add any.",
    "",
    
    // Mobility aids with time period
    "If the subject uses a mobility aid, adapt it to the time period while maintaining functionality.",
    "",
    
    // Running pose for time period
    "RUNNING POSE AND FORM:",
    backgroundInfo.timePeriod === "past" ? 
      "- More upright running posture typical of early 1900s athletics" : 
    backgroundInfo.timePeriod === "future" ? 
      "- Efficient, biomechanically optimized running form" : 
      "- Modern marathon running form",
    "- Natural movement for the era",
    "- Arms and legs positioned appropriately for running",
    "- Same running form regardless of gender",
    "",
    
    // Background integration
    "SECOND image: " + backgroundInfo.description,
    "OBSERVE: Note all shadows from existing people/objects in the background.",
    "MATCH: Runner's shadow must match the same angle, length, and intensity.",
    `Integrate the runner seamlessly into the ${backgroundInfo.era || "modern"} Amsterdam setting.`,
    backgroundInfo.composition ? 
      `Place runner on the ${backgroundInfo.composition.includes('right') ? 'RIGHT' : 
        backgroundInfo.composition.includes('left') ? 'LEFT' : 'CENTER'} following the path/street location.` : 
      "Place runner at appropriate distance based on background perspective.",
    "Runner MUST have ground contact shadow matching other people in scene.",
    "",
    
    // PERSPECTIVE AND COMPOSITION
    "PERSPECTIVE AND COMPOSITION:",
    "- Match the camera angle and height of the background photo",
    "- If background is shot from ground level, keep runner at ground level",
    "- Maintain proper depth of field - slightly blur if far away",
    "- The runner should occupy 10-20% of frame height in city squares",
    "- In park paths, runner can be 30-40% of frame height if closer to camera",
    backgroundInfo.composition?.includes("side") ? 
      "- Position runner along the actual path/street, not in the center of frame" : "",
    "",
    
    // CRITICAL SHADOW GENERATION
    "CRITICAL SHADOW AND GROUNDING REQUIREMENTS:",
    "THE RUNNER MUST HAVE SOFT, NATURAL CONTACT SHADOWS:",
    "- Generate a SOFT, DIFFUSED shadow beneath the runner's feet",
    "- Shadow edges must be BLURRED and GRADUAL, not sharp or harsh",
    "- The shadow should BLEND smoothly into the cobblestones/ground texture",
    "- NO hard edges - shadow must have soft, feathered boundaries",
    "- Shadow opacity: semi-transparent, not solid black",
    "- Darkest point directly under feet (60-70% opacity)",
    "- Gradually fades outward with soft edges (20-30% opacity at edges)",
    "- Match the SOFTNESS of shadows from other people in the scene",
    "- On cobblestones: shadow should follow surface undulations naturally",
    "- Contact shadow is essential but must look atmospheric and soft",
    backgroundInfo.colorTreatment?.includes("sepia") ? 
      "- Soft brown/sepia shadow tones, never harsh black" : 
    backgroundInfo.colorTreatment?.includes("black") ?
      "- Soft gray shadows matching the monochrome atmosphere" : 
      "- Natural soft shadow color matching ambient lighting",
    "",
    "GROUND INTEGRATION WITH SOFT SHADOWS:",
    "- Runner's feet must appear to make contact with the ground surface",
    "- Shadow should be SOFT and ATMOSPHERIC, like morning mist",
    "- On cobblestones: shadow follows surface texture but stays SOFT",
    "- Shadow blends into gaps between stones naturally",
    "- Weight distribution shown through subtle shadow gradients",
    "- One foot shows ground contact with gentle shadow pooling",
    "- Avoid any harsh black outlines or sharp shadow edges",
    "- Think 'overcast day shadows' not 'harsh sunlight shadows'",
    "",
    
    // Lighting matching
    "Match lighting to background: " + backgroundInfo.lighting,
    
    // Time-appropriate atmosphere
    backgroundInfo.timePeriod === "past" ? [
      "HISTORICAL ATMOSPHERE:",
      "- Other people in scene wearing period-appropriate 1900s clothing",
      "- No modern elements should be visible on the runner",
      "- Match the historical photography style completely",
      "- All runners (if multiple) wear similar gender-neutral athletic attire",
      ""
    ].join("\n") : 
    backgroundInfo.timePeriod === "future" ? [
      "FUTURISTIC ATMOSPHERE:",
      "- Advanced technology visible but not overwhelming",
      "- Clean, sleek aesthetic matching 2050s vision",
      "- Other runners in similar gender-neutral futuristic athletic wear if present",
      ""
    ].join("\n") : "",
    
    // Final reminders
    "FINAL INTEGRATION CHECK:",
    `- Runner must look like they belong in ${backgroundInfo.era || "2025"}`,
    "- Clothing must be historically/temporally accurate AND gender-neutral",
    "- Same athletic wear style for all genders",
    "- Religious/cultural wear preserved if present",
    "- NO RACE NUMBERS OR BIBS in any time period",
    backgroundInfo.colorTreatment && !backgroundInfo.colorTreatment.includes("full color") ?
      "- Color treatment (sepia/B&W) applied to entire person" : "",
    "- Natural integration with no anachronistic elements",
    "",
    "FINAL SHADOW CHECK - CRITICAL:",
    "- VERIFY the runner has a SOFT, DIFFUSED shadow on the ground",
    "- Shadow must have FEATHERED, GRADUAL edges - no harsh lines",
    "- Shadow should BLEND naturally into the ground surface",
    "- Check that shadow opacity varies (darker center, lighter edges)",
    "- Ensure shadow matches the SOFTNESS of other shadows in scene",
    "- Shadow must appear atmospheric and natural, not painted on",
    "- Ground contact visible but subtle through soft shadowing",
    "",
    "REMINDER: Use the same gender-neutral athletic clothing regardless of the gender parameter.",
    "The gender parameter only affects body/facial feature preservation, NOT clothing style."
  ].filter(Boolean);

  return promptLines.join("\n");
}
// Process generation function for queue
async function processGeneration(fileBuffer, mimetype, { backgroundId, gender }, kioskId) {
  const sessionId = uuidv4();
  const startTime = Date.now();
  
  // Update kiosk stats
  kioskStats[kioskId].total++;
  kioskStats[kioskId].lastActive = new Date();
  
  // Track session
  activeSessions.set(sessionId, {
    kioskId,
    startTime,
    status: 'processing',
    backgroundId,
    gender
  });

  try {
    const backgroundInfo = BACKGROUNDS[backgroundId];
    if (!backgroundInfo) {
      throw new Error('Invalid background selection');
    }

    // Read background image
    const backgroundPath = path.join(__dirname, 'backgrounds', backgroundInfo.file);
    const backgroundBuffer = await fs.readFile(backgroundPath);

    // Convert to Gemini format
    const personPart = await fileToInlineData(fileBuffer, mimetype);
    const envPart = await fileToInlineData(backgroundBuffer, "image/jpeg");

    // Generate prompt
    const prompt = generateGenderAwarePrompt(gender, backgroundInfo);

    console.log(`[${kioskId}] Generating image for session ${sessionId.slice(0,8)}...`);
    
    // Call Gemini API
    const result = await model.generateContent([prompt, personPart, envPart]);
    const parts = result.response?.candidates?.[0]?.content?.parts || [];

    let outputPath = null;
    for (const part of parts) {
      if (part.inlineData?.data) {
        let buffer = Buffer.from(part.inlineData.data, "base64");
        
        // Apply overlay
        buffer = await applyOverlay(buffer);
        
        // Create filename with kiosk ID
        const filename = `marathon_${kioskId}_${Date.now()}_${sessionId.slice(0,8)}.png`;
        outputPath = path.join(__dirname, 'outputs', filename);
        await fs.writeFile(outputPath, buffer);
        
        console.log(`[${kioskId}] ✅ Generated: ${filename}`);
        
        // Update session status
        activeSessions.set(sessionId, {
          ...activeSessions.get(sessionId),
          status: 'completed',
          endTime: Date.now(),
          outputFile: filename
        });
        
        // Update kiosk stats
        kioskStats[kioskId].completed++;
        
        return { 
          success: true, 
          imageUrl: `/outputs/${filename}`,
          message: 'Marathon photo generated successfully!',
          sessionId,
          kioskId,
          queueSize: generationQueue.size,
          processingTime: Date.now() - startTime
        };
      }
    }

    throw new Error('No image generated');

  } catch (error) {
    console.error(`[${kioskId}] Generation error:`, error);
    
    // Update session status
    activeSessions.set(sessionId, {
      ...activeSessions.get(sessionId),
      status: 'failed',
      error: error.message,
      endTime: Date.now()
    });
    
    // Update kiosk stats
    kioskStats[kioskId].failed++;
    
    throw error;
  }
}

// API Endpoints

// Get available backgrounds
app.get('/api/backgrounds', (req, res) => {
  const backgroundList = Object.entries(BACKGROUNDS).map(([id, info]) => ({
    id,
    name: info.name,
    description: info.description,
    thumbnail: `/backgrounds/${info.file}`
  }));
  res.json(backgroundList);
});

// Main generate endpoint with queue management
app.post('/api/generate', kioskLimiter, upload.single('selfie'), async (req, res) => {
  const kioskId = req.headers['x-kiosk-id'] || 'unknown';
  
  try {
    const { backgroundId, gender } = req.body;
    const selfieBuffer = req.file.buffer;

    if (!backgroundId || !gender || !selfieBuffer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check queue size
    if (generationQueue.size > 10) {
      return res.status(503).json({ 
        error: 'Server is busy, please try again',
        queueSize: generationQueue.size 
      });
    }

    console.log(`[${kioskId}] Adding to queue. Current queue size: ${generationQueue.size}`);
    
    // Add to processing queue
    const result = await generationQueue.add(
      () => processGeneration(
        req.file.buffer, 
        req.file.mimetype, 
        { backgroundId, gender }, 
        kioskId
      ),
      { priority: kioskId === 'kiosk-3' ? 1 : 0 } // VIP booth gets priority
    );

    res.json(result);

  } catch (error) {
    console.error(`[${kioskId}] Error:`, error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message,
      kioskId
    });
  }
});

// Monitoring endpoint
app.get('/api/monitor', (req, res) => {
  const recentSessions = Array.from(activeSessions.entries())
    .slice(-20)
    .map(([id, session]) => ({
      id: id.slice(0, 8),
      ...session,
      duration: session.endTime ? session.endTime - session.startTime : null
    }));

  res.json({
    kiosks: kioskStats,
    queueSize: generationQueue.size,
    queuePending: generationQueue.pending,
    totalSessions: activeSessions.size,
    recentSessions,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date()
  });
});

// Kiosk status endpoint
app.get('/api/kiosk/:kioskId/status', (req, res) => {
  const { kioskId } = req.params;
  const stats = kioskStats[kioskId];
  
  if (!stats) {
    return res.status(404).json({ error: 'Invalid kiosk ID' });
  }

  res.json({
    kioskId,
    ...stats,
    queuePosition: generationQueue.size,
    serverStatus: 'online'
  });
});

// Health check with kiosk support
app.get('/api/health', (req, res) => {
  const kioskId = req.headers['x-kiosk-id'] || req.query.kiosk;
  
  res.json({ 
    status: 'ok', 
    service: 'Amsterdam Marathon Photobooth',
    kioskId,
    timestamp: new Date(),
    queueStatus: {
      size: generationQueue.size,
      pending: generationQueue.pending
    }
  });
});

// Clean up old sessions every 30 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [id, session] of activeSessions.entries()) {
    if (session.startTime < oneHourAgo) {
      activeSessions.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} old sessions`);
  }
}, 30 * 60 * 1000);

// Clean up old images every hour
schedule.scheduleJob('0 * * * *', async () => {
  try {
    const outputDir = path.join(__dirname, 'outputs');
    const files = await fs.readdir(outputDir);
    const now = Date.now();
    const maxAge = 4 * 60 * 60 * 1000; // 4 hours
    
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        console.log(`Deleted old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

app.listen(PORT, () => {
  console.log(`🏃 Marathon Photobooth Backend running on port ${PORT}`);
  console.log(`📊 Monitor dashboard available at http://localhost:${PORT}/api/monitor`);
});
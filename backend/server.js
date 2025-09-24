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

// Your existing BACKGROUNDS configuration
const BACKGROUNDS = {
  "amsterdam-canal": {
    name: "Amsterdam Canal",
    file: "amsterdam-canal.jpg",
    description: "Historic Amsterdam canal with traditional Dutch houses",
    lighting: "overcast Northern European light, soft shadows"
  },
  "vondelpark": {
    name: "Vondelpark",
    file: "vondelpark.jpg",
    description: "Green park setting with trees and pathways",
    lighting: "dappled sunlight through trees, natural green tones"
  },
  "dam-square": {
    name: "Dam Square",
    file: "dam-square.jpg",
    description: "Bustling city center with historic buildings",
    lighting: "urban daylight, mixed shadows from buildings"
  },
  "olympic-stadium": {
    name: "Olympic Stadium",
    file: "olympic-stadium.png",
    description: "Modern stadium setting",
    lighting: "bright athletic venue lighting"
  }
};

// Your existing generateGenderAwarePrompt function (keeping as is)
function generateGenderAwarePrompt(gender, backgroundInfo) {
  // ... (keep your existing prompt generation code exactly as is)
  const genderSpecific = {
    male: "Ensure masculine athletic build and features are preserved. Use typical men's marathon running attire.",
    female: "Ensure feminine features and build are preserved. Use typical women's marathon running attire.",
    "non-binary": "Respect androgynous or mixed-gender presentation. Use unisex athletic wear that feels comfortable and non-gendered.",
    trans: "Be respectful of gender presentation as shown in the photo. Choose athletic wear that affirms the presented gender identity."
  };

  const genderInstruction = genderSpecific[gender] || genderSpecific["non-binary"];

  const promptLines = [
    "Photoreal multi-image fusion for Amsterdam Marathon 2025.",
    "",
    "CRITICAL INSTRUCTION - NO RACE BIBS:",
    "- DO NOT add any bib number, race number, or participant number",
    "- The runner's chest area must be completely clear of any numbers or race identifiers",
    "- Athletic wear should be plain or have only brand logos",
    "- ABSOLUTELY NO numerical identifiers on the clothing",
    "- If you see any number on the chest area, remove it",
    "",
    "FIRST image: person. Preserve identity exactly: face, skin tone, facial hair, hair texture/coverage, body shape, height proportions, hands, and any visible distinguishing features.",
    "",
    genderInstruction,
    "",
    "CRITICAL SCALE REQUIREMENTS:",
    "- The runner MUST be at REALISTIC HUMAN SCALE relative to the background",
    "- If there are buildings, the person should be appropriately small compared to them",
    "- If there are other people visible, the runner must be similar size to them",
    "- Check perspective: further from camera = smaller, closer = larger",
    "- A person should be about 1/3 to 1/4 the height of a typical building story",
    "- In wide city squares, people appear quite small relative to the space",
    "- NEVER make the person unnaturally large or dominant in the frame",
    "",
    "If the subject wears a hijab, turban, yarmulke, or any religious/cultural head covering, KEEP IT UNCHANGED.",
    "If the subject wears eyeglasses in the FIRST image, KEEP those exact glasses.",
    "",
    "If the subject is NOT wearing eyeglasses in the FIRST image, do not add any.",
    "Do not invent new accessories not present in the FIRST image.",
    "",
    "If the subject uses a mobility aid, KEEP it exactly and maintain natural usage posture.",
    "",
    "Transform into Amsterdam Marathon runner WITHOUT any race bib:",
    "- Plain athletic shirt/top with NO numbers, NO bib, NO race identifiers",
    "- The chest area must remain completely clear and unobstructed",
    "- Breathable athletic wear appropriate for the gender selection",
    "- Running shoes suitable for marathon",
    "- Dynamic RUNNING pose, mid-stride like a marathon runner",
    "- Natural running form: forward lean, arms pumping, one foot contacting ground",
    "- Remember: This is a training run photo, NOT a race photo, so NO BIBS",
    "",
    "SECOND image: " + backgroundInfo.description,
    "Integrate the runner seamlessly into the Amsterdam marathon route.",
    "Place runner at appropriate distance based on background perspective.",
    "This should look like a training or practice run, not an official race.",
    "",
    "PERSPECTIVE AND COMPOSITION:",
    "- Match the camera angle and height of the background photo",
    "- If background is shot from ground level, keep runner at ground level",
    "- Maintain proper depth of field - slightly blur if far away",
    "- The runner should occupy 10-20% of frame height in city squares",
    "- In park paths, runner can be 30-40% of frame height if closer to camera",
    "",
    "Match lighting to background: " + backgroundInfo.lighting,
    "Cast appropriate ground shadows matching scene direction.",
    "Shadow size must match the person's scale in the scene.",
    "Add natural reflections and color temperature matching.",
    "",
    "Add marathon atmosphere but as a TRAINING RUN:",
    "- Other casual runners in background if appropriate (also no bibs)",
    "- Park or city atmosphere, not race day atmosphere",
    "- NO race numbers, NO bibs, NO official race markers",
    "Ensure photorealistic integration with no cutout edges.",
    "",
    "FINAL REMINDER: This must look like a training/practice run photo,",
    "NOT an official race photo. NO BIBS OR RACE NUMBERS anywhere."
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
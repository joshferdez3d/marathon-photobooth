import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import sharp from "sharp"; // Add sharp for image processing

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/outputs', express.static('outputs'));
app.use('/backgrounds', express.static('backgrounds'));
app.use('/overlays', express.static('overlays')); // Add overlay static path

// Multer setup for image uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
await ensureDir('overlays'); // Add overlays directory

// Convert file to inline data for Gemini
async function fileToInlineData(buffer, mimeType = "image/jpeg") {
  const b64 = buffer.toString("base64");
  return { inlineData: { mimeType, data: b64 } };
}

// Apply overlay to generated image
async function applyOverlay(generatedImageBuffer) {
  try {
    const overlayPath = path.join(__dirname, 'overlays', 'amsterdam-marathon-2025.png');
    
    // Check if overlay exists
    try {
      await fs.access(overlayPath);
    } catch {
      console.log('Overlay not found, returning original image');
      return generatedImageBuffer;
    }

    // Get dimensions of generated image
    const generatedMetadata = await sharp(generatedImageBuffer).metadata();
    
    // Resize overlay to match generated image dimensions
    const overlayBuffer = await sharp(overlayPath)
      .resize(generatedMetadata.width, generatedMetadata.height, {
        fit: 'fill',
        position: 'center'
      })
      .toBuffer();

    // Composite the overlay onto the generated image
    const compositeImage = await sharp(generatedImageBuffer)
      .composite([
        {
          input: overlayBuffer,
          top: 0,
          left: 0,
          blend: 'over'
        }
      ])
      .png()
      .toBuffer();

    return compositeImage;
  } catch (error) {
    console.error('Error applying overlay:', error);
    return generatedImageBuffer;
  }
}

// Background configurations
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

// Generate prompt based on gender selection
function generateGenderAwarePrompt(gender, backgroundInfo) {
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
    // CRITICAL NO BIB INSTRUCTION - MOVED TO TOP
    "CRITICAL INSTRUCTION - NO RACE BIBS:",
    "- DO NOT add any bib number, race number, or participant number",
    "- The runner's chest area must be completely clear of any numbers or race identifiers",
    "- Athletic wear should be plain or have only brand logos",
    "- ABSOLUTELY NO numerical identifiers on the clothing",
    "- If you see any number on the chest area, remove it",
    "",
    // Identity preservation
    "FIRST image: person. Preserve identity exactly: face, skin tone, facial hair, hair texture/coverage, body shape, height proportions, hands, and any visible distinguishing features.",
    "",
    // Gender-aware instruction
    genderInstruction,
    "",
    // CRITICAL SCALE AND PROPORTION INSTRUCTIONS
    "CRITICAL SCALE REQUIREMENTS:",
    "- The runner MUST be at REALISTIC HUMAN SCALE relative to the background",
    "- If there are buildings, the person should be appropriately small compared to them",
    "- If there are other people visible, the runner must be similar size to them",
    "- Check perspective: further from camera = smaller, closer = larger",
    "- A person should be about 1/3 to 1/4 the height of a typical building story",
    "- In wide city squares, people appear quite small relative to the space",
    "- NEVER make the person unnaturally large or dominant in the frame",
    "",
    // Religious/cultural preservation
    "If the subject wears a hijab, turban, yarmulke, or any religious/cultural head covering, KEEP IT UNCHANGED.",
    "If the subject wears eyeglasses in the FIRST image, KEEP those exact glasses.",
    "",
    // No hallucination rules
    "If the subject is NOT wearing eyeglasses in the FIRST image, do not add any.",
    "Do not invent new accessories not present in the FIRST image.",
    "",
    // Mobility aids
    "If the subject uses a mobility aid, KEEP it exactly and maintain natural usage posture.",
    "",
    // Marathon runner transformation - EMPHASIZE NO BIB AGAIN
    "Transform into Amsterdam Marathon runner WITHOUT any race bib:",
    "- Plain athletic shirt/top with NO numbers, NO bib, NO race identifiers",
    "- The chest area must remain completely clear and unobstructed",
    "- Breathable athletic wear appropriate for the gender selection",
    "- Running shoes suitable for marathon",
    "- Dynamic RUNNING pose, mid-stride like a marathon runner",
    "- Natural running form: forward lean, arms pumping, one foot contacting ground",
    "- Remember: This is a training run photo, NOT a race photo, so NO BIBS",
    "",
    // Background integration
    "SECOND image: " + backgroundInfo.description,
    "Integrate the runner seamlessly into the Amsterdam marathon route.",
    "Place runner at appropriate distance based on background perspective.",
    "This should look like a training or practice run, not an official race.",
    "",
    // Perspective and composition
    "PERSPECTIVE AND COMPOSITION:",
    "- Match the camera angle and height of the background photo",
    "- If background is shot from ground level, keep runner at ground level",
    "- Maintain proper depth of field - slightly blur if far away",
    "- The runner should occupy 10-20% of frame height in city squares",
    "- In park paths, runner can be 30-40% of frame height if closer to camera",
    "",
    // Lighting matching
    "Match lighting to background: " + backgroundInfo.lighting,
    "Cast appropriate ground shadows matching scene direction.",
    "Shadow size must match the person's scale in the scene.",
    "Add natural reflections and color temperature matching.",
    "",
    // Final touches - REMIND AGAIN ABOUT NO BIBS
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

// Process image
app.post('/api/generate', upload.single('selfie'), async (req, res) => {
  try {
    const { backgroundId, gender } = req.body;
    const selfieBuffer = req.file.buffer;

    if (!backgroundId || !gender || !selfieBuffer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const backgroundInfo = BACKGROUNDS[backgroundId];
    if (!backgroundInfo) {
      return res.status(400).json({ error: 'Invalid background selection' });
    }

    // Read background image
    const backgroundPath = path.join(__dirname, 'backgrounds', backgroundInfo.file);
    const backgroundBuffer = await fs.readFile(backgroundPath);

    // Convert to Gemini format
    const personPart = await fileToInlineData(selfieBuffer, req.file.mimetype);
    const envPart = await fileToInlineData(backgroundBuffer, "image/jpeg");

    // Generate prompt
    const prompt = generateGenderAwarePrompt(gender, backgroundInfo);

    console.log('Generating with Gemini...');
    
    // Call Gemini API
    const result = await model.generateContent([prompt, personPart, envPart]);

    const parts = result.response?.candidates?.[0]?.content?.parts || [];

    let outputPath = null;
    for (const part of parts) {
      if (part.inlineData?.data) {
        let buffer = Buffer.from(part.inlineData.data, "base64");
        
        // Apply the Amsterdam Marathon overlay
        buffer = await applyOverlay(buffer);
        
        const filename = `marathon_${Date.now()}.png`;
        outputPath = path.join(__dirname, 'outputs', filename);
        await fs.writeFile(outputPath, buffer);
        console.log('✅ Generated with overlay:', filename);
        
        res.json({ 
          success: true, 
          imageUrl: `/outputs/${filename}`,
          message: 'Marathon photo generated successfully!'
        });
        return;
      }
    }

    throw new Error('No image generated');

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Amsterdam Marathon Photobooth' });
});

app.listen(PORT, () => {
  console.log(`🏃 Marathon Photobooth Backend running on port ${PORT}`);
});
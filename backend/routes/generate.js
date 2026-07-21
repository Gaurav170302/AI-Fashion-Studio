import express from 'express';
import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@gradio/client';
import Garment from '../models/Garment.js';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// ─── Upload garment to Litterbox to get a public URL ──────────────────────────
async function uploadToLitterbox(localFilePath) {
  try {
    if (!fs.existsSync(localFilePath)) throw new Error(`File not found: ${localFilePath}`);
    const fileBuffer = fs.readFileSync(localFilePath);
    const filename = path.basename(localFilePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '1h');
    formData.append('fileToUpload', new Blob([fileBuffer], { type: mimeType }), filename);
    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST', body: formData, signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = (await response.text()).trim();
    if (!text.startsWith('http')) throw new Error(`Bad response: ${text}`);
    console.log(`✓ Garment hosted at Litterbox: ${text}`);
    return text;
  } catch (err) {
    console.warn(`✗ Litterbox failed: ${err.message}`);
    return null;
  }
}

// ─── REAL Virtual Try-On via HuggingFace IDM-VTON Space ───────────────────────
// This actually places the garment ON the model — not a text-to-image hack!
async function virtualTryOnIDMVTON(personImageUrl, garmentImageUrl, garmentCategory, seed) {
  console.log('[IDM-VTON] Connecting to HuggingFace Space...');

  // Use the yisol IDM-VTON space (free, public, uses IDM-VTON model)
  const hfOptions = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN, events: ['data', 'status', 'log', 'error'] } : { events: ['data', 'status', 'log', 'error'] };
  const client = await Client.connect('yisol/IDM-VTON', hfOptions);

  console.log('[IDM-VTON] Fetching person and garment images...');

  // Fetch both images as Blobs for the Gradio client
  const [personRes, garmentRes] = await Promise.all([
    fetch(personImageUrl, { signal: AbortSignal.timeout(20000) }),
    fetch(garmentImageUrl, { signal: AbortSignal.timeout(20000) })
  ]);

  if (!personRes.ok) throw new Error(`Failed to fetch person image: ${personRes.status}`);
  if (!garmentRes.ok) throw new Error(`Failed to fetch garment image: ${garmentRes.status}`);

  const personBlob = await personRes.blob();
  const garmentBlob = await garmentRes.blob();

  // Garment description for the model
  const garmentDescMap = {
    'T-Shirt': 'a casual fitted t-shirt',
    'Shirt': 'a tailored button-up shirt',
    'Hoodie': 'a comfortable hoodie sweatshirt',
    'Dress': 'a fashionable dress'
  };
  const garmentDesc = garmentDescMap[garmentCategory] || 'a garment';

  console.log(`[IDM-VTON] Submitting try-on: garment="${garmentDesc}", seed=${seed}`);

  // Call the try-on function
  // IDM-VTON Space params: person_image, garment_image, garment_description,
  //                        auto_mask, auto_crop, denoise_steps, seed
  const result = await client.predict('/tryon', {
    dict: {
      background: personBlob,
      layers: [],
      composite: null
    },
    garm_img: garmentBlob,
    garment_des: garmentDesc,
    is_checked: true,       // Auto-generate mask (recommended)
    is_checked_crop: false, // Don't auto-crop
    denoise_steps: 30,
    seed: seed || Math.floor(Math.random() * 9999)
  });

  console.log('[IDM-VTON] Result received!');

  // Extract the output image URL from Gradio response
  if (!result?.data?.[0]) throw new Error('No output image from IDM-VTON');

  const outputImg = result.data[0];

  // Gradio can return the image as URL, path, or base64
  if (typeof outputImg === 'string' && outputImg.startsWith('http')) return outputImg;
  if (outputImg?.url) return outputImg.url;
  if (outputImg?.path) return `https://yisol-idm-vton.hf.space/file=${outputImg.path}`;

  // If it's a base64 data URI, return it directly
  if (typeof outputImg === 'string' && outputImg.startsWith('data:')) return outputImg;

  throw new Error(`Cannot parse IDM-VTON output: ${JSON.stringify(outputImg).slice(0, 100)}`);
}

// ─── REAL Virtual Try-On via Nymbo Space (fallback — different GPU cluster) ──
async function virtualTryOnNymbo(personImageUrl, garmentImageUrl, garmentCategory, seed) {
  console.log('[Nymbo] Connecting to Nymbo/Virtual-Try-On Space...');

  const hfOptions = process.env.HF_TOKEN
    ? { hf_token: process.env.HF_TOKEN, events: ['data', 'status', 'log', 'error'] }
    : { events: ['data', 'status', 'log', 'error'] };

  const client = await Client.connect('Nymbo/Virtual-Try-On', hfOptions);

  console.log('[Nymbo] Fetching person and garment images...');

  const [personRes, garmentRes] = await Promise.all([
    fetch(personImageUrl, { signal: AbortSignal.timeout(20000) }),
    fetch(garmentImageUrl, { signal: AbortSignal.timeout(20000) })
  ]);

  if (!personRes.ok) throw new Error(`Failed to fetch person image: ${personRes.status}`);
  if (!garmentRes.ok) throw new Error(`Failed to fetch garment image: ${garmentRes.status}`);

  const personBlob = await personRes.blob();
  const garmentBlob = await garmentRes.blob();

  const garmentDescMap = {
    'T-Shirt': 'Short Sleeve Round Neck T-Shirt',
    'Shirt': 'Button-up Dress Shirt with Collar',
    'Hoodie': 'Pullover Hoodie Sweatshirt',
    'Dress': 'Casual Fashion Dress'
  };
  const garmentDesc = garmentDescMap[garmentCategory] || garmentCategory;

  console.log(`[Nymbo] Submitting try-on, seed=${seed}...`);

  const result = await client.predict('/tryon', {
    dict: {
      background: personBlob,
      layers: [],
      composite: null
    },
    garm_img: garmentBlob,
    garment_des: garmentDesc,
    is_checked: true,
    is_checked_crop: false,
    denoise_steps: 30,
    seed: seed || Math.floor(Math.random() * 9999)
  });

  console.log('[Nymbo] Result received!');

  if (!result?.data?.[0]) throw new Error('No output image from Nymbo');

  const outputImg = result.data[0];
  if (typeof outputImg === 'string' && outputImg.startsWith('http')) return outputImg;
  if (outputImg?.url) return outputImg.url;
  if (outputImg?.path) return `https://nymbo-virtual-try-on.hf.space/file=${outputImg.path}`;
  if (typeof outputImg === 'string' && outputImg.startsWith('data:')) return outputImg;

  throw new Error(`Cannot parse Nymbo output: ${JSON.stringify(outputImg).slice(0, 100)}`);
}

// ─── POST /api/generate ────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { garmentId, modelType, style, pose, category, personImageId, staticModelUrl, qualityMode } = req.body;

    if (!garmentId || !modelType || !style || !pose) {
      return res.status(400).json({ success: false, message: 'Missing required: garmentId, modelType, style, pose' });
    }

    let garmentUrl = '';
    let garmentPublicUrl = null;
    let garmentCategory = category || 'T-Shirt';
    let dbGarmentId = null;

    // ── Resolve garment ────────────────────────────────────────────────────────
    if (garmentId.startsWith('https://') || garmentId.startsWith('http://images.unsplash')) {
      // Public URL (demo template from Unsplash) — use directly
      garmentUrl = garmentId;
      garmentPublicUrl = garmentId;
      console.log('[Garment] Public URL (template)');

    } else if (garmentId.startsWith('data:')) {
      // Base64 data URL — can't pass to external API directly
      garmentUrl = garmentId;
      garmentPublicUrl = null;
      console.log('[Garment] Base64 (no public URL)');

    } else {
      // MongoDB ID — look up garment in DB
      const garment = await Garment.findById(garmentId);
      if (!garment) return res.status(404).json({ success: false, message: 'Garment not found' });
      garmentUrl = garment.imageUrl;
      garmentCategory = garment.category || garmentCategory;
      dbGarmentId = garment._id;

      if (garmentUrl.startsWith('http://localhost') || !garmentUrl.startsWith('http')) {
        // Local file — must upload to Litterbox for a public URL
        const filename = path.basename(garmentUrl);
        const localPath = path.join(__dirname, '../public/uploads', filename);
        console.log(`[Garment] Uploading local file to Litterbox: ${filename}`);
        garmentPublicUrl = await uploadToLitterbox(localPath);
      } else {
        garmentPublicUrl = garmentUrl; // Already public (Cloudinary)
      }
    }

    // ── Pick the person model photo ────────────────────────────────────────────
    if (!staticModelUrl && !personImageId) {
      return res.status(400).json({
        success: false,
        message: "Please select a model."
      });
    }

    let personImageUrl = staticModelUrl || null;

    if (personImageId) {
      const personGarment = await Garment.findById(personImageId);
      if (personGarment) {
        let pUrl = personGarment.imageUrl;
        if (pUrl.startsWith('http://localhost') || !pUrl.startsWith('http')) {
          const pFilename = path.basename(pUrl);
          const pLocalPath = path.join(__dirname, '../public/uploads', pFilename);
          console.log(`[Person] Uploading local file to Litterbox: ${pFilename}`);
          personImageUrl = await uploadToLitterbox(pLocalPath) || pUrl;
        } else {
          personImageUrl = pUrl;
        }
        console.log(`[Person] Custom person image resolved: ${personImageUrl}`);
      }
    }

    console.log(`[Generate] Quality: ${qualityMode || 'Standard'}, Category: ${garmentCategory}`);

    let finalGeneratedUrl = '';

    // ── PRODUCTION: Replicate IDM-VTON (when API key is configured) ────────────
    if (process.env.REPLICATE_API_TOKEN) {
      console.log('[Production] Using Replicate IDM-VTON...');
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      const vtonGarmentUrl = garmentPublicUrl || garmentUrl;
      const output = await replicate.run(
        'cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
        {
          input: {
            crop: true,
            seed: Math.floor(Math.random() * 999999),
            steps: 30,
            category: garmentCategory.toLowerCase().includes('dress') ? 'dresses' : 'upper_body',
            force_dc: false,
            garm_img: vtonGarmentUrl,
            human_img: personImageUrl,
            mask_only: false,
            guidance_scale: 2.5
          }
        }
      );
      finalGeneratedUrl = Array.isArray(output) ? output[0] : String(output);
      console.log(`[Replicate] Done: ${finalGeneratedUrl}`);

    } else {
      // ── DEMO: HuggingFace IDM-VTON Space (free, real virtual try-on) ──────
      const seed = Math.floor(Math.random() * 9999);

      if (garmentPublicUrl) {
        // Engine 1: IDM-VTON
        try {
          finalGeneratedUrl = await virtualTryOnIDMVTON(personImageUrl, garmentPublicUrl, garmentCategory, seed);
          console.log(`[IDM-VTON] Success: ${finalGeneratedUrl.slice(0, 80)}...`);
        } catch (hfErr) {
          const isQuota = hfErr.message?.includes('quota') || hfErr.message?.includes('exceeded');
          if (isQuota) {
            console.warn('[IDM-VTON] Quota exceeded. Falling back to Kolors Try-On...');
          } else {
            console.warn(`[IDM-VTON] Failed: ${hfErr.message}. Trying Kolors fallback...`);
          }
          // Engine 2: Nymbo Virtual Try-On (different GPU cluster)
          try {
            finalGeneratedUrl = await virtualTryOnNymbo(personImageUrl, garmentPublicUrl, garmentCategory, seed);
            console.log(`[Nymbo] Success: ${finalGeneratedUrl.slice(0, 80)}...`);
          } catch (nymboErr) {
            console.error(`[Nymbo] Also failed: ${nymboErr.message}`);
            throw new Error(
              "Virtual Try-On failed. IDM-VTON and Nymbo services are unavailable."
            );
          }
        }
      } else {
        // No public garment URL (base64 only) — Cannot do try-on
        console.warn('[Demo] No public garment URL available for Try-On.');
        throw new Error('Model service unavailable. Could not resolve public URL for garment.');
      }
    }

    // ── Save to DB ─────────────────────────────────────────────────────────────
    const generatedImage = await GeneratedImage.create({
      userId: req.user._id,
      garmentId: dbGarmentId,
      generatedImageUrl: finalGeneratedUrl,
      modelType,
      style,
      pose
    });

    res.status(201).json({ success: true, generatedImage });

  } catch (error) {
    console.error('[Generate Error]', error.message);
    res.status(500).json({ success: false, message: error.message || 'Generation failed' });
  }
});

export default router;

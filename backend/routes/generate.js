import express from 'express';
import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Garment from '../models/Garment.js';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';
import { tryOnManager } from '../services/tryon/TryOnManager.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Upload any local file to Litterbox → public URL ──────────────────────────
async function uploadToLitterbox(localFilePath) {
  try {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found at: ${localFilePath}`);
    }
    const fileBuffer = fs.readFileSync(localFilePath);
    const filename = path.basename(localFilePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('time', '1h'); // 1 hour — enough for generation
    formData.append('fileToUpload', new Blob([fileBuffer], { type: mimeType }), filename);

    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) throw new Error(`Litterbox HTTP ${response.status}`);
    const text = (await response.text()).trim();
    if (!text.startsWith('http')) throw new Error(`Litterbox bad response: "${text}"`);

    console.log(`✓ Uploaded to Litterbox: ${text}`);
    return text;
  } catch (err) {
    console.error(`✗ Litterbox upload failed: ${err.message}`);
    return null;
  }
}

// ─── Resolve a model/person image URL to a public-accessible URL ───────────────
// If it's a localhost URL (local model file), upload it to Litterbox first.
async function resolveToPublicUrl(rawUrl, localSearchDirs = []) {
  if (!rawUrl) return null;

  // Already fully public
  if (rawUrl.startsWith('https://') && !rawUrl.includes('localhost')) {
    return rawUrl;
  }

  // Extract filename from any URL type
  const filename = path.basename(rawUrl.split('?')[0]);

  // Try each directory
  for (const dir of localSearchDirs) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      console.log(`[Litterbox] Found local file: ${fullPath}`);
      return await uploadToLitterbox(fullPath);
    }
  }

  // If it contains a path hint after /models/ or /uploads/
  const modelMatch = rawUrl.match(/\/models\/(.+)$/);
  if (modelMatch) {
    const relativePath = modelMatch[1];
    const absPath = path.join(__dirname, '../public/models', relativePath);
    if (fs.existsSync(absPath)) {
      console.log(`[Litterbox] Found model image: ${absPath}`);
      return await uploadToLitterbox(absPath);
    }
  }

  const uploadMatch = rawUrl.match(/\/uploads\/(.+)$/);
  if (uploadMatch) {
    const absPath = path.join(__dirname, '../public/uploads', uploadMatch[1]);
    if (fs.existsSync(absPath)) {
      console.log(`[Litterbox] Found upload file: ${absPath}`);
      return await uploadToLitterbox(absPath);
    }
  }

  console.warn(`[Litterbox] Could not resolve "${rawUrl}" to a local file`);
  return null;
}

// ─── POST /api/generate ────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const {
      garmentId,
      modelType,
      style,
      pose,
      category,
      personImageId,
      staticModelUrl,
      qualityMode
    } = req.body;

    // ── Validate required fields ─────────────────────────────────────────────
    if (!garmentId) {
      return res.status(400).json({ success: false, message: 'Garment image is required.' });
    }
    if (!staticModelUrl && !personImageId) {
      return res.status(400).json({ success: false, message: 'Please select a model.' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Resolve Garment to Public URL
    // ─────────────────────────────────────────────────────────────────────────
    let garmentPublicUrl = null;
    let garmentCategory = category || 'T-Shirt';
    let dbGarmentId = null;

    if (garmentId.startsWith('https://') && !garmentId.includes('localhost')) {
      // Already public (Unsplash template, Cloudinary, etc.)
      garmentPublicUrl = garmentId;
      console.log('[Garment] Using public URL directly');

    } else if (garmentId.startsWith('data:')) {
      // Base64 — cannot be used by external APIs
      return res.status(400).json({
        success: false,
        message: 'Garment must be uploaded (not base64). Please upload the file first.'
      });

    } else {
      // MongoDB ObjectId — look up in DB
      const garment = await Garment.findById(garmentId).catch(() => null);
      if (!garment) {
        return res.status(404).json({ success: false, message: 'Garment not found in database.' });
      }
      garmentCategory = garment.category || garmentCategory;
      dbGarmentId = garment._id;

      const rawGarmentUrl = garment.imageUrl;
      console.log(`[Garment] DB record found. Raw URL: ${rawGarmentUrl}`);

      if (rawGarmentUrl.startsWith('https://') && !rawGarmentUrl.includes('localhost')) {
        // Already public (Cloudinary, etc.)
        garmentPublicUrl = rawGarmentUrl;
      } else {
        // Local file — upload to Litterbox
        const filename = path.basename(rawGarmentUrl.split('?')[0]);
        const localPath = path.join(__dirname, '../public/uploads', filename);
        console.log(`[Garment] Uploading to Litterbox: ${filename}`);
        garmentPublicUrl = await uploadToLitterbox(localPath);
      }
    }

    if (!garmentPublicUrl) {
      return res.status(400).json({
        success: false,
        message: 'Could not get a public URL for the garment. Please try re-uploading.'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Resolve Person / Model Image to Public URL
    // ─────────────────────────────────────────────────────────────────────────
    let personPublicUrl = null;

    if (personImageId) {
      // Custom uploaded person photo
      const personGarment = await Garment.findById(personImageId).catch(() => null);
      if (!personGarment) {
        return res.status(404).json({ success: false, message: 'Uploaded person image not found.' });
      }
      const rawPersonUrl = personGarment.imageUrl;
      console.log(`[Person] Custom upload raw URL: ${rawPersonUrl}`);

      if (rawPersonUrl.startsWith('https://') && !rawPersonUrl.includes('localhost')) {
        personPublicUrl = rawPersonUrl;
      } else {
        const pFilename = path.basename(rawPersonUrl.split('?')[0]);
        const pLocalPath = path.join(__dirname, '../public/uploads', pFilename);
        console.log(`[Person] Uploading custom person to Litterbox: ${pFilename}`);
        personPublicUrl = await uploadToLitterbox(pLocalPath);
      }

    } else if (staticModelUrl) {
      // Library model — URL from GET /api/models (e.g. http://localhost:5000/models/male/male-standing.jpg)
      console.log(`[Person] Library model URL: ${staticModelUrl}`);

      if (staticModelUrl.startsWith('https://') && !staticModelUrl.includes('localhost')) {
        // Already public
        personPublicUrl = staticModelUrl;
      } else {
        // localhost URL — resolve local file path and upload
        personPublicUrl = await resolveToPublicUrl(staticModelUrl, [
          path.join(__dirname, '../public/models/male'),
          path.join(__dirname, '../public/models/female'),
          path.join(__dirname, '../public/models/kids')
        ]);
      }
    }

    if (!personPublicUrl) {
      return res.status(400).json({
        success: false,
        message: 'Could not get a public URL for the selected model. Please select another model.'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEBUG LOG
    // ─────────────────────────────────────────────────────────────────────────
    console.log('====================================');
    console.log('MODEL URL:', personPublicUrl);
    console.log('GARMENT URL:', garmentPublicUrl);
    console.log('CATEGORY:', garmentCategory);
    console.log('STYLE:', style);
    console.log('POSE:', pose || 'Standing');
    console.log('QUALITY:', qualityMode || 'Standard');
    console.log('HF TOKEN:', process.env.HF_TOKEN ? 'FOUND' : 'MISSING');
    console.log('====================================');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Create and Start Job
    // ─────────────────────────────────────────────────────────────────────────
    const jobId = tryOnManager.createJob(
      req.user._id,
      dbGarmentId,
      personPublicUrl,
      garmentPublicUrl,
      garmentCategory,
      style || 'Casual',
      pose || 'Standing',
      modelType || 'Female'
    );

    // Background execution
    (async () => {
      try {
        await tryOnManager.executeJob(jobId);
        const job = tryOnManager.getJob(jobId);

        if (job?.status === 'completed' && job.resultUrl) {
          const generatedImage = await GeneratedImage.create({
            userId: job.userId,
            garmentId: job.dbGarmentId,
            generatedImageUrl: job.resultUrl,
            modelType: job.modelType,
            style: job.style,
            pose: job.pose
          });
          tryOnManager.updateJob(jobId, {
            dbRecordId: generatedImage._id,
            message: 'Complete — saved to your history'
          });
          console.log(`[Generate] ✓ Saved result to DB: ${generatedImage._id}`);
        }
      } catch (err) {
        console.error('[Generate Worker Error]', err.message);
        tryOnManager.updateJob(jobId, {
          status: 'failed',
          error: err.message,
          message: `Internal error: ${err.message}`
        });
      }
    })();

    // Return job ID immediately for polling
    res.status(202).json({ success: true, jobId, message: 'Generation started' });

  } catch (error) {
    console.error('[Generate Route Error]', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Generation failed. Please try again.'
    });
  }
});

// ─── GET /api/generate/status/:jobId ──────────────────────────────────────────
router.get('/status/:jobId', protect, (req, res) => {
  const job = tryOnManager.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  if (job.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  res.json({ success: true, job });
});

export default router;

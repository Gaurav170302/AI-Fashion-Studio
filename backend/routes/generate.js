import express from 'express';
import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import Garment from '../models/Garment.js';
import GeneratedImage from '../models/GeneratedImage.js';
import { protect } from '../middleware/auth.js';
import { tryOnManager } from '../services/tryon/TryOnManager.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudinaryConfigured = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// ─── Upload any local file to a public URL (Cloudinary -> Tmpfiles -> Catbox) ──
async function uploadPublicImage(localFilePath) {
  try {
    if (!fs.existsSync(localFilePath)) {
      console.error(`[Upload] File not found at: ${localFilePath}`);
      return null;
    }

    // Strategy 1: Cloudinary (if credentials exist)
    if (isCloudinaryConfigured()) {
      try {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        console.log(`[Cloudinary] Uploading local file: ${path.basename(localFilePath)}`);
        const result = await cloudinary.uploader.upload(localFilePath, {
          folder: 'ai_fashion_studio'
        });
        if (result && result.secure_url) {
          console.log(`✓ [Cloudinary] Uploaded successfully: ${result.secure_url}`);
          return result.secure_url;
        }
      } catch (cloudErr) {
        console.error(`[Cloudinary] Upload failed, trying fallbacks: ${cloudErr.message}`);
      }
    }

    // Strategy 2: Tmpfiles.org
    try {
      console.log(`[Tmpfiles] Uploading local file: ${path.basename(localFilePath)}`);
      const fileBuffer = fs.readFileSync(localFilePath);
      const filename = path.basename(localFilePath);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), filename);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const json = await response.json();
        if (json && json.data && json.data.url) {
          const directUrl = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          console.log(`✓ [Tmpfiles] Uploaded successfully: ${directUrl}`);
          return directUrl;
        }
      }
    } catch (tmpErr) {
      console.error(`[Tmpfiles] Upload failed: ${tmpErr.message}`);
    }

    // Strategy 3: Catbox.moe
    try {
      console.log(`[Catbox] Uploading local file: ${path.basename(localFilePath)}`);
      const fileBuffer = fs.readFileSync(localFilePath);
      const filename = path.basename(localFilePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', new Blob([fileBuffer], { type: mimeType }), filename);

      const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const text = (await response.text()).trim();
        if (text.startsWith('http')) {
          console.log(`✓ [Catbox] Uploaded successfully: ${text}`);
          return text;
        }
      }
    } catch (catErr) {
      console.error(`[Catbox] Upload failed: ${catErr.message}`);
    }

    console.error(`✗ All public upload strategies failed for: ${localFilePath}`);
    return null;
  } catch (err) {
    console.error(`✗ Public image upload error: ${err.message}`);
    return null;
  }
}

// ─── Resolve a model/person image URL to a public-accessible URL ───────────────
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
      console.log(`[Resolve] Found local file: ${fullPath}`);
      return await uploadPublicImage(fullPath);
    }
  }

  // If it contains a path hint after /models/ or /uploads/
  const modelMatch = rawUrl.match(/\/models\/(.+)$/);
  if (modelMatch) {
    const relativePath = modelMatch[1];
    const absPath = path.join(__dirname, '../public/models', relativePath);
    if (fs.existsSync(absPath)) {
      console.log(`[Resolve] Found model image: ${absPath}`);
      return await uploadPublicImage(absPath);
    }
  }

  const uploadMatch = rawUrl.match(/\/uploads\/(.+)$/);
  if (uploadMatch) {
    const absPath = path.join(__dirname, '../public/uploads', uploadMatch[1]);
    if (fs.existsSync(absPath)) {
      console.log(`[Resolve] Found upload file: ${absPath}`);
      return await uploadPublicImage(absPath);
    }
  }

  console.warn(`[Resolve] Could not resolve "${rawUrl}" to a local file`);
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
      qualityMode,
      featureMode,
      garmentName
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
        // Local file — upload to public URL
        const filename = path.basename(rawGarmentUrl.split('?')[0]);
        const localPath = path.join(__dirname, '../public/uploads', filename);
        console.log(`[Garment] Uploading local file to public URL: ${filename}`);
        garmentPublicUrl = await uploadPublicImage(localPath);
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
        console.log(`[Person] Uploading custom person to public URL: ${pFilename}`);
        personPublicUrl = await uploadPublicImage(pLocalPath);
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
      modelType || 'male',
      featureMode || 'virtual-tryon',
      qualityMode || 'Standard',
      garmentName || ''
    );

    // Background execution
    (async () => {
      try {
        await tryOnManager.executeJob(jobId);
        const job = tryOnManager.getJob(jobId);

        if (job?.status === 'completed' && job.resultUrl) {
          let finalGeneratedUrl = job.resultUrl;

          // If result is from HuggingFace, download and save it permanently (bypass hotlink/CORS blocks)
          if (job.resultUrl.includes('.hf.space')) {
            console.log(`[Generate] Downloading HF result image: ${job.resultUrl}`);
            try {
              const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
                for (let i = 0; i < retries; i++) {
                  try {
                    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
                    if (res.ok) return res;
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                  } catch (err) {
                    if (i === retries - 1) throw err;
                    console.warn(`[Generate] Fetch attempt ${i + 1} failed for result image: ${err.message}. Retrying...`);
                    await new Promise(r => setTimeout(r, delay));
                  }
                }
              };

              const imgRes = await fetchWithRetry(job.resultUrl);
              const buffer = Buffer.from(await imgRes.arrayBuffer());

              if (isCloudinaryConfigured()) {
                // Configure on-demand to guarantee credentials are set
                cloudinary.config({
                  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                  api_key: process.env.CLOUDINARY_API_KEY,
                  api_secret: process.env.CLOUDINARY_API_SECRET
                });

                // Upload buffer to Cloudinary
                const uploadPromise = new Promise((resolve, reject) => {
                  const stream = cloudinary.uploader.upload_stream(
                    { folder: 'ai-fashion-studio/generated' },
                    (error, result) => {
                      if (error) reject(error);
                      else resolve(result.secure_url);
                    }
                  );
                  stream.end(buffer);
                });

                finalGeneratedUrl = await uploadPromise;
                console.log(`[Generate] ✓ Uploaded HF result to Cloudinary: ${finalGeneratedUrl}`);
              } else {
                // Save locally
                const filename = `result-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
                const localPath = path.join(__dirname, '../public/uploads', filename);
                fs.writeFileSync(localPath, buffer);
                const port = process.env.PORT || 5000;
                finalGeneratedUrl = `http://localhost:${port}/uploads/${filename}`;
                console.log(`[Generate] ✓ Saved HF result locally: ${finalGeneratedUrl}`);
              }
            } catch (dlErr) {
              console.error(`[Generate] ✗ Failed to process HF result permanently: ${dlErr.message}`);
            }
          }

          const generatedImage = await GeneratedImage.create({
            userId: job.userId,
            garmentId: job.dbGarmentId || undefined,
            generatedImageUrl: finalGeneratedUrl,
            garmentUrl: job.garmentPublicUrl,
            modelImageUrl: job.personImageUrl,
            featureMode: job.featureMode,
            modelType: job.modelType,
            category: job.garmentCategory,
            style: job.style || 'Casual',
            pose: job.pose || 'Standing'
          });

          tryOnManager.updateJob(jobId, {
            resultUrl: finalGeneratedUrl, // Update in-memory job for the frontend polling response
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

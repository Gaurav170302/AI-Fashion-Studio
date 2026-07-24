import ReplicateProvider from './providers/replicate.js';
import IDMVTONProvider from './providers/idmVton.js';
import NymboProvider from './providers/nymbo.js';
import PollinationsProvider from './providers/pollinations.js';

class TryOnManager {
  constructor() {
    // Priority order: Replicate (paid, best quality) → IDM-VTON (free HF) → Nymbo (fallback) → Pollinations (last resort)
    this.providers = [
      new ReplicateProvider(),    // Priority 1: Paid — best quality, strict garment preservation
      new IDMVTONProvider(),      // Priority 2: Free HF spaces — IDM-VTON algorithm
      new NymboProvider(),        // Priority 3: Nymbo Virtual Try-On
      new PollinationsProvider()  // Priority 4: LAST RESORT ONLY — limited garment fidelity
    ];

    // In-memory job store for polling
    this.jobs = new Map();

    // Result cache: keyed by "garmentUrl|modelUrl" to avoid re-generating identical combos
    this.resultCache = new Map();
  }

  async initializeHealth() {
    console.log('[TryOnManager] Running provider health checks...');
    for (const provider of this.providers) {
      await provider.checkHealth();
      console.log(`  • ${provider.name}: ${provider.isAvailable ? '✓ ONLINE' : '✗ OFFLINE'}`);
    }
  }

  getHealthStatus() {
    const status = {};
    for (const provider of this.providers) {
      const key = provider.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      status[key] = provider.isAvailable ? 'online' : 'offline';
    }
    return status;
  }

  /**
   * Build a cache key from garment + model URLs
   */
  buildCacheKey(garmentUrl, modelUrl) {
    return `${garmentUrl}|${modelUrl}`;
  }

  /**
   * Check if a cached result exists for this garment+model combo
   */
  getCachedResult(garmentUrl, modelUrl) {
    const key = this.buildCacheKey(garmentUrl, modelUrl);
    return this.resultCache.get(key) || null;
  }

  /**
   * Store a result in the cache
   */
  setCachedResult(garmentUrl, modelUrl, resultUrl) {
    const key = this.buildCacheKey(garmentUrl, modelUrl);
    this.resultCache.set(key, {
      resultUrl,
      cachedAt: new Date()
    });
    // Evict old entries if cache grows too large (keep max 100 entries)
    if (this.resultCache.size > 100) {
      const firstKey = this.resultCache.keys().next().value;
      this.resultCache.delete(firstKey);
    }
  }

  createJob(userId, dbGarmentId, personImageUrl, garmentPublicUrl, garmentCategory, style, pose, modelType, featureMode, qualityMode, garmentName) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.jobs.set(jobId, {
      id: jobId,
      userId,
      dbGarmentId,
      personImageUrl,
      garmentPublicUrl,
      garmentCategory,
      garmentName: garmentName || '',
      style,
      pose,
      modelType,
      featureMode: featureMode || 'virtual-tryon',
      qualityMode: qualityMode || 'Standard',
      status: 'pending',
      message: 'Job queued. Starting generation...',
      resultUrl: null,
      error: null,
      createdAt: new Date()
    });
    return jobId;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) this.jobs.set(jobId, { ...job, ...updates });
  }

  async executeJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return;

    // Check cache first — skip generation if we already have a result
    const cached = this.getCachedResult(job.garmentPublicUrl, job.personImageUrl);
    if (cached) {
      console.log(`[TryOnManager] Cache hit for job ${jobId} — reusing previous result`);
      this.updateJob(jobId, {
        status: 'completed',
        message: 'Completed (from cache)',
        resultUrl: cached.resultUrl
      });
      return;
    }

    this.updateJob(jobId, { status: 'processing', message: 'Starting AI virtual try-on...' });

    const errors = [];
    const seed = Math.floor(Math.random() * 9999);
    const isEnhanced = job.qualityMode === 'Premium';

    for (const provider of this.providers) {
      if (!provider.isAvailable) {
        console.log(`[TryOnManager] Skipping ${provider.name} (offline/no key)`);
        continue;
      }

      const isPollinationsFallback = provider.name === 'Pollinations';
      const providerLabel = isPollinationsFallback
        ? `${provider.name} (last resort — your model won't be preserved)`
        : provider.name;

      this.updateJob(jobId, { message: `Running ${providerLabel}... (this takes 30–90 seconds)` });
      console.log(`[TryOnManager] Job ${jobId} [${job.featureMode}] → ${provider.name} (quality: ${job.qualityMode})`);

      try {
        const start = Date.now();
        const resultUrl = await provider.generate(
          job.personImageUrl,
          job.garmentPublicUrl,
          job.garmentCategory,
          seed,
          job.qualityMode,
          {
            modelType: job.modelType,
            pose: job.pose,
            style: job.style,
            featureMode: job.featureMode,
            garmentName: job.garmentName
          }
        );

        if (!resultUrl || typeof resultUrl !== 'string') {
          throw new Error(`${provider.name} returned invalid output`);
        }

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[TryOnManager] ✓ ${provider.name} succeeded in ${duration}s`);
        console.log(`[TryOnManager] Result URL: ${resultUrl.slice(0, 100)}`);

        // Only cache results from REAL try-on engines — NEVER cache Pollinations
        // because Pollinations ignores the selected model and generates a random person.
        // Caching it would cause repeated wrong results for the same garment.
        if (!isPollinationsFallback) {
          this.setCachedResult(job.garmentPublicUrl, job.personImageUrl, resultUrl);
        } else {
          console.warn('[TryOnManager] Pollinations result NOT cached — retries will attempt real engines again');
        }

        const completedMessage = isPollinationsFallback
          ? `⚠ Generated via Pollinations fallback (${duration}s). Your selected model was not preserved — this is a generic fashion image. Try again when Replicate/IDM-VTON are available.`
          : `Completed via ${provider.name} in ${duration}s`;

        this.updateJob(jobId, {
          status: 'completed',
          providerUsed: provider.name,
          isPollinationsFallback,
          message: completedMessage,
          resultUrl
        });
        return;

      } catch (err) {
        const msg = `${provider.name}: ${err.message}`;
        console.error(`[TryOnManager] ✗ ${msg}`);
        errors.push(msg);
        this.updateJob(jobId, { message: `${provider.name} failed, trying next...` });
      }
    }

    // All providers failed
    const errorSummary = errors.join(' | ');
    console.error(`[TryOnManager] All providers failed: ${errorSummary}`);
    this.updateJob(jobId, {
      status: 'failed',
      message: 'Virtual try-on could not be completed. Please try again or use a different model image.',
      error: errorSummary
    });
  }
}

export const tryOnManager = new TryOnManager();

import ReplicateProvider from './providers/replicate.js';
import IDMVTONProvider from './providers/idmVton.js';
import FashnProvider from './providers/fashn.js';

class TryOnManager {
  constructor() {
    // Priority order: Replicate (paid, reliable) → IDM-VTON (free HF, tries many spaces) → FasHn.ai (free, needs key)
    this.providers = [
      new ReplicateProvider(),   // Paid — best quality
      new IDMVTONProvider(),     // Free HF spaces — tries 6+ mirrors
      new FashnProvider()        // Free API — needs FASHN_API_KEY
    ];

    // In-memory job store for polling
    this.jobs = new Map();
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

  createJob(userId, dbGarmentId, personImageUrl, garmentPublicUrl, garmentCategory, style, pose, modelType) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.jobs.set(jobId, {
      id: jobId,
      userId,
      dbGarmentId,
      personImageUrl,
      garmentPublicUrl,
      garmentCategory,
      style,
      pose,
      modelType,
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

    this.updateJob(jobId, { status: 'processing', message: 'Starting AI virtual try-on...' });

    const errors = [];
    const seed = Math.floor(Math.random() * 9999);

    for (const provider of this.providers) {
      if (!provider.isAvailable) {
        console.log(`[TryOnManager] Skipping ${provider.name} (offline/no key)`);
        continue;
      }

      this.updateJob(jobId, { message: `Running ${provider.name}... (this takes 30–90 seconds)` });
      console.log(`[TryOnManager] Job ${jobId} → ${provider.name}`);

      try {
        const start = Date.now();
        const resultUrl = await provider.generate(
          job.personImageUrl,
          job.garmentPublicUrl,
          job.garmentCategory,
          seed
        );

        // Validate output
        if (!resultUrl || typeof resultUrl !== 'string') {
          throw new Error(`${provider.name} returned invalid output`);
        }

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[TryOnManager] ✓ ${provider.name} succeeded in ${duration}s`);
        console.log(`[TryOnManager] Result URL: ${resultUrl.slice(0, 100)}`);

        this.updateJob(jobId, {
          status: 'completed',
          message: `Completed via ${provider.name} in ${duration}s`,
          resultUrl
        });
        return; // Done

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
      message: 'Virtual try-on could not be completed.',
      error: errorSummary
    });
  }
}

export const tryOnManager = new TryOnManager();

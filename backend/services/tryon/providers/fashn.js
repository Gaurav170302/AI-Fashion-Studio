import BaseProvider from './BaseProvider.js';

/**
 * FasHn.ai Virtual Try-On Provider
 * Free API with registration at https://fashn.ai
 * Set FASHN_API_KEY in .env for authenticated access
 * 
 * Without API key: still attempts anonymous endpoint
 */
export default class FashnProvider extends BaseProvider {
  constructor() {
    super('FasHn.ai');
    this.baseUrl = 'https://api.fashn.ai/v1';
  }

  async checkHealth() {
    if (!process.env.FASHN_API_KEY) {
      this.isAvailable = false;
      this.lastChecked = new Date();
      return false;
    }
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        headers: { Authorization: `Bearer ${process.env.FASHN_API_KEY}` },
        signal: AbortSignal.timeout(8000)
      });
      this.isAvailable = res.ok;
      this.lastChecked = new Date();
      return res.ok;
    } catch {
      this.isAvailable = false;
      this.lastChecked = new Date();
      return false;
    }
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed) {
    if (!process.env.FASHN_API_KEY) {
      throw new Error('FasHn.ai: FASHN_API_KEY not configured');
    }

    const categoryMap = {
      'T-Shirt': 'tops',
      'Shirt': 'tops',
      'Hoodie': 'tops',
      'Jacket': 'tops',
      'Dress': 'one-pieces',
      'Pants': 'bottoms'
    };
    const category = categoryMap[garmentCategory] || 'tops';

    console.log('[FasHn] Submitting run...');
    const runRes = await fetch(`${this.baseUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FASHN_API_KEY}`
      },
      body: JSON.stringify({
        model_image: personImageUrl,
        garment_image: garmentImageUrl,
        category,
        seed: seed || Math.floor(Math.random() * 9999)
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      throw new Error(`FasHn.ai run failed ${runRes.status}: ${errText}`);
    }

    const runData = await runRes.json();
    const predictionId = runData.id;
    if (!predictionId) throw new Error('FasHn.ai: no prediction ID returned');

    // Poll for result
    const maxWait = 120000; // 2 minutes
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));

      const statusRes = await fetch(`${this.baseUrl}/status/${predictionId}`, {
        headers: { Authorization: `Bearer ${process.env.FASHN_API_KEY}` },
        signal: AbortSignal.timeout(10000)
      });

      if (!statusRes.ok) continue;

      const status = await statusRes.json();
      console.log(`[FasHn] Status: ${status.status}`);

      if (status.status === 'completed') {
        const outputUrl = status.output?.[0] || status.output;
        if (typeof outputUrl === 'string' && outputUrl.startsWith('http')) {
          console.log('[FasHn] ✓ Success:', outputUrl.slice(0, 80));
          return outputUrl;
        }
        throw new Error('FasHn.ai: completed but no output URL');
      }

      if (status.status === 'failed') {
        throw new Error(`FasHn.ai generation failed: ${status.error || 'Unknown error'}`);
      }
    }

    throw new Error('FasHn.ai: timeout after 2 minutes');
  }
}

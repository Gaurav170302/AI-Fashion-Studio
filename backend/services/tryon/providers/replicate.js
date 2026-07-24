import Replicate from 'replicate';
import BaseProvider from './BaseProvider.js';

export default class ReplicateProvider extends BaseProvider {
  constructor() {
    super('Replicate');
    this.replicate = null;
  }

  async checkHealth() {
    if (!process.env.REPLICATE_API_TOKEN) {
      this.isAvailable = false;
      this.lastChecked = new Date();
      return false;
    }
    this.replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    try {
      await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton', {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
        signal: AbortSignal.timeout(10000)
      });
      this.isAvailable = true;
      this.lastChecked = new Date();
      return true;
    } catch (err) {
      this.isAvailable = false;
      this.lastChecked = new Date();
      return false;
    }
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed, qualityMode) {
    if (!this.replicate) throw new Error('Replicate client not initialized');

    // Quality tiers
    const isEnhanced = qualityMode === 'Premium';
    const steps = isEnhanced ? 50 : 40;
    const guidanceScale = isEnhanced ? 4.0 : 3.5;

    const category = garmentCategory.toLowerCase().includes('dress') ||
                     garmentCategory.toLowerCase().includes('saree')
      ? 'dresses'
      : garmentCategory.toLowerCase().includes('pant') ||
        garmentCategory.toLowerCase().includes('bottom')
        ? 'lower_body'
        : 'upper_body';

    console.log(`[Replicate] Running with steps=${steps}, guidance=${guidanceScale}, category=${category}`);

    const output = await this.replicate.run(
      'cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
      {
        input: {
          crop: false,           // Preserve hands, fingers, accessories
          seed: seed || Math.floor(Math.random() * 999999),
          steps,
          category,
          force_dc: false,
          garm_img: garmentImageUrl,
          human_img: personImageUrl,
          mask_only: false,
          guidance_scale: guidanceScale
        }
      }
    );

    return Array.isArray(output) ? output[0] : String(output);
  }
}

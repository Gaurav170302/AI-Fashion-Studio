import { Client } from '@gradio/client';
import BaseProvider from './BaseProvider.js';

// Multiple IDM-VTON / Try-On spaces to try (bypass ZeroGPU quota exhaustion)
// We only keep spaces that actually run the model, and we reject mock/static placeholders.
const IDM_SPACES = [
  'yisol/IDM-VTON',
  'zhengchong/CatVTON',
  'Nymbo/Virtual-Try-On',
  'sujeetsinghsarotiya/IDM-VTON',
  'sagarmathasilks/IDM-VTON',
  'carnoba/IDM-VTON'
];

export default class IDMVTONProvider extends BaseProvider {
  constructor() {
    super('IDM-VTON');
  }

  async checkHealth() {
    this.isAvailable = true;
    this.lastChecked = new Date();
    return true;
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed) {
    const hfOptions = process.env.HF_TOKEN
      ? { hf_token: process.env.HF_TOKEN }
      : {};

    console.log('====================================');
    console.log('MODEL URL:', personImageUrl);
    console.log('GARMENT URL:', garmentImageUrl);
    console.log('CATEGORY:', garmentCategory);
    console.log('HF TOKEN:', process.env.HF_TOKEN ? 'FOUND' : 'MISSING');
    console.log('====================================');

    if (!personImageUrl || !garmentImageUrl) {
      throw new Error('Person image or garment image URL is missing');
    }

    // Pre-fetch both images as Blobs to bypass localhost accessibility constraints
    let personBlob, garmentBlob;
    try {
      const [personRes, garmentRes] = await Promise.all([
        fetch(personImageUrl, { signal: AbortSignal.timeout(25000) }),
        fetch(garmentImageUrl, { signal: AbortSignal.timeout(25000) })
      ]);
      if (!personRes.ok) throw new Error(`Person image fetch failed: ${personRes.status} ${personRes.statusText}`);
      if (!garmentRes.ok) throw new Error(`Garment image fetch failed: ${garmentRes.status} ${garmentRes.statusText}`);
      personBlob = await personRes.blob();
      garmentBlob = await garmentRes.blob();
    } catch (fetchErr) {
      throw new Error(`Image fetch failed: ${fetchErr.message}`);
    }

    console.log(`[IDM-VTON] Blobs ready — person: ${personBlob.size} bytes, garment: ${garmentBlob.size} bytes`);

    const garmentDescMap = {
      'T-Shirt': 'Short Sleeve Round Neck T-Shirt',
      'Shirt': 'Button-up Dress Shirt with Collar',
      'Hoodie': 'Pullover Hoodie Sweatshirt',
      'Dress': 'Casual Fashion Dress',
      'Jacket': 'Casual Jacket Outerwear',
      'Pants': 'Casual Pants Trousers',
      'Person': 'full body clothing'
    };
    const garmentDesc = garmentDescMap[garmentCategory] || garmentCategory || 'garment';

    let lastError = null;

    for (const space of IDM_SPACES) {
      try {
        console.log(`[IDM-VTON] Connecting to space: ${space}`);
        const client = await Client.connect(space, hfOptions);
        
        // Dynamic detection of endpoints & parameter requirements
        const apiInfo = await client.view_api();
        const endpoints = apiInfo.named_endpoints;
        
        let result = null;
        console.log(`[IDM-VTON] Space ${space} connected. Available endpoints:`, Object.keys(endpoints));

        if (endpoints['/submit_function']) {
          // zhengchong/CatVTON signature (person_image, cloth_image, cloth_type, num_inference_steps, guidance_scale, seed, show_type)
          console.log(`[IDM-VTON] Running /submit_function on ${space}...`);
          result = await client.predict('/submit_function', [
            { background: personBlob, layers: [], composite: null },
            garmentBlob,
            'upper',
            30,
            2.5,
            seed || 42,
            'result only'
          ]);

        } else if (endpoints['/tryon']) {
          // yisol signature (dict, garm_img, garment_des, is_checked, is_checked_crop, denoise_steps, seed)
          console.log(`[IDM-VTON] Running /tryon on ${space}...`);
          result = await client.predict('/tryon', {
            dict: { background: personBlob, layers: [], composite: null },
            garm_img: garmentBlob,
            garment_des: garmentDesc,
            is_checked: true,
            is_checked_crop: false,
            denoise_steps: 30,
            seed: seed || Math.floor(Math.random() * 9999)
          });

        } else if (endpoints['/predict']) {
          // Predict endpoint (generic tryon signature)
          console.log(`[IDM-VTON] Running /predict on ${space}...`);
          result = await client.predict('/predict', [garmentBlob, personBlob]);

        } else {
          throw new Error(`Supported try-on endpoints (/tryon, /submit_function, /predict) not found on ${space}`);
        }

        // Parse result data
        const outputImg = Array.isArray(result?.data) ? result.data[0] : (result?.data || result);
        if (!outputImg) throw new Error(`Empty response from ${space}`);

        const subdomain = space.replace('/', '-').toLowerCase();
        let outputUrl = null;

        if (typeof outputImg === 'string' && outputImg.startsWith('http')) outputUrl = outputImg;
        else if (outputImg?.url) outputUrl = outputImg.url;
        else if (outputImg?.path) outputUrl = `https://${subdomain}.hf.space/file=${outputImg.path}`;
        else if (typeof outputImg === 'string' && outputImg.startsWith('data:')) outputUrl = outputImg;

        if (!outputUrl) {
          throw new Error(`Cannot parse output format: ${JSON.stringify(outputImg).slice(0, 100)}`);
        }

        // ── STRICT SAFEGUARD: Detect and reject mock placeholder images ──
        const lowerUrl = outputUrl.toLowerCase();
        if (lowerUrl.includes('finalimg.png') || lowerUrl.includes('bus.png') || lowerUrl.includes('placeholder')) {
          throw new Error('Space returned a static mock placeholder image instead of running the model.');
        }

        console.log(`[IDM-VTON] ✓ Success with space: ${space} → ${outputUrl.slice(0, 80)}...`);
        return outputUrl;

      } catch (err) {
        console.warn(`[IDM-VTON] ✗ Space ${space} failed: ${err.message}`);
        lastError = err;
      }
    }

    throw new Error(`All IDM-VTON spaces failed. Last error: ${lastError?.message}`);
  }
}

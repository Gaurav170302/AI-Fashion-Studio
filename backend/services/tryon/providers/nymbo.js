import { Client } from '@gradio/client';
import BaseProvider from './BaseProvider.js';

export default class NymboProvider extends BaseProvider {
  constructor() {
    super('Nymbo');
  }

  async checkHealth() {
    try {
      const hfOptions = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {};
      const client = await Client.connect('Nymbo/Virtual-Try-On', hfOptions);
      this.isAvailable = true;
      this.lastChecked = new Date();
      return true;
    } catch (err) {
      this.isAvailable = false;
      this.lastChecked = new Date();
      return false;
    }
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed) {
    const hfOptions = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {};
    const client = await Client.connect('Nymbo/Virtual-Try-On', hfOptions);

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

    const result = await client.predict('/tryon', {
      dict: { background: personBlob, layers: [], composite: null },
      garm_img: garmentBlob,
      garment_des: garmentDesc,
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: seed || Math.floor(Math.random() * 9999)
    });

    if (!result?.data?.[0]) throw new Error('No output image from Nymbo');

    const outputImg = result.data[0];
    if (typeof outputImg === 'string' && outputImg.startsWith('http')) return outputImg;
    if (outputImg?.url) return outputImg.url;
    if (outputImg?.path) return `https://nymbo-virtual-try-on.hf.space/file=${outputImg.path}`;
    if (typeof outputImg === 'string' && outputImg.startsWith('data:')) return outputImg;

    throw new Error(`Cannot parse Nymbo output`);
  }
}

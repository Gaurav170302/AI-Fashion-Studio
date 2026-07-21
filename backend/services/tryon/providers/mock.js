import BaseProvider from './BaseProvider.js';

export default class MockProvider extends BaseProvider {
  constructor() {
    super('Mock Fallback');
  }

  async checkHealth() {
    this.isAvailable = true; // Always available
    this.lastChecked = new Date();
    return true;
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed) {
    // We do NOT return a random stock photo, as that violates the requirement 
    // to not generate random people or replace the model.
    throw new Error('All Free Virtual Try-On engines (IDM-VTON, Nymbo) are currently at capacity or offline. Please configure REPLICATE_API_TOKEN for production use.');
  }
}

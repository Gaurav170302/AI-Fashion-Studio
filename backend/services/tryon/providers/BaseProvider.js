export default class BaseProvider {
  constructor(name) {
    this.name = name;
    this.isAvailable = false;
    this.lastChecked = null;
  }

  async checkHealth() {
    throw new Error('checkHealth not implemented');
  }

  async generate(personImageUrl, garmentImageUrl, garmentCategory, seed) {
    throw new Error('generate not implemented');
  }
}

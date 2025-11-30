export default class AbstractRenderer {
  constructor(config = {}) {
    if (new.target === AbstractRenderer) {
      throw new Error('Cannot instantiate abstract class AbstractRenderer');
    }
    this.config = config;
    this.isInitialized = false;
  }

  async initialize(element, dimensions) {
    throw new Error('initialize() must be implemented by subclass');
  }

  clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  async renderLines(datasets, scales, options = {}) {
    throw new Error('renderLines() must be implemented by subclass');
  }

  async renderBars(datasets, scales, options = {}) {
    throw new Error('renderBars() must be implemented by subclass');
  }

  setViewport(viewport) {
    throw new Error('setViewport() must be implemented by subclass');
  }

  update(datasets) {
    throw new Error('update() must be implemented by subclass');
  }

  destroy() {
    this.isInitialized = false;
  }

  supportsFeature(feature) {
    const supportedFeatures = this.getSupportedFeatures();
    return supportedFeatures.includes(feature);
  }

  getSupportedFeatures() {
    throw new Error('getSupportedFeatures() must be implemented by subclass');
  }

  getPerformanceProfile() {
    return {
      maxDataPoints: Infinity,
      renderingType: 'unknown',
      gpuAccelerated: false,
      memoryUsage: 'low'
    };
  }
}

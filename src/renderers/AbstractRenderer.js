/**
 * AbstractRenderer - Base interface that all renderers must implement
 * 
 * This defines the contract for SVG, Canvas, and WebGL renderers to ensure
 * consistent behavior and allow seamless switching between rendering backends.
 * 
 * @abstract
 */
export default class AbstractRenderer {
  constructor(config = {}) {
    if (new.target === AbstractRenderer) {
      throw new Error('Cannot instantiate abstract class AbstractRenderer');
    }
    
    this.config = config;
    this.isInitialized = false;
  }

  /**
   * Initialize the renderer with canvas/context
   * @param {HTMLCanvasElement|SVGElement} element - Rendering target
   * @param {Object} dimensions - { width, height }
   * @abstract
   */
  async initialize(element, dimensions) {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Clear the rendering surface
   * @abstract
   */
  clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  /**
   * Render line data
   * @param {Array} datasets - Array of datasets to render
   * @param {Object} scales - Chart scales for coordinate transformation
   * @param {Object} options - Rendering options
   * @abstract
   */
  async renderLines(datasets, scales, options = {}) {
    throw new Error('renderLines() must be implemented by subclass');
  }

  /**
   * Render bar data
   * @param {Array} datasets - Array of datasets to render
   * @param {Object} scales - Chart scales for coordinate transformation
   * @param {Object} options - Rendering options
   * @abstract
   */
  async renderBars(datasets, scales, options = {}) {
    throw new Error('renderBars() must be implemented by subclass');
  }

  /**
   * Set viewport/clipping region
   * @param {Object} viewport - { x, y, width, height }
   * @abstract
   */
  setViewport(viewport) {
    throw new Error('setViewport() must be implemented by subclass');
  }

  /**
   * Update renderer with new data
   * @param {Array} datasets - New datasets
   * @abstract
   */
  update(datasets) {
    throw new Error('update() must be implemented by subclass');
  }

  /**
   * Destroy renderer and cleanup resources
   * @abstract
   */
  destroy() {
    this.isInitialized = false;
  }

  /**
   * Check if renderer supports a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  supportsFeature(feature) {
    const supportedFeatures = this.getSupportedFeatures();
    return supportedFeatures.includes(feature);
  }

  /**
   * Get list of supported features
   * @returns {Array<string>}
   * @abstract
   */
  getSupportedFeatures() {
    throw new Error('getSupportedFeatures() must be implemented by subclass');
  }

  /**
   * Get performance characteristics
   * @returns {Object}
   */
  getPerformanceProfile() {
    return {
      maxDataPoints: Infinity,
      renderingType: 'unknown',
      gpuAccelerated: false,
      memoryUsage: 'low'
    };
  }
}
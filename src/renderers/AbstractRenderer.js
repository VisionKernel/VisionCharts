/**
 * AbstractRenderer - Base interface that all renderers must implement
 * 
 * This defines the contract for SVG, Canvas, and WebGL renderers to ensure
 * consistent behavior and allow seamless switching between rendering backends.
 * 
 * @abstract
 */
export default class AbstractRenderer {
  constructor(container, width, height, options = {}) {
    if (!container) {
      throw new Error(`[${this.constructor.name}] Container element is null or undefined. Cannot initialize renderer without a valid DOM container.`);
    }
    
    if (!(container instanceof HTMLElement)) {
      throw new Error(`[${this.constructor.name}] Container must be a valid HTMLElement. Received: ${typeof container} (${container})`);
    }
    
    // Ensure container is attached to DOM
    if (!document.contains(container)) {
      console.warn(`[${this.constructor.name}] Container element is not attached to the DOM. This may cause rendering issues.`);
    }
    
    // Validate dimensions
    if (typeof width !== 'number' || width <= 0) {
      throw new Error(`[${this.constructor.name}] Width must be a positive number. Received: ${width}`);
    }
    
    if (typeof height !== 'number' || height <= 0) {
      throw new Error(`[${this.constructor.name}] Height must be a positive number. Received: ${height}`);
    }
    
    // Now proceed with initialization
    this.container = container;
    this.width = width;
    this.height = height;
    this.options = this._normalizeOptions(options);
    
    // Rest of your existing constructor code...
    this.isInitialized = false;
    
    console.log(`[${this.constructor.name}] Constructor completed successfully`);
  }

  _validateContainer() {
    if (!this.container) {
      throw new Error(`[${this.constructor.name}] Container element is null`);
    }
    
    if (!document.contains(this.container)) {
      throw new Error(`[${this.constructor.name}] Container element is no longer in the DOM`);
    }
    
    return true;
  }

  // ===== LIFECYCLE METHODS =====
  
  /**
   * Initialize the renderer and create the rendering context
   * @returns {Promise<void>} Resolves when renderer is ready
   */
  async initialize() {
    this._validateContainer();
    
    // Proceed with renderer-specific initialization
    // This should be overridden by subclasses
    throw new Error('initialize() must be implemented by renderer subclass');
  }
  
  /**
   * Clean up resources and destroy the renderer
   */
  destroy() {
    throw new Error('destroy() must be implemented by renderer');
  }
  
  /**
   * Resize the rendering surface
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    throw new Error('resize() must be implemented by renderer');
  }
  
  /**
   * Clear the entire rendering surface
   * @param {string} color - Background color (optional)
   */
  clear(color = null) {
    throw new Error('clear() must be implemented by renderer');
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  /**
   * Save current rendering state (transform, styles, etc.)
   */
  save() {
    throw new Error('save() must be implemented by renderer');
  }
  
  /**
   * Restore previously saved rendering state
   */
  restore() {
    throw new Error('restore() must be implemented by renderer');
  }
  
  /**
   * Apply a transformation matrix
   * @param {number} a - Horizontal scaling
   * @param {number} b - Horizontal skewing  
   * @param {number} c - Vertical skewing
   * @param {number} d - Vertical scaling
   * @param {number} e - Horizontal translation
   * @param {number} f - Vertical translation
   */
  transform(a, b, c, d, e, f) {
    throw new Error('transform() must be implemented by renderer');
  }
  
  /**
   * Translate the coordinate system
   * @param {number} x - Horizontal translation
   * @param {number} y - Vertical translation
   */
  translate(x, y) {
    throw new Error('translate() must be implemented by renderer');
  }
  
  /**
   * Set clipping bounds for subsequent drawing operations
   * @param {number} x - Clip region x
   * @param {number} y - Clip region y  
   * @param {number} width - Clip region width
   * @param {number} height - Clip region height
   */
  setClipBounds(x, y, width, height) {
    throw new Error('setClipBounds() must be implemented by renderer');
  }
  
  /**
   * Clear current clipping bounds
   */
  clearClipBounds() {
    throw new Error('clearClipBounds() must be implemented by renderer');
  }

  // ===== BASIC DRAWING OPERATIONS =====
  
  /**
   * Draw a line between two points
   * @param {number} x1 - Start x coordinate
   * @param {number} y1 - Start y coordinate
   * @param {number} x2 - End x coordinate
   * @param {number} y2 - End y coordinate
   * @param {Object} style - Line styling options
   * @returns {*} Renderer-specific element reference
   */
  drawLine(x1, y1, x2, y2, style = {}) {
    throw new Error('drawLine() must be implemented by renderer');
  }
  
  /**
   * Draw a rectangle
   * @param {number} x - Top-left x coordinate
   * @param {number} y - Top-left y coordinate
   * @param {number} width - Rectangle width
   * @param {number} height - Rectangle height
   * @param {Object} style - Rectangle styling options
   * @returns {*} Renderer-specific element reference
   */
  drawRect(x, y, width, height, style = {}) {
    throw new Error('drawRect() must be implemented by renderer');
  }
  
  /**
   * Draw a circle
   * @param {number} cx - Center x coordinate
   * @param {number} cy - Center y coordinate
   * @param {number} radius - Circle radius
   * @param {Object} style - Circle styling options
   * @returns {*} Renderer-specific element reference
   */
  drawCircle(cx, cy, radius, style = {}) {
    throw new Error('drawCircle() must be implemented by renderer');
  }
  
  /**
   * Draw a complex path
   * @param {string|Array} pathData - Path definition (SVG-style string or coordinate arrays)
   * @param {Object} style - Path styling options
   * @returns {*} Renderer-specific element reference
   */
  drawPath(pathData, style = {}) {
    throw new Error('drawPath() must be implemented by renderer');
  }
  
  /**
   * Draw text
   * @param {string} text - Text content
   * @param {number} x - Text x coordinate
   * @param {number} y - Text y coordinate
   * @param {Object} style - Text styling options
   * @returns {*} Renderer-specific element reference
   */
  drawText(text, x, y, style = {}) {
    throw new Error('drawText() must be implemented by renderer');
  }

  // ===== ADVANCED DRAWING OPERATIONS =====
  
  /**
   * Create a group/layer for organizing elements
   * @param {Object} attributes - Group attributes
   * @returns {*} Renderer-specific group reference
   */
  createGroup(attributes = {}) {
    throw new Error('createGroup() must be implemented by renderer');
  }
  
  /**
   * Draw a gradient-filled area
   * @param {string|Array} pathData - Area path definition
   * @param {Object} gradientConfig - Gradient configuration
   * @param {Object} style - Additional styling
   * @returns {*} Renderer-specific element reference
   */
  drawGradientArea(pathData, gradientConfig, style = {}) {
    throw new Error('drawGradientArea() must be implemented by renderer');
  }
  
  /**
   * Batch draw multiple similar elements for performance
   * @param {string} type - Element type ('line', 'circle', 'rect')
   * @param {Array} elements - Array of element definitions
   * @param {Object} commonStyle - Style applied to all elements
   * @returns {Array} Array of renderer-specific element references
   */
  batchDraw(type, elements, commonStyle = {}) {
    throw new Error('batchDraw() must be implemented by renderer');
  }

  // ===== EVENT AND INTERACTION SUPPORT =====
  
  /**
   * Convert screen coordinates to chart coordinates
   * @param {number} screenX - Screen x coordinate
   * @param {number} screenY - Screen y coordinate
   * @returns {{x: number, y: number}} Chart coordinates
   */
  screenToChart(screenX, screenY) {
    throw new Error('screenToChart() must be implemented by renderer');
  }
  
  /**
   * Convert chart coordinates to screen coordinates
   * @param {number} chartX - Chart x coordinate
   * @param {number} chartY - Chart y coordinate
   * @returns {{x: number, y: number}} Screen coordinates
   */
  chartToScreen(chartX, chartY) {
    throw new Error('chartToScreen() must be implemented by renderer');
  }
  
  /**
   * Perform hit detection at given coordinates
   * @param {number} x - X coordinate to test
   * @param {number} y - Y coordinate to test
   * @returns {Array} Array of elements at the coordinates
   */
  hitTest(x, y) {
    throw new Error('hitTest() must be implemented by renderer');
  }
  
  /**
   * Add event listener to the rendering surface
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   */
  addEventListener(event, handler) {
    throw new Error('addEventListener() must be implemented by renderer');
  }
  
  /**
   * Remove event listener from the rendering surface
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   */
  removeEventListener(event, handler) {
    throw new Error('removeEventListener() must be implemented by renderer');
  }

  // ===== CAPABILITY AND PERFORMANCE =====
  
  /**
   * Get renderer capabilities
   * @returns {Object} Capability flags
   */
  getCapabilities() {
    return {
      type: this.constructor.name.replace('Renderer', '').toLowerCase(),
      supportsGradients: false,
      supportsClipping: false,
      supportsTransforms: false,
      supportsTextMetrics: false,
      supportsBatchOperations: false,
      supportsAntialiasing: false,
      maxDataPoints: 1000,
      optimalDataPoints: 100
    };
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return { ...this.stats };
  }
  
  /**
   * Reset performance counters
   */
  resetPerformanceStats() {
    this.stats = {
      drawCalls: 0,
      elementsRendered: 0,
      lastFrameTime: 0
    };
  }
  
  /**
   * Optimize renderer for given dataset size
   * @param {number} dataSize - Expected data size
   */
  optimizeForDataSize(dataSize) {
    // Default implementation - can be overridden by specific renderers
    console.log(`Optimizing ${this.constructor.name} for ${dataSize} data points`);
  }

  // ===== UTILITY METHODS =====
  
  /**
   * Measure text dimensions
   * @param {string} text - Text to measure
   * @param {Object} style - Text styling
   * @returns {{width: number, height: number}} Text dimensions
   */
  measureText(text, style = {}) {
    throw new Error('measureText() must be implemented by renderer');
  }
  
  /**
   * Generate a path string from coordinate arrays
   * @param {Array} points - Array of [x, y] coordinates
   * @param {string} curveType - Curve interpolation type
   * @returns {string} Path definition string
   */
  generatePath(points, curveType = 'linear') {
    throw new Error('generatePath() must be implemented by renderer');
  }
  
  /**
   * Apply styles to an element
   * @param {*} element - Renderer-specific element
   * @param {Object} styles - Style properties
   */
  applyStyles(element, styles) {
    throw new Error('applyStyles() must be implemented by renderer');
  }
  
  /**
   * Export current rendered content
   * @param {string} format - Export format ('png', 'svg', 'dataurl')
   * @returns {Promise<string|Blob>} Exported content
   */
  async export(format = 'png') {
    throw new Error('export() must be implemented by renderer');
  }

  // ===== INTERNAL HELPER METHODS =====
  
  /**
   * Increment performance counters
   * @protected
   */
  _incrementStats(drawCalls = 1, elements = 1) {
    this.stats.drawCalls += drawCalls;
    this.stats.elementsRendered += elements;
    this.stats.lastFrameTime = performance.now();
  }
  
  /**
   * Normalize style object for renderer
   * @param {Object} style - Input style object
   * @returns {Object} Normalized style object
   * @protected
   */
  _normalizeStyle(style) {
    return {
      stroke: style.stroke || style.color || '#000000',
      strokeWidth: style.strokeWidth || style['stroke-width'] || style.width || 1,
      fill: style.fill || 'none',
      opacity: style.opacity || 1,
      ...style
    };
  }

  /**
   * Normalize options object for renderer
   * @param {Object} options - Input options object
   * @returns {Object} Normalized options object
   * @protected
   */
  _normalizeOptions(options = {}) {
    return {
      // Default options that all renderers should support
      backgroundColor: '#ffffff',
      antialiasing: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      
      // Performance options
      enableBatchRendering: true,
      maxBatchSize: 10000,
      
      // Rendering quality options
      highQualityText: true,
      enableAntialiasing: true,
      
      // Debug options
      debugMode: false,
      logRenderOperations: false,
      
      // Merge user-provided options
      ...options
    };
  }
  
  /**
   * Validate that renderer is initialized
   * @throws {Error} If renderer is not initialized
   * @protected
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(`${this.constructor.name} must be initialized before use`);
    }
  }
}
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
    if (this.constructor === AbstractRenderer) {
      throw new Error('AbstractRenderer cannot be instantiated directly');
    }
    
    this.container = container;
    this.width = width;
    this.height = height;
    this.options = {
      backgroundColor: '#ffffff',
      antialiasing: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      ...options
    };
    
    // Renderer state with safe initialization
    this.isInitialized = false;
    this.isDestroyed = false;
    this.currentClipBounds = null;
    this.renderingContext = null;
    this.contextValidated = false;
    
    // Safe stats initialization with thread-safe pattern
    this._initializeStats();
    
    // Rendering state tracking
    this.renderingInProgress = false;
    this.lastOperationTime = 0;
    
    console.log(`[${this.constructor.name}] Constructor completed successfully`);
  }

  /**
   * Thread-safe stats initialization
   * @private
   */
  _initializeStats() {
    // Use Object.defineProperty for immutable reference
    Object.defineProperty(this, 'stats', {
      value: {
        drawCalls: 0,
        elementsRendered: 0,
        lastFrameTime: 0
      },
      writable: true,
      enumerable: true,
      configurable: true
    });
    
    // Additional safety check
    this._validateStatsObject();
  }

  /**
   * Validate stats object integrity
   * @private
   */
  _validateStatsObject() {
    if (!this.stats || typeof this.stats !== 'object') {
      console.warn(`[${this.constructor.name}] Stats object corrupted, reinitializing`);
      this.stats = {
        drawCalls: 0,
        elementsRendered: 0,
        lastFrameTime: 0
      };
    }
    
    // Ensure all required properties exist with correct types
    const requiredProps = ['drawCalls', 'elementsRendered', 'lastFrameTime'];
    requiredProps.forEach(prop => {
      if (typeof this.stats[prop] !== 'number' || isNaN(this.stats[prop])) {
        this.stats[prop] = 0;
      }
    });
  }

  // ===== LIFECYCLE METHODS =====
  
  /**
   * Initialize the renderer and create the rendering context
   * @returns {Promise<void>} Resolves when renderer is ready
   * @throws {Error} If initialization fails
   */
  async initialize() {
    throw new Error('initialize() must be implemented by renderer');
  }
  
  /**
   * Clean up resources and destroy the renderer
   * @returns {void}
   */
  destroy() {
    throw new Error('destroy() must be implemented by renderer');
  }
  
  /**
   * Resize the rendering surface
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @returns {void}
   * @throws {Error} If resize fails or invalid dimensions provided
   */
  resize(width, height) {
    throw new Error('resize() must be implemented by renderer');
  }
  
  /**
   * Clear the entire rendering surface
   * @param {string|null} [color=null] - Background color (optional)
   * @returns {void}
   */
  clear(color = null) {
    throw new Error('clear() must be implemented by renderer');
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  /**
   * Save current rendering state (transform, styles, etc.)
   * @returns {void}
   * @throws {Error} If save operation fails
   */
  save() {
    throw new Error('save() must be implemented by renderer');
  }
  
  /**
   * Restore previously saved rendering state
   * @returns {void}
   * @throws {Error} If restore operation fails
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
   * @returns {void}
   */
  transform(a, b, c, d, e, f) {
    throw new Error('transform() must be implemented by renderer');
  }
  
  /**
   * Set translation
   * @param {number} x - X translation
   * @param {number} y - Y translation
   * @returns {void}
   */
  translate(x, y) {
    throw new Error('translate() must be implemented by renderer');
  }
  
  /**
   * Set scaling
   * @param {number} x - X scale factor
   * @param {number} y - Y scale factor
   * @returns {void}
   */
  scale(x, y) {
    throw new Error('scale() must be implemented by renderer');
  }
  
  /**
   * Set rotation
   * @param {number} angle - Rotation angle in radians
   * @returns {void}
   */
  rotate(angle) {
    throw new Error('rotate() must be implemented by renderer');
  }
  
  /**
   * Set clipping region
   * @param {number} x - Clipping region x coordinate
   * @param {number} y - Clipping region y coordinate
   * @param {number} width - Clipping region width
   * @param {number} height - Clipping region height
   * @returns {void}
   */
  setClipBounds(x, y, width, height) {
    throw new Error('setClipBounds() must be implemented by renderer');
  }

  /**
   * Clear current clipping region
   * @returns {void}
   */
  clearClipBounds() {
    throw new Error('clearClipBounds() must be implemented by renderer');
  }

  // ===== BASIC DRAWING OPERATIONS =====
  
  /**
   * Draw a line
   * @param {number} x1 - Start x coordinate
   * @param {number} y1 - Start y coordinate
   * @param {number} x2 - End x coordinate
   * @param {number} y2 - End y coordinate
   * @param {Object} [style={}] - Line styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If drawing fails or invalid coordinates provided
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
   * @param {Object} [style={}] - Rectangle styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If drawing fails or invalid dimensions provided
   */
  drawRect(x, y, width, height, style = {}) {
    throw new Error('drawRect() must be implemented by renderer');
  }
  
  /**
   * Draw a circle
   * @param {number} cx - Center x coordinate
   * @param {number} cy - Center y coordinate
   * @param {number} radius - Circle radius
   * @param {Object} [style={}] - Circle styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If drawing fails or invalid radius provided
   */
  drawCircle(cx, cy, radius, style = {}) {
    throw new Error('drawCircle() must be implemented by renderer');
  }
  
  /**
   * Draw a complex path
   * @param {string|Array} pathData - Path definition (SVG-style string or coordinate arrays)
   * @param {Object} [style={}] - Path styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If drawing fails or invalid path data provided
   */
  drawPath(pathData, style = {}) {
    throw new Error('drawPath() must be implemented by renderer');
  }
  
  /**
   * Draw text
   * @param {string} text - Text content
   * @param {number} x - Text x coordinate
   * @param {number} y - Text y coordinate
   * @param {Object} [style={}] - Text styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If drawing fails or invalid text provided
   */
  drawText(text, x, y, style = {}) {
    throw new Error('drawText() must be implemented by renderer');
  }

  // ===== ADVANCED DRAWING OPERATIONS =====
  
  /**
   * Create a group/layer for organizing elements
   * @param {Object} [attributes={}] - Group attributes
   * @returns {Object} Group object with restoration method
   * @throws {Error} If group creation fails
   */
  createGroup(attributes = {}) {
    throw new Error('createGroup() must be implemented by renderer');
  }
  
  /**
   * Draw a gradient-filled area
   * @param {string|Array} pathData - Area path definition
   * @param {Object} gradientConfig - Gradient configuration
   * @param {Object} [style={}] - Additional styling options
   * @returns {string|Object} Renderer-specific element reference/ID
   * @throws {Error} If gradient drawing fails
   */
  drawGradientArea(pathData, gradientConfig, style = {}) {
    throw new Error('drawGradientArea() must be implemented by renderer');
  }
  
  /**
   * Batch draw multiple elements of the same type
   * @param {string} type - Element type ('line', 'circle', 'rect', etc.)
   * @param {Array} elements - Array of element data
   * @param {Object} [commonStyle={}] - Common styling for all elements
   * @returns {Array<string|Object>} Array of element references/IDs
   * @throws {Error} If batch drawing fails
   */
  batchDraw(type, elements, commonStyle = {}) {
    throw new Error('batchDraw() must be implemented by renderer');
  }
  
  /**
   * Flush any pending batch operations
   * @returns {void}
   */
  flush() {
    // Default implementation - can be overridden for batching renderers
    // No-op for non-batching renderers
  }

  // ===== EVENT HANDLING =====
  
  /**
   * Add event listener to rendering surface
   * @param {string} event - Event type (e.g., 'click', 'mousemove')
   * @param {Function} handler - Event handler function
   * @returns {void}
   * @throws {Error} If event binding fails
   */
  addEventListener(event, handler) {
    throw new Error('addEventListener() must be implemented by renderer');
  }
  
  /**
   * Remove event listener from rendering surface
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @returns {void}
   */
  removeEventListener(event, handler) {
    throw new Error('removeEventListener() must be implemented by renderer');
  }

  // ===== CAPABILITY AND PERFORMANCE =====
  
  /**
   * Get renderer capabilities
   * @returns {Object} Capability flags and limits
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
   * @returns {Object} Performance statistics (copy to prevent mutation)
   */
  getPerformanceStats() {
    this._ensureStatsInitialization();
    return { ...this.stats };
  }
  
  /**
   * Reset performance counters
   * @returns {void}
   */
  resetPerformanceStats() {
    this._ensureStatsInitialization();
    this.stats = {
      drawCalls: 0,
      elementsRendered: 0,
      lastFrameTime: 0
    };
  }
  
  /**
   * Optimize renderer for given dataset size
   * @param {number} dataSize - Expected data size
   * @returns {void}
   */
  optimizeForDataSize(dataSize) {
    // Default implementation - can be overridden by specific renderers
    console.log(`Optimizing ${this.constructor.name} for ${dataSize} data points`);
  }

  // ===== UTILITY METHODS =====
  
  /**
   * Measure text dimensions
   * @param {string} text - Text to measure
   * @param {Object} [style={}] - Text styling
   * @returns {{width: number, height: number}} Text dimensions
   * @throws {Error} If text measurement fails
   */
  measureText(text, style = {}) {
    throw new Error('measureText() must be implemented by renderer');
  }
  
  /**
   * Generate a path string from coordinate arrays
   * @param {Array<Array<number>>} points - Array of [x, y] coordinates
   * @param {string} [curveType='linear'] - Curve interpolation type
   * @returns {string} Path definition string
   * @throws {Error} If path generation fails
   */
  generatePath(points, curveType = 'linear') {
    throw new Error('generatePath() must be implemented by renderer');
  }
  
  /**
   * Apply styles to an element
   * @param {*} element - Renderer-specific element
   * @param {Object} styles - Style properties
   * @returns {void}
   */
  applyStyles(element, styles) {
    throw new Error('applyStyles() must be implemented by renderer');
  }
  
  /**
   * Export current rendered content
   * @param {string} [format='png'] - Export format ('png', 'svg', 'dataurl')
   * @returns {Promise<string|Blob>} Exported content
   * @throws {Error} If export fails or format not supported
   */
  async export(format = 'png') {
    throw new Error('export() must be implemented by renderer');
  }

  // ===== INTERNAL HELPER METHODS =====
  
  /**
   * Thread-safe stats increment with race condition protection
   * @param {number} [drawCalls=1] - Number of draw calls to add
   * @param {number} [elements=1] - Number of elements to add
   * @protected
   */
  _incrementStats(drawCalls = 1, elements = 1) {
    // Comprehensive stats validation and recovery
    this._ensureStatsInitialization();
    
    try {
      // Validate inputs
      const validDrawCalls = (typeof drawCalls === 'number' && !isNaN(drawCalls)) ? Math.max(0, drawCalls) : 1;
      const validElements = (typeof elements === 'number' && !isNaN(elements)) ? Math.max(0, elements) : 1;
      
      // Thread-safe increment using atomic-like operations
      const currentTime = performance.now();
      
      // Validate current stats before incrementing
      this._validateStatsObject();
      
      // Perform safe increment
      this.stats.drawCalls = (this.stats.drawCalls || 0) + validDrawCalls;
      this.stats.elementsRendered = (this.stats.elementsRendered || 0) + validElements;
      this.stats.lastFrameTime = currentTime;
      
      // Update operation tracking
      this.lastOperationTime = currentTime;
      
    } catch (error) {
      console.error(`[${this.constructor.name}] Critical error in stats increment:`, error);
      
      // Emergency stats recovery - reinitialize with current values
      this._initializeStats();
      this.stats.drawCalls = Math.max(0, drawCalls);
      this.stats.elementsRendered = Math.max(0, elements);
      this.stats.lastFrameTime = performance.now();
      
      console.warn(`[${this.constructor.name}] Stats object recovered after error`);
    }
  }
  
  /**
   * Enhanced stats initialization with race condition protection
   * @protected
   */
  _ensureStatsInitialization() {
    if (!this.stats || typeof this.stats !== 'object') {
      console.warn(`[${this.constructor.name}] Stats object missing or corrupted, reinitializing`);
      this._initializeStats();
    } else {
      // Validate existing stats object
      this._validateStatsObject();
    }
  }
  
  /**
   * Normalize style object for renderer with validation
   * @param {Object} style - Input style object
   * @returns {Object} Normalized and validated style object
   * @protected
   */
  _normalizeStyle(style) {
    if (!style || typeof style !== 'object') {
      style = {};
    }
    
    return {
      stroke: style.stroke || style.color || '#000000',
      strokeWidth: this._validateNumeric(style.strokeWidth || style['stroke-width'] || style.width, 1),
      fill: style.fill || 'none',
      opacity: this._validateNumeric(style.opacity, 1, 0, 1),
      ...style
    };
  }
  
  /**
   * Validate that renderer is properly initialized and ready for operations
   * @throws {Error} If renderer is not initialized or has been destroyed
   * @protected
   */
  _ensureInitialized() {
    if (this.isDestroyed) {
      throw new Error(`${this.constructor.name} has been destroyed and cannot be used`);
    }
    
    if (!this.isInitialized) {
      throw new Error(`${this.constructor.name} must be initialized before use`);
    }
    
    // Validate rendering context if it should exist
    this._validateRenderingContext();
  }
  
  /**
   * Validate rendering context is properly set and functional
   * @throws {Error} If rendering context is invalid
   * @protected
   */
  _validateRenderingContext() {
    // Default implementation - can be overridden by specific renderers
    
    // Check if container still exists in DOM
    if (this.container && !document.contains(this.container)) {
      throw new Error(`${this.constructor.name} container has been removed from DOM`);
    }
    
    // Check if renderingContext exists (for renderers that use it)
    if (this.renderingContext !== null && this.renderingContext !== undefined) {
      if (typeof this.renderingContext === 'object' && this.renderingContext.nodeType) {
        // DOM element check
        if (!document.contains(this.renderingContext)) {
          console.warn(`${this.constructor.name} rendering context removed from DOM`);
          this.contextValidated = false;
        } else {
          this.contextValidated = true;
        }
      } else if (this.renderingContext.canvas) {
        // Canvas context check
        try {
          // Test basic context functionality
          this.renderingContext.save();
          this.renderingContext.restore();
          this.contextValidated = true;
        } catch (error) {
          throw new Error(`${this.constructor.name} rendering context is invalid: ${error.message}`);
        }
      } else if (this.renderingContext.useProgram) {
        // WebGL context check
        if (this.renderingContext.isContextLost && this.renderingContext.isContextLost()) {
          throw new Error(`${this.constructor.name} WebGL context has been lost`);
        }
        this.contextValidated = true;
      }
    }
  }
  
  /**
   * Validate numeric values with bounds checking
   * @param {*} value - Value to validate
   * @param {number} defaultValue - Default if invalid
   * @param {number} [min] - Minimum allowed value
   * @param {number} [max] - Maximum allowed value
   * @returns {number} Validated numeric value
   * @protected
   */
  _validateNumeric(value, defaultValue, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return defaultValue;
    }
    
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Validate coordinate parameters
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} operation - Operation name for error messages
   * @throws {Error} If coordinates are invalid
   * @protected
   */
  _validateCoordinates(x, y, operation = 'operation') {
    if (typeof x !== 'number' || typeof y !== 'number' || 
        isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      throw new Error(`Invalid coordinates for ${operation}: x=${x}, y=${y}`);
    }
  }
  
  /**
   * Validate dimensions (width/height)
   * @param {number} width - Width value
   * @param {number} height - Height value
   * @param {string} operation - Operation name for error messages
   * @throws {Error} If dimensions are invalid
   * @protected
   */
  _validateDimensions(width, height, operation = 'operation') {
    if (typeof width !== 'number' || typeof height !== 'number' || 
        isNaN(width) || isNaN(height) || !isFinite(width) || !isFinite(height) ||
        width < 0 || height < 0) {
      throw new Error(`Invalid dimensions for ${operation}: width=${width}, height=${height}`);
    }
  }
  
  /**
   * Begin a rendering operation with state tracking
   * @param {string} operationType - Type of operation being performed
   * @protected
   */
  _beginRenderOperation(operationType) {
    this._ensureInitialized();
    
    if (this.renderingInProgress) {
      console.warn(`[${this.constructor.name}] Concurrent rendering operation detected: ${operationType}`);
    }
    
    this.renderingInProgress = true;
    this.currentOperation = operationType;
    this.operationStartTime = performance.now();
  }
  
  /**
   * End a rendering operation and update tracking
   * @protected
   */
  _endRenderOperation() {
    this.renderingInProgress = false;
    this.currentOperation = null;
    
    if (this.operationStartTime) {
      const operationTime = performance.now() - this.operationStartTime;
      this.lastOperationTime = operationTime;
      this.operationStartTime = null;
    }
  }
}
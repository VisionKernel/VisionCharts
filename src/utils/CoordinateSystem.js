/**
 * CoordinateSystem - Multi-Renderer Coordinate Normalization
 * 
 * Provides unified coordinate transformation and normalization across
 * SVG, Canvas, and WebGL rendering backends, ensuring consistent
 * positioning, scaling, and event handling.
 * 
 * Key Features:
 * - Cross-renderer coordinate transformation
 * - High DPI scaling support
 * - Event coordinate normalization
 * - Viewport and clipping management
 * - Bounds checking and validation
 * - Chart margin and padding handling
 */
export default class CoordinateSystem {
  constructor(options = {}) {
    this.options = {
      // Default dimensions
      width: 800,
      height: 600,
      
      // High DPI support
      devicePixelRatio: window.devicePixelRatio || 1,
      enableHighDPI: true,
      
      // Margins and padding
      margins: {
        top: 60,
        right: 60,
        bottom: 80,
        left: 80
      },
      
      // Coordinate system preferences
      originPosition: 'top-left', // 'top-left', 'bottom-left', 'center'
      flipY: false, // Whether to flip Y coordinate (useful for math coords)
      
      // Bounds checking
      enableBoundsChecking: true,
      clampCoordinates: true,
      
      // Performance
      enableCoordinateCaching: true,
      cacheSize: 1000,
      
      // Event handling
      enableEventCoordinateTransform: true,
      eventCoordinatePrecision: 2, // decimal places
      
      ...options
    };
    
    // Coordinate system state
    this.dimensions = {
      width: this.options.width,
      height: this.options.height,
      innerWidth: 0,
      innerHeight: 0,
      margins: { ...this.options.margins }
    };
    
    // Scaling factors
    this.scaling = {
      devicePixelRatio: this.options.devicePixelRatio,
      scaledWidth: 0,
      scaledHeight: 0,
      scaleX: 1,
      scaleY: 1
    };
    
    // Coordinate spaces
    this.coordinateSpaces = {
      container: { x: 0, y: 0, width: 0, height: 0 },
      chart: { x: 0, y: 0, width: 0, height: 0 },
      data: { x: 0, y: 0, width: 0, height: 0 },
      normalized: { x: 0, y: 0, width: 1, height: 1 }
    };
    
    // Transformation matrices for different renderers
    this.transformMatrices = {
      svg: null,
      canvas: null,
      webgl: null
    };
    
    // Viewport and clipping
    this.viewport = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
    
    this.clippingRegion = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
    
    // Coordinate cache for performance
    this.coordinateCache = new Map();
    this.cacheKeys = new Set();
    
    // Event coordinate tracking
    this.lastEventCoordinates = {
      container: { x: 0, y: 0 },
      chart: { x: 0, y: 0 },
      data: { x: 0, y: 0 },
      normalized: { x: 0, y: 0 }
    };
    
    // Performance metrics
    this.metrics = {
      transformations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      boundsChecks: 0,
      averageTransformTime: 0
    };
    
    // Initialize coordinate spaces
    this._updateCoordinateSpaces();
    
    console.log('CoordinateSystem initialized with multi-renderer support');
  }

  // ===== COORDINATE SPACE MANAGEMENT =====

  /**
   * Update dimensions and recalculate coordinate spaces
   * @param {number} width - Container width
   * @param {number} height - Container height
   * @param {Object} margins - Chart margins
   */
  updateDimensions(width, height, margins = null) {
    console.log(`CoordinateSystem.updateDimensions: ${width}x${height}`);
    
    // Update dimensions
    this.dimensions.width = width;
    this.dimensions.height = height;
    
    if (margins) {
      this.dimensions.margins = { ...margins };
    }
    
    // Calculate inner dimensions
    this.dimensions.innerWidth = width - this.dimensions.margins.left - this.dimensions.margins.right;
    this.dimensions.innerHeight = height - this.dimensions.margins.top - this.dimensions.margins.bottom;
    
    // Update scaling
    this._updateScaling();
    
    // Update coordinate spaces
    this._updateCoordinateSpaces();
    
    // Update transformation matrices
    this._updateTransformationMatrices();
    
    // Clear coordinate cache
    this._clearCoordinateCache();
    
    console.log(`Updated coordinate spaces: chart=${this.dimensions.innerWidth}x${this.dimensions.innerHeight}`);
  }

  /**
   * Update coordinate spaces based on current dimensions
   * @private
   */
  _updateCoordinateSpaces() {
    const { width, height, innerWidth, innerHeight, margins } = this.dimensions;
    
    // Container space (full element)
    this.coordinateSpaces.container = {
      x: 0,
      y: 0,
      width,
      height
    };
    
    // Chart space (minus margins)
    this.coordinateSpaces.chart = {
      x: margins.left,
      y: margins.top,
      width: innerWidth,
      height: innerHeight
    };
    
    // Data space (for plotting data points)
    this.coordinateSpaces.data = {
      x: margins.left,
      y: margins.top,
      width: innerWidth,
      height: innerHeight
    };
    
    // Normalized space (0-1 range)
    this.coordinateSpaces.normalized = {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };
    
    // Update viewport
    this.viewport = {
      x: margins.left,
      y: margins.top,
      width: innerWidth,
      height: innerHeight
    };
    
    // Update clipping region
    this.clippingRegion = { ...this.viewport };
  }

  /**
   * Update scaling factors for high DPI
   * @private
   */
  _updateScaling() {
    const dpr = this.options.enableHighDPI ? this.options.devicePixelRatio : 1;
    
    this.scaling.devicePixelRatio = dpr;
    this.scaling.scaledWidth = this.dimensions.width * dpr;
    this.scaling.scaledHeight = this.dimensions.height * dpr;
    this.scaling.scaleX = dpr;
    this.scaling.scaleY = dpr;
  }

  /**
   * Update transformation matrices for different renderers
   * @private
   */
  _updateTransformationMatrices() {
    const { width, height } = this.dimensions;
    const { scaleX, scaleY } = this.scaling;
    
    // SVG transformation (top-left origin, no flipping needed)
    this.transformMatrices.svg = {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0
    };
    
    // Canvas transformation (top-left origin, high DPI scaling)
    this.transformMatrices.canvas = {
      translateX: 0,
      translateY: 0,
      scaleX,
      scaleY,
      originX: 0,
      originY: 0
    };
    
    // WebGL transformation (center origin, normalized device coordinates)
    this.transformMatrices.webgl = {
      translateX: -1.0, // NDC space is -1 to 1
      translateY: 1.0,   // Flip Y for NDC
      scaleX: 2.0 / width,
      scaleY: -2.0 / height, // Negative to flip Y
      originX: width / 2,
      originY: height / 2
    };
  }

  // ===== COORDINATE TRANSFORMATION METHODS =====

  /**
   * Transform coordinates between coordinate spaces
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} fromSpace - Source coordinate space
   * @param {string} toSpace - Target coordinate space
   * @param {string} rendererType - Target renderer type
   * @returns {Object} Transformed coordinates {x, y}
   */
  transform(x, y, fromSpace, toSpace, rendererType = 'svg') {
    const startTime = performance.now();
    
    // Generate cache key
    const cacheKey = `${x},${y},${fromSpace},${toSpace},${rendererType}`;
    
    // Check cache
    if (this.options.enableCoordinateCaching && this.coordinateCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.coordinateCache.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    try {
      // Convert to normalized coordinates first
      const normalized = this._toNormalized(x, y, fromSpace);
      
      // Convert from normalized to target space
      const result = this._fromNormalized(normalized.x, normalized.y, toSpace, rendererType);
      
      // Apply renderer-specific transformations
      const finalResult = this._applyRendererTransform(result.x, result.y, rendererType);
      
      // Cache result
      this._cacheCoordinate(cacheKey, finalResult);
      
      // Update metrics
      const transformTime = performance.now() - startTime;
      this._updateTransformMetrics(transformTime);
      
      return finalResult;
      
    } catch (error) {
      console.error('Coordinate transformation failed:', error);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Transform container coordinates to chart coordinates
   * @param {number} x - Container X coordinate
   * @param {number} y - Container Y coordinate
   * @returns {Object} Chart coordinates {x, y}
   */
  containerToChart(x, y) {
    return this.transform(x, y, 'container', 'chart');
  }

  /**
   * Transform chart coordinates to container coordinates
   * @param {number} x - Chart X coordinate
   * @param {number} y - Chart Y coordinate
   * @returns {Object} Container coordinates {x, y}
   */
  chartToContainer(x, y) {
    return this.transform(x, y, 'chart', 'container');
  }

  /**
   * Transform data coordinates to screen coordinates
   * @param {number} x - Data X coordinate
   * @param {number} y - Data Y coordinate
   * @param {string} rendererType - Target renderer type
   * @returns {Object} Screen coordinates {x, y}
   */
  dataToScreen(x, y, rendererType = 'svg') {
    return this.transform(x, y, 'data', 'chart', rendererType);
  }

  /**
   * Transform screen coordinates to data coordinates
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {string} rendererType - Source renderer type
   * @returns {Object} Data coordinates {x, y}
   */
  screenToData(x, y, rendererType = 'svg') {
    return this.transform(x, y, 'chart', 'data', rendererType);
  }

  /**
   * Transform coordinates to normalized space (0-1 range)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} fromSpace - Source coordinate space
   * @returns {Object} Normalized coordinates {x, y}
   */
  toNormalized(x, y, fromSpace = 'chart') {
    return this._toNormalized(x, y, fromSpace);
  }

  /**
   * Transform from normalized coordinates to target space
   * @param {number} x - Normalized X coordinate (0-1)
   * @param {number} y - Normalized Y coordinate (0-1)
   * @param {string} toSpace - Target coordinate space
   * @param {string} rendererType - Target renderer type
   * @returns {Object} Target coordinates {x, y}
   */
  fromNormalized(x, y, toSpace = 'chart', rendererType = 'svg') {
    return this._fromNormalized(x, y, toSpace, rendererType);
  }

  // ===== EVENT COORDINATE HANDLING =====

  /**
   * Transform event coordinates to chart coordinates
   * @param {MouseEvent|PointerEvent} event - DOM event
   * @param {HTMLElement} element - Target element
   * @returns {Object} Comprehensive coordinate information
   */
  transformEventCoordinates(event, element) {
    if (!this.options.enableEventCoordinateTransform) {
      return null;
    }
    
    // Get element bounds
    const rect = element.getBoundingClientRect();
    
    // Calculate container coordinates
    const containerX = event.clientX - rect.left;
    const containerY = event.clientY - rect.top;
    
    // Transform to different coordinate spaces
    const chartCoords = this.containerToChart(containerX, containerY);
    const normalizedCoords = this.toNormalized(chartCoords.x, chartCoords.y, 'chart');
    
    // Check if coordinates are within bounds
    const inContainer = this.isInBounds(containerX, containerY, 'container');
    const inChart = this.isInBounds(chartCoords.x, chartCoords.y, 'chart');
    
    // Create comprehensive coordinate object
    const coordinates = {
      // Original event coordinates
      clientX: event.clientX,
      clientY: event.clientY,
      
      // Container space coordinates
      containerX: this._roundCoordinate(containerX),
      containerY: this._roundCoordinate(containerY),
      
      // Chart space coordinates
      chartX: this._roundCoordinate(chartCoords.x),
      chartY: this._roundCoordinate(chartCoords.y),
      
      // Normalized coordinates
      normalizedX: this._roundCoordinate(normalizedCoords.x),
      normalizedY: this._roundCoordinate(normalizedCoords.y),
      
      // Bounds checking
      inContainer,
      inChart,
      inChartArea: inChart, // Alias for compatibility
      
      // Element information
      elementBounds: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      
      // Coordinate spaces for reference
      spaces: {
        container: this.coordinateSpaces.container,
        chart: this.coordinateSpaces.chart
      }
    };
    
    // Store for reference
    this.lastEventCoordinates = {
      container: { x: containerX, y: containerY },
      chart: { x: chartCoords.x, y: chartCoords.y },
      normalized: { x: normalizedCoords.x, y: normalizedCoords.y }
    };
    
    return coordinates;
  }

  /**
   * Get last transformed event coordinates
   * @returns {Object} Last event coordinates
   */
  getLastEventCoordinates() {
    return { ...this.lastEventCoordinates };
  }

  // ===== BOUNDS CHECKING AND VALIDATION =====

  /**
   * Check if coordinates are within bounds of a coordinate space
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} space - Coordinate space to check
   * @returns {boolean} Whether coordinates are within bounds
   */
  isInBounds(x, y, space = 'chart') {
    if (!this.options.enableBoundsChecking) return true;
    
    this.metrics.boundsChecks++;
    
    const bounds = this.coordinateSpaces[space];
    if (!bounds) {
      console.warn(`Unknown coordinate space: ${space}`);
      return false;
    }
    
    return x >= bounds.x && 
           x <= bounds.x + bounds.width && 
           y >= bounds.y && 
           y <= bounds.y + bounds.height;
  }

  /**
   * Clamp coordinates to bounds of a coordinate space
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} space - Coordinate space to clamp to
   * @returns {Object} Clamped coordinates {x, y}
   */
  clampToBounds(x, y, space = 'chart') {
    if (!this.options.clampCoordinates) {
      return { x, y };
    }
    
    const bounds = this.coordinateSpaces[space];
    if (!bounds) {
      return { x, y };
    }
    
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, x)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, y))
    };
  }

  /**
   * Validate coordinate values
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} Whether coordinates are valid
   */
  validateCoordinates(x, y) {
    return typeof x === 'number' && 
           typeof y === 'number' && 
           !isNaN(x) && 
           !isNaN(y) && 
           isFinite(x) && 
           isFinite(y);
  }

  // ===== RENDERER-SPECIFIC UTILITIES =====

  /**
   * Get renderer-specific coordinate transformation function
   * @param {string} rendererType - Renderer type
   * @returns {Function} Transformation function
   */
  getRendererTransform(rendererType) {
    switch (rendererType) {
      case 'svg':
        return this._createSVGTransform();
      case 'canvas':
        return this._createCanvasTransform();
      case 'webgl':
        return this._createWebGLTransform();
      default:
        return (x, y) => ({ x, y });
    }
  }

  /**
   * Create SVG transformation function
   * @private
   */
  _createSVGTransform() {
    return (x, y) => ({
      x,
      y
    });
  }

  /**
   * Create Canvas transformation function
   * @private
   */
  _createCanvasTransform() {
    const { scaleX, scaleY } = this.scaling;
    
    return (x, y) => ({
      x: x / scaleX,
      y: y / scaleY
    });
  }

  /**
   * Create WebGL transformation function
   * @private
   */
  _createWebGLTransform() {
    const { width, height } = this.dimensions;
    
    return (x, y) => ({
      x: (x / width) * 2.0 - 1.0,  // Convert to NDC (-1 to 1)
      y: -((y / height) * 2.0 - 1.0) // Convert and flip Y
    });
  }

  /**
   * Get clipping region for renderer
   * @param {string} rendererType - Renderer type
   * @returns {Object} Clipping region {x, y, width, height}
   */
  getClippingRegion(rendererType = 'svg') {
    switch (rendererType) {
      case 'svg':
        return {
          x: this.clippingRegion.x,
          y: this.clippingRegion.y,
          width: this.clippingRegion.width,
          height: this.clippingRegion.height
        };
        
      case 'canvas':
        const { scaleX, scaleY } = this.scaling;
        return {
          x: this.clippingRegion.x / scaleX,
          y: this.clippingRegion.y / scaleY,
          width: this.clippingRegion.width / scaleX,
          height: this.clippingRegion.height / scaleY
        };
        
      case 'webgl':
        const { width, height } = this.dimensions;
        const x = (this.clippingRegion.x / width) * 2.0 - 1.0;
        const y = -((this.clippingRegion.y / height) * 2.0 - 1.0);
        const w = (this.clippingRegion.width / width) * 2.0;
        const h = (this.clippingRegion.height / height) * 2.0;
        
        return { x, y, width: w, height: h };
        
      default:
        return { ...this.clippingRegion };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Convert coordinates to normalized space
   * @private
   */
  _toNormalized(x, y, fromSpace) {
    const space = this.coordinateSpaces[fromSpace];
    if (!space) {
      throw new Error(`Unknown coordinate space: ${fromSpace}`);
    }
    
    return {
      x: (x - space.x) / space.width,
      y: (y - space.y) / space.height
    };
  }

  /**
   * Convert from normalized coordinates to target space
   * @private
   */
  _fromNormalized(x, y, toSpace, rendererType) {
    const space = this.coordinateSpaces[toSpace];
    if (!space) {
      throw new Error(`Unknown coordinate space: ${toSpace}`);
    }
    
    return {
      x: space.x + (x * space.width),
      y: space.y + (y * space.height)
    };
  }

  /**
   * Apply renderer-specific transformations
   * @private
   */
  _applyRendererTransform(x, y, rendererType) {
    const matrix = this.transformMatrices[rendererType];
    if (!matrix) {
      return { x, y };
    }
    
    // Apply transformation based on renderer type
    switch (rendererType) {
      case 'svg':
        return { x, y }; // SVG coordinates are already correct
        
      case 'canvas':
        return {
          x: x * matrix.scaleX,
          y: y * matrix.scaleY
        };
        
      case 'webgl':
        return {
          x: ((x - matrix.originX) * matrix.scaleX) + matrix.translateX,
          y: ((y - matrix.originY) * matrix.scaleY) + matrix.translateY
        };
        
      default:
        return { x, y };
    }
  }

  /**
   * Round coordinate to specified precision
   * @private
   */
  _roundCoordinate(value) {
    const precision = this.options.eventCoordinatePrecision;
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  /**
   * Cache coordinate transformation result
   * @private
   */
  _cacheCoordinate(key, result) {
    if (!this.options.enableCoordinateCaching) return;
    
    // Implement LRU cache
    if (this.coordinateCache.size >= this.options.cacheSize) {
      const firstKey = this.cacheKeys.values().next().value;
      this.coordinateCache.delete(firstKey);
      this.cacheKeys.delete(firstKey);
    }
    
    this.coordinateCache.set(key, result);
    this.cacheKeys.add(key);
  }

  /**
   * Clear coordinate cache
   * @private
   */
  _clearCoordinateCache() {
    this.coordinateCache.clear();
    this.cacheKeys.clear();
  }

  /**
   * Update transformation metrics
   * @private
   */
  _updateTransformMetrics(transformTime) {
    this.metrics.transformations++;
    
    // Calculate rolling average
    const count = this.metrics.transformations;
    const currentAvg = this.metrics.averageTransformTime;
    this.metrics.averageTransformTime = 
      (currentAvg * (count - 1) + transformTime) / count;
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get current dimensions
   * @returns {Object} Current dimensions
   */
  getDimensions() {
    return { ...this.dimensions };
  }

  /**
   * Get coordinate spaces
   * @returns {Object} All coordinate spaces
   */
  getCoordinateSpaces() {
    return { ...this.coordinateSpaces };
  }

  /**
   * Get scaling information
   * @returns {Object} Current scaling factors
   */
  getScaling() {
    return { ...this.scaling };
  }

  /**
   * Get viewport information
   * @returns {Object} Current viewport
   */
  getViewport() {
    return { ...this.viewport };
  }

  /**
   * Get transformation matrices
   * @returns {Object} All transformation matrices
   */
  getTransformationMatrices() {
    return { ...this.transformMatrices };
  }

  /**
   * Get coordinate system metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset coordinate system
   */
  reset() {
    this._clearCoordinateCache();
    this.metrics = {
      transformations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      boundsChecks: 0,
      averageTransformTime: 0
    };
    
    console.log('CoordinateSystem reset');
  }

  /**
   * Destroy coordinate system and cleanup
   */
  destroy() {
    this._clearCoordinateCache();
    this.transformMatrices = {};
    console.log('CoordinateSystem destroyed');
  }
}
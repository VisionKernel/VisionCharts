/**
 * CoordinateSystem - Multi-Renderer Coordinate Normalization (Updated)
 * 
 * Provides unified coordinate transformation and normalization across
 * SVG, Canvas, and WebGL rendering backends, ensuring consistent
 * positioning, scaling, and event handling.
 * 
 * Key Features:
 * - RENDERER-AGNOSTIC coordinate transformation for all renderers
 * - Unified coordinate system (mathematical: Y-up, origin bottom-left)
 * - Automatic renderer-specific coordinate conversion
 * - High DPI and device pixel ratio support
 * - Event coordinate normalization
 * - Batch coordinate processing for performance
 */

export class CoordinateSystem {
  constructor(config = {}) {
    this.config = {
      // NEW: Target renderer for coordinate system optimization
      targetRenderer: config.targetRenderer || 'auto', // 'canvas', 'webgl', 'auto'
      
      // Coordinate system settings (now renderer-agnostic)
      coordinateOrigin: 'bottom-left', // Always bottom-left for mathematical consistency
      useUnifiedCoordinates: true, // NEW: Use unified coordinate system
      
      // High DPI settings
      devicePixelRatio: window.devicePixelRatio || 1,
      enableHighDPI: true,
      
      // Viewport settings
      viewport: {
        x: 0,
        y: 0,
        width: 800,
        height: 600
      },
      
      // Chart area (within viewport)
      chartArea: {
        x: 80,
        y: 40,
        width: 660,
        height: 520
      },
      
      // Performance settings
      batchSize: 1000,
      enableCaching: true,
      
      // Transformation settings
      enableClipping: true,
      enableTransforms: true,
      
      ...config
    };
    
    // Internal state
    this.scales = { x: null, y: null };
    this.transforms = {
      scale: { x: 1, y: 1 },
      translate: { x: 0, y: 0 },
      rotate: 0
    };
    
    // Cache for coordinate transformations
    this.coordinateCache = new Map();
    this.transformedDatasets = new Map();
    
    // NEW: Renderer-specific coordinate systems
    this.rendererCoordinateSystems = {
      canvas: {
        origin: 'top-left',
        yDirection: 'down',
        requiresFlip: true
      },
      webgl: {
        origin: 'bottom-left', 
        yDirection: 'up',
        requiresFlip: false
      },
      svg: {
        origin: 'top-left',
        yDirection: 'down', 
        requiresFlip: true
      }
    };
    
    // Performance monitoring
    this.transformStats = {
      totalTransformations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageTransformTime: 0
    };
  }
  
  /**
   * Set scales for coordinate transformation
   * @param {Object} scales - { x: Scale, y: Scale }
   */
  setScales(scales) {
    this.scales = scales;
    
    // NEW: Configure scales for unified coordinate system
    if (this.config.useUnifiedCoordinates) {
      this._configureScalesForUnifiedCoordinates();
    }
    
    this._clearCache();
    return this;
  }
  
  /**
   * NEW: Configure scales for unified coordinate system
   * @private
   */
  _configureScalesForUnifiedCoordinates() {
    if (this.scales.x) {
      this.scales.x.setCoordinateSystem('normalized', 'horizontal');
    }
    if (this.scales.y) {
      this.scales.y.setCoordinateSystem('normalized', 'vertical');
    }
  }
  
  /**
   * NEW: Set target renderer for coordinate optimization
   * @param {string} renderer - 'canvas', 'webgl', or 'auto'
   */
  setTargetRenderer(renderer) {
    this.config.targetRenderer = renderer;
    this._clearCache(); // Clear cache since coordinate transformations may change
    return this;
  }
  
  /**
   * Update viewport dimensions
   * @param {Object} viewport - { x, y, width, height }
   */
  setViewport(viewport) {
    this.config.viewport = { ...this.config.viewport, ...viewport };
    this._clearCache();
    return this;
  }
  
  /**
   * Update chart area within viewport
   * @param {Object} chartArea - { x, y, width, height }
   */
  setChartArea(chartArea) {
    this.config.chartArea = { ...this.config.chartArea, ...chartArea };
    this._clearCache();
    return this;
  }
  
  /**
   * Transform datasets from data coordinates to UNIFIED pixel coordinates
   * @param {Array} datasets - Array of datasets to transform
   * @param {Object} options - Transformation options
   * @returns {Array} Datasets with UNIFIED pixel coordinates
   */
  async transformDatasets(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }
    
    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales must be set before transforming coordinates');
    }
    
    const startTime = performance.now();
    const transformedDatasets = [];
    
    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        console.log(`CoordinateSystem: Transforming dataset ${i + 1}/${datasets.length}: ${dataset.name || dataset.id || 'Unknown'}`);
        
        const transformedDataset = await this.transformDataset(dataset, options);
        transformedDatasets.push(transformedDataset);
      }
      
      const transformTime = performance.now() - startTime;
      this._updateTransformStats(transformTime, datasets.length);
      
      console.log(`CoordinateSystem: Transformed ${transformedDatasets.length} datasets to UNIFIED coordinates in ${transformTime.toFixed(2)}ms`);
      return transformedDatasets;
      
    } catch (error) {
      console.error('Error transforming datasets:', error);
      throw error;
    }
  }
  
  /**
   * Transform a single dataset to UNIFIED coordinate system
   * @param {Object} dataset - Dataset to transform
   * @param {Object} options - Transformation options
   * @returns {Object} Dataset with UNIFIED pixel coordinates
   */
  async transformDataset(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }
    
    const cacheKey = this._generateCacheKey(dataset, options);
    
    // Check cache first
    if (this.config.enableCaching && this.coordinateCache.has(cacheKey)) {
      this.transformStats.cacheHits++;
      return this.coordinateCache.get(cacheKey);
    }
    
    this.transformStats.cacheMisses++;
    
    try {
      // Transform data points to UNIFIED coordinate system
      const transformedData = await this._transformDataPoints(dataset.data, options);
      
      // Create transformed dataset
      const transformedDataset = {
        ...dataset,
        data: transformedData,
        coordinatesTransformed: true,
        coordinateSystem: 'unified',
        transformedAt: Date.now(),
        originalDataCount: dataset.data.length,
        transformedDataCount: transformedData.length
      };
      
      // Cache if enabled
      if (this.config.enableCaching) {
        this.coordinateCache.set(cacheKey, transformedDataset);
      }
      
      console.log(`Dataset transformed to UNIFIED coordinates: ${dataset.data.length} → ${transformedData.length} points`);
      
      return transformedDataset;
      
    } catch (error) {
      console.error('Error transforming dataset:', error);
      throw error;
    }
  }
  
  /**
   * Transform data points to UNIFIED pixel coordinates
   * @private
   */
  async _transformDataPoints(data, options) {
    const transformedData = [];
    let processedCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      
      try {
        // Extract data coordinates
        const dataCoords = this._extractDataCoordinates(point);
        
        if (dataCoords.x == null || dataCoords.y == null) {
          if (options.strictValidation) {
            throw new Error(`Missing coordinates at point ${i}`);
          }
          console.warn(`Skipping point ${i} due to missing coordinates`);
          continue;
        }
        
        // Transform to UNIFIED pixel coordinates
        const unifiedCoords = this.dataToUnified(dataCoords.x, dataCoords.y);
        
        if (unifiedCoords.x == null || unifiedCoords.y == null) {
          if (options.strictValidation) {
            throw new Error(`Invalid unified coordinates at point ${i}`);
          }
          console.warn(`Skipping point ${i} due to invalid unified coordinates`);
          continue;
        }
        
        // Create transformed point with UNIFIED coordinates
        const transformedPoint = {
          ...point,
          // Original data coordinates
          dataX: dataCoords.x,
          dataY: dataCoords.y,
          
          // UNIFIED pixel coordinates (mathematical coordinate system)
          // These are renderer-agnostic and always use bottom-left origin, Y-up
          unifiedX: unifiedCoords.x,
          unifiedY: unifiedCoords.y,
          
          // Aliases for backward compatibility and renderer use
          screenX: unifiedCoords.x,
          screenY: unifiedCoords.y,
          pixelX: unifiedCoords.x,
          pixelY: unifiedCoords.y,
          
          // Clipping information
          inBounds: this._isPointInBounds(unifiedCoords.x, unifiedCoords.y),
          
          // Coordinate system metadata
          coordinateSystem: 'unified',
          
          // High DPI coordinates if needed
          ...(this.config.enableHighDPI && this.config.devicePixelRatio > 1 ? {
            hiDPIX: unifiedCoords.x * this.config.devicePixelRatio,
            hiDPIY: unifiedCoords.y * this.config.devicePixelRatio
          } : {})
        };
        
        transformedData.push(transformedPoint);
        processedCount++;
        
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        console.warn(`Error transforming point ${i}:`, error.message);
      }
      
      // Yield control periodically for large datasets
      if (i % this.config.batchSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return transformedData;
  }
  
  /**
   * Extract data coordinates from point
   * @private
   */
  _extractDataCoordinates(point) {
    // Handle different coordinate field names
    const x = point.x || point.date || point.time || point.timestamp;
    const y = point.y || point.value || point.price || point.close;
    
    // Convert Date objects to timestamps
    let normalizedX = x;
    if (x instanceof Date) {
      normalizedX = x.getTime();
    } else if (typeof x === 'string') {
      // Try to parse as date if it looks like one
      const parsed = new Date(x);
      if (!isNaN(parsed.getTime())) {
        normalizedX = parsed.getTime();
      } else {
        normalizedX = parseFloat(x);
      }
    }
    
    // Ensure Y is numeric
    let normalizedY = y;
    if (typeof y === 'string') {
      normalizedY = parseFloat(y);
    }
    
    return {
      x: normalizedX,
      y: normalizedY
    };
  }
  
  /**
   * Transform data coordinates to UNIFIED pixel coordinates
   * @param {number} dataX - Data X coordinate
   * @param {number} dataY - Data Y coordinate
   * @returns {Object} { x: unifiedX, y: unifiedY }
   */
  dataToUnified(dataX, dataY) {
    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales not available for coordinate transformation');
    }
    
    try {
      // Use scales to transform data to UNIFIED pixel coordinates
      // Scales are now configured for unified coordinate system
      let unifiedX = this.scales.x.scale(dataX);
      let unifiedY = this.scales.y.scale(dataY);
      
      // Handle invalid transformations
      if (!isFinite(unifiedX) || !isFinite(unifiedY)) {
        return { x: null, y: null };
      }
      
      // Apply any additional coordinate system transformations
      const transformedCoords = this._applyUnifiedCoordinateTransforms(unifiedX, unifiedY);
      
      return {
        x: transformedCoords.x,
        y: transformedCoords.y
      };
      
    } catch (error) {
      console.error('Error in dataToUnified transformation:', error);
      return { x: null, y: null };
    }
  }
  
  /**
   * NEW: Convert UNIFIED coordinates to renderer-specific coordinates
   * @param {number} unifiedX - Unified X coordinate
   * @param {number} unifiedY - Unified Y coordinate  
   * @param {string} targetRenderer - Target renderer ('canvas', 'webgl', 'svg')
   * @returns {Object} { x: rendererX, y: rendererY }
   */
  unifiedToRenderer(unifiedX, unifiedY, targetRenderer) {
    const rendererSystem = this.rendererCoordinateSystems[targetRenderer];
    
    if (!rendererSystem) {
      console.warn(`Unknown renderer: ${targetRenderer}, using unified coordinates`);
      return { x: unifiedX, y: unifiedY };
    }
    
    let rendererX = unifiedX;
    let rendererY = unifiedY;
    
    // Handle Y-axis flipping for top-down coordinate systems (Canvas, SVG)
    if (rendererSystem.requiresFlip) {
      // Convert from bottom-up (unified) to top-down (canvas/svg)
      const chartArea = this.config.chartArea;
      const chartHeight = chartArea.height;
      const chartTop = chartArea.y;
      
      // Flip Y coordinate: unified Y=0 (bottom) becomes renderer Y=chartHeight (bottom in canvas)
      rendererY = chartTop + chartHeight - (unifiedY - chartTop);
    }
    
    return {
      x: rendererX,
      y: rendererY,
      coordinateSystem: targetRenderer
    };
  }
  
  /**
   * NEW: Convert renderer-specific coordinates to UNIFIED coordinates
   * @param {number} rendererX - Renderer-specific X coordinate
   * @param {number} rendererY - Renderer-specific Y coordinate
   * @param {string} sourceRenderer - Source renderer ('canvas', 'webgl', 'svg')
   * @returns {Object} { x: unifiedX, y: unifiedY }
   */
  rendererToUnified(rendererX, rendererY, sourceRenderer) {
    const rendererSystem = this.rendererCoordinateSystems[sourceRenderer];
    
    if (!rendererSystem) {
      console.warn(`Unknown renderer: ${sourceRenderer}, using coordinates as-is`);
      return { x: rendererX, y: rendererY };
    }
    
    let unifiedX = rendererX;
    let unifiedY = rendererY;
    
    // Handle Y-axis flipping for top-down coordinate systems (Canvas, SVG)
    if (rendererSystem.requiresFlip) {
      // Convert from top-down (canvas/svg) to bottom-up (unified)
      const chartArea = this.config.chartArea;
      const chartHeight = chartArea.height;
      const chartTop = chartArea.y;
      
      // Flip Y coordinate: renderer Y=0 (top) becomes unified Y=chartHeight (top in unified)
      unifiedY = chartTop + chartHeight - (rendererY - chartTop);
    }
    
    return {
      x: unifiedX,
      y: unifiedY,
      coordinateSystem: 'unified'
    };
  }
  
  /**
   * Transform UNIFIED pixel coordinates to data coordinates (inverse)
   * @param {number} unifiedX - Unified X coordinate
   * @param {number} unifiedY - Unified Y coordinate
   * @returns {Object} { x: dataX, y: dataY }
   */
  unifiedToData(unifiedX, unifiedY) {
    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales not available for coordinate transformation');
    }
    
    try {
      // Reverse coordinate system transformations
      const originalCoords = this._reverseUnifiedCoordinateTransforms(unifiedX, unifiedY);
      
      // Use scales to transform unified pixel to data coordinates
      const dataX = this.scales.x.invert(originalCoords.x);
      const dataY = this.scales.y.invert(originalCoords.y);
      
      return { x: dataX, y: dataY };
      
    } catch (error) {
      console.error('Error in unifiedToData transformation:', error);
      return { x: null, y: null };
    }
  }
  
  /**
   * Legacy method for backward compatibility
   * Transform data coordinates to pixel coordinates
   */
  dataToPixel(dataX, dataY) {
    return this.dataToUnified(dataX, dataY);
  }
  
  /**
   * Legacy method for backward compatibility  
   * Transform pixel coordinates to data coordinates
   */
  pixelToData(pixelX, pixelY) {
    return this.unifiedToData(pixelX, pixelY);
  }
  
  /**
   * Apply unified coordinate system transformations
   * @private
   */
  _applyUnifiedCoordinateTransforms(x, y) {
    let transformedX = x;
    let transformedY = y;
    
    // In unified coordinate system, coordinates are already in bottom-left, Y-up format
    // No additional flipping needed here since scales handle the coordinate conversion
    
    // Apply custom transforms if enabled
    if (this.config.enableTransforms) {
      // Apply scaling
      transformedX *= this.transforms.scale.x;
      transformedY *= this.transforms.scale.y;
      
      // Apply translation
      transformedX += this.transforms.translate.x;
      transformedY += this.transforms.translate.y;
      
      // Apply rotation (around origin)
      if (this.transforms.rotate !== 0) {
        const cos = Math.cos(this.transforms.rotate);
        const sin = Math.sin(this.transforms.rotate);
        const rotatedX = transformedX * cos - transformedY * sin;
        const rotatedY = transformedX * sin + transformedY * cos;
        transformedX = rotatedX;
        transformedY = rotatedY;
      }
    }
    
    return { x: transformedX, y: transformedY };
  }
  
  /**
   * Reverse unified coordinate system transformations
   * @private
   */
  _reverseUnifiedCoordinateTransforms(x, y) {
    let originalX = x;
    let originalY = y;
    
    // Reverse custom transforms if enabled
    if (this.config.enableTransforms) {
      // Reverse rotation
      if (this.transforms.rotate !== 0) {
        const cos = Math.cos(-this.transforms.rotate);
        const sin = Math.sin(-this.transforms.rotate);
        const rotatedX = originalX * cos - originalY * sin;
        const rotatedY = originalX * sin + originalY * cos;
        originalX = rotatedX;
        originalY = rotatedY;
      }
      
      // Reverse translation
      originalX -= this.transforms.translate.x;
      originalY -= this.transforms.translate.y;
      
      // Reverse scaling
      originalX /= this.transforms.scale.x;
      originalY /= this.transforms.scale.y;
    }
    
    return { x: originalX, y: originalY };
  }
  
  /**
   * Check if point is within chart bounds
   * @private
   */
  _isPointInBounds(x, y) {
    const chartArea = this.config.chartArea;
    
    return x >= chartArea.x && 
           x <= chartArea.x + chartArea.width &&
           y >= chartArea.y && 
           y <= chartArea.y + chartArea.height;
  }
  
  /**
   * Transform event coordinates to data coordinates
   * @param {MouseEvent|TouchEvent} event - DOM event
   * @param {HTMLElement} element - Target element
   * @param {string} sourceRenderer - Source renderer for event coordinates
   * @returns {Object} { x: dataX, y: dataY }
   */
  eventToData(event, element, sourceRenderer = 'canvas') {
    // Get pixel coordinates relative to element
    const rect = element.getBoundingClientRect();
    const rendererX = event.clientX - rect.left;
    const rendererY = event.clientY - rect.top;
    
    // Convert renderer coordinates to unified coordinates
    const unifiedCoords = this.rendererToUnified(rendererX, rendererY, sourceRenderer);
    
    // Transform unified coordinates to data coordinates
    return this.unifiedToData(unifiedCoords.x, unifiedCoords.y);
  }
  
  /**
   * Transform data coordinates to event coordinates
   * @param {number} dataX - Data X coordinate  
   * @param {number} dataY - Data Y coordinate
   * @param {HTMLElement} element - Target element
   * @param {string} targetRenderer - Target renderer for event coordinates
   * @returns {Object} { x: eventX, y: eventY }
   */
  dataToEvent(dataX, dataY, element, targetRenderer = 'canvas') {
    // Transform to unified coordinates
    const unifiedCoords = this.dataToUnified(dataX, dataY);
    
    // Convert unified coordinates to renderer coordinates
    const rendererCoords = this.unifiedToRenderer(unifiedCoords.x, unifiedCoords.y, targetRenderer);
    
    // Convert to event coordinates (relative to viewport)
    const rect = element.getBoundingClientRect();
    
    return {
      x: rendererCoords.x + rect.left,
      y: rendererCoords.y + rect.top
    };
  }
  
  /**
   * Set custom transformation matrix
   * @param {Object} transforms - { scale: {x, y}, translate: {x, y}, rotate: number }
   */
  setTransforms(transforms) {
    this.transforms = { ...this.transforms, ...transforms };
    this._clearCache();
    return this;
  }
  
  /**
   * Reset transformations to default
   */
  resetTransforms() {
    this.transforms = {
      scale: { x: 1, y: 1 },
      translate: { x: 0, y: 0 },
      rotate: 0
    };
    this._clearCache();
    return this;
  }
  
  /**
   * Get coordinate system information
   */
  getCoordinateInfo() {
    return {
      config: this.config,
      coordinateSystem: 'unified',
      targetRenderer: this.config.targetRenderer,
      scales: {
        x: this.scales.x ? {
          domain: this.scales.x.domain,
          range: this.scales.x.range,
          type: this.scales.x.type,
          coordinateSystem: this.scales.x.coordinateSystem
        } : null,
        y: this.scales.y ? {
          domain: this.scales.y.domain,
          range: this.scales.y.range,
          type: this.scales.y.type,
          coordinateSystem: this.scales.y.coordinateSystem
        } : null
      },
      transforms: this.transforms,
      performanceStats: this.transformStats,
      rendererCoordinateSystems: this.rendererCoordinateSystems
    };
  }
  
  /**
   * Clear coordinate cache
   */
  clearCache() {
    this._clearCache();
  }
  
  /**
   * Clear internal cache
   * @private
   */
  _clearCache() {
    this.coordinateCache.clear();
    this.transformedDatasets.clear();
    console.log('CoordinateSystem cache cleared');
  }
  
  /**
   * Generate cache key for transformed data
   * @private
   */
  _generateCacheKey(dataset, options) {
    const scaleInfo = {
      x: this.scales.x ? {
        domain: this.scales.x.domain,
        range: this.scales.x.range,
        type: this.scales.x.type,
        coordinateSystem: this.scales.x.coordinateSystem
      } : null,
      y: this.scales.y ? {
        domain: this.scales.y.domain,
        range: this.scales.y.range,
        type: this.scales.y.type,
        coordinateSystem: this.scales.y.coordinateSystem
      } : null
    };
    
    const cacheData = {
      datasetId: dataset.id || 'unknown',
      dataHash: this._hashData(dataset.data),
      scales: scaleInfo,
      transforms: this.transforms,
      config: {
        coordinateOrigin: this.config.coordinateOrigin,
        useUnifiedCoordinates: this.config.useUnifiedCoordinates,
        targetRenderer: this.config.targetRenderer,
        viewport: this.config.viewport,
        chartArea: this.config.chartArea
      },
      options
    };
    
    return this._hashObject(cacheData);
  }
  
  /**
   * Simple hash function for data
   * @private
   */
  _hashData(data) {
    if (!Array.isArray(data) || data.length === 0) return '0';
    
    // Hash based on first, middle, and last points plus length
    const first = data[0];
    const middle = data[Math.floor(data.length / 2)];
    const last = data[data.length - 1];
    
    return `${data.length}-${JSON.stringify(first)}-${JSON.stringify(middle)}-${JSON.stringify(last)}`.replace(/\s/g, '');
  }
  
  /**
   * Hash object for cache key
   * @private
   */
  _hashObject(obj) {
    return JSON.stringify(obj).replace(/\s/g, '');
  }
  
  /**
   * Update performance statistics
   * @private
   */
  _updateTransformStats(transformTime, datasetCount) {
    this.transformStats.totalTransformations += datasetCount;
    
    // Update rolling average
    const alpha = 0.1; // Smoothing factor
    this.transformStats.averageTransformTime = 
      this.transformStats.averageTransformTime * (1 - alpha) + 
      transformTime * alpha;
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.transformStats,
      cacheEfficiency: this.transformStats.cacheHits / 
                      (this.transformStats.cacheHits + this.transformStats.cacheMisses) || 0
    };
  }
  
  /**
   * Create coordinate system for common chart configurations
   */
  static createForChart(chartType, viewport, chartArea, options = {}) {
    const config = {
      viewport,
      chartArea,
      coordinateOrigin: 'bottom-left',
      useUnifiedCoordinates: true,
      targetRenderer: 'auto',
      ...options
    };
    
    // Chart-specific adjustments
    switch (chartType) {
      case 'line':
      case 'area':
        config.enableTransforms = true;
        break;
        
      case 'bar':
        config.enableClipping = true;
        break;
        
      case 'scatter':
        config.enableHighDPI = true;
        break;
    }
    
    return new CoordinateSystem(config);
  }
}
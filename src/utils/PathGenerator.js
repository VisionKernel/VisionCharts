/**
 * PathGenerator - Enhanced multi-renderer path generation utility (Updated)
 * 
 * Handles line and area path generation for Canvas and WebGL renderers
 * with various interpolation methods and performance optimizations.
 * 
 * NOW WORKS WITH UNIFIED COORDINATE SYSTEM - generates standardized
 * rendering primitives that both Canvas and WebGL can consume identically.
 */

export class PathGenerator {
  constructor(config = {}) {
    this.config = {
      // Curve interpolation options
      curve: 'linear', // 'linear', 'step', 'cardinal', 'monotone'
      
      // NEW: Renderer awareness for coordinate system optimization
      targetRenderer: 'auto', // 'canvas', 'webgl', 'auto'
      
      // Performance options
      batchSize: 1000,
      enableOptimization: true,
      
      // Quality options
      smoothing: 0.5, // For cardinal/monotone curves
      tension: 0.4,   // For cardinal curves
      
      // NEW: Coordinate system validation
      enableCoordinateValidation: true,
      
      // NEW: Default fill options
      fillOpacity: 0.3,
      
      ...config
    };
    
    console.log('PathGenerator created with unified coordinate system support');
  }

  /**
   * Generate standardized path data for multiple datasets
   * @param {Array} datasets - Datasets with UNIFIED coordinates (unifiedX, unifiedY)
   * @param {Object} options - Path generation options
   * @returns {Array} Array of standardized path objects
   */
  async generatePaths(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }

    const pathOptions = { ...this.config, ...options };
    const generatedPaths = [];

    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        console.log(`PathGenerator: Processing dataset ${i + 1}/${datasets.length} with UNIFIED coordinates: ${dataset.name || dataset.id || 'Unknown'}`);
        
        const pathData = await this.generatePath(dataset, pathOptions);
        generatedPaths.push(pathData);
      }

      console.log(`PathGenerator: Generated ${generatedPaths.length} standardized paths from UNIFIED coordinates`);
      return generatedPaths;

    } catch (error) {
      console.error('Error generating paths:', error);
      throw error;
    }
  }

  /**
   * Generate standardized path data for a single dataset
   * @param {Object} dataset - Dataset with UNIFIED coordinates
   * @param {Object} options - Path generation options
   * @returns {Object} Standardized path object
   */
  async generatePath(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }

    const pathOptions = { ...this.config, ...options };
    const data = dataset.data;

    // UPDATED: Extract UNIFIED coordinates instead of mixed coordinate fields
    const unifiedPoints = this._extractUnifiedCoordinates(data);
    
    if (unifiedPoints.length === 0) {
      console.warn('No valid unified coordinates found in dataset');
      return this._createEmptyPath(dataset);
    }

    // Validate coordinates if enabled
    if (pathOptions.enableCoordinateValidation) {
      this._validateUnifiedCoordinates(unifiedPoints, dataset.name || dataset.id);
    }

    // Generate vertices based on curve type
    const vertices = await this._generateVertices(unifiedPoints, pathOptions);
    
    // Generate colors for each vertex
    const colors = this._generateColors(vertices, dataset, pathOptions);

    // Create standardized path object
    const pathData = {
      // Dataset metadata
      id: dataset.id,
      name: dataset.name,
      color: dataset.color,
      
      // NEW: Fill support
      fill: dataset.fill || false,
      fillOpacity: pathOptions.fillOpacity || 0.6,
      
      // Geometry data (standardized for both Canvas and WebGL)
      vertices: vertices,           // Array of {x, y} unified coordinates
      colors: colors,              // Array of {r, g, b, a} colors
      
      // Rendering hints
      lineWidth: dataset.width || pathOptions.strokeWidth || 2,
      curveType: pathOptions.curve,
      vertexCount: vertices.length,
      
      // Coordinate system metadata
      coordinateSystem: 'unified',
      targetRenderer: pathOptions.targetRenderer,
      
      // Original dataset reference
      originalDataset: dataset,
      
      // Path generation metadata
      generatedAt: Date.now(),
      unifiedPointCount: unifiedPoints.length
    };

    console.log(`PathGenerator: Generated path with fill support for ${dataset.name || dataset.id} (fill: ${pathData.fill})`);
    return pathData;
  }

  /**
   * UPDATED: Extract UNIFIED coordinates from dataset
   * @private
   */
  _extractUnifiedCoordinates(data) {
    const unifiedPoints = [];

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      
      // UPDATED: Use UNIFIED coordinates from CoordinateSystem transformation
      const x = point.unifiedX || point.screenX || point.pixelX;
      const y = point.unifiedY || point.screenY || point.pixelY;

      if (x != null && y != null && isFinite(x) && isFinite(y)) {
        unifiedPoints.push({
          x: x,
          y: y,
          originalIndex: i,
          originalPoint: point,
          // NEW: Include coordinate system metadata
          coordinateSystem: point.coordinateSystem || 'unified'
        });
      }
    }

    return unifiedPoints;
  }

  /**
   * NEW: Validate unified coordinates for consistency
   * @private
   */
  _validateUnifiedCoordinates(unifiedPoints, datasetName) {
    if (unifiedPoints.length === 0) return;

    let inconsistentCount = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const point of unifiedPoints) {
      // Check coordinate system consistency
      if (point.coordinateSystem && point.coordinateSystem !== 'unified') {
        inconsistentCount++;
      }

      // Track coordinate bounds
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    // Log validation results
    if (inconsistentCount > 0) {
      console.warn(`PathGenerator: ${inconsistentCount} points in ${datasetName} have inconsistent coordinate systems`);
    }

    console.log(`PathGenerator: Unified coordinates validated for ${datasetName}:`, {
      pointCount: unifiedPoints.length,
      bounds: { minX, maxX, minY, maxY },
      inconsistentCount
    });
  }

  /**
   * Generate vertices based on curve type
   * @private
   */
  async _generateVertices(unifiedPoints, options) {
    const vertices = [];

    switch (options.curve) {
      case 'linear':
        return this._generateLinearVertices(unifiedPoints);
        
      case 'step':
        return this._generateStepVertices(unifiedPoints);
        
      case 'cardinal':
        return await this._generateCardinalVertices(unifiedPoints, options);
        
      case 'monotone':
        return await this._generateMonotoneVertices(unifiedPoints, options);
        
      default:
        console.warn(`Unknown curve type: ${options.curve}, falling back to linear`);
        return this._generateLinearVertices(unifiedPoints);
    }
  }

  /**
   * Generate linear interpolation vertices
   * @private
   */
  _generateLinearVertices(unifiedPoints) {
    // For linear, just return the unified points as-is
    return unifiedPoints.map(point => ({
      x: point.x,
      y: point.y
    }));
  }

  /**
   * Generate step interpolation vertices
   * @private
   */
  _generateStepVertices(unifiedPoints) {
    if (unifiedPoints.length === 0) return [];
    
    const vertices = [];
    
    // First point
    vertices.push({ x: unifiedPoints[0].x, y: unifiedPoints[0].y });
    
    // Generate step segments
    for (let i = 1; i < unifiedPoints.length; i++) {
      const prevPoint = unifiedPoints[i - 1];
      const currentPoint = unifiedPoints[i];
      
      // Horizontal line to current x
      vertices.push({ x: currentPoint.x, y: prevPoint.y });
      
      // Vertical line to current y
      vertices.push({ x: currentPoint.x, y: currentPoint.y });
    }
    
    return vertices;
  }

  /**
   * Generate cardinal spline vertices
   * @private
   */
  async _generateCardinalVertices(unifiedPoints, options) {
    if (unifiedPoints.length < 2) return this._generateLinearVertices(unifiedPoints);
    
    const vertices = [];
    const tension = options.tension || 0.4;
    const segments = 10; // Subdivisions per curve segment
    
    // Add first point
    vertices.push({ x: unifiedPoints[0].x, y: unifiedPoints[0].y });
    
    // Generate cardinal spline segments
    for (let i = 0; i < unifiedPoints.length - 1; i++) {
      const p0 = unifiedPoints[Math.max(0, i - 1)];
      const p1 = unifiedPoints[i];
      const p2 = unifiedPoints[i + 1];
      const p3 = unifiedPoints[Math.min(unifiedPoints.length - 1, i + 2)];
      
      // Generate curve points
      for (let t = 0; t <= segments; t++) {
        const u = t / segments;
        const point = this._cardinalSplinePoint(p0, p1, p2, p3, u, tension);
        vertices.push(point);
      }
      
      // Yield control for large datasets
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return vertices;
  }

  /**
   * Calculate cardinal spline point
   * @private
   */
  _cardinalSplinePoint(p0, p1, p2, p3, t, tension) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const v0x = (p2.x - p0.x) * tension;
    const v0y = (p2.y - p0.y) * tension;
    const v1x = (p3.x - p1.x) * tension;
    const v1y = (p3.y - p1.y) * tension;
    
    const x = (2 * t3 - 3 * t2 + 1) * p1.x + 
              (t3 - 2 * t2 + t) * v0x + 
              (-2 * t3 + 3 * t2) * p2.x + 
              (t3 - t2) * v1x;
              
    const y = (2 * t3 - 3 * t2 + 1) * p1.y + 
              (t3 - 2 * t2 + t) * v0y + 
              (-2 * t3 + 3 * t2) * p2.y + 
              (t3 - t2) * v1y;
    
    return { x, y };
  }

  /**
   * Generate monotone interpolation vertices
   * @private
   */
  async _generateMonotoneVertices(unifiedPoints, options) {
    // Simplified monotone cubic interpolation
    // For now, fall back to linear with some smoothing
    return this._generateLinearVertices(unifiedPoints);
  }

  /**
   * Generate colors for vertices
   * @private
   */
  _generateColors(vertices, dataset, options) {
    const baseColor = this._parseColor(dataset.color || '#1468a8');
    const colors = [];
    
    // For now, use the same color for all vertices
    // Later could implement gradients, point-specific colors, etc.
    for (let i = 0; i < vertices.length; i++) {
      colors.push({
        r: baseColor.r,
        g: baseColor.g,
        b: baseColor.b,
        a: baseColor.a
      });
    }
    
    return colors;
  }

  /**
 * Parse color string to normalized RGBA
 * @private
 */
_parseColor(colorString) {
  if (typeof colorString !== 'string') {
    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 }; // Default blue
  }

  // Handle hex colors
  if (colorString.startsWith('#')) {
    const hex = colorString.slice(1);
    let r, g, b;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 }; // Default blue
    }
    
    return { r: r / 255, g: g / 255, b: b / 255, a: 1.0 };
  }

  // Handle rgba() colors
  const rgbaMatch = colorString.match(/rgba?\(([^)]+)\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(s => s.trim());
    return {
      r: parseInt(parts[0]) / 255,
      g: parseInt(parts[1]) / 255,
      b: parseInt(parts[2]) / 255,
      a: parts[3] ? parseFloat(parts[3]) : 1.0
    };
  }

  // Default fallback
  return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
}

  /**
   * Create empty path object
   * @private
   */
  _createEmptyPath(dataset) {
    return {
      id: dataset.id,
      name: dataset.name,
      color: dataset.color,
      fill: dataset.fill || false,        // NEW: Include fill
      fillOpacity: 0.3,                   // NEW: Default opacity
      vertices: [],
      colors: [],
      lineWidth: dataset.width || 2,
      curveType: 'linear',
      vertexCount: 0,
      coordinateSystem: 'unified',
      targetRenderer: this.config.targetRenderer,
      originalDataset: dataset,
      generatedAt: Date.now(),
      unifiedPointCount: 0
    };
  }

  /**
   * NEW: Set target renderer for path generation optimization
   */
  setTargetRenderer(renderer) {
    const validRenderers = ['canvas', 'webgl', 'auto'];
    
    if (validRenderers.includes(renderer)) {
      this.config.targetRenderer = renderer;
      console.log(`PathGenerator target renderer set to: ${renderer}`);
    } else {
      console.warn(`Invalid target renderer: ${renderer}. Valid renderers: ${validRenderers.join(', ')}`);
    }
    
    return this;
  }

  /**
   * Update curve type for path generation
   */
  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    
    if (validCurves.includes(curveType)) {
      this.config.curve = curveType;
      console.log(`PathGenerator curve type set to: ${curveType}`);
    } else {
      console.warn(`Invalid curve type: ${curveType}. Valid types: ${validCurves.join(', ')}`);
    }
    
    return this;
  }

  /**
   * NEW: Enable/disable coordinate validation
   */
  setCoordinateValidation(enabled) {
    this.config.enableCoordinateValidation = enabled;
    console.log(`PathGenerator coordinate validation: ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }

  /**
   * NEW: Get path generation statistics
   */
  getGenerationStats() {
    return {
      config: this.config,
      coordinateSystem: 'unified',
      targetRenderer: this.config.targetRenderer,
      validationEnabled: this.config.enableCoordinateValidation
    };
  }

  /**
   * Create PathGenerator with specific configuration
   */
  static create(curveType = 'linear', options = {}) {
    return new PathGenerator({
      curve: curveType,
      targetRenderer: 'auto',
      enableCoordinateValidation: true,
      ...options
    });
  }

  /**
   * NEW: Create PathGenerator for specific renderer
   */
  static createForRenderer(renderer, curveType = 'linear', options = {}) {
    return new PathGenerator({
      curve: curveType,
      targetRenderer: renderer,
      enableCoordinateValidation: true,
      ...options
    });
  }
}
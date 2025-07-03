/**
 * PathGenerator - Enhanced multi-renderer path generation utility
 * 
 * Handles line and area path generation for Canvas and WebGL renderers
 * with various interpolation methods and performance optimizations.
 * 
 * Takes pixel coordinates from CoordinateSystem and generates standardized
 * rendering primitives that both Canvas and WebGL can consume identically.
 */

export class PathGenerator {
  constructor(config = {}) {
    this.config = {
      // Curve interpolation options
      curve: 'linear', // 'linear', 'step', 'cardinal', 'monotone'
      
      // Performance options
      batchSize: 1000,
      enableOptimization: true,
      
      // Quality options
      smoothing: 0.5, // For cardinal/monotone curves
      tension: 0.4,   // For cardinal curves
      
      ...config
    };
  }

  /**
   * Generate standardized path data for multiple datasets
   * @param {Array} datasets - Datasets with pixel coordinates (screenX, screenY)
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
        console.log(`PathGenerator: Processing dataset ${i + 1}/${datasets.length}: ${dataset.name || dataset.id || 'Unknown'}`);
        
        const pathData = await this.generatePath(dataset, pathOptions);
        generatedPaths.push(pathData);
      }

      console.log(`PathGenerator: Generated ${generatedPaths.length} standardized paths`);
      return generatedPaths;

    } catch (error) {
      console.error('Error generating paths:', error);
      throw error;
    }
  }

  /**
   * Generate standardized path data for a single dataset
   * @param {Object} dataset - Dataset with pixel coordinates
   * @param {Object} options - Path generation options
   * @returns {Object} Standardized path object
   */
  async generatePath(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }

    const pathOptions = { ...this.config, ...options };
    const data = dataset.data;

    // Extract valid pixel coordinates
    const pixelPoints = this._extractPixelCoordinates(data);
    
    if (pixelPoints.length === 0) {
      console.warn('No valid pixel coordinates found in dataset');
      return this._createEmptyPath(dataset);
    }

    // Generate vertices based on curve type
    const vertices = await this._generateVertices(pixelPoints, pathOptions);
    
    // Generate colors for each vertex
    const colors = this._generateColors(vertices, dataset, pathOptions);

    // Create standardized path object
    const pathData = {
      // Dataset metadata
      id: dataset.id,
      name: dataset.name,
      color: dataset.color,
      
      // Geometry data (standardized for both Canvas and WebGL)
      vertices: vertices,           // Array of {x, y} coordinates
      colors: colors,              // Array of {r, g, b, a} colors
      
      // Rendering hints
      lineWidth: dataset.width || pathOptions.strokeWidth || 2,
      curveType: pathOptions.curve,
      vertexCount: vertices.length,
      
      // Original dataset reference
      originalDataset: dataset,
      
      // Path generation metadata
      generatedAt: Date.now(),
      pixelPointCount: pixelPoints.length
    };

    console.log(`PathGenerator: Generated path for ${dataset.name || dataset.id} with ${vertices.length} vertices`);
    return pathData;
  }

  /**
   * Extract pixel coordinates from dataset
   * @private
   */
  _extractPixelCoordinates(data) {
    const pixelPoints = [];

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      
      // Use pre-calculated pixel coordinates from CoordinateSystem
      const x = point.screenX;
      const y = point.screenY;

      if (x != null && y != null && isFinite(x) && isFinite(y)) {
        pixelPoints.push({
          x: x,
          y: y,
          originalIndex: i,
          originalPoint: point
        });
      }
    }

    return pixelPoints;
  }

  /**
   * Generate vertices based on curve type
   * @private
   */
  async _generateVertices(pixelPoints, options) {
    const vertices = [];

    switch (options.curve) {
      case 'linear':
        return this._generateLinearVertices(pixelPoints);
        
      case 'step':
        return this._generateStepVertices(pixelPoints);
        
      case 'cardinal':
        return await this._generateCardinalVertices(pixelPoints, options);
        
      case 'monotone':
        return await this._generateMonotoneVertices(pixelPoints, options);
        
      default:
        console.warn(`Unknown curve type: ${options.curve}, falling back to linear`);
        return this._generateLinearVertices(pixelPoints);
    }
  }

  /**
   * Generate linear interpolation vertices
   * @private
   */
  _generateLinearVertices(pixelPoints) {
    // For linear, just return the pixel points as-is
    return pixelPoints.map(point => ({
      x: point.x,
      y: point.y
    }));
  }

  /**
   * Generate step interpolation vertices
   * @private
   */
  _generateStepVertices(pixelPoints) {
    if (pixelPoints.length === 0) return [];
    
    const vertices = [];
    
    // First point
    vertices.push({ x: pixelPoints[0].x, y: pixelPoints[0].y });
    
    // Generate step segments
    for (let i = 1; i < pixelPoints.length; i++) {
      const prevPoint = pixelPoints[i - 1];
      const currentPoint = pixelPoints[i];
      
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
  async _generateCardinalVertices(pixelPoints, options) {
    if (pixelPoints.length < 2) return this._generateLinearVertices(pixelPoints);
    
    const vertices = [];
    const tension = options.tension || 0.4;
    const segments = 10; // Subdivisions per curve segment
    
    // Add first point
    vertices.push({ x: pixelPoints[0].x, y: pixelPoints[0].y });
    
    // Generate cardinal spline segments
    for (let i = 0; i < pixelPoints.length - 1; i++) {
      const p0 = pixelPoints[Math.max(0, i - 1)];
      const p1 = pixelPoints[i];
      const p2 = pixelPoints[i + 1];
      const p3 = pixelPoints[Math.min(pixelPoints.length - 1, i + 2)];
      
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
  async _generateMonotoneVertices(pixelPoints, options) {
    // Simplified monotone cubic interpolation
    // For now, fall back to linear with some smoothing
    return this._generateLinearVertices(pixelPoints);
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
    if (typeof colorString === 'string' && colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b, a: 1.0 };
    }
    
    // Default blue color
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
      vertices: [],
      colors: [],
      lineWidth: dataset.width || 2,
      curveType: 'linear',
      vertexCount: 0,
      originalDataset: dataset,
      generatedAt: Date.now(),
      pixelPointCount: 0
    };
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
   * Create PathGenerator with specific configuration
   */
  static create(curveType = 'linear', options = {}) {
    return new PathGenerator({
      curve: curveType,
      ...options
    });
  }
}
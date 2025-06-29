/**
 * PathGenerator - Enhanced multi-renderer path generation utility
 * 
 * Handles line and area path generation for SVG, Canvas, and WebGL renderers
 * with various interpolation methods and performance optimizations.
 */
export default class PathGenerator {
  
  // Static cache for performance optimization
  static pathCache = new Map();
  static pointCache = new Map();
  static maxCacheSize = 1000;
  
  // Performance tracking
  static metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    pathGenerations: 0,
    simplifications: 0
  };

  // ===== MAIN API METHODS (BACKWARDS COMPATIBLE) =====
  
  /**
   * Generate line path based on curve type
   * @param {Array} data - Data array
   * @param {Object} chart - Chart instance
   * @param {Object} scales - Chart scales (optional, will use chart.state.scales if not provided)
   * @returns {string} SVG path definition
   */
  static generateLinePath(data, chart, scales = null) {
    console.log('PathGenerator.generateLinePath called with curve:', chart.options.curve);
    
    if (!data || !data.length) {
      console.log('No data provided for line path generation');
      return '';
    }
    
    const { xField, yField, curve = 'linear' } = chart.options;
    const chartScales = scales || chart.state.scales;
    
    if (!chartScales || !chartScales.x || !chartScales.y) {
      console.warn('No scales available for path generation');
      return '';
    }
    
    // Get coordinate points
    const points = this.getDataPoints(data, xField, yField, chartScales);
    
    if (points.length === 0) {
      console.log('No valid points for line path generation');
      return '';
    }
    
    // Generate path based on curve type and renderer
    return this._generatePathForRenderer(points, curve, chart.rendererMetadata?.type || 'svg');
  }
  
  /**
   * Generate area path based on curve type
   * @param {Array} data - Data array
   * @param {Object} chart - Chart instance
   * @param {Object} scales - Chart scales (optional, will use chart.state.scales if not provided)
   * @returns {string} SVG path definition for area
   */
  static generateAreaPath(data, chart, scales = null) {
    console.log('PathGenerator.generateAreaPath called');
    
    if (!data || !data.length) {
      console.log('No data provided for area path generation');
      return '';
    }
    
    const chartScales = scales || chart.state.scales;
    
    if (!chartScales || !chartScales.x || !chartScales.y) {
      console.warn('No scales available for area path generation');
      return '';
    }
    
    const { xField, yField, curve = 'linear' } = chart.options;
    const points = this.getDataPoints(data, xField, yField, chartScales);
    
    if (points.length === 0) {
      return '';
    }
    
    // Get the baseline Y position (usually zero or bottom of chart)
    const baselineY = chartScales.y.scale(0);
    
    // Generate area path based on renderer type
    const rendererType = chart.rendererMetadata?.type || 'svg';
    
    return this._generateAreaPathForRenderer(points, baselineY, curve, rendererType);
  }

  // ===== ENHANCED MULTI-RENDERER METHODS =====

  /**
   * Generate path optimized for specific renderer
   * @param {Array} data - Data array
   * @param {Object} chart - Chart instance
   * @param {string} outputFormat - 'svg', 'canvas', 'webgl', 'coordinates'
   * @param {Object} scales - Chart scales
   * @returns {string|Array|Object} Path data in requested format
   */
  static generatePathForRenderer(data, chart, outputFormat = 'svg', scales = null) {
    const { xField, yField, curve = 'linear' } = chart.options;
    const chartScales = scales || chart.state.scales;
    
    if (!chartScales || !chartScales.x || !chartScales.y) {
      return outputFormat === 'coordinates' ? [] : '';
    }
    
    // Get coordinate points with caching
    const points = this.getDataPointsCached(data, xField, yField, chartScales);
    
    if (points.length === 0) {
      return outputFormat === 'coordinates' ? [] : '';
    }
    
    // Apply performance optimizations based on renderer
    const optimizedPoints = this._optimizePointsForRenderer(points, outputFormat, chart.options);
    
    // Generate path in requested format
    switch (outputFormat) {
      case 'svg':
        return this._generateSVGPath(optimizedPoints, curve);
      case 'canvas':
        return this._generateCanvasInstructions(optimizedPoints, curve);
      case 'webgl':
        return this._generateWebGLBuffers(optimizedPoints, curve);
      case 'coordinates':
        return optimizedPoints;
      default:
        return this._generateSVGPath(optimizedPoints, curve);
    }
  }

  /**
   * Generate area path optimized for specific renderer
   * @param {Array} data - Data array
   * @param {Object} chart - Chart instance
   * @param {string} outputFormat - 'svg', 'canvas', 'webgl', 'coordinates'
   * @param {Object} scales - Chart scales
   * @returns {string|Array|Object} Area path data in requested format
   */
  static generateAreaPathForRenderer(data, chart, outputFormat = 'svg', scales = null) {
    const { xField, yField, curve = 'linear' } = chart.options;
    const chartScales = scales || chart.state.scales;
    
    if (!chartScales || !chartScales.x || !chartScales.y) {
      return outputFormat === 'coordinates' ? [] : '';
    }
    
    const points = this.getDataPointsCached(data, xField, yField, chartScales);
    
    if (points.length === 0) {
      return outputFormat === 'coordinates' ? [] : '';
    }
    
    const baselineY = chartScales.y.scale(0);
    const optimizedPoints = this._optimizePointsForRenderer(points, outputFormat, chart.options);
    
    // Generate area path in requested format
    switch (outputFormat) {
      case 'svg':
        return this._generateSVGAreaPath(optimizedPoints, baselineY, curve);
      case 'canvas':
        return this._generateCanvasAreaInstructions(optimizedPoints, baselineY, curve);
      case 'webgl':
        return this._generateWebGLAreaBuffers(optimizedPoints, baselineY, curve);
      case 'coordinates':
        return this._generateAreaCoordinates(optimizedPoints, baselineY);
      default:
        return this._generateSVGAreaPath(optimizedPoints, baselineY, curve);
    }
  }

  /**
   * Batch generate multiple paths for performance
   * @param {Array} datasets - Array of datasets
   * @param {Object} chart - Chart instance
   * @param {string} outputFormat - Output format
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of path data
   */
  static batchGeneratePaths(datasets, chart, outputFormat = 'svg', scales = null) {
    console.log(`PathGenerator: Batch generating ${datasets.length} paths for ${outputFormat}`);
    
    const startTime = performance.now();
    const paths = [];
    
    // Pre-calculate common values
    const chartScales = scales || chart.state.scales;
    const { xField, yField, curve = 'linear' } = chart.options;
    
    datasets.forEach((dataset, index) => {
      if (!dataset.data || !dataset.data.length) {
        paths.push(outputFormat === 'coordinates' ? [] : '');
        return;
      }
      
      try {
        const points = this.getDataPointsCached(dataset.data, xField, yField, chartScales);
        
        if (points.length === 0) {
          paths.push(outputFormat === 'coordinates' ? [] : '');
          return;
        }
        
        const optimizedPoints = this._optimizePointsForRenderer(points, outputFormat, chart.options);
        
        // Generate path based on format
        let pathData;
        switch (outputFormat) {
          case 'svg':
            pathData = this._generateSVGPath(optimizedPoints, curve);
            break;
          case 'canvas':
            pathData = this._generateCanvasInstructions(optimizedPoints, curve);
            break;
          case 'webgl':
            pathData = this._generateWebGLBuffers(optimizedPoints, curve);
            break;
          case 'coordinates':
            pathData = optimizedPoints;
            break;
          default:
            pathData = this._generateSVGPath(optimizedPoints, curve);
        }
        
        paths.push(pathData);
        
      } catch (error) {
        console.warn(`Failed to generate path for dataset ${index}:`, error);
        paths.push(outputFormat === 'coordinates' ? [] : '');
      }
    });
    
    const processingTime = performance.now() - startTime;
    console.log(`Batch path generation completed in ${processingTime.toFixed(2)}ms`);
    
    return paths;
  }

  // ===== LEGACY CURVE METHODS (PRESERVED FOR BACKWARDS COMPATIBILITY) =====
  
  /**
   * Generate linear interpolation path
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @returns {string} SVG path definition
   */
  static generateLinearPath(points) {
    if (!points || points.length === 0) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    // Start with move to first point
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Add line segments to remaining points
    restPoints.forEach(([x, y]) => {
      pathParts.push(`L ${x},${y}`);
    });
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate step interpolation path
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @returns {string} SVG path definition
   */
  static generateStepPath(points) {
    if (!points || points.length === 0) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    // Start with move to first point
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Add step segments
    restPoints.forEach(([x, y]) => {
      // Horizontal line to x position
      pathParts.push(`H ${x}`);
      // Vertical line to y position
      pathParts.push(`V ${y}`);
    });
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate cardinal spline interpolation path
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @param {number} tension - Spline tension (0-1, default 0.5)
   * @returns {string} SVG path definition
   */
  static generateCardinalPath(points, tension = 0.5) {
    if (!points || points.length < 2) {
      return this.generateLinearPath(points);
    }
    
    // Need at least 3 points for smooth cardinal spline
    if (points.length < 3) {
      return this.generateLinearPath(points);
    }
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    // Start with move to first point
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Helper function to calculate control points for cardinal spline
    const getControlPoints = (p0, p1, p2, t) => {
      const d1x = (p2[0] - p0[0]) * t;
      const d1y = (p2[1] - p0[1]) * t;
      
      return [
        [p1[0] - d1x, p1[1] - d1y], // Control point 1
        [p1[0] + d1x, p1[1] + d1y]  // Control point 2
      ];
    };
    
    // Generate curve segments
    for (let i = 0; i < restPoints.length; i++) {
      const current = restPoints[i];
      const prev = i > 0 ? restPoints[i - 1] : firstPoint;
      const next = i < restPoints.length - 1 ? restPoints[i + 1] : current;
      
      let cp1, cp2;
      if (i === 0) {
        [cp1, cp2] = getControlPoints(firstPoint, firstPoint, current, tension);
      } else {
        [cp1, cp2] = getControlPoints(prev, current, next, tension);
      }
      
      // Add cubic bezier curve segment
      pathParts.push(`C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${current[0]},${current[1]}`);
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate monotone interpolation path (Fritsch-Carlson)
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @returns {string} SVG path definition
   */
  static generateMonotonePath(points) {
    if (!points || points.length < 3) {
      return this.generateLinearPath(points);
    }
    
    const n = points.length;
    const [firstPoint] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Calculate slopes
    const slopes = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      slopes[i] = (points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]);
    }
    
    // Calculate tangents using Fritsch-Carlson method
    const tangents = new Array(n);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    
    for (let i = 1; i < n - 1; i++) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        tangents[i] = 0;
      } else {
        const a = slopes[i - 1];
        const b = slopes[i];
        tangents[i] = 3 * (a + b) / ((2 * b + a) / a + (b + 2 * a) / b);
      }
    }
    
    // Generate the curve segments
    for (let i = 0; i < n - 1; i++) {
      const dx = (points[i + 1][0] - points[i][0]) / 3;
      
      const cp1x = points[i][0] + dx;
      const cp1y = points[i][1] + dx * tangents[i];
      
      const cp2x = points[i + 1][0] - dx;
      const cp2y = points[i + 1][1] - dx * tangents[i + 1];
      
      pathParts.push(
        `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1][0]},${points[i + 1][1]}`
      );
    }
    
    return pathParts.join(' ');
  }

  // ===== DATA PROCESSING METHODS =====
  
  /**
   * Convert data points to coordinate pairs using scales
   * @param {Array} data - Data array
   * @param {string} xField - X field name
   * @param {string} yField - Y field name
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of [x, y] coordinate pairs
   */
  static getDataPoints(data, xField, yField, scales) {
    console.log('PathGenerator.getDataPoints called with fields:', xField, yField);
    
    if (!data || !data.length) {
      console.log('No data provided to getDataPoints');
      return [];
    }
    
    if (!scales || !scales.x || !scales.y) {
      console.warn('No scales provided to getDataPoints');
      return [];
    }
    
    this.metrics.pathGenerations++;
    
    // Filter and map data to coordinate pairs
    const points = data
      .filter(d => {
        const xValue = d[xField];
        const yValue = d[yField];
        
        // Check for valid values
        return xValue !== undefined && 
               xValue !== null && 
               yValue !== undefined && 
               yValue !== null && 
               !isNaN(yValue);
      })
      .map(d => {
        const xValue = d[xField];
        const yValue = d[yField];
        
        // Convert to screen coordinates
        const x = scales.x.scale(xValue);
        const y = scales.y.scale(yValue);
        
        return [x, y];
      })
      .filter(([x, y]) => {
        // Filter out invalid coordinates
        return !isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y);
      });
    
    console.log('getDataPoints returned', points.length, 'valid points from', data.length, 'input points');
    return points;
  }

  /**
   * Get data points with caching for performance
   * @param {Array} data - Data array
   * @param {string} xField - X field name
   * @param {string} yField - Y field name
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of [x, y] coordinate pairs
   */
  static getDataPointsCached(data, xField, yField, scales) {
    // Generate cache key
    const cacheKey = this._generateCacheKey(data, xField, yField, scales);
    
    // Check cache
    if (this.pointCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.pointCache.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    // Generate points
    const points = this.getDataPoints(data, xField, yField, scales);
    
    // Cache with size limit
    this._cachePoints(cacheKey, points);
    
    return points;
  }

  // ===== PERFORMANCE OPTIMIZATION METHODS =====

  /**
   * Simplify path using Douglas-Peucker algorithm
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @param {number} tolerance - Simplification tolerance (default: 1.0)
   * @returns {Array} Simplified points array
   */
  static simplifyPath(points, tolerance = 1.0) {
    if (!points || points.length <= 2) return points;
    
    this.metrics.simplifications++;
    
    const douglasPeucker = (points, tolerance) => {
      if (points.length <= 2) return points;
      
      const [start, end] = [points[0], points[points.length - 1]];
      let maxDistance = 0;
      let maxIndex = 0;
      
      // Find the point with maximum distance from the line
      for (let i = 1; i < points.length - 1; i++) {
        const distance = this.getPerpendicularDistance(points[i], start, end);
        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = i;
        }
      }
      
      // If max distance is greater than tolerance, recursively simplify
      if (maxDistance > tolerance) {
        const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
        const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance);
        
        // Remove duplicate point at the junction
        return leftSegment.slice(0, -1).concat(rightSegment);
      } else {
        // All points are within tolerance, return just the endpoints
        return [start, end];
      }
    };
    
    return douglasPeucker(points, tolerance);
  }

  /**
   * Calculate perpendicular distance from point to line
   * @param {Array} point - [x, y] coordinate
   * @param {Array} lineStart - [x, y] coordinate of line start
   * @param {Array} lineEnd - [x, y] coordinate of line end
   * @returns {number} Perpendicular distance
   */
  static getPerpendicularDistance(point, lineStart, lineEnd) {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    if (dx === 0 && dy === 0) {
      // Line is actually a point
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    
    const numerator = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt(dx ** 2 + dy ** 2);
    
    return numerator / denominator;
  }

  // ===== RENDERER-SPECIFIC GENERATION METHODS =====

  /**
   * Generate path for specific renderer type
   * @private
   */
  static _generatePathForRenderer(points, curve, rendererType) {
    switch (rendererType) {
      case 'canvas':
        return this._generateCanvasInstructions(points, curve);
      case 'webgl':
        return this._generateWebGLBuffers(points, curve);
      case 'svg':
      default:
        return this._generateSVGPath(points, curve);
    }
  }

  /**
   * Generate area path for specific renderer type
   * @private
   */
  static _generateAreaPathForRenderer(points, baselineY, curve, rendererType) {
    switch (rendererType) {
      case 'canvas':
        return this._generateCanvasAreaInstructions(points, baselineY, curve);
      case 'webgl':
        return this._generateWebGLAreaBuffers(points, baselineY, curve);
      case 'svg':
      default:
        return this._generateSVGAreaPath(points, baselineY, curve);
    }
  }

  /**
   * Generate SVG path
   * @private
   */
  static _generateSVGPath(points, curve) {
    switch (curve) {
      case 'step':
        return this.generateStepPath(points);
      case 'cardinal':
        return this.generateCardinalPath(points);
      case 'monotone':
        return this.generateMonotonePath(points);
      case 'linear':
      default:
        return this.generateLinearPath(points);
    }
  }

  /**
   * Generate SVG area path
   * @private
   */
  static _generateSVGAreaPath(points, baselineY, curve) {
    if (points.length === 0) return '';
    
    // Generate line path first
    const linePath = this._generateSVGPath(points, curve);
    
    if (!linePath) return '';
    
    // Complete the area path
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const firstX = firstPoint[0];
    const lastX = lastPoint[0];

    // Create closed area path: line path + bottom edge + close
    return `${linePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
  }

  /**
   * Generate Canvas drawing instructions
   * @private
   */
  static _generateCanvasInstructions(points, curve) {
    if (points.length === 0) return [];
    
    const instructions = [];
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    // Start path
    instructions.push({ type: 'beginPath' });
    instructions.push({ type: 'moveTo', x: firstX, y: firstY });
    
    // Add path segments based on curve type
    switch (curve) {
      case 'step':
        restPoints.forEach(([x, y]) => {
          instructions.push({ type: 'lineTo', x: x, y: firstY }); // Horizontal
          instructions.push({ type: 'lineTo', x: x, y: y });      // Vertical
        });
        break;
        
      case 'linear':
      default:
        restPoints.forEach(([x, y]) => {
          instructions.push({ type: 'lineTo', x: x, y: y });
        });
        break;
        
      // Note: Cardinal and monotone curves would require more complex Canvas API calls
    }
    
    return instructions;
  }

  /**
   * Generate Canvas area drawing instructions
   * @private
   */
  static _generateCanvasAreaInstructions(points, baselineY, curve) {
    if (points.length === 0) return [];
    
    const instructions = this._generateCanvasInstructions(points, curve);
    const [firstPoint] = points;
    const [lastPoint] = points[points.length - 1];
    const [firstX] = firstPoint;
    const [lastX] = lastPoint;
    
    // Close the area
    instructions.push({ type: 'lineTo', x: lastX, y: baselineY });
    instructions.push({ type: 'lineTo', x: firstX, y: baselineY });
    instructions.push({ type: 'closePath' });
    
    return instructions;
  }

  /**
   * Generate WebGL vertex buffers
   * @private
   */
  static _generateWebGLBuffers(points, curve) {
    if (points.length === 0) return { vertices: [], indices: [] };
    
    const vertices = [];
    const indices = [];
    
    // For WebGL, we'll convert curves to line segments
    // More complex curves would require tessellation
    
    points.forEach(([x, y], index) => {
      vertices.push(x, y);
      
      if (index > 0) {
        indices.push(index - 1, index);
      }
    });
    
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      primitiveType: 'LINES',
      vertexCount: points.length
    };
  }

  /**
   * Generate WebGL area buffers (triangulated)
   * @private
   */
  static _generateWebGLAreaBuffers(points, baselineY, curve) {
    if (points.length === 0) return { vertices: [], indices: [] };
    
    const vertices = [];
    const indices = [];
    
    // Create vertices for triangulation
    points.forEach(([x, y]) => {
      vertices.push(x, y);           // Top vertex
      vertices.push(x, baselineY);   // Bottom vertex
    });
    
    // Create triangle indices
    for (let i = 0; i < points.length - 1; i++) {
      const topLeft = i * 2;
      const bottomLeft = i * 2 + 1;
      const topRight = (i + 1) * 2;
      const bottomRight = (i + 1) * 2 + 1;
      
      // Two triangles per segment
      indices.push(topLeft, bottomLeft, topRight);
      indices.push(topRight, bottomLeft, bottomRight);
    }
    
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      primitiveType: 'TRIANGLES',
      vertexCount: vertices.length / 2
    };
  }

  /**
   * Generate area coordinates
   * @private
   */
  static _generateAreaCoordinates(points, baselineY) {
    if (points.length === 0) return [];
    
    const areaPoints = [...points];
    
    // Add baseline points to close the area
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const firstX = firstPoint[0];
    const lastX = lastPoint[0];

    areaPoints.push([lastX, baselineY]);
    areaPoints.push([firstX, baselineY]);
    
    return areaPoints;
  }

  // ===== OPTIMIZATION METHODS =====

  /**
   * Optimize points for specific renderer
   * @private
   */
  static _optimizePointsForRenderer(points, rendererType, options) {
    if (points.length === 0) return points;
    
    let optimizedPoints = points;
    
    // Apply simplification for performance
    if (rendererType === 'webgl' && points.length > 10000) {
      // Aggressive simplification for WebGL with very large datasets
      optimizedPoints = this.simplifyPath(points, 2.0);
    } else if (rendererType === 'canvas' && points.length > 5000) {
      // Moderate simplification for Canvas
      optimizedPoints = this.simplifyPath(points, 1.0);
    } else if (rendererType === 'svg' && points.length > 1000) {
      // Light simplification for SVG
      optimizedPoints = this.simplifyPath(points, 0.5);
    }
    
    return optimizedPoints;
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Generate cache key for points
   * @private
   */
  static _generateCacheKey(data, xField, yField, scales) {
    // Create a simple hash based on data characteristics
    const dataHash = data.length + JSON.stringify(data[0] || {}).slice(0, 50);
    const scaleHash = `${scales.x.domain().join('-')}_${scales.y.domain().join('-')}`;
    return `${xField}_${yField}_${dataHash}_${scaleHash}`.slice(0, 64);
  }

  /**
   * Cache points with size management
   * @private
   */
  static _cachePoints(key, points) {
    // Manage cache size
    if (this.pointCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.pointCache.keys()).slice(0, Math.floor(this.maxCacheSize / 2));
      keysToDelete.forEach(k => this.pointCache.delete(k));
    }
    
    this.pointCache.set(key, points);
  }

  // ===== UTILITY METHODS =====

  /**
   * Get available curve types
   * @returns {Array} Array of supported curve type strings
   */
  static getSupportedCurveTypes() {
    return ['linear', 'step', 'cardinal', 'monotone'];
  }

  /**
   * Validate curve type
   * @param {string} curveType - Curve type to validate
   * @returns {boolean} True if curve type is supported
   */
  static isValidCurveType(curveType) {
    return this.getSupportedCurveTypes().includes(curveType);
  }

  /**
   * Get default curve type
   * @returns {string} Default curve type
   */
  static getDefaultCurveType() {
    return 'linear';
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  static getPerformanceMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.pointCache.size,
      pathCacheSize: this.pathCache.size,
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }

  /**
   * Clear caches
   */
  static clearCaches() {
    this.pointCache.clear();
    this.pathCache.clear();
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      pathGenerations: 0,
      simplifications: 0
    };
    console.log('PathGenerator caches cleared');
  }

  /**
   * Generate path for multiple datasets (useful for panel rendering)
   * @param {Array} datasets - Array of datasets
   * @param {Object} chart - Chart instance
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of path definitions
   */
  static generateMultipleLinePaths(datasets, chart, scales = null) {
    console.log('PathGenerator.generateMultipleLinePaths called for', datasets.length, 'datasets');
    
    return this.batchGeneratePaths(datasets, chart, 'svg', scales);
  }
}
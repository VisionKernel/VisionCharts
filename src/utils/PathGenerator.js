/**
 * PathGenerator - Centralized SVG path generation utility
 * Handles line and area path generation with various interpolation methods
 */
export default class PathGenerator {
  
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
    
    // Generate path based on curve type
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
    
    // Get the line path first
    const linePath = this.generateLinePath(data, chart, scales);
    
    if (!linePath) {
      console.log('No line path available for area generation');
      return '';
    }
    
    const { xField, yField } = chart.options;
    const points = this.getDataPoints(data, xField, yField, chartScales);
    
    if (points.length === 0) {
      return '';
    }
    
    // Get the baseline Y position (usually zero or bottom of chart)
    const baselineY = chartScales.y.scale(0);
    
    // Complete the area path
    const [firstPoint] = points;
    const [lastPoint] = [...points].reverse();
    const [firstX] = firstPoint;
    const [lastX] = lastPoint;
    
    // Create closed area path: line path + bottom edge + close
    const areaPath = `${linePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
    
    console.log('Area path generated, length:', areaPath.length);
    return areaPath;
  }
  
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
      
      // Calculate control points
      const [cp1, cp2] = getControlPoints(prev, current, next, tension);
      
      // Add cubic bezier curve segment
      pathParts.push(
        `C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${current[0]},${current[1]}`
      );
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate monotone cubic interpolation path
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @returns {string} SVG path definition
   */
  static generateMonotonePath(points) {
    if (!points || points.length < 3) {
      return this.generateLinearPath(points);
    }
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    // Start with move to first point
    const pathParts = [`M ${firstX},${firstY}`];
    
    const n = points.length;
    const tangents = new Array(n);
    
    // Calculate slopes for each segment
    for (let i = 0; i < n - 1; i++) {
      const dx = points[i + 1][0] - points[i][0];
      if (dx !== 0) {
        tangents[i] = (points[i + 1][1] - points[i][1]) / dx;
      } else {
        tangents[i] = 0;
      }
    }
    
    // Set the slope at each point to preserve monotonicity
    tangents[n - 1] = tangents[n - 2] || 0;
    
    for (let i = 1; i < n - 1; i++) {
      if (tangents[i - 1] * tangents[i] <= 0) {
        tangents[i] = 0;
      } else {
        const a = tangents[i - 1];
        const b = tangents[i];
        // Harmonic mean to preserve monotonicity
        tangents[i] = Math.abs(a) < Math.abs(b) ? a : b;
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
   * Generate path for multiple datasets (useful for panel rendering)
   * @param {Array} datasets - Array of datasets
   * @param {Object} chart - Chart instance
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of path definitions
   */
  static generateMultipleLinePaths(datasets, chart, scales = null) {
    console.log('PathGenerator.generateMultipleLinePaths called for', datasets.length, 'datasets');
    
    return datasets.map(dataset => {
      if (!dataset.data || !dataset.data.length) {
        return '';
      }
      
      return this.generateLinePath(dataset.data, chart, scales);
    });
  }
  
  /**
   * Generate path for multiple area datasets
   * @param {Array} datasets - Array of datasets
   * @param {Object} chart - Chart instance
   * @param {Object} scales - Chart scales
   * @returns {Array} Array of area path definitions
   */
  static generateMultipleAreaPaths(datasets, chart, scales = null) {
    console.log('PathGenerator.generateMultipleAreaPaths called for', datasets.length, 'datasets');
    
    return datasets.map(dataset => {
      if (!dataset.data || !dataset.data.length) {
        return '';
      }
      
      return this.generateAreaPath(dataset.data, chart, scales);
    });
  }
  
  /**
   * Get path bounds (bounding box)
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @returns {Object} Bounding box with min/max x/y values
   */
  static getPathBounds(points) {
    if (!points || points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    points.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    
    return {
      minX: isFinite(minX) ? minX : 0,
      maxX: isFinite(maxX) ? maxX : 0,
      minY: isFinite(minY) ? minY : 0,
      maxY: isFinite(maxY) ? maxY : 0
    };
  }
  
  /**
   * Simplify path by removing redundant points (Douglas-Peucker algorithm)
   * @param {Array} points - Array of [x, y] coordinate pairs
   * @param {number} tolerance - Simplification tolerance
   * @returns {Array} Simplified points array
   */
  static simplifyPath(points, tolerance = 1.0) {
    if (!points || points.length <= 2) {
      return points;
    }
    
    // Douglas-Peucker line simplification algorithm
    const douglasPeucker = (points, tolerance) => {
      if (points.length <= 2) {
        return points;
      }
      
      // Find the point with the maximum distance from the line
      let maxDistance = 0;
      let maxIndex = 0;
      const start = points[0];
      const end = points[points.length - 1];
      
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
   * @private
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
}
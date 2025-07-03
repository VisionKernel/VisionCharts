/**
 * CoordinateSystem - Multi-Renderer Coordinate Normalization
 * 
 * Provides unified coordinate transformation and normalization across
 * SVG, Canvas, and WebGL rendering backends, ensuring consistent
 * positioning, scaling, and event handling.
 */

export class CoordinateSystem {
  constructor(config = {}) {
    this.chartArea = config.chartArea || { x: 0, y: 0, width: 400, height: 300 };
    this.canvasSize = config.canvasSize || { width: 800, height: 600 };
    this.devicePixelRatio = config.devicePixelRatio || window.devicePixelRatio || 1;
    
    // Coordinate spaces
    this.spaces = {
      // Data space: raw data values
      data: 'data',
      // Screen space: pixel coordinates (Canvas/SVG style)
      screen: 'screen', 
      // Normalized space: 0-1 coordinates
      normalized: 'normalized',
      // Clip space: -1 to 1 (WebGL style)
      clip: 'clip'
    };
  }
  
  /**
   * Update chart area and canvas size
   */
  updateDimensions(chartArea, canvasSize) {
    this.chartArea = chartArea;
    this.canvasSize = canvasSize;
    return this;
  }
  
  /**
   * Convert data coordinates to screen coordinates (pixels)
   * This is what Canvas renderer expects
   */
  dataToScreen(dataX, dataY, scales) {
    const screenX = scales.x.scale(dataX);
    const screenY = scales.y.scale(dataY);
    
    // Debug logging for first few points
    if (Math.random() < 0.001) { // Log ~0.1% of points
      console.log('Screen coordinate debug:', {
        data: [dataX, dataY],
        screen: [screenX, screenY],
        chartArea: this.chartArea,
        scaleRanges: {
          x: scales.x.range,
          y: scales.y.range
        }
      });
    }
    
    return { x: screenX, y: screenY };
  }
  
  /**
   * Convert screen coordinates to normalized coordinates (0-1)
   */
  screenToNormalized(screenX, screenY) {
    // Always use logical canvas size, not physical size affected by device pixel ratio
    const normalizedX = screenX / this.canvasSize.width;
    const normalizedY = screenY / this.canvasSize.height;
    
    return { x: normalizedX, y: normalizedY };
  }
  
  /**
   * Convert normalized coordinates to clip space (-1 to 1)
   * This is what WebGL expects
   */
  normalizedToClip(normalizedX, normalizedY) {
    // Convert from 0-1 to -1 to 1
    const clipX = (normalizedX * 2.0) - 1.0;
    // Flip Y axis for WebGL (Canvas has Y down, WebGL has Y up)
    const clipY = -((normalizedY * 2.0) - 1.0);
    
    return { x: clipX, y: clipY };
  }
  
  /**
   * Convert data coordinates directly to clip space (for WebGL)
   * This combines all transformations in one step
   */
  dataToClip(dataX, dataY, scales) {
    // Step 1: Data to screen
    const screen = this.dataToScreen(dataX, dataY, scales);
    
    // Step 2: Screen to normalized
    const normalized = this.screenToNormalized(screen.x, screen.y);
    
    // Step 3: Normalized to clip
    const clip = this.normalizedToClip(normalized.x, normalized.y);
    
    // Debug logging for first few points
    if (Math.random() < 0.001) { // Log ~0.1% of points
      console.log('Coordinate transform debug:', {
        data: [dataX, dataY],
        screen: [screen.x, screen.y],
        normalized: [normalized.x, normalized.y],
        clip: [clip.x, clip.y],
        canvasSize: this.canvasSize
      });
    }
    
    return clip;
  }
  
  /**
   * Convert data coordinates directly to screen space (for Canvas)
   * This is a pass-through since Canvas uses screen coordinates
   */
  dataToCanvas(dataX, dataY, scales) {
    return this.dataToScreen(dataX, dataY, scales);
  }
  
  /**
   * Batch convert array of data points to screen coordinates
   * Optimized for Canvas renderer
   */
  batchDataToScreen(dataPoints, scales, xField = 'x', yField = 'y') {
    return dataPoints.map(point => {
      const dataX = this._getFieldValue(point, xField);
      const dataY = this._getFieldValue(point, yField);
      
      if (dataX == null || dataY == null) {
        return { x: null, y: null, original: point };
      }
      
      const screen = this.dataToScreen(dataX, dataY, scales);
      return {
        x: screen.x,
        y: screen.y,
        original: point
      };
    });
  }
  
  /**
   * Batch convert array of data points to clip coordinates
   * Optimized for WebGL renderer
   */
  batchDataToClip(dataPoints, scales, xField = 'x', yField = 'y') {
    return dataPoints.map(point => {
      const dataX = this._getFieldValue(point, xField);
      const dataY = this._getFieldValue(point, yField);
      
      if (dataX == null || dataY == null) {
        return { x: null, y: null, original: point };
      }
      
      const clip = this.dataToClip(dataX, dataY, scales);
      return {
        x: clip.x,
        y: clip.y,
        original: point
      };
    });
  }
  
  /**
   * Get field value from data point, handling different field formats
   */
  _getFieldValue(point, field) {
    let value = point[field];
    
    // Handle Date objects and timestamps for time fields
    if (value instanceof Date) {
      return value.getTime();
    }
    
    if (typeof value === 'string' && (field === 'x' || field === 'date')) {
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime())) {
        return dateValue.getTime();
      }
    }
    
    // Handle alternative field names
    if (value == null) {
      if (field === 'x') {
        value = point.date || point.time || point.timestamp;
      } else if (field === 'y') {
        value = point.value || point.price || point.amount;
      }
    }
    
    return typeof value === 'number' ? value : null;
  }
  
  /**
   * Transform datasets for specific renderer
   */
  transformDatasetsForRenderer(datasets, scales, rendererType, xField = 'x', yField = 'y') {
    const transformedDatasets = [];
    
    for (const dataset of datasets) {
      if (!dataset.data || !Array.isArray(dataset.data)) {
        transformedDatasets.push(dataset);
        continue;
      }
      
      let transformedPoints;
      
      switch (rendererType) {
        case 'canvas':
          transformedPoints = this.batchDataToScreen(dataset.data, scales, xField, yField);
          break;
          
        case 'webgl':
          // WebGL now also uses screen coordinates - shader handles clip space conversion
          transformedPoints = this.batchDataToScreen(dataset.data, scales, xField, yField);
          break;
          
        case 'svg':
          // SVG uses screen coordinates like Canvas
          transformedPoints = this.batchDataToScreen(dataset.data, scales, xField, yField);
          break;
          
        default:
          console.warn(`Unknown renderer type: ${rendererType}`);
          transformedPoints = dataset.data;
      }
      
      transformedDatasets.push({
        ...dataset,
        data: transformedPoints
      });
    }
    
    return transformedDatasets;
  }
  
  /**
   * Check if coordinates are valid
   */
  isValidCoordinate(x, y) {
    return x != null && y != null && !isNaN(x) && !isNaN(y);
  }
  
  /**
   * Clamp coordinates to valid ranges
   */
  clampScreenCoordinates(x, y) {
    const clampedX = Math.max(0, Math.min(this.canvasSize.width, x));
    const clampedY = Math.max(0, Math.min(this.canvasSize.height, y));
    return { x: clampedX, y: clampedY };
  }
  
  /**
   * Clamp clip coordinates to valid ranges
   */
  clampClipCoordinates(x, y) {
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    return { x: clampedX, y: clampedY };
  }
  
  /**
   * Get coordinate space info for debugging
   */
  getCoordinateSpaceInfo() {
    return {
      chartArea: this.chartArea,
      canvasSize: this.canvasSize,
      devicePixelRatio: this.devicePixelRatio,
      supportedSpaces: Object.values(this.spaces)
    };
  }
}

/**
 * Factory function to create coordinate system
 */
export function createCoordinateSystem(chartArea, canvasSize, devicePixelRatio) {
  return new CoordinateSystem({
    chartArea,
    canvasSize,
    devicePixelRatio
  });
}
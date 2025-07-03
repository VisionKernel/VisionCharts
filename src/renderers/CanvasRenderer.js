import AbstractRenderer from './AbstractRenderer.js';

/**
 * CanvasRenderer - HTML5 Canvas implementation of AbstractRenderer
 * 
 * Primary renderer for VisionCharts, optimized for datasets up to 50K points.
 * Provides excellent performance and broad browser compatibility.
 */
export default class CanvasRenderer extends AbstractRenderer {
  constructor(config = {}) {
    super(config);
    
    this.canvas = null;
    this.ctx = null;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Canvas-specific options
    this.options = {
      antialias: true,
      imageSmoothingEnabled: true,
      lineJoin: 'round',
      lineCap: 'round',
      ...config
    };
    
    console.log('CanvasRenderer created for mid-range datasets');
  }

  /**
   * Initialize Canvas 2D context
   */
  async initialize(canvas, dimensions) {
    try {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Set up high DPI support
      this._setupHighDPI(dimensions);
      
      // Configure canvas context
      this._configureContext();

      this.isInitialized = true;
      console.log('CanvasRenderer initialization complete');

    } catch (error) {
      console.error('Canvas initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up high DPI support
   */
  _setupHighDPI(dimensions) {
    const ratio = this.devicePixelRatio;
    
    // Set actual canvas size in memory (scaled up)
    this.canvas.width = dimensions.width * ratio;
    this.canvas.height = dimensions.height * ratio;
    
    // Scale CSS size back to normal
    this.canvas.style.width = dimensions.width + 'px';
    this.canvas.style.height = dimensions.height + 'px';
    
    // Scale the context to ensure correct drawing operations
    this.ctx.scale(ratio, ratio);
    
    console.log(`Canvas high DPI setup: ${dimensions.width}x${dimensions.height} @ ${ratio}x`);
  }

  /**
   * Configure canvas context with optimal settings
   */
  _configureContext() {
    const ctx = this.ctx;
    
    // Set anti-aliasing
    ctx.imageSmoothingEnabled = this.options.imageSmoothingEnabled;
    
    // Set line styles
    ctx.lineJoin = this.options.lineJoin;
    ctx.lineCap = this.options.lineCap;
    
    // Set compositing
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Clear the canvas
   */
  clear() {
    if (!this.isInitialized) return;
    
    const canvas = this.canvas;
    const ratio = this.devicePixelRatio;
    
    // Clear the entire canvas (accounting for device pixel ratio)
    this.ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
  }

  /**
   * Set viewport (for clipping)
   */
  setViewport(viewport) {
    if (!this.isInitialized) return;
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    this.ctx.clip();
  }

  /**
     * Render line paths using standardized path data from PathGenerator
     */
    async renderLines(generatedPaths, scales, options = {}) {
    if (!this.isInitialized || !generatedPaths || generatedPaths.length === 0) {
        return;
    }

    const ctx = this.ctx;
    
    try {
        ctx.save();
        
        // Render each standardized path
        for (let i = 0; i < generatedPaths.length; i++) {
        const pathData = generatedPaths[i];
        if (!pathData.vertices || pathData.vertices.length === 0) continue;
        
        await this._renderStandardizedPath(ctx, pathData, options, i);
        }
        
    } catch (error) {
        console.error('Error rendering lines with Canvas:', error);
    } finally {
        ctx.restore();
    }
    }

    /**
     * Render a single standardized path
     */
    async _renderStandardizedPath(ctx, pathData, options, pathIndex) {
    // Set line style from path data
    ctx.strokeStyle = this._formatColorForCanvas(pathData.color) || this._getDefaultColor(pathIndex);
    ctx.lineWidth = pathData.lineWidth || 2;
    ctx.globalAlpha = 1.0; // Could be made configurable

    // Begin path
    ctx.beginPath();

    const vertices = pathData.vertices;
    if (vertices.length === 0) return;

    // Use standardized vertices directly - no coordinate transformation needed!
    ctx.moveTo(vertices[0].x, vertices[0].y);

    for (let i = 1; i < vertices.length; i++) {
        const vertex = vertices[i];
        ctx.lineTo(vertex.x, vertex.y);

        // Yield control periodically for large paths
        if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Stroke the path
    ctx.stroke();

    // Draw points if enabled
    if (options.showPoints) {
        await this._renderPathPoints(ctx, pathData, options);
    }

    console.log(`Rendered standardized path with ${vertices.length} vertices using Canvas`);
    }

    /**
     * Render points for a standardized path
     */
    async _renderPathPoints(ctx, pathData, options) {
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle; // Use same color as line

    const pointRadius = options.pointRadius || 3;
    const vertices = pathData.vertices;

    for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        
        ctx.beginPath();
        ctx.arc(vertex.x, vertex.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Yield control periodically
        if (i % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    ctx.restore();
    }

    /**
     * Format color for Canvas context
     */
    _formatColorForCanvas(color) {
    if (typeof color === 'string') {
        return color; // Already in hex format
    }
    
    if (color && typeof color === 'object' && 'r' in color) {
        // Convert normalized RGBA to CSS format
        const r = Math.round(color.r * 255);
        const g = Math.round(color.g * 255);
        const b = Math.round(color.b * 255);
        const a = color.a || 1.0;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    
    return null;
    }


  /**
   * Render bar datasets
   */
  async renderBars(datasets, scales, options = {}) {
    if (!this.isInitialized || !datasets || datasets.length === 0) {
      return;
    }

    const ctx = this.ctx;
    
    try {
      ctx.save();
      
      // Calculate bar dimensions
      const barInfo = this._calculateBarDimensions(datasets, scales, options);
      
      // Render each dataset
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        if (!dataset.data || dataset.data.length === 0) continue;
        
        await this._renderBarDataset(ctx, dataset, scales, options, barInfo, i);
      }
      
    } catch (error) {
      console.error('Error rendering bars with Canvas:', error);
    } finally {
      ctx.restore();
    }
  }

  /**
   * Render a single bar dataset
   */
  async _renderBarDataset(ctx, dataset, scales, options, barInfo, datasetIndex) {
    // Set bar style
    ctx.fillStyle = dataset.color || this._getDefaultColor(datasetIndex);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.globalAlpha = dataset.opacity || 1.0;
    
    let barCount = 0;
    
    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
      const x = this._getXValue(point, scales);
      const y = this._getYValue(point, scales);
      
      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }
      
      this._renderBar(ctx, x, y, barInfo, datasetIndex, i, scales);
      
      barCount++;
      
      // Yield control periodically
      if (barCount % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.log(`Rendered bar dataset with ${barCount} bars using Canvas`);
  }

  /**
   * Render a single bar
   */
  _renderBar(ctx, x, y, barInfo, datasetIndex, pointIndex, scales) {
  // Calculate bar position and size
  const barX = x - (barInfo.width / 2);
  
  // FIXED: Use bottom of chart area as baseline for bars
  // This works correctly with financial data that doesn't include 0
  const chartBottom = scales.y.range[0]; // Bottom of chart area
  const baselineY = chartBottom;
  const barHeight = Math.abs(y - baselineY);
  const barY = Math.min(y, baselineY);
  
  // Handle multiple datasets - offset bars horizontally
  const totalDatasets = barInfo.totalDatasets;
  let adjustedBarX = barX;
  let adjustedBarWidth = barInfo.width;
  
  if (totalDatasets > 1) {
    adjustedBarWidth = barInfo.width / totalDatasets;
    adjustedBarX = barX + (datasetIndex * adjustedBarWidth);
  }
  
  // Ensure minimum bar height for visibility
  const minBarHeight = Math.max(barHeight, 1);
  
  // DEBUG: Log first few bars to verify coordinates
  if (pointIndex < 3) {
    console.log('Bar render:', {
      pointIndex,
      x, y,
      baselineY,
      barHeight,
      barY,
      barWidth: adjustedBarWidth,
      chartBottom,
      chartTop: scales.y.range[1]
    });
  }
  
  // Draw the bar
  ctx.fillRect(
    Math.round(adjustedBarX),
    Math.round(barY),
    Math.round(adjustedBarWidth),
    Math.round(minBarHeight)
  );
  
  // Optional: Add border
  if (barInfo.showBorder) {
    ctx.strokeRect(
      Math.round(adjustedBarX),
      Math.round(barY),
      Math.round(adjustedBarWidth),
      Math.round(minBarHeight)
    );
  }
}

  /**
   * Calculate bar dimensions
   */
  _calculateBarDimensions(datasets, scales, options) {
  const firstDataset = datasets[0];
  if (!firstDataset || !firstDataset.data || firstDataset.data.length === 0) {
    return { width: 10, spacing: 2, totalDatasets: datasets.length, showBorder: false };
  }

  const data = firstDataset.data;
  const barWidth = options.barWidth || 0.7;
  const barSpacing = options.barSpacing || 0.1;

  // For time series data, calculate based on pixel differences between points
  if (data.length > 1) {
    // Use pre-calculated screen coordinates for accurate spacing
    const screenXValues = data
      .map(point => point.screenX)
      .filter(x => x != null && isFinite(x))
      .sort((a, b) => a - b);

    if (screenXValues.length > 1) {
      // Calculate average pixel distance between consecutive points
      let totalDiff = 0;
      for (let i = 1; i < screenXValues.length; i++) {
        totalDiff += screenXValues[i] - screenXValues[i - 1];
      }
      const avgPixelDistance = totalDiff / (screenXValues.length - 1);

      // Calculate bar width based on available space
      const calculatedWidth = Math.max(avgPixelDistance * barWidth, 1);
      
      return {
        width: calculatedWidth,
        spacing: avgPixelDistance * barSpacing,
        totalDatasets: datasets.length,
        showBorder: options.showBorder || false
      };
    }
  }

  // Fallback for edge cases
  return {
    width: 20,
    spacing: 4,
    totalDatasets: datasets.length,
    showBorder: options.showBorder || false
  };
}

  /**
   * Get default color for dataset by index
   */
  _getDefaultColor(index) {
    const colors = [
      '#1468a8', // Blue
      '#34A853', // Green
      '#FBBC05', // Yellow
      '#EA4335', // Red
      '#9C27B0', // Purple
      '#00ACC1', // Cyan
      '#FF9800', // Orange
      '#607D8B'  // Blue Grey
    ];

    return colors[index % colors.length];
  }

  /**
   * Update with new datasets
   */
  update(datasets) {
    console.log('Canvas renderer update - will re-render on next render call');
    // Canvas doesn't need special update handling - just re-render
  }

  /**
   * Get supported features
   */
  getSupportedFeatures() {
    return [
      'lines',
      'bars',
      'points',
      'curves',
      'anti-aliasing',
      'transparency',
      'gradients',
      'patterns',
      'text-rendering'
    ];
  }

  /**
   * Get performance profile
   */
  getPerformanceProfile() {
    return {
      maxDataPoints: 50000,
      renderingType: 'canvas2d',
      gpuAccelerated: false,
      memoryUsage: 'medium',
      idealDatasetSize: 10000,
      supportsText: true,
      supportsPatterns: true
    };
  }

  /**
   * Check Canvas 2D support
   */
  static isSupported() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Destroy and cleanup resources
   */
  destroy() {
    if (this.ctx) {
      // Clear any pending operations
      this.ctx.restore();
      this.ctx = null;
    }
    
    this.canvas = null;
    super.destroy();
    console.log('CanvasRenderer destroyed');
  }
}
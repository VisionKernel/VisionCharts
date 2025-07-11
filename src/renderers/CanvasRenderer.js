import AbstractRenderer from './AbstractRenderer.js';

/**
 * CanvasRenderer - HTML5 Canvas implementation (Updated for Unified Coordinates)
 * 
 * Primary renderer for VisionCharts, optimized for datasets up to 50K points.
 * NOW WORKS WITH UNIFIED COORDINATE SYSTEM - consistent with WebGL rendering!
 */
export default class CanvasRenderer extends AbstractRenderer {
  constructor(config = {}) {
    super(config);
    
    this.canvas = null;
    this.ctx = null;
    
    // UPDATED: Standardized DPI handling to match WebGL
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.logicalWidth = 800;
    this.logicalHeight = 600;
    
    // Canvas-specific options
    this.options = {
      antialias: true,
      imageSmoothingEnabled: true,
      lineJoin: 'round',
      lineCap: 'round',
      ...config
    };
    
    console.log('CanvasRenderer created with unified coordinate system support');
  }

  /**
   * UPDATED: Initialize Canvas 2D context with standardized DPI handling
   */
  async initialize(canvas, dimensions) {
    try {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // UPDATED: Standardized DPI handling to match WebGL approach
      this._setupStandardizedDPI(dimensions);
      
      // Configure canvas context
      this._configureContext();

      this.isInitialized = true;
      console.log('CanvasRenderer initialization complete with unified coordinate system');

    } catch (error) {
      console.error('Canvas initialization failed:', error);
      throw error;
    }
  }

  /**
   * UPDATED: Set up standardized DPI support to match WebGL
   */
  _setupStandardizedDPI(dimensions) {
    // Store logical dimensions (coordinate system uses these)
    this.logicalWidth = dimensions.width;
    this.logicalHeight = dimensions.height;
    
    // UPDATED: Standardized DPI handling to match WebGL approach
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Set actual canvas size in memory (scaled up for high DPI)
    this.canvas.width = dimensions.width * this.devicePixelRatio;
    this.canvas.height = dimensions.height * this.devicePixelRatio;
    
    // Scale CSS size back to logical dimensions
    this.canvas.style.width = dimensions.width + 'px';
    this.canvas.style.height = dimensions.height + 'px';
    
    // UPDATED: Scale the context to ensure correct drawing operations
    // This handles the DPI scaling for all drawing operations
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    
    console.log(`Canvas standardized DPI setup: ${this.logicalWidth}x${this.logicalHeight} @ ${this.devicePixelRatio}x`);
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
    
    // UPDATED: Clear using logical dimensions (DPI scaling handled by context)
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
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
   * UPDATED: Render line paths with fill support using unified coordinate system
   */
  async renderLines(generatedPaths, scales, options = {}) {
    if (!this.isInitialized || !generatedPaths || generatedPaths.length === 0) {
      return;
    }

    const ctx = this.ctx;
    
    try {
      ctx.save();
      
      // NEW: Render fills first (so lines appear on top)
      if (options.enableFill) {
        for (let i = 0; i < generatedPaths.length; i++) {
          const pathData = generatedPaths[i];
          if (pathData.fill && pathData.vertices && pathData.vertices.length > 0) {
            await this._renderUnifiedFill(ctx, pathData, options, scales, i);
          }
        }
      }
      
      // Then render lines on top
      for (let i = 0; i < generatedPaths.length; i++) {
        const pathData = generatedPaths[i];
        if (!pathData.vertices || pathData.vertices.length === 0) continue;
        
        await this._renderUnifiedPath(ctx, pathData, options, i);
      }
      
      console.log(`Canvas rendered ${generatedPaths.length} paths with fill support`);
      
    } catch (error) {
      console.error('Error rendering lines with Canvas:', error);
    } finally {
      ctx.restore();
    }
  }

  /**
   * NEW: Render area fill for a unified path
   */
  async _renderUnifiedFill(ctx, pathData, options, scales, pathIndex) {
    const vertices = pathData.vertices;
    if (vertices.length < 2) return; // Need at least 2 points for area

    // SIMPLIFIED: Use pathData color directly or fallback
    const fillColor = pathData.color || '#1468a8';
    const fillOpacity = pathData.fillOpacity || options.fillOpacity || 0.3;
    
    // Parse color and apply opacity
    const colorMatch = fillColor.match(/rgba?\(([^)]+)\)/);
    if (colorMatch) {
      const colorParts = colorMatch[1].split(',').map(c => c.trim());
      ctx.fillStyle = `rgba(${colorParts[0]}, ${colorParts[1]}, ${colorParts[2]}, ${fillOpacity})`;
    } else if (fillColor.startsWith('#')) {
      // Convert hex to rgba
      const hex = fillColor.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
    } else {
      ctx.fillStyle = `rgba(20, 104, 168, ${fillOpacity})`; // Fallback with opacity
    }

    // Begin fill path
    ctx.beginPath();

    // Get chart bottom (where fill should end)
    const chartBottom = scales.y.range[1]; // Bottom of Y scale range

    // Start from first point
    const firstPoint = this._convertUnifiedToCanvas(vertices[0]);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    // Draw line through all points
    for (let i = 1; i < vertices.length; i++) {
      const point = this._convertUnifiedToCanvas(vertices[i]);
      ctx.lineTo(point.x, point.y);

      // Yield control periodically for large paths
      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Close the area by going to bottom-right, then bottom-left
    const lastPoint = this._convertUnifiedToCanvas(vertices[vertices.length - 1]);
    const firstPointConverted = this._convertUnifiedToCanvas(vertices[0]);
    
    ctx.lineTo(lastPoint.x, chartBottom);    // Down to bottom
    ctx.lineTo(firstPointConverted.x, chartBottom); // Across bottom
    ctx.closePath();

    // Fill the area
    ctx.fill();

    console.log(`Canvas rendered fill area with ${vertices.length} vertices and ${fillOpacity} opacity`);
  }

  /**
   * UPDATED: Render a single path using unified coordinate system - SIMPLIFIED COLORS
   */
  async _renderUnifiedPath(ctx, pathData, options, pathIndex) {
    // SIMPLIFIED: Use pathData color directly or fallback to default blue
    const color = pathData.color || '#1468a8';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = pathData.lineWidth || 2;
    ctx.globalAlpha = 1.0; // Could be made configurable

    // Begin path
    ctx.beginPath();

    const vertices = pathData.vertices;
    if (vertices.length === 0) return;

    // Use vertex coordinates directly (unified coordinate system)
    const canvasCoords = this._convertUnifiedToCanvas(vertices[0]);
    ctx.moveTo(canvasCoords.x, canvasCoords.y);

    for (let i = 1; i < vertices.length; i++) {
      const vertex = vertices[i];
      const canvasCoords = this._convertUnifiedToCanvas(vertex);
      ctx.lineTo(canvasCoords.x, canvasCoords.y);

      // Yield control periodically for large paths
      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Stroke the path
    ctx.stroke();

    // Draw points if enabled
    if (options.showPoints) {
      await this._renderUnifiedPathPoints(ctx, pathData, options);
    }

    console.log(`Canvas rendered unified path with ${vertices.length} vertices using color ${color}`);
  }

  /**
   * NEW: Convert unified coordinates to Canvas coordinate system
   */
  _convertUnifiedToCanvas(vertex) {
    // UNIFIED COORDINATES come as bottom-left origin, Y-up (mathematical)
    // CANVAS COORDINATES need top-left origin, Y-down
    
    // Since the CoordinateSystem already handles this conversion when creating
    // unified coordinates, we can use them directly for Canvas.
    // The unified coordinate system is designed to work with Canvas's coordinate system.
    
    return {
      x: vertex.x,
      y: vertex.y
    };
  }

  /**
   * UPDATED: Render points for a unified path
   */
  async _renderUnifiedPathPoints(ctx, pathData, options) {
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle; // Use same color as line

    const pointRadius = options.pointRadius || 3;
    const vertices = pathData.vertices;

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const canvasCoords = this._convertUnifiedToCanvas(vertex);
      
      ctx.beginPath();
      ctx.arc(canvasCoords.x, canvasCoords.y, pointRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Yield control periodically
      if (i % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    ctx.restore();
  }

  /**
   * UPDATED: Render bar datasets using unified coordinate system
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
        
        await this._renderUnifiedBarDataset(ctx, dataset, scales, options, barInfo, i);
      }
      
      console.log(`Canvas rendered ${datasets.length} bar datasets using UNIFIED coordinates`);
      
    } catch (error) {
      console.error('Error rendering bars with Canvas:', error);
    } finally {
      ctx.restore();
    }
  }

  /**
   * UPDATED: Render a single bar dataset using unified coordinates - SIMPLIFIED COLORS
   */
  async _renderUnifiedBarDataset(ctx, dataset, scales, options, barInfo, datasetIndex) {
    // SIMPLIFIED: Use dataset color directly or fallback to default blue
    ctx.fillStyle = dataset.color || '#1468a8';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.globalAlpha = dataset.opacity || 1.0;
    
    let barCount = 0;
    
    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
      
      // UPDATED: Use unified coordinates from transformed data
      const x = point.unifiedX || point.screenX;
      const y = point.unifiedY || point.screenY;
      
      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }
      
      this._renderUnifiedBar(ctx, x, y, barInfo, datasetIndex, i, scales);
      
      barCount++;
      
      // Yield control periodically
      if (barCount % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    console.log(`Canvas rendered bar dataset with ${barCount} bars using unified coordinates`);
  }

  /**
   * UPDATED: Render a single bar using unified coordinates
   */
  _renderUnifiedBar(ctx, x, y, barInfo, datasetIndex, pointIndex, scales) {
    // Calculate bar position and size using unified coordinates
    const barX = x - (barInfo.width / 2);
    
    // FIXED: For Canvas coordinate system, baseline should be at the bottom of chart area
    const chartArea = scales.y.range; // [top, bottom] in Canvas coordinates
    const baselineY = chartArea[1]; // Bottom of chart area (higher Y value in Canvas)
    const barHeight = Math.abs(baselineY - y); // Height from baseline to data point
    const barY = Math.min(y, baselineY); // Top of the bar
    
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
      console.log('Canvas bar render:', {
        pointIndex,
        x, y,
        baselineY,
        barHeight,
        barY,
        barWidth: adjustedBarWidth,
        chartTop: chartArea[0],
        chartBottom: chartArea[1]
      });
    }
    
    // Draw the bar (no coordinate conversion needed since we're already in Canvas coords)
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
   * UPDATED: Calculate bar dimensions using unified coordinates
   */
  _calculateBarDimensions(datasets, scales, options) {
    const firstDataset = datasets[0];
    if (!firstDataset || !firstDataset.data || firstDataset.data.length === 0) {
      return { width: 10, spacing: 2, totalDatasets: datasets.length, showBorder: false };
    }

    const data = firstDataset.data;
    const barWidth = options.barWidth || 0.7;
    const barSpacing = options.barSpacing || 0.1;

    // For time series data, calculate based on unified pixel differences between points
    if (data.length > 1) {
      // UPDATED: Use unified coordinates for accurate spacing
      const unifiedXValues = data
        .map(point => point.unifiedX || point.screenX)
        .filter(x => x != null && isFinite(x))
        .sort((a, b) => a - b);

      if (unifiedXValues.length > 1) {
        // Calculate average pixel distance between consecutive points
        let totalDiff = 0;
        for (let i = 1; i < unifiedXValues.length; i++) {
          totalDiff += unifiedXValues[i] - unifiedXValues[i - 1];
        }
        const avgPixelDistance = totalDiff / (unifiedXValues.length - 1);

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
   * Update with new datasets
   */
  update(datasets) {
    console.log('Canvas renderer update with unified coordinates - will re-render on next render call');
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
      'text-rendering',
      'unified-coordinates'
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
      supportsPatterns: true,
      coordinateSystem: 'unified',
      devicePixelRatio: this.devicePixelRatio
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
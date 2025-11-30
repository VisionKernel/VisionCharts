import AbstractRenderer from './AbstractRenderer.js';

export default class CanvasRenderer extends AbstractRenderer {
  constructor(config = {}) {
    super(config);

    this.canvas = null;
    this.ctx = null;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.logicalWidth = 800;
    this.logicalHeight = 600;
    this.options = {
      antialias: true,
      imageSmoothingEnabled: true,
      lineJoin: 'round',
      lineCap: 'round',
      ...config
    };
  }

  async initialize(canvas, dimensions) {
    try {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      if (!this.ctx) {
        throw new Error('Canvas 2D context not available');
      }

      this._setupStandardizedDPI(dimensions);
      this._configureContext();
      this.isInitialized = true;
    } catch (error) {
      console.error('Canvas initialization failed:', error);
      throw error;
    }
  }

  _setupStandardizedDPI(dimensions) {
    this.logicalWidth = dimensions.width;
    this.logicalHeight = dimensions.height;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = dimensions.width * this.devicePixelRatio;
    this.canvas.height = dimensions.height * this.devicePixelRatio;
    this.canvas.style.width = dimensions.width + 'px';
    this.canvas.style.height = dimensions.height + 'px';
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
  }

  _configureContext() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = this.options.imageSmoothingEnabled;
    ctx.lineJoin = this.options.lineJoin;
    ctx.lineCap = this.options.lineCap;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear() {
    if (!this.isInitialized) return;
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
  }

  setViewport(viewport) {
    if (!this.isInitialized) return;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    this.ctx.clip();
  }

  async renderLines(generatedPaths, scales, options = {}) {
    if (!this.isInitialized || !generatedPaths || generatedPaths.length === 0) {
      return;
    }

    const ctx = this.ctx;

    try {
      ctx.save();

      if (options.enableFill) {
        for (let i = 0; i < generatedPaths.length; i++) {
          const pathData = generatedPaths[i];
          if (pathData.fill && pathData.vertices && pathData.vertices.length > 0) {
            await this._renderUnifiedFill(ctx, pathData, options, scales, i);
          }
        }
      }

      for (let i = 0; i < generatedPaths.length; i++) {
        const pathData = generatedPaths[i];
        if (!pathData.vertices || pathData.vertices.length === 0) continue;
        await this._renderUnifiedPath(ctx, pathData, options, i);
      }
    } catch (error) {
      console.error('Error rendering lines with Canvas:', error);
    } finally {
      ctx.restore();
    }
  }

  async _renderUnifiedFill(ctx, pathData, options, scales, pathIndex) {
    const vertices = pathData.vertices;
    if (vertices.length < 2) return;

    // Save context state to isolate each fill operation
    ctx.save();

    // Explicitly set globalAlpha to 1.0 to ensure opacity is only controlled by fillStyle
    ctx.globalAlpha = 1.0;

    const fillColor = pathData.color || '#1468a8';
    const fillOpacity = pathData.fillOpacity || options.fillOpacity || 0.3;
    const colorMatch = fillColor.match(/rgba?\(([^)]+)\)/);

    if (colorMatch) {
      const colorParts = colorMatch[1].split(',').map(c => c.trim());
      ctx.fillStyle = `rgba(${colorParts[0]}, ${colorParts[1]}, ${colorParts[2]}, ${fillOpacity})`;
    } else if (fillColor.startsWith('#')) {
      const hex = fillColor.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
    } else {
      ctx.fillStyle = `rgba(20, 104, 168, ${fillOpacity})`;
    }

    ctx.beginPath();
    const chartBottom = scales.y.range[0];
    const firstPoint = this._convertUnifiedToCanvas(vertices[0]);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < vertices.length; i++) {
      const point = this._convertUnifiedToCanvas(vertices[i]);
      ctx.lineTo(point.x, point.y);

      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const lastPoint = this._convertUnifiedToCanvas(vertices[vertices.length - 1]);
    const firstPointConverted = this._convertUnifiedToCanvas(vertices[0]);

    ctx.lineTo(lastPoint.x, chartBottom);
    ctx.lineTo(firstPointConverted.x, chartBottom);
    ctx.closePath();
    ctx.fill();

    // Restore context state after fill operation
    ctx.restore();
  }

  async _renderUnifiedPath(ctx, pathData, options, pathIndex) {
    const color = pathData.color || '#1468a8';
    ctx.strokeStyle = color;
    ctx.lineWidth = pathData.lineWidth || 2;
    ctx.globalAlpha = 1.0;
    ctx.beginPath();

    const vertices = pathData.vertices;
    if (vertices.length === 0) return;

    const startCoords = this._convertUnifiedToCanvas(vertices[0]);
    ctx.moveTo(startCoords.x, startCoords.y);

    for (let i = 1; i < vertices.length; i++) {
      const vertex = vertices[i];
      const canvasCoords = this._convertUnifiedToCanvas(vertex);
      ctx.lineTo(canvasCoords.x, canvasCoords.y);

      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    ctx.stroke();

    if (options.showPoints) {
      await this._renderUnifiedPathPoints(ctx, pathData, options);
    }
  }

  _convertUnifiedToCanvas(vertex) {
    return {
      x: vertex.x,
      y: vertex.y
    };
  }

  async _renderUnifiedPathPoints(ctx, pathData, options) {
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle;
    const pointRadius = options.pointRadius || 3;
    const vertices = pathData.vertices;

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const canvasCoords = this._convertUnifiedToCanvas(vertex);
      ctx.beginPath();
      ctx.arc(canvasCoords.x, canvasCoords.y, pointRadius, 0, 2 * Math.PI);
      ctx.fill();

      if (i % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    ctx.restore();
  }

  async renderBars(datasets, scales, options = {}) {
    if (!this.isInitialized || !datasets || datasets.length === 0) {
      return;
    }

    const ctx = this.ctx;

    try {
      ctx.save();
      const barInfo = this._calculateBarDimensions(datasets, scales, options);

      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        if (!dataset.data || dataset.data.length === 0) continue;
        await this._renderUnifiedBarDataset(ctx, dataset, scales, options, barInfo, i);
      }
    } catch (error) {
      console.error('Error rendering bars with Canvas:', error);
    } finally {
      ctx.restore();
    }
  }

  async _renderUnifiedBarDataset(ctx, dataset, scales, options, barInfo, datasetIndex) {
    ctx.fillStyle = dataset.color || '#1468a8';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    ctx.globalAlpha = dataset.opacity || 1.0;

    let barCount = 0;

    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
      const x = point.unifiedX || point.screenX;
      const y = point.unifiedY || point.screenY;

      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }

      this._renderUnifiedBar(ctx, x, y, barInfo, datasetIndex, i, scales);
      barCount++;

      if (barCount % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  _renderUnifiedBar(ctx, x, y, barInfo, datasetIndex, pointIndex, scales) {
    const barX = x - (barInfo.width / 2);
    const chartArea = scales.y.range;
    const baselineY = chartArea[0];
    const barHeight = Math.abs(baselineY - y);
    const barY = Math.min(y, baselineY);
    const totalDatasets = barInfo.totalDatasets;
    let adjustedBarX = barX;
    let adjustedBarWidth = barInfo.width;

    if (totalDatasets > 1) {
      adjustedBarWidth = barInfo.width / totalDatasets;
      adjustedBarX = barX + (datasetIndex * adjustedBarWidth);
    }

    const minBarHeight = Math.max(barHeight, 1);

    if (pointIndex < 3) {
      // intentional no-op for minimal logging
      void 0;
    }

    ctx.fillRect(
      Math.round(adjustedBarX),
      Math.round(barY),
      Math.round(adjustedBarWidth),
      Math.round(minBarHeight)
    );

    if (barInfo.showBorder) {
      ctx.strokeRect(
        Math.round(adjustedBarX),
        Math.round(barY),
        Math.round(adjustedBarWidth),
        Math.round(minBarHeight)
      );
    }
  }

  _calculateBarDimensions(datasets, scales, options) {
    const firstDataset = datasets[0];
    if (!firstDataset || !firstDataset.data || firstDataset.data.length === 0) {
      return { width: 10, spacing: 2, totalDatasets: datasets.length, showBorder: false };
    }

    const data = firstDataset.data;
    const barWidth = options.barWidth || 0.7;
    const barSpacing = options.barSpacing || 0.1;

    const unifiedXValues = data
      .map(point => point.unifiedX || point.screenX)
      .filter(x => x != null && isFinite(x))
      .sort((a, b) => a - b);

    if (unifiedXValues.length === 1) {
      const chartWidth = scales.x.range[1] - scales.x.range[0];
      const reasonableWidth = Math.min(chartWidth * 0.1, 50);

      return {
        width: reasonableWidth,
        spacing: 0,
        totalDatasets: datasets.length,
        showBorder: options.showBorder || false
      };
    }

    if (unifiedXValues.length > 1) {
      let totalDiff = 0;
      for (let i = 1; i < unifiedXValues.length; i++) {
        totalDiff += unifiedXValues[i] - unifiedXValues[i - 1];
      }
      const avgPixelDistance = totalDiff / (unifiedXValues.length - 1);
      const calculatedWidth = Math.max(avgPixelDistance * barWidth, 1);

      return {
        width: calculatedWidth,
        spacing: avgPixelDistance * barSpacing,
        totalDatasets: datasets.length,
        showBorder: options.showBorder || false
      };
    }

    return {
      width: 20,
      spacing: 4,
      totalDatasets: datasets.length,
      showBorder: options.showBorder || false
    };
  }

  update(datasets) {
    // no-op; re-render will pick up changes
  }

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

  static isSupported() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  destroy() {
    if (this.ctx) {
      this.ctx.restore();
      this.ctx = null;
    }
    this.canvas = null;
    super.destroy();
  }
}

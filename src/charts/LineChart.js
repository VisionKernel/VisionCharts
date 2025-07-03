/**
 * LineChart.js - Enhanced Line Chart Implementation with Multi-Renderer Support
 * 
 * Extends the base Chart class to render line charts using either Canvas 2D or WebGL
 * based on dataset size. Automatically switches to WebGL for datasets over 50K points.
 */

import { Chart } from '../core/Chart.js';

export class LineChart extends Chart {
  constructor(config = {}) {
    super(config);
    
    // Line-specific options
    this.config.options = {
      ...this.config.options,
      curve: 'monotone', // 'linear', 'step', 'cardinal', 'monotone'
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      ...config.options
    };
    
    console.log('LineChart created with multi-renderer support');
  }
  
  /**
   * Render line chart data using standardized paths from PathGenerator
   */
  async _renderChartData() {
    if (!this.rendererInstance) {
      console.error('No renderer instance available');
      return;
    }

    // Use generated paths instead of raw data
    if (!this.generatedPaths || !Array.isArray(this.generatedPaths) || this.generatedPaths.length === 0) {
      console.log('No generated paths to render');
      return;
    }

    try {
      // Set viewport for clipping
      this.rendererInstance.setViewport(this.chartArea);

      // Render lines using standardized paths
      await this.rendererInstance.renderLines(this.generatedPaths, this.scales, {
        showPoints: this.config.options.showPoints,
        pointRadius: this.config.options.pointRadius
      });

      const totalVertices = this.generatedPaths.reduce((sum, path) => sum + (path.vertexCount || 0), 0);
      console.log(`LineChart: Rendered ${this.generatedPaths.length} datasets with ${totalVertices} total vertices using ${this.activeRenderer}`);

    } catch (error) {
      console.error('Error rendering line chart data:', error);
      throw error;
    }
  }

  /**
   * Set curve type for line interpolation - now updates PathGenerator
   */
  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    
    if (!validCurves.includes(curveType)) {
      console.warn(`Invalid curve type: ${curveType}. Valid types: ${validCurves.join(', ')}`);
      return this;
    }
    
    // Update both config and PathGenerator
    this.config.options.curve = curveType;
    this.pathGenerator.setCurveType(curveType);
    
    console.log(`Curve type set to: ${curveType}`);
    
    this.render(); // Re-render with new curve type
    return this;
  }
  
  /**
   * Add a new dataset to the chart
   */
  addDataset(dataset) {
    if (!dataset || !dataset.data) {
      console.warn('Invalid dataset provided to addDataset');
      return this;
    }
    
    // Ensure required properties
    const processedDataset = {
      id: dataset.id || `dataset-${this.config.data.length + 1}`,
      name: dataset.name || `Dataset ${this.config.data.length + 1}`,
      color: dataset.color || this._getDefaultColor(this.config.data.length),
      width: dataset.width || this.config.options.strokeWidth,
      ...dataset
    };
    
    this.config.data.push(processedDataset);
    
    console.log(`Added dataset: ${processedDataset.id} with ${processedDataset.data.length} points`);
    
    // Update and re-render
    this.update();
    
    return this;
  }
  
  /**
   * Remove a dataset by ID
   */
  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);
    
    if (this.config.data.length < initialCount) {
      console.log(`Removed dataset: ${datasetId}`);
      this.update();
    } else {
      console.warn(`Dataset not found: ${datasetId}`);
    }
    
    return this;
  }
  
  /**
   * Update a specific dataset
   */
  updateDataset(datasetId, newData) {
    const dataset = this.config.data.find(ds => ds.id === datasetId);
    
    if (!dataset) {
      console.warn(`Dataset not found: ${datasetId}`);
      return this;
    }
    
    // Update dataset properties
    Object.assign(dataset, newData);
    
    console.log(`Updated dataset: ${datasetId}`);
    this.update();
    
    return this;
  }
  
  /**
   * Set curve type for line interpolation
   */
  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    
    if (!validCurves.includes(curveType)) {
      console.warn(`Invalid curve type: ${curveType}. Valid types: ${validCurves.join(', ')}`);
      return this;
    }
    
    this.config.options.curve = curveType;
    console.log(`Curve type set to: ${curveType}`);
    
    this.render();
    return this;
  }
  
  /**
   * Toggle point visibility
   */
  togglePoints(show = null) {
    this.config.options.showPoints = show !== null ? show : !this.config.options.showPoints;
    console.log(`Points ${this.config.options.showPoints ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showPoints;
  }
  
  /**
   * Set stroke width for all lines
   */
  setStrokeWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      console.warn('Invalid stroke width provided');
      return this;
    }
    
    this.config.options.strokeWidth = width;
    
    // Update all datasets that don't have custom widths
    this.config.data.forEach(dataset => {
      if (!dataset.customWidth) {
        dataset.width = width;
      }
    });
    
    console.log(`Stroke width set to: ${width}`);
    this.render();
    return this;
  }
  
  /**
   * Set point radius
   */
  setPointRadius(radius) {
    if (typeof radius !== 'number' || radius <= 0) {
      console.warn('Invalid point radius provided');
      return this;
    }
    
    this.config.options.pointRadius = radius;
    console.log(`Point radius set to: ${radius}`);
    
    this.render();
    return this;
  }
  
  /**
   * Get line chart specific information
   */
  getLineChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    return {
      ...baseInfo,
      chartType: 'line',
      curveType: this.config.options.curve,
      strokeWidth: this.config.options.strokeWidth,
      showPoints: this.config.options.showPoints,
      pointRadius: this.config.options.pointRadius,
      datasets: this.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        color: dataset.color,
        pointCount: dataset.data?.length || 0,
        width: dataset.width
      }))
    };
  }
  

  
  /**
   * Get default color for dataset by index
   * @private
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
   * Optimize for large datasets by enabling WebGL if needed
   */
  optimizeForLargeDataset() {
    const currentRenderer = this.activeRenderer;
    
    if (this.dataPointCount > this.performanceThresholds.canvas && currentRenderer !== 'webgl') {
      console.log('Optimizing for large dataset - switching to WebGL');
      return this.switchRenderer('webgl');
    } else {
      console.log('Dataset size acceptable for current renderer');
      return Promise.resolve();
    }
  }
  

}
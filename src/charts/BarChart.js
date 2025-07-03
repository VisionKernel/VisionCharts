/**
 * BarChart.js - Enhanced Bar Chart Implementation with Multi-Renderer Support
 * 
 * Extends the base Chart class to render bar charts using either Canvas 2D or WebGL
 * based on dataset size. Automatically switches to WebGL for datasets over 50K points.
 */

import { Chart } from '../core/Chart.js';

export class BarChart extends Chart {
  constructor(config = {}) {
    super(config);
    
    // Bar-specific options
    this.config.options = {
      ...this.config.options,
      barWidth: 0.7, // Percentage of available space per bar
      barSpacing: 0.1, // Spacing between bars as percentage
      showBorder: false, // Whether to show bar borders
      borderWidth: 1, // Border width when enabled
      ...config.options
    };
    
    console.log('BarChart created with multi-renderer support');
  }
  
  /**
   * Render bar chart data using the selected renderer (Canvas 2D or WebGL)
   */
  async _renderChartData() {
    if (!this.rendererInstance) {
      console.error('No renderer instance available');
      return;
    }
    
    if (!Array.isArray(this.config.data) || this.config.data.length === 0) {
      console.log('No data to render');
      return;
    }
    
    try {
      // Preprocess data to add screen coordinates
      this._preprocessDataForRenderer();
      
      // Set viewport for clipping
      this.rendererInstance.setViewport(this.chartArea);
      
      // Render bars using the selected renderer
      await this.rendererInstance.renderBars(this.config.data, this.scales, {
        barWidth: this.config.options.barWidth,
        barSpacing: this.config.options.barSpacing,
        showBorder: this.config.options.showBorder,
        borderWidth: this.config.options.borderWidth
      });
      
      const totalBars = this.config.data.reduce((sum, dataset) => sum + (dataset.data?.length || 0), 0);
      console.log(`BarChart: Rendered ${this.config.data.length} datasets with ${totalBars} total bars using ${this.activeRenderer}`);
      
    } catch (error) {
      console.error('Error rendering bar chart data:', error);
      throw error;
    }
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
      ...dataset
    };
    
    this.config.data.push(processedDataset);
    
    console.log(`Added dataset: ${processedDataset.id} with ${processedDataset.data.length} bars`);
    
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
   * Set bar width as percentage of available space
   */
  setBarWidth(width) {
    if (typeof width !== 'number' || width <= 0 || width > 1) {
      console.warn('Bar width must be a number between 0 and 1');
      return this;
    }
    
    this.config.options.barWidth = width;
    console.log(`Bar width set to: ${width}`);
    
    this.render();
    return this;
  }
  
  /**
   * Set spacing between bars
   */
  setBarSpacing(spacing) {
    if (typeof spacing !== 'number' || spacing < 0) {
      console.warn('Bar spacing must be a non-negative number');
      return this;
    }
    
    this.config.options.barSpacing = spacing;
    console.log(`Bar spacing set to: ${spacing}`);
    
    this.render();
    return this;
  }
  
  /**
   * Toggle bar borders
   */
  toggleBorders(show = null) {
    this.config.options.showBorder = show !== null ? show : !this.config.options.showBorder;
    console.log(`Bar borders ${this.config.options.showBorder ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showBorder;
  }
  
  /**
   * Set border width for bars
   */
  setBorderWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      console.warn('Invalid border width provided');
      return this;
    }
    
    this.config.options.borderWidth = width;
    console.log(`Border width set to: ${width}`);
    
    if (this.config.options.showBorder) {
      this.render();
    }
    
    return this;
  }
  
  /**
   * Get bar chart specific information
   */
  getBarChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    return {
      ...baseInfo,
      chartType: 'bar',
      barWidth: this.config.options.barWidth,
      barSpacing: this.config.options.barSpacing,
      showBorder: this.config.options.showBorder,
      borderWidth: this.config.options.borderWidth,
      datasets: this.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        color: dataset.color,
        barCount: dataset.data?.length || 0
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
  
  /**
   * Apply histogram styling automatically for time series data
   */
  applyHistogramStyling() {
    // Automatically adjust bar width and spacing for histogram appearance
    this.config.options.barWidth = 0.95; // Wider bars for histogram
    this.config.options.barSpacing = 0.02; // Minimal spacing
    this.config.options.showBorder = true; // Show borders to define bins
    this.config.options.borderWidth = 1;
    
    console.log('Applied histogram styling for time series data');
    this.render();
    
    return this;
  }
  

}
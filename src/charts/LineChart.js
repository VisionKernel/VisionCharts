/**
 * LineChart.js - Line Chart Implementation
 * 
 * Extends the base Chart class to render line charts with Canvas/WebGL.
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
      ...config.options
    };
  }
  
  /**
   * Render line chart data using Canvas
   */
  async _renderChartData() {
    const ctx = this.canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, this.config.options.width, this.config.options.height);
    
    // Set up canvas state
    ctx.save();
    
    // Render each dataset
    if (Array.isArray(this.config.data)) {
      for (let i = 0; i < this.config.data.length; i++) {
        const dataset = this.config.data[i];
        await this._renderDataset(ctx, dataset, i);
      }
    }
    
    ctx.restore();
  }
  
  /**
   * Render a single dataset
   */
  async _renderDataset(ctx, dataset, index) {
    if (!dataset.data || !Array.isArray(dataset.data) || dataset.data.length === 0) {
      return;
    }
    
    // Use shared scales from Chart
    if (!this.scales.x || !this.scales.y) {
      console.warn('Scales not available for scaling');
      return;
    }
    
    // Set line style
    ctx.strokeStyle = dataset.color || this._getDefaultColor(index);
    ctx.lineWidth = dataset.width || this.config.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Begin path
    ctx.beginPath();
    
    // Draw line
    let isFirstPoint = true;
    
    for (const point of dataset.data) {
      const x = this._getXValue(point);
      const y = this._getYValue(point);
      
      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }
      
      // Use shared scales for consistency with axes
      const canvasX = this.scales.x.scale(x);
      const canvasY = this.scales.y.scale(y);
      
      if (isFirstPoint) {
        ctx.moveTo(canvasX, canvasY);
        isFirstPoint = false;
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    
    // Stroke the path
    ctx.stroke();
    
    // Draw points if enabled
    if (this.config.options.showPoints) {
      this._renderPoints(ctx, dataset);
    }
  }
  
  /**
   * Render data points
   */
  _renderPoints(ctx, dataset) {
    ctx.fillStyle = ctx.strokeStyle; // Use same color as line
    
    for (const point of dataset.data) {
      const x = this._getXValue(point);
      const y = this._getYValue(point);
      
      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }
      
      // Use shared scales for consistency with axes
      const canvasX = this.scales.x.scale(x);
      const canvasY = this.scales.y.scale(y);
      
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
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
}
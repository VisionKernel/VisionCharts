/**
 * BarChart.js - Bar Chart Implementation
 * 
 * Extends the base Chart class to render bar charts with Canvas/WebGL.
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
      ...config.options
    };
  }
  
  /**
   * Render bar chart data using Canvas
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
   * Render a single dataset as bars
   */
  async _renderDataset(ctx, dataset, datasetIndex) {
    if (!dataset.data || !Array.isArray(dataset.data) || dataset.data.length === 0) {
      return;
    }
    
    // Use shared scales from Chart
    if (!this.scales.x || !this.scales.y) {
      console.warn('Scales not available for scaling');
      return;
    }
    
    // Calculate bar dimensions
    const barInfo = this._calculateBarDimensions(dataset.data);
    
    // Set bar style
    ctx.fillStyle = dataset.color || this._getDefaultColor(datasetIndex);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1;
    
    // Draw bars
    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
      const x = this._getXValue(point);
      const y = this._getYValue(point);
      
      if (x == null || y == null || isNaN(x) || isNaN(y)) {
        continue;
      }
      
      this._renderBar(ctx, x, y, barInfo, datasetIndex, i);
    }
  }
  
  /**
   * Render a single bar
   */
  _renderBar(ctx, x, y, barInfo, datasetIndex, pointIndex) {
    // Use shared scales for consistency with axes
    const canvasX = this.scales.x.scale(x);
    const canvasY = this.scales.y.scale(y);
    
    // Calculate bar position and size
    const barX = canvasX - (barInfo.width / 2);
    const barHeight = this.chartArea.y + this.chartArea.height - canvasY;
    const barY = canvasY;
    
    // Handle multiple datasets - offset bars horizontally
    const totalDatasets = Array.isArray(this.config.data) ? this.config.data.length : 1;
    let adjustedBarX = barX;
    let adjustedBarWidth = barInfo.width;
    
    if (totalDatasets > 1) {
      adjustedBarWidth = barInfo.width / totalDatasets;
      adjustedBarX = barX + (datasetIndex * adjustedBarWidth);
    }
    
    // Ensure minimum bar height for visibility
    const minBarHeight = Math.max(barHeight, y !== 0 ? 1 : 0);
    const adjustedBarY = this.chartArea.y + this.chartArea.height - minBarHeight;
    
    // Draw the bar
    ctx.fillRect(
      Math.round(adjustedBarX),
      Math.round(adjustedBarY),
      Math.round(adjustedBarWidth),
      Math.round(minBarHeight)
    );
    
    // Optional: Add border
    if (this.config.options.showBorder) {
      ctx.strokeRect(
        Math.round(adjustedBarX),
        Math.round(adjustedBarY),
        Math.round(adjustedBarWidth),
        Math.round(minBarHeight)
      );
    }
  }
  
  /**
   * Calculate bar dimensions based on data and chart area
   */
  _calculateBarDimensions(data) {
    if (!data || data.length === 0) {
      return { width: 10, spacing: 2 };
    }
    
    // For time series data, calculate based on time differences
    if (this.config.options.xType === 'time' && data.length > 1) {
      // Sort data by x value to ensure proper spacing calculation
      const sortedData = [...data].sort((a, b) => {
        const aX = this._getXValue(a);
        const bX = this._getXValue(b);
        return aX - bX;
      });
      
      // Calculate average time difference
      let totalDiff = 0;
      for (let i = 1; i < sortedData.length; i++) {
        const diff = this._getXValue(sortedData[i]) - this._getXValue(sortedData[i - 1]);
        totalDiff += diff;
      }
      const avgTimeDiff = totalDiff / (sortedData.length - 1);
      
      // Convert time difference to pixels using shared scale
      const firstX = this._getXValue(sortedData[0]);
      const scaledWidth = this.scales.x.scale(firstX + avgTimeDiff) - this.scales.x.scale(firstX);
      
      return {
        width: Math.max(Math.abs(scaledWidth) * this.config.options.barWidth, 2),
        spacing: Math.abs(scaledWidth) * this.config.options.barSpacing
      };
    } else {
      // For discrete data, divide available space
      const availableWidth = this.chartArea.width;
      const barWidth = (availableWidth / data.length) * this.config.options.barWidth;
      
      return {
        width: Math.max(barWidth, 2),
        spacing: (availableWidth / data.length) * this.config.options.barSpacing
      };
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
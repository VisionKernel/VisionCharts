/**
 * AverageLine Component 
 * Renders a horizontal line representing the average (mean) value of the dataset
 */

import SvgRenderer from '../renderers/SvgRenderer.js';

export class AverageLine {
  constructor(config = {}) {
    this.config = {
      color: config.color || '#FF6B35',
      width: config.width || 2,
      opacity: config.opacity || 0.8,
      strokeDasharray: config.strokeDasharray || '5,5',
      className: config.className || 'visioncharts-average-line',
      showLabel: config.showLabel !== false,
      labelText: config.labelText || 'Average',
      labelPosition: config.labelPosition || 'right',
      labelOffset: config.labelOffset || { x: 5, y: -5 },
      labelStyle: config.labelStyle || {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        fill: config.color || '#FF6B35',
        fontWeight: 'bold'
      }
    };
    
    this.element = null;
    this.labelElement = null;
    this.averageValue = null;
  }

  /**
   * Calculate the average value from dataset
   * @param {Array} data - Array of data points
   * @param {string} valueField - Field name containing the values (e.g., 'y', 'price', 'value')
   * @returns {number} - Average value
   */
  calculateAverage(data, valueField = 'y') {
    if (!data || data.length === 0) {
      return 0;
    }

    const validValues = data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(v => v !== null);

    if (validValues.length === 0) {
      return 0;
    }

    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return sum / validValues.length;
  }

  /**
   * Render the average line on the chart
   * @param {Object} chart - Chart instance containing scales and dimensions
   * @param {Array} data - Dataset to calculate average from
   * @param {string} valueField - Field name for values
   */
  render(chart, data, valueField = 'y') {
    if (!chart || !chart.state || !chart.state.chart) {
      console.warn('AverageLine: Invalid chart instance provided');
      return;
    }

    // Remove existing average line
    this.remove();

    // Calculate average value
    this.averageValue = this.calculateAverage(data, valueField);
    
    if (this.averageValue === null || isNaN(this.averageValue)) {
      console.warn('AverageLine: Could not calculate valid average');
      return;
    }

    const { scales, dimensions } = chart.state;
    const yScale = scales.y;
    
    if (!yScale) {
      console.warn('AverageLine: Y scale not found in chart');
      return;
    }

    // Get chart plotting area dimensions
    const chartWidth = dimensions.innerWidth;
    const chartHeight = dimensions.innerHeight;
    
    // Convert average value to y coordinate using the scale
    const yPosition = yScale.scale(this.averageValue);
    
    // Check if the average line is within the visible chart area
    if (yPosition < 0 || yPosition > chartHeight) {
      console.warn('AverageLine: Average value is outside chart bounds', {
        yPosition,
        chartHeight,
        averageValue: this.averageValue
      });
      return;
    }

    // Create the average line group using SvgRenderer
    this.element = SvgRenderer.createGroup({
      class: this.config.className
    });

    // Add the horizontal line using SvgRenderer
    const lineElement = SvgRenderer.createLine(
      0, yPosition,
      chartWidth, yPosition,
      {
        class: `${this.config.className}-line`,
        stroke: this.config.color,
        'stroke-width': this.config.width,
        'stroke-opacity': this.config.opacity,
        'stroke-dasharray': this.config.strokeDasharray,
        'pointer-events': 'none'
      }
    );
    
    this.element.appendChild(lineElement);

    // Add label if enabled
    if (this.config.showLabel) {
      this.renderLabel(chartWidth, yPosition);
    }

    // Add to chart
    chart.state.chart.appendChild(this.element);

    return this;
  }

  /**
   * Render the average line label
   * @param {number} chartWidth - Width of the chart area
   * @param {number} yPosition - Y position of the average line
   */
  renderLabel(chartWidth, yPosition) {
    if (!this.element) return;

    let labelX, labelAnchor;
    
    // Determine label position
    switch (this.config.labelPosition) {
      case 'left':
        labelX = this.config.labelOffset.x;
        labelAnchor = 'start';
        break;
      case 'center':
        labelX = chartWidth / 2;
        labelAnchor = 'middle';
        break;
      case 'right':
      default:
        labelX = chartWidth - Math.abs(this.config.labelOffset.x);
        labelAnchor = 'end';
        break;
    }

    const labelY = yPosition + this.config.labelOffset.y;

    this.labelElement = SvgRenderer.createText(
      `${this.config.labelText}: ${this.averageValue.toFixed(2)}`,
      labelX,
      labelY,
      {
        class: `${this.config.className}-label`,
        'text-anchor': labelAnchor,
        'font-size': this.config.labelStyle.fontSize,
        'font-family': this.config.labelStyle.fontFamily,
        fill: this.config.labelStyle.fill,
        'font-weight': this.config.labelStyle.fontWeight,
        'pointer-events': 'none'
      }
    );

    this.element.appendChild(this.labelElement);
  }

  /**
   * Update the average line (useful when data changes)
   * @param {Object} chart - Chart instance
   * @param {Array} data - Updated dataset
   * @param {string} valueField - Field name for values
   */
  update(chart, data, valueField = 'y') {
    this.render(chart, data, valueField);
  }

  /**
   * Remove the average line from the chart
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
      this.labelElement = null;
    }
  }

  /**
   * Show the average line
   */
  show() {
    if (this.element) {
      this.element.style.display = 'block';
    }
  }

  /**
   * Hide the average line
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Toggle visibility of the average line
   */
  toggle() {
    if (this.element) {
      const currentDisplay = this.element.style.display;
      this.element.style.display = currentDisplay === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update label style if labelStyle is provided
    if (newConfig.labelStyle) {
      this.config.labelStyle = { ...this.config.labelStyle, ...newConfig.labelStyle };
    }
  }

  /**
   * Get the current average value
   * @returns {number} - Current average value
   */
  getValue() {
    return this.averageValue;
  }

  /**
   * Check if the average line is currently visible
   * @returns {boolean} - True if visible, false otherwise
   */
  isVisible() {
    return this.element && this.element.style.display !== 'none';
  }
}
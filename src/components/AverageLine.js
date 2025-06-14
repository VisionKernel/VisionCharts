/**
 * AverageLine Component
 * Renders a horizontal line representing the average (mean) value of the dataset
 */

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
    if (!chart || !chart.state || !chart.state.svg) {
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

    // Get chart plotting area
    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;
    
    // Convert average value to y coordinate
    const yPosition = yScale(this.averageValue);
    
    // Check if the average line is within the visible chart area
    if (yPosition < 0 || yPosition > chartHeight) {
      console.warn('AverageLine: Average value is outside chart bounds');
      return;
    }

    // Create or select the average line group
    const chartGroup = chart.state.svg.select('.chart-content') || chart.state.svg;
    
    // Create the average line
    this.element = chartGroup
      .append('g')
      .attr('class', this.config.className);

    // Add the horizontal line
    this.element
      .append('line')
      .attr('class', `${this.config.className}-line`)
      .attr('x1', 0)
      .attr('y1', yPosition)
      .attr('x2', chartWidth)
      .attr('y2', yPosition)
      .style('stroke', this.config.color)
      .style('stroke-width', this.config.width)
      .style('stroke-opacity', this.config.opacity)
      .style('stroke-dasharray', this.config.strokeDasharray)
      .style('pointer-events', 'none');

    // Add label if enabled
    if (this.config.showLabel) {
      this.renderLabel(chartWidth, yPosition);
    }

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

    this.labelElement = this.element
      .append('text')
      .attr('class', `${this.config.className}-label`)
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', labelAnchor)
      .style('font-size', this.config.labelStyle.fontSize)
      .style('font-family', this.config.labelStyle.fontFamily)
      .style('fill', this.config.labelStyle.fill)
      .style('font-weight', this.config.labelStyle.fontWeight)
      .style('pointer-events', 'none')
      .text(`${this.config.labelText}: ${this.averageValue.toFixed(2)}`);
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
    if (this.element) {
      this.element.remove();
      this.element = null;
      this.labelElement = null;
    }
  }

  /**
   * Show the average line
   */
  show() {
    if (this.element) {
      this.element.style('display', 'block');
    }
  }

  /**
   * Hide the average line
   */
  hide() {
    if (this.element) {
      this.element.style('display', 'none');
    }
  }

  /**
   * Toggle visibility of the average line
   */
  toggle() {
    if (this.element) {
      const currentDisplay = this.element.style('display');
      this.element.style('display', currentDisplay === 'none' ? 'block' : 'none');
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
    return this.element && this.element.style('display') !== 'none';
  }
}
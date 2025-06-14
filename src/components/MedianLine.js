/**
 * MedianLine Component
 * Renders a horizontal line representing the median value of the dataset
 */

export class MedianLine {
  constructor(config = {}) {
    this.config = {
      color: config.color || '#9C27B0',
      width: config.width || 2,
      opacity: config.opacity || 0.8,
      strokeDasharray: config.strokeDasharray || '8,4',
      className: config.className || 'visioncharts-median-line',
      showLabel: config.showLabel !== false,
      labelText: config.labelText || 'Median',
      labelPosition: config.labelPosition || 'right',
      labelOffset: config.labelOffset || { x: 5, y: -5 },
      labelStyle: config.labelStyle || {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        fill: config.color || '#9C27B0',
        fontWeight: 'bold'
      }
    };
    
    this.element = null;
    this.labelElement = null;
    this.medianValue = null;
  }

  /**
   * Calculate the median value from dataset
   * @param {Array} data - Array of data points
   * @param {string} valueField - Field name containing the values (e.g., 'y', 'price', 'value')
   * @returns {number} - Median value
   */
  calculateMedian(data, valueField = 'y') {
    if (!data || data.length === 0) {
      return 0;
    }

    const validValues = data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(v => v !== null)
      .sort((a, b) => a - b); // Sort in ascending order

    if (validValues.length === 0) {
      return 0;
    }

    const middle = Math.floor(validValues.length / 2);

    // If odd number of values, return the middle value
    if (validValues.length % 2 === 1) {
      return validValues[middle];
    }
    
    // If even number of values, return the average of the two middle values
    return (validValues[middle - 1] + validValues[middle]) / 2;
  }

  /**
   * Render the median line on the chart
   * @param {Object} chart - Chart instance containing scales and dimensions
   * @param {Array} data - Dataset to calculate median from
   * @param {string} valueField - Field name for values
   */
  render(chart, data, valueField = 'y') {
    if (!chart || !chart.state || !chart.state.svg) {
      console.warn('MedianLine: Invalid chart instance provided');
      return;
    }

    // Remove existing median line
    this.remove();

    // Calculate median value
    this.medianValue = this.calculateMedian(data, valueField);
    
    if (this.medianValue === null || isNaN(this.medianValue)) {
      console.warn('MedianLine: Could not calculate valid median');
      return;
    }

    const { scales, dimensions } = chart.state;
    const yScale = scales.y;
    
    if (!yScale) {
      console.warn('MedianLine: Y scale not found in chart');
      return;
    }

    // Get chart plotting area
    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;
    
    // Convert median value to y coordinate
    const yPosition = yScale(this.medianValue);
    
    // Check if the median line is within the visible chart area
    if (yPosition < 0 || yPosition > chartHeight) {
      console.warn('MedianLine: Median value is outside chart bounds');
      return;
    }

    // Create or select the median line group
    const chartGroup = chart.state.svg.select('.chart-content') || chart.state.svg;
    
    // Create the median line
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
   * Render the median line label
   * @param {number} chartWidth - Width of the chart area
   * @param {number} yPosition - Y position of the median line
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
      .text(`${this.config.labelText}: ${this.medianValue.toFixed(2)}`);
  }

  /**
   * Update the median line (useful when data changes)
   * @param {Object} chart - Chart instance
   * @param {Array} data - Updated dataset
   * @param {string} valueField - Field name for values
   */
  update(chart, data, valueField = 'y') {
    this.render(chart, data, valueField);
  }

  /**
   * Remove the median line from the chart
   */
  remove() {
    if (this.element) {
      this.element.remove();
      this.element = null;
      this.labelElement = null;
    }
  }

  /**
   * Show the median line
   */
  show() {
    if (this.element) {
      this.element.style('display', 'block');
    }
  }

  /**
   * Hide the median line
   */
  hide() {
    if (this.element) {
      this.element.style('display', 'none');
    }
  }

  /**
   * Toggle visibility of the median line
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
   * Get the current median value
   * @returns {number} - Current median value
   */
  getValue() {
    return this.medianValue;
  }

  /**
   * Check if the median line is currently visible
   * @returns {boolean} - True if visible, false otherwise
   */
  isVisible() {
    return this.element && this.element.style('display') !== 'none';
  }

  /**
   * Get statistical information about the median calculation
   * @param {Array} data - Dataset used for calculation
   * @param {string} valueField - Field name for values
   * @returns {Object} - Statistical information
   */
  getStatistics(data, valueField = 'y') {
    const validValues = data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(v => v !== null)
      .sort((a, b) => a - b);

    if (validValues.length === 0) {
      return {
        median: 0,
        count: 0,
        min: null,
        max: null,
        quartiles: { q1: null, q3: null }
      };
    }

    const median = this.calculateMedian(data, valueField);
    const q1Index = Math.floor(validValues.length / 4);
    const q3Index = Math.floor(3 * validValues.length / 4);

    return {
      median: median,
      count: validValues.length,
      min: validValues[0],
      max: validValues[validValues.length - 1],
      quartiles: {
        q1: validValues[q1Index],
        q3: validValues[q3Index]
      }
    };
  }
}
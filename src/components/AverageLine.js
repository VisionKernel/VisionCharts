/**
 * AverageLine component for charts
 * Renders a horizontal line at the average value of dataset(s)
 * Integrates with the unified coordinate system and chart scales
 */

import { mean } from '../utils/math.js';

export class AverageLine {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      strokeColor: '#FF6B35',        // Orange color to distinguish from zero line
      strokeWidth: 2,                // Slightly thicker than zero line
      strokeOpacity: 0.8,            // Slightly transparent
      strokeDash: [5, 5],           // Dashed line pattern
      
      // Behavior
      enabled: false,               // Start disabled
      
      // Data scope
      useAllDatasets: true,         // Calculate across all datasets vs first dataset only
      
      // Label options
      showLabel: true,              // Whether to show average value label
      labelText: 'Avg',             // Prefix text
      labelOffset: -70,               // Pixels from chart edge
      labelVerticalOffset: -12,     // Pixels above the line (negative = above)
      labelColor: '#FF6B35',        // Label text color (matches line)
      labelFontSize: 11,           // Label font size
      labelPosition: 'right',       // 'left' or 'right' side of chart
      
      ...config
    };
    
    // SVG elements
    this.svgElement = null;
    this.averageLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    
    // Chart integration
    this.scales = null;
    this.chartArea = null;
    this.datasets = [];
    
    // Calculated values
    this.currentAverage = null;
    
    // State
    this.isVisible = false;
    this.isRendered = false;
    
    // Coordination with other statistical lines
    this.siblingLines = new Set(); // Track other statistical lines for overlap detection
    
    console.log('AverageLine component created');
  }
  
  /**
   * Register a sibling statistical line for overlap detection
   * @param {Object} siblingLine - Another statistical line component
   */
  addSiblingLine(siblingLine) {
    this.siblingLines.add(siblingLine);
  }
  
  /**
   * Remove a sibling statistical line
   * @param {Object} siblingLine - Statistical line component to remove
   */
  removeSiblingLine(siblingLine) {
    this.siblingLines.delete(siblingLine);
  }
  
  /**
   * Update datasets and recalculate average
   * @param {Array} datasets - Array of chart datasets
   */
  updateDatasets(datasets) {
    this.datasets = datasets || [];
    this._calculateAverage();
    
    if (this.isRendered) {
      this._renderAverageLine();
      
      // Re-check visibility if currently enabled
      if (this.config.enabled) {
        this.show();
      }
    }
  }
  
  /**
   * Initialize and render average line in dedicated SVG
   * @param {HTMLElement} container - Container to add SVG to
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} scales - Chart scales for coordinate conversion
   */
  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      console.warn('AverageLine: Container, chart area, and scales required');
      return;
    }
    
    this.chartArea = chartArea;
    this.scales = scales;
    
    // Remove existing SVG if present
    this._remove();
    
    // Create dedicated average line SVG layer
    this._createAverageLineSVG(container, chartArea);
    
    // Calculate average and render line
    this._calculateAverage();
    this._renderAverageLine();
    
    this.isRendered = true;
    
    // Show/hide based on current state
    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
    
    console.log(`AverageLine rendered with average: ${this.currentAverage}`);
  }
  
  /**
   * Show average line
   */
  show() {
    if (!this.isRendered) {
      console.warn('AverageLine: Must render before showing');
      return false;
    }
    
    // Check if average is within visible Y range
    if (!this._isAverageInRange()) {
      console.log('AverageLine: Average value not in visible range, hiding line');
      this.hide();
      return false;
    }
    
    this.config.enabled = true;
    this.isVisible = true;
    
    if (this.svgElement) {
      this.svgElement.style.display = 'block';
    }
    
    return true;
  }
  
  /**
   * Hide average line
   */
  hide() {
    this.config.enabled = false;
    this.isVisible = false;
    
    if (this.svgElement) {
      this.svgElement.style.display = 'none';
    }
    
    return true;
  }
  
  /**
   * Toggle average line visibility
   * @param {boolean} show - Force show/hide state, or null to toggle
   * @returns {boolean} New visibility state
   */
  toggle(show = null) {
    const newState = show !== null ? show : !this.config.enabled;
    
    if (newState) {
      return this.show();
    } else {
      return this.hide();
    }
  }
  
  /**
   * Update with new scales (when chart updates)
   * @param {Object} newScales - Updated chart scales
   */
  updateScales(newScales) {
    this.scales = newScales;
    
    if (this.isRendered) {
      this._renderAverageLine();
      
      // Re-check visibility if currently enabled
      if (this.config.enabled) {
        this.show();
      }
    }
  }
  
  /**
   * Update chart area (when chart resizes)
   * @param {Object} newChartArea - Updated chart area
   */
  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;
    
    if (this.svgElement) {
      this.svgElement.setAttribute('width', newChartArea.width + newChartArea.x * 2);
      this.svgElement.setAttribute('height', newChartArea.height + newChartArea.y * 2);
    }
    
    if (this.isRendered) {
      this._renderAverageLine();
    }
  }
  
  /**
   * Update styling/configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    if (this.isRendered) {
      this._renderAverageLine();
    }
  }
  
  /**
   * Get current average value
   * @returns {number|null} Current calculated average
   */
  getAverageValue() {
    return this.currentAverage;
  }
  
  /**
   * Get current component state
   */
  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      hasScales: !!this.scales,
      hasChartArea: !!this.chartArea,
      datasetCount: this.datasets.length,
      currentAverage: this.currentAverage,
      averageInRange: this._isAverageInRange()
    };
  }
  
  /**
   * Calculate average value from datasets
   * @private
   */
  _calculateAverage() {
    this.currentAverage = null;
    
    if (!this.datasets || this.datasets.length === 0) {
      return;
    }
    
    try {
      let allValues = [];
      
      if (this.config.useAllDatasets) {
        // Collect values from all datasets
        this.datasets.forEach(dataset => {
          if (dataset.data && Array.isArray(dataset.data)) {
            const values = dataset.data
              .map(point => this._extractYValue(point))
              .filter(value => value != null && isFinite(value));
            allValues.push(...values);
          }
        });
      } else {
        // Use only first dataset
        const firstDataset = this.datasets[0];
        if (firstDataset && firstDataset.data && Array.isArray(firstDataset.data)) {
          allValues = firstDataset.data
            .map(point => this._extractYValue(point))
            .filter(value => value != null && isFinite(value));
        }
      }
      
      if (allValues.length > 0) {
        this.currentAverage = mean(allValues);
        console.log(`AverageLine: Calculated average ${this.currentAverage} from ${allValues.length} values across ${this.datasets.length} datasets`);
      }
      
    } catch (error) {
      console.error('Error calculating average:', error);
      this.currentAverage = null;
    }
  }
  
  /**
   * Extract Y value from data point
   * @private
   */
  _extractYValue(point) {
    // Try different common field names for the value
    const value = point.y || point.value || point.price || point.close || point.amount;
    return typeof value === 'number' ? value : null;
  }
  
  /**
   * Create dedicated SVG element for average line
   * @private
   */
  _createAverageLineSVG(container, chartArea) {
    // Create SVG element with z-index: 1.6 (between zero line and data)
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.6';  // Between zero line (1.5) and data (2)
    this.svgElement.style.pointerEvents = 'none'; // Don't interfere with interactions
    this.svgElement.setAttribute('class', 'average-line-svg');
    
    // Create group for average line elements
    this.averageLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.averageLineGroup.setAttribute('class', 'visioncharts-average-line-group');
    this.svgElement.appendChild(this.averageLineGroup);
    
    // Add to container
    container.appendChild(this.svgElement);
    
    console.log('AverageLine SVG layer created with z-index: 1.6');
  }
  
  /**
   * Render the average line using chart scales
   * @private
   */
  _renderAverageLine() {
    if (!this.averageLineGroup || !this.scales || !this.chartArea || this.currentAverage == null) {
      return;
    }
    
    // Clear existing elements
    this.averageLineGroup.innerHTML = '';
    this.lineElement = null;
    this.labelElement = null;
    
    // Check if average is in Y domain
    if (!this._isAverageInRange()) {
      console.log('AverageLine: Average not in Y domain, skipping render');
      return;
    }
    
    try {
      // Convert average value to pixel coordinates using chart scales
      const averageY = this.scales.y.scale(this.currentAverage);
      
      // Ensure line is within chart area
      if (averageY < this.chartArea.y || averageY > this.chartArea.y + this.chartArea.height) {
        console.log('AverageLine: Average line outside chart area bounds');
        return;
      }
      
      // Create the horizontal line
      this._createAverageLineElement(averageY);
      
      // Create label if enabled
      if (this.config.showLabel) {
        this._createAverageLabelElement(averageY);
      }
      
    } catch (error) {
      console.error('Error rendering average line:', error);
    }
  }
  
  /**
   * Create the actual line element
   * @private
   */
  _createAverageLineElement(averageY) {
    this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineElement.setAttribute('class', 'visioncharts-average-line-line');
    this.lineElement.setAttribute('x1', this.chartArea.x);
    this.lineElement.setAttribute('x2', this.chartArea.x + this.chartArea.width);
    this.lineElement.setAttribute('y1', averageY);
    this.lineElement.setAttribute('y2', averageY);
    this.lineElement.setAttribute('stroke', this.config.strokeColor);
    this.lineElement.setAttribute('stroke-width', this.config.strokeWidth);
    this.lineElement.setAttribute('stroke-opacity', this.config.strokeOpacity);
    this.lineElement.setAttribute('shape-rendering', 'geometricPrecision');
    
    if (this.config.strokeDash.length > 0) {
      this.lineElement.setAttribute('stroke-dasharray', this.config.strokeDash.join(' '));
    }
    
    this.averageLineGroup.appendChild(this.lineElement);
  }
  
  /**
   * Create the label element with smart positioning
   * @private
   */
  _createAverageLabelElement(averageY) {
    this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.labelElement.setAttribute('class', 'visioncharts-average-line-label');
    
    // Calculate label position with overlap detection
    const labelPosition = this._calculateLabelPosition(averageY);
    
    this.labelElement.setAttribute('x', labelPosition.x);
    this.labelElement.setAttribute('y', labelPosition.y);
    this.labelElement.setAttribute('font-size', this.config.labelFontSize);
    this.labelElement.setAttribute('font-family', 'Arial, sans-serif');
    this.labelElement.setAttribute('font-weight', '500');
    this.labelElement.setAttribute('fill', this.config.labelColor);
    this.labelElement.setAttribute('dominant-baseline', 'central');
    this.labelElement.setAttribute('text-anchor', 'start');
    
    // Format the average value for display
    const formattedAverage = this._formatValue(this.currentAverage);
    this.labelElement.textContent = `${this.config.labelText}: ${formattedAverage}`;
    
    this.averageLineGroup.appendChild(this.labelElement);
  }
  
  /**
   * Calculate label position with overlap avoidance
   * @private
   */
  _calculateLabelPosition(lineY) {
    // Base position - right side of chart, above the line
    let labelX = this.chartArea.x + this.chartArea.width + this.config.labelOffset;
    let labelY = lineY + this.config.labelVerticalOffset;
    
    // Check for overlaps with sibling lines
    const overlappingSibling = this._findOverlappingSibling(lineY);
    
    if (overlappingSibling) {
      // Adjust position to avoid overlap
      const siblingY = this.scales.y.scale(overlappingSibling.getCurrentValue());
      
      if (this.currentAverage > overlappingSibling.getCurrentValue()) {
        // This line is higher, position above
        labelY = lineY - Math.abs(this.config.labelVerticalOffset) - 5;
      } else {
        // This line is lower, position below  
        labelY = lineY + Math.abs(this.config.labelVerticalOffset) + 5;
      }
      
      console.log('AverageLine: Adjusted label position to avoid overlap');
    }
    
    // Ensure label stays within chart bounds
    const minY = this.chartArea.y + this.config.labelFontSize;
    const maxY = this.chartArea.y + this.chartArea.height - 5;
    
    labelY = Math.max(minY, Math.min(maxY, labelY));
    
    return { x: labelX, y: labelY };
  }
  
  /**
   * Find sibling line that would cause label overlap
   * @private
   */
  _findOverlappingSibling(lineY) {
    const labelHeight = this.config.labelFontSize + 4; // Add some padding
    
    for (const sibling of this.siblingLines) {
      if (sibling.isVisible && sibling.getCurrentValue && sibling.getCurrentValue() != null) {
        const siblingY = this.scales.y.scale(sibling.getCurrentValue());
        const distance = Math.abs(lineY - siblingY);
        
        if (distance < labelHeight * 2) { // If labels would be too close
          return sibling;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get current value for overlap detection
   * @returns {number|null} Current average value
   */
  getCurrentValue() {
    return this.currentAverage;
  }
  
  /**
   * Format value for display in label
   * @private
   */
  _formatValue(value) {
    if (value == null || !isFinite(value)) {
      return 'N/A';
    }
    
    // Smart formatting based on value magnitude
    const absValue = Math.abs(value);
    
    if (absValue >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    } else if (absValue >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (absValue >= 100) {
      return value.toFixed(0);
    } else if (absValue >= 1) {
      return value.toFixed(1);
    } else {
      return value.toFixed(2);
    }
  }
  
  /**
   * Check if average is within the Y scale domain
   * @private
   */
  _isAverageInRange() {
    if (!this.scales || !this.scales.y || this.currentAverage == null) {
      return false;
    }
    
    const yDomain = this.scales.y.domain;
    return (this.currentAverage >= yDomain[0] && this.currentAverage <= yDomain[1]);
  }
  
  /**
   * Remove average line SVG from DOM
   * @private
   */
  _remove() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }
    
    this.svgElement = null;
    this.averageLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    this.isRendered = false;
  }
  
  /**
   * Destroy average line and clean up resources
   */
  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.datasets = [];
    this.currentAverage = null;
    this.isVisible = false;
    this.siblingLines.clear();
    
    console.log('AverageLine destroyed');
  }
}
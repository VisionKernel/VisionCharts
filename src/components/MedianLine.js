/**
 * MedianLine component for charts
 * Renders a horizontal line at the median value of dataset(s)
 * Integrates with the unified coordinate system and chart scales
 */

import { median } from '../utils/math.js';

export class MedianLine {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      strokeColor: '#9C27B0',        // Purple color to distinguish from average line
      strokeWidth: 2,                // Slightly thicker than zero line
      strokeOpacity: 0.8,            // Slightly transparent
      strokeDash: [8, 4],           // Different dash pattern from average
      
      // Behavior
      enabled: false,               // Start disabled
      
      // Data scope
      useAllDatasets: true,         // Calculate across all datasets vs first dataset only
      
      // Label options
      showLabel: true,              // Whether to show median value label
      labelText: 'Median',          // Prefix text
      labelOffset: -70,               // Pixels from chart edge
      labelVerticalOffset: 12,      // Pixels below the line (positive = below)
      labelColor: '#9C27B0',        // Label text color (matches line)
      labelFontSize: 11,           // Label font size
      labelPosition: 'right',       // 'left' or 'right' side of chart
      
      ...config
    };
    
    // SVG elements
    this.svgElement = null;
    this.medianLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    
    // Chart integration
    this.scales = null;
    this.chartArea = null;
    this.datasets = [];
    
    // Calculated values
    this.currentMedian = null;
    
    // State
    this.isVisible = false;
    this.isRendered = false;
    
    // Coordination with other statistical lines
    this.siblingLines = new Set(); // Track other statistical lines for overlap detection
    
    console.log('MedianLine component created');
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
   * Update datasets and recalculate median
   * @param {Array} datasets - Array of chart datasets
   */
  updateDatasets(datasets) {
    this.datasets = datasets || [];
    this._calculateMedian();
    
    if (this.isRendered) {
      this._renderMedianLine();
      
      // Re-check visibility if currently enabled
      if (this.config.enabled) {
        this.show();
      }
    }
  }
  
  /**
   * Initialize and render median line in dedicated SVG
   * @param {HTMLElement} container - Container to add SVG to
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} scales - Chart scales for coordinate conversion
   */
  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      console.warn('MedianLine: Container, chart area, and scales required');
      return;
    }
    
    this.chartArea = chartArea;
    this.scales = scales;
    
    // Remove existing SVG if present
    this._remove();
    
    // Create dedicated median line SVG layer
    this._createMedianLineSVG(container, chartArea);
    
    // Calculate median and render line
    this._calculateMedian();
    this._renderMedianLine();
    
    this.isRendered = true;
    
    // Show/hide based on current state
    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
    
    console.log(`MedianLine rendered with median: ${this.currentMedian}`);
  }
  
  /**
   * Show median line
   */
  show() {
    if (!this.isRendered) {
      console.warn('MedianLine: Must render before showing');
      return false;
    }
    
    // Check if median is within visible Y range
    if (!this._isMedianInRange()) {
      console.log('MedianLine: Median value not in visible range, hiding line');
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
   * Hide median line
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
   * Toggle median line visibility
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
      this._renderMedianLine();
      
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
      this._renderMedianLine();
    }
  }
  
  /**
   * Update styling/configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    if (this.isRendered) {
      this._renderMedianLine();
    }
  }
  
  /**
   * Get current median value
   * @returns {number|null} Current calculated median
   */
  getMedianValue() {
    return this.currentMedian;
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
      currentMedian: this.currentMedian,
      medianInRange: this._isMedianInRange()
    };
  }
  
  /**
   * Calculate median value from datasets
   * @private
   */
  _calculateMedian() {
    this.currentMedian = null;
    
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
        this.currentMedian = median(allValues);
        console.log(`MedianLine: Calculated median ${this.currentMedian} from ${allValues.length} values across ${this.datasets.length} datasets`);
      }
      
    } catch (error) {
      console.error('Error calculating median:', error);
      this.currentMedian = null;
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
   * Create dedicated SVG element for median line
   * @private
   */
  _createMedianLineSVG(container, chartArea) {
    // Create SVG element with z-index: 1.7 (between average line and data)
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.7';  // Between average line (1.6) and data (2)
    this.svgElement.style.pointerEvents = 'none'; // Don't interfere with interactions
    this.svgElement.setAttribute('class', 'median-line-svg');
    
    // Create group for median line elements
    this.medianLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.medianLineGroup.setAttribute('class', 'visioncharts-median-line-group');
    this.svgElement.appendChild(this.medianLineGroup);
    
    // Add to container
    container.appendChild(this.svgElement);
    
    console.log('MedianLine SVG layer created with z-index: 1.7');
  }
  
  /**
   * Render the median line using chart scales
   * @private
   */
  _renderMedianLine() {
    if (!this.medianLineGroup || !this.scales || !this.chartArea || this.currentMedian == null) {
      return;
    }
    
    // Clear existing elements
    this.medianLineGroup.innerHTML = '';
    this.lineElement = null;
    this.labelElement = null;
    
    // Check if median is in Y domain
    if (!this._isMedianInRange()) {
      console.log('MedianLine: Median not in Y domain, skipping render');
      return;
    }
    
    try {
      // Convert median value to pixel coordinates using chart scales
      const medianY = this.scales.y.scale(this.currentMedian);
      
      // Ensure line is within chart area
      if (medianY < this.chartArea.y || medianY > this.chartArea.y + this.chartArea.height) {
        console.log('MedianLine: Median line outside chart area bounds');
        return;
      }
      
      // Create the horizontal line
      this._createMedianLineElement(medianY);
      
      // Create label if enabled
      if (this.config.showLabel) {
        this._createMedianLabelElement(medianY);
      }
      
    } catch (error) {
      console.error('Error rendering median line:', error);
    }
  }
  
  /**
   * Create the actual line element
   * @private
   */
  _createMedianLineElement(medianY) {
    this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineElement.setAttribute('class', 'visioncharts-median-line-line');
    this.lineElement.setAttribute('x1', this.chartArea.x);
    this.lineElement.setAttribute('x2', this.chartArea.x + this.chartArea.width);
    this.lineElement.setAttribute('y1', medianY);
    this.lineElement.setAttribute('y2', medianY);
    this.lineElement.setAttribute('stroke', this.config.strokeColor);
    this.lineElement.setAttribute('stroke-width', this.config.strokeWidth);
    this.lineElement.setAttribute('stroke-opacity', this.config.strokeOpacity);
    this.lineElement.setAttribute('shape-rendering', 'geometricPrecision');
    
    if (this.config.strokeDash.length > 0) {
      this.lineElement.setAttribute('stroke-dasharray', this.config.strokeDash.join(' '));
    }
    
    this.medianLineGroup.appendChild(this.lineElement);
  }
  
  /**
   * Create the label element with smart positioning
   * @private
   */
  _createMedianLabelElement(medianY) {
    this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.labelElement.setAttribute('class', 'visioncharts-median-line-label');
    
    // Calculate label position with overlap detection
    const labelPosition = this._calculateLabelPosition(medianY);
    
    this.labelElement.setAttribute('x', labelPosition.x);
    this.labelElement.setAttribute('y', labelPosition.y);
    this.labelElement.setAttribute('font-size', this.config.labelFontSize);
    this.labelElement.setAttribute('font-family', 'Arial, sans-serif');
    this.labelElement.setAttribute('font-weight', '500');
    this.labelElement.setAttribute('fill', this.config.labelColor);
    this.labelElement.setAttribute('dominant-baseline', 'central');
    this.labelElement.setAttribute('text-anchor', 'start');
    
    // Format the median value for display
    const formattedMedian = this._formatValue(this.currentMedian);
    this.labelElement.textContent = `${this.config.labelText}: ${formattedMedian}`;
    
    this.medianLineGroup.appendChild(this.labelElement);
  }
  
  /**
   * Calculate label position with overlap avoidance
   * @private
   */
  _calculateLabelPosition(lineY) {
    // Base position - right side of chart, below the line
    let labelX = this.chartArea.x + this.chartArea.width + this.config.labelOffset;
    let labelY = lineY + this.config.labelVerticalOffset;
    
    // Check for overlaps with sibling lines
    const overlappingSibling = this._findOverlappingSibling(lineY);
    
    if (overlappingSibling) {
      // Adjust position to avoid overlap
      const siblingY = this.scales.y.scale(overlappingSibling.getCurrentValue());
      
      if (this.currentMedian > overlappingSibling.getCurrentValue()) {
        // This line is higher, position above
        labelY = lineY - Math.abs(this.config.labelVerticalOffset) - 5;
      } else {
        // This line is lower, position below  
        labelY = lineY + Math.abs(this.config.labelVerticalOffset) + 5;
      }
      
      console.log('MedianLine: Adjusted label position to avoid overlap');
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
   * @returns {number|null} Current median value
   */
  getCurrentValue() {
    return this.currentMedian;
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
   * Check if median is within the Y scale domain
   * @private
   */
  _isMedianInRange() {
    if (!this.scales || !this.scales.y || this.currentMedian == null) {
      return false;
    }
    
    const yDomain = this.scales.y.domain;
    return (this.currentMedian >= yDomain[0] && this.currentMedian <= yDomain[1]);
  }
  
  /**
   * Remove median line SVG from DOM
   * @private
   */
  _remove() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }
    
    this.svgElement = null;
    this.medianLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    this.isRendered = false;
  }
  
  /**
   * Destroy median line and clean up resources
   */
  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.datasets = [];
    this.currentMedian = null;
    this.isVisible = false;
    this.siblingLines.clear();
    
    console.log('MedianLine destroyed');
  }
}
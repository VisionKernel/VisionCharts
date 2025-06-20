/**
 * EndingLabels Component
 * Renders labels showing the ending value (most recent datapoint) for line charts
 * Supports both single panel and multi-panel modes
 */

import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber } from '../utils/chartUtils.js';

export default class EndingLabels {
  /**
   * Create an ending labels instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      show: true,
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      borderWidth: 1,
      borderRadius: 3,
      padding: { top: 2, right: 6, bottom: 2, left: 6 },
      offsetX: 8, // Distance from the last point
      offsetY: 0,
      textColor: null, // If null, uses dataset color
      showBorder: true,
      showBackground: true,
      ...options
    };
    
    this.elements = [];
  }
  
  /**
   * Render ending labels for single panel mode
   * @param {Object} chart - Chart instance
   * @param {SVGElement} container - Container element
   */
  renderForSinglePanel(chart, container) {
    console.log('EndingLabels.renderForSinglePanel called');
    
    if (!this.options.show || !chart.state.datasets || !container) {
      console.log('EndingLabels: Skipping render - missing requirements');
      return;
    }
    
    // Clear existing elements
    this.remove();
    
    // Only render for regular datasets (not studies)
    const regularDatasets = chart.state.datasets.filter(dataset => 
      dataset.type !== 'study' && dataset.data && dataset.data.length > 0
    );
    
    console.log('EndingLabels: Rendering for', regularDatasets.length, 'datasets');
    
    regularDatasets.forEach(dataset => {
      this.renderDatasetEndingLabel(chart, dataset, container, chart.state.scales);
    });
  }
  
  /**
   * Render ending label for panel mode
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to render label for
   * @param {SVGElement} container - Panel container element
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   */
  renderForPanel(chart, dataset, container, xScale, yScale) {
    console.log('EndingLabels.renderForPanel called for dataset:', dataset.id);
    
    if (!this.options.show || !dataset || !container) {
      console.log('EndingLabels: Skipping panel render - missing requirements');
      return;
    }
    
    // Don't render for study datasets
    if (dataset.type === 'study') {
      console.log('EndingLabels: Skipping study dataset');
      return;
    }
    
    const scales = { x: xScale, y: yScale };
    this.renderDatasetEndingLabel(chart, dataset, container, scales);
  }
  
  /**
   * Render ending label for a specific dataset
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to render label for
   * @param {SVGElement} container - Container element
   * @param {Object} scales - Chart scales {x, y}
   */
  renderDatasetEndingLabel(chart, dataset, container, scales) {
    if (!dataset.data || dataset.data.length === 0) {
      console.log('EndingLabels: No data for dataset', dataset.id);
      return;
    }
    
    const { xField, yField } = chart.options;
    
    // Get the last valid data point
    const lastPoint = this.getLastValidPoint(dataset.data, xField, yField);
    if (!lastPoint) {
      console.log('EndingLabels: No valid last point for dataset', dataset.id);
      return;
    }
    
    // Get coordinates
    const x = scales.x.scale(lastPoint[xField]);
    const y = scales.y.scale(lastPoint[yField]);
    
    // Check if coordinates are valid and within bounds
    if (isNaN(x) || isNaN(y)) {
      console.log('EndingLabels: Invalid coordinates for dataset', dataset.id);
      return;
    }
    
    // Format the value
    const formattedValue = this.formatValue(lastPoint[yField], chart.options);
    
    console.log('EndingLabels: Creating label for dataset', dataset.id, 'value:', formattedValue);
    
    // Create label group
    const labelGroup = SvgRenderer.createGroup({
      class: 'visioncharts-ending-label',
      'data-dataset-id': dataset.id
    });
    
    // Calculate label position
    const labelX = x + this.options.offsetX;
    const labelY = y + this.options.offsetY;
    
    // Create text element first to measure dimensions
    const textElement = SvgRenderer.createText(
      formattedValue,
      0, 0,
      {
        'font-size': this.options.fontSize,
        'font-family': this.options.fontFamily,
        'font-weight': this.options.fontWeight,
        fill: this.options.textColor || dataset.color,
        'dominant-baseline': 'middle',
        'text-anchor': 'start',
        class: 'visioncharts-ending-label-text'
      }
    );
    
    // Add to container temporarily to measure
    const tempGroup = SvgRenderer.createGroup({ opacity: 0 });
    tempGroup.appendChild(textElement);
    container.appendChild(tempGroup);
    
    // Get text dimensions
    let textBBox;
    try {
      textBBox = textElement.getBBox();
    } catch (error) {
      // Fallback dimensions if getBBox fails
      textBBox = {
        width: formattedValue.length * 7, // Approximate width
        height: 12 // Approximate height
      };
    }
    
    // Remove temp group
    container.removeChild(tempGroup);
    
    // Calculate background dimensions
    const bgWidth = textBBox.width + this.options.padding.left + this.options.padding.right;
    const bgHeight = textBBox.height + this.options.padding.top + this.options.padding.bottom;
    const bgX = labelX;
    const bgY = labelY - bgHeight / 2;
    
    // Create background rectangle if enabled
    if (this.options.showBackground || this.options.showBorder) {
      const backgroundAttrs = {
        class: 'visioncharts-ending-label-bg'
      };
      
      if (this.options.showBackground) {
        backgroundAttrs.fill = this.options.backgroundColor;
      } else {
        backgroundAttrs.fill = 'none';
      }
      
      if (this.options.showBorder) {
        backgroundAttrs.stroke = this.options.borderColor;
        backgroundAttrs['stroke-width'] = this.options.borderWidth;
      }
      
      if (this.options.borderRadius > 0) {
        backgroundAttrs.rx = this.options.borderRadius;
        backgroundAttrs.ry = this.options.borderRadius;
      }
      
      const background = SvgRenderer.createRect(
        bgX, bgY, bgWidth, bgHeight,
        backgroundAttrs
      );
      
      labelGroup.appendChild(background);
    }
    
    // Position and add text
    textElement.setAttribute('x', bgX + this.options.padding.left);
    textElement.setAttribute('y', labelY);
    labelGroup.appendChild(textElement);
    
    // Add to container
    container.appendChild(labelGroup);
    this.elements.push(labelGroup);
    
    console.log('EndingLabels: Label created for dataset', dataset.id, 'at position', labelX, labelY);
  }
  
  /**
   * Get the last valid data point from dataset
   * @private
   * @param {Array} data - Dataset data
   * @param {string} xField - X field name
   * @param {string} yField - Y field name
   * @returns {Object|null} Last valid data point or null
   */
  getLastValidPoint(data, xField, yField) {
    for (let i = data.length - 1; i >= 0; i--) {
      const point = data[i];
      if (point[xField] !== undefined && point[xField] !== null &&
          point[yField] !== undefined && point[yField] !== null &&
          typeof point[yField] === 'number' && !isNaN(point[yField])) {
        return point;
      }
    }
    return null;
  }
  
  /**
   * Format value for display
   * @private
   * @param {number} value - Value to format
   * @param {Object} chartOptions - Chart options for formatting context
   * @returns {string} Formatted value
   */
  formatValue(value, chartOptions) {
    const { yType, yFormatOptions } = chartOptions;
    
    if (yType === 'percent' || yType === 'percentage') {
      return (value * 100).toFixed(1) + '%';
    } else if (yType === 'currency') {
      return '$' + formatLargeNumber(value);
    } else {
      return formatLargeNumber(value);
    }
  }
  
  /**
   * Remove all ending labels
   * @public
   */
  remove() {
    this.elements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.elements = [];
  }
  
  /**
   * Update configuration
   * @public
   * @param {Object} newOptions - New configuration options
   */
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
  
  /**
   * Show ending labels
   * @public
   */
  show() {
    this.elements.forEach(element => {
      if (element) {
        element.style.display = 'block';
      }
    });
  }
  
  /**
   * Hide ending labels
   * @public
   */
  hide() {
    this.elements.forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
  }
  
  /**
   * Static method for rendering in panels (used by PanelDataRenderer)
   * @static
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to render label for
   * @param {SVGElement} container - Panel container
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {Object} options - Configuration options
   * @returns {EndingLabels} EndingLabels instance
   */
  static renderForPanel(chart, dataset, container, xScale, yScale, options = {}) {
    const endingLabels = new EndingLabels(options);
    endingLabels.renderForPanel(chart, dataset, container, xScale, yScale);
    return endingLabels;
  }
}
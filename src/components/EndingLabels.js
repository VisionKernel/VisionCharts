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
    
    // FIXED: Include ALL datasets (regular + studies) with data
    const allDatasets = chart.state.datasets.filter(dataset => 
      dataset.data && dataset.data.length > 0
    );
    
    // Separate regular datasets and studies for proper ordering
    const regularDatasets = allDatasets.filter(dataset => dataset.type !== 'study');
    const studyDatasets = allDatasets.filter(dataset => dataset.type === 'study');
    
    console.log('EndingLabels: Rendering for', regularDatasets.length, 'regular datasets and', studyDatasets.length, 'studies');
    
    // Render regular datasets first
    regularDatasets.forEach(dataset => {
      this.renderDatasetEndingLabel(chart, dataset, container, chart.state.scales, false);
    });
    
    // Then render studies with visual distinction
    studyDatasets.forEach(dataset => {
      this.renderDatasetEndingLabel(chart, dataset, container, chart.state.scales, true);
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
    console.log('EndingLabels.renderForPanel called for dataset:', dataset.id, 'type:', dataset.type || 'regular');
    
    if (!this.options.show || !dataset || !container) {
      console.log('EndingLabels: Skipping panel render - missing requirements');
      return;
    }
    
    // FIXED: Remove the study filter - now includes studies
    // Old code: if (dataset.type === 'study') { return; }
    
    const scales = { x: xScale, y: yScale };
    const isStudy = dataset.type === 'study';
    this.renderDatasetEndingLabel(chart, dataset, container, scales, isStudy);
  }
  
  /**
   * Render ending label for a specific dataset
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to render label for
   * @param {SVGElement} container - Container element
   * @param {Object} scales - Chart scales {x, y}
   * @param {boolean} isStudy - Whether this is a study dataset
   */
  renderDatasetEndingLabel(chart, dataset, container, scales, isStudy = false) {
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
    
    // Check if coordinates are valid
    if (isNaN(x) || isNaN(y)) {
      console.log('EndingLabels: Invalid coordinates for dataset', dataset.id);
      return;
    }
    
    // Format the value
    const formattedValue = this.formatValue(lastPoint[yField], chart.options);
    
    console.log('EndingLabels: Creating label for', isStudy ? 'study' : 'dataset', dataset.id, 'value:', formattedValue);
    
    // ENHANCED: Study-specific styling
    const labelOptions = this.getStudyAwareLabelOptions(isStudy);
    
    // Create label group
    const labelGroup = SvgRenderer.createGroup({
      class: `visioncharts-ending-label ${isStudy ? 'study-label' : 'regular-label'}`,
      'data-dataset-id': dataset.id,
      'data-is-study': isStudy
    });
    
    // ENHANCED: Check for overlapping labels and add vertical offset
    const verticalOffset = this.calculateVerticalOffset(container, x, y, isStudy);
    const adjustedY = y + verticalOffset;
    
    // Create text element first to measure dimensions
    const displayText = isStudy ? `📊 ${formattedValue}` : formattedValue;
    const textElement = SvgRenderer.createText(
      displayText,
      0, 0,
      {
        'font-size': labelOptions.fontSize,
        'font-family': labelOptions.fontFamily,
        'font-weight': labelOptions.fontWeight,
        fill: labelOptions.textColor || dataset.color,
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
        width: displayText.length * (isStudy ? 6 : 7), // Slightly smaller for studies
        height: isStudy ? 10 : 12
      };
    }
    
    // Remove temp group
    container.removeChild(tempGroup);
    
    // Calculate background dimensions
    const bgWidth = textBBox.width + labelOptions.padding.left + labelOptions.padding.right;
    const bgHeight = textBBox.height + labelOptions.padding.top + labelOptions.padding.bottom;
    
    // Get container bounds for boundary checking
    const containerWidth = chart.state.dimensions?.innerWidth || 800;
    const availableRightSpace = containerWidth - x;
    
    // Calculate label position with boundary checking
    let labelX, labelY;
    let textAnchor = 'start';
    
    if (availableRightSpace >= bgWidth + labelOptions.offsetX) {
      // Enough space to the right - position normally
      labelX = x + labelOptions.offsetX;
      textAnchor = 'start';
    } else {
      // Not enough space to the right - position to the left
      labelX = x - labelOptions.offsetX - bgWidth;
      textAnchor = 'start';
      
      // If still goes off the left edge, clamp to minimum position
      if (labelX < 0) {
        labelX = Math.max(5, x - bgWidth/2);
        textAnchor = 'start';
      }
    }
    
    labelY = adjustedY + labelOptions.offsetY;
    
    const bgX = labelX;
    const bgY = labelY - bgHeight / 2;
    
    // Create background rectangle if enabled
    if (labelOptions.showBackground || labelOptions.showBorder) {
      const backgroundAttrs = {
        class: 'visioncharts-ending-label-bg'
      };
      
      if (labelOptions.showBackground) {
        backgroundAttrs.fill = labelOptions.backgroundColor;
      } else {
        backgroundAttrs.fill = 'none';
      }
      
      if (labelOptions.showBorder) {
        backgroundAttrs.stroke = labelOptions.borderColor;
        backgroundAttrs['stroke-width'] = labelOptions.borderWidth;
      }
      
      if (labelOptions.borderRadius > 0) {
        backgroundAttrs.rx = labelOptions.borderRadius;
        backgroundAttrs.ry = labelOptions.borderRadius;
      }
      
      // ENHANCED: Semi-transparent background for studies
      if (isStudy && labelOptions.showBackground) {
        backgroundAttrs['fill-opacity'] = 0.9;
      }
      
      const background = SvgRenderer.createRect(
        bgX, bgY, bgWidth, bgHeight,
        backgroundAttrs
      );
      
      labelGroup.appendChild(background);
    }
    
    // Position and add text
    textElement.setAttribute('x', bgX + labelOptions.padding.left);
    textElement.setAttribute('y', labelY);
    textElement.setAttribute('text-anchor', textAnchor);
    labelGroup.appendChild(textElement);
    
    // Add to container
    container.appendChild(labelGroup);
    this.elements.push(labelGroup);
    
    console.log('EndingLabels: Label created for', isStudy ? 'study' : 'dataset', dataset.id, 'at position', labelX, labelY, 'with offset', verticalOffset);
  }
  
  /**
   * NEW METHOD: Get study-aware label styling options
   * @private
   * @param {boolean} isStudy - Whether this is a study dataset
   * @returns {Object} Label options with study-specific styling
   */
  getStudyAwareLabelOptions(isStudy) {
    const baseOptions = { ...this.options };
    
    if (isStudy) {
      return {
        ...baseOptions,
        fontSize: '10px',           // Smaller font for studies
        fontWeight: 'normal',       // Normal weight for studies
        backgroundColor: '#f8f9fa', // Light gray background
        borderColor: '#6c757d',     // Darker gray border
        borderWidth: 1,
        padding: { top: 1, right: 4, bottom: 1, left: 4 }, // Smaller padding
        offsetX: 6,                 // Closer to the line
        offsetY: 0
      };
    }
    
    return baseOptions;
  }
  
  /**
   * NEW METHOD: Calculate vertical offset to prevent overlapping labels
   * @private
   * @param {SVGElement} container - Container element
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate  
   * @param {boolean} isStudy - Whether this is a study dataset
   * @returns {number} Vertical offset to apply
   */
  calculateVerticalOffset(container, x, y, isStudy) {
    // Get existing labels in this container
    const existingLabels = container.querySelectorAll('.visioncharts-ending-label');
    
    let verticalOffset = 0;
    const proximityThreshold = 50; // Labels within 50px horizontally
    const verticalSpacing = isStudy ? 16 : 20; // Studies get tighter spacing
    
    existingLabels.forEach(existingLabel => {
      const existingText = existingLabel.querySelector('text');
      if (!existingText) return;
      
      const existingX = parseFloat(existingText.getAttribute('x')) || 0;
      const existingY = parseFloat(existingText.getAttribute('y')) || 0;
      
      // Check if this label is close horizontally
      if (Math.abs(existingX - x) < proximityThreshold) {
        // Check if it would overlap vertically
        const potentialY = y + verticalOffset;
        if (Math.abs(existingY - potentialY) < verticalSpacing) {
          // Adjust offset to avoid overlap
          if (isStudy) {
            // Studies go below regular datasets
            verticalOffset = Math.max(verticalOffset, existingY + verticalSpacing - y);
          } else {
            // Regular datasets go above studies
            verticalOffset = Math.min(verticalOffset, existingY - verticalSpacing - y);
          }
        }
      }
    });
    
    return verticalOffset;
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
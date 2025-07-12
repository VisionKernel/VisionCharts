/**
 * EndingLabels Component
 * Renders labels showing the ending value (most recent datapoint) for line charts
 * Supports both single panel and multi-panel modes
 */

import { formatLargeNumber } from '../utils/chartUtils.js';

export class EndingLabels {
  constructor(config = {}) {
    this.config = {
      // Positioning and layout
      offsetX: 8,           // Horizontal offset from the last data point
      offsetY: 0,           // Vertical offset from the last data point
      
      // Styling
      fontSize: 11,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '500',
      
      // Background styling
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backgroundPadding: 4,
      borderRadius: 3,
      borderWidth: 1,
      
      // Text formatting
      formatValue: true,      // Use smart number formatting
      decimals: 1,           // Decimal places for raw numbers
      
      // Behavior
      enabled: false,        // Start disabled
      
      ...config
    };
    
    // DOM elements
    this.svgGroup = null;
    this.labelElements = [];
    
    // Chart integration
    this.chartArea = null;
    this.datasets = [];
    
    // State
    this.isVisible = false;
    this.isRendered = false;
    
    console.log('EndingLabels component created');
  }

  /**
   * Update datasets and re-render labels
   * @param {Array} datasets - Array of dataset objects with data
   */
  updateDatasets(datasets) {
    this.datasets = datasets || [];
    
    if (this.isRendered && this.isVisible) {
      this._renderLabels();
    }
  }

  /**
   * Render ending labels to SVG container
   * @param {SVGElement} svgContainer - SVG element to render into
   * @param {Object} chartArea - Chart area dimensions
   */
  render(svgContainer, chartArea) {
    if (!svgContainer || !chartArea) {
      console.warn('EndingLabels: SVG container and chart area required for rendering');
      return;
    }

    this.chartArea = chartArea;
    this.svgContainer = svgContainer;

    // Remove existing labels
    this._remove();

    // Create labels group
    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', 'ending-labels');
    this.svgGroup.style.pointerEvents = 'none'; // Don't interfere with interactions

    // Add to SVG
    svgContainer.appendChild(this.svgGroup);

    this.isRendered = true;

    // Render labels if visible and we have datasets
    if (this.config.enabled && this.datasets.length > 0) {
      this.show();
    } else {
      this.hide();
    }

    console.log(`EndingLabels rendered for ${this.datasets.length} datasets`);
  }

  /**
   * Show ending labels
   */
  show() {
    if (!this.isRendered) {
      console.warn('EndingLabels: Must render before showing');
      return false;
    }

    this.config.enabled = true;
    this.isVisible = true;

    if (this.svgGroup) {
      this.svgGroup.style.display = 'block';
      this._renderLabels();
    }

    return true;
  }

  /**
   * Hide ending labels
   */
  hide() {
    this.config.enabled = false;
    this.isVisible = false;

    if (this.svgGroup) {
      this.svgGroup.style.display = 'none';
    }

    return true;
  }

  /**
   * Toggle ending labels visibility
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
   * Render labels for all datasets
   * @private
   */
  _renderLabels() {
    if (!this.svgGroup) return;

    // Clear existing labels
    this.svgGroup.innerHTML = '';
    this.labelElements = [];

    // Don't render if no datasets
    if (!this.datasets || this.datasets.length === 0) {
      return;
    }

    // Create label for each dataset
    this.datasets.forEach((dataset, index) => {
      const label = this._createDatasetLabel(dataset, index);
      if (label) {
        this.svgGroup.appendChild(label);
        this.labelElements.push(label);
      }
    });

    console.log(`EndingLabels: Rendered ${this.labelElements.length} labels`);
  }

  /**
   * Create ending label for a single dataset
   * @private
   */
  _createDatasetLabel(dataset, datasetIndex) {
    if (!dataset || !dataset.data || dataset.data.length === 0) {
      return null;
    }

    // Get the last data point
    const lastPoint = dataset.data[dataset.data.length - 1];
    if (!lastPoint) return null;

    // Extract coordinates - check for unified coordinates first
    const endX = lastPoint.unifiedX || lastPoint.screenX || lastPoint.pixelX;
    const endY = lastPoint.unifiedY || lastPoint.screenY || lastPoint.pixelY;

    if (endX == null || endY == null || !isFinite(endX) || !isFinite(endY)) {
      console.warn(`EndingLabels: Invalid coordinates for dataset ${dataset.id || datasetIndex}`);
      return null;
    }

    // Check if point is within chart area (with some tolerance for labels extending beyond)
    const tolerance = 50;
    if (endX < this.chartArea.x - tolerance || 
        endX > this.chartArea.x + this.chartArea.width + tolerance ||
        endY < this.chartArea.y - tolerance || 
        endY > this.chartArea.y + this.chartArea.height + tolerance) {
      console.log(`EndingLabels: Point outside chart area for dataset ${dataset.id || datasetIndex}`);
      return null;
    }

    // Extract and format the value
    const value = this._extractValue(lastPoint);
    if (value == null) {
      console.warn(`EndingLabels: No valid value for dataset ${dataset.id || datasetIndex}`);
      return null;
    }

    const formattedValue = this._formatValue(value);

    // Get dataset color
    const color = dataset.color || '#1468a8';

    // Create label group
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'ending-label');
    labelGroup.setAttribute('data-dataset-id', dataset.id || datasetIndex);

    // Calculate label position
    const labelX = endX + this.config.offsetX;
    const labelY = endY + this.config.offsetY;

    // Create background if enabled
    if (this.config.showBackground) {
      const background = this._createLabelBackground(labelGroup, labelX, labelY, formattedValue, color);
      if (background) {
        labelGroup.appendChild(background);
      }
    }

    // Create text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelX + this.config.backgroundPadding);
    text.setAttribute('y', labelY);
    text.setAttribute('font-size', this.config.fontSize);
    text.setAttribute('font-family', this.config.fontFamily);
    text.setAttribute('font-weight', this.config.fontWeight);
    text.setAttribute('fill', this._getTextColor(color));
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('text-anchor', 'start');
    text.textContent = formattedValue;

    labelGroup.appendChild(text);

    return labelGroup;
  }

  /**
   * Create background rectangle for label
   * @private
   */
  _createLabelBackground(labelGroup, x, y, text, datasetColor) {
    // Estimate text dimensions (rough approximation)
    const charWidth = this.config.fontSize * 0.6;
    const textWidth = text.length * charWidth;
    const textHeight = this.config.fontSize;

    const bgWidth = textWidth + (this.config.backgroundPadding * 2);
    const bgHeight = textHeight + (this.config.backgroundPadding * 2);

    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', x);
    background.setAttribute('y', y - (bgHeight / 2));
    background.setAttribute('width', bgWidth);
    background.setAttribute('height', bgHeight);
    background.setAttribute('fill', this.config.backgroundColor);
    background.setAttribute('stroke', datasetColor);
    background.setAttribute('stroke-width', this.config.borderWidth);
    background.setAttribute('rx', this.config.borderRadius);

    // Store dimensions for text positioning adjustment
    labelGroup._backgroundWidth = bgWidth;
    labelGroup._backgroundHeight = bgHeight;

    return background;
  }

  /**
   * Extract value from data point
   * @private
   */
  _extractValue(point) {
    // Try different common field names for the value
    const value = point.y || point.value || point.price || point.close || point.amount;
    
    if (typeof value === 'number' && isFinite(value)) {
      return value;
    }

    return null;
  }

  /**
   * Format value for display
   * @private
   */
  _formatValue(value) {
    if (value == null || !isFinite(value)) {
      return 'N/A';
    }

    if (this.config.formatValue) {
      // Use smart formatting from chartUtils
      return formatLargeNumber(value, { decimals: this.config.decimals });
    } else {
      // Simple decimal formatting
      return value.toFixed(this.config.decimals);
    }
  }

  /**
   * Get appropriate text color based on background
   * @private
   */
  _getTextColor(datasetColor) {
    // For now, use dataset color for text
    // In the future, could calculate contrast ratio for better readability
    return datasetColor;
  }

  /**
   * Update ending labels when dataset changes
   * @param {string} datasetId - ID of dataset that changed
   * @param {string} newColor - New color value
   */
  updateDatasetColor(datasetId, newColor) {
    // Find the label for this dataset and update its color
    const labelElement = this.svgGroup?.querySelector(`[data-dataset-id="${datasetId}"]`);
    if (labelElement) {
      const textElement = labelElement.querySelector('text');
      const backgroundElement = labelElement.querySelector('rect');
      
      if (textElement) {
        textElement.setAttribute('fill', this._getTextColor(newColor));
      }
      
      if (backgroundElement) {
        backgroundElement.setAttribute('stroke', newColor);
      }
    }
  }

  /**
   * Get ending labels state
   */
  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      labelCount: this.labelElements.length,
      datasetCount: this.datasets.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    if (this.isRendered && this.isVisible) {
      this._renderLabels();
    }
  }

  /**
   * Remove ending labels from DOM
   * @private
   */
  _remove() {
    if (this.svgGroup && this.svgGroup.parentElement) {
      this.svgGroup.parentElement.removeChild(this.svgGroup);
    }

    this.svgGroup = null;
    this.labelElements = [];
    this.isRendered = false;
  }

  /**
   * Destroy ending labels and clean up
   */
  destroy() {
    this._remove();
    this.datasets = [];
    this.chartArea = null;
    this.svgContainer = null;
    this.isVisible = false;

    console.log('EndingLabels destroyed');
  }
}
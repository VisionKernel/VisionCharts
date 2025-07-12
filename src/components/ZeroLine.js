/**
 * ZeroLine component for charts
 * Renders a horizontal line at y=0 value for reference
 * Integrates with the unified coordinate system and chart scales
 */

export class ZeroLine {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      strokeColor: '#000000',        // Default black line
      strokeWidth: 1,                // Line thickness
      strokeOpacity: 1,           // Line opacity
      strokeDash: [3, 3],           // Dashed line pattern
      
      // Behavior
      enabled: false,               // Start disabled
      
      // Label options
      showLabel: false,             // Whether to show "0" label
      labelText: '0',               // Text to show
      labelOffset: 5,               // Pixels from line
      labelColor: '#000000',        // Label text color
      labelFontSize: 11,           // Label font size
      
      ...config
    };
    
    // SVG elements
    this.svgElement = null;
    this.zeroLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    
    // Chart integration
    this.scales = null;
    this.chartArea = null;
    
    // State
    this.isVisible = false;
    this.isRendered = false;
    
    console.log('ZeroLine component created');
  }
  
  /**
   * Initialize and render zero line in dedicated SVG
   * @param {HTMLElement} container - Container to add SVG to
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} scales - Chart scales for coordinate conversion
   */
  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      console.warn('ZeroLine: Container, chart area, and scales required');
      return;
    }
    
    this.chartArea = chartArea;
    this.scales = scales;
    
    // Remove existing SVG if present
    this._remove();
    
    // Create dedicated zero line SVG layer
    this._createZeroLineSVG(container, chartArea);
    
    // Render zero line if it should be visible
    this._renderZeroLine();
    
    this.isRendered = true;
    
    // Show/hide based on current state
    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
    
    console.log('ZeroLine rendered');
  }
  
  /**
   * Show zero line
   */
  show() {
    if (!this.isRendered) {
      console.warn('ZeroLine: Must render before showing');
      return false;
    }
    
    // Check if zero is within visible Y range
    const yScale = this.scales.y;
    if (!yScale) {
      console.warn('ZeroLine: Y scale not available');
      return false;
    }
    
    const yDomain = yScale.domain;
    const zeroInRange = (0 >= yDomain[0] && 0 <= yDomain[1]);
    
    if (!zeroInRange) {
      console.log('ZeroLine: Zero value not in visible range, hiding line');
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
   * Hide zero line
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
   * Toggle zero line visibility
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
      this._renderZeroLine();
      
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
      this._renderZeroLine();
    }
  }
  
  /**
   * Update styling/configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    if (this.isRendered) {
      this._renderZeroLine();
    }
  }
  
  /**
   * Get current zero line component state
   */
  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      hasScales: !!this.scales,
      hasChartArea: !!this.chartArea,
      zeroInRange: this._isZeroInRange()
    };
  }
  
  /**
   * Create dedicated SVG element for zero line
   * @private
   */
  _createZeroLineSVG(container, chartArea) {
    // Create SVG element with z-index: 1.5 (between grid and data)
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.5';  // Between grid (0) and data (2)
    this.svgElement.style.pointerEvents = 'none'; // Don't interfere with interactions
    this.svgElement.setAttribute('class', 'zero-line-svg');
    
    // Create group for zero line elements
    this.zeroLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.zeroLineGroup.setAttribute('class', 'zero-line-group');
    this.svgElement.appendChild(this.zeroLineGroup);
    
    // Add to container
    container.appendChild(this.svgElement);
    
    console.log('ZeroLine SVG layer created with z-index: 1.5');
  }
  
  /**
   * Render the zero line using chart scales
   * @private
   */
  _renderZeroLine() {
    if (!this.zeroLineGroup || !this.scales || !this.chartArea) {
      return;
    }
    
    // Clear existing elements
    this.zeroLineGroup.innerHTML = '';
    this.lineElement = null;
    this.labelElement = null;
    
    // Check if zero is in Y domain
    if (!this._isZeroInRange()) {
      console.log('ZeroLine: Zero not in Y domain, skipping render');
      return;
    }
    
    try {
      // Convert y=0 to pixel coordinates using chart scales
      const zeroY = this.scales.y.scale(0);
      
      // Ensure line is within chart area
      if (zeroY < this.chartArea.y || zeroY > this.chartArea.y + this.chartArea.height) {
        console.log('ZeroLine: Zero line outside chart area bounds');
        return;
      }
      
      // Create the horizontal line
      this._createZeroLineElement(zeroY);
      
      // Create label if enabled
      if (this.config.showLabel) {
        this._createZeroLabelElement(zeroY);
      }
      
    } catch (error) {
      console.error('Error rendering zero line:', error);
    }
  }
  
  /**
   * Create the actual line element
   * @private
   */
  _createZeroLineElement(zeroY) {
    this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineElement.setAttribute('class', 'zero-line');
    this.lineElement.setAttribute('x1', this.chartArea.x);
    this.lineElement.setAttribute('x2', this.chartArea.x + this.chartArea.width);
    this.lineElement.setAttribute('y1', zeroY);
    this.lineElement.setAttribute('y2', zeroY);
    this.lineElement.setAttribute('stroke', this.config.strokeColor);
    this.lineElement.setAttribute('stroke-width', this.config.strokeWidth);
    this.lineElement.setAttribute('stroke-opacity', this.config.strokeOpacity);
    this.lineElement.setAttribute('shape-rendering', 'crispEdges');
    
    if (this.config.strokeDash.length > 0) {
      this.lineElement.setAttribute('stroke-dasharray', this.config.strokeDash.join(' '));
    }
    
    this.zeroLineGroup.appendChild(this.lineElement);
  }
  
  /**
   * Create the label element
   * @private
   */
  _createZeroLabelElement(zeroY) {
    this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.labelElement.setAttribute('class', 'zero-line-label');
    this.labelElement.setAttribute('x', this.chartArea.x + this.chartArea.width + this.config.labelOffset);
    this.labelElement.setAttribute('y', zeroY);
    this.labelElement.setAttribute('font-size', this.config.labelFontSize);
    this.labelElement.setAttribute('font-family', 'Arial, sans-serif');
    this.labelElement.setAttribute('fill', this.config.labelColor);
    this.labelElement.setAttribute('dominant-baseline', 'central');
    this.labelElement.setAttribute('text-anchor', 'start');
    this.labelElement.textContent = this.config.labelText;
    
    this.zeroLineGroup.appendChild(this.labelElement);
  }
  
  /**
   * Check if zero is within the Y scale domain
   * @private
   */
  _isZeroInRange() {
    if (!this.scales || !this.scales.y) {
      return false;
    }
    
    const yDomain = this.scales.y.domain;
    return (0 >= yDomain[0] && 0 <= yDomain[1]);
  }
  
  /**
   * Remove zero line SVG from DOM
   * @private
   */
  _remove() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }
    
    this.svgElement = null;
    this.zeroLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    this.isRendered = false;
  }
  
  /**
   * Destroy zero line and clean up resources
   */
  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.isVisible = false;
    
    console.log('ZeroLine destroyed');
  }
}
/**
 * Axis.js - Professional Axis Rendering
 * 
 * Handles tick generation, formatting, and SVG rendering for chart axes.
 * Now uses the unified Scale system for consistent positioning.
 */

export class Axis {
  constructor(config = {}) {
    this.orientation = config.orientation; // 'x' or 'y'
    this.scale = config.scale; // Scale instance (required)
    
    if (!this.scale) {
      throw new Error('Axis requires a Scale instance');
    }
    
    // Styling options
    this.options = {
      label: config.label || '',
      tickCount: config.tickCount || 'auto',
      tickSize: config.tickSize || 6,
      tickPadding: config.tickPadding || 8,
      fontSize: config.fontSize || 12,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      color: config.color || '#333',
      strokeWidth: config.strokeWidth || 1,
      showTicks: config.showTicks !== false,
      showTickLabels: config.showTickLabels !== false,
      showAxisLine: config.showAxisLine !== false,
      ...config.options
    };
    
    // Internal state
    this.ticks = [];
    this.svgGroup = null;
  }
  
  /**
   * Calculate tick positions and values
   */
  calculateTicks() {
    const tickCount = this._getOptimalTickCount();
    
    // Use the scale's tick generation
    const scaleTicks = this.scale.getTicks(tickCount);
    
    // Convert scale ticks to axis ticks with labels
    this.ticks = scaleTicks.map(tick => ({
      value: tick.value,
      position: tick.position,
      label: this._formatTickLabel(tick.value)
    }));
    
    return this.ticks;
  }
  
  /**
   * Render the axis to SVG
   */
  render(svgParent, position) {
    // Remove existing axis if present
    if (this.svgGroup) {
      this.svgGroup.remove();
    }
    
    // Create axis group
    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', `axis axis-${this.orientation}`);
    
    // Calculate ticks
    this.calculateTicks();
    
    // Set position transform
    this._setAxisTransform(position);
    
    // Render components
    if (this.options.showAxisLine) {
      this._renderAxisLine();
    }
    
    if (this.options.showTicks && this.options.showTickLabels) {
      this._renderTicks();
    }
    
    this._renderAxisLabel(position);
    
    // Add to parent
    svgParent.appendChild(this.svgGroup);
    
    return this.svgGroup;
  }
  
  /**
   * Update axis with new scale
   */
  updateScale(newScale) {
    this.scale = newScale;
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }
  
  /**
   * Update axis options
   */
  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }
  
  /**
   * Update axis with new scale/options (legacy method)
   */
  update(newConfig = {}) {
    if (newConfig.scale) {
      this.scale = newConfig.scale;
    }
    if (newConfig.options) {
      Object.assign(this.options, newConfig.options);
    }
    
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }
  
  /**
   * Set axis transform based on position
   */
  _setAxisTransform(position) {
    if (this.orientation === 'x') {
      this.svgGroup.setAttribute('transform', `translate(0, ${position.y})`);
    } else {
      this.svgGroup.setAttribute('transform', `translate(${position.x}, 0)`);
    }
  }
  
  /**
   * Render the main axis line
   */
  _renderAxisLine() {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const range = this.scale.range;
    
    if (this.orientation === 'x') {
      line.setAttribute('x1', range[0]);
      line.setAttribute('x2', range[1]);
      line.setAttribute('y1', 0);
      line.setAttribute('y2', 0);
    } else {
      line.setAttribute('x1', 0);
      line.setAttribute('x2', 0);
      line.setAttribute('y1', range[0]);
      line.setAttribute('y2', range[1]);
    }
    
    line.setAttribute('stroke', this.options.color);
    line.setAttribute('stroke-width', this.options.strokeWidth);
    line.setAttribute('fill', 'none');
    
    this.svgGroup.appendChild(line);
  }
  
  /**
   * Render ticks and labels
   */
  _renderTicks() {
    this.ticks.forEach(tick => {
      if (this.options.showTicks) {
        this._renderTickMark(tick);
      }
      
      if (this.options.showTickLabels) {
        this._renderTickLabel(tick);
      }
    });
  }
  
  /**
   * Render a single tick mark
   */
  _renderTickMark(tick) {
    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    
    if (this.orientation === 'x') {
      tickLine.setAttribute('x1', tick.position);
      tickLine.setAttribute('x2', tick.position);
      tickLine.setAttribute('y1', 0);
      tickLine.setAttribute('y2', this.options.tickSize);
    } else {
      tickLine.setAttribute('x1', -this.options.tickSize);
      tickLine.setAttribute('x2', 0);
      tickLine.setAttribute('y1', tick.position);
      tickLine.setAttribute('y2', tick.position);
    }
    
    tickLine.setAttribute('stroke', this.options.color);
    tickLine.setAttribute('stroke-width', this.options.strokeWidth);
    
    this.svgGroup.appendChild(tickLine);
  }
  
  /**
   * Render a single tick label
   */
  _renderTickLabel(tick) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    
    if (this.orientation === 'x') {
      label.setAttribute('x', tick.position);
      label.setAttribute('y', this.options.tickSize + this.options.tickPadding + this.options.fontSize);
      label.setAttribute('text-anchor', 'middle');
    } else {
      label.setAttribute('x', -(this.options.tickSize + this.options.tickPadding));
      label.setAttribute('y', tick.position + (this.options.fontSize / 3));
      label.setAttribute('text-anchor', 'end');
    }
    
    label.setAttribute('font-size', this.options.fontSize);
    label.setAttribute('font-family', this.options.fontFamily);
    label.setAttribute('fill', this.options.color);
    label.textContent = tick.label;
    
    this.svgGroup.appendChild(label);
  }
  
  /**
   * Render axis label
   */
  _renderAxisLabel(position) {
    if (!this.options.label) return;
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const range = this.scale.range;
    
    if (this.orientation === 'x') {
      const centerX = (range[0] + range[1]) / 2;
      label.setAttribute('x', centerX);
      label.setAttribute('y', this.options.tickSize + this.options.tickPadding + this.options.fontSize + 20);
      label.setAttribute('text-anchor', 'middle');
    } else {
      const centerY = (range[0] + range[1]) / 2;
      label.setAttribute('x', -(this.options.tickSize + this.options.tickPadding + 40));
      label.setAttribute('y', centerY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('transform', `rotate(-90, ${-(this.options.tickSize + this.options.tickPadding + 40)}, ${centerY})`);
    }
    
    label.setAttribute('font-size', this.options.fontSize + 2);
    label.setAttribute('font-family', this.options.fontFamily);
    label.setAttribute('font-weight', '600');
    label.setAttribute('fill', this.options.color);
    label.textContent = this.options.label;
    
    this.svgGroup.appendChild(label);
  }
  
  /**
   * Format tick labels with abbreviation for panel mode
   * @private
   */
  _formatTickLabel(value) {
    if (this.scale.type === 'time') {
      return this._formatTimeValue(value);
    }
    
    // For Y axis in panels, use abbreviated number formatting
    if (this.orientation === 'y' && this.options.abbreviateLabels) {
      return this._formatAbbreviatedNumber(value);
    }
    
    // Default formatting
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      } else if (value % 1 === 0) {
        return value.toString();
      } else {
        return value.toFixed(2);
      }
    }
    
    return value.toString();
  }

  /**
   * Format abbreviated numbers for panel Y axes
   * @private
   */
  _formatAbbreviatedNumber(value) {
    if (typeof value !== 'number') return value.toString();
    
    const absValue = Math.abs(value);
    
    if (absValue >= 1e9) {
      return (value / 1e9).toFixed(1) + 'B';
    } else if (absValue >= 1e6) {
      return (value / 1e6).toFixed(1) + 'M';
    } else if (absValue >= 1e3) {
      return (value / 1e3).toFixed(1) + 'K';
    } else if (absValue >= 1) {
      return value.toFixed(0);
    } else if (absValue >= 0.01) {
      return value.toFixed(2);
    } else {
      return value.toExponential(1);
    }
  }
  
  /**
   * Format time values for shared X axis
   * @private
   */
  _formatTimeValue(timestamp) {
    const date = new Date(timestamp);
    
    // Smart time formatting based on data range
    const range = this.scale.domain;
    const timeSpan = range[1] - range[0];
    
    // If span is less than a day, show time
    if (timeSpan < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    // If span is less than a year, show month/day
    else if (timeSpan < 365 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    // Otherwise show year
    else {
      return date.getFullYear().toString();
    }
  }
  
  /**
   * Format logarithmic labels
   */
  _formatLogLabel(value) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (value >= 1) {
      return value.toFixed(0);
    } else {
      return value.toExponential(1);
    }
  }
  
  /**
   * Format numeric labels
   */
  _formatNumericLabel(value) {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (value % 1 === 0) {
      return value.toString();
    } else {
      return value.toFixed(2);
    }
  }
  
  /**
   * Update the optimal tick count calculation for panel mode
   * @private
   */
  _getOptimalTickCount() {
    if (this.options.tickCount !== 'auto') {
      return this.options.tickCount;
    }
    
    const range = this.scale.range;
    const rangeSize = Math.abs(range[1] - range[0]);
    
    if (this.orientation === 'x') {
      // For X axis, base on pixel width
      const minSpacing = 80; // Minimum pixels between ticks
      return Math.max(2, Math.floor(rangeSize / minSpacing));
    } else {
      // For Y axis in panels, use fewer ticks
      const minSpacing = this.options.fontSize * 3; // 3x font size minimum spacing
      const maxTicks = 5; // Maximum ticks for panel Y axis
      const calculatedTicks = Math.max(2, Math.floor(rangeSize / minSpacing));
      return Math.min(maxTicks, calculatedTicks);
    }
  }
  
  /**
   * Get current position (helper for updates)
   */
  _getCurrentPosition() {
    // Extract transform from current SVG group if available
    if (this.svgGroup) {
      const transform = this.svgGroup.getAttribute('transform');
      if (transform) {
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  /**
   * Render shared X axis for panel mode
   * @param {SVGElement} svgParent - Parent SVG element  
   * @param {Object} position - Axis position
   * @param {Array} panels - Array of panel instances for shared axis
   */
  renderSharedXAxis(svgParent, position, panels = []) {
    if (this.orientation !== 'x') {
      console.warn('renderSharedXAxis should only be called on X axis');
      return this.render(svgParent, position);
    }
    
    // Remove existing axis if present
    if (this.svgGroup) {
      this.svgGroup.remove();
    }
    
    // Create axis group
    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', `axis axis-${this.orientation} shared-axis`);
    
    // Calculate ticks for shared axis
    this.calculateTicks();
    
    // Set position transform (typically at bottom of all panels)
    this._setAxisTransform(position);
    
    // Render components
    if (this.options.showAxisLine) {
      this._renderAxisLine();
    }
    
    if (this.options.showTicks && this.options.showTickLabels) {
      this._renderTicks();
    }
    
    // Render axis label with "shared" indication
    this._renderSharedAxisLabel(position);
    
    // Add to parent
    svgParent.appendChild(this.svgGroup);
    
    return this.svgGroup;
  }
  
  /**
   * Render axis label for shared axis
   * @private
   */
  _renderSharedAxisLabel(position) {
    if (!this.options.label) return;
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const range = this.scale.range;
    
    if (this.orientation === 'x') {
      label.setAttribute('x', (range[0] + range[1]) / 2);
      label.setAttribute('y', position.y + 40); // Extra space for shared axis
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'hanging');
    } else {
      label.setAttribute('x', position.x - 40);
      label.setAttribute('y', (range[0] + range[1]) / 2);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(-90, ${position.x - 40}, ${(range[0] + range[1]) / 2})`);
    }
    
    label.style.fontSize = `${this.options.fontSize + 1}px`; // Slightly larger for shared axis
    label.style.fontFamily = this.options.fontFamily;
    label.style.fontWeight = 'bold';
    label.style.fill = this.options.color;
    label.textContent = this.options.label;
    
    this.svgGroup.appendChild(label);
  }

  /**
   * Create a panel-specific Y axis with abbreviated labels
   * @param {Object} config - Panel-specific configuration
   */
  static createPanelYAxis(config = {}) {
    const panelOptions = {
      tickCount: 3, // Fewer ticks for panels to save space
      fontSize: 10, // Smaller font for panels
      tickPadding: 6, // Less padding
      showAxisLine: false, // No axis line for cleaner look
      ...config.options
    };
    
    return new Axis({
      orientation: 'y',
      scale: config.scale,
      options: panelOptions
    });
  }
  
  /**
   * Create a shared X axis for panel mode
   * @param {Object} config - Shared axis configuration
   */
  static createSharedXAxis(config = {}) {
    const sharedOptions = {
      tickCount: 'auto',
      fontSize: 11,
      tickPadding: 8,
      showAxisLine: true,
      showTicks: true,
      showTickLabels: true,
      ...config.options
    };
    
    return new Axis({
      orientation: 'x',
      scale: config.scale,
      options: sharedOptions
    });
  }

  /**
   * Update axis for panel mode with specific options
   */
  updateForPanelMode(isPanelMode, isSharedAxis = false) {
    if (isPanelMode) {
      if (this.orientation === 'y') {
        // Y axis in panel mode: fewer ticks, smaller font, abbreviated labels
        this.options.tickCount = 3;
        this.options.fontSize = 10;
        this.options.abbreviateLabels = true;
        this.options.showAxisLine = false;
      } else if (isSharedAxis) {
        // Shared X axis: normal formatting but bold label
        this.options.fontSize = 11;
        this.options.tickPadding = 10;
      }
    } else {
      // Single mode: restore normal options
      this.options.tickCount = 'auto';
      this.options.fontSize = 12;
      this.options.abbreviateLabels = false;
      this.options.showAxisLine = true;
      this.options.tickPadding = 8;
    }
    
    // Re-render if already rendered
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    
    return this;
  }
}
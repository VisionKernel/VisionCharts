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
   * Format tick label based on scale type and data type
   */
  _formatTickLabel(value) {
    const dataType = this.scale.dataType;
    const scaleType = this.scale.type;
    
    if (dataType === 'time') {
      return this._formatTimeLabel(new Date(value));
    } else if (dataType === 'number') {
      if (scaleType === 'log') {
        return this._formatLogLabel(value);
      } else {
        return this._formatNumericLabel(value);
      }
    } else {
      return String(value);
    }
  }
  
  /**
   * Format time labels
   */
  _formatTimeLabel(date) {
    const domain = this.scale.domain;
    const timeRange = domain[1] - domain[0];
    
    // Choose format based on time range
    if (timeRange > 365 * 24 * 60 * 60 * 1000) { // > 1 year
      return date.toLocaleDateString('en-US', { year: 'numeric' });
    } else if (timeRange > 30 * 24 * 60 * 60 * 1000) { // > 1 month
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } else if (timeRange > 24 * 60 * 60 * 1000) { // > 1 day
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
   * Get optimal tick count based on axis length and orientation
   */
  _getOptimalTickCount() {
    if (typeof this.options.tickCount === 'number') {
      return this.options.tickCount;
    }
    
    const range = this.scale.range;
    const axisLength = Math.abs(range[1] - range[0]);
    
    if (this.orientation === 'x') {
      // For X axis, consider label width
      return Math.max(3, Math.min(10, Math.floor(axisLength / 80)));
    } else {
      // For Y axis, consider label height
      return Math.max(3, Math.min(8, Math.floor(axisLength / 40)));
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
}
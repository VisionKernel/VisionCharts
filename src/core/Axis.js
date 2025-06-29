import { createNiceDomain, createTimeTickValues } from './Scale.js';

/**
 * Axis - Enhanced multi-renderer axis implementation
 * 
 * Renders chart axes using the AbstractRenderer interface, supporting
 * SVG, Canvas, and WebGL backends with consistent functionality.
 */
export default class Axis {
  /**
   * Create an axis
   * @param {Object} options - Axis options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Core options
      orientation: 'bottom', // 'bottom', 'top', 'left', 'right'
      scale: null,
      tickCount: 5,
      tickSize: 6,
      tickPadding: 3,
      tickFormat: null,
      formatType: 'number', // 'number', 'time', 'percent', 'currency'
      formatOptions: {},
      label: '',
      
      // Grid options
      grid: false,
      gridStyle: {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        strokeDasharray: '4,4'
      },
      
      // Display options
      showDomain: true, // Show axis line
      showTicks: true,
      showTickLabels: true,
      showAxisLabel: false, // Disabled by default since Chart.js handles axis names
      tickRotation: 0, // Rotation angle for tick labels
      labelOffset: 15, // Distance of axis label from ticks
      className: '', // Additional CSS class
      
      // Scale options
      isLogarithmic: false,
      
      // Panel-specific options
      isPanelAxis: false,
      panelWidth: null,
      panelHeight: null,
      
      // Styling options
      axisColor: '#000000',
      tickColor: '#000000',
      labelColor: '#000000',
      labelFontSize: '12px',
      labelFontFamily: 'sans-serif',
      axisLabelFontSize: '14px',
      axisLabelFontWeight: 'bold'
    }, options);
    
    // Renderer-agnostic elements tracking
    this.renderedElements = [];
    this.gridElements = [];
    this.elementId = `axis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Performance tracking
    this.renderMetrics = {
      lastRenderTime: 0,
      tickCount: 0,
      elementsRendered: 0
    };
  }
  
  /**
   * Set the scale for the axis
   * @param {Scale} scale - Scale instance
   * @returns {Axis} This axis instance
   */
  setScale(scale) {
    this.options.scale = scale;
    return this;
  }
  
  /**
   * Set axis options
   * @param {Object} options - New options
   * @returns {Axis} This axis instance
   */
  setOptions(options) {
    this.options = Object.assign(this.options, options);
    return this;
  }
  
  /**
   * Generate tick values based on the scale domain
   * @returns {Array} Array of tick values
   */
  generateTickValues() {
    const scale = this.options.scale;
    if (!scale) return [];
    
    const domain = scale.domain;
    
    // Handle time scale
    if (domain[0] instanceof Date || (typeof domain[0] === 'number' && 
        domain[0] > 1000000000000)) { // Assume timestamp if > 2001
      return createTimeTickValues(domain[0], domain[1], this.options.tickCount);
    }
    
    // Handle logarithmic scale
    if (this.options.isLogarithmic) {
      return this.generateLogTickValues(domain);
    }
    
    // Handle numeric domain
    const [min, max] = createNiceDomain(domain[0], domain[1], this.options.tickCount);
    
    // Generate evenly spaced ticks
    const step = (max - min) / this.options.tickCount;
    const tickValues = [];
    
    for (let i = 0; i <= this.options.tickCount; i++) {
      tickValues.push(min + i * step);
    }
    
    return tickValues;
  }
  
  /**
   * Generate tick values for logarithmic scale
   * @param {Array} domain - Scale domain [min, max]
   * @returns {Array} Array of logarithmic tick values
   */
  generateLogTickValues(domain) {
    const [min, max] = domain;
    const tickValues = [];
    
    // Find the order of magnitude range
    const minLog = Math.floor(Math.log10(Math.max(min, 0.001)));
    const maxLog = Math.ceil(Math.log10(max));
    
    // Generate ticks at powers of 10
    for (let i = minLog; i <= maxLog; i++) {
      const value = Math.pow(10, i);
      if (value >= min && value <= max) {
        tickValues.push(value);
      }
      
      // Add intermediate values (2, 3, 4, 5, 6, 7, 8, 9) * 10^i
      for (let j = 2; j <= 9; j++) {
        const intermediateValue = j * Math.pow(10, i);
        if (intermediateValue >= min && intermediateValue <= max && intermediateValue < Math.pow(10, i + 1)) {
          tickValues.push(intermediateValue);
        }
      }
    }
    
    return tickValues.sort((a, b) => a - b);
  }
  
  /**
   * Format tick value with improved time formatting
   * @param {number|Date} value - Tick value
   * @returns {string} Formatted tick value
   */
  formatTickValue(value) {
    // Use custom formatter if provided
    if (typeof this.options.tickFormat === 'function') {
      return this.options.tickFormat(value);
    }
    
    // Time formatting
    if (this.options.formatType === 'time') {
      const date = value instanceof Date ? value : new Date(value);
      
      // Use format options if provided, otherwise use clean defaults
      const formatOptions = this.options.formatOptions && Object.keys(this.options.formatOptions).length > 0 
        ? this.options.formatOptions 
        : {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          };
      
      return date.toLocaleDateString(undefined, formatOptions);
    }
    
    // Number formatting
    if (this.options.formatType === 'number') {
      if (typeof value !== 'number') return String(value);
      
      // Large numbers
      if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }
      
      // Small numbers
      if (Math.abs(value) < 1 && value !== 0) {
        return value.toPrecision(3);
      }
      
      return value.toFixed(value % 1 === 0 ? 0 : 2);
    }
    
    // Percentage formatting
    if (this.options.formatType === 'percent') {
      return (value * 100).toFixed(1) + '%';
    }
    
    // Currency formatting
    if (this.options.formatType === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.options.formatOptions.currency || 'USD'
      }).format(value);
    }
    
    return String(value);
  }
  
  /**
   * Render the axis using the provided renderer
   * @param {AbstractRenderer} renderer - Renderer instance
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} transform - Transform options {translateX, translateY}
   * @returns {string} Element ID for tracking
   */
  render(renderer, width, height, transform = {}) {
    const startTime = performance.now();
    
    const scale = this.options.scale;
    
    if (!scale) {
      console.error('No scale provided for axis');
      return null;
    }
    
    if (!renderer || !renderer.isInitialized) {
      console.error('Invalid or uninitialized renderer provided to Axis');
      return null;
    }
    
    // Clear previous elements
    this.clear(renderer);
    
    // Use panel dimensions if provided
    const effectiveWidth = this.options.panelWidth || width;
    const effectiveHeight = this.options.panelHeight || height;
    
    // Apply transform if provided
    if (transform.translateX || transform.translateY) {
      renderer.save();
      renderer.translate(transform.translateX || 0, transform.translateY || 0);
    }
    
    // Generate tick values
    const tickValues = this.generateTickValues();
    this.renderMetrics.tickCount = tickValues.length;
    
    // Determine axis position and orientation
    const isHorizontal = this.options.orientation === 'bottom' || this.options.orientation === 'top';
    const isBottom = this.options.orientation === 'bottom';
    const isLeft = this.options.orientation === 'left';
    
    // Render axis line (domain)
    if (this.options.showDomain) {
      this._renderAxisLine(renderer, effectiveWidth, effectiveHeight, isHorizontal, isBottom, isLeft);
    }
    
    // Render grid lines first (so they appear behind other elements)
    if (this.options.grid) {
      this._renderGridLines(renderer, tickValues, scale, effectiveWidth, effectiveHeight, isHorizontal, isLeft);
    }
    
    // Render ticks and labels
    this._renderTicksAndLabels(renderer, tickValues, scale, effectiveWidth, effectiveHeight, isHorizontal, isBottom, isLeft);
    
    // Render axis label
    if (this.options.showAxisLabel && this.options.label) {
      this._renderAxisLabel(renderer, effectiveWidth, effectiveHeight, isHorizontal, isBottom, isLeft);
    }
    
    // Restore transform if applied
    if (transform.translateX || transform.translateY) {
      renderer.restore();
    }
    
    // Update metrics
    this.renderMetrics.lastRenderTime = performance.now() - startTime;
    this.renderMetrics.elementsRendered = this.renderedElements.length;
    
    console.log(`Axis rendered in ${this.renderMetrics.lastRenderTime.toFixed(2)}ms with ${this.renderMetrics.elementsRendered} elements`);
    
    return this.elementId;
  }
  
  /**
   * Render axis line (domain)
   * @private
   */
  _renderAxisLine(renderer, width, height, isHorizontal, isBottom, isLeft) {
    let x1, y1, x2, y2;
    
    if (isHorizontal) {
      x1 = 0;
      x2 = width;
      y1 = y2 = isBottom ? height : 0;
    } else {
      x1 = x2 = isLeft ? 0 : width;
      y1 = 0;
      y2 = height;
    }
    
    const lineId = renderer.drawLine(x1, y1, x2, y2, {
      stroke: this.options.axisColor,
      strokeWidth: 1,
      class: `${this.elementId}-axis-line`
    });
    
    this.renderedElements.push(lineId);
  }
  
  /**
   * Render grid lines
   * @private
   */
  _renderGridLines(renderer, tickValues, scale, width, height, isHorizontal, isLeft) {
    tickValues.forEach(value => {
      const pos = scale.scale(value);
      
      // Skip if position is out of bounds
      if (isHorizontal && (pos < 0 || pos > width)) return;
      if (!isHorizontal && (pos < 0 || pos > height)) return;
      
      let x1, y1, x2, y2;
      
      if (isHorizontal) {
        x1 = x2 = pos;
        y1 = 0;
        y2 = height;
      } else {
        x1 = 0;
        x2 = width;
        y1 = y2 = pos;
      }
      
      const gridLineId = renderer.drawLine(x1, y1, x2, y2, {
        stroke: this.options.gridStyle.stroke,
        strokeWidth: this.options.gridStyle.strokeWidth,
        strokeDasharray: this.options.gridStyle.strokeDasharray,
        class: `${this.elementId}-grid-line`
      });
      
      this.gridElements.push(gridLineId);
    });
  }
  
  /**
   * Render ticks and labels
   * @private
   */
  _renderTicksAndLabels(renderer, tickValues, scale, width, height, isHorizontal, isBottom, isLeft) {
    tickValues.forEach(value => {
      const formattedValue = this.formatTickValue(value);
      const pos = scale.scale(value);
      
      // Skip if position is out of bounds
      if (isHorizontal && (pos < 0 || pos > width)) return;
      if (!isHorizontal && (pos < 0 || pos > height)) return;
      
      let tickX1, tickY1, tickX2, tickY2, textX, textY, textAnchor, textBaseline;
      
      if (isHorizontal) {
        // Horizontal axis
        tickX1 = tickX2 = pos;
        tickY1 = isBottom ? height : 0;
        tickY2 = isBottom ? height - this.options.tickSize : this.options.tickSize;
        
        textX = pos;
        textY = isBottom ? 
          height + this.options.tickSize + this.options.tickPadding :
          -this.options.tickSize - this.options.tickPadding;
        textAnchor = 'middle';
        textBaseline = isBottom ? 'top' : 'bottom';
      } else {
        // Vertical axis
        tickX1 = isLeft ? 0 : width;
        tickX2 = isLeft ? this.options.tickSize : width - this.options.tickSize;
        tickY1 = tickY2 = pos;
        
        textX = isLeft ? 
          -this.options.tickSize - this.options.tickPadding :
          width + this.options.tickSize + this.options.tickPadding;
        textY = pos;
        textAnchor = isLeft ? 'end' : 'start';
        textBaseline = 'middle';
      }
      
      // Render tick
      if (this.options.showTicks) {
        const tickId = renderer.drawLine(tickX1, tickY1, tickX2, tickY2, {
          stroke: this.options.tickColor,
          strokeWidth: 1,
          class: `${this.elementId}-tick`
        });
        this.renderedElements.push(tickId);
      }
      
      // Render label
      if (this.options.showTickLabels) {
        const labelOptions = {
          textAnchor: textAnchor,
          textBaseline: textBaseline,
          fontSize: this.options.labelFontSize,
          fontFamily: this.options.labelFontFamily,
          fill: this.options.labelColor,
          class: `${this.elementId}-tick-label`
        };
        
        // Add rotation if specified
        if (this.options.tickRotation !== 0) {
          renderer.save();
          renderer.translate(textX, textY);
          renderer.rotate(this.options.tickRotation * Math.PI / 180);
          
          const labelId = renderer.drawText(formattedValue, 0, 0, labelOptions);
          this.renderedElements.push(labelId);
          
          renderer.restore();
        } else {
          const labelId = renderer.drawText(formattedValue, textX, textY, labelOptions);
          this.renderedElements.push(labelId);
        }
      }
    });
  }
  
  /**
   * Render axis label
   * @private
   */
  _renderAxisLabel(renderer, width, height, isHorizontal, isBottom, isLeft) {
    let labelX, labelY, rotation = 0;
    
    if (isHorizontal) {
      labelX = width / 2;
      labelY = isBottom ? 
        height + this.options.labelOffset + 25 :
        -this.options.labelOffset - 10;
    } else {
      labelX = isLeft ? 
        -this.options.labelOffset - 25 :
        width + this.options.labelOffset + 25;
      labelY = height / 2;
      rotation = isLeft ? -90 : 90;
    }
    
    renderer.save();
    
    if (rotation !== 0) {
      renderer.translate(labelX, labelY);
      renderer.rotate(rotation * Math.PI / 180);
      labelX = 0;
      labelY = 0;
    }
    
    const axisLabelId = renderer.drawText(this.options.label, labelX, labelY, {
      textAnchor: 'middle',
      textBaseline: 'middle',
      fontSize: this.options.axisLabelFontSize,
      fontWeight: this.options.axisLabelFontWeight,
      fontFamily: this.options.labelFontFamily,
      fill: this.options.labelColor,
      class: `${this.elementId}-axis-label`
    });
    
    this.renderedElements.push(axisLabelId);
    
    renderer.restore();
  }
  
  /**
   * Clear all rendered elements
   * @param {AbstractRenderer} renderer - Renderer instance
   */
  clear(renderer) {
    // Clear rendered elements
    this.renderedElements.forEach(elementId => {
      if (renderer.removeElement) {
        renderer.removeElement(elementId);
      }
    });
    
    // Clear grid elements
    this.gridElements.forEach(elementId => {
      if (renderer.removeElement) {
        renderer.removeElement(elementId);
      }
    });
    
    this.renderedElements = [];
    this.gridElements = [];
  }
  
  /**
   * Update the axis with new dimensions
   * @param {AbstractRenderer} renderer - Renderer instance
   * @param {number} width - New width
   * @param {number} height - New height
   * @param {Object} transform - Transform options
   * @returns {string} Element ID
   */
  update(renderer, width, height, transform = {}) {
    return this.render(renderer, width, height, transform);
  }
  
  /**
   * Destroy the axis and clean up resources
   * @param {AbstractRenderer} renderer - Renderer instance
   */
  destroy(renderer) {
    this.clear(renderer);
    this.options = null;
    this.renderMetrics = null;
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.renderMetrics };
  }
  
  // ===== LEGACY COMPATIBILITY METHODS =====
  
  /**
   * Legacy SVG render method for backwards compatibility
   * @param {SVGElement} container - SVG container
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {SVGElement} Rendered axis element
   * @deprecated Use render() with renderer instance instead
   */
  renderLegacy(container, width, height) {
    console.warn('Axis.renderLegacy() is deprecated. Use render() with renderer instance instead.');
    
    // Import SvgRenderer for legacy support
    import('../renderers/SvgRenderer.js').then(({ default: SvgRenderer }) => {
      const legacyRenderer = new SvgRenderer(container.parentElement, width, height);
      legacyRenderer.initialize().then(() => {
        this.render(legacyRenderer, width, height);
      });
    });
    
    return container;
  }
  
  /**
   * Static method to render axes for a panel (legacy compatibility)
   * @param {Object} renderer - Renderer instance or SVG container
   * @param {Object} xScale - X scale
   * @param {Object} yScale - Y scale  
   * @param {number} width - Panel width
   * @param {number} height - Panel height
   * @param {Object} options - Axis options
   */
  static renderForPanel(renderer, xScale, yScale, width, height, options = {}) {
    console.log('Axis.renderForPanel called');
    
    // Create X axis if enabled
    if (xScale && options.showXAxis !== false) {
      try {
        const xAxisOptions = Object.assign({
          orientation: 'bottom',
          scale: xScale,
          tickCount: 5,
          grid: false,
          isPanelAxis: true,
          panelWidth: width,
          panelHeight: height,
          showTickLabels: options.showXLabels !== false,
          label: options.xAxisName || '',
          showAxisLabel: false,
          formatType: options.xAxisOptions?.formatType || 'number',
          formatOptions: options.xAxisOptions?.formatOptions || {}
        }, options.xAxisOptions || {});
        
        const xAxis = new Axis(xAxisOptions);
        
        // Check if renderer is AbstractRenderer instance or legacy SVG
        if (renderer.isInitialized) {
          xAxis.render(renderer, width, height);
        } else {
          xAxis.renderLegacy(renderer, width, height);
        }
      } catch (error) {
        console.error('Error creating X axis for panel:', error);
      }
    }
    
    // Create Y axis if enabled
    if (yScale && options.showYAxis !== false) {
      try {
        const yAxisOptions = Object.assign({
          orientation: 'left',
          scale: yScale,
          tickCount: 4,
          grid: options.yAxisOptions?.grid || false,
          gridStyle: options.yAxisOptions?.gridStyle || {
            stroke: '#e0e0e0',
            strokeWidth: 1,
            strokeDasharray: '4,4'
          },
          isPanelAxis: true,
          panelWidth: width,
          panelHeight: height,
          showTickLabels: options.showYLabels !== false,
          label: options.yAxisName || '',
          isLogarithmic: options.isLogarithmic || false,
          showAxisLabel: false,
          formatType: options.yAxisOptions?.formatType || 'number',
          formatOptions: options.yAxisOptions?.formatOptions || {}
        }, options.yAxisOptions || {});
        
        const yAxis = new Axis(yAxisOptions);
        
        // Check if renderer is AbstractRenderer instance or legacy SVG
        if (renderer.isInitialized) {
          yAxis.render(renderer, width, height);
        } else {
          yAxis.renderLegacy(renderer, width, height);
        }
      } catch (error) {
        console.error('Error creating Y axis for panel:', error);
      }
    }
  }
}
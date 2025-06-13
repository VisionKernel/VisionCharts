import SvgRenderer from '../renderers/SvgRenderer.js';
import { createNiceDomain, createTimeTickValues } from './Scale.js';

/**
 * Axis class for rendering chart axes
 */
export default class Axis {
  /**
   * Create an axis
   * @param {Object} options - Axis options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Default options
      orientation: 'bottom', // 'bottom', 'top', 'left', 'right'
      scale: null,
      tickCount: 5,
      tickSize: 6,
      tickPadding: 3,
      tickFormat: null,
      formatType: 'number', // 'number', 'time', 'percent', 'currency'
      formatOptions: {},
      label: '',
      grid: false,
      gridStyle: {
        stroke: '#e0e0e0',
        'stroke-width': 1,
        'stroke-dasharray': '4,4'
      },
      // Advanced options
      showDomain: true, // Show axis line
      showTicks: true,
      showTickLabels: true,
      tickRotation: 0, // Rotation angle for tick labels
      labelOffset: 15, // Distance of axis label from ticks
      className: '', // Additional CSS class
      isLogarithmic: false,
      // Panel-specific options
      isPanelAxis: false,
      panelWidth: null,
      panelHeight: null,
      // FIXED: Add option to disable axis labels to prevent duplicates
      showAxisLabel: false // Disabled by default since Chart.js handles axis names
    }, options);
    
    this.element = null;
    this.gridElement = null;
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
   * Format tick value - FIXED: Improved time formatting
   * @param {number|Date} value - Tick value
   * @returns {string} Formatted tick value
   */
  formatTickValue(value) {
    // Use custom formatter if provided
    if (typeof this.options.tickFormat === 'function') {
      return this.options.tickFormat(value);
    }
    
    // FIXED: Better time formatting without timestamps
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
    
    // Use built-in formatters for other types
    return SvgRenderer.formatTickValue(
      value,
      this.options.formatType,
      this.options.formatOptions
    );
  }
  
  /**
   * Render the axis
   * @param {SVGElement} container - Container element to render the axis into
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @returns {SVGElement} Rendered axis element
   */
  render(container, width, height) {
    const scale = this.options.scale;
    
    if (!scale) {
      console.error('No scale provided for axis');
      return null;
    }
    
    // Use panel dimensions if provided
    const effectiveWidth = this.options.panelWidth || width;
    const effectiveHeight = this.options.panelHeight || height;
    
    // Create axis group
    const axisClass = `visioncharts-axis visioncharts-${this.options.orientation}-axis`;
    this.element = SvgRenderer.createGroup({
      class: this.options.className ? `${axisClass} ${this.options.className}` : axisClass
    });
    
    // Create grid group if needed
    if (this.options.grid) {
      this.gridElement = SvgRenderer.createGroup({
        class: 'visioncharts-grid'
      });
      container.appendChild(this.gridElement);
    }
    
    // Generate tick values
    const tickValues = this.generateTickValues();
    
    // Determine axis position and orientation
    const isHorizontal = this.options.orientation === 'bottom' || this.options.orientation === 'top';
    const isBottom = this.options.orientation === 'bottom';
    const isLeft = this.options.orientation === 'left';
    
    // FIXED: Draw axis line (domain) with correct positioning
    if (this.options.showDomain) {
      let line;
      if (isHorizontal) {
        // FIXED: Bottom axis should be at effectiveHeight, top axis at 0
        const y = isBottom ? effectiveHeight : 0;
        line = SvgRenderer.createLine(0, y, effectiveWidth, y, {
          class: 'visioncharts-axis-line',
          stroke: '#000',
          'stroke-width': 1
        });
      } else {
        const x = isLeft ? 0 : effectiveWidth;
        line = SvgRenderer.createLine(x, 0, x, effectiveHeight, {
          class: 'visioncharts-axis-line',
          stroke: '#000',
          'stroke-width': 1
        });
      }
      this.element.appendChild(line);
    }
    
    // Draw ticks and labels
    tickValues.forEach(value => {
      const formattedValue = this.formatTickValue(value);
      
      // Scale the value to get the position
      const pos = scale.scale(value);
      
      // Skip if position is out of bounds
      if (isHorizontal && (pos < 0 || pos > effectiveWidth)) return;
      if (!isHorizontal && (pos < 0 || pos > effectiveHeight)) return;
      
      let x, y, textX, textY, gridX1, gridY1, gridX2, gridY2;
      
      if (isHorizontal) {
        x = pos;
        // FIXED: Bottom axis should be at effectiveHeight, top axis at 0
        y = isBottom ? effectiveHeight : 0;
        textX = x;
        textY = isBottom ? y + this.options.tickSize + this.options.tickPadding : y - this.options.tickSize - this.options.tickPadding;
        gridX1 = x;
        gridY1 = 0;
        gridX2 = x;
        gridY2 = effectiveHeight;
      } else {
        x = isLeft ? 0 : effectiveWidth;
        y = pos;
        textX = isLeft ? x - this.options.tickSize - this.options.tickPadding : x + this.options.tickSize + this.options.tickPadding;
        textY = y;
        gridX1 = 0;
        gridY1 = y;
        gridX2 = effectiveWidth;
        gridY2 = y;
      }
      
      // Create tick
      if (this.options.showTicks) {
        const tick = SvgRenderer.createLine(
          x,
          y,
          isHorizontal ? x : (isLeft ? x - this.options.tickSize : x + this.options.tickSize),
          isHorizontal ? (isBottom ? y + this.options.tickSize : y - this.options.tickSize) : y,
          {
            class: 'visioncharts-tick',
            stroke: '#000',
            'stroke-width': 1
          }
        );
        this.element.appendChild(tick);
      }
      
      // Create label
      if (this.options.showTickLabels) {
        const labelAttrs = {
          class: 'visioncharts-tick-label',
          'text-anchor': isHorizontal ? 'middle' : (isLeft ? 'end' : 'start'),
          'dominant-baseline': isHorizontal ? (isBottom ? 'hanging' : 'auto') : 'central',
          'font-size': '12px',
          'font-family': 'sans-serif'
        };
        
        // Add rotation if specified
        if (this.options.tickRotation !== 0) {
          labelAttrs.transform = `rotate(${this.options.tickRotation} ${textX} ${textY})`;
        }
        
        const label = SvgRenderer.createText(formattedValue, textX, textY, labelAttrs);
        this.element.appendChild(label);
      }
      
      // Create grid line if needed
      if (this.options.grid) {
        const gridLine = SvgRenderer.createLine(gridX1, gridY1, gridX2, gridY2, {
          class: 'visioncharts-grid-line',
          ...this.options.gridStyle
        });
        this.gridElement.appendChild(gridLine);
      }
    });
    
    // FIXED: Add axis label only if showAxisLabel is true and label is provided
    if (this.options.showAxisLabel && this.options.label) {
      let labelX, labelY, rotate = false;
      
      if (isHorizontal) {
        labelX = effectiveWidth / 2;
        labelY = isBottom ? this.options.labelOffset + 25 : -this.options.labelOffset - 10;
      } else {
        labelX = isLeft ? -this.options.labelOffset - 25 : this.options.labelOffset + 25;
        labelY = effectiveHeight / 2;
        rotate = true;
      }
      
      const axisLabel = SvgRenderer.createText(this.options.label, labelX, labelY, {
        class: 'visioncharts-axis-label',
        'text-anchor': 'middle',
        'font-size': '14px',
        'font-weight': 'bold',
        'font-family': 'sans-serif',
        transform: rotate ? `rotate(${isLeft ? -90 : 90} ${labelX} ${labelY})` : null
      });
      
      this.element.appendChild(axisLabel);
    }
    
    // Add to container
    container.appendChild(this.element);
    
    return this.element;
  }
  
  /**
   * Static method to render axes for a panel (used in panel view)
   * @param {SVGElement} panel - Panel container
   * @param {Object} xScale - X scale
   * @param {Object} yScale - Y scale  
   * @param {number} width - Panel width
   * @param {number} height - Panel height
   * @param {Object} options - Axis options
   */
  static renderForPanel(panel, xScale, yScale, width, height, options = {}) {
    console.log('Axis.renderForPanel called with options:', options);
    
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
          showAxisLabel: false, // Disable axis labels for panels
          formatType: options.xAxisOptions?.formatType || 'number',
          formatOptions: options.xAxisOptions?.formatOptions || {}
        }, options.xAxisOptions || {});
        
        console.log('Creating X axis with options:', xAxisOptions);
        const xAxis = new Axis(xAxisOptions);
        xAxis.render(panel, width, height);
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
          tickCount: 4, // Fewer ticks for panels
          grid: options.yAxisOptions?.grid || false,
          gridStyle: options.yAxisOptions?.gridStyle || {
            stroke: '#e0e0e0',
            'stroke-width': 1,
            'stroke-dasharray': '4,4'
          },
          isPanelAxis: true,
          panelWidth: width,
          panelHeight: height,
          showTickLabels: options.showYLabels !== false,
          label: options.yAxisName || '',
          isLogarithmic: options.isLogarithmic || false,
          showAxisLabel: false, // Disable axis labels for panels
          formatType: options.yAxisOptions?.formatType || 'number',
          formatOptions: options.yAxisOptions?.formatOptions || {}
        }, options.yAxisOptions || {});
        
        console.log('Creating Y axis with options:', yAxisOptions);
        const yAxis = new Axis(yAxisOptions);
        yAxis.render(panel, width, height);
      } catch (error) {
        console.error('Error creating Y axis for panel:', error);
      }
    }
  }
  
  /**
   * Update the axis
   * @param {number} width - New width
   * @param {number} height - New height
   * @returns {SVGElement} Updated axis element
   */
  update(width, height) {
    const parent = this.element?.parentNode;
    if (!parent) return null;
    
    const nextSibling = this.element.nextSibling;
    
    // Remove old elements
    if (this.element) {
      parent.removeChild(this.element);
    }
    
    if (this.gridElement && this.gridElement.parentNode) {
      this.gridElement.parentNode.removeChild(this.gridElement);
    }
    
    // Re-render with new dimensions
    this.render(parent, width || parseInt(parent.getAttribute('width'), 10), height || parseInt(parent.getAttribute('height'), 10));
    
    // Restore original position in DOM
    if (nextSibling) {
      parent.insertBefore(this.element, nextSibling);
    }
    
    return this.element;
  }
  
  /**
   * Destroy the axis
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    if (this.gridElement && this.gridElement.parentNode) {
      this.gridElement.parentNode.removeChild(this.gridElement);
    }
    
    this.element = null;
    this.gridElement = null;
  }
}
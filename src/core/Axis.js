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
      }
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
   * Format tick value
   * @param {number|Date} value - Tick value
   * @returns {string} Formatted tick value
   */
  formatTickValue(value) {
    // Use custom formatter if provided
    if (typeof this.options.tickFormat === 'function') {
      return this.options.tickFormat(value);
    }
    
    // Use built-in formatters
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
    
    // Create axis group
    this.element = SvgRenderer.createGroup({
      class: `visioncharts-axis visioncharts-${this.options.orientation}-axis`
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
    
    // Draw axis line
    let line;
    if (isHorizontal) {
      const y = isBottom ? 0 : height;
      line = SvgRenderer.createLine(0, y, width, y, {
        class: 'visioncharts-axis-line',
        stroke: '#000',
        'stroke-width': 1
      });
    } else {
      const x = isLeft ? 0 : width;
      line = SvgRenderer.createLine(x, 0, x, height, {
        class: 'visioncharts-axis-line',
        stroke: '#000',
        'stroke-width': 1
      });
    }
    
    this.element.appendChild(line);
    
    // Draw ticks and labels
    tickValues.forEach(value => {
      let x, y, textX, textY, gridX1, gridY1, gridX2, gridY2;
      const formattedValue = this.formatTickValue(value);
      
      // Scale the value to get the position
      const pos = scale.scale(value);
      
      if (isHorizontal) {
        x = pos;
        y = isBottom ? 0 : height;
        textX = x;
        textY = isBottom ? y + this.options.tickSize + this.options.tickPadding : y - this.options.tickSize - this.options.tickPadding;
        gridX1 = x;
        gridY1 = 0;
        gridX2 = x;
        gridY2 = height;
      } else {
        x = isLeft ? 0 : width;
        y = pos;
        textX = isLeft ? x - this.options.tickSize - this.options.tickPadding : x + this.options.tickSize + this.options.tickPadding;
        textY = y;
        gridX1 = 0;
        gridY1 = y;
        gridX2 = width;
        gridY2 = y;
      }
      
      // Create tick
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
      
      // Create label
      const label = SvgRenderer.createText(formattedValue, textX, textY, {
        class: 'visioncharts-tick-label',
        'text-anchor': isHorizontal ? 'middle' : (isLeft ? 'end' : 'start'),
        'dominant-baseline': isHorizontal ? (isBottom ? 'hanging' : 'auto') : 'central',
        'font-size': '12px',
        'font-family': 'sans-serif'
      });
      
      // Create grid line if needed
      if (this.options.grid) {
        const gridLine = SvgRenderer.createLine(gridX1, gridY1, gridX2, gridY2, {
          class: 'visioncharts-grid-line',
          ...this.options.gridStyle
        });
        this.gridElement.appendChild(gridLine);
      }
      
      this.element.appendChild(tick);
      this.element.appendChild(label);
    });
    
    // Add axis label if provided
    if (this.options.label) {
      let labelX, labelY, rotate = false;
      
      if (isHorizontal) {
        labelX = width / 2;
        labelY = isBottom ? 40 : -40;
      } else {
        labelX = isLeft ? -40 : 40;
        labelY = height / 2;
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
   * Update the axis
   * @returns {SVGElement} Updated axis element
   */
  update() {
    const parent = this.element.parentNode;
    const nextSibling = this.element.nextSibling;
    
    // Remove old elements
    if (parent && this.element) {
      parent.removeChild(this.element);
    }
    
    if (this.gridElement && this.gridElement.parentNode) {
      this.gridElement.parentNode.removeChild(this.gridElement);
    }
    
    // Re-render
    const width = parseInt(parent.getAttribute('width'), 10);
    const height = parseInt(parent.getAttribute('height'), 10);
    
    this.render(parent, width, height);
    
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
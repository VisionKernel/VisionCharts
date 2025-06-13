import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * ZeroLine component for charts
 */
export default class ZeroLine {
  /**
   * Create a zero line component
   * @param {Object} options - Zero line options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      color: '#666',
      width: 1,
      dashArray: '',
      opacity: 0.5
    }, options);
    
    this.element = null;
  }
  
  /**
   * Render the zero line
   * @param {SVGElement} container - SVG container
   * @param {Object} yScale - Y axis scale
   * @param {number} width - Chart width
   * @returns {SVGElement} The zero line element
   */
  render(container, yScale, width) {
    // Get zero position on y scale
    const zeroY = yScale.scale(0);
    
    // Create zero line
    this.element = SvgRenderer.createLine(
      0, zeroY, width, zeroY,
      {
        class: 'visioncharts-zero-line',
        stroke: this.options.color,
        'stroke-width': this.options.width,
        'stroke-dasharray': this.options.dashArray,
        opacity: this.options.opacity
      }
    );
    
    // Add to container
    container.appendChild(this.element);
    
    return this.element;
  }
  
  /**
   * Static method to render zero line for a specific panel
   * @param {SVGElement} panelGroup - Panel container
   * @param {Object} yScale - Y axis scale for this panel
   * @param {number} width - Panel width
   * @param {Object} options - Zero line options
   * @returns {SVGElement} The zero line element
   */
  static renderForPanel(panelGroup, yScale, width, options = {}) {
    console.log('ZeroLine.renderForPanel called');
    
    // Merge default options
    const mergedOptions = Object.assign({
      color: '#666',
      width: 1,
      dashArray: '',
      opacity: 0.5
    }, options);
    
    // Get zero position on y scale
    const zeroY = yScale.scale(0);
    
    // Create zero line for this panel
    const zeroLineElement = SvgRenderer.createLine(
      0, zeroY, width, zeroY,
      {
        class: 'visioncharts-panel-zero-line',
        stroke: mergedOptions.color,
        'stroke-width': mergedOptions.width,
        'stroke-dasharray': mergedOptions.dashArray,
        opacity: mergedOptions.opacity
      }
    );
    
    // Add to panel
    panelGroup.appendChild(zeroLineElement);
    
    return zeroLineElement;
  }
  
  /**
   * Update the zero line
   * @param {Object} yScale - Updated Y axis scale
   * @param {number} width - Chart width
   */
  update(yScale, width) {
    if (!this.element) return;
    
    const zeroY = yScale.scale(0);
    this.element.setAttribute('y1', zeroY);
    this.element.setAttribute('y2', zeroY);
    this.element.setAttribute('x2', width);
  }
  
  /**
   * Destroy the zero line
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * Crosshair component for interactive charts
 */
export default class Crosshair {
  /**
   * Create a new crosshair component
   * @param {Object} options - Crosshair options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Default options
      showX: true,
      showY: true,
      stroke: '#999',
      strokeWidth: 1,
      strokeDasharray: '4,4',
      snapToData: true
    }, options);
    
    this.elements = {
      x: null,
      y: null,
      group: null
    };
    
    this.visible = false;
  }
  
  /**
   * Render the crosshair
   * @param {SVGElement} container - SVG container
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @returns {SVGElement} Crosshair group element
   */
  render(container, width, height) {
    // Create group
    this.elements.group = SvgRenderer.createGroup({
      class: 'visioncharts-crosshair',
      opacity: 0
    });
    
    // Create X crosshair
    if (this.options.showX) {
      this.elements.x = SvgRenderer.createLine(0, 0, 0, height, {
        class: 'visioncharts-crosshair-x',
        stroke: this.options.stroke,
        'stroke-width': this.options.strokeWidth,
        'stroke-dasharray': this.options.strokeDasharray
      });
      
      this.elements.group.appendChild(this.elements.x);
    }
    
    // Create Y crosshair
    if (this.options.showY) {
      this.elements.y = SvgRenderer.createLine(0, 0, width, 0, {
        class: 'visioncharts-crosshair-y',
        stroke: this.options.stroke,
        'stroke-width': this.options.strokeWidth,
        'stroke-dasharray': this.options.strokeDasharray
      });
      
      this.elements.group.appendChild(this.elements.y);
    }
    
    // Add to container
    container.appendChild(this.elements.group);
    
    return this.elements.group;
  }
  
  /**
   * Update crosshair position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  update(x, y) {
    if (!this.elements.group) return;
    
    if (this.options.showX && this.elements.x) {
      this.elements.x.setAttribute('x1', x);
      this.elements.x.setAttribute('x2', x);
    }
    
    if (this.options.showY && this.elements.y) {
      this.elements.y.setAttribute('y1', y);
      this.elements.y.setAttribute('y2', y);
    }
    
    this.show();
  }
  
  /**
   * Show the crosshair
   */
  show() {
    if (this.elements.group) {
      this.elements.group.setAttribute('opacity', 1);
      this.visible = true;
    }
  }
  
  /**
   * Hide the crosshair
   */
  hide() {
    if (this.elements.group) {
      this.elements.group.setAttribute('opacity', 0);
      this.visible = false;
    }
  }
  
  /**
   * Destroy the crosshair
   */
  destroy() {
    if (this.elements.group && this.elements.group.parentNode) {
      this.elements.group.parentNode.removeChild(this.elements.group);
    }
    
    this.elements = {
      x: null,
      y: null,
      group: null
    };
  }
}
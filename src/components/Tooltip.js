import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * Tooltip component for charts
 */
export default class Tooltip {
  /**
   * Create a new tooltip component
   * @param {Object} options - Tooltip options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Default options
      followCursor: true,
      offset: { x: 10, y: 10 },
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      background: '#fff',
      border: '#ccc',
      borderWidth: 1,
      borderRadius: 4,
      fontSize: 12,
      fontFamily: 'sans-serif',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      maxWidth: 300,
      formatter: null,
      position: 'auto' // 'auto', 'top', 'right', 'bottom', 'left'
    }, options);
    
    this.elements = {
      tooltip: null,
      background: null,
      content: null
    };
    
    this.data = null;
    this.visible = false;
  }
  
  /**
   * Render the tooltip
   * @param {SVGElement} container - SVG container
   * @returns {SVGElement} Tooltip element
   */
  render(container) {
    // Create tooltip group
    this.elements.tooltip = SvgRenderer.createGroup({
      class: 'visioncharts-tooltip',
      opacity: 0
    });
    
    // Create background
    this.elements.background = SvgRenderer.createRect(0, 0, 0, 0, {
      class: 'visioncharts-tooltip-bg',
      fill: this.options.background,
      stroke: this.options.border,
      'stroke-width': this.options.borderWidth,
      rx: this.options.borderRadius,
      ry: this.options.borderRadius,
      'filter': this.options.boxShadow ? 'drop-shadow(0px 2px 3px rgba(0,0,0,0.2))' : null
    });
    
    // Create content container
    this.elements.content = SvgRenderer.createText('', 0, 0, {
      class: 'visioncharts-tooltip-text',
      'font-family': this.options.fontFamily,
      'font-size': this.options.fontSize
    });
    
    // Add to tooltip
    this.elements.tooltip.appendChild(this.elements.background);
    this.elements.tooltip.appendChild(this.elements.content);
    
    // Add to container
    container.appendChild(this.elements.tooltip);
    
    return this.elements.tooltip;
  }
  
  /**
   * Show the tooltip
   * @param {Object} data - Tooltip data
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} containerBounds - Container bounds
   */
  show(data, x, y, containerBounds) {
    if (!this.elements.tooltip) return;
    
    this.data = data;
    
    // Clear existing content
    this.elements.content.textContent = '';
    
    // Format content
    let content;
    if (typeof this.options.formatter === 'function') {
      content = this.options.formatter(data);
    } else {
      content = JSON.stringify(data);
    }
    
    // Create text elements for multiline support
    const lines = Array.isArray(content) ? content : String(content).split('\n');
    
    lines.forEach((line, i) => {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.textContent = line;
      tspan.setAttribute('x', this.options.padding.left);
      tspan.setAttribute('dy', i === 0 ? this.options.padding.top + 16 : 16);
      this.elements.content.appendChild(tspan);
    });
    
    // Calculate dimensions
    const contentBBox = this.elements.content.getBBox();
    const tooltipWidth = Math.min(
      this.options.maxWidth,
      contentBBox.width + this.options.padding.left + this.options.padding.right
    );
    const tooltipHeight = contentBBox.height + this.options.padding.top + this.options.padding.bottom;
    
    // Update background dimensions
    this.elements.background.setAttribute('width', tooltipWidth);
    this.elements.background.setAttribute('height', tooltipHeight);
    
    // Determine tooltip position
    let tooltipX = x + this.options.offset.x;
    let tooltipY = y + this.options.offset.y;
    
    // Adjust position to keep tooltip within bounds
    if (containerBounds) {
      const { width, height } = containerBounds;
      
      // Check if tooltip would go off right edge
      if (tooltipX + tooltipWidth > width) {
        tooltipX = x - tooltipWidth - this.options.offset.x;
      }
      
      // Check if tooltip would go off bottom edge
      if (tooltipY + tooltipHeight > height) {
        tooltipY = y - tooltipHeight - this.options.offset.y;
      }
      
      // Ensure tooltip is not positioned off the left or top edge
      tooltipX = Math.max(0, tooltipX);
      tooltipY = Math.max(0, tooltipY);
    }
    
    // Update tooltip position
    this.elements.tooltip.setAttribute('transform', `translate(${tooltipX},${tooltipY})`);
    
    // Show tooltip
    this.elements.tooltip.setAttribute('opacity', 1);
    this.visible = true;
  }
  
  /**
   * Update tooltip position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} containerBounds - Container bounds
   */
  move(x, y, containerBounds) {
    if (!this.visible || !this.elements.tooltip) return;
    
    if (this.options.followCursor) {
      this.show(this.data, x, y, containerBounds);
    }
  }
  
  /**
   * Hide the tooltip
   */
  hide() {
    if (this.elements.tooltip) {
      this.elements.tooltip.setAttribute('opacity', 0);
      this.visible = false;
    }
  }
  
  /**
   * Destroy the tooltip
   */
  destroy() {
    if (this.elements.tooltip && this.elements.tooltip.parentNode) {
      this.elements.tooltip.parentNode.removeChild(this.elements.tooltip);
    }
    
    this.elements = {
      tooltip: null,
      background: null,
      content: null
    };
  }
}
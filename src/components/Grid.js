import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * Grid component for rendering chart grid lines
 */
export default class Grid {
  /**
   * Create a new grid instance
   * @param {Object} options - Grid configuration
   */
  constructor(options = {}) {
    this.options = {
      show: true,
      color: '#e0e0e0',
      strokeWidth: 1,
      dashArray: '4,4',
      showX: true,
      showY: true,
      opacity: 1,
      ...options
    };
    
    this.elements = {
      group: null,
      xLines: [],
      yLines: []
    };
  }
  
  /**
   * Render grid for single-panel mode
   * @param {SVGElement} container - Container element
   * @param {Object} xScale - X scale
   * @param {Object} yScale - Y scale
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} chartOptions - Chart options for tick generation
   */
  render(container, xScale, yScale, width, height, chartOptions = {}) {
    if (!this.options.show || !container) return;
    
    console.log('Grid.render called');
    
    // Clean up existing grid
    this.destroy();
    
    // Create grid group
    this.elements.group = SvgRenderer.createGroup({ 
      class: 'visioncharts-grid',
      opacity: this.options.opacity
    });
    
    // Render Y grid lines (vertical lines)
    if (this.options.showY && yScale) {
      this.renderYGridLines(yScale, width, height, chartOptions);
    }
    
    // Render X grid lines (horizontal lines)
    if (this.options.showX && xScale) {
      this.renderXGridLines(xScale, width, height, chartOptions);
    }
    
    // Add grid to container (insert at beginning so it's behind other elements)
    container.insertBefore(this.elements.group, container.firstChild);
  }
  
  /**
   * Render Y grid lines (vertical lines at Y tick positions)
   * @private
   */
  renderYGridLines(yScale, width, height, chartOptions = {}) {
    // Use simple approach: generate evenly spaced lines across the height
    const tickCount = chartOptions.yTickCount || 5;
    
    // Generate evenly spaced Y positions
    for (let i = 0; i < tickCount; i++) {
      const y = (height / (tickCount - 1)) * i;
      
      // Skip if outside bounds
      if (y < 0 || y > height) continue;
      
      const line = SvgRenderer.createLine(
        0, y,
        width, y,
        {
          stroke: this.options.color,
          'stroke-width': this.options.strokeWidth,
          'stroke-dasharray': this.options.dashArray,
          class: 'visioncharts-grid-y-line'
        }
      );
      
      this.elements.yLines.push(line);
      this.elements.group.appendChild(line);
    }
  }
  
  /**
   * Render X grid lines (horizontal lines at X tick positions)
   * @private
   */
  renderXGridLines(xScale, width, height, chartOptions = {}) {
    // Use simple approach: generate evenly spaced lines across the width
    const tickCount = chartOptions.xTickCount || 6;
    
    // Generate evenly spaced X positions
    for (let i = 0; i < tickCount; i++) {
      const x = (width / (tickCount - 1)) * i;
      
      // Skip if outside bounds
      if (x < 0 || x > width) continue;
      
      const line = SvgRenderer.createLine(
        x, 0,
        x, height,
        {
          stroke: this.options.color,
          'stroke-width': this.options.strokeWidth,
          'stroke-dasharray': this.options.dashArray,
          class: 'visioncharts-grid-x-line'
        }
      );
      
      this.elements.xLines.push(line);
      this.elements.group.appendChild(line);
    }
  }
  
  /**
   * Generate tick values for a scale
   * @private
   */
  generateTicks(scale, tickCount) {
    // Try different methods to get the domain based on how the scale is implemented
    let domain;
    
    if (typeof scale.getDomain === 'function') {
      domain = scale.getDomain();
    } else if (typeof scale.domain === 'function') {
      domain = scale.domain();
    } else if (scale.domain && Array.isArray(scale.domain)) {
      domain = scale.domain;
    } else if (scale._domain && Array.isArray(scale._domain)) {
      domain = scale._domain;
    } else {
      console.warn('Could not access scale domain, using default');
      return [];
    }
    
    const ticks = [];
    
    if (!domain || domain.length < 2) {
      console.warn('Invalid domain for grid ticks:', domain);
      return [];
    }
    
    if (scale.constructor.name === 'TimeScale') {
      // For time scales, generate reasonable time intervals
      const start = domain[0];
      const end = domain[1];
      const interval = (end.getTime() - start.getTime()) / (tickCount - 1);
      
      for (let i = 0; i < tickCount; i++) {
        ticks.push(new Date(start.getTime() + i * interval));
      }
    } else if (scale.constructor.name === 'LogScale') {
      // For log scales, generate logarithmic intervals
      const start = Math.log10(domain[0]);
      const end = Math.log10(domain[1]);
      const interval = (end - start) / (tickCount - 1);
      
      for (let i = 0; i < tickCount; i++) {
        ticks.push(Math.pow(10, start + i * interval));
      }
    } else {
      // For linear scales, generate linear intervals
      const start = domain[0];
      const end = domain[1];
      const interval = (end - start) / (tickCount - 1);
      
      for (let i = 0; i < tickCount; i++) {
        ticks.push(start + i * interval);
      }
    }
    
    return ticks;
  }
  
  /**
   * Static method to render grid for panels
   * @param {SVGElement} panelGroup - Panel container
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} width - Panel width
   * @param {number} height - Panel height
   * @param {Object} options - Grid options
   * @param {Object} chartOptions - Chart options for tick counts
   */
  static renderForPanel(panelGroup, xScale, yScale, width, height, options = {}, chartOptions = {}) {
    if (!options.show) return;
    
    console.log('Grid.renderForPanel called');
    
    // Create temporary grid instance for panel
    const grid = new Grid(options);
    grid.render(panelGroup, xScale, yScale, width, height, chartOptions);
    
    return grid;
  }
  
  /**
   * Update grid with new scales or dimensions
   * @param {Object} xScale - X scale
   * @param {Object} yScale - Y scale
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} chartOptions - Chart options for tick generation
   */
  update(xScale, yScale, width, height, chartOptions = {}) {
    if (!this.elements.group || !this.options.show) return;
    
    console.log('Grid.update called');
    
    // Clear existing lines
    this.elements.xLines.forEach(line => {
      if (line.parentNode) line.parentNode.removeChild(line);
    });
    this.elements.yLines.forEach(line => {
      if (line.parentNode) line.parentNode.removeChild(line);
    });
    
    this.elements.xLines = [];
    this.elements.yLines = [];
    
    // Re-render grid lines
    if (this.options.showY && yScale) {
      this.renderYGridLines(yScale, width, height, chartOptions);
    }
    
    if (this.options.showX && xScale) {
      this.renderXGridLines(xScale, width, height, chartOptions);
    }
  }
  
  /**
   * Hide the grid
   */
  hide() {
    if (this.elements.group) {
      this.elements.group.style.display = 'none';
    }
  }
  
  /**
   * Show the grid
   */
  show() {
    if (this.elements.group) {
      this.elements.group.style.display = 'block';
    }
  }
  
  /**
   * Set grid options
   * @param {Object} options - New options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
    
    // Update existing elements if they exist
    if (this.elements.group) {
      this.elements.group.setAttribute('opacity', this.options.opacity);
    }
    
    // Update line styles
    [...this.elements.xLines, ...this.elements.yLines].forEach(line => {
      line.setAttribute('stroke', this.options.color);
      line.setAttribute('stroke-width', this.options.strokeWidth);
      line.setAttribute('stroke-dasharray', this.options.dashArray);
    });
  }
  
  /**
   * Clean up grid elements
   */
  destroy() {
    if (this.elements.group && this.elements.group.parentNode) {
      this.elements.group.parentNode.removeChild(this.elements.group);
    }
    
    this.elements = {
      group: null,
      xLines: [],
      yLines: []
    };
  }
}
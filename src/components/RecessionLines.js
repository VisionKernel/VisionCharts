import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * RecessionLines component for financial charts
 * Visualizes economic recession periods as shaded areas
 */
export default class RecessionLines {
  /**
   * Create a recession lines component
   * @param {Object} options - Recession lines options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      color: 'rgba(235, 54, 54, 0.15)',
      border: 'rgba(235, 54, 54, 0.3)',
      borderWidth: 1,
      labelColor: '#888',
      labelFontSize: 10,
      showLabels: true,
      labelPosition: 'top', // 'top', 'bottom'
      labelFormat: (start, end) => {
        // Format dates for label display
        const formatYear = date => date.getFullYear();
        return `${formatYear(start)}${end ? '-' + formatYear(end) : ''}`;
      }
    }, options);
    
    this.elements = {
      group: null,
      areas: []
    };
  }
  
  /**
   * Render recession areas
   * @param {SVGElement} container - SVG container
   * @param {Array} recessions - Array of recession periods with start and end dates
   * @param {Object} xScale - X axis scale
   * @param {number} height - Chart height
   * @returns {SVGElement} The recession lines group element
   */
  render(container, recessions, xScale, height) {
    // Create main group
    this.elements.group = SvgRenderer.createGroup({
      class: 'visioncharts-recession-lines'
    });
    
    // Ensure we have recessions data
    if (!recessions || !recessions.length) {
      container.appendChild(this.elements.group);
      return this.elements.group;
    }
    
    // Process each recession period
    recessions.forEach((recession, index) => {
      // Extract dates
      const startDate = recession.start instanceof Date ? 
                        recession.start : new Date(recession.start);
      const endDate = recession.end instanceof Date ? 
                        recession.end : (recession.end ? new Date(recession.end) : null);
      
      // Validate dates
      if (!startDate || isNaN(startDate.getTime())) {
        console.warn('Invalid recession start date:', recession.start);
        return;
      }
      
      // If end date is invalid or missing, assume the recession is ongoing
      // and use the current date as the end
      const validEndDate = (endDate && !isNaN(endDate.getTime())) ? 
                          endDate : new Date();
      
      // Get x coordinates using the scale
      const startX = xScale.scale(startDate);
      const endX = xScale.scale(validEndDate);
      
      // Create recession area
      const areaGroup = SvgRenderer.createGroup({
        class: `visioncharts-recession-area recession-${index}`,
        'data-start': startDate.toISOString(),
        'data-end': validEndDate.toISOString()
      });
      
      // Create rectangle for recession period
      const rect = SvgRenderer.createRect(
        startX,
        0,
        endX - startX,
        height,
        {
          fill: this.options.color,
          stroke: this.options.border,
          'stroke-width': this.options.borderWidth,
          'stroke-opacity': 0.7
        }
      );
      
      areaGroup.appendChild(rect);
      
      // Add label if enabled
      if (this.options.showLabels) {
        const labelY = this.options.labelPosition === 'top' ? 15 : height - 5;
        const labelText = this.options.labelFormat(startDate, endDate);
        
        // Center the label
        const labelX = startX + (endX - startX) / 2;
        
        const label = SvgRenderer.createText(
          labelText,
          labelX,
          labelY,
          {
            'text-anchor': 'middle',
            'dominant-baseline': this.options.labelPosition === 'top' ? 'hanging' : 'text-after-edge',
            'font-size': this.options.labelFontSize,
            'fill': this.options.labelColor,
            'font-family': 'sans-serif',
            'pointer-events': 'none'
          }
        );
        
        areaGroup.appendChild(label);
      }
      
      // Add to group
      this.elements.group.appendChild(areaGroup);
      this.elements.areas.push(areaGroup);
    });
    
    // Add to container
    container.appendChild(this.elements.group);
    
    return this.elements.group;
  }
  
  /**
   * Update recession areas
   * @param {Array} recessions - New recession data
   * @param {Object} xScale - Updated X axis scale
   * @param {number} height - Chart height
   */
  update(recessions, xScale, height) {
    // Remove existing areas
    this.destroy();
    
    // Re-render with new data
    if (this.elements.group && this.elements.group.parentNode) {
      this.render(this.elements.group.parentNode, recessions, xScale, height);
    }
  }
  
  /**
   * Destroy recession areas
   */
  destroy() {
    this.elements.areas = [];
    
    if (this.elements.group && this.elements.group.parentNode) {
      this.elements.group.parentNode.removeChild(this.elements.group);
      this.elements.group = null;
    }
  }
}
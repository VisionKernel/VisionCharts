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
      color: 'rgba(64, 64, 64, 0.4)', // Darker grey with more opacity
      border: 'rgba(80, 80, 80, 0.5)',
      borderWidth: 1,
      labelColor: '#888',
      labelFontSize: 10,
      showLabels: false, // default to false to avoid clutter
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
   * Render recession areas for single-panel charts
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
      this._renderRecessionArea(this.elements.group, recession, index, xScale, height, height);
    });
    
    // Add to container
    container.appendChild(this.elements.group);
    
    return this.elements.group;
  }

  /**
   * Static method to render recession lines for a specific panel
   * @param {SVGElement} panel - Panel SVG element
   * @param {Array} recessions - Array of recession periods
   * @param {Object} xScale - X axis scale for this panel
   * @param {number} height - Panel height
   * @param {number} width - Panel width
   * @param {string} xType - X axis type ('time', 'category', 'number')
   * @param {Object} options - Recession lines options
   */
  static renderForPanel(panel, recessions, xScale, height, width, xType = 'time', options = {}) {
    // Merge default options
    const mergedOptions = Object.assign({
      color: 'rgba(85, 81, 81, 0.15)',
      border: 'rgba(110, 104, 104, 0.3)',
      borderWidth: 1,
      labelColor: '#888',
      labelFontSize: 10,
      showLabels: false,
      labelPosition: 'top'
    }, options);

    // Create recession lines group for this panel
    const recessionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    recessionsGroup.setAttribute('class', 'visioncharts-panel-recession-lines');
    
    // Process each recession period
    recessions.forEach((recession, index) => {
      RecessionLines._renderPanelRecessionArea(
        recessionsGroup, 
        recession, 
        index, 
        xScale, 
        height, 
        width, 
        xType, 
        mergedOptions
      );
    });
    
    // Add to panel
    panel.appendChild(recessionsGroup);
    
    return recessionsGroup;
  }

  /**
   * Private method to render a single recession area for panels
   * @private
   */
  static _renderPanelRecessionArea(container, recession, index, xScale, height, width, xType, options) {
    // Extract dates
    const startDate = recession.start instanceof Date ? 
                    recession.start : new Date(recession.start);
    const endDate = recession.end instanceof Date ? 
                    recession.end : (recession.end ? new Date(recession.end) : new Date());
    
    // Validate dates
    if (!startDate || isNaN(startDate.getTime())) {
      console.warn('Invalid recession start date:', recession.start);
      return;
    }
    
    if (!endDate || isNaN(endDate.getTime())) {
      console.warn('Invalid recession end date:', recession.end);
      return;
    }
    
    try {
      if (xType === 'category') {
        // For category scale, recession areas should span the full width
        // since categories don't necessarily correspond to dates
        const recessionArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        recessionArea.setAttribute('x', 0);
        recessionArea.setAttribute('y', 0);
        recessionArea.setAttribute('width', width);
        recessionArea.setAttribute('height', height);
        recessionArea.setAttribute('fill', options.color);
        recessionArea.setAttribute('stroke', options.border);
        recessionArea.setAttribute('stroke-width', options.borderWidth);
        recessionArea.setAttribute('class', `visioncharts-panel-recession-area recession-${index}`);
        
        container.appendChild(recessionArea);
        
        // Add label if enabled
        if (options.showLabels) {
          const labelText = `${startDate.getFullYear()}${endDate ? '-' + endDate.getFullYear() : ''}`;
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          label.setAttribute('x', width / 2);
          label.setAttribute('y', 15);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('font-size', options.labelFontSize);
          label.setAttribute('fill', options.labelColor);
          label.setAttribute('class', 'visioncharts-panel-recession-label');
          
          container.appendChild(label);
        }
      } else {
        // For time/numeric scales, use normal recession rendering
        const startX = xScale.scale(startDate);
        const endX = xScale.scale(endDate);
        
        // Only render if the recession overlaps with this panel's time range
        if (startX < width && endX > 0) {
          // Clamp to panel bounds
          const clampedStartX = Math.max(0, startX);
          const clampedEndX = Math.min(width, endX);
          
          // Create recession area
          const recessionArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          recessionArea.setAttribute('x', clampedStartX);
          recessionArea.setAttribute('y', 0);
          recessionArea.setAttribute('width', clampedEndX - clampedStartX);
          recessionArea.setAttribute('height', height);
          recessionArea.setAttribute('fill', options.color);
          recessionArea.setAttribute('stroke', options.border);
          recessionArea.setAttribute('stroke-width', options.borderWidth);
          recessionArea.setAttribute('class', `visioncharts-panel-recession-area recession-${index}`);
          
          // Add to group
          container.appendChild(recessionArea);
          
          // Add label if there's enough space and labels are enabled
          if (options.showLabels && clampedEndX - clampedStartX > 30) {
            const labelText = `${startDate.getFullYear()}${endDate ? '-' + endDate.getFullYear() : ''}`;
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.textContent = labelText;
            label.setAttribute('x', clampedStartX + (clampedEndX - clampedStartX) / 2);
            label.setAttribute('y', 15);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', options.labelFontSize);
            label.setAttribute('fill', options.labelColor);
            label.setAttribute('class', 'visioncharts-panel-recession-label');
            
            container.appendChild(label);
          }
        }
      }
    } catch (error) {
      console.error('Error rendering panel recession area:', error);
    }
  }

  /**
   * Private method to render a single recession area (for single-panel charts)
   * @private
   */
  _renderRecessionArea(container, recession, index, xScale, height, totalHeight) {
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
    
    try {
      // Get x coordinates using the scale
      const startX = xScale.scale(startDate);
      const endX = xScale.scale(validEndDate);
      
      // Create recession area group
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
      
      // Add label if enabled and there's enough space
      if (this.options.showLabels && endX - startX > 30) {
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
      
      // Add to container
      container.appendChild(areaGroup);
      this.elements.areas.push(areaGroup);
    } catch (error) {
      console.error('Error rendering recession area:', error);
    }
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
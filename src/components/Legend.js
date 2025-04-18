import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * Legend component for charts
 */
export default class Legend {
  /**
   * Create a new legend component
   * @param {Object} options - Legend options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Default options
      position: 'bottom', // 'top', 'right', 'bottom', 'left'
      align: 'center',    // 'start', 'center', 'end'
      orientation: 'horizontal', // 'horizontal', 'vertical'
      itemMargin: 10,
      symbolSize: 12,
      fontSize: 12,
      fontFamily: 'sans-serif',
      interactive: true,  // Allow toggling series visibility
      wrapText: true,
      maxWidth: null,
      padding: { top: 5, right: 10, bottom: 5, left: 10 }
    }, options);
    
    this.items = [];
    this.element = null;
  }
  
  /**
   * Set legend items
   * @param {Array} items - Legend items
   * @returns {Legend} This legend instance
   */
  setItems(items) {
    this.items = items.map(item => ({
      label: item.label || '',
      color: item.color || '#000',
      visible: item.visible !== false,
      type: item.type || 'rect',
      id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`
    }));
    
    return this;
  }
  
  /**
   * Render the legend
   * @param {SVGElement} container - SVG container
   * @param {number} width - Container width
   * @param {number} height - Container height
   * @returns {SVGElement} Legend element
   */
  render(container, width, height) {
    // Create legend group
    this.element = SvgRenderer.createGroup({
      class: 'visioncharts-legend'
    });
    
    if (!this.items.length) return this.element;
    
    // Create background
    const background = SvgRenderer.createRect(0, 0, 0, 0, {
      class: 'visioncharts-legend-bg',
      fill: '#fff',
      'fill-opacity': 0.85,
      stroke: '#e0e0e0',
      'stroke-width': 1,
      rx: 4,
      ry: 4
    });
    
    // Add items
    const itemsGroup = SvgRenderer.createGroup({
      class: 'visioncharts-legend-items'
    });
    
    const isHorizontal = this.options.orientation === 'horizontal';
    let x = this.options.padding.left;
    let y = this.options.padding.top;
    let rowHeight = 0;
    let maxWidth = 0;
    
    this.items.forEach(item => {
      // Create item group
      const itemGroup = SvgRenderer.createGroup({
        class: 'visioncharts-legend-item',
        'data-id': item.id,
        opacity: item.visible ? 1 : 0.5
      });
      
      // Create symbol
      let symbol;
      if (item.type === 'line') {
        symbol = SvgRenderer.createLine(
          x,
          y + this.options.symbolSize / 2,
          x + this.options.symbolSize,
          y + this.options.symbolSize / 2,
          {
            class: 'visioncharts-legend-symbol',
            stroke: item.color,
            'stroke-width': 2
          }
        );
      } else {
        symbol = SvgRenderer.createRect(
          x,
          y,
          this.options.symbolSize,
          this.options.symbolSize,
          {
            class: 'visioncharts-legend-symbol',
            fill: item.color
          }
        );
      }
      
      // Create label
      const label = SvgRenderer.createText(
        item.label,
        x + this.options.symbolSize + 5,
        y + this.options.symbolSize / 2,
        {
          class: 'visioncharts-legend-label',
          'dominant-baseline': 'middle',
          'font-family': this.options.fontFamily,
          'font-size': this.options.fontSize
        }
      );
      
      // Add to item group
      itemGroup.appendChild(symbol);
      itemGroup.appendChild(label);
      
      // Add interactivity
      if (this.options.interactive) {
        itemGroup.style.cursor = 'pointer';
        itemGroup.addEventListener('click', () => {
          item.visible = !item.visible;
          itemGroup.setAttribute('opacity', item.visible ? 1 : 0.5);
          
          // Dispatch event
          const event = new CustomEvent('legend-item-click', {
            detail: { id: item.id, visible: item.visible }
          });
          this.element.dispatchEvent(event);
        });
      }
      
      // Add to items group
      itemsGroup.appendChild(itemGroup);
      
      // Calculate dimensions for next item
      const labelBBox = label.getBBox();
      const itemWidth = this.options.symbolSize + 5 + labelBBox.width;
      const itemHeight = Math.max(this.options.symbolSize, labelBBox.height);
      
      // Update max width
      maxWidth = Math.max(maxWidth, itemWidth);
      rowHeight = Math.max(rowHeight, itemHeight);
      
      // Update position for next item
      if (isHorizontal) {
        x += itemWidth + this.options.itemMargin;
        
        // Wrap to next row if needed
        if (this.options.wrapText && 
            this.options.maxWidth && 
            x > this.options.maxWidth - this.options.padding.right) {
          x = this.options.padding.left;
          y += rowHeight + 5;
          rowHeight = 0;
        }
      } else {
        y += itemHeight + 5;
      }
    });
    
    // Add items to legend
    this.element.appendChild(background);
    this.element.appendChild(itemsGroup);
    
    // Calculate legend dimensions
    const legendBBox = itemsGroup.getBBox();
    const legendWidth = legendBBox.width + this.options.padding.left + this.options.padding.right;
    const legendHeight = legendBBox.height + this.options.padding.top + this.options.padding.bottom;
    
    // Update background dimensions
    background.setAttribute('width', legendWidth);
    background.setAttribute('height', legendHeight);
    
    // Position legend
    let legendX = 0;
    let legendY = 0;
    
    switch (this.options.position) {
      case 'top':
        legendY = 0;
        break;
      case 'bottom':
        legendY = height - legendHeight;
        break;
      case 'left':
        legendY = (height - legendHeight) / 2;
        break;
      case 'right':
        legendX = width - legendWidth;
        legendY = (height - legendHeight) / 2;
        break;
    }
    
    // Adjust horizontal alignment
    if (this.options.position === 'top' || this.options.position === 'bottom') {
      switch (this.options.align) {
        case 'start':
          legendX = 0;
          break;
        case 'center':
          legendX = (width - legendWidth) / 2;
          break;
        case 'end':
          legendX = width - legendWidth;
          break;
      }
    }
    
    // Update legend position
    this.element.setAttribute('transform', `translate(${legendX},${legendY})`);
    
    // Add to container
    container.appendChild(this.element);
    
    return this.element;
  }
  
  /**
   * Update the legend
   */
  update() {
    const parent = this.element?.parentNode;
    if (!parent) return;
    
    const width = parseInt(parent.getAttribute('width') || parent.getBoundingClientRect().width);
    const height = parseInt(parent.getAttribute('height') || parent.getBoundingClientRect().height);
    
    // Remove old legend
    if (this.element) {
      parent.removeChild(this.element);
    }
    
    // Re-render
    this.render(parent, width, height);
  }
  
  /**
   * Destroy the legend
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
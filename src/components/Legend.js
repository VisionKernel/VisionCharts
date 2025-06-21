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
      itemMargin: 20, // Increased from 10 to 20 for better spacing
      symbolSize: 12,
      fontSize: 12,
      fontFamily: 'sans-serif',
      interactive: true,
      wrapText: true,
      maxWidth: null,
      padding: { top: 8, right: 15, bottom: 8, left: 15 }, // Increased padding
      titleOffset: 0 // New: offset for title space
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
    
    // Create items with better width calculation (inspired by your old code)
    const itemElements = [];
    const itemSpacing = this.options.itemMargin;
    let totalWidth = 0;
    
    // First pass - create all items and calculate total width using your approach
    this.items.forEach((item, index) => {
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
          0, this.options.symbolSize / 2,
          this.options.symbolSize, this.options.symbolSize / 2,
          {
            class: 'visioncharts-legend-symbol',
            stroke: item.color,
            'stroke-width': 2
          }
        );
      } else {
        symbol = SvgRenderer.createRect(
          0, 0,
          this.options.symbolSize, this.options.symbolSize,
          {
            class: 'visioncharts-legend-symbol',
            fill: item.color
          }
        );
      }
      
      // Create label with proper spacing
      const label = SvgRenderer.createText(
        item.label,
        this.options.symbolSize + 8,
        this.options.symbolSize / 2,
        {
          class: 'visioncharts-legend-label',
          'dominant-baseline': 'middle',
          'font-family': this.options.fontFamily,
          'font-size': this.options.fontSize,
          fill: '#333'
        }
      );
      
      // Add to item group
      itemGroup.appendChild(symbol);
      itemGroup.appendChild(label);
      
      // Calculate width using your reliable method (character-based calculation)
      const labelWidth = item.label ? item.label.length * (this.options.fontSize * 0.7) : 50;
      const itemWidth = this.options.symbolSize + 8 + labelWidth + 10; // symbol + spacing + text + padding
      
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
      
      itemElements.push({
        element: itemGroup,
        width: itemWidth,
        item: item
      });
      
      totalWidth += itemWidth + itemSpacing;
    });
    
    // Remove last spacing
    totalWidth -= itemSpacing;
    
    // Add padding
    totalWidth += this.options.padding.left + this.options.padding.right;
    const legendHeight = this.options.symbolSize + this.options.padding.top + this.options.padding.bottom;
    
    // Create background
    const background = SvgRenderer.createRect(0, 0, totalWidth, legendHeight, {
      class: 'visioncharts-legend-bg',
      fill: '#fff',
      'fill-opacity': 0.85,
      stroke: '#e0e0e0',
      'stroke-width': 1,
      rx: 4,
      ry: 4
    });
    
    // Check if we need wrapping (similar to your old approach)
    const maxWidthPerRow = width * 0.9;
    const needsWrapping = totalWidth > maxWidthPerRow;
    
    if (needsWrapping && this.options.wrapText) {
      // Multi-row layout (inspired by your wrapping logic)
      let currentX = this.options.padding.left;
      let currentY = this.options.padding.top;
      let rowWidth = 0;
      let maxRowWidth = 0;
      const rowHeight = this.options.symbolSize + 10; // Extra spacing between rows
      
      itemElements.forEach(itemData => {
        // Check if adding this item would exceed max width
        if (rowWidth + itemData.width > maxWidthPerRow - this.options.padding.left - this.options.padding.right && rowWidth > 0) {
          // Start new row
          maxRowWidth = Math.max(maxRowWidth, rowWidth);
          currentY += rowHeight;
          currentX = this.options.padding.left;
          rowWidth = 0;
        }
        
        // Position item
        itemData.element.setAttribute('transform', `translate(${currentX}, ${currentY})`);
        this.element.appendChild(itemData.element);
        
        // Update for next item
        currentX += itemData.width + itemSpacing;
        rowWidth += itemData.width + itemSpacing;
      });
      
      // Update final dimensions
      maxRowWidth = Math.max(maxRowWidth, rowWidth);
      const finalWidth = maxRowWidth + this.options.padding.left + this.options.padding.right;
      const finalHeight = currentY + this.options.symbolSize + this.options.padding.bottom;
      
      // Update background size
      background.setAttribute('width', finalWidth);
      background.setAttribute('height', finalHeight);
      
      totalWidth = finalWidth;
    } else {
      // Single row layout (your original approach)
      let currentX = this.options.padding.left;
      const currentY = this.options.padding.top;
      
      itemElements.forEach(itemData => {
        itemData.element.setAttribute('transform', `translate(${currentX}, ${currentY})`);
        this.element.appendChild(itemData.element);
        currentX += itemData.width + itemSpacing;
      });
    }
    
    // Add background first
    this.element.insertBefore(background, this.element.firstChild);
    
    // Position legend using your reliable centering approach
    let legendX = 0;
    let legendY = 0;
    
    switch (this.options.position) {
      case 'top':
        legendY = this.options.titleOffset + 5;
        break;
      case 'bottom':
        legendY = height - parseInt(background.getAttribute('height'));
        break;
      case 'left':
        legendY = (height - parseInt(background.getAttribute('height'))) / 2;
        break;
      case 'right':
        legendX = width - totalWidth;
        legendY = (height - parseInt(background.getAttribute('height'))) / 2;
        break;
    }
    
    // Center horizontally for top and bottom positions (your approach)
    if (this.options.position === 'top' || this.options.position === 'bottom') {
      switch (this.options.align) {
        case 'start':
          legendX = 0;
          break;
        case 'center':
          legendX = Math.max(0, (width - totalWidth) / 2);
          break;
        case 'end':
          legendX = Math.max(0, width - totalWidth);
          break;
      }
    }
    
    // Ensure legend doesn't go outside container bounds
    legendX = Math.max(0, Math.min(legendX, width - totalWidth));
    legendY = Math.max(0, legendY);
    
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
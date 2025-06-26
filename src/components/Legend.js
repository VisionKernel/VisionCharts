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
      titleOffset: 0, // New: offset for title space
      showStudyBadges: true, // New: whether to show study badges
      showStudyTooltips: true // New: whether to show study tooltips
    }, options);
    
    this.items = [];
    this.element = null;
    this.studyTooltip = null;
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
      id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
      studyCount: item.studyCount || 0,
      studyNames: item.studyNames || '',
      studies: item.studies || []
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
    
    // Create items with better width calculation
    const itemElements = [];
    const itemSpacing = this.options.itemMargin;
    let totalWidth = 0;
    
    // First pass - create all items and calculate total width
    let currentX = this.options.padding.left;
    let currentY = this.options.padding.top;
    
    this.items.forEach((item, index) => {
      // Calculate position for this item
      let x, y;
      if (this.options.orientation === 'horizontal') {
        x = currentX;
        y = this.options.padding.top;
      } else {
        x = this.options.padding.left;
        y = currentY;
      }
      
      // Create item group
      const itemGroup = SvgRenderer.createGroup({
        class: 'visioncharts-legend-item',
        'data-id': item.id,
        transform: `translate(${x}, ${y})`,
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
      
      // Create label
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
      
      // Calculate base width
      const labelWidth = item.label ? item.label.length * (this.options.fontSize * 0.7) : 50;
      let itemWidth = this.options.symbolSize + 8 + labelWidth;
      
      // ENHANCED: Add study badge if studies exist
      let studyBadge = null;
      if (item.studyCount && item.studyCount > 0 && this.options.showStudyBadges) {
        const badgeX = itemWidth + 5; // Small gap after label
        const badgeText = `+${item.studyCount}`;
        
        // Create badge background
        const badgeWidth = 20; // Compact fixed width
        const badgeHeight = 14;
        const badgeBg = SvgRenderer.createRect(
          badgeX, -2,
          badgeWidth, badgeHeight,
          {
            class: 'visioncharts-legend-study-badge-bg',
            fill: '#f8f9fa',
            stroke: '#6c757d',
            'stroke-width': 1,
            rx: 3,
            ry: 3
          }
        );
        
        // Create badge text
        const badgeLabel = SvgRenderer.createText(
          badgeText,
          badgeX + badgeWidth/2,
          this.options.symbolSize / 2,
          {
            class: 'visioncharts-legend-study-badge-text',
            'dominant-baseline': 'middle',
            'text-anchor': 'middle',
            'font-family': this.options.fontFamily,
            'font-size': '9px',
            'font-weight': 'bold',
            fill: '#6c757d'
          }
        );
        
        // Create badge group
        studyBadge = SvgRenderer.createGroup({
          class: 'visioncharts-legend-study-badge',
          style: 'cursor: pointer;'
        });
        
        studyBadge.appendChild(badgeBg);
        studyBadge.appendChild(badgeLabel);
        
        // FIXED: Add click handler for badge
        studyBadge.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent parent item click
          e.preventDefault();  // Prevent any default behavior
          
          console.log('Study badge clicked for:', item.label);
          
          // Dispatch custom event for study badge click
          const event = new CustomEvent('legend-study-badge-click', {
            detail: {
              datasetId: item.id,
              studies: item.studies
            }
          });
          this.element.dispatchEvent(event);
        });
        
        // FIXED: Better tooltip handling that prevents chart tooltip interference
        if (this.options.showStudyTooltips && item.studyNames) {
          let studyTooltipTimeout;
          
          studyBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation(); // Stop chart tooltip from activating
            
            console.log('Study badge hovered:', item.studyNames);
            
            // Clear any existing timeout
            if (studyTooltipTimeout) {
              clearTimeout(studyTooltipTimeout);
            }
            
            // Show tooltip after small delay
            studyTooltipTimeout = setTimeout(() => {
              this.showStudyTooltip(e, item.studyNames);
            }, 100);
            
            // Visual feedback - make badge darker on hover
            const badgeBg = studyBadge.querySelector('.visioncharts-legend-study-badge-bg');
            if (badgeBg) {
              badgeBg.setAttribute('fill', '#e9ecef');
              badgeBg.setAttribute('stroke', '#495057');
            }
          });
          
          studyBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            
            // Clear timeout if we leave before tooltip shows
            if (studyTooltipTimeout) {
              clearTimeout(studyTooltipTimeout);
            }
            
            // Hide tooltip
            this.hideStudyTooltip();
            
            // Reset badge appearance
            const badgeBg = studyBadge.querySelector('.visioncharts-legend-study-badge-bg');
            if (badgeBg) {
              badgeBg.setAttribute('fill', '#f8f9fa');
              badgeBg.setAttribute('stroke', '#6c757d');
            }
          });
          
          // ENHANCED: Prevent chart interactions on badge area
          studyBadge.addEventListener('mousemove', (e) => {
            e.stopPropagation(); // Prevent chart tooltip positioning
          });
          
          // DEBUGGING: Add this to verify the badge is being hovered
          studyBadge.addEventListener('mouseenter', (e) => {
            console.log('🔍 STUDY BADGE HOVERED');
            console.log('Dataset:', item.label);
            console.log('Study count:', item.studyCount);
            console.log('Study names:', item.studyNames);
            console.log('Studies:', item.studies);
          });
        }
        
        // Update item width to include badge
        itemWidth += badgeWidth + 5;
      }
      
      // Add to item group
      itemGroup.appendChild(symbol);
      itemGroup.appendChild(label);
      if (studyBadge) {
        itemGroup.appendChild(studyBadge);
      }
      
      // Add main item interactivity
      if (this.options.interactive) {
        itemGroup.style.cursor = 'pointer';
        itemGroup.addEventListener('click', (e) => {
          // Skip if clicking on study badge
          if (e.target.closest('.visioncharts-legend-study-badge')) return;
          
          item.visible = !item.visible;
          itemGroup.setAttribute('opacity', item.visible ? 1 : 0.5);
          
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
      
      if (this.options.orientation === 'horizontal') {
        currentX += itemWidth + this.options.itemMargin;
      } else {
        currentY += this.options.symbolSize + this.options.itemMargin;
      }
      
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
    
    // Check if we need wrapping
    const maxWidthPerRow = width * 0.9;
    const needsWrapping = totalWidth > maxWidthPerRow;
    
    if (needsWrapping && this.options.wrapText) {
      // Multi-row layout
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
      // Single row layout
      itemElements.forEach(itemData => {
        this.element.appendChild(itemData.element);
      });
    }
    
    // Add background first
    this.element.insertBefore(background, this.element.firstChild);
    
    // Position legend
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
    
    // Center horizontally for top and bottom positions
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
   * ENHANCED: Better study tooltip implementation
   */
  showStudyTooltip(event, studyNames) {
    console.log('Showing study tooltip:', studyNames);
    
    // Remove existing tooltip
    this.hideStudyTooltip();
    
    // Create tooltip with better styling and positioning
    this.studyTooltip = document.createElement('div');
    this.studyTooltip.className = 'visioncharts-study-tooltip';
    this.studyTooltip.style.cssText = `
      position: fixed;
      background: #2c3e50;
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: Arial, sans-serif;
      pointer-events: none;
      z-index: 10000;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 1px solid #34495e;
    `;
    
    this.studyTooltip.innerHTML = `<strong>📊 Studies:</strong> ${studyNames}`;
    
    // Position tooltip relative to mouse
    const updatePosition = (e) => {
      this.studyTooltip.style.left = (e.clientX + 10) + 'px';
      this.studyTooltip.style.top = (e.clientY - 35) + 'px';
    };
    
    // Initial position
    updatePosition(event);
    
    // Add to document
    document.body.appendChild(this.studyTooltip);
    
    console.log('Study tooltip created and added to DOM');
  }
  
  /**
   * ENHANCED: Better cleanup for study tooltip
   */
  hideStudyTooltip() {
    if (this.studyTooltip && this.studyTooltip.parentNode) {
      console.log('Hiding study tooltip');
      document.body.removeChild(this.studyTooltip);
      this.studyTooltip = null;
    }
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
    // Clean up tooltips
    this.hideStudyTooltip();
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
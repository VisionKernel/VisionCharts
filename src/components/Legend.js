/**
 * Legend - Enhanced SVG legend implementation
 * 
 * Renders chart legends using SVG for crisp text and vector graphics,
 * independent of whether chart data is rendered via Canvas or WebGL.
 */

export class Legend {
  constructor(config = {}) {
    this.config = {
      // Position: 'top', 'bottom', 'left', 'right'
      position: 'top',
      
      // Layout options
      orientation: 'horizontal', // 'horizontal' or 'vertical'
      align: 'center', // 'left', 'center', 'right' for horizontal; 'top', 'middle', 'bottom' for vertical
      
      // Spacing and sizing
      itemSpacing: 20,
      itemPadding: { top: 8, right: 12, bottom: 8, left: 12 },
      symbolSize: 12,
      symbolSpacing: 8,
      
      // Styling
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      textColor: '#333',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e0e0e0',
      borderWidth: 1,
      borderRadius: 4,
      
      // Interactive features
      interactive: true,
      hoverEffect: true,
      
      // Study badges
      showStudyBadges: true,
      
      ...config
    };
    
    // State
    this.datasets = [];
    this.studies = [];
    this.hiddenDatasets = new Set();
    this.svgGroup = null;
    this.eventListeners = new Map();
    
    // Callbacks
    this.onDatasetToggle = null;
    this.onStudyToggle = null;
  }
  
  /**
   * Update datasets for the legend
   */
  setDatasets(datasets) {
    this.datasets = Array.isArray(datasets) ? datasets : [];
    return this;
  }
  
  /**
   * Update studies for the legend
   */
  setStudies(studies) {
    this.studies = Array.isArray(studies) ? studies : [];
    return this;
  }
  
  /**
   * Set dataset toggle callback
   */
  onDatasetToggled(callback) {
    this.onDatasetToggle = callback;
    return this;
  }
  
  /**
   * Set study toggle callback
   */
  onStudyToggled(callback) {
    this.onStudyToggle = callback;
    return this;
  }
  
  /**
   * Hide a dataset
   */
  hideDataset(datasetId) {
    this.hiddenDatasets.add(datasetId);
    this._updateVisualState();
    return this;
  }
  
  /**
   * Show a dataset
   */
  showDataset(datasetId) {
    this.hiddenDatasets.delete(datasetId);
    this._updateVisualState();
    return this;
  }
  
  /**
   * Toggle dataset visibility
   */
  toggleDataset(datasetId) {
    if (this.hiddenDatasets.has(datasetId)) {
      this.showDataset(datasetId);
    } else {
      this.hideDataset(datasetId);
    }
    
    // Trigger callback
    if (this.onDatasetToggle) {
      this.onDatasetToggle(datasetId, !this.hiddenDatasets.has(datasetId));
    }
    
    return this;
  }
  
  /**
   * Check if dataset is visible
   */
  isDatasetVisible(datasetId) {
    return !this.hiddenDatasets.has(datasetId);
  }
  
  /**
   * Calculate legend dimensions and position
   */
  calculateLayout(chartArea, chartWidth, chartHeight) {
    const items = [...this.datasets, ...this.studies];
    if (items.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let totalWidth = 0;
    let totalHeight = 0;
    let maxItemWidth = 0;
    let maxItemHeight = 0;
    
    // Calculate item dimensions
    items.forEach(item => {
      const text = item.name || item.label || 'Unknown';
      const textWidth = this._estimateTextWidth(text, this.config.fontSize, this.config.fontFamily);
      
      const itemWidth = this.config.symbolSize + this.config.symbolSpacing + textWidth + 
                       this.config.itemPadding.left + this.config.itemPadding.right;
      const itemHeight = Math.max(this.config.symbolSize, this.config.fontSize) + 
                        this.config.itemPadding.top + this.config.itemPadding.bottom;
      
      maxItemWidth = Math.max(maxItemWidth, itemWidth);
      maxItemHeight = Math.max(maxItemHeight, itemHeight);
    });
    
    // Calculate total dimensions based on orientation
    if (this.config.orientation === 'horizontal') {
      totalWidth = items.length > 0 ? 
        (maxItemWidth * items.length) + (this.config.itemSpacing * (items.length - 1)) : 0;
      totalHeight = maxItemHeight;
    } else {
      totalWidth = maxItemWidth;
      totalHeight = items.length > 0 ? 
        (maxItemHeight * items.length) + (this.config.itemSpacing * (items.length - 1)) : 0;
    }
    
    // Calculate position based on legend position
    let x, y;
    
    switch (this.config.position) {
      case 'top':
        x = this._getAlignedX(totalWidth, chartWidth);
        y = 10; // Small margin from top
        break;
      case 'bottom':
        x = this._getAlignedX(totalWidth, chartWidth);
        y = chartHeight - totalHeight - 10; // Small margin from bottom
        break;
      case 'left':
        x = 10; // Small margin from left
        y = this._getAlignedY(totalHeight, chartArea);
        break;
      case 'right':
        x = chartWidth - totalWidth - 10; // Small margin from right
        y = this._getAlignedY(totalHeight, chartArea);
        break;
      default:
        x = this._getAlignedX(totalWidth, chartWidth);
        y = 10;
    }
    
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: totalWidth,
      height: totalHeight,
      itemWidth: maxItemWidth,
      itemHeight: maxItemHeight
    };
  }
  
  /**
   * Get aligned X position
   */
  _getAlignedX(legendWidth, chartWidth) {
    switch (this.config.align) {
      case 'left':
        return 10;
      case 'right':
        return chartWidth - legendWidth - 10;
      case 'center':
      default:
        return (chartWidth - legendWidth) / 2;
    }
  }
  
  /**
   * Get aligned Y position for vertical legends
   */
  _getAlignedY(legendHeight, chartArea) {
    switch (this.config.align) {
      case 'top':
        return chartArea.y;
      case 'bottom':
        return chartArea.y + chartArea.height - legendHeight;
      case 'middle':
      default:
        return chartArea.y + (chartArea.height - legendHeight) / 2;
    }
  }
  
  /**
   * Estimate text width (simple approximation)
   */
  _estimateTextWidth(text, fontSize, fontFamily) {
    // Rough estimation: most characters are about 0.6 * fontSize wide
    return text.length * fontSize * 0.6;
  }
  
  /**
   * Render legend to SVG
   */
  render(svgElement, chartArea, chartWidth, chartHeight) {
    // Remove existing legend
    this._cleanup();
    
    if (this.datasets.length === 0 && this.studies.length === 0) {
      return;
    }
    
    // Calculate layout
    const layout = this.calculateLayout(chartArea, chartWidth, chartHeight);
    
    // Create legend group
    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', 'visioncharts-legend');
    this.svgGroup.setAttribute('transform', `translate(${layout.x}, ${layout.y})`);
    
    // Add background if specified
    if (this.config.backgroundColor && this.config.backgroundColor !== 'transparent') {
      this._renderBackground(layout);
    }
    
    // Render items
    let currentX = 0;
    let currentY = 0;
    
    const allItems = [...this.datasets, ...this.studies];
    
    allItems.forEach((item, index) => {
      this._renderLegendItem(item, currentX, currentY, layout, index);
      
      // Update position for next item
      if (this.config.orientation === 'horizontal') {
        currentX += layout.itemWidth + this.config.itemSpacing;
      } else {
        currentY += layout.itemHeight + this.config.itemSpacing;
      }
    });
    
    // Add to SVG
    svgElement.appendChild(this.svgGroup);
    
    console.log('Legend rendered with SVG');
  }
  
  /**
   * Render legend background
   */
  _renderBackground(layout) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', -this.config.itemPadding.left);
    bg.setAttribute('y', -this.config.itemPadding.top);
    bg.setAttribute('width', layout.width + this.config.itemPadding.left + this.config.itemPadding.right);
    bg.setAttribute('height', layout.height + this.config.itemPadding.top + this.config.itemPadding.bottom);
    bg.setAttribute('fill', this.config.backgroundColor);
    bg.setAttribute('stroke', this.config.borderColor);
    bg.setAttribute('stroke-width', this.config.borderWidth);
    bg.setAttribute('rx', this.config.borderRadius);
    bg.setAttribute('ry', this.config.borderRadius);
    
    this.svgGroup.appendChild(bg);
  }
  
  /**
   * Render individual legend item
   */
  _renderLegendItem(item, x, y, layout, index) {
    const isDataset = this.datasets.includes(item);
    const isVisible = isDataset ? this.isDatasetVisible(item.id) : true;
    
    // Create item group
    const itemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    itemGroup.setAttribute('class', `visioncharts-legend-item ${isDataset ? 'dataset' : 'study'}`);
    itemGroup.setAttribute('data-id', item.id);
    
    // Add interactivity
    if (this.config.interactive) {
      itemGroup.style.cursor = 'pointer';
      this._addItemEventListeners(itemGroup, item, isDataset);
    }
    
    // Apply visibility styling
    if (!isVisible) {
      itemGroup.style.opacity = '0.5';
    }
    
    // Render symbol (line segment for datasets, special symbols for studies)
    this._renderSymbol(itemGroup, item, 0, y + layout.itemHeight / 2, isDataset);
    
    // Render text
    this._renderText(itemGroup, item, this.config.symbolSize + this.config.symbolSpacing, 
                    y + layout.itemHeight / 2, isVisible);
    
    // Add study badge if applicable
    if (!isDataset && this.config.showStudyBadges) {
      this._renderStudyBadge(itemGroup, item, layout.itemWidth - 20, y + layout.itemHeight / 2);
    }
    
    this.svgGroup.appendChild(itemGroup);
  }
  
  /**
   * Render legend symbol
   */
  _renderSymbol(parent, item, x, y, isDataset) {
    if (isDataset) {
      // Line segment for datasets
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', y);
      line.setAttribute('x2', x + this.config.symbolSize);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', item.color || '#1468a8');
      line.setAttribute('stroke-width', item.width || 2);
      line.setAttribute('stroke-linecap', 'round');
      
      parent.appendChild(line);
    } else {
      // Special symbols for studies (circles, squares, etc.)
      const symbol = this._createStudySymbol(item, x + this.config.symbolSize / 2, y);
      parent.appendChild(symbol);
    }
  }
  
  /**
   * Create study symbol based on study type
   */
  _createStudySymbol(study, cx, cy) {
    const symbolSize = this.config.symbolSize;
    const color = study.color || '#FBBC05';
    
    switch (study.type) {
      case 'sma':
      case 'ema':
        // Dashed line for moving averages
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', cx - symbolSize / 2);
        line.setAttribute('y1', cy);
        line.setAttribute('x2', cx + symbolSize / 2);
        line.setAttribute('y2', cy);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', 2);
        line.setAttribute('stroke-dasharray', '3,2');
        return line;
        
      case 'bollinger':
        // Rectangle for bands
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', cx - symbolSize / 2);
        rect.setAttribute('y', cy - symbolSize / 4);
        rect.setAttribute('width', symbolSize);
        rect.setAttribute('height', symbolSize / 2);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', 1.5);
        return rect;
        
      case 'rsi':
      case 'macd':
        // Circle for oscillators
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', symbolSize / 3);
        circle.setAttribute('fill', color);
        return circle;
        
      default:
        // Default: small square
        const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        square.setAttribute('x', cx - symbolSize / 4);
        square.setAttribute('y', cy - symbolSize / 4);
        square.setAttribute('width', symbolSize / 2);
        square.setAttribute('height', symbolSize / 2);
        square.setAttribute('fill', color);
        return square;
    }
  }
  
  /**
   * Render legend text
   */
  _renderText(parent, item, x, y, isVisible) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', this.config.fontSize);
    text.setAttribute('font-family', this.config.fontFamily);
    text.setAttribute('font-weight', this.config.fontWeight);
    text.setAttribute('fill', isVisible ? this.config.textColor : '#999');
    text.textContent = item.name || item.label || 'Unknown';
    
    parent.appendChild(text);
  }
  
  /**
   * Render study badge
   */
  _renderStudyBadge(parent, study, x, y) {
    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    badge.setAttribute('cx', x);
    badge.setAttribute('cy', y);
    badge.setAttribute('r', 6);
    badge.setAttribute('fill', '#666');
    badge.setAttribute('class', 'study-badge');
    
    const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badgeText.setAttribute('x', x);
    badgeText.setAttribute('y', y);
    badgeText.setAttribute('dominant-baseline', 'central');
    badgeText.setAttribute('text-anchor', 'middle');
    badgeText.setAttribute('font-size', '8');
    badgeText.setAttribute('font-weight', 'bold');
    badgeText.setAttribute('fill', 'white');
    badgeText.textContent = 'S';
    
    parent.appendChild(badge);
    parent.appendChild(badgeText);
  }
  
  /**
   * Add event listeners to legend items
   */
  _addItemEventListeners(itemGroup, item, isDataset) {
    const clickHandler = () => {
      if (isDataset) {
        this.toggleDataset(item.id);
      } else if (this.onStudyToggle) {
        this.onStudyToggle(item.id, item);
      }
    };
    
    const hoverInHandler = () => {
      if (this.config.hoverEffect) {
        itemGroup.style.opacity = '0.8';
      }
    };
    
    const hoverOutHandler = () => {
      if (this.config.hoverEffect) {
        const isVisible = isDataset ? this.isDatasetVisible(item.id) : true;
        itemGroup.style.opacity = isVisible ? '1' : '0.5';
      }
    };
    
    itemGroup.addEventListener('click', clickHandler);
    itemGroup.addEventListener('mouseenter', hoverInHandler);
    itemGroup.addEventListener('mouseleave', hoverOutHandler);
    
    // Store for cleanup
    this.eventListeners.set(itemGroup, { clickHandler, hoverInHandler, hoverOutHandler });
  }
  
  /**
   * Update visual state of legend items
   */
  _updateVisualState() {
    if (!this.svgGroup) return;
    
    const items = this.svgGroup.querySelectorAll('.visioncharts-legend-item.dataset');
    items.forEach(item => {
      const datasetId = item.getAttribute('data-id');
      const isVisible = this.isDatasetVisible(datasetId);
      item.style.opacity = isVisible ? '1' : '0.5';
      
      // Update text color
      const text = item.querySelector('text');
      if (text) {
        text.setAttribute('fill', isVisible ? this.config.textColor : '#999');
      }
    });
  }
  
  /**
   * Update legend configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this;
  }
  
  /**
   * Show/hide legend
   */
  setVisible(visible) {
    if (this.svgGroup) {
      this.svgGroup.style.display = visible ? 'block' : 'none';
    }
    return this;
  }
  
  /**
   * Clean up event listeners and DOM elements
   */
  _cleanup() {
    if (this.svgGroup) {
      // Remove event listeners
      this.eventListeners.forEach((listeners, element) => {
        element.removeEventListener('click', listeners.clickHandler);
        element.removeEventListener('mouseenter', listeners.hoverInHandler);
        element.removeEventListener('mouseleave', listeners.hoverOutHandler);
      });
      this.eventListeners.clear();
      
      // Remove from DOM
      this.svgGroup.remove();
      this.svgGroup = null;
    }
  }
  
  /**
   * Destroy legend and clean up
   */
  destroy() {
    this._cleanup();
    this.datasets = [];
    this.studies = [];
    this.hiddenDatasets.clear();
  }
}
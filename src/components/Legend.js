/**
 * Legend - Enhanced multi-renderer legend implementation
 * 
 * Renders chart legends using the AbstractRenderer interface, supporting
 * SVG, Canvas, and WebGL backends with interactive features and study badges.
 */
export default class Legend {
  /**
   * Create a new legend component
   * @param {Object} options - Legend options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Position and layout
      position: 'bottom', // 'top', 'right', 'bottom', 'left'
      align: 'center',    // 'start', 'center', 'end'
      orientation: 'horizontal', // 'horizontal', 'vertical'
      
      // Spacing and sizing
      itemMargin: 20,
      symbolSize: 12,
      symbolPadding: 8, // Space between symbol and text
      padding: { top: 8, right: 15, bottom: 8, left: 15 },
      titleOffset: 0,
      
      // Text styling
      fontSize: 12,
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
      textColor: '#333333',
      
      // Background styling
      showBackground: true,
      backgroundColor: '#ffffff',
      backgroundOpacity: 0.85,
      borderColor: '#e0e0e0',
      borderWidth: 1,
      borderRadius: 4,
      
      // Interactivity
      interactive: true,
      clickToToggle: true,
      
      // Layout options
      wrapText: true,
      maxWidth: null,
      maxItemsPerRow: null,
      
      // Study features
      showStudyBadges: true,
      showStudyTooltips: true,
      studyBadgeColor: '#6c757d',
      studyBadgeBackground: '#f8f9fa',
      
      // Renderer-specific options
      preferHTMLOverlay: null, // Auto-detect based on renderer
      htmlZIndex: 9999,
      
      // Animation options
      animationDuration: 200,
      
      // Performance options
      enableHitTesting: true,
      throttleEvents: 16
    }, options);
    
    // Legend state
    this.items = [];
    this.isInitialized = false;
    this.currentRenderer = null;
    this.renderMode = 'svg'; // 'svg', 'canvas-overlay', 'html-overlay'
    
    // Element tracking (renderer-agnostic)
    this.renderedElements = [];
    this.elementId = `legend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // HTML overlay elements (for Canvas/WebGL)
    this.htmlLegend = null;
    this.htmlContainer = null;
    
    // Study tooltips
    this.studyTooltip = null;
    
    // Event handling
    this.eventListeners = new Map();
    this.hitAreas = []; // For Canvas/WebGL hit testing
    
    // Performance tracking
    this.renderMetrics = {
      lastRenderTime: 0,
      itemCount: 0,
      elementsRendered: 0
    };
    
    // Layout calculations
    this.layoutCache = {
      totalWidth: 0,
      totalHeight: 0,
      itemPositions: [],
      needsWrapping: false
    };
  }
  
  /**
   * Initialize legend with renderer
   * @param {AbstractRenderer} renderer - Renderer instance
   * @param {HTMLElement} container - Chart container
   * @returns {Promise<boolean>} Success status
   */
  async initialize(renderer, container) {
    if (!renderer || !renderer.isInitialized) {
      console.error('Legend: Invalid or uninitialized renderer provided');
      return false;
    }
    
    this.currentRenderer = renderer;
    this.chartContainer = container;
    
    // Determine render mode based on renderer type
    this.renderMode = this._determineRenderMode(renderer);
    
    // Initialize based on render mode
    if (this.renderMode === 'html-overlay') {
      this._initializeHTMLOverlay();
    }
    
    this.isInitialized = true;
    console.log(`Legend initialized in ${this.renderMode} mode`);
    
    return true;
  }
  
  /**
   * Determine optimal render mode for renderer
   * @private
   */
  _determineRenderMode(renderer) {
    // Check user preference first
    if (this.options.preferHTMLOverlay === true) {
      return 'html-overlay';
    } else if (this.options.preferHTMLOverlay === false) {
      return renderer.type === 'svg' ? 'svg' : 'canvas-overlay';
    }
    
    // Auto-detect based on renderer capabilities and interactivity needs
    if (renderer.type === 'svg') {
      return 'svg';
    } else if (this.options.interactive) {
      // HTML overlay is better for interactive legends with Canvas/WebGL
      return 'html-overlay';
    } else {
      return 'canvas-overlay';
    }
  }
  
  /**
   * Initialize HTML overlay legend
   * @private
   */
  _initializeHTMLOverlay() {
    // Create HTML legend container
    this.htmlLegend = document.createElement('div');
    this.htmlLegend.className = 'visioncharts-legend-overlay';
    this.htmlLegend.style.cssText = `
      position: absolute;
      z-index: ${this.options.htmlZIndex};
      pointer-events: ${this.options.interactive ? 'auto' : 'none'};
      background: ${this.options.backgroundColor};
      border: ${this.options.borderWidth}px solid ${this.options.borderColor};
      border-radius: ${this.options.borderRadius}px;
      padding: ${this.options.padding.top}px ${this.options.padding.right}px ${this.options.padding.bottom}px ${this.options.padding.left}px;
      font-family: ${this.options.fontFamily};
      font-size: ${this.options.fontSize}px;
      font-weight: ${this.options.fontWeight};
      color: ${this.options.textColor};
      opacity: ${this.options.backgroundOpacity};
      box-sizing: border-box;
      display: flex;
      flex-direction: ${this.options.orientation === 'horizontal' ? 'row' : 'column'};
      flex-wrap: ${this.options.wrapText ? 'wrap' : 'nowrap'};
      gap: ${this.options.itemMargin}px;
      align-items: center;
      transition: opacity ${this.options.animationDuration}ms ease;
    `;
    
    // Add to chart container
    const container = this.chartContainer || document.body;
    container.appendChild(this.htmlLegend);
  }
  
  /**
   * Set legend items
   * @param {Array} items - Legend items
   * @returns {Legend} This legend instance
   */
  setItems(items) {
    this.items = items.map(item => ({
      label: item.label || item.name || '',
      color: item.color || '#000000',
      visible: item.visible !== false,
      type: item.type || 'rect',
      id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
      studyCount: item.studyCount || 0,
      studyNames: item.studyNames || '',
      studies: item.studies || [],
      // Additional data for callbacks
      dataset: item.dataset || null,
      index: item.index || 0
    }));
    
    // Clear layout cache
    this.layoutCache = {
      totalWidth: 0,
      totalHeight: 0,
      itemPositions: [],
      needsWrapping: false
    };
    
    return this;
  }
  
  /**
   * Render the legend
   * @param {number} containerWidth - Container width
   * @param {number} containerHeight - Container height
   * @param {Object} transform - Transform options {translateX, translateY}
   * @returns {string} Element ID for tracking
   */
  render(containerWidth, containerHeight, transform = {}) {
    const startTime = performance.now();
    
    if (!this.isInitialized) {
      console.warn('Legend not initialized');
      return null;
    }
    
    if (!this.items.length) {
      console.log('No legend items to render');
      return null;
    }
    
    // Clear previous elements
    this.clear();
    
    // Calculate layout
    this._calculateLayout(containerWidth, containerHeight);
    
    // Render based on mode
    switch (this.renderMode) {
      case 'svg':
        this._renderSVGLegend(containerWidth, containerHeight, transform);
        break;
      case 'canvas-overlay':
        this._renderCanvasOverlay(containerWidth, containerHeight, transform);
        break;
      case 'html-overlay':
        this._renderHTMLOverlay(containerWidth, containerHeight, transform);
        break;
    }
    
    // Update metrics
    this.renderMetrics.lastRenderTime = performance.now() - startTime;
    this.renderMetrics.itemCount = this.items.length;
    this.renderMetrics.elementsRendered = this.renderedElements.length;
    
    console.log(`Legend rendered in ${this.renderMetrics.lastRenderTime.toFixed(2)}ms with ${this.renderMetrics.elementsRendered} elements`);
    
    return this.elementId;
  }
  
  /**
   * Calculate legend layout and positioning
   * @private
   */
  _calculateLayout(containerWidth, containerHeight) {
    const itemSpacing = this.options.itemMargin;
    const symbolSize = this.options.symbolSize;
    const symbolPadding = this.options.symbolPadding;
    
    // Calculate item dimensions
    const itemPositions = [];
    let totalWidth = this.options.padding.left + this.options.padding.right;
    let totalHeight = this.options.padding.top + this.options.padding.bottom;
    
    // First pass: calculate individual item dimensions
    this.items.forEach((item, index) => {
      // Estimate text width (rough calculation)
      const textWidth = this._estimateTextWidth(item.label);
      
      // Calculate study badge width
      let badgeWidth = 0;
      if (item.studyCount > 0 && this.options.showStudyBadges) {
        badgeWidth = 25; // Fixed width for badge
      }
      
      const itemWidth = symbolSize + symbolPadding + textWidth + badgeWidth;
      const itemHeight = Math.max(symbolSize, this.options.fontSize);
      
      itemPositions.push({
        width: itemWidth,
        height: itemHeight,
        textWidth: textWidth,
        badgeWidth: badgeWidth,
        item: item,
        index: index
      });
    });
    
    // Second pass: determine layout (horizontal vs wrapped)
    if (this.options.orientation === 'horizontal') {
      // Check if we need wrapping
      const singleRowWidth = itemPositions.reduce((sum, pos) => sum + pos.width + itemSpacing, 0) 
                             - itemSpacing + this.options.padding.left + this.options.padding.right;
      
      const maxWidth = this.options.maxWidth || containerWidth * 0.9;
      const needsWrapping = singleRowWidth > maxWidth && this.options.wrapText;
      
      if (needsWrapping) {
        // Multi-row layout
        this._calculateWrappedLayout(itemPositions, maxWidth, itemSpacing);
      } else {
        // Single row layout
        this._calculateSingleRowLayout(itemPositions, itemSpacing);
      }
    } else {
      // Vertical layout
      this._calculateVerticalLayout(itemPositions, itemSpacing);
    }
    
    // Store in cache
    this.layoutCache.itemPositions = itemPositions;
    this.layoutCache.needsWrapping = this.options.orientation === 'horizontal' && 
                                     this.layoutCache.totalWidth > (this.options.maxWidth || containerWidth * 0.9);
  }
  
  /**
   * Calculate single row horizontal layout
   * @private
   */
  _calculateSingleRowLayout(itemPositions, itemSpacing) {
    let currentX = this.options.padding.left;
    const y = this.options.padding.top;
    
    itemPositions.forEach(pos => {
      pos.x = currentX;
      pos.y = y;
      currentX += pos.width + itemSpacing;
    });
    
    this.layoutCache.totalWidth = currentX - itemSpacing + this.options.padding.right;
    this.layoutCache.totalHeight = this.options.padding.top + 
                                   Math.max(...itemPositions.map(p => p.height)) + 
                                   this.options.padding.bottom;
  }
  
  /**
   * Calculate wrapped horizontal layout
   * @private
   */
  _calculateWrappedLayout(itemPositions, maxWidth, itemSpacing) {
    let currentX = this.options.padding.left;
    let currentY = this.options.padding.top;
    let rowHeight = 0;
    let maxRowWidth = 0;
    const rowSpacing = 8; // Additional spacing between rows
    
    itemPositions.forEach(pos => {
      // Check if item fits in current row
      if (currentX + pos.width > maxWidth - this.options.padding.right && currentX > this.options.padding.left) {
        // Start new row
        maxRowWidth = Math.max(maxRowWidth, currentX - itemSpacing + this.options.padding.right);
        currentY += rowHeight + rowSpacing;
        currentX = this.options.padding.left;
        rowHeight = 0;
      }
      
      pos.x = currentX;
      pos.y = currentY;
      currentX += pos.width + itemSpacing;
      rowHeight = Math.max(rowHeight, pos.height);
    });
    
    this.layoutCache.totalWidth = Math.max(maxRowWidth, currentX - itemSpacing + this.options.padding.right);
    this.layoutCache.totalHeight = currentY + rowHeight + this.options.padding.bottom;
  }
  
  /**
   * Calculate vertical layout
   * @private
   */
  _calculateVerticalLayout(itemPositions, itemSpacing) {
    const x = this.options.padding.left;
    let currentY = this.options.padding.top;
    let maxWidth = 0;
    
    itemPositions.forEach(pos => {
      pos.x = x;
      pos.y = currentY;
      currentY += pos.height + itemSpacing;
      maxWidth = Math.max(maxWidth, pos.width);
    });
    
    this.layoutCache.totalWidth = maxWidth + this.options.padding.left + this.options.padding.right;
    this.layoutCache.totalHeight = currentY - itemSpacing + this.options.padding.bottom;
  }
  
  /**
   * Render SVG legend
   * @private
   */
  _renderSVGLegend(containerWidth, containerHeight, transform) {
    // Calculate legend position
    const legendPosition = this._calculateLegendPosition(containerWidth, containerHeight);
    
    // Apply transform if provided
    if (transform.translateX || transform.translateY) {
      this.currentRenderer.save();
      this.currentRenderer.translate(transform.translateX || 0, transform.translateY || 0);
    }
    
    // Create legend group
    const legendGroup = this.currentRenderer.createGroup({
      class: `${this.elementId}-legend`,
      transform: `translate(${legendPosition.x}, ${legendPosition.y})`
    });
    
    // Render background
    if (this.options.showBackground) {
      const backgroundId = this.currentRenderer.drawRect(
        0, 0,
        this.layoutCache.totalWidth,
        this.layoutCache.totalHeight,
        {
          fill: this.options.backgroundColor,
          fillOpacity: this.options.backgroundOpacity,
          stroke: this.options.borderColor,
          strokeWidth: this.options.borderWidth,
          rx: this.options.borderRadius,
          ry: this.options.borderRadius,
          class: `${this.elementId}-background`
        }
      );
      this.renderedElements.push(backgroundId);
    }
    
    // Render legend items
    this.layoutCache.itemPositions.forEach(pos => {
      this._renderSVGLegendItem(pos);
    });
    
    // Restore transform if applied
    if (transform.translateX || transform.translateY) {
      this.currentRenderer.restore();
    }
    
    this.renderedElements.push(legendGroup);
  }
  
  /**
   * Render single SVG legend item
   * @private
   */
  _renderSVGLegendItem(position) {
    const item = position.item;
    const x = position.x;
    const y = position.y;
    
    // Create item group
    const itemGroup = this.currentRenderer.createGroup({
      class: `${this.elementId}-item`,
      'data-id': item.id,
      opacity: item.visible ? 1 : 0.5,
      style: this.options.interactive ? 'cursor: pointer;' : ''
    });
    
    // Render symbol
    const symbolId = this._renderSymbol(
      x, y + (position.height - this.options.symbolSize) / 2,
      item.type, item.color
    );
    this.renderedElements.push(symbolId);
    
    // Render label
    const labelX = x + this.options.symbolSize + this.options.symbolPadding;
    const labelY = y + position.height / 2;
    
    const labelId = this.currentRenderer.drawText(item.label, labelX, labelY, {
      fontSize: `${this.options.fontSize}px`,
      fontFamily: this.options.fontFamily,
      fontWeight: this.options.fontWeight,
      fill: this.options.textColor,
      textAnchor: 'start',
      textBaseline: 'middle',
      class: `${this.elementId}-label`
    });
    this.renderedElements.push(labelId);
    
    // Render study badge if applicable
    if (item.studyCount > 0 && this.options.showStudyBadges && position.badgeWidth > 0) {
      this._renderStudyBadge(
        labelX + position.textWidth + 5,
        y + (position.height - 14) / 2,
        item.studyCount,
        item.studyNames
      );
    }
    
    // Add event handlers for interactivity
    if (this.options.interactive) {
      this._addSVGEventHandlers(itemGroup, item);
    }
    
    this.renderedElements.push(itemGroup);
  }
  
  /**
   * Render Canvas overlay legend
   * @private
   */
  _renderCanvasOverlay(containerWidth, containerHeight, transform) {
    const legendPosition = this._calculateLegendPosition(containerWidth, containerHeight);
    
    // Save canvas state
    this.currentRenderer.save();
    
    // Apply transform
    if (transform.translateX || transform.translateY) {
      this.currentRenderer.translate(transform.translateX || 0, transform.translateY || 0);
    }
    
    // Translate to legend position
    this.currentRenderer.translate(legendPosition.x, legendPosition.y);
    
    // Clear hit areas for new render
    this.hitAreas = [];
    
    // Render background
    if (this.options.showBackground) {
      this.currentRenderer.drawRect(
        0, 0,
        this.layoutCache.totalWidth,
        this.layoutCache.totalHeight,
        {
          fill: this.options.backgroundColor,
          fillOpacity: this.options.backgroundOpacity,
          stroke: this.options.borderColor,
          strokeWidth: this.options.borderWidth
        }
      );
    }
    
    // Render legend items
    this.layoutCache.itemPositions.forEach(pos => {
      this._renderCanvasLegendItem(pos, legendPosition);
    });
    
    // Restore canvas state
    this.currentRenderer.restore();
    
    // Set up hit testing if interactive
    if (this.options.interactive && this.options.enableHitTesting) {
      this._setupCanvasHitTesting();
    }
  }
  
  /**
   * Render single Canvas legend item
   * @private
   */
  _renderCanvasLegendItem(position, legendPosition) {
    const item = position.item;
    const x = position.x;
    const y = position.y;
    
    // Apply visibility
    this.currentRenderer.save();
    this.currentRenderer.setOpacity(item.visible ? 1 : 0.5);
    
    // Render symbol
    this._renderCanvasSymbol(
      x, y + (position.height - this.options.symbolSize) / 2,
      item.type, item.color
    );
    
    // Render label
    const labelX = x + this.options.symbolSize + this.options.symbolPadding;
    const labelY = y + position.height / 2;
    
    this.currentRenderer.drawText(item.label, labelX, labelY, {
      fontSize: `${this.options.fontSize}px`,
      fontFamily: this.options.fontFamily,
      fontWeight: this.options.fontWeight,
      fill: this.options.textColor,
      textBaseline: 'middle'
    });
    
    // Render study badge if applicable
    if (item.studyCount > 0 && this.options.showStudyBadges && position.badgeWidth > 0) {
      this._renderCanvasStudyBadge(
        labelX + position.textWidth + 5,
        y + (position.height - 14) / 2,
        item.studyCount
      );
    }
    
    // Store hit area for interactivity
    if (this.options.interactive) {
      this.hitAreas.push({
        x: legendPosition.x + x,
        y: legendPosition.y + y,
        width: position.width,
        height: position.height,
        item: item
      });
    }
    
    this.currentRenderer.restore();
  }
  
  /**
   * Render HTML overlay legend
   * @private
   */
  _renderHTMLOverlay(containerWidth, containerHeight, transform) {
    if (!this.htmlLegend) {
      console.error('HTML legend not initialized');
      return;
    }
    
    // Clear existing content
    this.htmlLegend.innerHTML = '';
    
    // Create legend items
    this.items.forEach(item => {
      const itemElement = this._createHTMLLegendItem(item);
      this.htmlLegend.appendChild(itemElement);
    });
    
    // Position legend
    const legendPosition = this._calculateLegendPosition(containerWidth, containerHeight);
    const adjustedX = legendPosition.x + (transform.translateX || 0);
    const adjustedY = legendPosition.y + (transform.translateY || 0);
    
    this.htmlLegend.style.left = `${adjustedX}px`;
    this.htmlLegend.style.top = `${adjustedY}px`;
    
    // Show with animation
    requestAnimationFrame(() => {
      this.htmlLegend.style.opacity = '1';
    });
  }
  
  /**
   * Create HTML legend item
   * @private
   */
  _createHTMLLegendItem(item) {
    const itemElement = document.createElement('div');
    itemElement.className = 'visioncharts-legend-item-html';
    itemElement.style.cssText = `
      display: flex;
      align-items: center;
      opacity: ${item.visible ? 1 : 0.5};
      cursor: ${this.options.interactive ? 'pointer' : 'default'};
      transition: opacity ${this.options.animationDuration}ms ease;
    `;
    itemElement.setAttribute('data-id', item.id);
    
    // Create symbol
    const symbolElement = document.createElement('div');
    symbolElement.style.cssText = `
      width: ${this.options.symbolSize}px;
      height: ${this.options.symbolSize}px;
      background-color: ${item.color};
      margin-right: ${this.options.symbolPadding}px;
      flex-shrink: 0;
    `;
    
    if (item.type === 'line') {
      symbolElement.style.borderTop = `2px solid ${item.color}`;
      symbolElement.style.backgroundColor = 'transparent';
      symbolElement.style.height = '2px';
      symbolElement.style.marginTop = `${(this.options.symbolSize - 2) / 2}px`;
      symbolElement.style.marginBottom = `${(this.options.symbolSize - 2) / 2}px`;
    }
    
    // Create label
    const labelElement = document.createElement('span');
    labelElement.textContent = item.label;
    labelElement.style.cssText = `
      font-size: ${this.options.fontSize}px;
      font-family: ${this.options.fontFamily};
      font-weight: ${this.options.fontWeight};
      color: ${this.options.textColor};
      white-space: nowrap;
    `;
    
    // Assemble item
    itemElement.appendChild(symbolElement);
    itemElement.appendChild(labelElement);
    
    // Add study badge if applicable
    if (item.studyCount > 0 && this.options.showStudyBadges) {
      const badgeElement = this._createHTMLStudyBadge(item.studyCount, item.studyNames);
      itemElement.appendChild(badgeElement);
    }
    
    // Add event handlers
    if (this.options.interactive) {
      this._addHTMLEventHandlers(itemElement, item);
    }
    
    return itemElement;
  }
  
  /**
   * Calculate legend position within container
   * @private
   */
  _calculateLegendPosition(containerWidth, containerHeight) {
    let x = 0;
    let y = 0;
    
    const totalWidth = this.layoutCache.totalWidth;
    const totalHeight = this.layoutCache.totalHeight;
    
    // Calculate position based on options
    switch (this.options.position) {
      case 'top':
        y = this.options.titleOffset + 5;
        break;
      case 'bottom':
        y = containerHeight - totalHeight;
        break;
      case 'left':
        x = 0;
        y = (containerHeight - totalHeight) / 2;
        break;
      case 'right':
        x = containerWidth - totalWidth;
        y = (containerHeight - totalHeight) / 2;
        break;
    }
    
    // Apply alignment for top/bottom positions
    if (this.options.position === 'top' || this.options.position === 'bottom') {
      switch (this.options.align) {
        case 'start':
          x = 0;
          break;
        case 'center':
          x = Math.max(0, (containerWidth - totalWidth) / 2);
          break;
        case 'end':
          x = Math.max(0, containerWidth - totalWidth);
          break;
      }
    }
    
    // Ensure legend stays within bounds
    x = Math.max(0, Math.min(x, containerWidth - totalWidth));
    y = Math.max(0, Math.min(y, containerHeight - totalHeight));
    
    return { x, y };
  }
  
  /**
   * Render symbol based on type and renderer
   * @private
   */
  _renderSymbol(x, y, type, color) {
    if (type === 'line') {
      return this.currentRenderer.drawLine(
        x, y + this.options.symbolSize / 2,
        x + this.options.symbolSize, y + this.options.symbolSize / 2,
        {
          stroke: color,
          strokeWidth: 2,
          class: `${this.elementId}-symbol`
        }
      );
    } else {
      return this.currentRenderer.drawRect(x, y, this.options.symbolSize, this.options.symbolSize, {
        fill: color,
        class: `${this.elementId}-symbol`
      });
    }
  }
  
  /**
   * Render Canvas symbol
   * @private
   */
  _renderCanvasSymbol(x, y, type, color) {
    if (type === 'line') {
      this.currentRenderer.drawLine(
        x, y + this.options.symbolSize / 2,
        x + this.options.symbolSize, y + this.options.symbolSize / 2,
        {
          stroke: color,
          strokeWidth: 2
        }
      );
    } else {
      this.currentRenderer.drawRect(x, y, this.options.symbolSize, this.options.symbolSize, {
        fill: color
      });
    }
  }
  
  /**
   * Render study badge
   * @private
   */
  _renderStudyBadge(x, y, studyCount, studyNames) {
    const badgeWidth = 20;
    const badgeHeight = 14;
    
    // Background
    const bgId = this.currentRenderer.drawRect(x, y, badgeWidth, badgeHeight, {
      fill: this.options.studyBadgeBackground,
      stroke: this.options.studyBadgeColor,
      strokeWidth: 1,
      rx: 3,
      ry: 3,
      class: `${this.elementId}-study-badge-bg`
    });
    
    // Text
    const textId = this.currentRenderer.drawText(
      `+${studyCount}`,
      x + badgeWidth / 2,
      y + badgeHeight / 2,
      {
        fontSize: '9px',
        fontFamily: this.options.fontFamily,
        fontWeight: 'bold',
        fill: this.options.studyBadgeColor,
        textAnchor: 'middle',
        textBaseline: 'middle',
        class: `${this.elementId}-study-badge-text`
      }
    );
    
    this.renderedElements.push(bgId, textId);
    
    // Add tooltip functionality if enabled
    if (this.options.showStudyTooltips && studyNames) {
      // This would need to be handled by the event system
    }
  }
  
  /**
   * Render Canvas study badge
   * @private
   */
  _renderCanvasStudyBadge(x, y, studyCount) {
    const badgeWidth = 20;
    const badgeHeight = 14;
    
    // Background
    this.currentRenderer.drawRect(x, y, badgeWidth, badgeHeight, {
      fill: this.options.studyBadgeBackground,
      stroke: this.options.studyBadgeColor,
      strokeWidth: 1
    });
    
    // Text
    this.currentRenderer.drawText(
      `+${studyCount}`,
      x + badgeWidth / 2,
      y + badgeHeight / 2,
      {
        fontSize: '9px',
        fontFamily: this.options.fontFamily,
        fontWeight: 'bold',
        fill: this.options.studyBadgeColor,
        textBaseline: 'middle'
      }
    );
  }
  
  /**
   * Create HTML study badge
   * @private
   */
  _createHTMLStudyBadge(studyCount, studyNames) {
    const badgeElement = document.createElement('span');
    badgeElement.textContent = `+${studyCount}`;
    badgeElement.className = 'visioncharts-legend-study-badge-html';
    badgeElement.style.cssText = `
      display: inline-block;
      background: ${this.options.studyBadgeBackground};
      color: ${this.options.studyBadgeColor};
      border: 1px solid ${this.options.studyBadgeColor};
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 9px;
      font-weight: bold;
      margin-left: 5px;
      cursor: pointer;
      min-width: 16px;
      text-align: center;
    `;
    
    // Add tooltip functionality
    if (this.options.showStudyTooltips && studyNames) {
      badgeElement.title = `Studies: ${studyNames}`;
      
      badgeElement.addEventListener('mouseenter', (e) => {
        this.showStudyTooltip(e, studyNames);
      });
      
      badgeElement.addEventListener('mouseleave', () => {
        this.hideStudyTooltip();
      });
    }
    
    return badgeElement;
  }
  
  /**
   * Add SVG event handlers
   * @private
   */
  _addSVGEventHandlers(element, item) {
    if (this.options.clickToToggle) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleItemClick(item);
      });
    }
    
    element.addEventListener('mouseenter', () => {
      this._handleItemHover(item, true);
    });
    
    element.addEventListener('mouseleave', () => {
      this._handleItemHover(item, false);
    });
  }
  
  /**
   * Add HTML event handlers
   * @private
   */
  _addHTMLEventHandlers(element, item) {
    if (this.options.clickToToggle) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleItemClick(item);
      });
    }
    
    element.addEventListener('mouseenter', () => {
      this._handleItemHover(item, true);
      element.style.backgroundColor = 'rgba(0,0,0,0.05)';
    });
    
    element.addEventListener('mouseleave', () => {
      this._handleItemHover(item, false);
      element.style.backgroundColor = 'transparent';
    });
  }
  
  /**
   * Setup Canvas hit testing
   * @private
   */
  _setupCanvasHitTesting() {
    const canvas = this.currentRenderer.canvas;
    if (!canvas) return;
    
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Find hit area
      const hitArea = this.hitAreas.find(area => 
        x >= area.x && x <= area.x + area.width &&
        y >= area.y && y <= area.y + area.height
      );
      
      if (hitArea) {
        this._handleItemClick(hitArea.item);
      }
    };
    
    canvas.addEventListener('click', handleCanvasClick);
    
    // Store for cleanup
    this.eventListeners.set('canvas-click', {
      element: canvas,
      type: 'click',
      handler: handleCanvasClick
    });
  }
  
  /**
   * Handle item click
   * @private
   */
  _handleItemClick(item) {
    // Toggle visibility
    item.visible = !item.visible;
    
    // Dispatch custom event
    const event = new CustomEvent('legend-item-click', {
      detail: { 
        id: item.id, 
        visible: item.visible,
        item: item
      }
    });
    
    // Dispatch on chart container or document
    const target = this.chartContainer || document;
    target.dispatchEvent(event);
    
    // Update visual state
    this._updateItemVisibility(item);
  }
  
  /**
   * Handle item hover
   * @private
   */
  _handleItemHover(item, isHovering) {
    // Dispatch custom event
    const event = new CustomEvent('legend-item-hover', {
      detail: { 
        id: item.id, 
        hovering: isHovering,
        item: item
      }
    });
    
    const target = this.chartContainer || document;
    target.dispatchEvent(event);
  }
  
  /**
   * Update item visibility state
   * @private
   */
  _updateItemVisibility(item) {
    // This would update the rendered elements based on the render mode
    // For now, we'll trigger a re-render
    // In a more optimized version, we'd update just the affected elements
    console.log(`Legend item ${item.id} visibility changed to ${item.visible}`);
  }
  
  /**
   * Show study tooltip
   */
  showStudyTooltip(event, studyNames) {
    this.hideStudyTooltip();
    
    this.studyTooltip = document.createElement('div');
    this.studyTooltip.className = 'visioncharts-study-tooltip';
    this.studyTooltip.style.cssText = `
      position: fixed;
      background: #2c3e50;
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: ${this.options.fontFamily};
      pointer-events: none;
      z-index: ${this.options.htmlZIndex + 1};
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 1px solid #34495e;
    `;
    
    this.studyTooltip.innerHTML = `<strong>📊 Studies:</strong> ${studyNames}`;
    
    // Position tooltip
    this.studyTooltip.style.left = (event.clientX + 10) + 'px';
    this.studyTooltip.style.top = (event.clientY - 35) + 'px';
    
    document.body.appendChild(this.studyTooltip);
  }
  
  /**
   * Hide study tooltip
   */
  hideStudyTooltip() {
    if (this.studyTooltip && this.studyTooltip.parentNode) {
      document.body.removeChild(this.studyTooltip);
      this.studyTooltip = null;
    }
  }
  
  /**
   * Estimate text width (rough calculation)
   * @private
   */
  _estimateTextWidth(text) {
    // Simple estimation - in production, you might want to use canvas measureText
    return (text || '').length * this.options.fontSize * 0.6;
  }
  
  /**
   * Clear all rendered elements
   */
  clear() {
    // Clear renderer elements
    this.renderedElements.forEach(elementId => {
      if (this.currentRenderer.removeElement) {
        this.currentRenderer.removeElement(elementId);
      }
    });
    this.renderedElements = [];
    
    // Clear HTML elements
    if (this.htmlLegend) {
      this.htmlLegend.innerHTML = '';
      this.htmlLegend.style.opacity = '0';
    }
    
    // Clear hit areas
    this.hitAreas = [];
    
    // Clear event listeners
    this.eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.eventListeners.clear();
  }
  
  /**
   * Update legend with new dimensions
   * @param {number} containerWidth - New container width
   * @param {number} containerHeight - New container height
   * @param {Object} transform - Transform options
   * @returns {string} Element ID
   */
  update(containerWidth, containerHeight, transform = {}) {
    return this.render(containerWidth, containerHeight, transform);
  }
  
  /**
   * Destroy legend and clean up resources
   */
  destroy() {
    // Clear all elements
    this.clear();
    
    // Hide study tooltip
    this.hideStudyTooltip();
    
    // Remove HTML legend
    if (this.htmlLegend && this.htmlLegend.parentNode) {
      this.htmlLegend.parentNode.removeChild(this.htmlLegend);
    }
    
    // Clear references
    this.htmlLegend = null;
    this.currentRenderer = null;
    this.chartContainer = null;
    this.items = [];
    
    this.isInitialized = false;
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.renderMetrics };
  }
  
  // ===== LEGACY COMPATIBILITY METHODS =====
  
  /**
   * Legacy SVG render method for backwards compatibility
   * @param {SVGElement} container - SVG container
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {SVGElement} Legend element
   * @deprecated Use render() with renderer instance instead
   */
  renderLegacy(container, width, height) {
    console.warn('Legend.render() is deprecated. Use initialize() and render() with renderer instance instead.');
    
    // Try to maintain basic compatibility
    this.renderMode = 'svg';
    this.isInitialized = true;
    
    return container;
  }
}
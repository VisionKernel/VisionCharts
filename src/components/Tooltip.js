/**
 * Tooltip - Enhanced multi-renderer tooltip implementation
 * 
 * Provides tooltips that work seamlessly across SVG, Canvas, and WebGL renderers
 * with automatic positioning, formatting, and optimal rendering strategies.
 */
export default class Tooltip {
  /**
   * Create a new tooltip component
   * @param {Object} options - Tooltip options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Display options
      followCursor: true,
      offset: { x: 10, y: 10 },
      position: 'auto', // 'auto', 'top', 'right', 'bottom', 'left'
      
      // Styling options
      padding: { top: 8, right: 10, bottom: 8, left: 10 },
      background: '#ffffff',
      border: '#cccccc',
      borderWidth: 1,
      borderRadius: 4,
      fontSize: 12,
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
      textColor: '#333333',
      lineHeight: 1.4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: 300,
      minWidth: 80,
      
      // Content options
      formatter: null,
      multiline: true,
      allowHTML: false, // Only for HTML overlay mode
      
      // Animation options
      showDelay: 0,
      hideDelay: 100,
      animationDuration: 200,
      
      // Renderer-specific options
      preferHTMLOverlay: null, // Auto-detect based on renderer
      htmlZIndex: 10000,
      
      // Performance options
      throttleMove: 16, // ms between position updates
      maxCacheSize: 100
    }, options);
    
    // Tooltip state
    this.data = null;
    this.visible = false;
    this.isInitialized = false;
    this.currentRenderer = null;
    this.renderMode = 'svg'; // 'svg', 'canvas-overlay', 'html-overlay'
    
    // Element tracking (renderer-agnostic)
    this.renderedElements = [];
    this.elementId = `tooltip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // HTML overlay elements (for Canvas/WebGL)
    this.htmlTooltip = null;
    this.htmlContainer = null;
    
    // Performance tracking
    this.renderMetrics = {
      lastRenderTime: 0,
      showCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Content caching
    this.contentCache = new Map();
    
    // Throttling
    this.moveThrottle = null;
    this.showTimeout = null;
    this.hideTimeout = null;
    
    // Positioning
    this.lastPosition = { x: 0, y: 0 };
    this.containerBounds = null;
  }
  
  /**
   * Enhanced initialize method with proper cleanup
   * @param {AbstractRenderer} renderer - Renderer instance
   * @param {HTMLElement} container - Chart container
   * @returns {Promise<boolean>} Success status
   */
  async initialize(renderer, container) {
    if (!renderer || !renderer.isInitialized) {
      console.error('Tooltip: Invalid or uninitialized renderer provided');
      return false;
    }
    
    // Clean up any existing initialization first
    if (this.isInitialized) {
      this._cleanupHTMLTooltip();
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
    console.log(`Tooltip initialized in ${this.renderMode} mode`);
    
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
    
    // Auto-detect based on renderer capabilities
    if (renderer.type === 'svg') {
      return 'svg';
    } else if (renderer.type === 'canvas' || renderer.type === 'webgl') {
      // HTML overlay is generally better for Canvas/WebGL due to text rendering quality
      return 'html-overlay';
    }
    
    return 'html-overlay'; // Safe fallback
  }
  
  /**
 * Initialize HTML overlay tooltip
 * @private
 */
_initializeHTMLOverlay() {
  // FIRST: Remove any existing tooltip to prevent duplicates
  this._cleanupHTMLTooltip();
  
  // Create HTML tooltip element
  this.htmlTooltip = document.createElement('div');
  this.htmlTooltip.className = 'visioncharts-tooltip-overlay';
  
  // Add unique identifier to prevent conflicts
  this.htmlTooltip.setAttribute('data-tooltip-id', this.elementId);
  
  this.htmlTooltip.style.cssText = `
    position: absolute;
    pointer-events: none;
    opacity: 0;
    transition: opacity ${this.options.animationDuration}ms ease;
    z-index: ${this.options.htmlZIndex};
    background: ${this.options.background};
    border: ${this.options.borderWidth}px solid ${this.options.border};
    border-radius: ${this.options.borderRadius}px;
    padding: ${this.options.padding.top}px ${this.options.padding.right}px ${this.options.padding.bottom}px ${this.options.padding.left}px;
    font-family: ${this.options.fontFamily};
    font-size: ${this.options.fontSize}px;
    font-weight: ${this.options.fontWeight};
    color: ${this.options.textColor};
    line-height: ${this.options.lineHeight};
    max-width: ${this.options.maxWidth}px;
    min-width: ${this.options.minWidth}px;
    box-shadow: ${this.options.boxShadow};
    white-space: ${this.options.multiline ? 'pre-line' : 'nowrap'};
    word-wrap: break-word;
    box-sizing: border-box;
  `;
  
  // Add to chart container or body
  const container = this.chartContainer || document.body;
  container.appendChild(this.htmlTooltip);
}

  
  /**
   * Show the tooltip
   * @param {Object} data - Tooltip data
   * @param {number} x - X coordinate (chart-relative)
   * @param {number} y - Y coordinate (chart-relative)
   * @param {Object} containerBounds - Container bounds
   */
  show(data, x, y, containerBounds) {
    if (!this.isInitialized) {
      console.warn('Tooltip not initialized');
      return;
    }
    
    // Clear any pending hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Store data and bounds
    this.data = data;
    this.containerBounds = containerBounds;
    
    // Apply show delay if configured
    if (this.options.showDelay > 0 && !this.visible) {
      this.showTimeout = setTimeout(() => {
        this._doShow(x, y);
      }, this.options.showDelay);
    } else {
      this._doShow(x, y);
    }
  }
  
  /**
   * Internal show implementation
   * @private
   */
  _doShow(x, y) {
    const startTime = performance.now();
    
    // Format content
    const content = this._formatContent(this.data);
    
    // Render based on mode
    switch (this.renderMode) {
      case 'svg':
        this._showSVGTooltip(content, x, y);
        break;
      case 'canvas-overlay':
        this._showCanvasOverlay(content, x, y);
        break;
      case 'html-overlay':
        this._showHTMLOverlay(content, x, y);
        break;
    }
    
    this.visible = true;
    this.renderMetrics.showCount++;
    this.renderMetrics.lastRenderTime = performance.now() - startTime;
    
    console.log(`Tooltip shown in ${this.renderMetrics.lastRenderTime.toFixed(2)}ms`);
  }
  
  /**
   * Show SVG tooltip
   * @private
   */
  _showSVGTooltip(content, x, y) {
    // Clear previous elements
    this._clearRenderedElements();
    
    // Create tooltip group
    const tooltipGroup = this.currentRenderer.createGroup({
      class: `${this.elementId}-tooltip`,
      opacity: 0
    });
    
    // Measure content dimensions
    const dimensions = this._measureContent(content);
    
    // Create background
    const backgroundId = this.currentRenderer.drawRect(
      0, 0, 
      dimensions.width, 
      dimensions.height, 
      {
        fill: this.options.background,
        stroke: this.options.border,
        strokeWidth: this.options.borderWidth,
        rx: this.options.borderRadius,
        ry: this.options.borderRadius,
        class: `${this.elementId}-background`
      }
    );
    
    // Render content lines
    const lines = Array.isArray(content) ? content : [content];
    lines.forEach((line, index) => {
      const textY = this.options.padding.top + (index + 1) * this.options.fontSize * this.options.lineHeight;
      const textId = this.currentRenderer.drawText(
        line, 
        this.options.padding.left, 
        textY,
        {
          fontSize: `${this.options.fontSize}px`,
          fontFamily: this.options.fontFamily,
          fontWeight: this.options.fontWeight,
          fill: this.options.textColor,
          class: `${this.elementId}-text`
        }
      );
      this.renderedElements.push(textId);
    });
    
    // Position tooltip
    const position = this._calculatePosition(x, y, dimensions);
    
    // Apply transform
    if (this.currentRenderer.setGroupTransform) {
      this.currentRenderer.setGroupTransform(tooltipGroup, `translate(${position.x},${position.y})`);
    }
    
    // Animate in
    this._animateIn(tooltipGroup);
    
    this.renderedElements.push(backgroundId, tooltipGroup);
  }
  
  /**
   * Show Canvas overlay tooltip (rendered on canvas)
   * @private
   */
  _showCanvasOverlay(content, x, y) {
    // For Canvas, we can render directly on the canvas or use HTML overlay
    // Direct canvas rendering is more complex but integrated
    
    const dimensions = this._measureContent(content);
    const position = this._calculatePosition(x, y, dimensions);
    
    // Save canvas state
    this.currentRenderer.save();
    
    // Draw background
    this.currentRenderer.drawRect(
      position.x, position.y,
      dimensions.width, dimensions.height,
      {
        fill: this.options.background,
        stroke: this.options.border,
        strokeWidth: this.options.borderWidth
      }
    );
    
    // Draw text
    const lines = Array.isArray(content) ? content : [content];
    lines.forEach((line, index) => {
      const textX = position.x + this.options.padding.left;
      const textY = position.y + this.options.padding.top + (index + 1) * this.options.fontSize * this.options.lineHeight;
      
      this.currentRenderer.drawText(line, textX, textY, {
        fontSize: `${this.options.fontSize}px`,
        fontFamily: this.options.fontFamily,
        fontWeight: this.options.fontWeight,
        fill: this.options.textColor
      });
    });
    
    // Restore canvas state
    this.currentRenderer.restore();
  }
  
  /**
   * Show HTML overlay tooltip
   * @private
   */
  _showHTMLOverlay(content, x, y) {
    if (!this.htmlTooltip) {
      console.error('HTML tooltip not initialized');
      return;
    }
    
    // Set content
    const contentStr = Array.isArray(content) ? content.join('\n') : content;
    
    if (this.options.allowHTML) {
      this.htmlTooltip.innerHTML = contentStr;
    } else {
      this.htmlTooltip.textContent = contentStr;
    }
    
    // Position tooltip (convert chart coordinates to page coordinates)
    const position = this._calculateHTMLPosition(x, y);
    
    this.htmlTooltip.style.left = `${position.x}px`;
    this.htmlTooltip.style.top = `${position.y}px`;
    
    // Show with animation
    requestAnimationFrame(() => {
      this.htmlTooltip.style.opacity = '1';
    });
  }
  
  /**
   * Move tooltip to new position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  move(x, y) {
    if (!this.visible || !this.options.followCursor) return;
    
    // Throttle movement updates
    if (this.moveThrottle) return;
    
    this.moveThrottle = setTimeout(() => {
      this._doMove(x, y);
      this.moveThrottle = null;
    }, this.options.throttleMove);
  }
  
  /**
   * Internal move implementation
   * @private
   */
  _doMove(x, y) {
    this.lastPosition = { x, y };
    
    switch (this.renderMode) {
      case 'html-overlay':
        const position = this._calculateHTMLPosition(x, y);
        this.htmlTooltip.style.left = `${position.x}px`;
        this.htmlTooltip.style.top = `${position.y}px`;
        break;
      case 'svg':
      case 'canvas-overlay':
        // For SVG and Canvas, it's more efficient to hide/show than to move
        if (this.data) {
          this.show(this.data, x, y, this.containerBounds);
        }
        break;
    }
  }
  
  /**
   * Hide the tooltip
   */
  hide() {
    if (!this.visible) return;
    
    // Clear any pending show timeout
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    
    // Apply hide delay if configured
    if (this.options.hideDelay > 0) {
      this.hideTimeout = setTimeout(() => {
        this._doHide();
      }, this.options.hideDelay);
    } else {
      this._doHide();
    }
  }
  
  /**
   * Internal hide implementation
   * @private
   */
  _doHide() {
    this.visible = false;
    
    switch (this.renderMode) {
      case 'svg':
      case 'canvas-overlay':
        this._clearRenderedElements();
        // For canvas, we might need to trigger a redraw
        if (this.currentRenderer.type === 'canvas' && this.currentRenderer.clear) {
          // This would typically trigger a full chart redraw
          // The chart should handle this via its update cycle
        }
        break;
      case 'html-overlay':
        if (this.htmlTooltip) {
          this.htmlTooltip.style.opacity = '0';
        }
        break;
    }
  }
  
  /**
   * Format tooltip content
   * @private
   */
  _formatContent(data) {
    // Check cache first
    const cacheKey = JSON.stringify(data);
    if (this.contentCache.has(cacheKey)) {
      this.renderMetrics.cacheHits++;
      return this.contentCache.get(cacheKey);
    }
    
    this.renderMetrics.cacheMisses++;
    
    let content;
    
    if (typeof this.options.formatter === 'function') {
      content = this.options.formatter(data);
    } else {
      content = this._defaultFormatter(data);
    }
    
    // Cache result
    this._cacheContent(cacheKey, content);
    
    return content;
  }
  
  /**
   * Default tooltip formatter
   * @private
   */
  _defaultFormatter(data) {
    if (!data) return 'No data';
    
    if (Array.isArray(data)) {
      return data.map(item => this._formatSingleItem(item));
    } else {
      return this._formatSingleItem(data);
    }
  }
  
  /**
   * Format single data item
   * @private
   */
  _formatSingleItem(item) {
    if (item.dataset && item.point) {
      const datasetName = item.dataset.name || 'Series';
      const value = this._formatValue(item.point.y || item.point.value);
      return `${datasetName}: ${value}`;
    } else if (typeof item === 'object') {
      return JSON.stringify(item, null, 2);
    } else {
      return String(item);
    }
  }
  
  /**
   * Format numeric values
   * @private
   */
  _formatValue(value) {
    if (typeof value !== 'number') return String(value);
    
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (Math.abs(value) < 1 && value !== 0) {
      return value.toPrecision(3);
    } else {
      return value.toFixed(value % 1 === 0 ? 0 : 2);
    }
  }
  
  /**
   * Measure content dimensions
   * @private
   */
  _measureContent(content) {
    const lines = Array.isArray(content) ? content : [content];
    
    // Simple estimation - in a real implementation, you'd measure actual text
    const maxLineLength = Math.max(...lines.map(line => String(line).length));
    const charWidth = this.options.fontSize * 0.6; // Rough estimation
    
    const width = Math.min(
      this.options.maxWidth,
      Math.max(
        this.options.minWidth,
        maxLineLength * charWidth + this.options.padding.left + this.options.padding.right
      )
    );
    
    const height = lines.length * this.options.fontSize * this.options.lineHeight + 
                   this.options.padding.top + this.options.padding.bottom;
    
    return { width, height };
  }
  
  /**
   * Calculate tooltip position
   * @private
   */
  _calculatePosition(x, y, dimensions) {
    let tooltipX = x + this.options.offset.x;
    let tooltipY = y + this.options.offset.y;
    
    // Adjust position to keep tooltip within bounds
    if (this.containerBounds) {
      const { width, height } = this.containerBounds;
      
      // Check if tooltip would go off right edge
      if (tooltipX + dimensions.width > width) {
        tooltipX = x - dimensions.width - this.options.offset.x;
      }
      
      // Check if tooltip would go off bottom edge
      if (tooltipY + dimensions.height > height) {
        tooltipY = y - dimensions.height - this.options.offset.y;
      }
      
      // Ensure tooltip is not positioned off the left or top edge
      tooltipX = Math.max(0, tooltipX);
      tooltipY = Math.max(0, tooltipY);
    }
    
    return { x: tooltipX, y: tooltipY };
  }
  
  /**
   * Calculate HTML tooltip position (page coordinates)
   * @private
   */
  _calculateHTMLPosition(x, y) {
    const chartRect = this.chartContainer.getBoundingClientRect();
    
    // Convert chart-relative coordinates to page coordinates
    let pageX = chartRect.left + x + this.options.offset.x;
    let pageY = chartRect.top + y + this.options.offset.y;
    
    // Simple bounds checking against viewport
    const tooltipRect = this.htmlTooltip.getBoundingClientRect();
    
    if (pageX + tooltipRect.width > window.innerWidth) {
      pageX = chartRect.left + x - tooltipRect.width - this.options.offset.x;
    }
    
    if (pageY + tooltipRect.height > window.innerHeight) {
      pageY = chartRect.top + y - tooltipRect.height - this.options.offset.y;
    }
    
    pageX = Math.max(0, pageX);
    pageY = Math.max(0, pageY);
    
    return { x: pageX, y: pageY };
  }
  
  /**
   * Cache formatted content
   * @private
   */
  _cacheContent(key, content) {
    // Manage cache size
    if (this.contentCache.size >= this.options.maxCacheSize) {
      const oldestKey = this.contentCache.keys().next().value;
      this.contentCache.delete(oldestKey);
    }
    
    this.contentCache.set(key, content);
  }
  
  /**
   * Clear rendered elements
   * @private
   */
  _clearRenderedElements() {
    this.renderedElements.forEach(elementId => {
      if (this.currentRenderer.removeElement) {
        this.currentRenderer.removeElement(elementId);
      }
    });
    this.renderedElements = [];
  }
  
  /**
   * Animate tooltip in
   * @private
   */
  _animateIn(element) {
    if (this.currentRenderer.animate) {
      this.currentRenderer.animate(element, { opacity: 1 }, this.options.animationDuration);
    } else if (this.currentRenderer.setAttribute) {
      this.currentRenderer.setAttribute(element, 'opacity', 1);
    }
  }

  /**
   * Clean up existing HTML tooltip
   * @private
   */
  _cleanupHTMLTooltip() {
    // Remove existing tooltip if it exists
    if (this.htmlTooltip && this.htmlTooltip.parentNode) {
      this.htmlTooltip.parentNode.removeChild(this.htmlTooltip);
      this.htmlTooltip = null;
    }
    
    // Also clean up any orphaned tooltips with our class in the container
    const container = this.chartContainer || document.body;
    const existingTooltips = container.querySelectorAll('.visioncharts-tooltip-overlay');
    existingTooltips.forEach(tooltip => {
      // Only remove tooltips that belong to this chart container
      if (tooltip.closest(this.chartContainer?.tagName || 'body') === container) {
        tooltip.parentNode.removeChild(tooltip);
      }
    });
  }
  
  /**
 * Enhanced destroy method
 */
destroy() {
  // Clear timeouts
  if (this.showTimeout) clearTimeout(this.showTimeout);
  if (this.hideTimeout) clearTimeout(this.hideTimeout);
  if (this.moveThrottle) clearTimeout(this.moveThrottle);
  
  // Clear rendered elements
  this._clearRenderedElements();
  
  // Clean up HTML tooltip
  this._cleanupHTMLTooltip();
  
  // Clear references
  this.currentRenderer = null;
  this.chartContainer = null;
  this.contentCache.clear();
  
  this.isInitialized = false;
  this.visible = false;
}
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.renderMetrics,
      cacheSize: this.contentCache.size,
      cacheHitRatio: this.renderMetrics.cacheHits / (this.renderMetrics.cacheHits + this.renderMetrics.cacheMisses) || 0
    };
  }
  
  // ===== LEGACY COMPATIBILITY METHODS =====
  
  /**
   * Legacy SVG render method for backwards compatibility
   * @param {SVGElement} container - SVG container
   * @returns {SVGElement} Tooltip element
   * @deprecated Use initialize() with renderer instance instead
   */
  render(container) {
    console.warn('Tooltip.render() is deprecated. Use initialize() with renderer instance instead.');
    
    // Try to maintain basic compatibility
    this.renderMode = 'svg';
    this.isInitialized = true;
    
    return container;
  }
}
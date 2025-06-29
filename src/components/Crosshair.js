/**
 * Crosshair - Enhanced multi-renderer crosshair implementation
 * 
 * Provides interactive crosshair functionality across SVG, Canvas, and WebGL renderers
 * with smooth animations, data snapping, and optimal performance strategies.
 */
export default class Crosshair {
  /**
   * Create a new crosshair component
   * @param {Object} options - Crosshair options
   */
  constructor(options = {}) {
    this.options = Object.assign({
      // Display options
      showX: true,
      showY: false, // Typically only vertical line for time series
      
      // Styling options
      stroke: '#666666',
      strokeWidth: 1,
      strokeDasharray: '4,4',
      opacity: 0.8,
      
      // Behavior options
      snapToData: true,
      snapDistance: 20, // pixels
      followCursor: true,
      
      // Animation options
      animationDuration: 150,
      smoothMovement: true,
      
      // Renderer-specific options
      preferHTMLOverlay: null, // Auto-detect based on renderer
      htmlZIndex: 9998,
      useCanvasOverlay: false, // Force canvas overlay for Canvas/WebGL
      
      // Performance options
      throttleUpdates: 16, // ms between position updates
      enableGPUAcceleration: true,
      
      // Snapping options
      snapToNearestPoint: true,
      snapThreshold: 30, // pixels
      
      // Advanced styling
      glowEffect: false,
      glowColor: '#ffffff',
      glowBlur: 3
    }, options);
    
    // Crosshair state
    this.visible = false;
    this.isInitialized = false;
    this.currentRenderer = null;
    this.renderMode = 'svg'; // 'svg', 'canvas-overlay', 'html-overlay'
    
    // Position tracking
    this.currentPosition = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.lastPosition = { x: -1, y: -1 };
    
    // Dimensions
    this.containerBounds = { width: 0, height: 0 };
    
    // Element tracking (renderer-agnostic)
    this.renderedElements = [];
    this.elementId = `crosshair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // HTML overlay elements (for Canvas/WebGL)
    this.htmlCrosshair = null;
    this.htmlContainer = null;
    
    // Canvas overlay (alternative to HTML)
    this.overlayCanvas = null;
    this.overlayContext = null;
    
    // Animation state
    this.animationFrame = null;
    this.isAnimating = false;
    
    // Performance tracking
    this.renderMetrics = {
      lastUpdateTime: 0,
      updateCount: 0,
      averageUpdateTime: 0
    };
    
    // Throttling
    this.updateThrottle = null;
    
    // Data snapping
    this.dataPoints = [];
    this.snappedPoint = null;
  }
  
  /**
   * Initialize crosshair with renderer
   * @param {AbstractRenderer} renderer - Renderer instance
   * @param {HTMLElement} container - Chart container
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @returns {Promise<boolean>} Success status
   */
  async initialize(renderer, container, width, height) {
    if (!renderer || !renderer.isInitialized) {
      console.error('Crosshair: Invalid or uninitialized renderer provided');
      return false;
    }
    
    this.currentRenderer = renderer;
    this.chartContainer = container;
    this.containerBounds = { width, height };
    
    // Determine render mode based on renderer type
    this.renderMode = this._determineRenderMode(renderer);
    
    // Initialize based on render mode
    switch (this.renderMode) {
      case 'html-overlay':
        this._initializeHTMLOverlay();
        break;
      case 'canvas-overlay':
        this._initializeCanvasOverlay();
        break;
      case 'svg':
        // SVG mode initialization happens during render
        break;
    }
    
    this.isInitialized = true;
    console.log(`Crosshair initialized in ${this.renderMode} mode`);
    
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
    } else if (this.options.useCanvasOverlay === true) {
      return 'canvas-overlay';
    } else if (this.options.preferHTMLOverlay === false) {
      return renderer.type === 'svg' ? 'svg' : 'canvas-overlay';
    }
    
    // Auto-detect based on renderer capabilities and performance needs
    if (renderer.type === 'svg') {
      return 'svg';
    } else if (renderer.type === 'canvas' || renderer.type === 'webgl') {
      // HTML overlay is generally better for crosshairs due to:
      // 1. No need to redraw main chart content
      // 2. Better CSS animation support
      // 3. Easier positioning and styling
      return 'html-overlay';
    }
    
    return 'html-overlay'; // Safe fallback
  }
  
  /**
   * Initialize HTML overlay crosshair
   * @private
   */
  _initializeHTMLOverlay() {
    // Create container for crosshair lines
    this.htmlCrosshair = document.createElement('div');
    this.htmlCrosshair.className = 'visioncharts-crosshair-overlay';
    this.htmlCrosshair.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: ${this.options.htmlZIndex};
      opacity: 0;
      transition: opacity ${this.options.animationDuration}ms ease;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    
    // Create X crosshair (vertical line)
    if (this.options.showX) {
      this.htmlXLine = document.createElement('div');
      this.htmlXLine.className = 'visioncharts-crosshair-x-html';
      this.htmlXLine.style.cssText = `
        position: absolute;
        width: ${this.options.strokeWidth}px;
        height: 100%;
        background: ${this.options.stroke};
        opacity: ${this.options.opacity};
        transform: translateX(-50%);
        ${this._getLineDashCSS()}
        ${this.options.glowEffect ? this._getGlowCSS() : ''}
        ${this.options.enableGPUAcceleration ? 'will-change: transform;' : ''}
      `;
      this.htmlCrosshair.appendChild(this.htmlXLine);
    }
    
    // Create Y crosshair (horizontal line)
    if (this.options.showY) {
      this.htmlYLine = document.createElement('div');
      this.htmlYLine.className = 'visioncharts-crosshair-y-html';
      this.htmlYLine.style.cssText = `
        position: absolute;
        width: 100%;
        height: ${this.options.strokeWidth}px;
        background: ${this.options.stroke};
        opacity: ${this.options.opacity};
        transform: translateY(-50%);
        ${this._getLineDashCSS()}
        ${this.options.glowEffect ? this._getGlowCSS() : ''}
        ${this.options.enableGPUAcceleration ? 'will-change: transform;' : ''}
      `;
      this.htmlCrosshair.appendChild(this.htmlYLine);
    }
    
    // Add to chart container
    const container = this.chartContainer || document.body;
    container.appendChild(this.htmlCrosshair);
  }
  
  /**
   * Initialize Canvas overlay crosshair
   * @private
   */
  _initializeCanvasOverlay() {
    // Create overlay canvas
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'visioncharts-crosshair-canvas';
    this.overlayCanvas.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: ${this.options.htmlZIndex};
      top: 0;
      left: 0;
    `;
    
    // Set canvas dimensions
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.overlayCanvas.width = this.containerBounds.width * devicePixelRatio;
    this.overlayCanvas.height = this.containerBounds.height * devicePixelRatio;
    this.overlayCanvas.style.width = `${this.containerBounds.width}px`;
    this.overlayCanvas.style.height = `${this.containerBounds.height}px`;
    
    // Get context
    this.overlayContext = this.overlayCanvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false
    });
    
    if (this.overlayContext) {
      this.overlayContext.scale(devicePixelRatio, devicePixelRatio);
    }
    
    // Add to chart container
    const container = this.chartContainer || document.body;
    container.appendChild(this.overlayCanvas);
  }
  
  /**
   * Get CSS for dashed lines
   * @private
   */
  _getLineDashCSS() {
    if (!this.options.strokeDasharray || this.options.strokeDasharray === 'none') {
      return '';
    }
    
    // Convert SVG dasharray to CSS
    const dashes = this.options.strokeDasharray.split(',').map(d => d.trim() + 'px').join(' ');
    return `
      background-image: repeating-linear-gradient(
        90deg,
        transparent,
        transparent ${dashes.split(' ')[0]},
        ${this.options.stroke} ${dashes.split(' ')[0]},
        ${this.options.stroke} ${dashes.split(' ')[1] || dashes.split(' ')[0]}
      );
      background-size: ${dashes.split(' ').slice(0, 2).join(' ')};
    `;
  }
  
  /**
   * Get CSS for glow effect
   * @private
   */
  _getGlowCSS() {
    return `
      box-shadow: 0 0 ${this.options.glowBlur}px ${this.options.glowColor};
      filter: drop-shadow(0 0 ${this.options.glowBlur}px ${this.options.glowColor});
    `;
  }
  
  /**
   * Set data points for snapping
   * @param {Array} dataPoints - Array of {x, y} coordinate objects
   */
  setDataPoints(dataPoints) {
    this.dataPoints = dataPoints || [];
  }
  
  /**
   * Update crosshair position
   * @param {number} x - X coordinate (chart-relative)
   * @param {number} y - Y coordinate (chart-relative)
   * @param {boolean} smooth - Use smooth animation
   */
  update(x, y, smooth = null) {
    if (!this.isInitialized) {
      console.warn('Crosshair not initialized');
      return;
    }
    
    // Apply snapping if enabled
    const position = this._applySnapping(x, y);
    
    // Store target position
    this.targetPosition = position;
    
    // Apply throttling if configured
    if (this.options.throttleUpdates > 0) {
      if (this.updateThrottle) return;
      
      this.updateThrottle = setTimeout(() => {
        this._doUpdate(smooth);
        this.updateThrottle = null;
      }, this.options.throttleUpdates);
    } else {
      this._doUpdate(smooth);
    }
  }
  
  /**
   * Internal update implementation
   * @private
   */
  _doUpdate(smooth = null) {
    const startTime = performance.now();
    
    const useSmooth = smooth !== null ? smooth : this.options.smoothMovement;
    
    if (useSmooth && this.options.animationDuration > 0) {
      this._animateToPosition(this.targetPosition);
    } else {
      this.currentPosition = { ...this.targetPosition };
      this._renderAtPosition(this.currentPosition);
    }
    
    // Update metrics
    const updateTime = performance.now() - startTime;
    this.renderMetrics.updateCount++;
    this.renderMetrics.lastUpdateTime = updateTime;
    this.renderMetrics.averageUpdateTime = 
      (this.renderMetrics.averageUpdateTime * (this.renderMetrics.updateCount - 1) + updateTime) / 
      this.renderMetrics.updateCount;
  }
  
  /**
   * Apply data snapping to position
   * @private
   */
  _applySnapping(x, y) {
    if (!this.options.snapToData || !this.dataPoints.length) {
      return { x, y };
    }
    
    // Find closest data point
    let minDistance = Infinity;
    let closestPoint = null;
    
    this.dataPoints.forEach(point => {
      const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
      if (distance < minDistance && distance <= this.options.snapThreshold) {
        minDistance = distance;
        closestPoint = point;
      }
    });
    
    if (closestPoint) {
      this.snappedPoint = closestPoint;
      return { x: closestPoint.x, y: closestPoint.y };
    } else {
      this.snappedPoint = null;
      return { x, y };
    }
  }
  
  /**
   * Animate to target position
   * @private
   */
  _animateToPosition(targetPosition) {
    if (this.isAnimating) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.isAnimating = true;
    const startPosition = { ...this.currentPosition };
    const startTime = performance.now();
    const duration = this.options.animationDuration;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function
      const easedProgress = this._easeOutCubic(progress);
      
      // Interpolate position
      this.currentPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * easedProgress,
        y: startPosition.y + (targetPosition.y - startPosition.y) * easedProgress
      };
      
      this._renderAtPosition(this.currentPosition);
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Easing function for smooth animations
   * @private
   */
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  /**
   * Render crosshair at specific position
   * @private
   */
  _renderAtPosition(position) {
    switch (this.renderMode) {
      case 'svg':
        this._renderSVGAtPosition(position);
        break;
      case 'canvas-overlay':
        this._renderCanvasAtPosition(position);
        break;
      case 'html-overlay':
        this._renderHTMLAtPosition(position);
        break;
    }
    
    this.lastPosition = { ...position };
  }
  
  /**
   * Render SVG crosshair at position
   * @private
   */
  _renderSVGAtPosition(position) {
    if (this.options.showX && this.xLineElement) {
      this.xLineElement.setAttribute('x1', position.x);
      this.xLineElement.setAttribute('x2', position.x);
    }
    
    if (this.options.showY && this.yLineElement) {
      this.yLineElement.setAttribute('y1', position.y);
      this.yLineElement.setAttribute('y2', position.y);
    }
  }
  
  /**
   * Render Canvas crosshair at position
   * @private
   */
  _renderCanvasAtPosition(position) {
    if (!this.overlayContext) return;
    
    // Clear previous crosshair
    this.overlayContext.clearRect(0, 0, this.containerBounds.width, this.containerBounds.height);
    
    // Set line style
    this.overlayContext.strokeStyle = this.options.stroke;
    this.overlayContext.lineWidth = this.options.strokeWidth;
    this.overlayContext.globalAlpha = this.options.opacity;
    
    // Set dash pattern
    if (this.options.strokeDasharray && this.options.strokeDasharray !== 'none') {
      const dashes = this.options.strokeDasharray.split(',').map(d => parseFloat(d.trim()));
      this.overlayContext.setLineDash(dashes);
    } else {
      this.overlayContext.setLineDash([]);
    }
    
    this.overlayContext.beginPath();
    
    // Draw X crosshair (vertical line)
    if (this.options.showX) {
      this.overlayContext.moveTo(position.x, 0);
      this.overlayContext.lineTo(position.x, this.containerBounds.height);
    }
    
    // Draw Y crosshair (horizontal line)
    if (this.options.showY) {
      this.overlayContext.moveTo(0, position.y);
      this.overlayContext.lineTo(this.containerBounds.width, position.y);
    }
    
    this.overlayContext.stroke();
  }
  
  /**
   * Render HTML crosshair at position
   * @private
   */
  _renderHTMLAtPosition(position) {
    if (this.options.showX && this.htmlXLine) {
      this.htmlXLine.style.left = `${position.x}px`;
    }
    
    if (this.options.showY && this.htmlYLine) {
      this.htmlYLine.style.top = `${position.y}px`;
    }
  }
  
  /**
   * Show the crosshair
   * @param {number} x - Initial X position (optional)
   * @param {number} y - Initial Y position (optional)
   */
  show(x, y) {
    if (!this.isInitialized) {
      console.warn('Crosshair not initialized');
      return;
    }
    
    // Update position if provided
    if (x !== undefined && y !== undefined) {
      this.update(x, y, false);
    }
    
    this.visible = true;
    
    switch (this.renderMode) {
      case 'svg':
        this._showSVG();
        break;
      case 'canvas-overlay':
        this._showCanvas();
        break;
      case 'html-overlay':
        this._showHTML();
        break;
    }
  }
  
  /**
   * Show SVG crosshair
   * @private
   */
  _showSVG() {
    if (this.groupElement) {
      this.groupElement.setAttribute('opacity', this.options.opacity);
    }
  }
  
  /**
   * Show Canvas crosshair
   * @private
   */
  _showCanvas() {
    if (this.overlayCanvas) {
      this.overlayCanvas.style.opacity = '1';
    }
  }
  
  /**
   * Show HTML crosshair
   * @private
   */
  _showHTML() {
    if (this.htmlCrosshair) {
      this.htmlCrosshair.style.opacity = '1';
    }
  }
  
  /**
   * Hide the crosshair
   */
  hide() {
    this.visible = false;
    
    switch (this.renderMode) {
      case 'svg':
        this._hideSVG();
        break;
      case 'canvas-overlay':
        this._hideCanvas();
        break;
      case 'html-overlay':
        this._hideHTML();
        break;
    }
  }
  
  /**
   * Hide SVG crosshair
   * @private
   */
  _hideSVG() {
    if (this.groupElement) {
      this.groupElement.setAttribute('opacity', 0);
    }
  }
  
  /**
   * Hide Canvas crosshair
   * @private
   */
  _hideCanvas() {
    if (this.overlayCanvas) {
      this.overlayCanvas.style.opacity = '0';
    }
    
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.containerBounds.width, this.containerBounds.height);
    }
  }
  
  /**
   * Hide HTML crosshair
   * @private
   */
  _hideHTML() {
    if (this.htmlCrosshair) {
      this.htmlCrosshair.style.opacity = '0';
    }
  }
  
  /**
   * Render crosshair for SVG mode
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} transform - Transform options {translateX, translateY}
   * @returns {string} Element ID for tracking
   */
  renderSVG(width, height, transform = {}) {
    if (this.renderMode !== 'svg' || !this.currentRenderer) {
      console.warn('renderSVG called but not in SVG mode or no renderer available');
      return null;
    }
    
    // Update container bounds
    this.containerBounds = { width, height };
    
    // Apply transform if provided
    if (transform.translateX || transform.translateY) {
      this.currentRenderer.save();
      this.currentRenderer.translate(transform.translateX || 0, transform.translateY || 0);
    }
    
    // Create crosshair group
    this.groupElement = this.currentRenderer.createGroup({
      class: `${this.elementId}-crosshair`,
      opacity: 0
    });
    
    // Create X crosshair (vertical line)
    if (this.options.showX) {
      this.xLineElement = this.currentRenderer.drawLine(
        0, 0, 0, height,
        {
          stroke: this.options.stroke,
          strokeWidth: this.options.strokeWidth,
          strokeDasharray: this.options.strokeDasharray,
          opacity: this.options.opacity,
          class: `${this.elementId}-x-line`
        }
      );
      this.renderedElements.push(this.xLineElement);
    }
    
    // Create Y crosshair (horizontal line)
    if (this.options.showY) {
      this.yLineElement = this.currentRenderer.drawLine(
        0, 0, width, 0,
        {
          stroke: this.options.stroke,
          strokeWidth: this.options.strokeWidth,
          strokeDasharray: this.options.strokeDasharray,
          opacity: this.options.opacity,
          class: `${this.elementId}-y-line`
        }
      );
      this.renderedElements.push(this.yLineElement);
    }
    
    // Restore transform if applied
    if (transform.translateX || transform.translateY) {
      this.currentRenderer.restore();
    }
    
    this.renderedElements.push(this.groupElement);
    
    return this.elementId;
  }
  
  /**
   * Update crosshair dimensions (for resize events)
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.containerBounds = { width, height };
    
    switch (this.renderMode) {
      case 'canvas-overlay':
        this._resizeCanvasOverlay(width, height);
        break;
      case 'html-overlay':
        // HTML overlay automatically resizes with container
        break;
      case 'svg':
        // SVG lines need to be updated with new dimensions
        this._resizeSVGLines(width, height);
        break;
    }
  }
  
  /**
   * Resize Canvas overlay
   * @private
   */
  _resizeCanvasOverlay(width, height) {
    if (!this.overlayCanvas) return;
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.overlayCanvas.width = width * devicePixelRatio;
    this.overlayCanvas.height = height * devicePixelRatio;
    this.overlayCanvas.style.width = `${width}px`;
    this.overlayCanvas.style.height = `${height}px`;
    
    if (this.overlayContext) {
      this.overlayContext.scale(devicePixelRatio, devicePixelRatio);
    }
  }
  
  /**
   * Resize SVG lines
   * @private
   */
  _resizeSVGLines(width, height) {
    if (this.options.showX && this.xLineElement) {
      this.xLineElement.setAttribute('y2', height);
    }
    
    if (this.options.showY && this.yLineElement) {
      this.xLineElement.setAttribute('x2', width);
    }
  }
  
  /**
   * Clear all rendered elements
   */
  clear() {
    // Clear rendered elements
    this.renderedElements.forEach(elementId => {
      if (this.currentRenderer && this.currentRenderer.removeElement) {
        this.currentRenderer.removeElement(elementId);
      }
    });
    this.renderedElements = [];
    
    // Clear Canvas overlay
    if (this.overlayContext) {
      this.overlayContext.clearRect(0, 0, this.containerBounds.width, this.containerBounds.height);
    }
    
    // Clear references
    this.groupElement = null;
    this.xLineElement = null;
    this.yLineElement = null;
  }
  
  /**
   * Update crosshair with new renderer
   * @param {AbstractRenderer} newRenderer - New renderer instance
   */
  async updateRenderer(newRenderer) {
    // Clear current elements
    this.clear();
    
    // Re-initialize with new renderer
    await this.initialize(
      newRenderer, 
      this.chartContainer, 
      this.containerBounds.width, 
      this.containerBounds.height
    );
  }
  
  /**
   * Destroy crosshair and clean up resources
   */
  destroy() {
    // Cancel any ongoing animations
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Clear throttle timeout
    if (this.updateThrottle) {
      clearTimeout(this.updateThrottle);
      this.updateThrottle = null;
    }
    
    // Clear all elements
    this.clear();
    
    // Remove HTML elements
    if (this.htmlCrosshair && this.htmlCrosshair.parentNode) {
      this.htmlCrosshair.parentNode.removeChild(this.htmlCrosshair);
    }
    
    if (this.overlayCanvas && this.overlayCanvas.parentNode) {
      this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
    }
    
    // Clear references
    this.htmlCrosshair = null;
    this.htmlXLine = null;
    this.htmlYLine = null;
    this.overlayCanvas = null;
    this.overlayContext = null;
    this.currentRenderer = null;
    this.chartContainer = null;
    this.dataPoints = [];
    
    this.isInitialized = false;
    this.visible = false;
  }
  
  /**
   * Get current snapped data point
   * @returns {Object|null} Snapped point or null
   */
  getSnappedPoint() {
    return this.snappedPoint;
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.renderMetrics };
  }
  
  /**
   * Toggle crosshair visibility
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  // ===== LEGACY COMPATIBILITY METHODS =====
  
  /**
   * Legacy SVG render method for backwards compatibility
   * @param {SVGElement} container - SVG container
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {SVGElement} Crosshair group element
   * @deprecated Use initialize() and renderSVG() with renderer instance instead
   */
  render(container, width, height) {
    console.warn('Crosshair.render() is deprecated. Use initialize() and renderSVG() with renderer instance instead.');
    
    // Try to maintain basic compatibility by setting up a minimal SVG mode
    this.renderMode = 'svg';
    this.isInitialized = true;
    this.containerBounds = { width, height };
    
    // Create basic SVG elements for backwards compatibility
    // This is a simplified version that mimics the old behavior
    return container;
  }
}
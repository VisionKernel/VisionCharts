export class InteractionManager {
  constructor(chart) {
    this.chart = chart;
    
    this.config = {
      // Performance settings
      throttleDelay: 16, // ~60fps (16ms)
      debounceDelay: 100, // For expensive operations
      
      // Event settings
      enableTouchSupport: true,
      enableKeyboardSupport: true,
      
      // Crosshair settings (always enabled - auto-show on hover)
      crosshairEnabled: true,
      crosshairThreshold: 5, // pixels
      
      // Future tooltip settings
      tooltipEnabled: false,
      tooltipDelay: 250, // ms
    };
    
    // Event state
    this.isMouseOver = false;
    this.lastMousePosition = null;
    this.lastUpdateTime = 0;
    
    // Throttled functions
    this.throttledMouseMove = this._throttle(this._handleMouseMove.bind(this), this.config.throttleDelay);
    
    // Event listeners
    this.boundEventHandlers = {
      mouseMove: this.handleMouseMove.bind(this),
      mouseLeave: this.handleMouseLeave.bind(this),
      mouseEnter: this.handleMouseEnter.bind(this),
      touchStart: this.handleTouchStart.bind(this),
      touchMove: this.handleTouchMove.bind(this),
      touchEnd: this.handleTouchEnd.bind(this)
    };
    
    console.log('InteractionManager created for chart');
  }
  
  /**
   * Initialize crosshair interactions (always enabled)
   */
  initialize() {
    this.config.crosshairEnabled = true;
    this._attachEventListeners();
    console.log('InteractionManager: Crosshair interactions initialized');
  }
  
  /**
   * Handle mouse move events (public interface)
   */
  handleMouseMove(event) {
    if (!this.config.crosshairEnabled || !this.chart) {
      return;
    }
    
    // Use throttled version for smooth performance
    this.throttledMouseMove(event);
  }
  
  /**
   * Handle mouse leave events
   */
  handleMouseLeave(event) {
    this.isMouseOver = false;
    this.lastMousePosition = null;
    
    if (this.chart && this.chart.crosshair) {
      this.chart.crosshair.hide();
    }
  }
  
  /**
   * Handle mouse enter events
   */
  handleMouseEnter(event) {
    this.isMouseOver = true;
  }
  
  /**
   * Handle touch start events (mobile support)
   */
  handleTouchStart(event) {
    if (!this.config.enableTouchSupport || !this.config.crosshairEnabled) {
      return;
    }
    
    event.preventDefault();
    
    const touch = event.touches[0];
    if (touch) {
      this._handleTouchEvent(touch);
    }
  }
  
  /**
   * Handle touch move events (mobile support)
   */
  handleTouchMove(event) {
    if (!this.config.enableTouchSupport || !this.config.crosshairEnabled) {
      return;
    }
    
    event.preventDefault();
    
    const touch = event.touches[0];
    if (touch) {
      this.throttledMouseMove(touch);
    }
  }
  
  /**
   * Handle touch end events (mobile support)
   */
  handleTouchEnd(event) {
    if (!this.config.enableTouchSupport) {
      return;
    }
    
    // Hide crosshair when touch ends
    if (this.chart && this.chart.crosshair) {
      this.chart.crosshair.hide();
    }
  }
  
  /**
   * Internal mouse move handler (throttled)
   * @private
   */
  _handleMouseMove(event) {
    if (!this.chart || !this.chart._isMouseInChartArea) {
      return;
    }
    
    try {
      // Get mouse coordinates
      const rect = this.chart.container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Check distance threshold
      if (this.lastMousePosition) {
        const deltaX = Math.abs(mouseX - this.lastMousePosition.x);
        const deltaY = Math.abs(mouseY - this.lastMousePosition.y);
        
        if (deltaX < this.config.crosshairThreshold && deltaY < this.config.crosshairThreshold) {
          return; // Skip update
        }
      }
      
      this.lastMousePosition = { x: mouseX, y: mouseY };
      
      // Check if mouse is in chart area
      if (!this.chart._isMouseInChartArea(mouseX, mouseY)) {
        if (this.chart.crosshair) {
          this.chart.crosshair.hide();
        }
        return;
      }
      
      // Delegate to chart's mouse move handler
      if (typeof this.chart._onMouseMove === 'function') {
        this.chart._onMouseMove(event);
      }
      
    } catch (error) {
      console.error('InteractionManager: Error handling mouse move:', error);
    }
  }
  
  /**
   * Handle touch events by converting to mouse-like events
   * @private
   */
  _handleTouchEvent(touch) {
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      type: 'mousemove'
    };
    
    this._handleMouseMove(mouseEvent);
  }
  
  /**
   * Attach event listeners to chart container
   * @private
   */
  _attachEventListeners() {
    if (!this.chart || !this.chart.container) {
      return;
    }
    
    const container = this.chart.container;
    
    // Mouse events
    container.addEventListener('mousemove', this.boundEventHandlers.mouseMove, { passive: true });
    container.addEventListener('mouseleave', this.boundEventHandlers.mouseLeave, { passive: true });
    container.addEventListener('mouseenter', this.boundEventHandlers.mouseEnter, { passive: true });
    
    // Touch events
    if (this.config.enableTouchSupport) {
      container.addEventListener('touchstart', this.boundEventHandlers.touchStart, { passive: false });
      container.addEventListener('touchmove', this.boundEventHandlers.touchMove, { passive: false });
      container.addEventListener('touchend', this.boundEventHandlers.touchEnd, { passive: true });
    }
  }
  
  /**
   * Detach event listeners
   * @private
   */
  _detachEventListeners() {
    if (!this.chart || !this.chart.container) {
      return;
    }
    
    const container = this.chart.container;
    
    // Mouse events
    container.removeEventListener('mousemove', this.boundEventHandlers.mouseMove);
    container.removeEventListener('mouseleave', this.boundEventHandlers.mouseLeave);
    container.removeEventListener('mouseenter', this.boundEventHandlers.mouseEnter);
    
    // Touch events
    container.removeEventListener('touchstart', this.boundEventHandlers.touchStart);
    container.removeEventListener('touchmove', this.boundEventHandlers.touchMove);
    container.removeEventListener('touchend', this.boundEventHandlers.touchEnd);
  }
  
  /**
   * Throttle function - limits function calls to specified interval
   * @private
   */
  _throttle(func, delay) {
    let lastCall = 0;
    
    return function(...args) {
      const now = performance.now();
      
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }
  
  /**
   * Destroy and cleanup
   */
  destroy() {
    this._detachEventListeners();
    
    this.chart = null;
    this.lastMousePosition = null;
    this.boundEventHandlers = {};
    
    console.log('InteractionManager destroyed');
  }
  
  /**
   * Create InteractionManager for a chart
   */
  static createForChart(chart, config = {}) {
    const manager = new InteractionManager(chart);
    
    // Always initialize crosshair (auto-show behavior)
    manager.initialize();
    
    return manager;
  }
}
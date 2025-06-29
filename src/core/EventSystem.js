/**
 * EventSystem - Unified multi-renderer event handling system
 * 
 * Provides centralized event management that works seamlessly across SVG, Canvas, 
 * and WebGL renderers with coordinate normalization, performance optimization,
 * and component coordination.
 */
export default class EventSystem {
  /**
   * Create a new EventSystem instance
   * @param {Chart} chart - Chart instance
   * @param {Object} options - Event system options
   */
  constructor(chart, options = {}) {
    this.chart = chart;
    this.options = Object.assign({
      // Performance options
      throttleDelay: 16, // ms between throttled events
      debounceDelay: 100, // ms for debounced events
      enableTouchEvents: true,
      enablePointerEvents: true,
      
      // Coordinate options
      enableCoordinateNormalization: true,
      enableDataCoordinates: true,
      
      // Event filtering
      enableEventFiltering: true,
      enableBoundaryChecking: true,
      
      // Performance monitoring
      enablePerformanceTracking: true,
      maxEventRate: 120, // events per second
      
      // Memory management
      enableAutoCleanup: true,
      maxListeners: 1000,
      
      // Mobile/touch options
      touchThreshold: 10, // pixels
      enableGestures: false,
      
      // Debug options
      debugMode: false,
      logEvents: false
    }, options);
    
    // Event state
    this.isInitialized = false;
    this.eventTarget = null;
    this.boundingRect = null;
    
    // Event listeners registry
    this.listeners = new Map(); // eventType -> Set of handlers
    this.componentListeners = new Map(); // componentId -> Map of handlers
    this.customEventListeners = new Map(); // custom event types
    
    // Event delegation registry
    this.delegatedEvents = new Set(['mousemove', 'mousedown', 'mouseup', 'click', 'mouseleave', 'mouseenter']);
    this.touchEvents = new Set(['touchstart', 'touchmove', 'touchend', 'touchcancel']);
    this.pointerEvents = new Set(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']);
    
    // Throttling and debouncing
    this.throttledHandlers = new Map();
    this.debouncedHandlers = new Map();
    this.eventQueue = [];
    this.processingQueue = false;
    
    // Coordinate systems
    this.coordinateCache = new Map();
    this.lastCoordinateUpdate = 0;
    this.coordinateCacheDuration = 16; // ms
    
    // Performance tracking
    this.eventMetrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      lastSecondCount: 0,
      lastSecondTime: Date.now(),
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      droppedEvents: 0
    };
    
    // Touch/pointer state
    this.touchState = {
      isTracking: false,
      startPoint: null,
      currentPoint: null,
      startTime: 0,
      lastMoveTime: 0
    };
    
    // Component coordination
    this.componentEventOrder = ['crosshair', 'tooltip', 'legend', 'axes']; // Processing order
    this.activeComponents = new Set();
    
    // Memory management
    this.cleanupCallbacks = new Set();
    this.isDestroyed = false;
    
    // Renderer-specific state
    this.rendererEventMap = new Map(); // Maps renderer types to event handling strategies
    this._initializeRendererStrategies();
  }
  
  /**
   * Initialize EventSystem with chart's current renderer
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('EventSystem already initialized');
      return true;
    }
    
    if (!this.chart.renderer || !this.chart.renderer.isInitialized) {
      console.error('EventSystem: Chart renderer not available');
      return false;
    }
    
    try {
      // Determine event target based on renderer
      this.eventTarget = this._getEventTarget();
      
      if (!this.eventTarget) {
        console.error('EventSystem: Could not determine event target');
        return false;
      }
      
      // Setup event delegation
      this._setupEventDelegation();
      
      // Setup coordinate system
      this._setupCoordinateSystem();
      
      // Setup performance monitoring
      if (this.options.enablePerformanceTracking) {
        this._setupPerformanceMonitoring();
      }
      
      // Setup mobile/touch events
      if (this.options.enableTouchEvents) {
        this._setupTouchEvents();
      }
      
      // Setup pointer events
      if (this.options.enablePointerEvents && window.PointerEvent) {
        this._setupPointerEvents();
      }
      
      // Setup cleanup
      if (this.options.enableAutoCleanup) {
        this._setupAutoCleanup();
      }
      
      this.isInitialized = true;
      console.log('EventSystem initialized successfully');
      
      return true;
      
    } catch (error) {
      console.error('EventSystem initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Initialize renderer-specific event handling strategies
   * @private
   */
  _initializeRendererStrategies() {
    // SVG renderer strategy
    this.rendererEventMap.set('svg', {
      getEventTarget: (chart) => chart.state.svg || chart.renderer.svg,
      getCoordinates: (event, target) => this._getSVGCoordinates(event, target),
      hitTest: (x, y, components) => this._svgHitTest(x, y, components),
      cleanup: (target) => this._svgCleanup(target)
    });
    
    // Canvas renderer strategy
    this.rendererEventMap.set('canvas', {
      getEventTarget: (chart) => chart.renderer.canvas,
      getCoordinates: (event, target) => this._getCanvasCoordinates(event, target),
      hitTest: (x, y, components) => this._canvasHitTest(x, y, components),
      cleanup: (target) => this._canvasCleanup(target)
    });
    
    // WebGL renderer strategy
    this.rendererEventMap.set('webgl', {
      getEventTarget: (chart) => chart.renderer.canvas,
      getCoordinates: (event, target) => this._getWebGLCoordinates(event, target),
      hitTest: (x, y, components) => this._webglHitTest(x, y, components),
      cleanup: (target) => this._webglCleanup(target)
    });
  }
  
  /**
   * Get appropriate event target for current renderer
   * @private
   */
  _getEventTarget() {
    const rendererType = this.chart.renderer.type || this.chart.rendererMetadata?.type;
    const strategy = this.rendererEventMap.get(rendererType);
    
    if (strategy) {
      return strategy.getEventTarget(this.chart);
    }
    
    // Fallback to container
    return this.chart.state.container;
  }
  
  /**
   * Setup event delegation for all supported events
   * @private
   */
  _setupEventDelegation() {
    // Mouse events
    this.delegatedEvents.forEach(eventType => {
      const handler = this._createDelegatedHandler(eventType);
      this.eventTarget.addEventListener(eventType, handler, { passive: false });
      
      // Store for cleanup
      this.cleanupCallbacks.add(() => {
        this.eventTarget.removeEventListener(eventType, handler);
      });
    });
    
    // Prevent context menu on right click (optional)
    const contextMenuHandler = (e) => {
      if (this.options.preventContextMenu) {
        e.preventDefault();
      }
    };
    
    this.eventTarget.addEventListener('contextmenu', contextMenuHandler);
    this.cleanupCallbacks.add(() => {
      this.eventTarget.removeEventListener('contextmenu', contextMenuHandler);
    });
  }
  
  /**
   * Create delegated event handler for specific event type
   * @private
   */
  _createDelegatedHandler(eventType) {
    return (event) => {
      if (this.isDestroyed) return;
      
      const startTime = performance.now();
      
      try {
        // Performance check
        if (this.options.enablePerformanceTracking) {
          this._updateEventMetrics();
          
          if (this.eventMetrics.eventsPerSecond > this.options.maxEventRate) {
            this.eventMetrics.droppedEvents++;
            return; // Drop event to maintain performance
          }
        }
        
        // Get normalized coordinates
        const coordinates = this._getNormalizedCoordinates(event);
        
        if (!coordinates) {
          return; // Invalid coordinates
        }
        
        // Create event data object
        const eventData = this._createEventData(event, eventType, coordinates);
        
        // Apply throttling for high-frequency events
        if (this._shouldThrottle(eventType)) {
          this._handleThrottledEvent(eventType, eventData);
        } else {
          this._processEvent(eventType, eventData);
        }
        
        // Update performance metrics
        if (this.options.enablePerformanceTracking) {
          const processingTime = performance.now() - startTime;
          this._updateProcessingMetrics(processingTime);
        }
        
      } catch (error) {
        console.error(`EventSystem: Error processing ${eventType}:`, error);
      }
    };
  }
  
  /**
   * Get normalized coordinates for event
   * @private
   */
  _getNormalizedCoordinates(event) {
    const cacheKey = `${event.clientX}-${event.clientY}-${Date.now()}`;
    
    // Check cache
    if (this.options.enableCoordinateNormalization) {
      const now = Date.now();
      if (now - this.lastCoordinateUpdate < this.coordinateCacheDuration) {
        const cached = this.coordinateCache.get(cacheKey);
        if (cached) return cached;
      }
    }
    
    // Get renderer-specific coordinates
    const rendererType = this.chart.renderer.type || this.chart.rendererMetadata?.type;
    const strategy = this.rendererEventMap.get(rendererType);
    
    if (!strategy) {
      return this._getFallbackCoordinates(event);
    }
    
    const coordinates = strategy.getCoordinates(event, this.eventTarget);
    
    // Cache coordinates
    if (this.options.enableCoordinateNormalization) {
      this.coordinateCache.set(cacheKey, coordinates);
      this.lastCoordinateUpdate = Date.now();
    }
    
    return coordinates;
  }
  
  /**
   * Get SVG-specific coordinates
   * @private
   */
  _getSVGCoordinates(event, target) {
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    return this._createCoordinateObject(event, x, y, rect);
  }
  
  /**
   * Get Canvas-specific coordinates
   * @private
   */
  _getCanvasCoordinates(event, target) {
    const rect = target.getBoundingClientRect();
    const scaleX = target.width / rect.width;
    const scaleY = target.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    return this._createCoordinateObject(event, x, y, rect);
  }
  
  /**
   * Get WebGL-specific coordinates
   * @private
   */
  _getWebGLCoordinates(event, target) {
    // WebGL uses same coordinate system as Canvas
    return this._getCanvasCoordinates(event, target);
  }
  
  /**
   * Get fallback coordinates
   * @private
   */
  _getFallbackCoordinates(event) {
    const rect = this.chart.state.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    return this._createCoordinateObject(event, x, y, rect);
  }
  
  /**
   * Create standardized coordinate object
   * @private
   */
  _createCoordinateObject(event, x, y, rect) {
    const margins = this.chart.options.margins;
    
    // Chart area coordinates (accounting for margins)
    const chartX = x - margins.left;
    const chartY = y - margins.top;
    
    // Data coordinates (if scales available)
    let dataCoordinates = null;
    if (this.options.enableDataCoordinates && this.chart.state.scales) {
      try {
        const dataX = this.chart.state.scales.x?.invert?.(chartX);
        const dataY = this.chart.state.scales.y?.invert?.(chartY);
        
        if (dataX !== undefined && dataY !== undefined) {
          dataCoordinates = { x: dataX, y: dataY };
        }
      } catch (error) {
        // Ignore data coordinate conversion errors
      }
    }
    
    // Boundary checks
    const inChartArea = chartX >= 0 && chartX <= this.chart.state.dimensions.innerWidth &&
                       chartY >= 0 && chartY <= this.chart.state.dimensions.innerHeight;
    
    const inContainer = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
    
    return {
      // Original event coordinates
      clientX: event.clientX,
      clientY: event.clientY,
      
      // Container-relative coordinates
      containerX: x,
      containerY: y,
      
      // Chart area coordinates (with margin offset)
      chartX: chartX,
      chartY: chartY,
      
      // Data space coordinates
      dataX: dataCoordinates?.x,
      dataY: dataCoordinates?.y,
      
      // Boundary information
      inChartArea: inChartArea,
      inContainer: inContainer,
      
      // Container bounds
      containerRect: rect,
      
      // Original event reference
      originalEvent: event
    };
  }
  
  /**
   * Create event data object
   * @private
   */
  _createEventData(originalEvent, type, coordinates) {
    return {
      type: type,
      coordinates: coordinates,
      timestamp: Date.now(),
      originalEvent: originalEvent,
      
      // Chart context
      chart: this.chart,
      renderer: this.chart.renderer,
      
      // Convenience methods
      preventDefault: () => originalEvent.preventDefault(),
      stopPropagation: () => originalEvent.stopPropagation(),
      
      // Coordinate helpers
      isInChartArea: () => coordinates.inChartArea,
      isInContainer: () => coordinates.inContainer,
      getChartCoordinates: () => ({ x: coordinates.chartX, y: coordinates.chartY }),
      getDataCoordinates: () => ({ x: coordinates.dataX, y: coordinates.dataY })
    };
  }
  
  /**
   * Check if event should be throttled
   * @private
   */
  _shouldThrottle(eventType) {
    return eventType === 'mousemove' || eventType === 'pointermove' || eventType === 'touchmove';
  }
  
  /**
   * Handle throttled event
   * @private
   */
  _handleThrottledEvent(eventType, eventData) {
    const key = eventType;
    
    if (this.throttledHandlers.has(key)) {
      // Update pending event data
      this.throttledHandlers.set(key, eventData);
      return;
    }
    
    // Process immediately and set up throttle
    this._processEvent(eventType, eventData);
    
    // Set up throttle
    this.throttledHandlers.set(key, eventData);
    
    setTimeout(() => {
      const pendingEventData = this.throttledHandlers.get(key);
      this.throttledHandlers.delete(key);
      
      // Process the last pending event
      if (pendingEventData && pendingEventData !== eventData) {
        this._processEvent(eventType, pendingEventData);
      }
    }, this.options.throttleDelay);
  }
  
  /**
   * Process event through component chain
   * @private
   */
  _processEvent(eventType, eventData) {
    // Apply boundary checking
    if (this.options.enableBoundaryChecking && !this._passesFilter(eventData)) {
      return;
    }
    
    // Log event if debugging
    if (this.options.logEvents) {
      console.log(`EventSystem: Processing ${eventType}`, eventData);
    }
    
    // Process through component order
    this.componentEventOrder.forEach(componentType => {
      if (this.activeComponents.has(componentType)) {
        this._processComponentEvent(componentType, eventType, eventData);
      }
    });
    
    // Process registered listeners
    this._processRegisteredListeners(eventType, eventData);
    
    // Emit custom events
    this._emitCustomEvents(eventType, eventData);
  }
  
  /**
   * Process event for specific component
   * @private
   */
  _processComponentEvent(componentType, eventType, eventData) {
    const component = this.chart.state.components[componentType];
    
    if (!component) return;
    
    // Component-specific event processing
    switch (componentType) {
      case 'crosshair':
        this._processCrosshairEvent(component, eventType, eventData);
        break;
      case 'tooltip':
        this._processTooltipEvent(component, eventType, eventData);
        break;
      case 'legend':
        this._processLegendEvent(component, eventType, eventData);
        break;
      case 'axes':
        this._processAxesEvent(component, eventType, eventData);
        break;
    }
  }
  
  /**
   * Process crosshair events
   * @private
   */
  _processCrosshairEvent(crosshair, eventType, eventData) {
    const { coordinates } = eventData;
    
    switch (eventType) {
      case 'mousemove':
        if (coordinates.inChartArea) {
          crosshair.update(coordinates.chartX, coordinates.chartY);
          if (!crosshair.visible) {
            crosshair.show();
          }
        }
        break;
      case 'mouseleave':
        crosshair.hide();
        break;
      case 'mouseenter':
        // Update data points for snapping
        this._updateCrosshairDataPoints(crosshair);
        break;
    }
  }
  
  /**
   * Process tooltip events
   * @private
   */
  _processTooltipEvent(tooltip, eventType, eventData) {
    const { coordinates } = eventData;
    
    switch (eventType) {
      case 'mousemove':
        if (coordinates.inChartArea) {
          // Find closest data point
          const closestData = this._findClosestDataPoint(coordinates.chartX, coordinates.chartY);
          
          if (closestData && closestData.distance <= 30) {
            const tooltipData = this._formatTooltipData(closestData);
            tooltip.show(tooltipData, coordinates.chartX, coordinates.chartY, {
              width: this.chart.state.dimensions.width,
              height: this.chart.state.dimensions.height
            });
          } else {
            tooltip.hide();
          }
        }
        break;
      case 'mouseleave':
        tooltip.hide();
        break;
    }
  }
  
  /**
   * Process legend events
   * @private
   */
  _processLegendEvent(legend, eventType, eventData) {
    // Legend events are typically handled by the legend component itself
    // through its own event listeners (click handlers, etc.)
    // This is here for coordination if needed
  }
  
  /**
   * Process axes events
   * @private
   */
  _processAxesEvent(axes, eventType, eventData) {
    // Axes events for future features like axis zooming, panning, etc.
  }
  
  /**
   * Apply event filtering
   * @private
   */
  _passesFilter(eventData) {
    // Basic boundary check
    if (!eventData.coordinates.inContainer) {
      return false;
    }
    
    // Add more sophisticated filtering as needed
    return true;
  }
  
  // ===== PUBLIC API METHODS =====
  
  /**
   * Register event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Handler options
   */
  addEventListener(eventType, handler, options = {}) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const handlerInfo = {
      handler: handler,
      options: options,
      id: Math.random().toString(36).substr(2, 9)
    };
    
    this.listeners.get(eventType).add(handlerInfo);
    
    // Return removal function
    return () => {
      this.listeners.get(eventType)?.delete(handlerInfo);
    };
  }
  
  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler to remove
   */
  removeEventListener(eventType, handler) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handlerInfo of handlers) {
        if (handlerInfo.handler === handler) {
          handlers.delete(handlerInfo);
          break;
        }
      }
    }
  }
  
  /**
   * Register component for event processing
   * @param {string} componentType - Component type
   */
  registerComponent(componentType) {
    this.activeComponents.add(componentType);
  }
  
  /**
   * Unregister component from event processing
   * @param {string} componentType - Component type
   */
  unregisterComponent(componentType) {
    this.activeComponents.delete(componentType);
  }
  
  /**
   * Emit custom event
   * @param {string} eventType - Custom event type
   * @param {Object} data - Event data
   */
  emit(eventType, data) {
    // Create custom event
    const customEvent = new CustomEvent(eventType, {
      detail: data,
      bubbles: true,
      cancelable: true
    });
    
    // Dispatch on event target
    this.eventTarget.dispatchEvent(customEvent);
    
    // Process through custom listeners
    const listeners = this.customEventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in custom event handler for ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * Register custom event listener
   * @param {string} eventType - Custom event type
   * @param {Function} handler - Event handler
   */
  on(eventType, handler) {
    if (!this.customEventListeners.has(eventType)) {
      this.customEventListeners.set(eventType, new Set());
    }
    
    this.customEventListeners.get(eventType).add(handler);
    
    // Return removal function
    return () => {
      this.customEventListeners.get(eventType)?.delete(handler);
    };
  }
  
  /**
   * Remove custom event listener
   * @param {string} eventType - Custom event type
   * @param {Function} handler - Event handler
   */
  off(eventType, handler) {
    const handlers = this.customEventListeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Update for renderer switch
   * @param {AbstractRenderer} newRenderer - New renderer instance
   */
  async updateRenderer(newRenderer) {
    if (!this.isInitialized) return;
    
    console.log('EventSystem: Updating for renderer switch');
    
    // Cleanup old event target
    this._cleanup();
    
    // Update chart renderer reference
    this.chart.renderer = newRenderer;
    
    // Re-initialize with new renderer
    await this.initialize();
  }
  
  /**
   * Get event system metrics
   * @returns {Object} Event metrics
   */
  getMetrics() {
    return {
      ...this.eventMetrics,
      activeComponents: Array.from(this.activeComponents),
      registeredListeners: this.listeners.size,
      customListeners: this.customEventListeners.size,
      isInitialized: this.isInitialized
    };
  }
  
  // ===== HELPER METHODS =====
  
  /**
   * Find closest data point to coordinates
   * @private
   */
  _findClosestDataPoint(x, y) {
    let minDistance = Infinity;
    let closestData = null;
    
    this.chart.config.datasets?.forEach(dataset => {
      if (!dataset.data || !dataset.visible) return;
      
      dataset.data.forEach(point => {
        if (!point || point[this.chart.options.xField] === undefined || point[this.chart.options.yField] === undefined) {
          return;
        }
        
        const screenX = this.chart.state.scales.x?.scale(point[this.chart.options.xField]);
        const screenY = this.chart.state.scales.y?.scale(point[this.chart.options.yField]);
        
        if (screenX === undefined || screenY === undefined) return;
        
        const distance = Math.sqrt(Math.pow(x - screenX, 2) + Math.pow(y - screenY, 2));
        
        if (distance < minDistance) {
          minDistance = distance;
          closestData = {
            dataset: dataset,
            point: point,
            distance: distance,
            screenX: screenX,
            screenY: screenY
          };
        }
      });
    });
    
    return closestData;
  }
  
  /**
   * Format tooltip data
   * @private
   */
  _formatTooltipData(closestData) {
    return [{
      dataset: closestData.dataset,
      point: closestData.point
    }];
  }
  
  /**
   * Update crosshair data points
   * @private
   */
  _updateCrosshairDataPoints(crosshair) {
    const dataPoints = [];
    
    this.chart.config.datasets?.forEach(dataset => {
      if (!dataset.data || !dataset.visible) return;
      
      dataset.data.forEach(point => {
        if (!point || point[this.chart.options.xField] === undefined || point[this.chart.options.yField] === undefined) {
          return;
        }
        
        const screenX = this.chart.state.scales.x?.scale(point[this.chart.options.xField]);
        const screenY = this.chart.state.scales.y?.scale(point[this.chart.options.yField]);
        
        if (screenX !== undefined && screenY !== undefined) {
          dataPoints.push({
            x: screenX,
            y: screenY,
            data: point,
            dataset: dataset
          });
        }
      });
    });
    
    crosshair.setDataPoints(dataPoints);
  }
  
  /**
   * Process registered listeners
   * @private
   */
  _processRegisteredListeners(eventType, eventData) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach(handlerInfo => {
        try {
          handlerInfo.handler(eventData);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * Emit custom events based on standard events
   * @private
   */
  _emitCustomEvents(eventType, eventData) {
    // Emit chart-specific events
    switch (eventType) {
      case 'click':
        this.emit('chart-click', eventData);
        break;
      case 'mousemove':
        if (eventData.coordinates.inChartArea) {
          this.emit('chart-hover', eventData);
        }
        break;
      case 'mouseleave':
        this.emit('chart-leave', eventData);
        break;
    }
  }
  
  // ===== PERFORMANCE AND MONITORING =====
  
  /**
   * Setup performance monitoring
   * @private
   */
  _setupPerformanceMonitoring() {
    setInterval(() => {
      this._updateEventRateMetrics();
    }, 1000);
  }
  
  /**
   * Update event metrics
   * @private
   */
  _updateEventMetrics() {
    this.eventMetrics.totalEvents++;
    this.eventMetrics.lastSecondCount++;
  }
  
  /**
   * Update event rate metrics
   * @private
   */
  _updateEventRateMetrics() {
    const now = Date.now();
    const elapsed = now - this.eventMetrics.lastSecondTime;
    
    if (elapsed >= 1000) {
      this.eventMetrics.eventsPerSecond = this.eventMetrics.lastSecondCount;
      this.eventMetrics.lastSecondCount = 0;
      this.eventMetrics.lastSecondTime = now;
    }
  }
  
  /**
   * Update processing time metrics
   * @private
   */
  _updateProcessingMetrics(processingTime) {
    this.eventMetrics.maxProcessingTime = Math.max(this.eventMetrics.maxProcessingTime, processingTime);
    
    const total = this.eventMetrics.averageProcessingTime * (this.eventMetrics.totalEvents - 1) + processingTime;
    this.eventMetrics.averageProcessingTime = total / this.eventMetrics.totalEvents;
  }
  
  // ===== TOUCH AND MOBILE SUPPORT =====
  
  /**
   * Setup touch events
   * @private
   */
  _setupTouchEvents() {
    this.touchEvents.forEach(eventType => {
      const handler = this._createTouchHandler(eventType);
      this.eventTarget.addEventListener(eventType, handler, { passive: false });
      
      this.cleanupCallbacks.add(() => {
        this.eventTarget.removeEventListener(eventType, handler);
      });
    });
  }
  
  /**
   * Create touch event handler
   * @private
   */
  _createTouchHandler(eventType) {
    return (event) => {
      // Convert touch event to mouse-like event
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const mouseEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => event.preventDefault(),
          stopPropagation: () => event.stopPropagation()
        };
        
        // Map touch events to mouse events
        let mappedType;
        switch (eventType) {
          case 'touchstart':
            mappedType = 'mousedown';
            break;
          case 'touchmove':
            mappedType = 'mousemove';
            break;
          case 'touchend':
            mappedType = 'mouseup';
            break;
          default:
            return;
        }
        
        // Process as mouse event
        const coordinates = this._getNormalizedCoordinates(mouseEvent);
        if (coordinates) {
          const eventData = this._createEventData(mouseEvent, mappedType, coordinates);
          this._processEvent(mappedType, eventData);
        }
      }
    };
  }
  
  /**
   * Setup pointer events
   * @private
   */
  _setupPointerEvents() {
    this.pointerEvents.forEach(eventType => {
      const handler = this._createPointerHandler(eventType);
      this.eventTarget.addEventListener(eventType, handler, { passive: false });
      
      this.cleanupCallbacks.add(() => {
        this.eventTarget.removeEventListener(eventType, handler);
      });
    });
  }
  
  /**
   * Create pointer event handler
   * @private
   */
  _createPointerHandler(eventType) {
    return (event) => {
      // Process pointer events similar to mouse events
      let mappedType;
      switch (eventType) {
        case 'pointerdown':
          mappedType = 'mousedown';
          break;
        case 'pointermove':
          mappedType = 'mousemove';
          break;
        case 'pointerup':
          mappedType = 'mouseup';
          break;
        default:
          return;
      }
      
      const coordinates = this._getNormalizedCoordinates(event);
      if (coordinates) {
        const eventData = this._createEventData(event, mappedType, coordinates);
        this._processEvent(mappedType, eventData);
      }
    };
  }
  
  // ===== HIT TESTING =====
  
  /**
   * SVG hit testing
   * @private
   */
  _svgHitTest(x, y, components) {
    // Use native SVG hit testing
    const element = document.elementFromPoint(x, y);
    return this._analyzeHitElement(element);
  }
  
  /**
   * Canvas hit testing
   * @private
   */
  _canvasHitTest(x, y, components) {
    // Use component-provided hit areas
    const hitResults = [];
    
    components.forEach(component => {
      if (component.hitAreas) {
        const hit = component.hitAreas.find(area =>
          x >= area.x && x <= area.x + area.width &&
          y >= area.y && y <= area.y + area.height
        );
        
        if (hit) {
          hitResults.push({
            component: component,
            area: hit,
            data: hit.data
          });
        }
      }
    });
    
    return hitResults;
  }
  
  /**
   * WebGL hit testing
   * @private
   */
  _webglHitTest(x, y, components) {
    // Use same approach as Canvas
    return this._canvasHitTest(x, y, components);
  }
  
  /**
   * Analyze hit element for SVG
   * @private
   */
  _analyzeHitElement(element) {
    if (!element) return null;
    
    // Extract component information from element classes/data
    const classList = element.classList;
    const dataset = element.dataset;
    
    return {
      element: element,
      componentType: this._getComponentTypeFromElement(element),
      data: dataset
    };
  }
  
  /**
   * Get component type from element
   * @private
   */
  _getComponentTypeFromElement(element) {
    if (element.classList.contains('visioncharts-legend')) return 'legend';
    if (element.classList.contains('visioncharts-axis')) return 'axis';
    if (element.classList.contains('visioncharts-crosshair')) return 'crosshair';
    if (element.classList.contains('visioncharts-tooltip')) return 'tooltip';
    return 'unknown';
  }
  
  // ===== CLEANUP AND MEMORY MANAGEMENT =====
  
  /**
   * Setup automatic cleanup
   * @private
   */
  _setupAutoCleanup() {
    // Clean up coordinate cache periodically
    setInterval(() => {
      this.coordinateCache.clear();
    }, 5000);
    
    // Monitor memory usage
    setInterval(() => {
      if (this.listeners.size > this.options.maxListeners) {
        console.warn('EventSystem: Maximum listeners exceeded, consider cleanup');
      }
    }, 10000);
  }
  
  /**
   * Cleanup event system
   * @private
   */
  _cleanup() {
    // Execute all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('EventSystem cleanup error:', error);
      }
    });
    
    this.cleanupCallbacks.clear();
  }
  
  /**
   * Destroy event system
   */
  destroy() {
    if (this.isDestroyed) return;
    
    console.log('EventSystem: Destroying');
    
    // Cleanup all event listeners
    this._cleanup();
    
    // Clear all maps and sets
    this.listeners.clear();
    this.componentListeners.clear();
    this.customEventListeners.clear();
    this.throttledHandlers.clear();
    this.debouncedHandlers.clear();
    this.coordinateCache.clear();
    this.activeComponents.clear();
    
    // Clear references
    this.chart = null;
    this.eventTarget = null;
    
    this.isDestroyed = true;
    this.isInitialized = false;
    
    console.log('EventSystem destroyed');
  }
}
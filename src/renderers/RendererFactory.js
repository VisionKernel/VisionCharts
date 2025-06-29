import SvgRenderer from './SvgRenderer.js';
import CanvasRenderer from './CanvasRenderer.js';
import WebGLRenderer from './WebGLRenderer.js';
import CapabilityManager from '../core/CapabilityManager.js';
import PerformanceMonitor from '../core/PerformanceMonitor.js';

/**
 * RendererFactory - Unified Renderer Management and Orchestration
 * 
 * Coordinates renderer selection, creation, switching, and lifecycle management.
 * Provides a clean interface for charts to use the multi-renderer system.
 */
export default class RendererFactory {
  constructor(options = {}) {
    this.options = {
      // Default renderer policy
      defaultRenderer: 'canvas',
      enableAutoSwitching: true,
      enablePerformanceMonitoring: true,
      
      // Fallback chain
      fallbackChain: ['canvas', 'svg'],
      
      // Renderer-specific options
      rendererOptions: {
        svg: {},
        canvas: {},
        webgl: {}
      },
      
      // Performance monitoring options - Unified thresholds
      performanceOptions: {
        canvasThreshold: 100000,    // Switch to WebGL at 100K+ points
        svgFallbackThreshold: 10000, // Fallback to SVG below 10K points
        autoOptimizeFeatures: true,
        enablePerformanceTracking: true,
        performanceCheckInterval: 1000,
        frameRateWarningThreshold: 30,
        frameRateCriticalThreshold: 15
      },
      
      ...options
    };
    
    try {
      // Core components with error handling
      this.capabilityManager = new CapabilityManager();
      
      // Validate CapabilityManager initialization
      if (!this.capabilityManager || typeof this.capabilityManager.getCapabilities !== 'function') {
        console.error('RendererFactory: CapabilityManager failed to initialize properly');
        throw new Error('CapabilityManager initialization failed');
      }
      
      this.performanceMonitor = new PerformanceMonitor(
        this.capabilityManager, 
        this.options.performanceOptions
      );
      
      // Renderer registry
      this.rendererClasses = new Map([
        ['svg', SvgRenderer],
        ['canvas', CanvasRenderer],
        ['webgl', WebGLRenderer]
      ]);
      
      // Active renderers by chart instance
      this.activeRenderers = new Map();
      this.chartConfigurations = new Map();
      
      // Event handling
      this.eventListeners = new Map();
      this.performanceEventHandlers = new Map(); // Track performance monitor handlers
      
      // Switching state
      this.switchingQueue = new Map(); // Charts pending renderer switch
      
      // Initialization state
      this.isDestroyed = false;
      
      // Setup performance monitor event handlers
      this._setupPerformanceMonitorEvents();
      
      console.log('RendererFactory initialized successfully');
      
    } catch (error) {
      console.error('RendererFactory initialization failed:', error);
      throw error;
    }
  }

  // ===== RENDERER CREATION AND MANAGEMENT =====

  /**
   * Enhanced createRenderer method with better error handling
   * @param {HTMLElement} container - Chart container element
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} chartConfig - Chart configuration
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Renderer instance with metadata
   */
  async createRenderer(container, width, height, chartConfig, options = {}) {
    if (this.isDestroyed) {
      throw new Error('RendererFactory has been destroyed');
    }
    
    console.log('RendererFactory: Creating renderer for chart');
    
    try {
      // Ensure capability manager is properly initialized
      if (!this.capabilityManager) {
        console.error('RendererFactory: CapabilityManager not initialized');
        throw new Error('CapabilityManager not initialized');
      }

      // Validate that getCapabilities method exists
      if (typeof this.capabilityManager.getCapabilities !== 'function') {
        console.error('RendererFactory: CapabilityManager.getCapabilities method missing');
        throw new Error('CapabilityManager.getCapabilities method not available');
      }

      // Analyze requirements and get recommendation
      const recommendation = this.capabilityManager.selectOptimalRenderer({
        dataPoints: this._countDataPoints(chartConfig),
        features: this._extractFeatures(chartConfig),
        exportFormats: chartConfig.exportFormats || [],
        prioritizePerformance: options.prioritizePerformance || false,
        prioritizeQuality: options.prioritizeQuality || false,
        deviceConstraints: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      });
      
      // Apply unified VisionCharts policy
      const selectedRenderer = this._applyVisionChartsPolicy(recommendation, chartConfig);
      
      // Create renderer instance with enhanced error handling
      const rendererInstance = await this._createRendererInstanceSafe(
        selectedRenderer.primary,
        container,
        width,
        height,
        {
          ...this.options.rendererOptions[selectedRenderer.primary],
          ...options
        }
      );
      
      // Get capabilities safely
      const capabilities = this._getCapabilitiesSafe(selectedRenderer.primary);
      
      // Create renderer metadata
      const chartId = this._generateChartId();
      const rendererMetadata = {
        type: selectedRenderer.primary,
        instance: rendererInstance,
        recommendation: selectedRenderer,
        capabilities: capabilities,
        container,
        width,
        height,
        createdAt: Date.now(),
        switchCount: 0,
        isFallback: false
      };
      
      // Store renderer metadata
      this.activeRenderers.set(chartId, rendererMetadata);
      this.chartConfigurations.set(chartId, chartConfig);
      
      console.log(`RendererFactory: Successfully created ${selectedRenderer.primary} renderer`);
      
      // Emit creation event
      this._emit('renderer-created', { 
        chartId, 
        rendererType: selectedRenderer.primary,
        recommendation: selectedRenderer 
      });
      
      return {
        renderer: rendererInstance,
        metadata: rendererMetadata,
        chartId
      };
      
    } catch (error) {
      console.error('RendererFactory: Primary renderer creation failed:', error);
      
      // Try emergency fallback
      try {
        return await this._createEmergencyFallback(container, width, height, options);
      } catch (fallbackError) {
        console.error('RendererFactory: Emergency fallback also failed:', fallbackError);
        throw new Error('Complete renderer system failure');
      }
    }
  }

  /**
   * Switch renderer for an existing chart
   * @param {string} chartId - Chart identifier
   * @param {string} newRendererType - Target renderer type
   * @param {string} reason - Reason for switch
   * @returns {Promise<boolean>} Success status
   */
  async switchRenderer(chartId, newRendererType, reason = 'Manual switch') {
    if (this.isDestroyed) {
      console.warn('RendererFactory: Cannot switch renderer - factory destroyed');
      return false;
    }
    
    const currentMetadata = this.activeRenderers.get(chartId);
    if (!currentMetadata) {
      console.warn(`RendererFactory: Cannot switch - chart ${chartId} not found`);
      return false;
    }
    
    if (currentMetadata.type === newRendererType) {
      console.log(`RendererFactory: Already using ${newRendererType} renderer`);
      return true;
    }
    
    // Prevent concurrent switches
    if (this.switchingQueue.has(chartId)) {
      console.warn(`RendererFactory: Switch already in progress for chart ${chartId}`);
      return false;
    }
    
    this.switchingQueue.set(chartId, true);
    
    try {
      console.log(`RendererFactory: Switching from ${currentMetadata.type} to ${newRendererType} - ${reason}`);
      
      // Create new renderer
      const newRenderer = await this._createRendererInstanceSafe(
        newRendererType,
        currentMetadata.container,
        currentMetadata.width,
        currentMetadata.height,
        this.options.rendererOptions[newRendererType]
      );
      
      // Transfer state from old to new renderer
      await this._transferRendererState(currentMetadata.instance, newRenderer);
      
      // Clean up old renderer
      await this._cleanupRenderer(currentMetadata.instance);
      
      // Update metadata
      currentMetadata.instance = newRenderer;
      currentMetadata.type = newRendererType;
      currentMetadata.switchCount += 1;
      currentMetadata.lastSwitchTime = Date.now();
      currentMetadata.lastSwitchReason = reason;
      currentMetadata.capabilities = this._getCapabilitiesSafe(newRendererType);
      
      console.log(`RendererFactory: Successfully switched to ${newRendererType} renderer`);
      
      // Emit switch event
      this._emit('renderer-switched', {
        chartId,
        from: currentMetadata.type,
        to: newRendererType,
        reason,
        switchCount: currentMetadata.switchCount
      });
      
      return true;
      
    } catch (error) {
      console.error(`RendererFactory: Renderer switch failed:`, error);
      
      // Emit failure event
      this._emit('renderer-switch-failed', {
        chartId,
        from: currentMetadata.type,
        to: newRendererType,
        reason,
        error: error.message
      });
      
      return false;
      
    } finally {
      this.switchingQueue.delete(chartId);
    }
  }

  // ===== PERFORMANCE MONITORING =====

  /**
   * Start performance monitoring for a chart
   * @param {string} chartId - Chart identifier
   * @param {Object} chart - Chart instance
   */
  startMonitoring(chartId, chart) {
    if (!this.options.enablePerformanceMonitoring || this.isDestroyed) return;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) {
      console.warn(`RendererFactory: Cannot start monitoring - chart ${chartId} not found`);
      return;
    }
    
    console.log(`RendererFactory: Starting performance monitoring for chart ${chartId}`);
    
    // Start performance monitoring
    this.performanceMonitor.startMonitoring(chart);
    
    // Store chart reference
    metadata.chart = chart;
    metadata.monitoringStarted = Date.now();
    
    this._emit('monitoring-started', { chartId, rendererType: metadata.type });
  }

  /**
   * Stop performance monitoring for a chart
   * @param {string} chartId - Chart identifier
   */
  stopMonitoring(chartId) {
    if (this.isDestroyed) return;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) return;
    
    console.log(`RendererFactory: Stopping performance monitoring for chart ${chartId}`);
    
    this.performanceMonitor.stopMonitoring();
    
    delete metadata.chart;
    delete metadata.monitoringStarted;
    
    this._emit('monitoring-stopped', { chartId });
  }

  /**
   * Get performance analysis for a chart
   * @param {string} chartId - Chart identifier
   * @returns {Object|null} Performance analysis
   */
  getPerformanceAnalysis(chartId) {
    if (this.isDestroyed) return null;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata || !metadata.chart) return null;
    
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Force performance optimization for a chart
   * @param {string} chartId - Chart identifier
   * @returns {Array} Applied optimizations
   */
  optimizePerformance(chartId) {
    if (this.isDestroyed) return [];
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata || !metadata.chart) {
      console.warn(`RendererFactory: Cannot optimize - chart ${chartId} not found or not monitored`);
      return [];
    }
    
    console.log(`RendererFactory: Optimizing performance for chart ${chartId}`);
    
    return this.performanceMonitor.optimizePerformance();
  }

  // ===== CLEANUP AND DESTRUCTION =====

  /**
   * Cleanup renderer for a chart
   * @param {string} chartId - Chart identifier
   */
  async destroyRenderer(chartId) {
    if (this.isDestroyed) return;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) return;
    
    console.log(`RendererFactory: Destroying renderer for chart ${chartId}`);
    
    // Stop monitoring if active
    if (metadata.chart) {
      this.stopMonitoring(chartId);
    }
    
    // Clean up renderer
    await this._cleanupRenderer(metadata.instance);
    
    // Remove from tracking
    this.activeRenderers.delete(chartId);
    this.chartConfigurations.delete(chartId);
    
    this._emit('renderer-destroyed', { chartId, rendererType: metadata.type });
  }

  /**
   * Destroy the entire RendererFactory and clean up all resources
   */
  destroy() {
    if (this.isDestroyed) return;
    
    console.log('RendererFactory: Destroying');
    
    // Clean up all active renderers
    const destroyPromises = Array.from(this.activeRenderers.keys()).map(chartId => 
      this.destroyRenderer(chartId)
    );
    
    Promise.all(destroyPromises).then(() => {
      console.log('RendererFactory: All renderers destroyed');
    });
    
    // Clean up performance monitor event handlers
    this._cleanupPerformanceMonitorEvents();
    
    // Stop performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }
    
    // Clear all maps and references
    this.activeRenderers.clear();
    this.chartConfigurations.clear();
    this.eventListeners.clear();
    this.performanceEventHandlers.clear();
    this.switchingQueue.clear();
    this.rendererClasses.clear();
    
    // Clear object references
    this.capabilityManager = null;
    this.performanceMonitor = null;
    
    this.isDestroyed = true;
    
    console.log('RendererFactory destroyed');
  }

  // ===== INFORMATION AND UTILITIES =====

  /**
   * Get all supported renderer types
   * @returns {Array} Available renderer types
   */
  getSupportedRenderers() {
    if (this.isDestroyed) return [];
    
    return Array.from(this.rendererClasses.keys()).filter(type => {
      return this.capabilityManager.isRendererSupported(type);
    });
  }

  /**
   * Check if renderer type is supported
   * @param {string} rendererType - Renderer type to check
   * @returns {boolean} Support status
   */
  isRendererSupported(rendererType) {
    if (this.isDestroyed) return false;
    
    return this.capabilityManager.isRendererSupported(rendererType);
  }

  /**
   * Get renderer information for a chart
   * @param {string} chartId - Chart identifier
   * @returns {Object|null} Renderer information
   */
  getRendererInfo(chartId) {
    if (this.isDestroyed) return null;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) return null;
    
    return {
      type: metadata.type,
      capabilities: this.capabilityManager.getCapabilities()[metadata.type],
      switchCount: metadata.switchCount,
      createdAt: metadata.createdAt,
      lastSwitchTime: metadata.lastSwitchTime,
      lastSwitchReason: metadata.lastSwitchReason,
      performanceMetrics: metadata.chart ? this.performanceMonitor.getMetrics() : null
    };
  }

  // ===== EVENT HANDLING =====

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  addEventListener(event, callback) {
    if (this.isDestroyed) return;
    
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  removeEventListener(event, callback) {
    if (this.isDestroyed) return;
    
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Safely create renderer instance with proper error handling
   * @private
   */
  async _createRendererInstanceSafe(rendererType, container, width, height, options) {
    const RendererClass = this.rendererClasses.get(rendererType);
    
    if (!RendererClass) {
      throw new Error(`Renderer class for ${rendererType} not found`);
    }
    
    try {
      const renderer = new RendererClass(container, width, height, options);
      await renderer.initialize();
      
      // Validate renderer has required methods
      this._validateRendererInterface(renderer);
      
      return renderer;
    } catch (error) {
      console.error(`Failed to create ${rendererType} renderer:`, error);
      throw error;
    }
  }

  /**
   * Validate that renderer implements required interface
   * @private
   */
  _validateRendererInterface(renderer) {
    const requiredMethods = [
      'initialize', 'destroy', 'clear', 'resize',
      'drawLine', 'drawRect', 'drawCircle', 'drawPath', 'drawText',
      'save', 'restore', 'transform', 'translate'
    ];
    
    const missingMethods = requiredMethods.filter(method => 
      typeof renderer[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      throw new Error(`Renderer missing required methods: ${missingMethods.join(', ')}`);
    }
    
    // Ensure stats object exists and is properly initialized
    if (!renderer.stats || typeof renderer.stats !== 'object') {
      console.warn('Renderer missing stats object, initializing');
      renderer.stats = {
        drawCalls: 0,
        elementsRendered: 0,
        lastFrameTime: 0
      };
    }
    
    // Ensure required properties exist
    const requiredProperties = ['width', 'height', 'container', 'isInitialized'];
    const missingProperties = requiredProperties.filter(prop => 
      renderer[prop] === undefined
    );
    
    if (missingProperties.length > 0) {
      throw new Error(`Renderer missing required properties: ${missingProperties.join(', ')}`);
    }
    
    // Validate that the renderer is properly initialized
    if (!renderer.isInitialized) {
      throw new Error('Renderer claims to be initialized but isInitialized flag is false');
    }
  }

  /**
   * Apply unified VisionCharts-specific renderer selection policy
   * @private
   */
  _applyVisionChartsPolicy(recommendation, chartConfig) {
    const dataPoints = this._countDataPoints(chartConfig);
    const threshold = this.options.performanceOptions.canvasThreshold;
    const svgThreshold = this.options.performanceOptions.svgFallbackThreshold;
    
    // Unified VisionCharts policy: Canvas default, WebGL at 100K+, SVG fallback below 10K
    if (dataPoints >= threshold) {
      // Large dataset: prefer WebGL if available
      if (this.capabilityManager.isRendererSupported('webgl')) {
        return {
          ...recommendation,
          primary: 'webgl',
          fallbacks: ['canvas', 'svg'],
          reason: `Large dataset (${dataPoints} points) - using WebGL for optimal performance`,
          dataPoints
        };
      } else {
        return {
          ...recommendation,
          primary: 'canvas',
          fallbacks: ['svg'],
          reason: `Large dataset (${dataPoints} points) - WebGL not available, using Canvas`,
          dataPoints
        };
      }
    } else if (dataPoints < svgThreshold) {
      // Small dataset: use SVG for crisp rendering
      return {
        ...recommendation,
        primary: 'svg',
        fallbacks: ['canvas'],
        reason: `Small dataset (${dataPoints} points) - using SVG for optimal quality`,
        dataPoints
      };
    } else {
      // Medium dataset: use Canvas as balanced default
      return {
        ...recommendation,
        primary: 'canvas',
        fallbacks: ['svg'],
        reason: `Medium dataset (${dataPoints} points) - using Canvas for balanced performance`,
        dataPoints
      };
    }
  }

  /**
   * Safely get capabilities with fallback
   * @private
   */
  _getCapabilitiesSafe(rendererType) {
    try {
      const allCapabilities = this.capabilityManager.getCapabilities();
      return allCapabilities[rendererType] || {};
    } catch (error) {
      console.warn('Failed to get capabilities, using empty object:', error);
      return {};
    }
  }

  /**
   * Enhanced emergency fallback with better error handling
   * @private
   */
  async _createEmergencyFallback(container, width, height, options) {
    console.log('RendererFactory: Creating emergency fallback renderer (SVG)');
    
    try {
      // Import SvgRenderer if not already available
      if (!this.rendererClasses.has('svg')) {
        const { default: SvgRenderer } = await import('./SvgRenderer.js');
        this.rendererClasses.set('svg', SvgRenderer);
      }
      
      const SvgRenderer = this.rendererClasses.get('svg');
      const renderer = new SvgRenderer(container, width, height, options);
      await renderer.initialize();
      
      // Validate the fallback renderer
      this._validateRendererInterface(renderer);
      
      const chartId = this._generateChartId();
      const metadata = {
        type: 'svg',
        instance: renderer,
        recommendation: { primary: 'svg', reason: 'Emergency fallback' },
        capabilities: this._getCapabilitiesSafe('svg'),
        container,
        width,
        height,
        createdAt: Date.now(),
        switchCount: 0,
        isFallback: true
      };
      
      this.activeRenderers.set(chartId, metadata);
      
      return {
        renderer,
        metadata,
        chartId
      };
      
    } catch (error) {
      console.error('RendererFactory: Even SVG fallback failed:', error);
      throw new Error('Complete renderer system failure');
    }
  }

  /**
   * Transfer state from old renderer to new renderer
   * @private
   */
  async _transferRendererState(oldRenderer, newRenderer) {
    try {
      // Basic state transfer - could be enhanced with more sophisticated state management
      
      // Transfer dimensions
      if (oldRenderer.width && oldRenderer.height) {
        newRenderer.resize(oldRenderer.width, oldRenderer.height);
      }
      
      // Clear new renderer to prepare for content
      newRenderer.clear();
      
      // Transfer clip bounds if any
      if (oldRenderer.currentClipBounds) {
        const bounds = oldRenderer.currentClipBounds;
        newRenderer.setClipBounds(bounds.x, bounds.y, bounds.width, bounds.height);
      }
      
      // Note: In a real implementation, this would transfer:
      // - Current zoom/pan state
      // - Active selections
      // - Animation states
      // - Cached data
      
      console.log('RendererFactory: State transferred between renderers');
      
    } catch (error) {
      console.warn('RendererFactory: State transfer failed:', error);
      // Continue with switch even if state transfer fails
    }
  }

  /**
   * Clean up renderer resources
   * @private
   */
  async _cleanupRenderer(renderer) {
    try {
      if (renderer && typeof renderer.destroy === 'function') {
        renderer.destroy();
      }
    } catch (error) {
      console.warn('RendererFactory: Renderer cleanup failed:', error);
    }
  }

  /**
   * Setup performance monitor event handlers with proper tracking
   * @private
   */
  _setupPerformanceMonitorEvents() {
    // Create handlers and store references for cleanup
    const criticalHandler = (data) => {
      console.warn('RendererFactory: Critical performance detected', data);
      this._handlePerformanceCritical(data);
    };
    
    const recommendationHandler = (data) => {
      console.log('RendererFactory: New renderer recommended', data);
      this._handleRendererRecommendation(data);
    };
    
    // Add event listeners and track them
    this.performanceMonitor.addEventListener('performance-critical', criticalHandler);
    this.performanceMonitor.addEventListener('renderer-recommended', recommendationHandler);
    
    // Store handlers for cleanup
    this.performanceEventHandlers.set('performance-critical', criticalHandler);
    this.performanceEventHandlers.set('renderer-recommended', recommendationHandler);
  }

  /**
   * Clean up performance monitor event handlers
   * @private
   */
  _cleanupPerformanceMonitorEvents() {
    if (!this.performanceMonitor || !this.performanceEventHandlers) return;
    
    // Remove all tracked event handlers
    this.performanceEventHandlers.forEach((handler, event) => {
      try {
        this.performanceMonitor.removeEventListener(event, handler);
      } catch (error) {
        console.warn(`Failed to remove performance monitor event handler for ${event}:`, error);
      }
    });
    
    this.performanceEventHandlers.clear();
  }

  /**
   * Handle critical performance events
   * @private
   */
  _handlePerformanceCritical(data) {
    if (!this.options.enableAutoSwitching || this.isDestroyed) return;
    
    // Find charts experiencing performance issues and trigger renderer switches
    this.activeRenderers.forEach((metadata, chartId) => {
      if (metadata.chart && metadata.type !== 'webgl') {
        // Consider switching to WebGL for better performance
        const config = this.chartConfigurations.get(chartId);
        if (config && this._countDataPoints(config) >= this.options.performanceOptions.canvasThreshold) {
          this.switchRenderer(chartId, 'webgl', 'Performance critical - automatic optimization');
        }
      }
    });
  }

  /**
   * Handle renderer recommendation changes
   * @private
   */
  _handleRendererRecommendation(data) {
    if (!this.options.enableAutoSwitching || this.isDestroyed) return;
    
    // This would trigger automatic renderer switching based on performance analysis
    console.log('RendererFactory: Processing renderer recommendation', data);
    
    if (data.recommendedRenderer && data.chartId) {
      const metadata = this.activeRenderers.get(data.chartId);
      if (metadata && metadata.type !== data.recommendedRenderer) {
        this.switchRenderer(data.chartId, data.recommendedRenderer, 'Performance monitor recommendation');
      }
    }
  }

  /**
   * Count total data points in chart configuration
   * @private
   */
  _countDataPoints(chartConfig) {
    let totalPoints = 0;
    
    if (chartConfig.datasets && Array.isArray(chartConfig.datasets)) {
      chartConfig.datasets.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          totalPoints += dataset.data.length;
        }
      });
    } else if (chartConfig.data && Array.isArray(chartConfig.data)) {
      totalPoints = chartConfig.data.length;
    }
    
    return totalPoints;
  }

  /**
   * Extract required features from chart configuration
   * @private
   */
  _extractFeatures(chartConfig) {
    const features = [];
    
    // Chart type
    if (chartConfig.chartType) {
      features.push(chartConfig.chartType);
    } else {
      features.push('lineChart'); // Default
    }
    
    // Feature flags
    if (chartConfig.showTooltips !== false) features.push('tooltips');
    if (chartConfig.showCrosshair) features.push('crosshair');
    if (chartConfig.showLegend !== false) features.push('legend');
    if (chartConfig.showZeroLine) features.push('zeroLine');
    if (chartConfig.showRecessionLines) features.push('recessionBars');
    if (chartConfig.exportFormats?.includes('svg')) features.push('svgExport');
    if (chartConfig.exportFormats?.some(f => ['png', 'jpeg', 'webp'].includes(f))) features.push('pngExport');
    
    // Performance features
    const dataPoints = this._countDataPoints(chartConfig);
    if (dataPoints > 10000) features.push('largeDataset');
    if (chartConfig.realTimeUpdates) features.push('realTimeUpdates');
    if (chartConfig.enableAnimations !== false) features.push('animations');
    
    return features;
  }

  /**
   * Generate unique chart identifier
   * @private
   */
  _generateChartId() {
    return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit events safely with error handling
   * @private
   */
  _emit(event, data) {
    if (this.isDestroyed) return;
    
    try {
      if (this.eventListeners && this.eventListeners.has(event)) {
        this.eventListeners.get(event).forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error);
          }
        });
      }
    } catch (error) {
      console.error(`Error emitting event ${event}:`, error);
    }
  }
}
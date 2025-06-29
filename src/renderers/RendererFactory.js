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
 * 
 * Emergency fallback systems removed for cleaner error handling.
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
    
    // Core components initialization
    this.capabilityManager = new CapabilityManager();
    
    // Validate CapabilityManager initialization
    if (!this.capabilityManager || typeof this.capabilityManager.getCapabilities !== 'function') {
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
    this.performanceEventHandlers = new Map();
    
    // Switching state
    this.switchingQueue = new Map();
    
    // Initialization state
    this.isDestroyed = false;
    
    // Setup performance monitor event handlers
    this._setupPerformanceMonitorEvents();
    
    console.log('RendererFactory initialized successfully');
  }

  // ===== RENDERER CREATION =====

  /**
   * Create optimal renderer for chart configuration
   * @param {HTMLElement} container - Container element
   * @param {number} width - Chart width
   * @param {number} height - Chart height
   * @param {Object} chartConfig - Chart configuration
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Renderer creation result
   */
  async createRenderer(container, width, height, chartConfig = {}, options = {}) {
    if (this.isDestroyed) {
      throw new Error('RendererFactory has been destroyed');
    }

    console.log('RendererFactory: Creating renderer');

    // Get renderer recommendation
    const recommendation = this._getRendererRecommendation(chartConfig);
    const selectedRenderer = this._selectRenderer(recommendation, chartConfig);
    
    console.log(`RendererFactory: Selected ${selectedRenderer.primary} renderer`, selectedRenderer);

    // Get capabilities for the selected renderer
    const capabilities = this.capabilityManager.getCapabilities()[selectedRenderer.primary] || {};

    // Create renderer instance
    const rendererInstance = await this._createRendererInstanceSafe(
      selectedRenderer.primary,
      container,
      width,
      height,
      { ...this.options.rendererOptions[selectedRenderer.primary], ...options }
    );

    // Generate chart ID and create metadata
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
      console.log(`RendererFactory: Switching chart ${chartId} from ${currentMetadata.type} to ${newRendererType} (${reason})`);
      
      // Create new renderer
      const newRenderer = await this._createRendererInstanceSafe(
        newRendererType,
        currentMetadata.container,
        currentMetadata.width,
        currentMetadata.height,
        this.options.rendererOptions[newRendererType] || {}
      );
      
      // Transfer state from old to new renderer
      await this._transferRendererState(currentMetadata.instance, newRenderer);
      
      // Clean up old renderer
      await this._cleanupRenderer(currentMetadata.instance);
      
      // Update metadata
      const newCapabilities = this.capabilityManager.getCapabilities()[newRendererType] || {};
      currentMetadata.instance = newRenderer;
      currentMetadata.type = newRendererType;
      currentMetadata.capabilities = newCapabilities;
      currentMetadata.switchCount += 1;
      currentMetadata.lastSwitchTime = Date.now();
      currentMetadata.lastSwitchReason = reason;
      
      console.log(`RendererFactory: Successfully switched to ${newRendererType}`);
      
      // Emit switch event
      this._emit('renderer-switched', {
        chartId,
        oldType: currentMetadata.type,
        newType: newRendererType,
        reason
      });
      
      return true;
      
    } catch (error) {
      console.error(`RendererFactory: Failed to switch renderer for chart ${chartId}:`, error);
      return false;
      
    } finally {
      this.switchingQueue.delete(chartId);
    }
  }

  // ===== RECOMMENDATION ENGINE =====

  /**
   * Get renderer recommendation based on chart configuration
   * @private
   */
  _getRendererRecommendation(chartConfig) {
    const dataPoints = this._calculateDataPoints(chartConfig);
    
    // WebGL for very large datasets
    if (dataPoints > this.options.performanceOptions.canvasThreshold) {
      return {
        primary: 'webgl',
        fallbacks: ['canvas', 'svg'],
        reason: `Large dataset (${dataPoints} points) - using WebGL for optimal performance`,
        dataPoints
      };
    }
    
    // SVG for small datasets with high quality requirements
    if (dataPoints < this.options.performanceOptions.svgFallbackThreshold) {
      return {
        primary: 'svg',
        fallbacks: ['canvas'],
        reason: `Small dataset (${dataPoints} points) - using SVG for crisp rendering`,
        dataPoints
      };
    }
    
    // Use Canvas as balanced default
    return {
      primary: 'canvas',
      fallbacks: ['svg'],
      reason: `Medium dataset (${dataPoints} points) - using Canvas for balanced performance`,
      dataPoints
    };
  }

  /**
   * Select final renderer from recommendation
   * @private
   */
  _selectRenderer(recommendation, chartConfig) {
    const supportedRenderers = this.getSupportedRenderers();
    
    // Try primary recommendation
    if (supportedRenderers.includes(recommendation.primary)) {
      return recommendation;
    }
    
    // Try fallbacks
    for (const fallbackType of recommendation.fallbacks) {
      if (supportedRenderers.includes(fallbackType)) {
        return {
          ...recommendation,
          primary: fallbackType,
          reason: `${recommendation.reason} (fallback to ${fallbackType})`
        };
      }
    }
    
    // If no renderers are supported, throw error
    throw new Error(`No supported renderers available. Supported: ${supportedRenderers.join(', ')}`);
  }

  /**
   * Calculate total data points from chart configuration
   * @private
   */
  _calculateDataPoints(chartConfig) {
    if (!chartConfig.datasets || !Array.isArray(chartConfig.datasets)) {
      return 0;
    }
    
    return chartConfig.datasets.reduce((total, dataset) => {
      return total + (dataset.data ? dataset.data.length : 0);
    }, 0);
  }

  // ===== PERFORMANCE MONITORING =====

  /**
   * Start performance monitoring for a chart
   * @param {string} chartId - Chart identifier
   * @param {Object} chart - Chart instance
   */
  startMonitoring(chartId, chart) {
    if (this.isDestroyed) return;
    
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) {
      console.warn(`RendererFactory: Cannot start monitoring - chart ${chartId} not found`);
      return;
    }
    
    console.log(`RendererFactory: Starting performance monitoring for chart ${chartId}`);
    
    this.performanceMonitor.startMonitoring();
    
    // Store chart reference for monitoring
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
    
    const renderer = new RendererClass(container, width, height, options);
    await renderer.initialize();
    
    // Validate renderer has required methods
    this._validateRendererInterface(renderer);
    
    return renderer;
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
      throw new Error('Renderer stats object not properly initialized');
    }
  }

  /**
   * Transfer state from old renderer to new renderer
   * @private
   */
  async _transferRendererState(oldRenderer, newRenderer) {
    try {
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
    this.performanceEventHandlers.forEach((handler, eventType) => {
      this.performanceMonitor.removeEventListener(eventType, handler);
    });
    this.performanceEventHandlers.clear();
  }

  /**
   * Handle critical performance events
   * @private
   */
  _handlePerformanceCritical(data) {
    // Find charts that might benefit from renderer switching
    this.activeRenderers.forEach((metadata, chartId) => {
      if (metadata.chart && metadata.monitoringStarted) {
        console.log(`RendererFactory: Considering renderer switch for chart ${chartId} due to performance`);
        // Could implement automatic switching logic here
      }
    });
  }

  /**
   * Handle renderer recommendations from performance monitor
   * @private
   */
  _handleRendererRecommendation(data) {
    console.log('RendererFactory: Processing renderer recommendation:', data);
    // Could implement automatic switching based on recommendations
  }

  /**
   * Generate unique chart ID
   * @private
   */
  _generateChartId() {
    return `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`RendererFactory: Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}
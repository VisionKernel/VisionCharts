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
    
    // Performance monitoring options
    performanceOptions: {
      canvasThreshold: 100000,
      svgFallbackThreshold: 10000,
      autoOptimizeFeatures: true
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
    
    // Switching state
    this.switchingQueue = new Map(); // Charts pending renderer switch
    
    // Setup performance monitor event handlers
    this._setupPerformanceMonitorEvents();
    
    console.log('RendererFactory initialized successfully');
    
  } catch (error) {
    console.error('RendererFactory initialization failed:', error);
    throw error;
  }
}

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
    
    // Apply VisionCharts policy (Canvas default, WebGL at 100K+)
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
    const rendererMetadata = {
      type: selectedRenderer.primary,
      instance: rendererInstance,
      recommendation: selectedRenderer,
      capabilities: capabilities,
      container,
      width,
      height,
      chartConfig,
      createdAt: Date.now(),
      switchCount: 0
    };
    
    // Store configuration for potential switches
    const chartId = this._generateChartId();
    this.chartConfigurations.set(chartId, {
      container,
      width,
      height,
      chartConfig,
      options
    });
    
    // Register active renderer
    this.activeRenderers.set(chartId, rendererMetadata);
    
    // Start performance monitoring if enabled
    if (this.options.enablePerformanceMonitoring) {
      // Note: monitoring setup would happen here
    }
    
    this._emit('renderer-created', { 
      chartId, 
      rendererType: selectedRenderer.primary,
      metadata: rendererMetadata 
    });
    
    return {
      renderer: rendererInstance,
      metadata: rendererMetadata,
      chartId
    };
    
  } catch (error) {
    console.error('RendererFactory: Failed to create renderer:', error);
    
    // Attempt emergency fallback to SVG
    try {
      return await this._createEmergencyFallback(container, width, height, options);
    } catch (fallbackError) {
      console.error('RendererFactory: Emergency fallback also failed:', fallbackError);
      throw new Error(`Complete renderer system failure: ${error.message}`);
    }
  }
}

  /**
   * Switch renderer for existing chart
   * @param {string} chartId - Chart identifier
   * @param {string} newRendererType - Target renderer type
   * @param {string} reason - Reason for switch
   * @returns {Promise<boolean>} Switch success status
   */
  async switchRenderer(chartId, newRendererType, reason = 'Manual request') {
    const currentMetadata = this.activeRenderers.get(chartId);
    if (!currentMetadata) {
      console.warn(`RendererFactory: No active renderer found for chart ${chartId}`);
      return false;
    }
    
    if (currentMetadata.type === newRendererType) {
      console.log(`RendererFactory: Chart ${chartId} already using ${newRendererType}`);
      return true;
    }
    
    // Check if switch is already in progress
    if (this.switchingQueue.has(chartId)) {
      console.warn(`RendererFactory: Switch already in progress for chart ${chartId}`);
      return false;
    }
    
    this.switchingQueue.set(chartId, {
      from: currentMetadata.type,
      to: newRendererType,
      reason,
      startTime: Date.now()
    });
    
    try {
      console.log(`RendererFactory: Switching chart ${chartId} from ${currentMetadata.type} to ${newRendererType} - ${reason}`);
      
      this._emit('renderer-switch-start', {
        chartId,
        from: currentMetadata.type,
        to: newRendererType,
        reason
      });
      
      // Get chart configuration
      const chartConfig = this.chartConfigurations.get(chartId);
      if (!chartConfig) {
        throw new Error('Chart configuration not found');
      }
      
      // Create new renderer instance
      const newRenderer = await this._createRendererInstance(
        newRendererType,
        currentMetadata.container,
        currentMetadata.width,
        currentMetadata.height,
        this.options.rendererOptions[newRendererType]
      );
      
      // Transfer state from old renderer to new renderer
      await this._transferRendererState(currentMetadata.instance, newRenderer);
      
      // Clean up old renderer
      await this._cleanupRenderer(currentMetadata.instance);
      
      // Update metadata
      const newMetadata = {
        ...currentMetadata,
        type: newRendererType,
        instance: newRenderer,
        switchCount: currentMetadata.switchCount + 1,
        lastSwitchReason: reason,
        lastSwitchTime: Date.now()
      };
      
      this.activeRenderers.set(chartId, newMetadata);
      
      this._emit('renderer-switch-success', {
        chartId,
        from: currentMetadata.type,
        to: newRendererType,
        reason,
        switchTime: Date.now() - this.switchingQueue.get(chartId).startTime
      });
      
      console.log(`RendererFactory: Successfully switched chart ${chartId} to ${newRendererType}`);
      
      return true;
      
    } catch (error) {
      console.error(`RendererFactory: Failed to switch renderer for chart ${chartId}:`, error);
      
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

  /**
   * Start performance monitoring for a chart
   * @param {string} chartId - Chart identifier
   * @param {Object} chart - Chart instance
   */
  startMonitoring(chartId, chart) {
    if (!this.options.enablePerformanceMonitoring) return;
    
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
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata) return;
    
    console.log(`RendererFactory: Stopping performance monitoring for chart ${chartId}`);
    
    this.performanceMonitor.stopMonitoring();
    
    delete metadata.chart;
    delete metadata.monitoringStarted;
    
    this._emit('monitoring-stopped', { chartId });
  }

  /**
   * Get renderer information for a chart
   * @param {string} chartId - Chart identifier
   * @returns {Object|null} Renderer information
   */
  getRendererInfo(chartId) {
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

  /**
   * Get performance analysis for a chart
   * @param {string} chartId - Chart identifier
   * @returns {Object|null} Performance analysis
   */
  getPerformanceAnalysis(chartId) {
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
    const metadata = this.activeRenderers.get(chartId);
    if (!metadata || !metadata.chart) {
      console.warn(`RendererFactory: Cannot optimize - chart ${chartId} not found or not monitored`);
      return [];
    }
    
    console.log(`RendererFactory: Optimizing performance for chart ${chartId}`);
    
    return this.performanceMonitor.optimizePerformance();
  }

  /**
   * Cleanup renderer for a chart
   * @param {string} chartId - Chart identifier
   */
  async destroyRenderer(chartId) {
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
   * Get all supported renderer types
   * @returns {Array} Available renderer types
   */
  getSupportedRenderers() {
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
    return this.capabilityManager.isRendererSupported(rendererType);
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  addEventListener(event, callback) {
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
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  // ===== INTERNAL HELPER METHODS =====

  /**
   * Create renderer instance with fallback handling
   * @private
   */
  async _createRendererInstance(rendererType, container, width, height, options) {
    const RendererClass = this.rendererClasses.get(rendererType);
    if (!RendererClass) {
      throw new Error(`Unknown renderer type: ${rendererType}`);
    }
    
    try {
      const renderer = new RendererClass(container, width, height, options);
      await renderer.initialize();
      return renderer;
      
    } catch (error) {
      console.error(`Failed to create ${rendererType} renderer:`, error);
      
      // Try fallback renderers
      for (const fallbackType of this.options.fallbackChain) {
        if (fallbackType === rendererType) continue;
        
        try {
          console.log(`RendererFactory: Trying fallback renderer: ${fallbackType}`);
          const FallbackClass = this.rendererClasses.get(fallbackType);
          const fallbackRenderer = new FallbackClass(container, width, height, options);
          await fallbackRenderer.initialize();
          
          console.log(`RendererFactory: Successfully created fallback renderer: ${fallbackType}`);
          return fallbackRenderer;
          
        } catch (fallbackError) {
          console.error(`Fallback renderer ${fallbackType} also failed:`, fallbackError);
        }
      }
      
      throw new Error(`All renderer creation attempts failed`);
    }
  }

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
 * Validate that renderer implements required interface
 * @private
 */
_validateRendererInterface(renderer) {
  const requiredMethods = [
    'initialize', 'destroy', 'clear', 'resize',
    'drawLine', 'drawRect', 'drawCircle', 'drawPath', 'drawText'
  ];
  
  const missingMethods = requiredMethods.filter(method => 
    typeof renderer[method] !== 'function'
  );
  
  if (missingMethods.length > 0) {
    throw new Error(`Renderer missing required methods: ${missingMethods.join(', ')}`);
  }
  
  // Ensure stats object exists
  if (!renderer.stats) {
    console.warn('Renderer missing stats object, initializing');
    renderer.stats = {
      drawCalls: 0,
      elementsRendered: 0,
      lastFrameTime: 0
    };
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
   * Create fallback renderer when all else fails
   * @private
   */
  async _createFallbackRenderer(container, width, height, options) {
    console.log('RendererFactory: Creating emergency fallback renderer (SVG)');
    
    try {
      const renderer = new SvgRenderer(container, width, height, options);
      await renderer.initialize();
      
      const chartId = this._generateChartId();
      const metadata = {
        type: 'svg',
        instance: renderer,
        recommendation: { primary: 'svg', reason: 'Emergency fallback' },
        capabilities: this.capabilityManager.getCapabilities().svg,
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
   * Apply VisionCharts-specific renderer selection policy
   * @private
   */
  _applyVisionChartsPolicy(recommendation, chartConfig) {
    const dataPoints = this._countDataPoints(chartConfig);
    
    // VisionCharts policy: Canvas default, WebGL at 100K+
    if (dataPoints >= this.options.performanceOptions.canvasThreshold) {
      // Large dataset: prefer WebGL if available
      if (this.capabilityManager.isRendererSupported('webgl')) {
        return {
          ...recommendation,
          primary: 'webgl',
          fallbacks: ['canvas', 'svg'],
          reason: `Large dataset (${dataPoints} points) - using WebGL for optimal performance`
        };
      } else {
        return {
          ...recommendation,
          primary: 'canvas',
          fallbacks: ['svg'],
          reason: `Large dataset (${dataPoints} points) - WebGL not available, using Canvas`
        };
      }
    } else {
      // Default to Canvas for most use cases
      return {
        ...recommendation,
        primary: 'canvas',
        fallbacks: ['svg'],
        reason: `Dataset (${dataPoints} points) - using Canvas for balanced performance`
      };
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
    
    return features;
  }

  /**
   * Setup performance monitor event handlers
   * @private
   */
  _setupPerformanceMonitorEvents() {
    // Listen for performance monitor events and handle automatic switching
    this.performanceMonitor.addEventListener('performance-critical', (data) => {
      console.warn('RendererFactory: Critical performance detected', data);
      this._handlePerformanceCritical(data);
    });
    
    this.performanceMonitor.addEventListener('renderer-recommended', (data) => {
      console.log('RendererFactory: New renderer recommended', data);
      this._handleRendererRecommendation(data);
    });
  }

  /**
   * Handle critical performance events
   * @private
   */
  _handlePerformanceCritical(data) {
    if (!this.options.enableAutoSwitching) return;
    
    // Find the chart experiencing performance issues
    // This would need integration with the chart instance
    console.log('RendererFactory: Handling critical performance, considering renderer switch');
  }

  /**
   * Handle renderer recommendation changes
   * @private
   */
  _handleRendererRecommendation(data) {
    if (!this.options.enableAutoSwitching) return;
    
    // This would trigger automatic renderer switching based on performance analysis
    console.log('RendererFactory: Processing renderer recommendation', data);
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
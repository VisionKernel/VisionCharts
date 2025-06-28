/**
 * PerformanceMonitor - Dataset Size Detection & Automatic Renderer Switching
 * 
 * Monitors performance metrics, detects dataset sizes, and triggers automatic
 * renderer switching based on thresholds and performance characteristics.
 */
export default class PerformanceMonitor {
  constructor(capabilityManager, options = {}) {
    this.capabilityManager = capabilityManager;
    
    // Configuration
    this.options = {
      // Renderer switching thresholds (as per requirements)
      canvasThreshold: 100000,      // Switch to WebGL at 100K+ points
      svgFallbackThreshold: 10000,  // Fallback to SVG below 10K if needed
      
      // Performance monitoring
      enablePerformanceTracking: true,
      frameRateTarget: 60,
      frameRateWarningThreshold: 30,
      frameRateCriticalThreshold: 15,
      
      // Memory monitoring
      memoryWarningThreshold: 100, // MB
      memoryCriticalThreshold: 200, // MB
      
      // Render time thresholds (ms)
      renderTimeWarning: 100,
      renderTimeCritical: 500,
      
      // Auto-optimization settings
      autoSwitchRenderer: true,
      autoOptimizeFeatures: true,
      autoGracefulDegradation: true,
      
      // Monitoring intervals
      performanceCheckInterval: 1000, // ms
      memoryCheckInterval: 5000, // ms
      
      ...options
    };
    
    // Performance tracking state
    this.metrics = {
      frameRate: 60,
      averageFrameRate: 60,
      renderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      dataPoints: 0,
      elementsRendered: 0,
      drawCalls: 0
    };
    
    // Monitoring state
    this.isMonitoring = false;
    this.performanceHistory = [];
    this.renderingStats = new Map(); // Per-renderer stats
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    
    // Event tracking
    this.listeners = new Map();
    this.monitoringIntervals = [];
    
    // Renderer switching state
    this.currentRenderer = null;
    this.recommendedRenderer = null;
    this.switchingInProgress = false;
    this.switchHistory = [];
    
    // Performance degradation detection
    this.degradationDetector = {
      consecutiveSlowFrames: 0,
      performanceDrops: [],
      stabilityWindow: 10, // frames to consider for stability
      degradationThreshold: 0.3 // 30% performance drop
    };
  }

  /**
   * Start performance monitoring
   * @param {Object} chart - Chart instance to monitor
   */
  startMonitoring(chart) {
    if (this.isMonitoring) {
      this.stopMonitoring();
    }
    
    this.chart = chart;
    this.isMonitoring = true;
    
    console.log('PerformanceMonitor: Started monitoring');
    
    // Initialize metrics
    this._resetMetrics();
    
    // Start monitoring intervals
    this._startPerformanceTracking();
    this._startMemoryMonitoring();
    
    // Hook into chart rendering
    this._instrumentChartRendering();
    
    // Initial dataset analysis
    this._analyzeDataset();
    
    this._emit('monitoring-started', { chart: this.chart });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    // Clear intervals
    this.monitoringIntervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.monitoringIntervals = [];
    
    // Unhook chart instrumentation
    this._uninstrumentChartRendering();
    
    console.log('PerformanceMonitor: Stopped monitoring');
    this._emit('monitoring-stopped', { finalMetrics: this.metrics });
  }

  /**
   * Analyze dataset and recommend optimal renderer
   * @param {Object} chartConfig - Chart configuration
   * @returns {Object} Renderer recommendation
   */
  analyzeAndRecommend(chartConfig) {
    const analysis = this._analyzeChartRequirements(chartConfig);
    const recommendation = this.capabilityManager.selectOptimalRenderer(analysis);
    
    // Apply VisionCharts-specific logic (Canvas default, WebGL at 100K+)
    const finalRecommendation = this._applyVisionChartsPolicy(recommendation, analysis);
    
    this.recommendedRenderer = finalRecommendation.primary;
    
    console.log('PerformanceMonitor: Renderer recommendation:', finalRecommendation);
    
    this._emit('renderer-recommended', {
      recommendation: finalRecommendation,
      analysis
    });
    
    return finalRecommendation;
  }

  /**
   * Force renderer switch if auto-switching is enabled
   * @param {string} rendererType - Target renderer type
   * @param {string} reason - Reason for switch
   * @returns {Promise<boolean>} Success status
   */
  async switchRenderer(rendererType, reason = 'Manual request') {
    if (!this.chart || this.switchingInProgress) {
      return false;
    }
    
    if (this.currentRenderer === rendererType) {
      console.log(`PerformanceMonitor: Already using ${rendererType} renderer`);
      return true;
    }
    
    this.switchingInProgress = true;
    
    try {
      console.log(`PerformanceMonitor: Switching to ${rendererType} renderer - ${reason}`);
      
      const startTime = performance.now();
      
      // Record switch attempt
      const switchRecord = {
        from: this.currentRenderer,
        to: rendererType,
        reason,
        timestamp: Date.now(),
        dataPoints: this.metrics.dataPoints
      };
      
      // Emit switch event
      this._emit('renderer-switch-start', switchRecord);
      
      // Perform the actual switch (this would be handled by RendererFactory)
      const success = await this._performRendererSwitch(rendererType);
      
      const switchTime = performance.now() - startTime;
      
      if (success) {
        this.currentRenderer = rendererType;
        switchRecord.success = true;
        switchRecord.switchTime = switchTime;
        
        console.log(`PerformanceMonitor: Successfully switched to ${rendererType} in ${switchTime.toFixed(2)}ms`);
        
        // Reset performance metrics for new renderer
        this._resetMetrics();
        
        this._emit('renderer-switch-success', switchRecord);
      } else {
        switchRecord.success = false;
        switchRecord.error = 'Switch failed';
        
        console.warn(`PerformanceMonitor: Failed to switch to ${rendererType}`);
        this._emit('renderer-switch-failed', switchRecord);
      }
      
      this.switchHistory.push(switchRecord);
      
      return success;
      
    } finally {
      this.switchingInProgress = false;
    }
  }

  /**
   * Get current performance metrics
   * @returns {Object} Current performance data
   */
  getMetrics() {
    return {
      ...this.metrics,
      currentRenderer: this.currentRenderer,
      recommendedRenderer: this.recommendedRenderer,
      isOptimal: this.currentRenderer === this.recommendedRenderer,
      performanceLevel: this._calculatePerformanceLevel(),
      recommendations: this._generatePerformanceRecommendations()
    };
  }

  /**
   * Get performance history
   * @param {number} limit - Maximum number of history entries
   * @returns {Array} Performance history
   */
  getPerformanceHistory(limit = 100) {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Add event listener for performance events
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Force performance optimization
   */
  optimizePerformance() {
    if (!this.chart) return;
    
    console.log('PerformanceMonitor: Forcing performance optimization');
    
    const optimizations = [];
    
    // Check if renderer switch is beneficial
    if (this.currentRenderer !== this.recommendedRenderer && this.options.autoSwitchRenderer) {
      optimizations.push(`Switch to ${this.recommendedRenderer} renderer`);
      this.switchRenderer(this.recommendedRenderer, 'Performance optimization');
    }
    
    // Apply renderer-specific optimizations
    const rendererOptimizations = this._applyRendererOptimizations();
    optimizations.push(...rendererOptimizations);
    
    // Feature degradation if performance is critical
    if (this.metrics.frameRate < this.options.frameRateCriticalThreshold) {
      const featureOptimizations = this._applyFeatureDegradation();
      optimizations.push(...featureOptimizations);
    }
    
    this._emit('performance-optimized', { optimizations });
    
    return optimizations;
  }

  // ===== INTERNAL MONITORING METHODS =====

  /**
   * Start performance tracking
   * @private
   */
  _startPerformanceTracking() {
    if (!this.options.enablePerformanceTracking) return;
    
    const trackingInterval = setInterval(() => {
      this._updatePerformanceMetrics();
      this._checkPerformanceThresholds();
      this._detectPerformanceDegradation();
    }, this.options.performanceCheckInterval);
    
    this.monitoringIntervals.push(trackingInterval);
  }

  /**
   * Start memory monitoring
   * @private
   */
  _startMemoryMonitoring() {
    if (!performance.memory) return; // Not available in all browsers
    
    const memoryInterval = setInterval(() => {
      this._updateMemoryMetrics();
      this._checkMemoryThresholds();
    }, this.options.memoryCheckInterval);
    
    this.monitoringIntervals.push(memoryInterval);
  }

  /**
   * Update performance metrics
   * @private
   */
  _updatePerformanceMetrics() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    if (deltaTime > 0) {
      const currentFrameRate = 1000 / deltaTime;
      this.metrics.frameRate = currentFrameRate;
      
      // Calculate rolling average
      this.metrics.averageFrameRate = this._updateAverage(
        this.metrics.averageFrameRate,
        currentFrameRate,
        this.frameCount,
        30 // 30-frame window
      );
    }
    
    this.lastFrameTime = currentTime;
    this.frameCount++;
    
    // Record history entry every 10 frames
    if (this.frameCount % 10 === 0) {
      this.performanceHistory.push({
        timestamp: currentTime,
        frameRate: this.metrics.frameRate,
        renderTime: this.metrics.renderTime,
        memoryUsage: this.metrics.memoryUsage,
        dataPoints: this.metrics.dataPoints
      });
      
      // Limit history size
      if (this.performanceHistory.length > 1000) {
        this.performanceHistory = this.performanceHistory.slice(-500);
      }
    }
  }

  /**
   * Update memory metrics
   * @private
   */
  _updateMemoryMetrics() {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / (1024 * 1024); // MB
    }
  }

  /**
   * Check performance thresholds and trigger warnings
   * @private
   */
  _checkPerformanceThresholds() {
    const { frameRate } = this.metrics;
    
    if (frameRate < this.options.frameRateCriticalThreshold) {
      this._emit('performance-critical', {
        frameRate,
        threshold: this.options.frameRateCriticalThreshold,
        severity: 'critical'
      });
      
      if (this.options.autoOptimizeFeatures) {
        this.optimizePerformance();
      }
    } else if (frameRate < this.options.frameRateWarningThreshold) {
      this._emit('performance-warning', {
        frameRate,
        threshold: this.options.frameRateWarningThreshold,
        severity: 'warning'
      });
    }
  }

  /**
   * Check memory thresholds
   * @private
   */
  _checkMemoryThresholds() {
    const { memoryUsage } = this.metrics;
    
    if (memoryUsage > this.options.memoryCriticalThreshold) {
      this._emit('memory-critical', {
        memoryUsage,
        threshold: this.options.memoryCriticalThreshold,
        severity: 'critical'
      });
    } else if (memoryUsage > this.options.memoryWarningThreshold) {
      this._emit('memory-warning', {
        memoryUsage,
        threshold: this.options.memoryWarningThreshold,
        severity: 'warning'
      });
    }
  }

  /**
   * Detect performance degradation patterns
   * @private
   */
  _detectPerformanceDegradation() {
    const { frameRate, averageFrameRate } = this.metrics;
    const degradationThreshold = averageFrameRate * this.degradationDetector.degradationThreshold;
    
    if (frameRate < (averageFrameRate - degradationThreshold)) {
      this.degradationDetector.consecutiveSlowFrames++;
      
      if (this.degradationDetector.consecutiveSlowFrames >= this.degradationDetector.stabilityWindow) {
        this._emit('performance-degradation', {
          currentFrameRate: frameRate,
          averageFrameRate,
          degradationPercent: ((averageFrameRate - frameRate) / averageFrameRate) * 100,
          consecutiveSlowFrames: this.degradationDetector.consecutiveSlowFrames
        });
        
        this.degradationDetector.consecutiveSlowFrames = 0; // Reset to avoid spam
      }
    } else {
      this.degradationDetector.consecutiveSlowFrames = 0;
    }
  }

  /**
   * Instrument chart rendering to capture metrics
   * @private
   */
  _instrumentChartRendering() {
    if (!this.chart || !this.chart.renderer) return;
    
    const originalRender = this.chart.render.bind(this.chart);
    
    this.chart.render = (...args) => {
      const startTime = performance.now();
      
      const result = originalRender(...args);
      
      const renderTime = performance.now() - startTime;
      this.metrics.renderTime = renderTime;
      this.metrics.averageRenderTime = this._updateAverage(
        this.metrics.averageRenderTime,
        renderTime,
        this.frameCount,
        10
      );
      
      // Update renderer stats
      if (this.chart.renderer) {
        const stats = this.chart.renderer.getPerformanceStats();
        this.metrics.drawCalls = stats.drawCalls;
        this.metrics.elementsRendered = stats.elementsRendered;
      }
      
      return result;
    };
  }

  /**
   * Remove chart rendering instrumentation
   * @private
   */
  _uninstrumentChartRendering() {
    // This would need to restore the original render method
    // Implementation depends on how we store the original method
  }

  /**
   * Analyze current dataset
   * @private
   */
  _analyzeDataset() {
    if (!this.chart || !this.chart.config) return;
    
    let totalDataPoints = 0;
    
    // Count data points across all datasets
    if (this.chart.config.datasets) {
      this.chart.config.datasets.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          totalDataPoints += dataset.data.length;
        }
      });
    }
    
    this.metrics.dataPoints = totalDataPoints;
    
    console.log(`PerformanceMonitor: Analyzed dataset - ${totalDataPoints} total data points`);
    
    // Check if current renderer is still optimal
    this._checkRendererOptimality();
  }

  /**
   * Analyze chart requirements for renderer selection
   * @private
   */
  _analyzeChartRequirements(chartConfig) {
    const features = ['lineChart']; // Default feature set
    const exportFormats = [];
    
    // Analyze chart type
    if (chartConfig.chartType) {
      features.push(chartConfig.chartType);
    }
    
    // Analyze enabled features
    if (chartConfig.showTooltips !== false) features.push('tooltips');
    if (chartConfig.showCrosshair) features.push('crosshair');
    if (chartConfig.showLegend !== false) features.push('legend');
    if (chartConfig.showZeroLine) features.push('zeroLine');
    if (chartConfig.showRecessionLines) features.push('recessionBars');
    
    // Analyze data size
    let dataPoints = 0;
    if (chartConfig.datasets) {
      chartConfig.datasets.forEach(dataset => {
        if (dataset.data) dataPoints += dataset.data.length;
      });
    }
    
    // Analyze export requirements
    if (chartConfig.exportFormats) {
      exportFormats.push(...chartConfig.exportFormats);
    }
    
    return {
      dataPoints,
      features,
      exportFormats,
      prioritizePerformance: dataPoints > this.options.canvasThreshold,
      prioritizeQuality: dataPoints < this.options.svgFallbackThreshold,
      deviceConstraints: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    };
  }

  /**
   * Apply VisionCharts-specific renderer selection policy
   * @private
   */
  _applyVisionChartsPolicy(recommendation, analysis) {
    const { dataPoints } = analysis;
    
    // VisionCharts policy: Canvas default, WebGL at 100K+
    if (dataPoints >= this.options.canvasThreshold) {
      // Large dataset: prefer WebGL if available, fallback to Canvas
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
      // Medium dataset: use Canvas as default
      return {
        ...recommendation,
        primary: 'canvas',
        fallbacks: ['svg'],
        reason: `Medium dataset (${dataPoints} points) - using Canvas for balanced performance`
      };
    }
  }

  /**
   * Check if current renderer is still optimal
   * @private
   */
  _checkRendererOptimality() {
    if (!this.currentRenderer) return;
    
    const analysis = this.capabilityManager.getPerformanceAnalysis(
      this.currentRenderer,
      this.metrics.dataPoints
    );
    
    if (analysis && analysis.performance === 'inadequate') {
      console.warn('PerformanceMonitor: Current renderer inadequate for dataset size');
      
      if (this.options.autoSwitchRenderer) {
        // Trigger automatic switch
        const newRecommendation = this.analyzeAndRecommend(this.chart.config);
        if (newRecommendation.primary !== this.currentRenderer) {
          this.switchRenderer(newRecommendation.primary, 'Dataset size exceeded capacity');
        }
      }
    }
  }

  /**
   * Perform the actual renderer switch
   * @private
   */
  async _performRendererSwitch(rendererType) {
    // This would integrate with RendererFactory to perform the actual switch
    // For now, return success (implementation depends on how chart manages renderers)
    
    try {
      // Simulate switch operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // In real implementation, this would:
      // 1. Create new renderer instance
      // 2. Transfer state from old renderer
      // 3. Update chart to use new renderer
      // 4. Cleanup old renderer
      
      return true;
    } catch (error) {
      console.error('Renderer switch failed:', error);
      return false;
    }
  }

  /**
   * Apply renderer-specific optimizations
   * @private
   */
  _applyRendererOptimizations() {
    if (!this.chart || !this.chart.renderer) return [];
    
    const optimizations = this.capabilityManager.getAdaptationStrategies(
      this.currentRenderer,
      ['lineChart', 'tooltips', 'legend']
    ).performanceOptimizations;
    
    // Apply optimizations to renderer
    if (this.chart.renderer.optimizeForDataSize) {
      this.chart.renderer.optimizeForDataSize(this.metrics.dataPoints);
    }
    
    return optimizations;
  }

  /**
   * Apply feature degradation for critical performance
   * @private
   */
  _applyFeatureDegradation() {
    const degradations = [];
    
    if (this.options.autoGracefulDegradation) {
      // Disable expensive features
      if (this.chart.options.showAnimations) {
        this.chart.options.showAnimations = false;
        degradations.push('Disabled animations');
      }
      
      if (this.chart.options.showTooltips) {
        this.chart.options.showTooltips = false;
        degradations.push('Disabled tooltips');
      }
      
      // Reduce visual quality
      degradations.push('Reduced visual quality for performance');
    }
    
    return degradations;
  }

  /**
   * Calculate overall performance level
   * @private
   */
  _calculatePerformanceLevel() {
    const { frameRate, renderTime, memoryUsage } = this.metrics;
    
    let score = 100;
    
    // Frame rate impact
    if (frameRate < this.options.frameRateCriticalThreshold) {
      score -= 50;
    } else if (frameRate < this.options.frameRateWarningThreshold) {
      score -= 25;
    }
    
    // Render time impact
    if (renderTime > this.options.renderTimeCritical) {
      score -= 30;
    } else if (renderTime > this.options.renderTimeWarning) {
      score -= 15;
    }
    
    // Memory impact
    if (memoryUsage > this.options.memoryCriticalThreshold) {
      score -= 20;
    } else if (memoryUsage > this.options.memoryWarningThreshold) {
      score -= 10;
    }
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'critical';
  }

  /**
   * Generate performance recommendations
   * @private
   */
  _generatePerformanceRecommendations() {
    const recommendations = [];
    const { frameRate, renderTime, memoryUsage, dataPoints } = this.metrics;
    
    if (this.currentRenderer !== this.recommendedRenderer) {
      recommendations.push(`Switch to ${this.recommendedRenderer} renderer for better performance`);
    }
    
    if (frameRate < this.options.frameRateWarningThreshold) {
      recommendations.push('Consider reducing dataset size or visual complexity');
    }
    
    if (renderTime > this.options.renderTimeWarning) {
      recommendations.push('Enable batch rendering for better performance');
    }
    
    if (memoryUsage > this.options.memoryWarningThreshold) {
      recommendations.push('Optimize memory usage by limiting data retention');
    }
    
    if (dataPoints > this.options.canvasThreshold && this.currentRenderer !== 'webgl') {
      recommendations.push('Large dataset detected - WebGL renderer recommended');
    }
    
    return recommendations;
  }

  /**
   * Calculate rolling average
   * @private
   */
  _updateAverage(currentAverage, newValue, count, windowSize) {
    const effectiveCount = Math.min(count, windowSize);
    return (currentAverage * (effectiveCount - 1) + newValue) / effectiveCount;
  }

  /**
   * Reset performance metrics
   * @private
   */
  _resetMetrics() {
    this.metrics = {
      frameRate: 60,
      averageFrameRate: 60,
      renderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      dataPoints: this.metrics.dataPoints || 0, // Preserve data points
      elementsRendered: 0,
      drawCalls: 0
    };
    
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
}
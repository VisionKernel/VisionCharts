/**
 * CapabilityManager - Feature/Renderer Capability Matrix
 * 
 * Manages which features work with which renderers, handles feature adaptation,
 * and provides intelligent renderer selection based on requirements.
 */
export default class CapabilityManager {
  constructor() {
    // Define renderer capabilities matrix
    this.rendererCapabilities = {
      svg: {
        // Core rendering capabilities
        drawLine: { supported: true, quality: 'excellent', performance: 'good' },
        drawRect: { supported: true, quality: 'excellent', performance: 'good' },
        drawCircle: { supported: true, quality: 'excellent', performance: 'good' },
        drawPath: { supported: true, quality: 'excellent', performance: 'good' },
        drawText: { supported: true, quality: 'excellent', performance: 'excellent' },
        
        // Advanced features
        gradients: { supported: true, quality: 'excellent', performance: 'good' },
        clipping: { supported: true, quality: 'excellent', performance: 'good' },
        transforms: { supported: true, quality: 'excellent', performance: 'good' },
        animations: { supported: true, quality: 'excellent', performance: 'fair' },
        interactivity: { supported: true, quality: 'excellent', performance: 'excellent' },
        textMetrics: { supported: true, quality: 'excellent', performance: 'excellent' },
        
        // Batch operations
        batchRendering: { supported: true, quality: 'good', performance: 'fair' },
        dynamicUpdates: { supported: true, quality: 'excellent', performance: 'fair' },
        
        // Export capabilities
        vectorExport: { supported: true, quality: 'excellent', performance: 'excellent' },
        rasterExport: { supported: true, quality: 'good', performance: 'fair' },
        
        // Performance characteristics
        maxDataPoints: 10000,
        optimalDataPoints: 5000,
        memoryUsage: 'high', // DOM overhead
        startupTime: 'fast',
        renderingSpeed: 'good'
      },
      
      canvas: {
        // Core rendering capabilities
        drawLine: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawRect: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawCircle: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawPath: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawText: { supported: true, quality: 'good', performance: 'good' },
        
        // Advanced features
        gradients: { supported: true, quality: 'excellent', performance: 'excellent' },
        clipping: { supported: true, quality: 'excellent', performance: 'excellent' },
        transforms: { supported: true, quality: 'excellent', performance: 'excellent' },
        animations: { supported: true, quality: 'good', performance: 'excellent' },
        interactivity: { supported: true, quality: 'good', performance: 'good' },
        textMetrics: { supported: true, quality: 'good', performance: 'excellent' },
        
        // Batch operations
        batchRendering: { supported: true, quality: 'excellent', performance: 'excellent' },
        dynamicUpdates: { supported: true, quality: 'excellent', performance: 'excellent' },
        
        // Export capabilities
        vectorExport: { supported: false, quality: 'none', performance: 'none' },
        rasterExport: { supported: true, quality: 'excellent', performance: 'excellent' },
        
        // Performance characteristics
        maxDataPoints: 100000,
        optimalDataPoints: 50000,
        memoryUsage: 'medium',
        startupTime: 'fast',
        renderingSpeed: 'excellent'
      },
      
      webgl: {
        // Core rendering capabilities
        drawLine: { supported: true, quality: 'excellent', performance: 'outstanding' },
        drawRect: { supported: true, quality: 'good', performance: 'outstanding' },
        drawCircle: { supported: true, quality: 'good', performance: 'outstanding' },
        drawPath: { supported: true, quality: 'fair', performance: 'outstanding' },
        drawText: { supported: true, quality: 'fair', performance: 'good' },
        
        // Advanced features
        gradients: { supported: true, quality: 'excellent', performance: 'outstanding' },
        clipping: { supported: true, quality: 'good', performance: 'excellent' },
        transforms: { supported: true, quality: 'excellent', performance: 'outstanding' },
        animations: { supported: true, quality: 'excellent', performance: 'outstanding' },
        interactivity: { supported: true, quality: 'fair', performance: 'excellent' },
        textMetrics: { supported: false, quality: 'none', performance: 'none' },
        
        // Batch operations
        batchRendering: { supported: true, quality: 'outstanding', performance: 'outstanding' },
        dynamicUpdates: { supported: true, quality: 'outstanding', performance: 'outstanding' },
        
        // Export capabilities
        vectorExport: { supported: false, quality: 'none', performance: 'none' },
        rasterExport: { supported: true, quality: 'excellent', performance: 'good' },
        
        // Performance characteristics
        maxDataPoints: 1000000,
        optimalDataPoints: 500000,
        memoryUsage: 'low',
        startupTime: 'slow',
        renderingSpeed: 'outstanding'
      }
    };
    
    // Feature requirements mapping
    this.featureRequirements = {
      // Basic chart types
      lineChart: {
        required: ['drawLine', 'drawPath'],
        preferred: ['gradients', 'transforms'],
        optional: ['animations', 'interactivity']
      },
      
      barChart: {
        required: ['drawRect'],
        preferred: ['gradients', 'animations'],
        optional: ['interactivity']
      },
      
      scatterPlot: {
        required: ['drawCircle'],
        preferred: ['batchRendering'],
        optional: ['interactivity', 'animations']
      },
      
      // Advanced features
      animations: {
        required: ['animations'],
        preferred: ['transforms'],
        optional: []
      },
      
      interactivity: {
        required: ['interactivity'],
        preferred: ['textMetrics'],
        optional: []
      },
      
      // Export requirements
      pngExport: {
        required: ['rasterExport'],
        preferred: [],
        optional: []
      },
      
      svgExport: {
        required: ['vectorExport'],
        preferred: [],
        optional: []
      },
      
      // Performance requirements
      largeDataset: {
        required: ['batchRendering'],
        preferred: ['dynamicUpdates'],
        optional: ['animations']
      },
      
      realTimeUpdates: {
        required: ['dynamicUpdates'],
        preferred: ['batchRendering'],
        optional: []
      }
    };
    
    // Quality scoring weights
    this.qualityWeights = {
      excellent: 5,
      outstanding: 6,
      good: 4,
      fair: 2,
      poor: 1,
      none: 0
    };
    
    // Performance scoring weights
    this.performanceWeights = {
      outstanding: 6,
      excellent: 5,
      good: 4,
      fair: 2,
      poor: 1,
      none: 0
    };
  }

  /**
   * Get the complete capabilities matrix for all renderers
   * @returns {Object} Complete capabilities matrix
   */
  getCapabilities() {
    return this.rendererCapabilities;
  }

  /**
   * Get capabilities for a specific renderer
   * @param {string} rendererType - Renderer type ('svg', 'canvas', 'webgl')
   * @returns {Object} Renderer capabilities
   */
  getRendererCapabilities(rendererType) {
    return this.rendererCapabilities[rendererType] || null;
  }

  /**
   * Check if a renderer supports a specific capability
   * @param {string} rendererType - Renderer type ('svg', 'canvas', 'webgl')
   * @param {string} capability - Capability to check
   * @returns {boolean} Whether the capability is supported
   */
  supportsCapability(rendererType, capability) {
    const renderer = this.rendererCapabilities[rendererType];
    if (!renderer) return false;
    
    const cap = renderer[capability];
    return cap && cap.supported;
  }

  /**
   * Get capability quality for a renderer
   * @param {string} rendererType - Renderer type
   * @param {string} capability - Capability to check
   * @returns {string} Quality level
   */
  getCapabilityQuality(rendererType, capability) {
    const renderer = this.rendererCapabilities[rendererType];
    if (!renderer) return 'none';
    
    const cap = renderer[capability];
    return cap ? cap.quality : 'none';
  }

  /**
   * Get capability performance for a renderer
   * @param {string} rendererType - Renderer type
   * @param {string} capability - Capability to check
   * @returns {string} Performance level
   */
  getCapabilityPerformance(rendererType, capability) {
    const renderer = this.rendererCapabilities[rendererType];
    if (!renderer) return 'none';
    
    const cap = renderer[capability];
    return cap ? cap.performance : 'none';
  }

  /**
   * Check if renderer can handle the required features for a chart configuration
   * @param {string} rendererType - Renderer type
   * @param {Array} requiredFeatures - Array of required feature names
   * @returns {Object} Compatibility analysis
   */
  checkFeatureCompatibility(rendererType, requiredFeatures) {
    const results = {
      compatible: true,
      score: 0,
      missingFeatures: [],
      warnings: [],
      adaptations: []
    };
    
    requiredFeatures.forEach(featureName => {
      const feature = this.featureRequirements[featureName];
      if (!feature) {
        results.warnings.push(`Unknown feature: ${featureName}`);
        return;
      }
      
      // Check required capabilities
      feature.required.forEach(capability => {
        if (!this.supportsCapability(rendererType, capability)) {
          results.compatible = false;
          results.missingFeatures.push(capability);
        } else {
          const quality = this.getCapabilityQuality(rendererType, capability);
          const performance = this.getCapabilityPerformance(rendererType, capability);
          results.score += this.qualityWeights[quality] + this.performanceWeights[performance];
        }
      });
      
      // Check preferred capabilities
      feature.preferred.forEach(capability => {
        if (this.supportsCapability(rendererType, capability)) {
          const quality = this.getCapabilityQuality(rendererType, capability);
          const performance = this.getCapabilityPerformance(rendererType, capability);
          results.score += (this.qualityWeights[quality] + this.performanceWeights[performance]) * 0.5;
        } else {
          results.adaptations.push(`${capability} not available, feature may be limited`);
        }
      });
      
      // Optional capabilities just add to score if available
      feature.optional.forEach(capability => {
        if (this.supportsCapability(rendererType, capability)) {
          const quality = this.getCapabilityQuality(rendererType, capability);
          const performance = this.getCapabilityPerformance(rendererType, capability);
          results.score += (this.qualityWeights[quality] + this.performanceWeights[performance]) * 0.2;
        }
      });
    });
    
    return results;
  }

  /**
   * Select the best renderer for given requirements
   * @param {Object} requirements - Chart requirements
   * @returns {Object} Renderer selection recommendation
   */
  selectOptimalRenderer(requirements) {
    const {
      dataPoints = 1000,
      features = [],
      exportFormats = [],
      prioritizePerformance = false,
      prioritizeQuality = false,
      deviceConstraints = {}
    } = requirements;
    
    const candidates = ['svg', 'canvas', 'webgl'];
    const scores = {};
    
    candidates.forEach(rendererType => {
      scores[rendererType] = this._calculateRendererScore(
        rendererType,
        dataPoints,
        features,
        exportFormats,
        prioritizePerformance,
        prioritizeQuality,
        deviceConstraints
      );
    });
    
    // Sort by total score
    const sortedCandidates = candidates
      .map(type => ({ type, ...scores[type] }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .filter(candidate => candidate.viable);
    
    if (sortedCandidates.length === 0) {
      // Fallback to SVG if nothing else works
      return {
        primary: 'svg',
        fallbacks: ['canvas'],
        reason: 'No viable renderers found, falling back to SVG',
        warnings: ['Feature compatibility issues may occur']
      };
    }
    
    const primary = sortedCandidates[0];
    const fallbacks = sortedCandidates.slice(1).map(c => c.type);
    
    return {
      primary: primary.type,
      fallbacks,
      reason: primary.reason,
      confidence: primary.confidence,
      expectedPerformance: primary.performanceLevel,
      warnings: primary.warnings,
      adaptations: primary.adaptations
    };
  }

  /**
   * Check if device/browser supports renderer
   * @param {string} rendererType - Renderer to check
   * @param {Object} deviceInfo - Device/browser information
   * @returns {boolean} Whether renderer is supported
   */
  isRendererSupported(rendererType, deviceInfo = {}) {
    const {
      userAgent = navigator.userAgent,
      platform = navigator.platform,
      webglSupported = this._checkWebGLSupport()
    } = deviceInfo;
    
    switch (rendererType) {
      case 'svg':
        // SVG is supported virtually everywhere
        return true;
        
      case 'canvas':
        // Canvas is supported in all modern browsers
        return typeof HTMLCanvasElement !== 'undefined';
        
      case 'webgl':
        return webglSupported && !this._isMobileDevice(userAgent);
        
      default:
        return false;
    }
  }

  /**
   * Get performance characteristics for data size
   * @param {string} rendererType - Renderer type
   * @param {number} dataPoints - Number of data points
   * @returns {Object} Performance analysis
   */
  getPerformanceAnalysis(rendererType, dataPoints) {
    const renderer = this.rendererCapabilities[rendererType];
    if (!renderer) return null;
    
    const optimal = renderer.optimalDataPoints;
    const maximum = renderer.maxDataPoints;
    
    let performance, recommendation;
    
    if (dataPoints <= optimal) {
      performance = 'excellent';
      recommendation = 'Optimal performance expected';
    } else if (dataPoints <= maximum) {
      const ratio = dataPoints / optimal;
      if (ratio <= 2) {
        performance = 'good';
        recommendation = 'Good performance expected';
      } else if (ratio <= 5) {
        performance = 'fair';
        recommendation = 'Performance may be slower, consider optimizations';
      } else {
        performance = 'poor';
        recommendation = 'Performance will be significantly impacted';
      }
    } else {
      performance = 'inadequate';
      recommendation = `Exceeds maximum capacity (${maximum} points), use different renderer`;
    }
    
    return {
      performance,
      recommendation,
      optimalPoints: optimal,
      maxPoints: maximum,
      currentPoints: dataPoints,
      efficiency: Math.min(100, (optimal / dataPoints) * 100),
      memoryUsage: renderer.memoryUsage,
      startupTime: renderer.startupTime,
      renderingSpeed: renderer.renderingSpeed
    };
  }

  // ===== INTERNAL HELPER METHODS =====

  /**
   * Calculate comprehensive renderer score
   * @private
   */
  _calculateRendererScore(rendererType, dataPoints, features, exportFormats, 
                         prioritizePerformance, prioritizeQuality, deviceConstraints) {
    const renderer = this.rendererCapabilities[rendererType];
    let score = 0;
    let viable = true;
    const warnings = [];
    const adaptations = [];
    
    // Data size fitness score
    const dataFitness = this._calculateDataFitness(renderer, dataPoints);
    score += dataFitness.score;
    if (!dataFitness.viable) viable = false;
    warnings.push(...dataFitness.warnings);
    
    // Feature compatibility score
    const featureCompatibility = this.checkFeatureCompatibility(rendererType, features);
    score += featureCompatibility.score;
    if (!featureCompatibility.compatible) viable = false;
    warnings.push(...featureCompatibility.warnings);
    adaptations.push(...featureCompatibility.adaptations);
    
    // Export format compatibility
    const exportScore = this._calculateExportScore(rendererType, exportFormats);
    score += exportScore;
    
    // Device/browser compatibility
    if (!this.isRendererSupported(rendererType, deviceConstraints)) {
      viable = false;
      warnings.push(`${rendererType} renderer not supported on this device/browser`);
    }
    
    // Calculate final metrics
    const confidence = viable ? Math.min(100, (score / 50) * 100) : 0;
    const performanceLevel = this._determinePerformanceLevel(score);
    
    return {
      totalScore: score,
      viable,
      confidence,
      performanceLevel,
      warnings,
      adaptations,
      reason: this._generateReasonString(rendererType, dataPoints, features)
    };
  }

  /**
   * Calculate data size fitness score
   * @private
   */
  _calculateDataFitness(renderer, dataPoints) {
    const optimal = renderer.optimalDataPoints;
    const maximum = renderer.maxDataPoints;
    
    if (dataPoints > maximum) {
      return {
        score: 0,
        viable: false,
        warnings: [`Data size (${dataPoints}) exceeds maximum capacity (${maximum})`]
      };
    }
    
    const ratio = dataPoints / optimal;
    let score;
    
    if (ratio <= 1) {
      score = 20; // Perfect fit
    } else if (ratio <= 2) {
      score = 15; // Good fit
    } else if (ratio <= 5) {
      score = 10; // Acceptable
    } else {
      score = 5; // Poor fit
    }
    
    return {
      score,
      viable: true,
      warnings: ratio > 2 ? [`Performance may be impacted by large dataset (${dataPoints} points)`] : []
    };
  }

  /**
   * Calculate export format compatibility score
   * @private
   */
  _calculateExportScore(rendererType, exportFormats) {
    let score = 0;
    
    exportFormats.forEach(format => {
      if (format === 'svg' && this.supportsCapability(rendererType, 'vectorExport')) {
        score += 5;
      } else if (format === 'png' && this.supportsCapability(rendererType, 'rasterExport')) {
        score += 5;
      }
    });
    
    return score;
  }

  /**
   * Determine performance level from score
   * @private
   */
  _determinePerformanceLevel(score) {
    if (score >= 40) return 'excellent';
    if (score >= 30) return 'good';
    if (score >= 20) return 'fair';
    if (score >= 10) return 'poor';
    return 'inadequate';
  }

  /**
   * Generate reason string for renderer selection
   * @private
   */
  _generateReasonString(rendererType, dataPoints, features) {
    const reasons = [];
    
    if (dataPoints <= 1000) {
      reasons.push('small dataset');
    } else if (dataPoints <= 10000) {
      reasons.push('medium dataset');
    } else {
      reasons.push('large dataset');
    }
    
    if (features.includes('interactivity')) {
      reasons.push('interactive features');
    }
    
    if (features.includes('animations')) {
      reasons.push('animations required');
    }
    
    return `${rendererType.toUpperCase()} selected for ${reasons.join(', ')}`;
  }

  /**
   * Check WebGL support
   * @private
   */
  _checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
               (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if device is mobile
   * @private
   */
  _isMobileDevice(userAgent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  }
}
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
        renderingSpeed: 'good',
        
        // Platform support
        browserSupport: 'universal',
        mobilePerformance: 'good',
        retinaSuppport: 'excellent'
      },
      
      canvas: {
        // Core rendering capabilities
        drawLine: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawRect: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawCircle: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawPath: { supported: true, quality: 'excellent', performance: 'excellent' },
        drawText: { supported: true, quality: 'good', performance: 'good' },
        
        // Advanced features
        gradients: { supported: true, quality: 'excellent', performance: 'good' },
        clipping: { supported: true, quality: 'excellent', performance: 'excellent' },
        transforms: { supported: true, quality: 'excellent', performance: 'excellent' },
        animations: { supported: true, quality: 'good', performance: 'excellent' },
        interactivity: { supported: true, quality: 'good', performance: 'good' },
        textMetrics: { supported: true, quality: 'good', performance: 'good' },
        
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
        renderingSpeed: 'excellent',
        
        // Platform support
        browserSupport: 'universal',
        mobilePerformance: 'excellent',
        retinaSuppport: 'excellent'
      },
      
      webgl: {
        // Core rendering capabilities
        drawLine: { supported: true, quality: 'excellent', performance: 'outstanding' },
        drawRect: { supported: true, quality: 'excellent', performance: 'outstanding' },
        drawCircle: { supported: true, quality: 'excellent', performance: 'outstanding' },
        drawPath: { supported: true, quality: 'good', performance: 'outstanding' },
        drawText: { supported: true, quality: 'fair', performance: 'good' }, // Canvas overlay
        
        // Advanced features
        gradients: { supported: false, quality: 'none', performance: 'none' }, // Not yet implemented
        clipping: { supported: true, quality: 'excellent', performance: 'excellent' },
        transforms: { supported: true, quality: 'excellent', performance: 'excellent' },
        animations: { supported: true, quality: 'excellent', performance: 'outstanding' },
        interactivity: { supported: true, quality: 'fair', performance: 'good' }, // Limited hit testing
        textMetrics: { supported: false, quality: 'fair', performance: 'fair' }, // Limited by overlay
        
        // Batch operations
        batchRendering: { supported: true, quality: 'outstanding', performance: 'outstanding' },
        dynamicUpdates: { supported: true, quality: 'excellent', performance: 'outstanding' },
        
        // Export capabilities
        vectorExport: { supported: false, quality: 'none', performance: 'none' },
        rasterExport: { supported: true, quality: 'excellent', performance: 'excellent' },
        
        // Performance characteristics
        maxDataPoints: 10000000,
        optimalDataPoints: 1000000,
        memoryUsage: 'low', // GPU memory
        startupTime: 'medium', // Shader compilation
        renderingSpeed: 'outstanding',
        
        // Platform support
        browserSupport: 'good', // Not supported on older browsers/devices
        mobilePerformance: 'variable', // Depends on GPU
        retinaSuppport: 'excellent'
      }
    };
    
    // Feature requirement definitions
    this.featureRequirements = {
      // Chart types
      lineChart: {
        required: ['drawLine', 'drawPath'],
        preferred: ['batchRendering', 'animations'],
        optional: ['gradients', 'textMetrics']
      },
      
      barChart: {
        required: ['drawRect'],
        preferred: ['gradients', 'batchRendering'],
        optional: ['animations', 'textMetrics']
      },
      
      scatterPlot: {
        required: ['drawCircle'],
        preferred: ['batchRendering'],
        optional: ['gradients', 'animations']
      },
      
      // Chart features
      tooltips: {
        required: ['drawText', 'drawRect'],
        preferred: ['interactivity', 'dynamicUpdates'],
        optional: ['gradients', 'animations']
      },
      
      crosshair: {
        required: ['drawLine'],
        preferred: ['interactivity', 'dynamicUpdates'],
        optional: ['animations']
      },
      
      legend: {
        required: ['drawText', 'drawLine', 'drawRect'],
        preferred: ['textMetrics'],
        optional: ['interactivity', 'gradients']
      },
      
      zeroLine: {
        required: ['drawLine'],
        preferred: [],
        optional: ['animations']
      },
      
      recessionBars: {
        required: ['drawRect'],
        preferred: ['gradients'],
        optional: ['animations']
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
      prioritizePeformance = false,
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
        prioritizePeformance,
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
   * Get renderer-specific adaptation strategies
   * @param {string} rendererType - Target renderer
   * @param {Array} features - Required features
   * @returns {Object} Adaptation strategies
   */
  getAdaptationStrategies(rendererType, features) {
    const strategies = {
      featureAdaptations: {},
      performanceOptimizations: [],
      fallbackMechanisms: {}
    };
    
    features.forEach(featureName => {
      const feature = this.featureRequirements[featureName];
      if (!feature) return;
      
      const adaptations = this._getFeatureAdaptations(rendererType, featureName, feature);
      if (adaptations.length > 0) {
        strategies.featureAdaptations[featureName] = adaptations;
      }
    });
    
    // Add renderer-specific optimizations
    strategies.performanceOptimizations = this._getPerformanceOptimizations(rendererType);
    
    // Add fallback mechanisms
    strategies.fallbackMechanisms = this._getFallbackMechanisms(rendererType, features);
    
    return strategies;
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
    const exportScore = this._calculateExportScore(renderer, exportFormats);
    score += exportScore.score;
    if (!exportScore.viable) {
      warnings.push('Required export formats not supported');
    }
    
    // Device/platform compatibility
    if (!this.isRendererSupported(rendererType, deviceConstraints)) {
      viable = false;
      warnings.push(`${rendererType} not supported on this device/browser`);
    }
    
    // Apply priority weights
    if (prioritizePerformance) {
      score += this._getPerformanceBias(renderer) * 2;
    }
    
    if (prioritizeQuality) {
      score += this._getQualityBias(renderer) * 2;
    }
    
    const confidence = this._calculateConfidence(score, viable, warnings.length);
    const reason = this._generateSelectionReason(rendererType, dataPoints, viable, warnings);
    
    return {
      totalScore: score,
      viable,
      confidence,
      reason,
      warnings,
      adaptations,
      performanceLevel: dataFitness.performance
    };
  }

  /**
   * Calculate how well renderer handles data size
   * @private
   */
  _calculateDataFitness(renderer, dataPoints) {
    const optimal = renderer.optimalDataPoints;
    const maximum = renderer.maxDataPoints;
    
    if (dataPoints > maximum) {
      return {
        score: 0,
        viable: false,
        performance: 'inadequate',
        warnings: [`Data size (${dataPoints}) exceeds renderer capacity (${maximum})`]
      };
    }
    
    if (dataPoints <= optimal) {
      return {
        score: 100,
        viable: true,
        performance: 'excellent',
        warnings: []
      };
    }
    
    // Calculate degradation
    const ratio = dataPoints / optimal;
    const degradation = Math.min(0.9, Math.log(ratio) / Math.log(10));
    const score = Math.max(10, 100 * (1 - degradation));
    
    let performance;
    if (score >= 80) performance = 'good';
    else if (score >= 60) performance = 'fair';
    else if (score >= 40) performance = 'poor';
    else performance = 'inadequate';
    
    return {
      score,
      viable: score >= 30,
      performance,
      warnings: score < 60 ? ['Performance may be impacted by large dataset'] : []
    };
  }

  /**
   * Calculate export format compatibility score
   * @private
   */
  _calculateExportScore(renderer, exportFormats) {
    if (exportFormats.length === 0) {
      return { score: 0, viable: true }; // No export requirements
    }
    
    let supportedFormats = 0;
    const requiredFormats = exportFormats.length;
    
    exportFormats.forEach(format => {
      if ((format === 'svg' && renderer.vectorExport.supported) ||
          (['png', 'jpeg', 'webp'].includes(format) && renderer.rasterExport.supported)) {
        supportedFormats++;
      }
    });
    
    const score = (supportedFormats / requiredFormats) * 50;
    const viable = supportedFormats > 0; // At least one format supported
    
    return { score, viable };
  }

  /**
   * Get performance bias score for renderer
   * @private
   */
  _getPerformanceBias(renderer) {
    const factors = [
      this.performanceWeights[renderer.renderingSpeed] || 0,
      renderer.memoryUsage === 'low' ? 10 : renderer.memoryUsage === 'medium' ? 5 : 0,
      renderer.startupTime === 'fast' ? 10 : renderer.startupTime === 'medium' ? 5 : 0
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0);
  }

  /**
   * Get quality bias score for renderer
   * @private
   */
  _getQualityBias(renderer) {
    const features = ['drawText', 'gradients', 'vectorExport', 'textMetrics'];
    return features.reduce((sum, feature) => {
      const cap = renderer[feature];
      return sum + (cap ? this.qualityWeights[cap.quality] || 0 : 0);
    }, 0);
  }

  /**
   * Calculate confidence level
   * @private
   */
  _calculateConfidence(score, viable, warningCount) {
    if (!viable) return 'low';
    
    const adjustedScore = score - (warningCount * 10);
    
    if (adjustedScore >= 200) return 'high';
    if (adjustedScore >= 100) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable selection reason
   * @private
   */
  _generateSelectionReason(rendererType, dataPoints, viable, warnings) {
    if (!viable) {
      return `${rendererType} not viable: ${warnings.join(', ')}`;
    }
    
    const renderer = this.rendererCapabilities[rendererType];
    const reasons = [];
    
    if (dataPoints <= renderer.optimalDataPoints) {
      reasons.push('optimal data size');
    } else if (dataPoints <= renderer.maxDataPoints) {
      reasons.push('acceptable data size');
    }
    
    switch (rendererType) {
      case 'svg':
        reasons.push('excellent text rendering', 'vector export capability');
        break;
      case 'canvas':
        reasons.push('balanced performance', 'broad compatibility');
        break;
      case 'webgl':
        reasons.push('outstanding performance', 'GPU acceleration');
        break;
    }
    
    return `Best choice: ${reasons.join(', ')}`;
  }

  /**
   * Get feature-specific adaptations
   * @private
   */
  _getFeatureAdaptations(rendererType, featureName, feature) {
    const adaptations = [];
    
    // Check each required capability
    feature.required.forEach(capability => {
      if (!this.supportsCapability(rendererType, capability)) {
        adaptations.push(this._getCapabilityFallback(capability, rendererType));
      }
    });
    
    return adaptations.filter(Boolean);
  }

  /**
   * Get fallback for unsupported capability
   * @private
   */
  _getCapabilityFallback(capability, rendererType) {
    const fallbacks = {
      gradients: {
        webgl: 'Use solid colors instead of gradients',
        fallback: 'Simulate gradients with patterns'
      },
      textMetrics: {
        webgl: 'Use Canvas overlay for text measurements',
        fallback: 'Use estimated text dimensions'
      },
      vectorExport: {
        canvas: 'Export as raster image instead',
        webgl: 'Export as raster image instead'
      }
    };
    
    const capabilityFallback = fallbacks[capability];
    if (!capabilityFallback) return null;
    
    return capabilityFallback[rendererType] || capabilityFallback.fallback;
  }

  /**
   * Get renderer-specific performance optimizations
   * @private
   */
  _getPerformanceOptimizations(rendererType) {
    const optimizations = {
      svg: [
        'Use CSS transforms for animations',
        'Minimize DOM manipulations',
        'Enable shape-rendering optimizations for large datasets'
      ],
      canvas: [
        'Use batch rendering for multiple elements',
        'Disable antialiasing for large datasets',
        'Use offscreen canvas for complex operations'
      ],
      webgl: [
        'Maximize batch size for draw calls',
        'Use instanced rendering for repeated elements',
        'Optimize shader programs for data patterns'
      ]
    };
    
    return optimizations[rendererType] || [];
  }

  /**
   * Get fallback mechanisms
   * @private
   */
  _getFallbackMechanisms(rendererType, features) {
    return {
      renderingFailure: `Fall back to ${rendererType === 'webgl' ? 'canvas' : 'svg'}`,
      featureUnavailable: 'Gracefully degrade feature functionality',
      performanceIssues: 'Reduce visual quality or disable non-essential features'
    };
  }

  /**
   * Check WebGL support
   * @private
   */
  _checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
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
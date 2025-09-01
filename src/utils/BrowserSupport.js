/**
 * BrowserSupport.js - Consolidated Browser Capability Detection
 * 
 * Centralized utility for detecting browser capabilities and renderer support.
 * Replaces duplicated browser detection logic from index.js and WebGLRenderer.js
 * 
 */

/**
 * Comprehensive browser support detection
 */
export class BrowserSupport {
  constructor() {
    this._cache = new Map();
    this._initialize();
  }

  /**
   * Initialize browser support detection
   * @private
   */
  _initialize() {
    // Cache all detection results on first load
    this._cache.set('canvas2d', this._detectCanvas2D());
    this._cache.set('webgl', this._detectWebGL());
    this._cache.set('webgl2', this._detectWebGL2());
    this._cache.set('devicePixelRatio', this._getDevicePixelRatio());
    this._cache.set('webglCapabilities', this._getWebGLCapabilities());
    
    console.log('BrowserSupport initialized with capability detection');
  }

  /**
   * Detect Canvas 2D support
   * @private
   */
  _detectCanvas2D() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect WebGL support (WebGL 1.0 or 2.0)
   * @private
   */
  _detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect WebGL 2.0 specific support
   * @private
   */
  _detectWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Get device pixel ratio
   * @private
   */
  _getDevicePixelRatio() {
    return window.devicePixelRatio || 1;
  }

  /**
   * Get detailed WebGL capabilities
   * @private
   */
  _getWebGLCapabilities() {
    if (!this._cache.get('webgl')) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) return null;

      return {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
        maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
        maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        supportedExtensions: gl.getSupportedExtensions() || [],
        isWebGL2: !!gl.getParameter(gl.VERSION).includes('WebGL 2.0')
      };
    } catch (e) {
      console.warn('Error detecting WebGL capabilities:', e);
      return null;
    }
  }

  // === PUBLIC API ===

  /**
   * Check if Canvas 2D is supported
   */
  hasCanvas2D() {
    return this._cache.get('canvas2d');
  }

  /**
   * Check if WebGL is supported (any version)
   */
  hasWebGL() {
    return this._cache.get('webgl');
  }

  /**
   * Check if WebGL 2.0 is supported specifically
   */
  hasWebGL2() {
    return this._cache.get('webgl2');
  }

  /**
   * Get device pixel ratio
   */
  getDevicePixelRatio() {
    return this._cache.get('devicePixelRatio');
  }

  /**
   * Check if device has high DPI display
   */
  isHighDPI() {
    return this.getDevicePixelRatio() > 1;
  }

  /**
   * Get detailed WebGL capabilities
   */
  getWebGLCapabilities() {
    return this._cache.get('webglCapabilities');
  }

  /**
   * Get comprehensive browser support summary
   */
  getSupportSummary() {
    return {
      canvas2d: this.hasCanvas2D(),
      webgl: this.hasWebGL(),
      webgl2: this.hasWebGL2(),
      devicePixelRatio: this.getDevicePixelRatio(),
      isHighDPI: this.isHighDPI(),
      webglCapabilities: this.getWebGLCapabilities()
    };
  }

  /**
   * Suggest optimal renderer based on dataset size and browser capabilities
   */
  suggestRenderer(dataPointCount) {
    const hasWebGL = this.hasWebGL();
    
    if (dataPointCount > 100000) {
      if (hasWebGL) {
        return {
          recommended: 'webgl',
          reason: 'Dataset too large for Canvas 2D, WebGL required',
          performance: 'excellent'
        };
      } else {
        return {
          recommended: 'canvas',
          reason: 'WebGL not supported, using Canvas 2D (may be slow)',
          performance: 'poor',
          warning: 'Consider reducing dataset size or upgrading browser'
        };
      }
    } else if (dataPointCount > 50000) {
      if (hasWebGL) {
        return {
          recommended: 'webgl',
          reason: 'Large dataset, WebGL provides better performance',
          performance: 'excellent'
        };
      } else {
        return {
          recommended: 'canvas',
          reason: 'WebGL not supported, using Canvas 2D',
          performance: 'acceptable'
        };
      }
    } else {
      return {
        recommended: 'canvas',
        reason: 'Dataset size suitable for Canvas 2D rendering',
        performance: 'excellent'
      };
    }
  }

  /**
   * Check if a specific renderer is supported
   */
  isRendererSupported(rendererType) {
    switch (rendererType.toLowerCase()) {
      case 'canvas':
        return this.hasCanvas2D();
      case 'webgl':
        return this.hasWebGL();
      case 'svg':
        return true; // SVG is universally supported in modern browsers
      default:
        return false;
    }
  }

  /**
   * Get the best available renderer
   */
  getBestRenderer() {
    if (this.hasWebGL()) return 'webgl';
    if (this.hasCanvas2D()) return 'canvas';
    return 'svg'; // Fallback
  }

  /**
   * Validate browser compatibility for VisionCharts
   */
  validateCompatibility() {
    const issues = [];
    const warnings = [];

    if (!this.hasCanvas2D()) {
      issues.push('Canvas 2D not supported - basic charting functionality will not work');
    }

    if (!this.hasWebGL()) {
      warnings.push('WebGL not supported - large datasets (50K+ points) will have poor performance');
    }

    const dpr = this.getDevicePixelRatio();
    if (dpr > 2) {
      warnings.push(`Very high DPI display detected (${dpr}x) - may impact performance`);
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      summary: this.getSupportSummary()
    };
  }

  /**
   * Log browser capabilities to console
   */
  logCapabilities() {
    const summary = this.getSupportSummary();
    console.group('🔍 Browser Capabilities - VisionCharts');
    console.log('Canvas 2D:', summary.canvas2d ? '✅' : '❌');
    console.log('WebGL:', summary.webgl ? '✅' : '❌');
    console.log('WebGL 2.0:', summary.webgl2 ? '✅' : '❌');
    console.log('Device Pixel Ratio:', summary.devicePixelRatio);
    console.log('High DPI:', summary.isHighDPI ? '✅' : '❌');
    
    if (summary.webglCapabilities) {
      console.log('WebGL Renderer:', summary.webglCapabilities.renderer);
      console.log('Max Texture Size:', summary.webglCapabilities.maxTextureSize);
    }
    console.groupEnd();
  }
}

// === SINGLETON INSTANCE ===

/**
 * Singleton instance for global use
 */
export const browserSupport = new BrowserSupport();

// === COMPATIBILITY EXPORTS ===

/**
 * Legacy function export for backward compatibility
 * @deprecated Use browserSupport.getSupportSummary() instead
 */
export function getBrowserSupport() {
  console.warn('getBrowserSupport() is deprecated. Use browserSupport.getSupportSummary() instead.');
  return browserSupport.getSupportSummary();
}

/**
 * Legacy function export for backward compatibility  
 * @deprecated Use browserSupport.suggestRenderer() instead
 */
export function suggestRenderer(dataPointCount) {
  console.warn('suggestRenderer() is deprecated. Use browserSupport.suggestRenderer() instead.');
  return browserSupport.suggestRenderer(dataPointCount);
}

/**
 * Static WebGL support check for renderer compatibility
 * @deprecated Use browserSupport.hasWebGL() instead
 */
export function isWebGLSupported() {
  console.warn('isWebGLSupported() is deprecated. Use browserSupport.hasWebGL() instead.');
  return browserSupport.hasWebGL();
}

/**
 * Static WebGL capabilities check
 * @deprecated Use browserSupport.getWebGLCapabilities() instead  
 */
export function getWebGLCapabilities() {
  console.warn('getWebGLCapabilities() is deprecated. Use browserSupport.getWebGLCapabilities() instead.');
  return browserSupport.getWebGLCapabilities();
}
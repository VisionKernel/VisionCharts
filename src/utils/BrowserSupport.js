export class BrowserSupport {
  constructor() {
    this._cache = new Map();
    this._initialize();
  }

  _initialize() {
    this._cache.set('canvas2d', this._detectCanvas2D());
    this._cache.set('webgl', this._detectWebGL());
    this._cache.set('webgl2', this._detectWebGL2());
    this._cache.set('devicePixelRatio', this._getDevicePixelRatio());
    this._cache.set('webglCapabilities', this._getWebGLCapabilities());
  }

  _detectCanvas2D() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  }

  _detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  _detectWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  }

  _getDevicePixelRatio() {
    return window.devicePixelRatio || 1;
  }

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
      return null;
    }
  }

  hasCanvas2D() {
    return this._cache.get('canvas2d');
  }

  hasWebGL() {
    return this._cache.get('webgl');
  }

  hasWebGL2() {
    return this._cache.get('webgl2');
  }

  getDevicePixelRatio() {
    return this._cache.get('devicePixelRatio');
  }

  isHighDPI() {
    return this.getDevicePixelRatio() > 1;
  }

  getWebGLCapabilities() {
    return this._cache.get('webglCapabilities');
  }

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

  isRendererSupported(rendererType) {
    switch (rendererType.toLowerCase()) {
      case 'canvas':
        return this.hasCanvas2D();
      case 'webgl':
        return this.hasWebGL();
      case 'svg':
        return true;
      default:
        return false;
    }
  }

  getBestRenderer() {
    if (this.hasWebGL()) return 'webgl';
    if (this.hasCanvas2D()) return 'canvas';
    return 'svg';
  }

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

  logCapabilities() {
    return this.getSupportSummary();
  }
}

export const browserSupport = new BrowserSupport();

export function getBrowserSupport() {
  return browserSupport.getSupportSummary();
}

export function suggestRenderer(dataPointCount) {
  return browserSupport.suggestRenderer(dataPointCount);
}

export function isWebGLSupported() {
  return browserSupport.hasWebGL();
}

export function getWebGLCapabilities() {
  return browserSupport.getWebGLCapabilities();
}

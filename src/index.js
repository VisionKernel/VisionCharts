/**
 * VisionCharts - A modern, high-performance JavaScript charting library
 * optimized for financial and economic data visualization.
 * 
 * Enhanced Multi-Renderer Architecture (Phase 2A Complete)
 * - SVG, Canvas, and WebGL rendering backends
 * - Automatic renderer selection based on dataset size (50K+ points → WebGL)
 * - Unified event system and coordinate normalization
 * - Performance optimization and monitoring
 * color utilies and color picker component
 * 
 * @version 1.2.1
 * @license MIT
 */

// Core chart classes
export { Chart } from './core/Chart.js';
export { Axis } from './core/Axis.js';
export { Scale, ScaleManager, createScale } from './core/Scale.js';

// Components
export { Grid } from './components/Grid.js';

// Chart implementations
export { LineChart } from './charts/LineChart.js';
export { BarChart } from './charts/BarChart.js';

export { Legend } from './components/Legend.js';

// Convenience function to create charts with automatic renderer selection
export function createChart(type, config) {
  switch (type.toLowerCase()) {
    case 'line':
      return new LineChart(config);
    case 'bar':
      return new BarChart(config);
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

// Utility function to check basic browser support
export function getBrowserSupport() {
  // Simple checks that don't require importing renderers
  const canvas2dSupported = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch (e) {
      return false;
    }
  })();

  const webglSupported = (() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  })();

  const webgl2Supported = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  })();

  return {
    canvas2d: canvas2dSupported,
    webgl: webglSupported,
    webgl2: webgl2Supported,
    devicePixelRatio: window.devicePixelRatio || 1,
    isHighDPI: (window.devicePixelRatio || 1) > 1
  };
}

// Utility function to suggest optimal renderer for a dataset
export function suggestRenderer(dataPointCount) {
  const support = getBrowserSupport();
  
  if (dataPointCount > 100000) {
    if (support.webgl) {
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
    if (support.webgl) {
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

// Library metadata
export const version = '1.2.1';
export const name = 'VisionCharts';

// Feature detection and browser compatibility
export const BrowserSupport = getBrowserSupport();

// Auto-initialization message
console.log(`VisionCharts v${version} loaded with multi-renderer support`);
console.log('Browser support:', BrowserSupport);

if (BrowserSupport.webgl) {
  console.log('✅ WebGL available - large datasets (50K+ points) will use GPU acceleration');
} else {
  console.log('⚠️ WebGL not available - large datasets will use Canvas 2D (may be slower)');
}
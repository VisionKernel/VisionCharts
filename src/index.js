/**
 * VisionCharts - A modern, high-performance JavaScript charting library
 * optimized for financial and economic data visualization.
 * 
 * Enhanced Multi-Renderer Architecture (Phase 2A Complete)
 * - SVG, Canvas, and WebGL rendering backends
 * - Automatic renderer selection based on dataset size (50K+ points → WebGL)
 * - Unified event system and coordinate normalization
 * - Performance optimization and monitoring
 * color utilities and color picker component
 * 
 * @version 2.0.0
 * @license MIT
 */

// Core chart classes
export { Chart } from './core/Chart.js';
export { Axis } from './core/Axis.js';
export { Scale, ScaleManager, createScale } from './core/Scale.js';

// Components
export { Grid } from './components/Grid.js';
export { Legend } from './components/Legend.js';

// Chart implementations
export { LineChart } from './charts/LineChart.js';
export { BarChart } from './charts/BarChart.js';

// Browser Support
export { 
  browserSupport,
  BrowserSupport
} from './utils/BrowserSupport.js';

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

// Library metadata
export const version = '2.0.0';
export const name = 'VisionCharts';

// UPDATED - Use the centralized browser support utility
import { browserSupport } from './utils/BrowserSupport.js';

// Feature detection and browser compatibility
export const BrowserSupportInfo = browserSupport.getSupportSummary();

// Auto-initialization message
console.log(`VisionCharts v${version} loaded with multi-renderer support`);

// UPDATED - Use centralized browser support
browserSupport.logCapabilities();

if (browserSupport.hasWebGL()) {
  console.log('✅ WebGL available - large datasets (50K+ points) will use GPU acceleration');
} else {
  console.log('⚠️ WebGL not available - large datasets will use Canvas 2D (may be slower)');
}
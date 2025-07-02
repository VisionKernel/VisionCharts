/**
 * VisionCharts - A modern, high-performance JavaScript charting library
 * optimized for financial and economic data visualization.
 * 
 * Enhanced Multi-Renderer Architecture (Phase 1F Complete)
 * - SVG, Canvas, and WebGL rendering backends
 * - Automatic renderer selection and switching
 * - Unified event system and coordinate normalization
 * - Performance optimization and monitoring
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

// Convenience function to create charts
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
export const version = '1.2.1';
export const name = 'VisionCharts';
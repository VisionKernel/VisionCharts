/**
 * VisionCharts - A modern, high-performance JavaScript charting library
 * optimized for financial and economic data visualization.
 * 
 * @version 0.1.0
 * @license MIT
 */

// Core classes
import Chart from './core/Chart.js';
import Axis from './core/Axis.js';
import { Scale, LinearScale, TimeScale, LogScale } from './core/Scale.js';

// Renderers
import SvgRenderer from './renderers/SvgRenderer.js';

// Chart types
import LineChart from './charts/LineChart.js';

// Export the public API
export {
  // Core
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale,
  
  // Renderers
  SvgRenderer,
  
  // Charts
  LineChart
};

// Export library version
export const version = '0.1.0';

// Default export
export default {
  version,
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale,
  SvgRenderer,
  LineChart
};
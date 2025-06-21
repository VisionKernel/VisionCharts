/**
 * VisionCharts - A modern, high-performance JavaScript charting library
 * optimized for financial and economic data visualization.
 * 
 * @version 1.2.0
 * @license MIT
 */

// Core classes
import Chart from './core/Chart.js';
import Axis from './core/Axis.js';
import { Scale, LinearScale, TimeScale, LogScale } from './core/Scale.js';

// Components
import ZeroLine from './components/ZeroLine.js';
import Tooltip from './components/Tooltip.js';
import Legend from './components/Legend.js';
import Crosshair from './components/Crosshair.js';
import RecessionLines from './components/RecessionLines.js';
import EndingLabels from './components/EndingLabels.js';

// Renderers
import SvgRenderer from './renderers/SvgRenderer.js';

// Chart types
import LineChart from './charts/LineChart.js';
import BarChart from './charts/BarChart.js';

// Utility functions
import { 
  formatDateValue,
  calculateIndicator
} from './utils/chartUtils.js';

/**
 * Create a chart instance based on type
 * @param {string} type - Chart type ('line', 'bar')
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart instance
 */
export function createChart(type, config) {
  switch (type.toLowerCase()) {
    case 'line':
      return new LineChart(config);
    case 'bar':
      return new BarChart(config);
    case 'area':
      // For backward compatibility, map area to line
      console.warn('AreaChart is deprecated. Use LineChart with dataset.area = true instead.');
      return new LineChart(config);
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

/**
 * Parse chart configuration from various formats
 * @param {Object} config - Chart configuration
 * @returns {Object} Standardized chart configuration
 */
export function parseChartConfig(config) {
  // Default configuration
  const defaultConfig = {
    chartType: 'line',
    chartLibrary: 'VisionCharts',
    title: 'Chart',
    xAxisName: '',
    yAxisName: '',
    isLogarithmic: false,
    isPanelView: false,
    showRecessionLines: false,
    showZeroLine: false,
    showPoints: false,
    showEndingLabels: false,
    studies: [],
    datasets: []
  };
  
  // Return default if no config
  if (!config) return defaultConfig;
  
  // Handle VisionKernel format
  if (config.configuration) {
    // This is a saved chart from VisionKernel
    return {
      ...defaultConfig,
      ...config.configuration,
      title: config.name || config.configuration.title || defaultConfig.title
    };
  }
  
  // Handle simple dataset format
  if (Array.isArray(config)) {
    return {
      ...defaultConfig,
      datasets: [{
        id: 'dataset-1',
        name: 'Dataset',
        color: '#1468a8',
        data: config
      }]
    };
  }
  
  // Merge with default config
  return {
    ...defaultConfig,
    ...config
  };
}

// Export the public API
export {
  // Core
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale,
  
  // Components
  ZeroLine,
  Tooltip,
  Legend,
  Crosshair,
  RecessionLines,
  EndingLabels,
  
  // Renderers
  SvgRenderer,
  
  // Charts
  LineChart,
  BarChart,
  
  // Utils
  calculateIndicator,
  formatDateValue,
};

// Export library version
export const version = '1.2.0';

// Default export
export default {
  version,
  createChart,
  parseChartConfig,
  
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale,
  
  ZeroLine,
  Tooltip,
  Legend,
  Crosshair,
  RecessionLines,
  EndingLabels,
  
  SvgRenderer,
  
  LineChart,
  BarChart,
  
  calculateIndicator,
  formatDateValue,
};
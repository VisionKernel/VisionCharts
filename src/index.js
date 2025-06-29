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

// ===== CORE CLASSES =====
import Chart from './core/Chart.js';
import Axis from './core/Axis.js';
import { Scale, LinearScale, TimeScale, LogScale } from './core/Scale.js';

// ===== MULTI-RENDERER CORE SYSTEM =====
import EventSystem from './core/EventSystem.js';
import InteractionManager from './core/InteractionManager.js';
import CapabilityManager from './core/CapabilityManager.js';
import PerformanceMonitor from './core/PerformanceMonitor.js';

// ===== DATA PROCESSING PIPELINE =====
import DataProcessor from './utils/DataProcessor.js';
import CoordinateSystem from './utils/CoordinateSystem.js';
import PathGenerator from './utils/PathGenerator.js';

// ===== RENDERER SYSTEM =====
import AbstractRenderer from './renderers/AbstractRenderer.js';
import SvgRenderer from './renderers/SvgRenderer.js';
import CanvasRenderer from './renderers/CanvasRenderer.js';
import WebGLRenderer from './renderers/WebGLRenderer.js';
import RendererFactory from './renderers/RendererFactory.js';

// ===== MULTI-RENDERER COMPONENTS =====
import ZeroLine from './components/ZeroLine.js';
import Tooltip from './components/Tooltip.js';
import Legend from './components/Legend.js';
import Crosshair from './components/Crosshair.js';
import RecessionLines from './components/RecessionLines.js';
import EndingLabels from './components/EndingLabels.js';

// ===== CHART TYPES =====
import LineChart from './charts/LineChart.js';
import BarChart from './charts/BarChart.js';

// ===== UTILITY FUNCTIONS =====
import { 
  formatDateValue,
  calculateIndicator
} from './utils/chartUtils.js';

/**
 * Create a chart instance with multi-renderer support
 * @param {string} type - Chart type ('line', 'bar')
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart instance with optimal renderer
 */
export function createChart(type, config = {}) {
  console.log(`Creating ${type} chart with multi-renderer support`);
  
  // Enhanced configuration with renderer options
  const enhancedConfig = {
    // Renderer selection options
    enableAutoSwitching: true,
    enablePerformanceMonitoring: true,
    preferredRenderer: 'auto', // 'auto', 'svg', 'canvas', 'webgl'
    
    // Performance thresholds
    canvasThreshold: 100000,     // Switch to Canvas at 100K+ points
    webglThreshold: 100000,      // Use WebGL for 100K+ points
    svgFallbackThreshold: 10000, // Fallback to SVG for small datasets
    
    // Multi-renderer features
    enableCoordinateNormalization: true,
    enableUnifiedEventSystem: true,
    enableAdaptiveOptimization: true,
    
    ...config
  };
  
  switch (type.toLowerCase()) {
    case 'line':
      return new LineChart(enhancedConfig);
      
    case 'bar':
      return new BarChart(enhancedConfig);
      
    case 'area':
      // For backward compatibility, map area to line with area enabled
      console.warn('AreaChart is deprecated. Use LineChart with dataset.area = true instead.');
      return new LineChart({
        ...enhancedConfig,
        datasets: enhancedConfig.datasets?.map(dataset => ({
          ...dataset,
          area: true
        })) || []
      });
      
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

/**
 * Create a chart with specific renderer
 * @param {string} type - Chart type
 * @param {string} renderer - Renderer type ('svg', 'canvas', 'webgl')
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart instance with specified renderer
 */
export function createChartWithRenderer(type, renderer, config = {}) {
  console.log(`Creating ${type} chart with ${renderer} renderer`);
  
  const rendererConfig = {
    ...config,
    preferredRenderer: renderer,
    enableAutoSwitching: false // Disable auto-switching for explicit renderer choice
  };
  
  return createChart(type, rendererConfig);
}

/**
 * Parse chart configuration with multi-renderer enhancements
 * @param {Object} config - Chart configuration
 * @returns {Object} Standardized chart configuration
 */
export function parseChartConfig(config) {
  // Enhanced default configuration
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
    datasets: [],
    
    // Multi-renderer configuration
    rendererOptions: {
      enableAutoSwitching: true,
      enablePerformanceMonitoring: true,
      preferredRenderer: 'auto',
      canvasThreshold: 100000,
      webglThreshold: 100000,
      svgFallbackThreshold: 10000
    },
    
    // Event system configuration
    eventOptions: {
      enableUnifiedEventSystem: true,
      enableTouchEvents: true,
      enablePointerEvents: true,
      eventThrottleDelay: 16
    },
    
    // Performance options
    performanceOptions: {
      enableAdaptiveOptimization: true,
      enableDataCaching: true,
      enableCoordinateCaching: true,
      enableBatchRendering: true
    }
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
  
  // Merge with default config and ensure renderer options are present
  const mergedConfig = {
    ...defaultConfig,
    ...config
  };
  
  // Ensure renderer options are properly structured
  if (!mergedConfig.rendererOptions) {
    mergedConfig.rendererOptions = defaultConfig.rendererOptions;
  } else {
    mergedConfig.rendererOptions = {
      ...defaultConfig.rendererOptions,
      ...mergedConfig.rendererOptions
    };
  }
  
  return mergedConfig;
}

/**
 * Get renderer capabilities and recommendations
 * @param {Object} chartConfig - Chart configuration
 * @returns {Object} Renderer analysis and recommendations
 */
export function analyzeRendererRequirements(chartConfig) {
  const capabilityManager = new CapabilityManager();
  const performanceMonitor = new PerformanceMonitor(capabilityManager);
  
  return performanceMonitor.analyzeAndRecommend(chartConfig);
}

/**
 * Get system capabilities for renderer selection
 * @returns {Object} System capabilities
 */
export function getSystemCapabilities() {
  const capabilityManager = new CapabilityManager();
  
  return {
    webgl: capabilityManager.isRendererSupported('webgl'),
    canvas: capabilityManager.isRendererSupported('canvas'),
    svg: capabilityManager.isRendererSupported('svg'),
    capabilities: capabilityManager.getSystemCapabilities(),
    recommendations: capabilityManager.getRendererRecommendations()
  };
}

/**
 * Create a standalone renderer instance
 * @param {string} type - Renderer type ('svg', 'canvas', 'webgl')
 * @param {HTMLElement} container - Container element
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @param {Object} options - Renderer options
 * @returns {Promise<AbstractRenderer>} Renderer instance
 */
export async function createRenderer(type, container, width, height, options = {}) {
  console.log(`Creating standalone ${type} renderer`);
  
  const rendererFactory = new RendererFactory();
  const result = await rendererFactory.createRenderer(container, width, height, { chartType: type }, options);
  
  return result.renderer;
}

/**
 * Process data for optimal rendering
 * @param {Array} datasets - Array of datasets
 * @param {Object} chartConfig - Chart configuration
 * @param {string} rendererType - Target renderer type
 * @returns {Promise<Object>} Processed data
 */
export async function processDataForRenderer(datasets, chartConfig, rendererType = 'canvas') {
  console.log(`Processing data for ${rendererType} renderer`);
  
  const dataProcessor = new DataProcessor();
  return await dataProcessor.processDatasets(datasets, chartConfig, rendererType);
}

// ===== EXPORTS =====

// Core chart creation functions
export {
  createChart,
  createChartWithRenderer,
  parseChartConfig,
  analyzeRendererRequirements,
  getSystemCapabilities,
  createRenderer,
  processDataForRenderer
};

// Core classes
export {
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale
};

// Multi-renderer core system
export {
  EventSystem,
  InteractionManager,
  CapabilityManager,
  PerformanceMonitor
};

// Data processing pipeline
export {
  DataProcessor,
  CoordinateSystem,
  PathGenerator
};

// Renderer system
export {
  AbstractRenderer,
  SvgRenderer,
  CanvasRenderer,
  WebGLRenderer,
  RendererFactory
};

// Components (now multi-renderer enabled)
export {
  ZeroLine,
  Tooltip,
  Legend,
  Crosshair,
  RecessionLines,
  EndingLabels
};

// Chart types
export {
  LineChart,
  BarChart
};

// Utility functions
export {
  calculateIndicator,
  formatDateValue
};

// ===== VERSION AND METADATA =====

// Export enhanced library version
export const version = '1.2.1';

// Export renderer capabilities for runtime detection
export const capabilities = {
  renderers: ['svg', 'canvas', 'webgl'],
  autoSwitching: true,
  performanceMonitoring: true,
  unifiedEventSystem: true,
  coordinateNormalization: true,
  adaptiveOptimization: true
};

// ===== DEFAULT EXPORT WITH ENHANCED API =====

const VisionCharts = {
  // Enhanced version information
  version: '1.3.0',
  capabilities: {
    renderers: ['svg', 'canvas', 'webgl'],
    autoSwitching: true,
    performanceMonitoring: true,
    unifiedEventSystem: true,
    coordinateNormalization: true,
    adaptiveOptimization: true
  },
  
  // Chart creation functions
  createChart,
  createChartWithRenderer,
  parseChartConfig,
  analyzeRendererRequirements,
  getSystemCapabilities,
  createRenderer,
  processDataForRenderer,
  
  // Core classes
  Chart,
  Axis,
  Scale,
  LinearScale,
  TimeScale,
  LogScale,
  
  // Multi-renderer core system
  EventSystem,
  InteractionManager,
  CapabilityManager,
  PerformanceMonitor,
  
  // Data processing pipeline
  DataProcessor,
  CoordinateSystem,
  PathGenerator,
  
  // Renderer system
  AbstractRenderer,
  SvgRenderer,
  CanvasRenderer,
  WebGLRenderer,
  RendererFactory,
  
  // Components
  ZeroLine,
  Tooltip,
  Legend,
  Crosshair,
  RecessionLines,
  EndingLabels,
  
  // Chart types
  LineChart,
  BarChart,
  
  // Utilities
  calculateIndicator,
  formatDateValue,
};

export default VisionCharts;
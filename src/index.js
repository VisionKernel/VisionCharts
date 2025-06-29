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

// ===== FUNCTION DEFINITIONS (NOT EXPORTED HERE) =====

/**
 * Create a chart instance with multi-renderer support
 * @param {string} type - Chart type ('line', 'bar')
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart instance with optimal renderer
 */
function createChart(type, config = {}) {
  console.log(`Creating ${type} chart with multi-renderer support`);
  
  // Enhanced configuration with multi-renderer defaults
  const enhancedConfig = {
    chartType: type,
    enableAutoSwitching: true,
    enablePerformanceMonitoring: true,
    preferredRenderer: 'auto',
    ...config
  };
  
  // Chart type routing with multi-renderer support
  switch (type.toLowerCase()) {
    case 'line':
      return new LineChart(enhancedConfig);
      
    case 'bar':
      return new BarChart(enhancedConfig);
      
    case 'area':
      console.warn('Area chart type is deprecated. Use LineChart with dataset.area = true instead.');
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
function createChartWithRenderer(type, renderer, config = {}) {
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
function parseChartConfig(config) {
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
    
    // Performance configuration
    performanceOptions: {
      enableDatasetOptimization: true,
      enableCoordinateCaching: true,
      enableRenderingOptimization: true,
      maxDataPointsPerFrame: 10000
    }
  };
  
  // Merge with defaults
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Validate configuration
  if (!mergedConfig.datasets || !Array.isArray(mergedConfig.datasets)) {
    mergedConfig.datasets = [];
  }
  
  console.log('Chart configuration parsed with multi-renderer enhancements');
  return mergedConfig;
}

/**
 * Analyze renderer requirements for given configuration
 * @param {Object} config - Chart configuration
 * @returns {Object} Renderer analysis and recommendations
 */
function analyzeRendererRequirements(config) {
  console.log('Analyzing renderer requirements');
  
  const analysis = {
    totalDataPoints: 0,
    complexity: 'low',
    recommendedRenderer: 'svg',
    features: [],
    limitations: []
  };
  
  // Calculate total data points
  if (config.datasets && Array.isArray(config.datasets)) {
    analysis.totalDataPoints = config.datasets.reduce((total, dataset) => {
      return total + (dataset.data ? dataset.data.length : 0);
    }, 0);
  }
  
  // Determine complexity and recommended renderer
  if (analysis.totalDataPoints > 100000) {
    analysis.complexity = 'high';
    analysis.recommendedRenderer = 'webgl';
    analysis.features.push('High performance WebGL rendering');
  } else if (analysis.totalDataPoints > 10000) {
    analysis.complexity = 'medium';
    analysis.recommendedRenderer = 'canvas';
    analysis.features.push('Canvas rendering for performance');
  } else {
    analysis.complexity = 'low';
    analysis.recommendedRenderer = 'svg';
    analysis.features.push('SVG rendering for crisp graphics');
  }
  
  // Check for special features
  if (config.showPoints) {
    analysis.features.push('Point rendering');
  }
  if (config.showRecessionLines) {
    analysis.features.push('Recession line overlays');
  }
  if (config.isLogarithmic) {
    analysis.features.push('Logarithmic scaling');
  }
  
  console.log('Renderer analysis complete:', analysis);
  return analysis;
}

/**
 * Get system capabilities for renderer selection
 * @returns {Object} System capabilities and recommendations
 */
function getSystemCapabilities() {
  console.log('Getting system capabilities');
  
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
async function createRenderer(type, container, width, height, options = {}) {
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
async function processDataForRenderer(datasets, chartConfig, rendererType = 'canvas') {
  console.log(`Processing data for ${rendererType} renderer`);
  
  const dataProcessor = new DataProcessor();
  return await dataProcessor.processDatasets(datasets, chartConfig, rendererType);
}

// ===== EXPORTS =====

// Core chart creation functions (EXPORTED ONLY ONCE)
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

// ===== DEFAULT EXPORT (CLASSES AND METADATA ONLY) =====

const VisionCharts = {
  // Enhanced version information
  version: '1.2.1',
  capabilities: {
    renderers: ['svg', 'canvas', 'webgl'],
    autoSwitching: true,
    performanceMonitoring: true,
    unifiedEventSystem: true,
    coordinateNormalization: true,
    adaptiveOptimization: true
  },
  
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
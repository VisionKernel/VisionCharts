import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import { formatLargeNumber } from '../utils/chartUtils.js';
import PathGenerator from '../utils/PathGenerator.js';
import StudiesRenderer from '../components/StudiesRenderer.js';
import PanelDataRenderer from '../components/PanelDataRenderer.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import EndingLabels from '../components/EndingLabels.js';
import ZeroLine from '../components/ZeroLine.js';
import Grid from '../components/Grid.js';
import Panel from '../components/Panel.js';

// Legacy import for backwards compatibility
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * LineChart - Enhanced multi-renderer line chart implementation
 * 
 * Provides high-performance line chart rendering with automatic renderer selection,
 * preserving all existing functionality while adding Canvas and WebGL support.
 */
export default class LineChart extends Chart {
  constructor(config) {
    console.log('LineChart constructor called with multi-renderer support');

    // Define LineChart-specific default options
    const defaultLineChartOptions = {
      chartType: 'line',
      curve: 'linear',
      showPoints: false,
      pointRadius: 3,
      xField: 'x',
      yField: 'y',
      xType: 'number',
      yType: 'number',
      areaOpacity: 0.2,
      gradient: false,
      tickLabelFontSize: '13px',
      
      // Format options
      xFormatOptions: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      yFormatOptions: {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
      },
      
      // Grid configuration
      grid: {
        show: true,
        color: '#e0e0e0',
        strokeWidth: 1,
        dashArray: '4,4'
      },
      
      // Ending labels configuration
      showEndingLabels: false,
      endingLabelsConfig: {
        show: true,
        fontSize: '11px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        backgroundColor: '#ffffff',
        borderColor: '#cccccc',
        borderWidth: 1,
        borderRadius: 3,
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        offsetX: 8,
        offsetY: 0,
        textColor: null,
        showBorder: true,
        showBackground: true
      },
      
      // Performance optimizations for LineChart
      enableBatchRendering: true,
      optimizeForLargeDatasets: true,
      
      // Line-specific rendering options
      lineJoin: 'round',
      lineCap: 'round',
      
      // Multi-renderer specific options
      preferWebGLThreshold: 50000, // Switch to WebGL for 50K+ points per dataset
      adaptivePointRendering: true  // Hide points automatically for large datasets
    };

    // Deep merge options, preserving existing configuration merging logic
    const mergedOptions = {
      ...defaultLineChartOptions,
      ...(config.options || {}),
      
      // Deep merge for complex objects
      grid: {
        ...defaultLineChartOptions.grid,
        ...((config.options && config.options.grid) || {})
      },
      endingLabelsConfig: {
        ...defaultLineChartOptions.endingLabelsConfig,
        ...((config.options && config.options.endingLabelsConfig) || {})
      }
    };

    // Call parent constructor with merged configuration
    super({
      ...config,
      options: mergedOptions
    });
    
    // LineChart-specific state
    this.lineChartState = {
      gradientDefinitions: new Map(), // Track gradient definitions per renderer
      pathCache: new Map(),           // Cache paths for performance
      pointElements: new Map(),       // Track point elements for interaction
      clippingPaths: new Map(),       // Track clipping paths per renderer
      batchedElements: []             // Elements pending batch rendering
    };
    
    // Performance tracking for LineChart
    this.linePerformanceMetrics = {
      pathGenerationTime: 0,
      pointRenderingTime: 0,
      areaRenderingTime: 0,
      totalDataPoints: 0
    };
    
    if (config.data && !config.datasets) {
    // Convert old format to new format
    this.config.datasets = config.data;
  } else if (config.datasets) {
    this.config.datasets = config.datasets;
  }
  
  console.log('LineChart datasets:', this.config.datasets?.length || 0);
}

  /**
   * Enhanced render method for LineChart
   * @returns {LineChart} This chart instance
   */
  async render() {
    console.log('LineChart.render called with multi-renderer support');
    
    // Call parent render method to setup renderer and basic structure
    await super.render();
    
    // LineChart-specific post-render setup
    this._setupLineChartOptimizations();
    
    return this;
  }

  /**
   * Render chart data - enhanced for multi-renderer support
   * @override
   */
  renderData() {
  console.log('LineChart.renderData called with multi-renderer support');
  
  if (!this.renderer || !this.state.chart) {
    console.error('Cannot render data: renderer or chart element not available');
    return;
  }
  
  const startTime = performance.now();
  
  try {
    const {
      xField,
      yField,
      showPoints,
      pointRadius,
      areaOpacity,
      gradient
    } = this.options;
    
    // Create data group using current renderer - will be positioned by parent chart group
    const dataGroup = this.renderer.createGroup({ class: 'visioncharts-data' });
    
    // Ensure data group is added to the main chart element
    if (this.state.chart && this.state.chart.appendChild) {
      this.state.chart.appendChild(dataGroup);
    }
      
      // No data to render
      if (!this.config.datasets || !this.config.datasets.length) {
        console.log('No datasets to render');
        return;
      }
      
      // Count total data points for performance tracking
      let totalDataPoints = 0;
      this.config.datasets.forEach(dataset => {
        if (dataset.data) totalDataPoints += dataset.data.length;
      });
      
      this.linePerformanceMetrics.totalDataPoints = totalDataPoints;
      
      console.log(`Rendering ${this.config.datasets.length} datasets with ${totalDataPoints} total points using ${this.rendererMetadata?.type} renderer`);
      
      // Create gradient definitions if needed and supported
      if (gradient && this._supportsGradients()) {
        this._createGradientDefinitions();
      }
      
      // Separate regular datasets from study datasets
      const regularDatasets = this.config.datasets.filter(dataset => dataset.type !== 'study');
      const studyDatasets = this.config.datasets.filter(dataset => dataset.type === 'study');
      
      console.log(`Regular datasets: ${regularDatasets.length}, Study datasets: ${studyDatasets.length}`);
      
      // Render regular datasets
      this._renderRegularDatasets(regularDatasets, dataGroup);

      // Validate scale ranges after rendering regular datasets
      this._validateScaleRanges();
      
      // Render study datasets using enhanced StudiesRenderer
      if (studyDatasets.length > 0) {
        this._renderStudyDatasets(studyDatasets, dataGroup);
      }
      
      // Add data group to chart
      if (dataGroup.element) {
        // For renderer wrapper objects
        this.state.chart.appendChild ? this.state.chart.appendChild(dataGroup.element) : null;
      }
      
      // Render ending labels if enabled
      if (this.options.showEndingLabels) {
        this._renderEndingLabels(dataGroup);
      }
      
      // Update performance metrics
      const renderTime = performance.now() - startTime;
      this.linePerformanceMetrics.pathGenerationTime = renderTime;
      
      console.log(`LineChart data rendered in ${renderTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Error rendering LineChart data:', error);
      
      // Fallback to legacy SVG rendering if multi-renderer fails
      this._renderDataFallback();
    }
  }

  /**
   * Validate and set scale ranges based on current dimensions
   * @private
  */
  _validateScaleRanges() {
  const { innerWidth, innerHeight } = this.state.dimensions;
  
  // Ensure X scale uses full inner width
  if (this.state.scales.x) {
    this.state.scales.x.setRange([0, innerWidth]);
    console.log('X scale range set to:', [0, innerWidth]);
  }
  
  // Ensure Y scale uses full inner height (inverted for SVG coordinates)
  if (this.state.scales.y) {
    this.state.scales.y.setRange([innerHeight, 0]);
    console.log('Y scale range set to:', [innerHeight, 0]);
  }
}

  /**
   * Create and configure axes for LineChart - enhanced
   * @override
   */
  createAxes() {
    console.log('LineChart.createAxes called');
    
    // Call parent method to create basic axes
    super.createAxes();
    
    // Add LineChart-specific axis configuration
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setOptions({
        tickCount: this.options.xTickCount || (this.options.xType === 'time' ? 6 : 5),
        formatType: this.options.xType === 'time' ? 'time' : 'number',
        formatOptions: this.options.xFormatOptions || {}
      });
    }
    
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setOptions({
        tickCount: this.options.yTickCount || 5,
        isLogarithmic: this.options.isLogarithmic || false,
        formatOptions: this.options.yFormatOptions || {}
      });
    }
  }

 /**
 * Create scales for line chart - FIXED IMPLEMENTATION
 */
createScales() {
  console.log('LineChart.createScales called');
  
  if (!this.config.datasets || !this.config.datasets.length) {
    console.warn('No datasets available for scale creation');
    return;
  }
  
  // Get data extent for X axis
  const allXValues = [];
  const allYValues = [];
  
  this.config.datasets.forEach(dataset => {
    if (dataset.data && dataset.data.length > 0) {
      dataset.data.forEach(point => {
        const xVal = point[this.options.xField] || point.x || point.date;
        const yVal = point[this.options.yField] || point.y || point.value || point.price;
        
        if (xVal !== undefined) allXValues.push(xVal);
        if (yVal !== undefined) allYValues.push(yVal);
      });
    }
  });
  
  if (allXValues.length === 0 || allYValues.length === 0) {
    console.warn('No valid data found for scale creation');
    return;
  }
  
  // Create X scale - FIXED: Pass domain and range as separate parameters
  if (this.options.xType === 'time') {
    const xExtent = [Math.min(...allXValues), Math.max(...allXValues)];
    this.state.scales.x = new TimeScale(
      xExtent,
      [0, this.state.dimensions.innerWidth]
    );
  } else {
    const xExtent = [Math.min(...allXValues), Math.max(...allXValues)];
    this.state.scales.x = new LinearScale(
      xExtent,
      [0, this.state.dimensions.innerWidth]
    );
  }
  
  // Create Y scale - FIXED: Pass domain and range as separate parameters
  const yExtent = [Math.min(...allYValues), Math.max(...allYValues)];
  const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% padding
  
  if (this.options.yType === 'log') {
    this.state.scales.y = new LogScale(
      [Math.max(yExtent[0] - yPadding, 0.01), yExtent[1] + yPadding],
      [this.state.dimensions.innerHeight, 0]
    );
  } else {
    this.state.scales.y = new LinearScale(
      [yExtent[0] - yPadding, yExtent[1] + yPadding],
      [this.state.dimensions.innerHeight, 0]
    );
  }
  
  console.log('Scales created successfully');
  console.log('X scale domain:', this.state.scales.x.domain);
  console.log('Y scale domain:', this.state.scales.y.domain);
}

  /**
   * Update axes - enhanced for multi-renderer
   * @override
   */
  updateAxes() {
    console.log('LineChart.updateAxes called');
    
    if (!this.state.rendered || !this.state.chart) {
      console.warn('Cannot update axes: chart not rendered');
      return;
    }
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    // Update X axis
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setScale(this.state.scales.x);
      this.state.components.axes.x.setOptions({
        formatType: this.options.xType === 'time' ? 'time' : 'number',
        formatOptions: this.options.xFormatOptions || {}
      });
      this.state.components.axes.x.update(innerWidth, innerHeight);
    }
    
    // Update Y axis
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setScale(this.state.scales.y);
      this.state.components.axes.y.setOptions({
        isLogarithmic: this.options.isLogarithmic || false,
        formatType: this.options.yType === 'time' ? 'time' : 'number',
        formatOptions: this.options.yFormatOptions || {}
      });
      this.state.components.axes.y.update(innerWidth, innerHeight);
    }
    
    // Update grid if enabled
    if (this.state.components.grid && this.options.grid?.show) {
      this.state.components.grid.update(
        this.state.scales.x,
        this.state.scales.y,
        innerWidth,
        innerHeight,
        this.options
      );
    }
  }

  // ===== ENHANCED RENDERING METHODS =====

  /**
   * Render regular datasets with multi-renderer support
   * @private
   */
  _renderRegularDatasets(datasets, dataGroup) {
    const {
      xField,
      yField,
      showPoints,
      pointRadius,
      areaOpacity,
      gradient,
      enableBatchRendering,
      adaptivePointRendering
    } = this.options;
    
    // Determine if we should use batch rendering
    const shouldBatchRender = enableBatchRendering && 
                             this._supportsBatchRendering() && 
                             this._getTotalDataPoints(datasets) > 1000;
    
    if (shouldBatchRender) {
      this._renderDatasetsBatched(datasets, dataGroup);
    } else {
      this._renderDatasetsIndividual(datasets, dataGroup);
    }
  }

  /**
   * Render datasets individually (preserves existing logic)
   * @private
   */
  _renderDatasetsIndividual(datasets, dataGroup) {
    const {
      xField,
      yField,
      showPoints,
      pointRadius,
      areaOpacity,
      gradient,
      adaptivePointRendering
    } = this.options;
    
    datasets.forEach((dataset, index) => {
      if (!dataset.data || !dataset.data.length) {
        console.log(`Dataset ${dataset.id} has no data, skipping`);
        return;
      }
      
      console.log(`Rendering dataset ${dataset.id} with ${dataset.data.length} points`);
      
      // Create dataset group
      const datasetGroup = this.renderer.createGroup({ 
        class: `visioncharts-dataset-${dataset.id}` 
      });
      
      // Set clipping bounds for this dataset if needed
      if (this._shouldClipDataset(dataset)) {
        this._setDatasetClipping(datasetGroup, dataset.id);
      }
      
      // Render area if enabled
      if (dataset.area) {
        this._renderDatasetArea(dataset, datasetGroup);
      }
      
      // Render line
      this._renderDatasetLine(dataset, datasetGroup);
      
      // Render points if enabled
      const shouldShowPoints = this._shouldShowPoints(dataset, showPoints, adaptivePointRendering);
      if (shouldShowPoints) {
        this._renderDatasetPoints(dataset, datasetGroup, pointRadius);
      }
      
      // Add dataset group to data group
      if (datasetGroup.element) {
        dataGroup.appendChild ? dataGroup.appendChild(datasetGroup.element) : null;
      }
    });
  }

  /**
   * Render datasets using batch operations for performance
   * @private
   */
  _renderDatasetsBatched(datasets, dataGroup) {
    console.log('Using batch rendering for performance');
    
    const lines = [];
    const points = [];
    const areas = [];
    
    // Collect all elements for batch rendering
    datasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      // Collect line data
      const lineData = this._prepareLineDataForBatch(dataset);
      if (lineData) lines.push(lineData);
      
      // Collect point data
      if (this._shouldShowPoints(dataset, this.options.showPoints, this.options.adaptivePointRendering)) {
        const pointData = this._preparePointDataForBatch(dataset);
        if (pointData.length > 0) points.push(...pointData);
      }
      
      // Collect area data
      if (dataset.area) {
        const areaData = this._prepareAreaDataForBatch(dataset);
        if (areaData) areas.push(areaData);
      }
    });
    
    // Render in batches
    if (areas.length > 0) this._renderAreasBatch(areas, dataGroup);
    if (lines.length > 0) this._renderLinesBatch(lines, dataGroup);
    if (points.length > 0) this._renderPointsBatch(points, dataGroup);
  }

  /**
   * Render dataset area with multi-renderer support
   * @private
   */
  _renderDatasetArea(dataset, datasetGroup) {
    const areaStartTime = performance.now();
    
    try {
      // Generate area path using enhanced PathGenerator
      const areaPath = this._generateAreaPath(dataset);
      if (!areaPath) return;
      
      // Determine fill style
      let fillStyle = {};
      
      if (this.options.gradient && this._supportsGradients()) {
        // Use gradient if supported
        const gradientId = this._getGradientId(dataset.id);
        fillStyle.fill = `url(#${gradientId})`;
      } else {
        // Use solid color with opacity
        fillStyle.fill = dataset.color;
        fillStyle.opacity = dataset.areaOpacity || this.options.areaOpacity;
      }
      
      // Create area element using current renderer
      const areaElement = this.renderer.drawPath(areaPath, {
        stroke: 'none',
        ...fillStyle,
        class: 'visioncharts-area'
      });
      
      // Track element for interaction
      this.lineChartState.pointElements.set(`area-${dataset.id}`, areaElement);
      
      this.linePerformanceMetrics.areaRenderingTime += performance.now() - areaStartTime;
      
    } catch (error) {
      console.warn(`Failed to render area for dataset ${dataset.id}:`, error);
    }
  }

  /**
   * Render dataset line with multi-renderer support
   * @private
   */
  _renderDatasetLine(dataset, datasetGroup) {
    try {
      // Generate line path using enhanced PathGenerator
      const linePath = this._generateLinePath(dataset);
      if (!linePath) return;
      
      // Create line element using current renderer
      const lineElement = this.renderer.drawPath(linePath, {
        stroke: dataset.color,
        strokeWidth: dataset.width || 1,
        fill: 'none',
        lineCap: this.options.lineCap || 'round',
        lineJoin: this.options.lineJoin || 'round',
        class: 'visioncharts-line'
      });
      
      // Track element for interaction
      this.lineChartState.pointElements.set(`line-${dataset.id}`, lineElement);
      
    } catch (error) {
      console.warn(`Failed to render line for dataset ${dataset.id}:`, error);
    }
  }

  /**
   * Render dataset points with multi-renderer support
   * @private
   */
  _renderDatasetPoints(dataset, datasetGroup, pointRadius) {
    const pointStartTime = performance.now();
    
    try {
      const { xField, yField } = this.options;
      const points = [];
      
      // Prepare point data
      dataset.data.forEach((d, index) => {
        if (d[xField] === undefined || d[yField] === undefined) return;
        
        const x = this.state.scales.x.scale(d[xField]);
        const y = this.state.scales.y.scale(d[yField]);
        
        if (isNaN(x) || isNaN(y)) return;
        
        points.push({
          cx: x,
          cy: y,
          radius: pointRadius
        });
      });
      
      // Render points using batch operation if supported
      if (this._supportsBatchRendering() && points.length > 100) {
        const pointElements = this.renderer.batchDraw('circle', points, {
          fill: '#fff',
          stroke: dataset.color,
          strokeWidth: (dataset.width || 1) / 2,
          class: 'visioncharts-point'
        });
        
        // Track elements for interaction
        pointElements.forEach((elementId, index) => {
          this.lineChartState.pointElements.set(`point-${dataset.id}-${index}`, elementId);
        });
      } else {
        // Render points individually
        points.forEach((point, index) => {
          const pointElement = this.renderer.drawCircle(point.cx, point.cy, point.radius, {
            fill: '#fff',
            stroke: dataset.color,
            strokeWidth: (dataset.width || 1) / 2,
            class: 'visioncharts-point'
          });
          
          this.lineChartState.pointElements.set(`point-${dataset.id}-${index}`, pointElement);
        });
      }
      
      this.linePerformanceMetrics.pointRenderingTime += performance.now() - pointStartTime;
      
    } catch (error) {
      console.warn(`Failed to render points for dataset ${dataset.id}:`, error);
    }
  }

  /**
   * Render study datasets using enhanced StudiesRenderer
   * @private
   */
  _renderStudyDatasets(studyDatasets, dataGroup) {
    console.log(`Rendering ${studyDatasets.length} study datasets`);
    
    try {
      // Use enhanced StudiesRenderer that supports multi-renderer
      StudiesRenderer.renderForLineChart(this, studyDatasets, dataGroup, {
        renderer: this.renderer,
        rendererType: this.rendererMetadata?.type
      });
    } catch (error) {
      console.warn('Failed to render study datasets:', error);
      
      // Fallback to basic line rendering for studies
      studyDatasets.forEach(dataset => {
        if (dataset.data && dataset.data.length > 0) {
          this._renderDatasetLine(dataset, dataGroup);
        }
      });
    }
  }

  /**
   * Render ending labels if enabled
   * @private
   */
  _renderEndingLabels(dataGroup) {
    console.log('LineChart: Rendering ending labels');
    
    try {
      if (!this.endingLabels) {
        this.endingLabels = new EndingLabels(this.options.endingLabelsConfig || {});
      }
      
      // Enhanced ending labels with renderer support
      this.endingLabels.renderForSinglePanel(this, dataGroup, {
        renderer: this.renderer,
        rendererType: this.rendererMetadata?.type
      });
    } catch (error) {
      console.warn('Failed to render ending labels:', error);
    }
  }

  // ===== PATH GENERATION METHODS =====

  /**
   * Generate line path with caching for performance
   * @private
   */
  _generateLinePath(dataset) {
    const cacheKey = `line-${dataset.id}-${this._getDataHash(dataset.data)}`;
    
    if (this.lineChartState.pathCache.has(cacheKey)) {
      return this.lineChartState.pathCache.get(cacheKey);
    }
    
    const linePath = PathGenerator.generateLinePath(dataset.data, this, this.state.scales);
    
    if (linePath) {
      this.lineChartState.pathCache.set(cacheKey, linePath);
    }
    
    return linePath;
  }

  /**
   * Generate area path with caching for performance
   * @private
   */
  _generateAreaPath(dataset) {
    const cacheKey = `area-${dataset.id}-${this._getDataHash(dataset.data)}`;
    
    if (this.lineChartState.pathCache.has(cacheKey)) {
      return this.lineChartState.pathCache.get(cacheKey);
    }
    
    const areaPath = PathGenerator.generateAreaPath(dataset.data, this, this.state.scales);
    
    if (areaPath) {
      this.lineChartState.pathCache.set(cacheKey, areaPath);
    }
    
    return areaPath;
  }

  // ===== GRADIENT MANAGEMENT =====

  /**
   * Create gradient definitions for current renderer
   * @private
   */
  _createGradientDefinitions() {
    if (!this._supportsGradients()) {
      console.log('Current renderer does not support gradients');
      return;
    }
    
    this.config.datasets.forEach(dataset => {
      if (!dataset.area) return;
      
      const gradientId = this._getGradientId(dataset.id);
      
      if (!this.lineChartState.gradientDefinitions.has(gradientId)) {
        try {
          // Create gradient based on renderer type
          if (this.rendererMetadata?.type === 'svg') {
            this._createSVGGradient(dataset, gradientId);
          } else if (this.rendererMetadata?.type === 'canvas') {
            this._createCanvasGradient(dataset, gradientId);
          }
          
          this.lineChartState.gradientDefinitions.set(gradientId, dataset.color);
        } catch (error) {
          console.warn(`Failed to create gradient for dataset ${dataset.id}:`, error);
        }
      }
    });
  }

  /**
   * Create SVG gradient definition
   * @private
   */
  _createSVGGradient(dataset, gradientId) {
    // Use SVGRenderer's gradient creation for SVG renderer
    if (this.renderer.drawGradientArea) {
      // Modern renderer approach
      return;
    }
    
    // Legacy SVG approach for backwards compatibility
    if (this.state.svg) {
      let defs = this.state.svg.querySelector('defs');
      if (!defs) {
        defs = SvgRenderer.createDefs();
        this.state.svg.insertBefore(defs, this.state.svg.firstChild);
      }
      
      if (!defs.querySelector(`#${gradientId}`)) {
        const gradient = SvgRenderer.createLinearGradient(gradientId, [
          { offset: '0%', color: dataset.color, opacity: 0.8 },
          { offset: '100%', color: dataset.color, opacity: 0.1 }
        ]);
        
        defs.appendChild(gradient);
      }
    }
  }

  /**
   * Create Canvas gradient definition
   * @private
   */
  _createCanvasGradient(dataset, gradientId) {
    // Canvas gradients are created during rendering
    // Store gradient configuration for later use
    this.lineChartState.gradientDefinitions.set(gradientId, {
      type: 'linear',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: this.state.dimensions.innerHeight,
      stops: [
        { offset: 0, color: dataset.color, opacity: 0.8 },
        { offset: 1, color: dataset.color, opacity: 0.1 }
      ]
    });
  }

  // ===== CAPABILITY DETECTION =====

  /**
   * Check if current renderer supports gradients
   * @private
   */
  _supportsGradients() {
    if (!this.renderer || !this.rendererMetadata) return false;
    
    const capabilities = this.renderer.getCapabilities ? this.renderer.getCapabilities() : {};
    return capabilities.supportsGradients === true;
  }

  /**
   * Check if current renderer supports batch rendering
   * @private
   */
  _supportsBatchRendering() {
    if (!this.renderer || !this.rendererMetadata) return false;
    
    const capabilities = this.renderer.getCapabilities ? this.renderer.getCapabilities() : {};
    return capabilities.supportsBatchOperations === true;
  }

  /**
   * Check if dataset should be clipped
   * @private
   */
  _shouldClipDataset(dataset) {
    // Always clip area fills to prevent overflow
    return dataset.area === true;
  }

  /**
   * Check if points should be shown for a dataset
   * @private
   */
  _shouldShowPoints(dataset, globalShowPoints, adaptiveRendering) {
    if (!globalShowPoints && !dataset.showPoints) return false;
    
    // Adaptive point rendering: hide points for large datasets
    if (adaptiveRendering && dataset.data && dataset.data.length > 10000) {
      console.log(`Hiding points for dataset ${dataset.id} due to large size (${dataset.data.length} points)`);
      return false;
    }
    
    return true;
  }

  // ===== PERFORMANCE OPTIMIZATION =====

  /**
   * Setup LineChart-specific optimizations
   * @private
   */
  _setupLineChartOptimizations() {
    if (!this.renderer) return;
    
    const totalDataPoints = this._getTotalDataPoints(this.config.datasets);
    
    // Apply renderer-specific optimizations
    if (this.renderer.optimizeForDataSize) {
      this.renderer.optimizeForDataSize(totalDataPoints);
    }
    
    // Enable adaptive features based on data size
    if (totalDataPoints > 50000) {
      console.log('Large dataset detected, enabling performance optimizations');
      
      // Disable expensive features for performance
      if (this.options.adaptivePointRendering && this.options.showPoints) {
        this.options.showPoints = false;
        console.log('Disabled point rendering for performance');
      }
      
      if (this.options.gradient && !this._supportsGradients()) {
        this.options.gradient = false;
        console.log('Disabled gradients (not supported by current renderer)');
      }
    }
  }

  /**
   * Get total data points across all datasets
   * @private
   */
  _getTotalDataPoints(datasets) {
    if (!datasets) return 0;
    
    return datasets.reduce((total, dataset) => {
      return total + (dataset.data ? dataset.data.length : 0);
    }, 0);
  }

  /**
   * Set clipping bounds for dataset
   * @private
   */
  _setDatasetClipping(datasetGroup, datasetId) {
    if (!this.renderer.setClipBounds) return;
    
    const clipId = `dataset-clip-${datasetId}`;
    
    if (!this.lineChartState.clippingPaths.has(clipId)) {
      this.renderer.setClipBounds(
        0,
        0,
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight
      );
      
      this.lineChartState.clippingPaths.set(clipId, true);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get gradient ID for dataset
   * @private
   */
  _getGradientId(datasetId) {
    return `area-gradient-${datasetId}`;
  }

  /**
   * Generate hash for data array (for caching)
   * @private
   */
  _getDataHash(data) {
    if (!data || !data.length) return '0';
    
    // Simple hash based on data length and first/last values
    const first = data[0];
    const last = data[data.length - 1];
    
    return `${data.length}-${JSON.stringify(first)}-${JSON.stringify(last)}`.slice(0, 32);
  }

  /**
   * Fallback to legacy SVG rendering
   * @private
   */
  _renderDataFallback() {
    console.warn('LineChart: Falling back to legacy SVG rendering');
    
    try {
      // Use original SVG-based rendering logic as fallback
      const dataGroup = SvgRenderer.createGroup({ class: 'visioncharts-data' });
      
      this.config.datasets.forEach(dataset => {
        if (!dataset.data || !dataset.data.length) return;
        
        const datasetGroup = SvgRenderer.createGroup({ 
          class: `visioncharts-dataset-${dataset.id}` 
        });
        
        // Basic line rendering
        const linePath = PathGenerator.generateLinePath(dataset.data, this);
        if (linePath) {
          const lineElement = SvgRenderer.createPath(linePath, {
            stroke: dataset.color,
            'stroke-width': dataset.width || 1,
            fill: 'none',
            class: 'visioncharts-line'
          });
          
          datasetGroup.appendChild(lineElement);
        }
        
        dataGroup.appendChild(datasetGroup);
      });
      
      if (this.state.chart && this.state.chart.appendChild) {
        this.state.chart.appendChild(dataGroup);
      }
      
    } catch (error) {
      console.error('LineChart: Even fallback rendering failed:', error);
    }
  }

  // ===== PRESERVE EXISTING PUBLIC API =====

  /**
   * Get LineChart-specific performance metrics
   * @returns {Object} Performance metrics
   */
  getLineChartMetrics() {
    return {
      ...this.getPerformanceMetrics(),
      ...this.linePerformanceMetrics,
      pathCacheSize: this.lineChartState.pathCache.size,
      gradientCount: this.lineChartState.gradientDefinitions.size
    };
  }

  /**
   * Clear internal caches (useful for memory management)
   */
  clearCaches() {
    this.lineChartState.pathCache.clear();
    this.lineChartState.pointElements.clear();
    console.log('LineChart caches cleared');
  }

  /**
   * Enhanced destroy method
   * @override
   */
  async destroy() {
    console.log('LineChart.destroy called');
    
    // Clear LineChart-specific state
    this.clearCaches();
    this.lineChartState.gradientDefinitions.clear();
    this.lineChartState.clippingPaths.clear();
    this.lineChartState.batchedElements = [];
    
    // Call parent destroy
    await super.destroy();
  }
}
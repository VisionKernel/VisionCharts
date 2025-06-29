import { LinearScale, TimeScale, LogScale } from './Scale.js';
import Axis from './Axis.js';
import InteractionManager from './InteractionManager.js';
import RendererFactory from '../renderers/RendererFactory.js';

// Legacy import for backwards compatibility
import SvgRenderer from '../renderers/SvgRenderer.js';

// Components - keep all existing component imports
import ZeroLine from '../components/ZeroLine.js';
import Tooltip from '../components/Tooltip.js';
import Legend from '../components/Legend.js';
import Crosshair from '../components/Crosshair.js';
import RecessionLines from '../components/RecessionLines.js';
import EndingLabels from '../components/EndingLabels.js';
import Grid from '../components/Grid.js';
import Panel from '../components/Panel.js';
import AverageLine from '../components/AverageLine.js';
import MedianLine from '../components/MedianLine.js';

/**
 * Chart - Enhanced multi-renderer base chart class
 * 
 * Maintains full backwards compatibility while adding multi-renderer support,
 * automatic performance optimization, and intelligent renderer switching.
 */
export default class Chart {
  constructor(config = {}) {
    console.log('Chart constructor called with multi-renderer support');
    
    // Extract and merge configuration
    this.config = this._processConfig(config);
    this.options = this._processOptions(this.config);
    
    // Multi-renderer system
    this.rendererFactory = new RendererFactory({
      enableAutoSwitching: this.options.enableAutoSwitching !== false,
      enablePerformanceMonitoring: this.options.enablePerformanceMonitoring !== false,
      performanceOptions: {
        canvasThreshold: this.options.canvasThreshold || 100000,
        svgFallbackThreshold: this.options.svgFallbackThreshold || 10000,
        autoOptimizeFeatures: this.options.autoOptimizeFeatures !== false
      }
    });
    
    // Renderer state
    this.renderer = null;
    this.rendererMetadata = null;
    this.chartId = null;
    
    // Chart state - preserve all existing state management
    this.state = {
      container: null,
      rendered: false,
      dimensions: {
        width: 0,
        height: 0,
        innerWidth: 0,
        innerHeight: 0
      },
      scales: {
        x: null,
        y: null
      },
      components: {
        axes: {
          x: null,
          y: null
        },
        legend: null,
        tooltip: null,
        crosshair: null,
        recessionLines: null,
        endingLabels: null,
        zeroLine: null,
        averageLine: null,
        medianLine: null,
        grid: null
      },
      // Legacy SVG references for backwards compatibility
      svg: null,
      chart: null
    };
    
    // Event handling - preserve existing system
    this.eventHandlers = new Map();
    this.resizeHandler = null;
    
    // Performance monitoring
    this.performanceMetrics = {
      lastRenderTime: 0,
      averageRenderTime: 0,
      renderCount: 0
    };
    
    // Backwards compatibility flags
    this.isLegacyMode = this.options.legacyMode === true;
    
    console.log('Chart initialized with multi-renderer support');
  }

  /**
   * Initialize chart with container - enhanced with renderer creation
   * @param {HTMLElement|string} container - Chart container
   * @returns {Chart} This chart instance
   */
  init(container) {
    console.log('Chart.init called');
    
    // Resolve container
    this.state.container = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
      
    if (!this.state.container) {
      throw new Error('Chart container not found');
    }
    
    // Update dimensions
    this.updateDimensions();
    
    // Bind resize handler
    this.bindEvents();
    
    return this;
  }

  /**
   * Enhanced render method with multi-renderer support
   * @returns {Chart} This chart instance
   */
  async render() {
    console.log('Chart.render called with multi-renderer support');
    
    if (!this.state.container) {
      console.error('Cannot render chart: container is null');
      return this;
    }
    
    const startTime = performance.now();
    
    try {
      // Clear container
      this.state.container.innerHTML = '';
      
      // Create optimal renderer if not exists
      if (!this.renderer) {
        await this._createOptimalRenderer();
      }
      
      // Create rendering surface (replaces createSvg)
      await this._createRenderingSurface();
      
      if (!this.state.chart) {
        console.error('Failed to create rendering surface');
        return this;
      }
      
      console.log('About to render chart content');
      
      // Render based on view mode - preserve existing logic
      if (this.options.isPanelView) {
        await this._renderPanelView();
      } else {
        await this._renderSingleView();
      }
      
      // Start performance monitoring
      this._startPerformanceMonitoring();
      
      // Update performance metrics
      const renderTime = performance.now() - startTime;
      this._updatePerformanceMetrics(renderTime);
      
      this.state.rendered = true;
      
      console.log(`Chart rendered successfully in ${renderTime.toFixed(2)}ms using ${this.rendererMetadata?.type} renderer`);
      
      return this;
      
    } catch (error) {
      console.error('Chart render failed:', error);
      
      // Attempt fallback rendering
      if (!this.isLegacyMode) {
        console.log('Attempting fallback to legacy SVG rendering');
        return this._renderLegacyFallback();
      }
      
      throw error;
    }
  }

  /**
   * Update chart with new data or options
   * @param {Object} newConfig - New configuration
   * @returns {Chart} This chart instance
   */
  async update(newConfig = {}) {
    console.log('Chart.update called');
    
    // Merge new configuration
    if (Object.keys(newConfig).length > 0) {
      this.config = { ...this.config, ...newConfig };
      this.options = this._processOptions(this.config);
    }
    
    // Check if renderer switch is needed
    await this._checkRendererOptimality();
    
    // Update dimensions if container size changed
    this.updateDimensions();
    
    // Re-render
    return this.render();
  }

  /**
   * Force renderer switch
   * @param {string} rendererType - Target renderer type ('svg', 'canvas', 'webgl')
   * @param {string} reason - Reason for switch
   * @returns {Promise<boolean>} Success status
   */
  async switchRenderer(rendererType, reason = 'Manual request') {
    if (!this.chartId) {
      console.warn('Cannot switch renderer: chart not initialized');
      return false;
    }
    
    console.log(`Chart.switchRenderer: Switching to ${rendererType} - ${reason}`);
    
    const success = await this.rendererFactory.switchRenderer(this.chartId, rendererType, reason);
    
    if (success) {
      // Update local references
      const newMetadata = this.rendererFactory.getRendererInfo(this.chartId);
      this.renderer = newMetadata?.instance;
      this.rendererMetadata = newMetadata;
      
      // Re-render with new renderer
      await this.render();
    }
    
    return success;
  }

  /**
   * Get current renderer information
   * @returns {Object} Renderer information
   */
  getRendererInfo() {
    return this.rendererFactory.getRendererInfo(this.chartId);
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance data
   */
  getPerformanceMetrics() {
    const factoryMetrics = this.rendererFactory.getPerformanceAnalysis(this.chartId);
    return {
      ...this.performanceMetrics,
      ...factoryMetrics
    };
  }

  /**
   * Force performance optimization
   * @returns {Array} Applied optimizations
   */
  optimizePerformance() {
    return this.rendererFactory.optimizePerformance(this.chartId);
  }

  // ===== ENHANCED RENDERING METHODS =====

  /**
   * Create optimal renderer based on chart requirements
   * @private
   */
  async _createOptimalRenderer() {
    console.log('Creating optimal renderer');
    
    const rendererResult = await this.rendererFactory.createRenderer(
      this.state.container,
      this.state.dimensions.width,
      this.state.dimensions.height,
      this.config,
      {
        backgroundColor: this.options.backgroundColor,
        antialiasing: this.options.antialiasing !== false
      }
    );
    
    this.renderer = rendererResult.renderer;
    this.rendererMetadata = rendererResult.metadata;
    this.chartId = rendererResult.chartId;
    
    console.log(`Created ${this.rendererMetadata.type} renderer`);
  }

  /**
   * Create rendering surface (replaces createSvg)
   * @private
   */
  async _createRenderingSurface() {
    console.log('Creating rendering surface');
    
    if (!this.renderer) {
      throw new Error('No renderer available');
    }
    
    // Clear renderer
    this.renderer.clear(this.options.backgroundColor);
    
    // Create main chart group with margins
    const chartGroup = this.renderer.createGroup({
      transform: `translate(${this.options.margins.left},${this.options.margins.top})`,
      class: 'visioncharts-chart'
    });
    
    // Update state references
    this.state.chart = chartGroup;
    
    // For backwards compatibility, create legacy SVG references
    if (this.rendererMetadata.type === 'svg') {
      this.state.svg = this.renderer.svg;
    } else {
      // Create a mock SVG object for components that expect it
      this.state.svg = {
        appendChild: (element) => {
          // Redirect to renderer for non-SVG renderers
          console.warn('Legacy SVG appendChild called on non-SVG renderer');
        },
        getAttribute: () => null,
        setAttribute: () => {},
        style: {}
      };
    }
    
    console.log('Rendering surface created');
  }

  /**
   * Render single view mode
   * @private
   */
  async _renderSingleView() {
    console.log('Rendering single view');
    
    // Create scales - preserve existing logic
    this.createScales();
    
    // Render title
    this.renderTitle();
    
    // Render legend
    this.renderLegend();
    
    // Render axes
    this.renderAxes();
    
    // Render data (implemented by subclasses)
    if (this.renderData) {
      this.renderData();
    }
    
    // Render chart features
    this._renderChartFeatures();
    
    // Setup interactions
    this._setupInteractions();
  }

  /**
   * Render panel view mode
   * @private
   */
  async _renderPanelView() {
    console.log('Rendering panel view');
    
    // Create scales for overall chart
    this.createScales();
    
    // Render title
    this.renderTitle();
    
    // Render legend
    this.renderLegend();
    
    // Render panels (preserve existing Panel logic)
    this.renderPanels();
    
    // Setup interactions for panels
    this._setupInteractions();
  }

  /**
   * Render chart features (zero line, recession lines, etc.)
   * @private
   */
  _renderChartFeatures() {
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    // Zero line - renderer-agnostic
    if (this.options.showZeroLine && this.state.scales.y) {
      if (!this.state.components.zeroLine) {
        this.state.components.zeroLine = new ZeroLine({
          color: this.options.zeroLineColor || '#666666',
          width: this.options.zeroLineWidth || 1,
          opacity: this.options.zeroLineOpacity || 0.7
        });
      }
      
      this.state.components.zeroLine.render(this, innerWidth, innerHeight);
    }
    
    // Recession lines - renderer-agnostic
    if (this.options.showRecessionLines && this.state.scales.x) {
      if (!this.state.components.recessionLines) {
        this.state.components.recessionLines = new RecessionLines(this.options.recessionLinesOptions || {});
      }
      
      this.state.components.recessionLines.render(this, this.state.scales.x, innerHeight, innerWidth, this.options);
    }
    
    // Statistical lines (average, median) - renderer-agnostic
    this._renderStatisticalLines();
  }

  /**
   * Render statistical lines (average, median)
   * @private
   */
  _renderStatisticalLines() {
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    if (this.options.showAverageLine && this.config.datasets) {
      if (!this.state.components.averageLine) {
        this.state.components.averageLine = new AverageLine(this.options.averageLineConfig || {});
      }
      
      this.state.components.averageLine.render(this, innerWidth, innerHeight);
    }
    
    if (this.options.showMedianLine && this.config.datasets) {
      if (!this.state.components.medianLine) {
        this.state.components.medianLine = new MedianLine(this.options.medianLineConfig || {});
      }
      
      this.state.components.medianLine.render(this, innerWidth, innerHeight);
    }
  }

  /**
   * Setup interactions - enhanced for multi-renderer
   * @private
   */
  _setupInteractions() {
    // Setup tooltip - renderer-agnostic
    if (this.options.showTooltips !== false) {
      if (!this.state.components.tooltip) {
        this.state.components.tooltip = new Tooltip(this.options.tooltipConfig || {});
      }
    }
    
    // Setup crosshair - renderer-agnostic
    if (this.options.showCrosshair) {
      if (!this.state.components.crosshair) {
        this.state.components.crosshair = new Crosshair(this.options.crosshairConfig || {});
      }
      
      this.state.components.crosshair.render(this);
    }
    
    // Setup interaction manager - enhanced for multi-renderer
    InteractionManager.setup(this);
  }

  // ===== PRESERVE ALL EXISTING CHART METHODS =====

  /**
   * Create scales - preserved existing logic
   */
  createScales() {
    console.log('createScales called');
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    // Create X scale
    if (this.options.xType === 'time') {
      this.state.scales.x = new TimeScale();
    } else {
      this.state.scales.x = new LinearScale();
    }
    
    // Create Y scale
    if (this.options.isLogarithmic) {
      this.state.scales.y = new LogScale();
    } else {
      this.state.scales.y = new LinearScale();
    }
    
    // Configure scales with data
    this._configureScales(innerWidth, innerHeight);
    
    console.log('Scales created successfully');
  }

  /**
   * Configure scales with data - preserved existing logic
   * @private
   */
  _configureScales(width, height) {
    if (!this.config.datasets || !Array.isArray(this.config.datasets)) {
      console.warn('No datasets found for scale configuration');
      return;
    }
    
    const { xField, yField } = this.options;
    const allData = [];
    
    // Collect all data points
    this.config.datasets.forEach(dataset => {
      if (dataset.data && Array.isArray(dataset.data)) {
        allData.push(...dataset.data);
      }
    });
    
    if (allData.length === 0) {
      console.warn('No data points found for scale configuration');
      return;
    }
    
    // Configure X scale
    const xExtent = this._getDataExtent(allData, xField);
    this.state.scales.x.domain(xExtent).range([0, width]);
    
    // Configure Y scale
    const yExtent = this._getDataExtent(allData, yField);
    this.state.scales.y.domain(yExtent).range([height, 0]);
  }

  /**
   * Get data extent for a field - preserved existing logic
   * @private
   */
  _getDataExtent(data, field) {
    const values = data
      .map(d => d[field])
      .filter(v => v != null && !isNaN(v));
    
    if (values.length === 0) return [0, 1];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Add padding
    const padding = (max - min) * 0.05 || 1;
    return [min - padding, max + padding];
  }

  /**
   * Render title - enhanced for multi-renderer
   */
  renderTitle() {
    console.log('renderTitle called');
    
    if (!this.options.title) return;
    
    const x = this.state.dimensions.width / 2;
    const y = 25;
    
    // Use renderer to draw title
    this.renderer.drawText(this.options.title, x, y, {
      textAnchor: 'middle',
      fontSize: '16px',
      fontWeight: 'bold',
      fontFamily: this.options.fontFamily,
      fill: this.options.textColor,
      class: 'visioncharts-title'
    });
    
    this.renderAxisNames();
  }

  /**
   * Render axis names - enhanced for multi-renderer
   */
  renderAxisNames() {
    console.log('renderAxisNames called');
    
    const { xAxisName, yAxisName } = this.options;
    const { width, height, innerWidth, innerHeight } = this.state.dimensions;
    const { left, top } = this.options.margins;
    
    // X-axis name
    if (xAxisName) {
      this.renderer.drawText(xAxisName, left + innerWidth / 2, height - 10, {
        textAnchor: 'middle',
        fontSize: '14px',
        fontFamily: this.options.fontFamily,
        fill: this.options.textColor,
        class: 'visioncharts-axis-name x-axis-name'
      });
    }
    
    // Y-axis name
    if (yAxisName) {
      this.renderer.save();
      this.renderer.translate(15, top + innerHeight / 2);
      this.renderer.transform(0, -1, 1, 0, 0, 0); // Rotate 90 degrees
      
      this.renderer.drawText(yAxisName, 0, 0, {
        textAnchor: 'middle',
        fontSize: '14px',
        fontFamily: this.options.fontFamily,
        fill: this.options.textColor,
        class: 'visioncharts-axis-name y-axis-name'
      });
      
      this.renderer.restore();
    }
  }

  /**
   * Clean up axes when switching renderers
   */
  _cleanupAxes() {
    if (this.state.components.axes?.x && this.renderer) {
      this.state.components.axes.x.clear(this.renderer);
    }
    
    if (this.state.components.axes?.y && this.renderer) {
      this.state.components.axes.y.clear(this.renderer);
    }
  }

  /**
   * Create and configure axes - enhanced for multi-renderer
   */
  createAxes() {
    console.log('createAxes called');
    
    // Initialize axes storage
    this.state.components.axes = {
      x: null,
      y: null
    };
    
    // Create X axis
    if (this.state.scales.x) {
      const xAxisOptions = {
        orientation: 'bottom',
        scale: this.state.scales.x,
        tickCount: this.options.xTickCount || 5,
        tickFormat: this.options.xTickFormat,
        formatType: this.options.xType === 'time' ? 'time' : 'number',
        formatOptions: this.options.xFormatOptions || {},
        label: this.options.xAxisName || '',
        isLogarithmic: false,
        showTickLabels: this.options.showXLabels !== false,
        tickRotation: this.options.xTickRotation || 0,
        showAxisLabel: false, // Chart.js handles axis names separately
        
        // Grid options - enable if chart grid is enabled
        grid: this.options.grid?.show || false,
        gridStyle: {
          stroke: this.options.grid?.color || '#e0e0e0',
          strokeWidth: this.options.grid?.width || 1,
          strokeDasharray: this.options.grid?.dashArray || '4,4'
        },
        
        // Styling
        axisColor: this.options.axisColor || '#000000',
        tickColor: this.options.tickColor || '#000000',
        labelColor: this.options.textColor || '#000000',
        labelFontFamily: this.options.fontFamily || 'sans-serif'
      };
      
      this.state.components.axes.x = new Axis(xAxisOptions);
    }
    
    // Create Y axis
    if (this.state.scales.y) {
      const yAxisOptions = {
        orientation: 'left',
        scale: this.state.scales.y,
        tickCount: this.options.yTickCount || 5,
        tickFormat: this.options.yTickFormat,
        formatType: this.options.yType === 'time' ? 'time' : 'number',
        formatOptions: this.options.yFormatOptions || {},
        label: this.options.yAxisName || '',
        isLogarithmic: this.options.isLogarithmic || false,
        showTickLabels: this.options.showYLabels !== false,
        tickRotation: this.options.yTickRotation || 0,
        showAxisLabel: false, // Chart.js handles axis names separately
        
        // Grid options - enable if chart grid is enabled
        grid: this.options.grid?.show || false,
        gridStyle: {
          stroke: this.options.grid?.color || '#e0e0e0',
          strokeWidth: this.options.grid?.width || 1,
          strokeDasharray: this.options.grid?.dashArray || '4,4'
        },
        
        // Styling
        axisColor: this.options.axisColor || '#000000',
        tickColor: this.options.tickColor || '#000000',
        labelColor: this.options.textColor || '#000000',
        labelFontFamily: this.options.fontFamily || 'sans-serif'
      };
      
      this.state.components.axes.y = new Axis(yAxisOptions);
    }
  }

  /**
   * Handle renderer switching - update axes
   */
  async _onRendererSwitch(newRenderer, oldRenderer) {
    console.log('Chart._onRendererSwitch: Updating axes for new renderer');
    
    // Clean up axes from old renderer
    if (oldRenderer && this.state.components.axes) {
      if (this.state.components.axes.x) {
        this.state.components.axes.x.clear(oldRenderer);
      }
      if (this.state.components.axes.y) {
        this.state.components.axes.y.clear(oldRenderer);
      }
    }
    
    // Update renderer reference
    this.renderer = newRenderer;
    
    // Re-render axes with new renderer
    if (this.state.rendered) {
      this.renderAxes();
    }
  }

  /**
   * Render axes - enhanced for multi-renderer
   */
  renderAxes() {
    console.log('renderAxes called');
    
    if (!this.renderer || !this.renderer.isInitialized) {
      console.error('Cannot render axes: renderer not available');
      return;
    }
    
    this.createAxes();
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    const { left, top } = this.options.margins;
    
    // Render X axis
    if (this.state.components.axes.x) {
      const xAxisId = this.state.components.axes.x.render(
        this.renderer, 
        innerWidth, 
        innerHeight, 
        { translateX: left, translateY: top }
      );
      console.log(`X axis rendered with ID: ${xAxisId}`);
    }
    
    // Render Y axis
    if (this.state.components.axes.y) {
      const yAxisId = this.state.components.axes.y.render(
        this.renderer, 
        innerWidth, 
        innerHeight, 
        { translateX: left, translateY: top }
      );
      console.log(`Y axis rendered with ID: ${yAxisId}`);
    }
    
    // Render grid if enabled (now handled by axis grid option)
    if (this.options.grid?.show && !this.state.components.axes.x?.options.grid) {
      // Only render separate grid if axes don't have grid enabled
      this._renderSeparateGrid();
    }
  }

  /**
   * Update axes - enhanced for multi-renderer
   */
  updateAxes() {
    console.log('updateAxes called');
    
    if (!this.state.rendered || !this.renderer) {
      console.warn('Cannot update axes: chart not rendered or renderer not available');
      return;
    }
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    const { left, top } = this.options.margins;
    
    // Update X axis
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setScale(this.state.scales.x);
      this.state.components.axes.x.setOptions({
        formatType: this.options.xType === 'time' ? 'time' : 'number',
        formatOptions: this.options.xFormatOptions || {}
      });
      
      const xAxisId = this.state.components.axes.x.update(
        this.renderer, 
        innerWidth, 
        innerHeight, 
        { translateX: left, translateY: top }
      );
      console.log(`X axis updated with ID: ${xAxisId}`);
    }
    
    // Update Y axis
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setScale(this.state.scales.y);
      this.state.components.axes.y.setOptions({
        isLogarithmic: this.options.isLogarithmic || false,
        formatType: this.options.yType === 'time' ? 'time' : 'number',
        formatOptions: this.options.yFormatOptions || {}
      });
      
      const yAxisId = this.state.components.axes.y.update(
        this.renderer, 
        innerWidth, 
        innerHeight, 
        { translateX: left, translateY: top }
      );
      console.log(`Y axis updated with ID: ${yAxisId}`);
    }
  }



  /**
   * Render legend - enhanced for multi-renderer
   */
  renderLegend() {
    console.log('renderLegend called');
    
    if (!this.options.showLegend || !this.config.datasets) return;
    
    if (!this.state.components.legend) {
      this.state.components.legend = new Legend(this.options.legendConfig || {});
    }
    
    // Create legend items from datasets
    const legendItems = this.config.datasets.map(dataset => ({
      name: dataset.name || dataset.id,
      color: dataset.color || '#1468a8',
      type: dataset.type || (this.options.chartType === 'line' ? 'line' : 'rect')
    }));
    
    this.state.components.legend.setItems(legendItems);
    this.state.components.legend.render(
      this.state.chart || this.state.container,
      this.state.dimensions.width,
      this.state.dimensions.height
    );
  }

  /**
   * Render panels - preserved existing Panel logic
   */
  renderPanels() {
    console.log('renderPanels called');
    
    if (!this.config.datasets || !Array.isArray(this.config.datasets)) {
      console.warn('No datasets available for panel rendering');
      return;
    }
    
    // Use existing Panel component but ensure renderer compatibility
    Panel.renderForChart(this, {
      ...this.options,
      renderer: this.renderer,
      rendererType: this.rendererMetadata?.type
    });
  }

  // ===== PRESERVE ALL EXISTING PUBLIC API METHODS =====

  /**
   * Toggle logarithmic scale
   */
  toggleLogarithmic(isLogarithmic = null) {
    this.options.isLogarithmic = isLogarithmic !== null ? isLogarithmic : !this.options.isLogarithmic;
    return this.update();
  }

  /**
   * Toggle panel view
   */
  togglePanelView(isPanelView = null) {
    this.options.isPanelView = isPanelView !== null ? isPanelView : !this.options.isPanelView;
    return this.update();
  }

  /**
   * Toggle recession lines
   */
  toggleRecessionLines(show = null) {
    this.options.showRecessionLines = show !== null ? show : !this.options.showRecessionLines;
    return this.update();
  }

  /**
   * Toggle zero line
   */
  toggleZeroLine(show = null) {
    this.options.showZeroLine = show !== null ? show : !this.options.showZeroLine;
    return this.update();
  }

  /**
   * Set X axis name
   */
  setXAxisName(name) {
    this.options.xAxisName = name;
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setOptions({ label: name });
      this.state.components.axes.x.update(
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight
      );
    }
    return this;
  }

  /**
   * Set Y axis name
   */
  setYAxisName(name) {
    this.options.yAxisName = name;
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setOptions({ label: name });
      this.state.components.axes.y.update(
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight
      );
    }
    return this;
  }

  /**
   * Filter data by date range
   */
  filterByDate(startDate, endDate) {
    if (!this.config.datasets) return this;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    this.config.datasets.forEach(dataset => {
      if (dataset.data && dataset._originalData === undefined) {
        dataset._originalData = [...dataset.data];
      }
      
      if (dataset._originalData) {
        dataset.data = dataset._originalData.filter(d => {
          const date = new Date(d.date || d.x);
          return date >= start && date <= end;
        });
      }
    });
    
    return this.update();
  }

  /**
   * Reset data filter
   */
  resetFilter() {
    if (!this.config.datasets) return this;
    
    this.config.datasets.forEach(dataset => {
      if (dataset._originalData) {
        dataset.data = [...dataset._originalData];
        delete dataset._originalData;
      }
    });
    
    return this.update();
  }

  /**
   * Add dataset
   */
  addDataset(dataset) {
    if (!this.config.datasets) {
      this.config.datasets = [];
    }
    
    this.config.datasets.push(dataset);
    return this.update();
  }

  /**
   * Remove dataset
   */
  removeDataset(datasetId) {
    if (!this.config.datasets) return this;
    
    this.config.datasets = this.config.datasets.filter(d => d.id !== datasetId);
    return this.update();
  }

  /**
   * Update dataset
   */
  updateDataset(datasetId, newData) {
    if (!this.config.datasets) return this;
    
    const dataset = this.config.datasets.find(d => d.id === datasetId);
    if (dataset) {
      Object.assign(dataset, newData);
    }
    
    return this.update();
  }

  /**
   * Export chart
   */
  async exportSVG() {
    if (this.renderer && typeof this.renderer.export === 'function') {
      return this.renderer.export('svg');
    }
    
    // Fallback for legacy compatibility
    if (this.state.svg) {
      return new XMLSerializer().serializeToString(this.state.svg);
    }
    
    throw new Error('Export not supported by current renderer');
  }

  /**
   * Export as PNG
   */
  async exportPNG(scale = 1) {
    if (this.renderer && typeof this.renderer.export === 'function') {
      return this.renderer.export('png');
    }
    
    throw new Error('PNG export not supported by current renderer');
  }

  // ===== UTILITY AND LIFECYCLE METHODS =====

  /**
   * Update dimensions
   */
  updateDimensions() {
    if (!this.state.container) return;
    
    const rect = this.state.container.getBoundingClientRect();
    const width = this.options.width || rect.width || 800;
    const height = this.options.height || rect.height || 400;
    
    this.state.dimensions = {
      width,
      height,
      innerWidth: width - this.options.margins.left - this.options.margins.right,
      innerHeight: height - this.options.margins.top - this.options.margins.bottom
    };
    
    // Resize renderer if it exists
    if (this.renderer) {
      this.renderer.resize(width, height);
    }
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    if (this.resizeHandler) return;
    
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    
    console.log('Resize event handler bound');
  }

  /**
   * Handle window resize
   */
  handleResize() {
    console.log('handleResize called');
    
    if (!this.options.width || !this.options.height) {
      this.updateDimensions();
      
      if (this.state.rendered) {
        this.update();
      }
    }
  }

  /**
   * Destroy chart and cleanup resources
   */
  async destroy() {
    console.log('Chart.destroy called');
    
    // Stop performance monitoring
    if (this.chartId) {
      this.rendererFactory.stopMonitoring(this.chartId);
    }
    
    // Cleanup components
    Object.values(this.state.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    
    // Cleanup renderer
    if (this.chartId) {
      await this.rendererFactory.destroyRenderer(this.chartId);
    }
    
    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // Clear references
    this.renderer = null;
    this.rendererMetadata = null;
    this.chartId = null;
    this.state.container = null;
    this.state.rendered = false;
    
    console.log('Chart destroyed');
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Process chart configuration
   * @private
   */
  _processConfig(config) {
    const defaultConfig = {
      chartType: 'line',
      chartLibrary: 'VisionCharts',
      title: '',
      xAxisName: '',
      yAxisName: '',
      isLogarithmic: false,
      isPanelView: false,
      showRecessionLines: false,
      showZeroLine: false,
      showPoints: false,
      showEndingLabels: false,
      showLegend: true,
      showTooltips: true,
      studies: [],
      datasets: []
    };
    
    return { ...defaultConfig, ...config };
  }

  /**
   * Process chart options
   * @private
   */
  _processOptions(config) {
    const defaultOptions = {
      width: null,
      height: null,
      margins: { top: 40, right: 40, bottom: 60, left: 60 },
      backgroundColor: '#ffffff',
      textColor: '#333333',
      fontFamily: 'Arial, sans-serif',
      xField: 'x',
      yField: 'y',
      xType: 'number',
      yType: 'number',
      
      // Multi-renderer options
      enableAutoSwitching: true,
      enablePerformanceMonitoring: true,
      canvasThreshold: 100000,
      svgFallbackThreshold: 10000,
      autoOptimizeFeatures: true,
      legacyMode: false,
      
      // Performance options
      antialiasing: true,
      
      ...config
    };
    
    return defaultOptions;
  }

  /**
   * Check if renderer switch is needed based on data changes
   * @private
   */
  async _checkRendererOptimality() {
    if (!this.chartId || !this.rendererFactory) return;
    
    const currentInfo = this.rendererFactory.getRendererInfo(this.chartId);
    if (!currentInfo) return;
    
    // Analyze current requirements
    const dataPoints = this._countDataPoints();
    const currentType = currentInfo.type;
    
    // Check if we need to switch based on data size
    if (dataPoints >= this.options.canvasThreshold && currentType !== 'webgl') {
      console.log(`Data size (${dataPoints}) exceeds canvas threshold, switching to WebGL`);
      await this.switchRenderer('webgl', 'Data size exceeded Canvas threshold');
    } else if (dataPoints < this.options.svgFallbackThreshold && currentType !== 'svg' && this.options.enableSvgFallback) {
      console.log(`Small dataset (${dataPoints}), considering SVG renderer`);
      await this.switchRenderer('svg', 'Small dataset - SVG optimal');
    }
  }

  /**
   * Count total data points
   * @private
   */
  _countDataPoints() {
    if (!this.config.datasets) return 0;
    
    return this.config.datasets.reduce((total, dataset) => {
      return total + (dataset.data ? dataset.data.length : 0);
    }, 0);
  }

  /**
   * Start performance monitoring
   * @private
   */
  _startPerformanceMonitoring() {
    if (this.chartId && this.options.enablePerformanceMonitoring) {
      this.rendererFactory.startMonitoring(this.chartId, this);
    }
  }

  /**
   * Update performance metrics
   * @private
   */
  _updatePerformanceMetrics(renderTime) {
    this.performanceMetrics.lastRenderTime = renderTime;
    this.performanceMetrics.renderCount++;
    
    // Calculate rolling average
    if (this.performanceMetrics.renderCount === 1) {
      this.performanceMetrics.averageRenderTime = renderTime;
    } else {
      const weight = Math.min(10, this.performanceMetrics.renderCount);
      this.performanceMetrics.averageRenderTime = 
        (this.performanceMetrics.averageRenderTime * (weight - 1) + renderTime) / weight;
    }
  }

  /**
   * Render using legacy SVG fallback
   * @private
   */
  async _renderLegacyFallback() {
    console.warn('Using legacy SVG fallback rendering');
    
    this.isLegacyMode = true;
    
    // Create SVG directly
    const svg = SvgRenderer.createSvg(this.state.dimensions.width, this.state.dimensions.height);
    SvgRenderer.applyStyles(svg, { background: this.options.backgroundColor });
    
    const chart = SvgRenderer.createGroup({
      transform: `translate(${this.options.margins.left},${this.options.margins.top})`,
      class: 'visioncharts-chart'
    });
    
    svg.appendChild(chart);
    this.state.container.appendChild(svg);
    
    this.state.svg = svg;
    this.state.chart = chart;
    
    // Render using legacy methods
    await this._renderSingleView();
    
    this.state.rendered = true;
    return this;
  }
}
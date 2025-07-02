import { LinearScale, TimeScale, LogScale } from './Scale.js';
import Axis from './Axis.js';
import EventSystem from './EventSystem.js';
import InteractionManager from './InteractionManager.js';
import RendererFactory from '../renderers/RendererFactory.js';

// Multi-renderer components
import Tooltip from '../components/Tooltip.js';
import Legend from '../components/Legend.js';
import Crosshair from '../components/Crosshair.js';

// Other components - keep all existing component imports
import ZeroLine from '../components/ZeroLine.js';
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
 * 
 * Key Features:
 * - Automatic renderer selection (Canvas default, WebGL at 100K+ points)
 * - Multi-renderer component system (Axis, Tooltip, Legend, Crosshair)
 * - Intelligent renderer switching based on data size
 * - Performance monitoring and optimization
 * - Full backwards compatibility with existing VisionCharts code
 */
export default class Chart {
  /**
 * Chart constructor - Enhanced with multi-renderer support
 * @param {Object} config - Chart configuration
 */
constructor(config = {}) {
  console.log('Chart constructor called with comprehensive multi-renderer support');
  
  // Extract and validate configuration
  this.config = {
    container: null,
    data: [],
    datasets: [],
    ...config
  };
  
  // Extract container from config (CRITICAL FIX)
  const containerElement = this.config.container;
  
  // Validate container immediately
  if (!containerElement) {
    throw new Error('Chart configuration must include a valid container element');
  }
  
  if (!(containerElement instanceof HTMLElement)) {
    throw new Error('Container must be a valid HTMLElement. Received: ' + typeof containerElement);
  }
  
  if (!document.contains(containerElement)) {
    console.warn('Container element is not attached to the DOM');
  }
  
  // Merge options with defaults
  this.options = {
    // Default options
    width: null,
    height: null,
    backgroundColor: '#ffffff',
    antialiasing: true,
    
    // Margins
    margins: {
      top: 20,
      right: 20,
      bottom: 40,
      left: 50
    },
    
    // Multi-renderer options
    legacyMode: false,
    coordinatedInteractions: true,
    
    // Merge provided options
    ...this.config.options
  };
  
  // Initialize core systems
  this.rendererFactory = new RendererFactory({
    defaultRenderer: 'canvas',
    enableAutoSwitching: true,
    enablePerformanceMonitoring: true
  });
  
  this.eventSystem = new EventSystem();
  this.interactionManager = new InteractionManager();
  
  // Initialize state with CONTAINER SET
  this.state = {
    container: containerElement,  // SET FROM CONFIG - THIS IS THE FIX!
    rendered: false,
    initializing: false,
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
      // Multi-renderer components
      axes: {
        x: null,
        y: null
      },
      legend: null,
      tooltip: null,
      crosshair: null,
      
      // Traditional components
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
  
  // Rest of your existing constructor initialization...
  this.componentInitializationState = {
    axis: false,
    tooltip: false,
    legend: false,
    crosshair: false
  };
  
  // Event handling - preserve existing system
  this.eventHandlers = new Map();
  this.resizeHandler = null;
  
  // Interaction system handlers
  this.interactionHandlers = [];
  this.legendInteractionHandlers = [];
  this.crosshairInteractionHandlers = [];
  
  // Performance monitoring
  this.performanceMetrics = {
    lastRenderTime: 0,
    averageRenderTime: 0,
    renderCount: 0,
    lastRendererSwitch: 0,
    componentInitTime: 0
  };
  
  // Component performance tracking
  this.componentMetrics = {
    axis: { lastRenderTime: 0, updateCount: 0 },
    tooltip: { showCount: 0, averageShowTime: 0 },
    legend: { lastRenderTime: 0, itemCount: 0 },
    crosshair: { updateCount: 0, averageUpdateTime: 0 }
  };
  
  // Renderer switching state
  this.rendererSwitching = {
    inProgress: false,
    pendingSwitch: null,
    lastSwitchReason: null
  };
  
  // Backwards compatibility flags
  this.isLegacyMode = this.options.legacyMode === true;
  this.legacyComponents = new Set();
  
  // Dataset highlighting state (for legend interactions)
  this.datasetHighlightState = new Map();
  
  // Component coordination flags
  this.coordinatedInteractions = this.options.coordinatedInteractions !== false;
  
  console.log('Chart initialized with comprehensive multi-renderer support');
  console.log('Container element:', this.state.container);
}

  // ===== CORE INITIALIZATION METHODS =====

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
    
    // Set up resize handling
    this._setupResizeHandling();
    
    console.log('Chart initialized with container');
    return this;
  }

  /**
   * Main render method - enhanced with multi-renderer support
   * @returns {Promise<Chart>} This chart instance
   */
  async render() {
    console.log('Chart.render called with comprehensive multi-renderer support');
    
    const startTime = performance.now();
    
    try {
        // 1. Setup core rendering infrastructure (CORRECT ORDER)
        await this._setupCoreRendering(); // ✅ This method has the correct order
        
        // 2. Initialize multi-renderer components (after renderer and scales exist)
        await this._initializeMultiRendererComponents();
        
        // 3. Render chart content
        await this._renderChartContent();
        
        // 4. Setup interactions (after everything is rendered)
        await this._setupCoordinatedInteractions();
        
        // Update state
        this.state.rendered = true;
        this.state.initializing = false;
        
        // Update metrics
        const renderTime = performance.now() - startTime;
        this._updatePerformanceMetrics(renderTime);
        
        console.log(`Chart rendered successfully in ${renderTime.toFixed(2)}ms`);
        
        return this;
        
    } catch (error) {
        this.state.initializing = false;
        console.error('Chart render failed:', error);
        throw error;
    }
}

  /**
   * Setup core rendering infrastructure
   * @private
   */
  async _setupCoreRendering() {
    console.log('Setting up core rendering infrastructure');
    
    // Update dimensions
    this.updateDimensions();
    
    // Create optimal renderer
    await this._createOptimalRenderer();
    
    // Create rendering surface
    await this._createRenderingSurface();
    
    // Create scales
    this.createScales();
  }

  /**
   * Initialize all multi-renderer components
   * @private
   */
  async _initializeMultiRendererComponents() {
    console.log('Initializing multi-renderer components');
    
    const componentStartTime = performance.now();
    
    // Initialize components in dependency order
    const initPromises = [];
    
    // 1. Initialize Tooltip (no dependencies)
    if (this.options.showTooltips !== false) {
      initPromises.push(this._initializeTooltip());
    }
    
    // 2. Initialize Legend (no dependencies)
    if (this.options.showLegend !== false && this.config.datasets) {
      initPromises.push(this._initializeLegend());
    }
    
    // 3. Initialize Crosshair (may depend on data for snapping)
    if (this.options.showCrosshair !== false) {
      initPromises.push(this._initializeCrosshair());
    }
    
    // Wait for all component initializations
    await Promise.all(initPromises);
    
    // Update metrics
    this.performanceMetrics.componentInitTime = performance.now() - componentStartTime;
    
    console.log(`Multi-renderer components initialized in ${this.performanceMetrics.componentInitTime.toFixed(2)}ms`);
  }

  /**
   * Render chart content
   * @private
   */
  async _renderChartContent() {
    console.log('Rendering chart content');
    
    // Render in optimal order for performance
    
    // 1. Render title
    this.renderTitle();
    
    // 2. Render axes (creates coordinate system)
    this.renderAxes();
    
    // 3. Render data (implemented by subclasses)
    if (this.renderData) {
      this.renderData();
    }
    
    // 4. Render chart features (zero line, recession lines, etc.)
    this._renderChartFeatures();
    
    // 5. Render multi-renderer components
    await this._renderMultiRendererComponents();
  }

  /**
   * Render all multi-renderer components
   * @private
   */
  async _renderMultiRendererComponents() {
    console.log('Rendering multi-renderer components');
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    const { left, top } = this.options.margins;
    
    // Render Legend (affects layout, so render first)
    if (this.state.components.legend) {
      await this._renderLegendComponent();
    }
    
    // Render Crosshair (overlay, render before tooltip)
    if (this.state.components.crosshair) {
      await this._renderCrosshairComponent();
    }
    
    // Note: Tooltip is rendered on-demand during interactions
  }

  /**
   * Setup coordinated interaction system
   * @private
   */
  async _setupCoordinatedInteractions() {
    console.log('Setting up coordinated interaction system');
    
    if (!this.coordinatedInteractions) {
      console.log('Coordinated interactions disabled');
      return;
    }
    
    // Initialize complete interaction system
    await InteractionManager.initCompleteInteractionSystem(this);
    
    // Setup renderer switch event handlers
    this._setupRendererSwitchHandlers();
    
    console.log('Coordinated interaction system initialized');
  }

  /**
   * Finalize rendering with optimizations
   * @private
   */
  async _finalizeRendering() {
    console.log('Finalizing rendering');
    
    // Apply final optimizations
    if (this.options.autoOptimizeFeatures) {
      this._applyRenderingOptimizations();
    }
    
    // Check renderer optimality
    await this._checkRendererOptimality();
    
    // Setup performance monitoring
    if (this.options.enablePerformanceMonitoring) {
      this._setupPerformanceMonitoring();
    }
  }

  // ===== MULTI-RENDERER COMPONENT INITIALIZATION =====

  /**
   * Initialize Tooltip component
   * @private
   */
  async _initializeTooltip() {
    console.log('Initializing Tooltip component');
    
    try {
      // Create tooltip with enhanced options
      this.state.components.tooltip = new Tooltip({
        followCursor: this.options.tooltip?.followCursor !== false,
        offset: this.options.tooltip?.offset || { x: 15, y: 10 },
        
        // Styling
        background: this.options.tooltip?.background || '#ffffff',
        border: this.options.tooltip?.border || '#cccccc',
        borderWidth: this.options.tooltip?.borderWidth || 1,
        borderRadius: this.options.tooltip?.borderRadius || 4,
        fontSize: this.options.tooltip?.fontSize || 12,
        fontFamily: this.options.fontFamily || 'sans-serif',
        textColor: this.options.tooltip?.textColor || '#333333',
        boxShadow: this.options.tooltip?.boxShadow || '0 2px 8px rgba(0,0,0,0.15)',
        
        // Content
        maxWidth: this.options.tooltip?.maxWidth || 300,
        multiline: this.options.tooltip?.multiline !== false,
        formatter: this.options.tooltip?.formatter || this._createTooltipFormatter(),
        
        // Performance
        showDelay: this.options.tooltip?.showDelay || 0,
        hideDelay: this.options.tooltip?.hideDelay || 100,
        throttleMove: this.options.tooltip?.throttleMove || 16,
        
        // Renderer optimization
        preferHTMLOverlay: this.options.tooltip?.preferHTMLOverlay
      });
      
      // Initialize with current renderer
      const success = await this.state.components.tooltip.initialize(
        this.renderer, 
        this.state.container
      );
      
      if (success) {
        this.componentInitializationState.tooltip = true;
        console.log('Tooltip component initialized successfully');
      } else {
        console.error('Failed to initialize Tooltip component');
      }
      
    } catch (error) {
      console.error('Error initializing Tooltip component:', error);
    }
  }

  /**
   * Initialize Legend component
   * @private
   */
  async _initializeLegend() {
    console.log('Initializing Legend component');
    
    try {
      // Create legend component
      this.state.components.legend = new Legend({
        position: this.options.legend?.position || 'bottom',
        align: this.options.legend?.align || 'center',
        orientation: this.options.legend?.orientation || 'horizontal',
        
        // Styling from chart options
        fontSize: this.options.legend?.fontSize || 12,
        fontFamily: this.options.fontFamily || 'sans-serif',
        textColor: this.options.textColor || '#333333',
        
        // Background
        showBackground: this.options.legend?.showBackground !== false,
        backgroundColor: this.options.legend?.backgroundColor || '#ffffff',
        borderColor: this.options.legend?.borderColor || '#e0e0e0',
        
        // Interactivity
        interactive: this.options.legend?.interactive !== false,
        clickToToggle: this.options.legend?.clickToToggle !== false,
        
        // Studies
        showStudyBadges: this.options.legend?.showStudyBadges !== false,
        showStudyTooltips: this.options.legend?.showStudyTooltips !== false,
        
        // Layout
        wrapText: this.options.legend?.wrapText !== false,
        maxWidth: this.options.legend?.maxWidth,
        
        // Renderer preference
        preferHTMLOverlay: this.options.legend?.preferHTMLOverlay
      });
      
      // Initialize with current renderer
      const success = await this.state.components.legend.initialize(
        this.renderer, 
        this.state.container
      );
      
      if (success) {
        // Create legend items from datasets
        const legendItems = this._createLegendItems();
        this.state.components.legend.setItems(legendItems);
        
        this.componentInitializationState.legend = true;
        console.log(`Legend component initialized with ${legendItems.length} items`);
      } else {
        console.error('Failed to initialize Legend component');
      }
      
    } catch (error) {
      console.error('Error initializing Legend component:', error);
    }
  }

  /**
   * Initialize Crosshair component
   * @private
   */
  async _initializeCrosshair() {
    console.log('Initializing Crosshair component');
    
    try {
      // Create crosshair component
      this.state.components.crosshair = new Crosshair({
        showX: this.options.crosshair?.showX !== false,
        showY: this.options.crosshair?.showY || false,
        
        // Styling
        stroke: this.options.crosshair?.color || '#666666',
        strokeWidth: this.options.crosshair?.width || 1,
        strokeDasharray: this.options.crosshair?.dashArray || '4,4',
        opacity: this.options.crosshair?.opacity || 0.8,
        
        // Behavior
        snapToData: this.options.crosshair?.snapToData !== false,
        snapDistance: this.options.crosshair?.snapDistance || 20,
        followCursor: this.options.crosshair?.followCursor !== false,
        
        // Animation
        animationDuration: this.options.crosshair?.animationDuration || 150,
        smoothMovement: this.options.crosshair?.smoothMovement !== false,
        
        // Renderer preferences
        preferHTMLOverlay: this.options.crosshair?.preferHTMLOverlay,
        useCanvasOverlay: this.options.crosshair?.useCanvasOverlay,
        
        // Performance
        throttleUpdates: this.options.crosshair?.throttleUpdates || 16,
        
        // Advanced features
        glowEffect: this.options.crosshair?.glowEffect || false,
        glowColor: this.options.crosshair?.glowColor || '#ffffff',
        glowBlur: this.options.crosshair?.glowBlur || 3
      });
      
      // Initialize with current renderer
      const success = await this.state.components.crosshair.initialize(
        this.renderer,
        this.state.container,
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight
      );
      
      if (success) {
        // Set up data points for snapping if chart has data
        this._updateCrosshairDataPoints();
        
        this.componentInitializationState.crosshair = true;
        console.log('Crosshair component initialized successfully');
      } else {
        console.error('Failed to initialize Crosshair component');
      }
      
    } catch (error) {
      console.error('Error initializing Crosshair component:', error);
    }
  }

  // ===== MULTI-RENDERER COMPONENT RENDERING =====

  /**
   * Render Legend component
   * @private
   */
  async _renderLegendComponent() {
    if (!this.state.components.legend || !this.state.components.legend.isInitialized) {
      return;
    }
    
    const { width, height } = this.state.dimensions;
    const margins = this.options.margins;
    
    // Render legend
    const legendId = this.state.components.legend.render(width, height, {
      translateX: margins.left,
      translateY: margins.top
    });
    
    // Update metrics
    const metrics = this.state.components.legend.getPerformanceMetrics();
    this.componentMetrics.legend = {
      lastRenderTime: metrics.lastRenderTime,
      itemCount: metrics.itemCount
    };
    
    console.log(`Legend rendered with ID: ${legendId}`);
  }

  /**
   * Render Crosshair component
   * @private
   */
  async _renderCrosshairComponent() {
    if (!this.state.components.crosshair || !this.state.components.crosshair.isInitialized) {
      return;
    }
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    const margins = this.options.margins;
    
    // For SVG mode, we need to call renderSVG
    if (this.state.components.crosshair.renderMode === 'svg') {
      const crosshairId = this.state.components.crosshair.renderSVG(innerWidth, innerHeight, {
        translateX: margins.left,
        translateY: margins.top
      });
      
      console.log(`Crosshair rendered in SVG mode with ID: ${crosshairId}`);
    } else {
      // For Canvas/HTML overlay modes, crosshair is already rendered during initialization
      console.log(`Crosshair ready in ${this.state.components.crosshair.renderMode} mode`);
    }
    
    // Update metrics
    const metrics = this.state.components.crosshair.getPerformanceMetrics();
    this.componentMetrics.crosshair = {
      updateCount: metrics.updateCount,
      averageUpdateTime: metrics.averageUpdateTime
    };
  }

  // ===== ENHANCED AXIS RENDERING =====

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
  
  // Render X axis (bottom of chart)
  if (this.state.components.axes.x) {
    const xAxisId = this.state.components.axes.x.render(
      this.renderer, 
      innerWidth, 
      innerHeight, 
      { translateX: 0, translateY: innerHeight }  // Position at bottom
    );
    console.log(`X axis rendered with ID: ${xAxisId}`);
  }
  
  // Render Y axis (left side of chart)
  if (this.state.components.axes.y) {
    const yAxisId = this.state.components.axes.y.render(
      this.renderer, 
      innerWidth, 
      innerHeight, 
      { translateX: 0, translateY: 0 }  // Position at left
    );
    console.log(`Y axis rendered with ID: ${yAxisId}`);
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

  // ===== RENDERER MANAGEMENT =====

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
    this.state.chartGroup = chartGroup;
    
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
        style: {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }
    
    console.log('Rendering surface created');
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
    
    if (this.rendererSwitching.inProgress) {
      console.warn('Renderer switch already in progress');
      return false;
    }
    
    console.log(`Chart.switchRenderer: Switching to ${rendererType} - ${reason}`);
    
    this.rendererSwitching.inProgress = true;
    this.rendererSwitching.lastSwitchReason = reason;
    
    try {
      const success = await this.rendererFactory.switchRenderer(this.chartId, rendererType, reason);
      
      if (success) {
        // Update local references
        const newMetadata = this.rendererFactory.getRendererInfo(this.chartId);
        const oldRenderer = this.renderer;
        
        this.renderer = newMetadata?.instance;
        this.rendererMetadata = newMetadata;
        
        // Update all multi-renderer components
        await this._handleRendererSwitch(this.renderer, oldRenderer);
        
        // Re-render with new renderer
        await this.render();
        
        // Update metrics
        this.performanceMetrics.lastRendererSwitch = Date.now();
      }
      
      return success;
      
    } finally {
      this.rendererSwitching.inProgress = false;
    }
  }

  /**
   * Handle renderer switch for all components
   * @private
   */
  async _handleRendererSwitch(newRenderer, oldRenderer) {
    console.log('Handling comprehensive renderer switch for all components');
    
    // Handle all interaction components
    await InteractionManager.handleAllInteractionRendererSwitch(this, newRenderer, oldRenderer);
    
    // Handle axes
    await this._handleAxesRendererSwitch(newRenderer, oldRenderer);
    
    console.log('All components updated for new renderer');
  }

  /**
   * Handle axes renderer switch
   * @private
   */
  async _handleAxesRendererSwitch(newRenderer, oldRenderer) {
    // Clear axes from old renderer
    if (oldRenderer && this.state.components.axes) {
      if (this.state.components.axes.x) {
        this.state.components.axes.x.clear(oldRenderer);
      }
      if (this.state.components.axes.y) {
        this.state.components.axes.y.clear(oldRenderer);
      }
    }
    
    // Axes will be re-rendered in the next render cycle
    console.log('Axes updated for renderer switch');
  }

  /**
   * Check if renderer switch is needed based on current data
   * @private
   */
  async _checkRendererOptimality() {
    if (!this.options.enableAutoSwitching || this.rendererSwitching.inProgress) {
      return;
    }
    
    const dataPointCount = this._countDataPoints();
    const currentRenderer = this.rendererMetadata?.type;
    
    // VisionCharts policy: Canvas default, WebGL at 100K+
    let optimalRenderer = 'canvas';
    
    if (dataPointCount >= 100000) {
      // Check if WebGL is available
      if (this.rendererFactory.capabilityManager.isRendererSupported('webgl')) {
        optimalRenderer = 'webgl';
      }
    }
    
    if (currentRenderer !== optimalRenderer) {
      console.log(`Data size (${dataPointCount} points) suggests switching from ${currentRenderer} to ${optimalRenderer}`);
      
      // Auto-switch renderer
      await this.switchRenderer(optimalRenderer, `Data size optimization (${dataPointCount} points)`);
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Create legend items from datasets
   * @private
   */
  _createLegendItems() {
    if (!this.config.datasets) return [];
    
    return this.config.datasets.map((dataset, index) => {
      // Count studies if applicable
      let studyCount = 0;
      let studyNames = '';
      let studies = [];
      
      if (dataset.studies && Array.isArray(dataset.studies)) {
        studies = dataset.studies;
        studyCount = studies.length;
        studyNames = studies.map(study => study.name || study.type).join(', ');
      }
      
      return {
        id: dataset.id || `dataset-${index}`,
        label: dataset.name || dataset.label || `Series ${index + 1}`,
        color: dataset.color || this.options.colors?.[index] || '#1468a8',
        visible: dataset.visible !== false,
        type: this._determineLegendSymbolType(dataset),
        studyCount: studyCount,
        studyNames: studyNames,
        studies: studies,
        dataset: dataset, // Reference to original dataset
        index: index
      };
    });
  }

  /**
   * Determine legend symbol type
   * @private
   */
  _determineLegendSymbolType(dataset) {
    // Check dataset-specific type first
    if (dataset.type) {
      return dataset.type === 'line' ? 'line' : 'rect';
    }
    
    // Check chart type
    if (this.options.chartType === 'line') {
      return 'line';
    } else if (this.options.chartType === 'bar') {
      return 'rect';
    }
    
    // Default fallback
    return 'rect';
  }

  /**
   * Update crosshair data points for snapping
   * @private
   */
  _updateCrosshairDataPoints() {
    if (!this.state.components.crosshair || !this.config.datasets) return;
    
    const dataPoints = [];
    
    // Collect all data points from all datasets
    this.config.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.visible) return;
      
      dataset.data.forEach(point => {
        if (!point || point[this.options.xField] === undefined || point[this.options.yField] === undefined) {
          return;
        }
        
        // Convert data point to screen coordinates
        const screenX = this.state.scales.x?.scale(point[this.options.xField]);
        const screenY = this.state.scales.y?.scale(point[this.options.yField]);
        
        if (screenX !== undefined && screenY !== undefined) {
          dataPoints.push({
            x: screenX,
            y: screenY,
            data: point,
            dataset: dataset
          });
        }
      });
    });
    
    // Set data points for crosshair snapping
    this.state.components.crosshair.setDataPoints(dataPoints);
    
    console.log(`Updated crosshair with ${dataPoints.length} data points for snapping`);
  }

  /**
   * Create default tooltip formatter
   * @private
   */
  _createTooltipFormatter() {
    return (data) => {
      try {
        if (!data) return ['No data'];
        
        const lines = [];
        
        // Handle array of data points (multi-dataset)
        if (Array.isArray(data)) {
          // Add date/time header if available
          if (data.length > 0 && this.options.xType === 'time') {
            const firstPoint = data[0].point;
            if (firstPoint && firstPoint.x) {
              const date = firstPoint.x instanceof Date ? firstPoint.x : new Date(firstPoint.x);
              lines.push(`📅 ${date.toLocaleDateString()}`);
              lines.push(''); // Empty line for spacing
            }
          }
          
          data.forEach((item, index) => {
            const line = this._formatTooltipItem(item, index);
            if (line) lines.push(line);
          });
        } else {
          // Handle single data point
          const line = this._formatTooltipItem(data, 0);
          if (line) lines.push(line);
        }
        
        return lines.length > 0 ? lines : ['No data to display'];
        
      } catch (error) {
        console.error('Tooltip formatter error:', error);
        return ['Error formatting tooltip'];
      }
    };
  }

  /**
   * Format individual tooltip item
   * @private
   */
  _formatTooltipItem(item, index) {
    if (!item) return null;
    
    // Extract dataset and point information
    const dataset = item.dataset || item;
    const point = item.point || item;
    
    // Get dataset name
    const datasetName = dataset.name || dataset.label || `Series ${index + 1}`;
    
    // Format value
    let value = point.y !== undefined ? point.y : point.value;
    if (value === undefined && point[this.options.yField]) {
      value = point[this.options.yField];
    }
    
    // Format the value based on chart type and options
    const formattedValue = this._formatTooltipValue(value);
    
    // Add additional context for time series
    if (this.options.xType === 'time' && point.x !== undefined) {
      const date = point.x instanceof Date ? point.x : new Date(point.x);
      const dateStr = date.toLocaleDateString();
      return `${datasetName}: ${formattedValue} (${dateStr})`;
    }
    
    return `${datasetName}: ${formattedValue}`;
  }

  /**
   * Format tooltip value based on chart configuration
   * @private
   */
  _formatTooltipValue(value) {
    if (value === null || value === undefined) return 'N/A';
    
    if (typeof value !== 'number') return String(value);
    
    // Use chart's Y-axis formatting if available
    if (this.options.yTickFormat && typeof this.options.yTickFormat === 'function') {
      return this.options.yTickFormat(value);
    }
    
    // Use format type if specified
    if (this.options.yType === 'percent') {
      return (value * 100).toFixed(1) + '%';
    }
    
    if (this.options.yType === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }
    
    // Default number formatting
    if (Math.abs(value) >= 1000000000) {
      return (value / 1000000000).toFixed(1) + 'B';
    } else if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (Math.abs(value) < 1 && value !== 0) {
      return value.toPrecision(3);
    } else {
      return value.toFixed(value % 1 === 0 ? 0 : 2);
    }
  }

  /**
   * Count total data points in all datasets
   * @private
   */
  _countDataPoints() {
    let totalPoints = 0;
    
    if (this.config.datasets && Array.isArray(this.config.datasets)) {
      this.config.datasets.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          totalPoints += dataset.data.length;
        }
      });
    }
    
    return totalPoints;
  }

  // ===== PERFORMANCE AND OPTIMIZATION =====

  /**
   * Update performance metrics
   * @private
   */
  _updatePerformanceMetrics(renderTime) {
    this.performanceMetrics.renderCount++;
    this.performanceMetrics.lastRenderTime = renderTime;
    this.performanceMetrics.averageRenderTime = 
      (this.performanceMetrics.averageRenderTime * (this.performanceMetrics.renderCount - 1) + renderTime) / 
      this.performanceMetrics.renderCount;
  }

  /**
   * Apply rendering optimizations
   * @private
   */
  _applyRenderingOptimizations() {
    // Apply renderer-specific optimizations
    if (this.renderer && this.renderer.optimize) {
      this.renderer.optimize();
    }
    
    // Apply component-specific optimizations
    Object.values(this.state.components).forEach(component => {
      if (component && component.optimize) {
        component.optimize();
      }
    });
    
    console.log('Rendering optimizations applied');
  }

  /**
   * Setup performance monitoring
   * @private
   */
  _setupPerformanceMonitoring() {
    // Monitor for performance issues and auto-switch renderers if needed
    setInterval(() => {
      this._checkRendererOptimality();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Setup renderer switch event handlers
   * @private
   */
  _setupRendererSwitchHandlers() {
    // Listen for automatic renderer switches
    if (this.rendererFactory && typeof this.rendererFactory.addEventListener === 'function') {
      this.rendererFactory.addEventListener('renderer-switched', (event) => {  // ✅ FIXED
        if (event.chartId === this.chartId) {
          console.log(`Chart renderer automatically switched: ${event.reason}`);
          // Optional: Re-render chart with new renderer
          // this.render();
        }
      });
      
      // Also listen for renderer creation events
      this.rendererFactory.addEventListener('renderer-created', (event) => {
        if (event.chartId === this.chartId) {
          console.log(`Chart renderer created: ${event.rendererType}`);
        }
      });
    }
  }

  // ===== UPDATE AND LIFECYCLE METHODS =====

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
    
    // Update crosshair data points
    this._updateCrosshairDataPoints();
    
    // Update legend items
    if (this.state.components.legend && this.config.datasets) {
      const legendItems = this._createLegendItems();
      this.state.components.legend.setItems(legendItems);
    }
    
    // Re-render
    return this.render();
  }

  /**
   * Resize chart to new dimensions
   * @param {number} width - New width (optional, will auto-detect if not provided)
   * @param {number} height - New height (optional, will auto-detect if not provided)
   * @returns {Chart} This chart instance
   */
  async resize(width, height) {
    console.log('Chart.resize called');
    
    // Update dimensions
    if (width && height) {
      this.state.dimensions.width = width;
      this.state.dimensions.height = height;
    } else {
      this.updateDimensions();
    }
    
    // Update inner dimensions
    this.state.dimensions.innerWidth = this.state.dimensions.width - this.options.margins.left - this.options.margins.right;
    this.state.dimensions.innerHeight = this.state.dimensions.height - this.options.margins.top - this.options.margins.bottom;
    
    // Resize renderer
    if (this.renderer) {
      this.renderer.resize(this.state.dimensions.width, this.state.dimensions.height);
    }
    
    // Update crosshair dimensions
    if (this.state.components.crosshair) {
      this.state.components.crosshair.resize(this.state.dimensions.innerWidth, this.state.dimensions.innerHeight);
    }
    
    // Re-render
    return this.render();
  }

  /**
   * Clean up and destroy chart
   */
  destroy() {
    console.log('Chart.destroy called');
    
    // Clean up all interaction components
    InteractionManager.cleanupAllInteractions(this);
    
    // Clean up axes
    if (this.state.components.axes) {
      if (this.state.components.axes.x && this.renderer) {
        this.state.components.axes.x.destroy(this.renderer);
      }
      if (this.state.components.axes.y && this.renderer) {
        this.state.components.axes.y.destroy(this.renderer);
      }
    }
    
    // Clean up renderer
    if (this.chartId && this.rendererFactory) {
      this.rendererFactory.destroyRenderer(this.chartId);
    }

    if (this.resizeObserver) {
    this.resizeObserver.disconnect();
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // Clear all event handlers
    this.eventHandlers.clear();
    
    // Clear references
    this.renderer = null;
    this.rendererMetadata = null;
    this.chartId = null;
    this.state.container = null;
    this.config = null;
    
    console.log('Chart destroyed');
  }

  // ===== UTILITY METHODS (PRESERVE EXISTING) =====
  
  /**
   * Process configuration object
   * @private
   */
  _processConfig(config) {
    return {
      datasets: [],
      ...config
    };
  }

  /**
   * Process options from configuration
   * @private
   */
  _processOptions(config) {
    return {
      // Default options
      width: null,
      height: null,
      margins: { top: 20, right: 30, bottom: 40, left: 50 },
      backgroundColor: '#ffffff',
      fontFamily: 'sans-serif',
      textColor: '#333333',
      
      // Data field mappings
      xField: 'x',
      yField: 'y',
      xType: 'number',
      yType: 'number',
      
      // Component visibility
      showTooltips: true,
      showLegend: true,
      showCrosshair: true,
      
      // Performance options
      enableAutoSwitching: true,
      enablePerformanceMonitoring: true,
      canvasThreshold: 100000,
      autoOptimizeFeatures: true,
      
      // Interaction options
      coordinatedInteractions: true,
      
      // Merge with provided options
      ...config
    };
  }

  /**
   * Update dimensions from container
   */
  updateDimensions() {
  if (!this.state.container) return;
  
  const rect = this.state.container.getBoundingClientRect();
  
  // IMPORTANT: Use container's INNER dimensions (excluding padding)
  const computedStyle = getComputedStyle(this.state.container);
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
  
  // Calculate available space inside container
  const availableWidth = rect.width - paddingLeft - paddingRight;
  const availableHeight = rect.height - paddingTop - paddingBottom;
  
  // Set dimensions to fill available space
  this.state.dimensions.width = this.options.width || Math.max(availableWidth, 100);
  this.state.dimensions.height = this.options.height || Math.max(availableHeight, 100);
  
  this.state.dimensions.innerWidth = this.state.dimensions.width - this.options.margins.left - this.options.margins.right;
  this.state.dimensions.innerHeight = this.state.dimensions.height - this.options.margins.top - this.options.margins.bottom;
  
  // CRITICAL: Update the actual rendering element size
  this._updateRendererSize();
}

_updateRendererSize() {
  if (!this.renderer || !this.renderer.element) return;
  
  const { width, height } = this.state.dimensions;
  
  // Update the SVG/Canvas element to match calculated dimensions
  if (this.renderer.element.tagName === 'svg') {
    this.renderer.element.setAttribute('width', width);
    this.renderer.element.setAttribute('height', height);
    this.renderer.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
  } else if (this.renderer.element.tagName === 'CANVAS') {
    this.renderer.element.width = width;
    this.renderer.element.height = height;
    this.renderer.element.style.width = width + 'px';
    this.renderer.element.style.height = height + 'px';
  }
}

  /**
   * Setup resize handling
   * @private
   */
  _setupResizeHandling() {
  // Use ResizeObserver for better performance
  if (window.ResizeObserver) {
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const oldWidth = this.state.dimensions.width;
        const oldHeight = this.state.dimensions.height;
        
        this.updateDimensions();
        
        if (this.state.dimensions.width !== oldWidth || this.state.dimensions.height !== oldHeight) {
          this.resize();
        }
      }
    });
    
    this.resizeObserver.observe(this.state.container);
  } else {
    // Fallback to window resize
    this.resizeHandler = () => {
      const oldWidth = this.state.dimensions.width;
      const oldHeight = this.state.dimensions.height;
      
      this.updateDimensions();
      
      if (this.state.dimensions.width !== oldWidth || this.state.dimensions.height !== oldHeight) {
        this.resize();
      }
    };
    
    window.addEventListener('resize', this.resizeHandler);
  }
}

  // ===== RENDERING METHODS (TO BE IMPLEMENTED BY SUBCLASSES) =====

  /**
   * Create scales (to be implemented by subclasses)
   */
  createScales() {
    // Default implementation - subclasses should override
    console.log('createScales called - should be implemented by subclass');
  }

  /**
   * Render title
   */
  renderTitle() {
    if (!this.options.title) return;
    
    const titleX = this.state.dimensions.width / 2;
    const titleY = 20;
    
    this.renderer.drawText(this.options.title, titleX, titleY, {
      textAnchor: 'middle',
      fontSize: '16px',
      fontWeight: 'bold',
      fontFamily: this.options.fontFamily,
      fill: this.options.textColor,
      class: 'visioncharts-title'
    });
  }

  /**
   * Render chart features (zero line, recession lines, etc.)
   * @private
   */
  _renderChartFeatures() {
    // Zero line
    if (this.options.showZeroLine && this.state.scales.y) {
      if (!this.state.components.zeroLine) {
        this.state.components.zeroLine = new ZeroLine();
      }
      
      this.state.components.zeroLine.render(
        this.state.chart,
        this.state.scales.y,
        this.state.dimensions.innerWidth,
        this.options
      );
    }
    
    // Recession lines
    if (this.options.showRecessionLines && this.state.scales.x) {
      if (!this.state.components.recessionLines) {
        this.state.components.recessionLines = new RecessionLines();
      }
      
      this.state.components.recessionLines.render(
        this.state.chart,
        this.state.scales.x,
        this.state.dimensions.innerHeight,
        this.options
      );
    }
    
    // Additional features can be added here
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get current renderer information
   * @returns {Object} Renderer information
   */
  getRendererInfo() {
    return this.rendererFactory.getRendererInfo(this.chartId);
  }

  /**
   * Get comprehensive performance metrics
   * @returns {Object} Performance data
   */
  getPerformanceMetrics() {
    const factoryMetrics = this.rendererFactory.getPerformanceAnalysis?.(this.chartId) || {};
    
    return {
      chart: this.performanceMetrics,
      components: this.componentMetrics,
      renderer: factoryMetrics,
      initialization: {
        componentInitTime: this.performanceMetrics.componentInitTime,
        tooltipInitialized: this.componentInitializationState.tooltip,
        legendInitialized: this.componentInitializationState.legend,
        crosshairInitialized: this.componentInitializationState.crosshair
      },
      dataPoints: this._countDataPoints(),
      rendererType: this.rendererMetadata?.type,
      isLegacyMode: this.isLegacyMode
    };
  }

  /**
   * Force performance optimization
   * @returns {Array} Applied optimizations
   */
  optimizePerformance() {
    const optimizations = [];
    
    // Renderer optimizations
    if (this.rendererFactory.optimizePerformance) {
      const rendererOpts = this.rendererFactory.optimizePerformance(this.chartId);
      optimizations.push(...rendererOpts);
    }
    
    // Component optimizations
    this._applyRenderingOptimizations();
    optimizations.push('Component optimizations applied');
    
    return optimizations;
  }

  /**
   * Show tooltip at specific position
   * @param {Object} data - Tooltip data
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  showTooltip(data, x, y) {
    if (this.state.components.tooltip) {
      this.state.components.tooltip.show(data, x, y, {
        width: this.state.dimensions.width,
        height: this.state.dimensions.height
      });
    }
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.state.components.tooltip) {
      this.state.components.tooltip.hide();
    }
  }

  /**
   * Show crosshair at specific position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  showCrosshair(x, y) {
    if (this.state.components.crosshair) {
      this.state.components.crosshair.show(x, y);
    }
  }

  /**
   * Hide crosshair
   */
  hideCrosshair() {
    if (this.state.components.crosshair) {
      this.state.components.crosshair.hide();
    }
  }

  /**
   * Toggle component visibility
   * @param {string} component - Component name ('tooltip', 'legend', 'crosshair')
   * @param {boolean} visible - Visibility state
   */
  toggleComponent(component, visible) {
    if (this.state.components[component]) {
      if (visible) {
        this.state.components[component].show?.();
      } else {
        this.state.components[component].hide?.();
      }
    }
  }
}
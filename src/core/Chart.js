/**
 * Chart.js - Enhanced Base Chart Class with Multi-Renderer Support
 * 
 * Foundation class for all chart types in VisionCharts.
 * Handles automatic renderer selection (Canvas 2D vs WebGL) based on dataset size.
 */

import { Axis } from './Axis.js';
import { Scale, ScaleManager } from './Scale.js';
import { Grid } from '../components/Grid.js';
import CanvasRenderer from '../renderers/CanvasRenderer.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CoordinateSystem } from '../utils/CoordinateSystem.js';
import { DataProcessor } from '../utils/DataProcessor.js';
import { PathGenerator } from '../utils/PathGenerator.js';

export class Chart {
  constructor(config = {}) {
    this.container = this._resolveContainer(config.container);
    this.config = {
      data: config.data || [],
      options: {
        // Default options
        width: 800,
        height: 400,
        title: config.options?.title || '', // Chart title
        xAxisName: 'X Axis',
        yAxisName: 'Y Axis',
        xField: 'x',
        yField: 'y',
        xType: 'time', // 'time', 'number', 'category'
        yType: 'number',
        margin: { top: 40, right: 60, bottom: 60, left: 80 },
        
        // Title styling options
        titleFontSize: 16,
        titleFontFamily: 'Arial, sans-serif',
        titleFontWeight: 'bold',
        titleColor: '#333333',
        titlePadding: 10, // Space between title and chart area
        
        // Grid options
        showGrid: true,
        showXGrid: true,
        showYGrid: true,
        gridColor: '#e0e0e0',
        gridOpacity: 0.7,
        gridDash: [], // [] for solid, [5, 5] for dashed
        
        // Renderer options
        forceRenderer: null, // 'canvas', 'webgl', or null for auto
        
        ...config.options
      }
    };

    this.dataProcessor = new DataProcessor({
      strictValidation: false,
      autoDetectTimeFormat: true,
      sortByTime: true,
      removeDuplicates: true
    });

    this.pathGenerator = new PathGenerator({
      curve: 'linear',
      enableOptimization: true
    });

    this.generatedPaths = null;
    
    // Multi-renderer infrastructure
    this.renderers = new Map(); // Holds renderer instances
    this.activeRenderer = null;
    this.rendererInstance = null;
    this.svgOverlay = null;
    
    // Performance monitoring
    this.dataPointCount = 0;
    this.performanceThresholds = {
      canvas: 50000, // Switch to WebGL after 50K points
      webgl: 100000  // WebGL upper limit
    };
    
    // Component state
    this.axes = { x: null, y: null };
    this.chartArea = { x: 0, y: 0, width: 0, height: 0 };
    this.dataDomains = { x: [0, 1], y: [0, 1] };

    // Scale management
    this.scaleManager = new ScaleManager();
    this.scales = { x: null, y: null };

    // Coordinate system for data transformations
    this.coordinateSystem = null;
    this.transformedData = null; // Store transformed data for renderers
    
    // Grid component
    this.grid = null;
    
    // Title element reference
    this.titleElement = null;
    
    // Initialization state
    this.isInitialized = false;
    
    // Initialize
    this._initPromise = this._initialize();
  }
  
  /**
   * Resolve container from selector or element
   */
  _resolveContainer(container) {
    if (typeof container === 'string') {
      const element = document.querySelector(container) || document.getElementById(container.replace('#', ''));
      if (!element) {
        throw new Error(`Container not found: ${container}`);
      }
      return element;
    }
    
    if (container && container.nodeType === Node.ELEMENT_NODE) {
      return container;
    }
    
    throw new Error('Invalid container provided');
  }
  
  /**
   * Initialize the chart infrastructure
   */
  async _initialize() {
    try {
      // Clear container
      this.container.innerHTML = '';
      
      // Set up container styling
      this.container.style.position = 'relative';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      
      // Calculate dimensions
      this._calculateDimensions();
      
      // Set up rendering layers
      this._setupRenderingLayers();
      
      // Process data
      await this._processData();
      
      // Calculate data domains
      this._calculateDataDomains();
      
      // Create scales
      this._createScales();
      
      // Create coordinate system
      this._createCoordinateSystem();
      
      // Create grid
      this._createGrid();
      
      // Create axes
      this._createAxes();

      // Create coordinate system
      this._createCoordinateSystem();
      
      // Choose and initialize optimal renderer
      await this._selectAndInitializeRenderer();
      
      this.isInitialized = true;
      console.log('Chart initialization complete with', this.activeRenderer, 'renderer');
      
    } catch (error) {
      console.error('Chart initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate chart dimensions based on container
   */
  _calculateDimensions() {
    const containerRect = this.container.getBoundingClientRect();
    
    this.config.options.width = containerRect.width || this.config.options.width;
    this.config.options.height = containerRect.height || this.config.options.height;
    
    const margin = this.config.options.margin;
    this.chartArea = {
      x: margin.left,
      y: margin.top,
      width: this.config.options.width - margin.left - margin.right,
      height: this.config.options.height - margin.top - margin.bottom
    };
  }
  
  /**
   * Set up the hybrid rendering layers
   */
  _setupRenderingLayers() {
    // Create separate canvas for grid (needed for WebGL compatibility)
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = this.config.options.width;
    this.gridCanvas.height = this.config.options.height;
    this.gridCanvas.style.position = 'absolute';
    this.gridCanvas.style.top = '0';
    this.gridCanvas.style.left = '0';
    this.gridCanvas.style.zIndex = '0'; // Behind data layer
    
    // Create canvas for data rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.options.width;
    this.canvas.height = this.config.options.height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '1';
    
    // Create SVG overlay for UI elements (axes, labels, title, etc.)
    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgOverlay.setAttribute('width', this.config.options.width);
    this.svgOverlay.setAttribute('height', this.config.options.height);
    this.svgOverlay.style.position = 'absolute';
    this.svgOverlay.style.top = '0';
    this.svgOverlay.style.left = '0';
    this.svgOverlay.style.zIndex = '2';
    this.svgOverlay.style.pointerEvents = 'none'; // Allow interaction to pass through to canvas
    
    // Add to container in correct order
    this.container.appendChild(this.gridCanvas);
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.svgOverlay);
  }
  
  /**
   * Process and count data points
   */
  async _processData() {
    try {
      console.log('Processing raw data with DataProcessor...');
      
      // Use DataProcessor to clean and validate data
      this.config.data = await this.dataProcessor.processDatasets(this.config.data, {
        strictValidation: false,
        fillGaps: false,
        removeOutliers: false
      });
      
      // Count total data points after processing
      this.dataPointCount = 0;
      if (Array.isArray(this.config.data)) {
        this.config.data.forEach(dataset => {
          if (dataset.data && Array.isArray(dataset.data)) {
            this.dataPointCount += dataset.data.length;
          }
        });
      }
      
      console.log(`DataProcessor: Cleaned data, ${this.dataPointCount} total points`);
      
    } catch (error) {
      console.error('Error processing data:', error);
      throw error;
    }
  }
  
  /**
   * Calculate data domains for axes
   */
  _calculateDataDomains() {
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    
    // Collect all data points from all datasets
    const allData = Array.isArray(this.config.data) ? 
      this.config.data.flatMap(dataset => dataset.data || []) : 
      [];
    
    for (const point of allData) {
      const x = this._getXValue(point);
      const y = this._getYValue(point);
      
      if (x != null && !isNaN(x)) {
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
      }
      
      if (y != null && !isNaN(y)) {
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
    
    // Handle edge cases
    if (xMin === Infinity) { xMin = 0; xMax = 1; }
    if (yMin === Infinity) { yMin = 0; yMax = 1; }
    
    // Store raw domains (scales will handle padding and nice numbers)
    this.dataDomains = {
      x: [xMin, xMax],
      y: [yMin, yMax]
    };
  }
  
  /**
   * Create scale instances
   */
  _createScales() {
    // Determine scale types
    const xScaleType = this.config.options.isLogarithmic ? 'log' : 'linear';
    const yScaleType = this.config.options.isLogarithmic ? 'log' : 'linear';
    
    // X Scale
    this.scales.x = new Scale({
      type: xScaleType,
      domain: [...this.dataDomains.x],
      range: [this.chartArea.x, this.chartArea.x + this.chartArea.width],
      dataType: this.config.options.xType,
      options: {
        nice: true,
        padding: 0.05
      }
    });
    
    // Y Scale  
    this.scales.y = new Scale({
      type: yScaleType,
      domain: [...this.dataDomains.y],
      range: [this.chartArea.y + this.chartArea.height, this.chartArea.y], // Inverted for Canvas/SVG
      dataType: this.config.options.yType,
      options: {
        nice: true,
        padding: 0.05
      }
    });
    
    // Register scales with manager
    this.scaleManager.setScale('x', this.scales.x);
    this.scaleManager.setScale('y', this.scales.y);
  }
  
  /**
   * Create coordinate system for unified transformations
   */
  _createCoordinateSystem() {
    this.coordinateSystem = new CoordinateSystem({
      chartArea: this.chartArea,
      canvasSize: {
        width: this.config.options.width,
        height: this.config.options.height
      },
      devicePixelRatio: window.devicePixelRatio || 1
    });
  }
  
  /**
   * Create grid instance
   */
  _createGrid() {
    if (!this.scales.x || !this.scales.y) {
      console.warn('Scales not created before grid');
      return;
    }
    
    this.grid = new Grid({
      xScale: this.scales.x,
      yScale: this.scales.y,
      chartArea: this.chartArea,
      showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
      showYGrid: this.config.options.showYGrid && this.config.options.showGrid,
      xGridColor: this.config.options.gridColor,
      yGridColor: this.config.options.gridColor,
      xGridOpacity: this.config.options.gridOpacity,
      yGridOpacity: this.config.options.gridOpacity,
      xGridDash: this.config.options.gridDash,
      yGridDash: this.config.options.gridDash
    });
  }
  
  /**
   * Create axis instances
   */
  _createAxes() {
    if (!this.scales.x || !this.scales.y) {
      console.warn('Scales not created before axes');
      return;
    }
    
    // X Axis
    this.axes.x = new Axis({
      orientation: 'x',
      scale: this.scales.x,
      options: {
        label: this.config.options.xAxisName,
        fontSize: 12,
        color: '#333'
      }
    });
    
    // Y Axis
    this.axes.y = new Axis({
      orientation: 'y',
      scale: this.scales.y,
      options: {
        label: this.config.options.yAxisName,
        fontSize: 12,
        color: '#333'
      }
    });
  }


  /** 
   * Create coordinate system for unified transformations
    */
  _createCoordinateSystem() {
  if (!this.scales.x || !this.scales.y) {
    console.warn('Scales not created before coordinate system');
    return;
  }
  
  this.coordinateSystem = CoordinateSystem.createForChart('line', // or 'bar'
    this.config.options.width,
    this.config.options.height,
    this.chartArea,
    {
      devicePixelRatio: window.devicePixelRatio || 1,
      enableHighDPI: true,
      enableCaching: true
    }
  );
  
  // Set scales for coordinate transformation
  this.coordinateSystem.setScales(this.scales);
  this.coordinateSystem.setViewport({
    x: 0,
    y: 0,
    width: this.config.options.width,
    height: this.config.options.height
  });
  this.coordinateSystem.setChartArea(this.chartArea);
  
  console.log('CoordinateSystem created and configured');
}

  
  /**
   * Select and initialize optimal renderer based on data size and capabilities
   */
  async _selectAndInitializeRenderer() {
    // Check for forced renderer
    if (this.config.options.forceRenderer) {
      this.activeRenderer = this.config.options.forceRenderer;
      console.log(`Using forced renderer: ${this.activeRenderer}`);
    } else {
      // Auto-select based on data size and capabilities
      this._selectOptimalRenderer();
    }
    
    // Initialize the selected renderer
    await this._initializeRenderer();
  }
  
  /**
   * Select optimal renderer based on data size and browser capabilities
   */
  _selectOptimalRenderer() {
    const dataPoints = this.dataPointCount;
    
    // Check WebGL support first
    const webglSupported = WebGLRenderer.isSupported();
    
    if (dataPoints > this.performanceThresholds.canvas && webglSupported) {
      this.activeRenderer = 'webgl';
      console.log(`Auto-selected WebGL renderer for ${dataPoints} data points`);
    } else if (dataPoints > this.performanceThresholds.webgl) {
      // Dataset too large even for WebGL
      console.warn(`Dataset (${dataPoints} points) exceeds WebGL limit (${this.performanceThresholds.webgl})`);
      this.activeRenderer = webglSupported ? 'webgl' : 'canvas';
    } else {
      this.activeRenderer = 'canvas';
      console.log(`Auto-selected Canvas renderer for ${dataPoints} data points`);
    }
  }
  
  /**
   * Initialize the selected renderer
   */
  async _initializeRenderer() {
    try {
      // Create renderer instance
      switch (this.activeRenderer) {
        case 'webgl':
          this.rendererInstance = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: false
          });
          break;
          
        case 'canvas':
        default:
          this.rendererInstance = new CanvasRenderer({
            antialias: true,
            imageSmoothingEnabled: true
          });
          break;
      }
      
      // Initialize renderer with canvas
      await this.rendererInstance.initialize(this.canvas, {
        width: this.config.options.width,
        height: this.config.options.height
      });
      
      console.log(`${this.activeRenderer} renderer initialized successfully`);
      
    } catch (error) {
      console.error(`Failed to initialize ${this.activeRenderer} renderer:`, error);
      
      // Fallback to Canvas if WebGL fails
      if (this.activeRenderer === 'webgl') {
        console.log('Falling back to Canvas renderer');
        this.activeRenderer = 'canvas';
        this.rendererInstance = new CanvasRenderer();
        await this.rendererInstance.initialize(this.canvas, {
          width: this.config.options.width,
          height: this.config.options.height
        });
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Extract X value from data point (to be overridden by subclasses if needed)
   */
  _getXValue(point) {
    const xField = this.config.options.xField;
    let value = point[xField];
    
    // Handle Date objects and timestamps
    if (value instanceof Date) {
      return value.getTime();
    }
    
    if (typeof value === 'string' && this.config.options.xType === 'time') {
      return new Date(value).getTime();
    }
    
    return typeof value === 'number' ? value : null;
  }
  
  /**
   * Extract Y value from data point (to be overridden by subclasses if needed)
   */
  _getYValue(point) {
    const yField = this.config.options.yField;
    const value = point[yField];
    return typeof value === 'number' ? value : null;
  }
  
  /**
   * Render chart title
   */
  _renderTitle() {
    // Remove existing title if present
    if (this.titleElement) {
      this.titleElement.remove();
      this.titleElement = null;
    }
    
    // Only render title if one is specified
    if (!this.config.options.title) {
      return;
    }
    
    // Create title element
    this.titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    
    // Position title centered horizontally, in the top margin
    const centerX = this.config.options.width / 2;
    const titleY = this.config.options.titlePadding + this.config.options.titleFontSize;
    
    // Set title attributes
    this.titleElement.setAttribute('x', centerX);
    this.titleElement.setAttribute('y', titleY);
    this.titleElement.setAttribute('text-anchor', 'middle');
    this.titleElement.setAttribute('font-size', this.config.options.titleFontSize);
    this.titleElement.setAttribute('font-family', this.config.options.titleFontFamily);
    this.titleElement.setAttribute('font-weight', this.config.options.titleFontWeight);
    this.titleElement.setAttribute('fill', this.config.options.titleColor);
    this.titleElement.setAttribute('class', 'chart-title');
    
    // Set title text
    this.titleElement.textContent = this.config.options.title;
    
    // Add to SVG overlay
    this.svgOverlay.appendChild(this.titleElement);
    
    console.log(`Title rendered: "${this.config.options.title}"`);
  }
  
  /**
   * Preprocess data for rendering using coordinate system and path generator
   */
  async _preprocessDataForRenderer() {
    if (!Array.isArray(this.config.data) || !this.coordinateSystem) {
      return;
    }

    try {
      console.log('Transforming coordinates with CoordinateSystem...');
      
      // Step 1: Use CoordinateSystem to transform data to pixel coordinates
      this.config.data = await this.coordinateSystem.transformDatasets(this.config.data, {
        strictValidation: false
      });

      console.log('Data transformed for', this.activeRenderer, 'renderer');

      // Step 2: Use PathGenerator to create standardized rendering paths
      console.log('Generating standardized paths with PathGenerator...');
      
      this.generatedPaths = await this.pathGenerator.generatePaths(this.config.data, {
        curve: this.config.options.curve || 'linear',
        strokeWidth: this.config.options.strokeWidth || 2
      });

      console.log('Standardized paths generated for', this.activeRenderer, 'renderer');
      
    } catch (error) {
      console.error('Error in preprocessing data for renderer:', error);
      throw error;
    }
  }
  
  /**
   * Render the chart using the selected renderer
   */
  async render() {
    if (!this.isInitialized) {
      console.log('Waiting for chart initialization to complete...');
      await this._initPromise;
    }
    
    try {
      // Update coordinate system dimensions
      if (this.coordinateSystem) {
        this.coordinateSystem.setViewport({
          x: 0,
          y: 0,
          width: this.config.options.width,
          height: this.config.options.height
        });
        this.coordinateSystem.setChartArea(this.chartArea);
      }
      
      // Clear renderer
      this.rendererInstance.clear();
      
      // Transform data for the active renderer
      await this._preprocessDataForRenderer();
      
      // HYBRID RENDERING ARCHITECTURE:
      // 1. Grid: Always Canvas 2D (simple, reliable) - use separate canvas for WebGL
      if (this.grid && this.config.options.showGrid) {
        const ctx = this.activeRenderer === 'webgl' 
          ? this.gridCanvas.getContext('2d')
          : this.canvas.getContext('2d');
        
        // Clear grid canvas if using WebGL
        if (this.activeRenderer === 'webgl') {
          ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        }
        
        this.grid.render(ctx);
      }
      
      // 2. Title: Always SVG (crisp text, vector graphics)
      this._renderTitle();
      
      // 3. Axes: Always SVG (crisp text, vector graphics)
      this._renderAxes();
      
      // 4. Data: Selected renderer using transformed data
      await this._renderChartData();
      
      console.log(`Chart rendered successfully using ${this.activeRenderer} renderer`);
      
    } catch (error) {
      console.error('Error rendering chart:', error);
      throw error;
    }
  }
  
  /**
   * Render axes using the Axis class
   */
  _renderAxes() {
    if (!this.axes.x || !this.axes.y) {
      console.warn('Axes not initialized');
      return;
    }
    
    // Render X axis
    this.axes.x.render(this.svgOverlay, {
      x: 0,
      y: this.chartArea.y + this.chartArea.height
    });
    
    // Render Y axis  
    this.axes.y.render(this.svgOverlay, {
      x: this.chartArea.x,
      y: 0
    });
  }
  
  /**
   * Render chart data using the selected renderer - to be implemented by subclasses
   */
  async _renderChartData() {
    throw new Error('_renderChartData must be implemented by subclass');
  }
  
  /**
   * Update chart with new data or options
   */
  async update() {
    if (!this.isInitialized) {
      await this._initialize();
      return;
    }
    
    const oldDataPointCount = this.dataPointCount;
    
    // Process data first
    await this._processData();
    
    this._calculateDataDomains();
    this._createScales();
    this._createGrid();
    
    // NEW: Recreate coordinate system with new scales
    this._createCoordinateSystem();
    
    // Check if we need to switch renderers due to data size change
    const newOptimalRenderer = this._determineOptimalRenderer();
    if (newOptimalRenderer !== this.activeRenderer) {
      console.log(`Switching renderer from ${this.activeRenderer} to ${newOptimalRenderer} due to data size change`);
      
      // Destroy current renderer
      if (this.rendererInstance) {
        this.rendererInstance.destroy();
      }
      
      // Initialize new renderer
      this.activeRenderer = newOptimalRenderer;
      await this._initializeRenderer();
    }
    
    // Update axes with new scales
    if (this.axes.x && this.axes.y) {
      this.axes.x.updateScale(this.scales.x);
      this.axes.x.updateOptions({ label: this.config.options.xAxisName });
      
      this.axes.y.updateScale(this.scales.y);
      this.axes.y.updateOptions({ label: this.config.options.yAxisName });
    }
    
    // Update grid with new scales and chart area
    if (this.grid) {
      this.grid.updateScales(this.scales.x, this.scales.y);
      this.grid.updateChartArea(this.chartArea);
    }
    
    // Update renderer
    if (this.rendererInstance) {
      this.rendererInstance.update(this.config.data);
    }
    
    await this.render();
    
    console.log(`Chart updated: ${oldDataPointCount} → ${this.dataPointCount} points`);
  }
  
  /**
   * Determine optimal renderer without setting it
   */
  _determineOptimalRenderer() {
    if (this.config.options.forceRenderer) {
      return this.config.options.forceRenderer;
    }
    
    const webglSupported = WebGLRenderer.isSupported();
    
    if (this.dataPointCount > this.performanceThresholds.canvas && webglSupported) {
      return 'webgl';
    } else {
      return 'canvas';
    }
  }
  
  /**
   * Get renderer performance information
   */
  getRendererInfo() {
    return {
      activeRenderer: this.activeRenderer,
      dataPointCount: this.dataPointCount,
      thresholds: this.performanceThresholds,
      rendererCapabilities: this.rendererInstance ? this.rendererInstance.getPerformanceProfile() : null,
      webglSupported: WebGLRenderer.isSupported(),
      webglCapabilities: WebGLRenderer.getCapabilities()
    };
  }
  
  /**
   * Force switch to a specific renderer
   */
  async switchRenderer(rendererType) {
    if (!['canvas', 'webgl'].includes(rendererType)) {
      throw new Error(`Invalid renderer type: ${rendererType}`);
    }
    
    if (rendererType === 'webgl' && !WebGLRenderer.isSupported()) {
      throw new Error('WebGL is not supported in this browser');
    }
    
    if (rendererType === this.activeRenderer) {
      console.log(`Already using ${rendererType} renderer`);
      return;
    }
    
    console.log(`Manually switching to ${rendererType} renderer`);
    
    // Destroy current renderer
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
    }
    
    // Set new renderer
    this.activeRenderer = rendererType;
    this.config.options.forceRenderer = rendererType;
    
    // Initialize new renderer
    await this._initializeRenderer();
    
    // Re-render
    await this.render();
  }
  
  /**
   * Set chart title
   */
  setTitle(title) {
    this.config.options.title = title;
    this._renderTitle(); // Re-render title immediately
    return this;
  }
  
  /**
   * Get current title
   */
  getTitle() {
    return this.config.options.title;
  }
  
  /**
   * Toggle grid visibility
   */
  toggleGrid(show = null) {
    this.config.options.showGrid = show !== null ? show : !this.config.options.showGrid;
    if (this.grid) {
      this.grid.updateOptions({
        showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
        showYGrid: this.config.options.showYGrid && this.config.options.showGrid
      });
    }
    this.render();
    return this.config.options.showGrid;
  }
  
  /**
   * Toggle X grid lines
   */
  toggleXGrid(show = null) {
    this.config.options.showXGrid = show !== null ? show : !this.config.options.showXGrid;
    if (this.grid) {
      this.grid.toggleXGrid(this.config.options.showXGrid && this.config.options.showGrid);
    }
    this.render();
    return this.config.options.showXGrid;
  }
  
  /**
   * Toggle Y grid lines
   */
  toggleYGrid(show = null) {
    this.config.options.showYGrid = show !== null ? show : !this.config.options.showYGrid;
    if (this.grid) {
      this.grid.toggleYGrid(this.config.options.showYGrid && this.config.options.showGrid);
    }
    this.render();
    return this.config.options.showYGrid;
  }
  
  /**
   * Set grid color
   */
  setGridColor(color) {
    this.config.options.gridColor = color;
    if (this.grid) {
      this.grid.setGridColor(color);
    }
    this.render();
    return this;
  }
  
  /**
   * Set grid opacity
   */
  setGridOpacity(opacity) {
    this.config.options.gridOpacity = opacity;
    if (this.grid) {
      this.grid.setGridOpacity(opacity);
    }
    this.render();
    return this;
  }
  
  /**
   * Destroy the chart and clean up resources
   */
  destroy() {
    if (this.titleElement) {
      this.titleElement.remove();
      this.titleElement = null;
    }
    
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.renderers.clear();
    this.isInitialized = false;
    
    console.log('Chart destroyed and resources cleaned up');
  }
}
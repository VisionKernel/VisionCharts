/**
 * Chart.js - Base Chart Class
 * 
 * Foundation class for all chart types in VisionCharts.
 * Handles hybrid rendering coordination, basic lifecycle, and common functionality.
 */

import { Axis } from './Axis.js';
import { Scale, ScaleManager } from './Scale.js';
import { Grid } from '../components/Grid.js';

export class Chart {
  constructor(config = {}) {
    this.container = this._resolveContainer(config.container);
    this.config = {
      data: config.data || [],
      options: {
        // Default options
        width: 800,
        height: 400,
        xAxisName: 'X Axis',
        yAxisName: 'Y Axis',
        xField: 'x',
        yField: 'y',
        xType: 'time', // 'time', 'number', 'category'
        yType: 'number',
        margin: { top: 40, right: 60, bottom: 60, left: 80 },
        
        // Grid options
        showGrid: true,
        showXGrid: true,
        showYGrid: true,
        gridColor: '#e0e0e0',
        gridOpacity: 0.7,
        gridDash: [], // [] for solid, [5, 5] for dashed
        
        ...config.options
      }
    };
    
    // Rendering infrastructure
    this.renderers = new Map(); // Will hold Canvas, WebGL, SVG renderers
    this.activeRenderer = null;
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
    
    // Grid component
    this.grid = null;
    
    // Initialize
    this._initialize();
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
  _initialize() {
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
    this._processData();
    
    // Calculate data domains
    this._calculateDataDomains();
    
    // Create scales
    this._createScales();
    
    // Create grid
    this._createGrid();
    
    // Create axes
    this._createAxes();
    
    // Choose optimal renderer
    this._selectRenderer();
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
    // Create canvas for data rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.options.width;
    this.canvas.height = this.config.options.height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '1';
    
    // Create SVG overlay for UI elements (axes, labels, etc.)
    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgOverlay.setAttribute('width', this.config.options.width);
    this.svgOverlay.setAttribute('height', this.config.options.height);
    this.svgOverlay.style.position = 'absolute';
    this.svgOverlay.style.top = '0';
    this.svgOverlay.style.left = '0';
    this.svgOverlay.style.zIndex = '2';
    this.svgOverlay.style.pointerEvents = 'none'; // Allow interaction to pass through to canvas
    
    // Add to container
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.svgOverlay);
  }
  
  /**
   * Process and count data points
   */
  _processData() {
    this.dataPointCount = 0;
    
    if (Array.isArray(this.config.data)) {
      // Handle array of datasets
      this.config.data.forEach(dataset => {
        if (dataset.data && Array.isArray(dataset.data)) {
          this.dataPointCount += dataset.data.length;
        }
      });
    }
    
    console.log(`Chart initialized with ${this.dataPointCount} data points`);
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
   * Select optimal renderer based on data size
   */
  _selectRenderer() {
    if (this.dataPointCount > this.performanceThresholds.canvas) {
      console.log('Using WebGL renderer for large dataset (when implemented)');
      this.activeRenderer = 'webgl';
      // Note: WebGL renderer not yet implemented, falls back to Canvas 2D
      // When implemented, grid will still use Canvas 2D for hybrid rendering
    } else {
      console.log('Using Canvas renderer');
      this.activeRenderer = 'canvas';
    }
  }
  _selectRenderer() {
    if (this.dataPointCount > this.performanceThresholds.canvas) {
      console.log('Using WebGL renderer for large dataset');
      this.activeRenderer = 'webgl';
    } else {
      console.log('Using Canvas renderer');
      this.activeRenderer = 'canvas';
    }
  }
  
  /**
   * Render the chart
   */
  async render() {
    try {
      // Clear and prepare canvas
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.config.options.width, this.config.options.height);
      
      // HYBRID RENDERING ARCHITECTURE:
      // 1. Grid: Always Canvas 2D (simple, reliable)
      if (this.grid && this.config.options.showGrid) {
        this.grid.render(ctx);
      }
      
      // 2. Axes: Always SVG (crisp text, vector graphics)
      this._renderAxes();
      
      // 3. Data: Canvas 2D (<50K points) or WebGL (50K+ points)
      //    Currently: Canvas 2D only (WebGL renderer will be added later)
      await this._renderChartData();
      
      console.log('Chart rendered successfully');
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
   * Render chart data - to be implemented by subclasses
   */
  async _renderChartData() {
    throw new Error('_renderChartData must be implemented by subclass');
  }
  
  /**
   * Update chart with new data or options
   */
  update() {
    this._processData();
    this._calculateDataDomains();
    this._createScales();
    this._createGrid();
    
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
    
    this._selectRenderer();
    this.render();
  }
  
  /**
   * Destroy the chart and clean up resources
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.renderers.clear();
  }
}
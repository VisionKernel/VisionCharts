/**
 * Chart.js - Enhanced Base Chart Class with Multi-Renderer Support (Updated)
 * 
 * Foundation class for all chart types in VisionCharts.
 * Handles automatic renderer selection (Canvas 2D vs WebGL) based on dataset size.
 * NOW WITH UNIFIED COORDINATE SYSTEM for consistent rendering across all renderers.
 */

import { browserSupport } from '../utils/BrowserSupport.js';
import { Axis } from './Axis.js';
import { Scale, ScaleManager } from './Scale.js';
import { Grid } from '../components/Grid.js';
import CanvasRenderer from '../renderers/CanvasRenderer.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { PanelManager } from '../components/PanelManager.js';
import { CoordinateSystem } from '../utils/CoordinateSystem.js';
import { DataProcessor } from '../utils/DataProcessor.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { Legend } from '../components/Legend.js';
import { EndingLabels } from '../components/EndingLabels.js';
import { Crosshair } from '../components/Crosshair.js';
import { ZeroLine } from '../components/ZeroLine.js';
import { AverageLine } from '../components/AverageLine.js';
import { MedianLine } from '../components/MedianLine.js';
import { CrosshairTooltip } from '../components/CrosshairTooltip.js';
import { RecessionLines } from '../components/RecessionLines.js';

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

        showRecessionLines: false, // Show recession lines
        recessionFillColor: 'rgba(50, 50, 5, 0.3)',
        recessionStrokeColor: 'rgba(30, 30, 30, 0.5)',
        
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

    // UPDATED: Enhanced coordinate system for unified rendering
    this.coordinateSystem = null;
    this.transformedData = null; // Store transformed data for renderers
    
    // Grid component
    this.grid = null;
    
    // Title element reference
    this.titleElement = null;
    
    // Initialization state
    this.isInitialized = false;

    this.panelManager = new PanelManager(this);
    
    // Legend component
    this.legend = new Legend({
      fontSize: 12,
      fontFamily: this.config.options.titleFontFamily || 'Arial, sans-serif',
      textColor: '#333333',
      itemSpacing: 25,
      marginTop: 15,
      marginBottom: 15
    });

    // Ending labels component
    this.endingLabels = new EndingLabels({
      fontSize: 11,
      fontFamily: this.config.options.titleFontFamily || 'Arial, sans-serif',
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatValue: true,
      decimals: 1,
      enabled: false
    });
    
    // Crosshair functionality  
    this.crosshair = null;
    this.lastMousePosition = null;
    this.mouseThreshold = 5; // pixels

    this.recessionLines = new RecessionLines({
      enabled: this.config.options.showRecessionLines,
      fillColor: this.config.options.recessionFillColor,
      strokeColor: this.config.options.recessionStrokeColor
    });

    this.zeroLine = new ZeroLine({
      enabled: false,
      strokeColor: '#000000',
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDash: [3, 3],
      showLabel: false
    });

    this.averageLine = new AverageLine({
      enabled: false,
      strokeColor: '#FF6B35',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      strokeDash: [5, 5],
      showLabel: true,
      labelText: 'Avg',
      labelPosition: 'right',
      useAllDatasets: true
    });

    this.medianLine = new MedianLine({
      enabled: false,
      strokeColor: '#9C27B0',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      strokeDash: [8, 4],
      showLabel: true,
      labelText: 'Median',
      labelPosition: 'right',
      useAllDatasets: true
    });
    
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
 * FIXED: Remove duplicate domain calculation from _initialize
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
    
    // Process data (this includes domain calculation now)
    await this._processData();
    
    // ✅ REMOVED: Don't calculate domains again, _processData() already does it
    // this._calculateDataDomains();
    
    // Choose optimal renderer first (before creating coordinate system)
    this._selectOptimalRenderer();
    
    // UPDATED: Create coordinate system with renderer information
    this._createCoordinateSystem();
    
    // UPDATED: Create scales with unified coordinate system
    this._createScales();
    
    // Create grid
    this._createGrid();
    
    // Create axes
    this._createAxes();

    //set up crosshair
    this._setupCrosshair();
    
    // Initialize the selected renderer
    await this._initializeRenderer();
    
    this.isInitialized = true;
    console.log('Chart initialization complete with unified coordinate system and', this.activeRenderer, 'renderer');
    
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
    
    // Apply DPI scaling to grid canvas
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.gridCanvas.width = this.config.options.width * devicePixelRatio;
    this.gridCanvas.height = this.config.options.height * devicePixelRatio;
    this.gridCanvas.style.width = this.config.options.width + 'px';
    this.gridCanvas.style.height = this.config.options.height + 'px';
    
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
    this.svgOverlay.style.pointerEvents = 'none';
    this.svgOverlay.style.zIndex = '2'; // On top for UI elements
    
    // ✅ IMPORTANT: Add all layers to the container in correct z-index order
    this.container.appendChild(this.gridCanvas);  // Layer 0 (bottom)
    this.container.appendChild(this.canvas);      // Layer 1 (middle) 
    this.container.appendChild(this.svgOverlay);  // Layer 2 (top)
    
    console.log('Rendering layers created and added to DOM');
  }
  
  /**
 * FIXED: Process data and calculate domains in correct order
 * @private
 */
async _processData() {
  if (!this.config.data || !Array.isArray(this.config.data)) {
    console.warn('No data to process');
    return;
  }

  try {
    console.log('Processing raw data with DataProcessor...');
    
    // ✅ FIX: Use DataProcessor to normalize ALL data to standard x/y fields
    const processingOptions = {
      // DataProcessor will normalize any time field → x, any value field → y
      autoDetectTimeFormat: true,
      sortByTime: true,
      removeDuplicates: true,
      strictValidation: false,
      fillGaps: false,
      timeZone: 'UTC',
      enableCaching: true,
      batchSize: 10000,
      normalizeTimeStamps: true,
      gapThreshold: '1d'
    };
    
    const processedDatasets = [];
    
    for (let i = 0; i < this.config.data.length; i++) {
      const dataset = this.config.data[i];
      console.log(`Processing dataset ${i + 1}/${this.config.data.length}: ${dataset.name || dataset.id || 'Unknown'}`);
      
      if (!dataset.data || !Array.isArray(dataset.data)) {
        console.warn(`Dataset ${i} has invalid data, skipping`);
        continue;
      }

      // ✅ CRITICAL FIX: DataProcessor.processDataset returns the whole processed dataset object
      const processedDataset = await this.dataProcessor.processDataset(dataset, processingOptions);
      
      // ✅ CRITICAL FIX: Just push the processed dataset directly (it already has the structure we need)
      processedDatasets.push(processedDataset);
    }

    // ✅ FIX: Store processed data BEFORE domain calculation
    this.config.data = processedDatasets;
    
    // ✅ FIX: Calculate data point count from PROCESSED data (use processedDataCount from DataProcessor)
    this.dataPointCount = processedDatasets.reduce((count, dataset) => {
      // DataProcessor adds processedDataCount to the dataset
      const dataLength = dataset.processedDataCount || (dataset.data && Array.isArray(dataset.data) ? dataset.data.length : 0);
      return count + dataLength;
    }, 0);
    
    console.log(`DataProcessor: Successfully processed ${processedDatasets.length} datasets`);
    console.log(`DataProcessor: Total points for rendering: ${this.dataPointCount}`);

    // ✅ CRITICAL: Calculate domains AFTER data processing using normalized data
    this._calculateDataDomains();

  } catch (error) {
    console.error('Error processing data:', error);
    throw error;
  }
}
  /**
 * Update scales with new data domains
 * @private
 */
_updateScales() {
  if (!this.scales.x || !this.scales.y) {
    console.warn('Scales not initialized for update');
    return;
  }

  // Recalculate data domains based on current data
  this._calculateDataDomains();

  // Update X scale domain
  this.scales.x.setDomain([...this.dataDomains.x]);
  
  // Update Y scale domain  
  this.scales.y.setDomain([...this.dataDomains.y]);
  
  // Update scale manager
  this.scaleManager.setScale('x', this.scales.x);
  this.scaleManager.setScale('y', this.scales.y);
  
  // Update coordinate system with new scales
  if (this.coordinateSystem) {
    this.coordinateSystem.setScales(this.scales);
  }
  
  console.log('Scales updated with new data domains');
}

  /**
 * Update axes with new scales
 * @private  
 */
_updateAxes() {
  if (!this.axes.x || !this.axes.y) {
    console.warn('Axes not initialized for update');
    return;
  }
  
  if (!this.scales.x || !this.scales.y) {
    console.warn('Scales not available for axis update');
    return;
  }

  // Update X axis with new scale
  this.axes.x.scale = this.scales.x;
  
  // Update Y axis with new scale  
  this.axes.y.scale = this.scales.y;
  
  console.log('Axes updated with new scales');
}

  /**
   * Initialize crosshair functionality
   * @private
   *  
    */
  async togglePanelMode(force = null) {
    return await this.panelManager.togglePanelMode(force);
  }


  /**
   * Check if the chart is in panel mode
   * @return {boolean} True if in panel mode, false otherwise
   * */
  get isPanelMode() {
    return this.panelManager.isPanelMode;
  }
  
  /**
 * FIXED: Calculate domains using normalized data from DataProcessor
 * @private
 */
_calculateDataDomains() {
  if (!this.config.data || !Array.isArray(this.config.data) || this.config.data.length === 0) {
    console.warn('No data available for domain calculation');
    this.dataDomains = { x: [0, 1], y: [0, 1] };
    return;
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  let totalPoints = 0;
  
  // ✅ FIX: Use normalized data from DataProcessor (always has x/y fields)
  for (const dataset of this.config.data) {
    if (!dataset.data || !Array.isArray(dataset.data) || dataset.data.length === 0) {
      continue;
    }
    
    // ✅ FIX: DataProcessor guarantees x/y fields exist and are normalized
    for (const point of dataset.data) {
      totalPoints++;
      
      // DataProcessor normalizes all time fields → point.x (numeric timestamp)
      // DataProcessor normalizes all value fields → point.y (numeric value)
      const xValue = point.x;
      const yValue = point.y;
      
      if (xValue != null && isFinite(xValue)) {
        xMin = Math.min(xMin, xValue);
        xMax = Math.max(xMax, xValue);
      }
      
      if (yValue != null && isFinite(yValue)) {
        yMin = Math.min(yMin, yValue);
        yMax = Math.max(yMax, yValue);
      }
    }
  }
  
  // Handle edge cases
  if (xMin === Infinity || xMax === -Infinity) {
    console.warn('No valid X values found in processed data');
    xMin = 0;
    xMax = 1;
  }
  
  if (yMin === Infinity || yMax === -Infinity) {
    console.warn('No valid Y values found in processed data');
    yMin = 0;
    yMax = 1;
  }
  
  this.dataDomains = {
    x: [xMin, xMax],
    y: [yMin, yMax]
  };
  
  console.log(`Data domains calculated from ${totalPoints} processed points:`, this.dataDomains);
}
  
  /**
   * UPDATED: Create coordinate system with renderer information
   */
  _createCoordinateSystem() {
    this.coordinateSystem = CoordinateSystem.createForChart(
      this.constructor.name.toLowerCase().replace('chart', ''), // 'line', 'bar', etc.
      {
        x: 0,
        y: 0,
        width: this.config.options.width,
        height: this.config.options.height
      },
      this.chartArea,
      {
        targetRenderer: this.activeRenderer, // Pass selected renderer
        devicePixelRatio: window.devicePixelRatio || 1,
        enableHighDPI: true,
        enableCaching: true,
        useUnifiedCoordinates: true // Enable unified coordinate system
      }
    );
    
    console.log(`CoordinateSystem created for ${this.activeRenderer} renderer with unified coordinates`);
  }
  
  /**
 * UPDATED: Create scales with proper domains from processed data
 * @private
 */
_createScales() {
  // ✅ FIX: Ensure domains are calculated from processed data first
  if (!this.dataDomains || !this.dataDomains.x || !this.dataDomains.y) {
    console.warn('Data domains not available, recalculating...');
    this._calculateDataDomains();
  }
  
  // Determine scale types - DataProcessor handles time detection
  const xScaleType = this.config.options.xType === 'time' ? 'time' : 'linear';
  const yScaleType = this.config.options.isLogarithmic ? 'log' : 'linear';
  
  // Create X scale with NO PADDING
  this.scales.x = new Scale({
    type: xScaleType,
    domain: [...this.dataDomains.x],
    range: [this.chartArea.x, this.chartArea.x + this.chartArea.width],
    coordinateSystem: 'unified',
    orientation: 'horizontal',
    dataType: this.config.options.xType,
    options: { 
      nice: false,    // ✅ DISABLE nice numbers
      padding: 0,     // ✅ DISABLE padding
      clamp: true 
    }
  });
  
  // Create Y scale with NO PADDING
  this.scales.y = new Scale({
    type: yScaleType,
    domain: [...this.dataDomains.y],
    range: [this.chartArea.y, this.chartArea.y + this.chartArea.height],
    coordinateSystem: 'unified',
    orientation: 'vertical',
    dataType: this.config.options.yType,
    options: { 
      nice: false,    // ✅ DISABLE nice numbers
      padding: 0,     // ✅ DISABLE padding
      clamp: true 
    }
  });
  
  // Update scale manager
  this.scaleManager.setScale('x', this.scales.x);
  this.scaleManager.setScale('y', this.scales.y);
  
  console.log('Scales created with NO PADDING and unified coordinate system');
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
   * UPDATED: Determine optimal renderer based on data size and browser capabilities
   */
  _selectOptimalRenderer() {
    // Check for forced renderer
    if (this.config.options.forceRenderer) {
      this.activeRenderer = this.config.options.forceRenderer;
      console.log(`Using forced renderer: ${this.activeRenderer}`);
      return;
    }
    
    // Force canvas rendering for bar charts
    if (this.chartType === 'bar') {
      this.activeRenderer = 'canvas';
      console.log(`Force-selected Canvas renderer for BarChart (${this.dataPointCount} data points)`);
      return;
    }
    
    const dataPoints = this.dataPointCount;
    
    // UPDATED: Use centralized browser support
    const webglSupported = browserSupport.hasWebGL();
    
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
      
      // UPDATED: Inform coordinate system about active renderer
      if (this.coordinateSystem) {
        this.coordinateSystem.setTargetRenderer(this.activeRenderer);
      }
      
      console.log(`${this.activeRenderer} renderer initialized with unified coordinate system`);
      
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
        
        // Update coordinate system with fallback renderer
        if (this.coordinateSystem) {
          this.coordinateSystem.setTargetRenderer(this.activeRenderer);
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
 * UPDATED: Extract X value - use normalized data from DataProcessor
 * @private
 */
_getXValue(point) {
  // ✅ FIX: After DataProcessor, all time data is normalized to point.x
  // DataProcessor guarantees point.x exists and is a numeric timestamp
  let value = point.x;
  
  // Fallback for unprocessed data (shouldn't happen in normal flow)
  if (value == null) {
    value = point.date || point.time || point.timestamp;
    
    // Convert Date objects to timestamps
    if (value instanceof Date) {
      value = value.getTime();
    } else if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        value = parsed.getTime();
      } else {
        value = parseFloat(value);
      }
    }
  }
  
  return typeof value === 'number' && isFinite(value) ? value : null;
}

/**
 * UPDATED: Extract Y value - use normalized data from DataProcessor
 * @private
 */
_getYValue(point) {
  // ✅ FIX: After DataProcessor, all value data is normalized to point.y
  // DataProcessor guarantees point.y exists and is a numeric value
  let value = point.y;
  
  // Fallback for unprocessed data (shouldn't happen in normal flow)
  if (value == null) {
    value = point.value || point.price || point.close || point.amount;
    
    if (typeof value === 'string') {
      value = parseFloat(value);
    }
  }
  
  return typeof value === 'number' && isFinite(value) ? value : null;
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
   * UPDATED: Preprocess data for rendering using unified coordinate system
   */
  async _preprocessDataForRenderer() {
  if (!Array.isArray(this.config.data) || !this.coordinateSystem) {
    return;
  }

  try {
    console.log('Transforming coordinates with UNIFIED CoordinateSystem...');
    
    // Step 1: Use CoordinateSystem to transform data to UNIFIED pixel coordinates
    this.config.data = await this.coordinateSystem.transformDatasets(this.config.data, {
      strictValidation: false
    });

    console.log('Data transformed to UNIFIED coordinates for', this.activeRenderer, 'renderer');

    // ✅ FIXED: Use centralized PathGenerator instead of instance
    console.log('Generating standardized paths with centralized PathGenerator...');
    
    this.generatedPaths = await PathGenerator.generatePaths(this.config.data, {
      curve: this.config.options.curve || 'linear',
      strokeWidth: this.config.options.strokeWidth || 2,
      targetRenderer: this.activeRenderer
    });

    console.log('Standardized paths generated from UNIFIED coordinates for', this.activeRenderer, 'renderer');
    
  } catch (error) {
    console.error('Error in preprocessing data for renderer:', error);
    throw error;
  }
}

  
  /**
 * FIXED: Render chart - correct pipeline order
 */
async render() {
  try {
    // Step 1: Raw Data → DataProcessor (normalize to x/y fields)
    await this._processData();
    
    // Step 2: Calculate Domains (from normalized data) - already done in _processData()
    
    // Step 3: Create Scales (using calculated domains)
    this._createScales();
    
    // Step 4: CoordinateSystem (using scales)
    if (this.coordinateSystem) {
      this.coordinateSystem.setScales(this.scales);
    }
    
    // Continue with rest of rendering...
    await this._renderSingleMode();
    
  } catch (error) {
    console.error('Error in render pipeline:', error);
    throw error;
  }
}

  /**
 * FIXED: Render single mode with correct path generation timing
 */
async _renderSingleMode() {
  if (!this.isInitialized) {
    console.warn('Chart not initialized, cannot render');
    return;
  }

  console.log('Rendering chart...');
  
  try {
    // ✅ FIX: Clear previous render FIRST (before generating new paths)
    this._clearRender();
    
    // ✅ FIX: Generate paths AFTER clearing (so they don't get deleted)
    console.log('Generating paths for rendering...');
    await this._preprocessDataForRenderer();
    
    // Render title
    this._renderTitle();
    
    // Render grid
    if (this.grid && this.config.options.showGrid && this.gridCanvas) {
      this.grid.updateChartArea(this.chartArea);
      this.grid.updateScales(this.scales.x, this.scales.y);
      
      const gridCtx = this.gridCanvas.getContext('2d');
      if (gridCtx) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        gridCtx.save();
        gridCtx.scale(devicePixelRatio, devicePixelRatio);
        this.grid.render(gridCtx);
        gridCtx.restore();
      }
    }
    
    // ✅ FIX: Render chart data AFTER paths are generated
    await this._renderChartData();
    
    // Render axes
    this._renderAxes();
    
    // Render statistical lines
    this._renderStatisticalLines();
    
    // Render recession lines  
    this._renderRecessionLines();
    
    // Render zero line
    this._renderZeroLine();
    
    // Update legend
    this._updateLegend();
    
    // Update ending labels
    this._updateEndingLabels();
    
    console.log('Chart rendered successfully');
    
  } catch (error) {
    console.error('Error rendering chart:', error);
    throw error;
  }
}

  
  /**
   * Get panel mode information
   */
  getPanelModeInfo() {
    return this.panelManager.getState();
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
   * Toggle recession lines visibility
   */
  toggleRecessionLines(show = null) {
    if (!this.recessionLines) {
      console.warn('RecessionLines component not available');
      return false;
    }
    
    const newState = this.recessionLines.toggle(show);
    this.config.options.showRecessionLines = newState;
    
    console.log(`RecessionLines ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * Toggle zero line visibility
   */
  toggleZeroLine(show = null) {
    if (!this.zeroLine) {
      console.warn('ZeroLine component not available');
      return false;
    }
    
    const newState = this.zeroLine.toggle(show);
    
    console.log(`ZeroLine ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * Render recession lines
   * @private
   */
  _renderRecessionLines() {
    if (!this.recessionLines || !this.scales.x || !this.scales.y) {
      return;
    }
    
    // Render recession lines to the container (creates dedicated SVG layer)
    this.recessionLines.render(this.container, this.chartArea, this.scales);
  }

  /**
   * Render zero line
   * @private
   */
  _renderZeroLine() {
    if (!this.zeroLine || !this.scales.x || !this.scales.y) {
      return;
    }
    
    // Render zero line to the container (creates dedicated SVG layer)
    this.zeroLine.render(this.container, this.chartArea, this.scales);
  }

  /**
   * Render statistical lines
   * @private
   */
  _renderStatisticalLines() {
    // Update and render average line
    if (this.averageLine && this.scales.x && this.scales.y) {
      this.averageLine.updateDatasets(this.config.data);
      this.averageLine.render(this.container, this.chartArea, this.scales);
    }
    
    // Update and render median line
    if (this.medianLine && this.scales.x && this.scales.y) {
      this.medianLine.updateDatasets(this.config.data);
      this.medianLine.render(this.container, this.chartArea, this.scales);
    }
  }
  
  /**
   * Render chart data using the selected renderer - to be implemented by subclasses
   */
  async _renderChartData() {
    throw new Error('_renderChartData must be implemented by subclass');
  }
  
  /**
   * Update chart - handle both single and panel modes
   */
  async update() {
    if (this.isPanelMode) {
      return await this.panelManager.refreshPanelMode();
    } else {
      return this._updateSingleMode();
    }
  }

  /**
   * Update panel mode
   * @private
   */
  async _updatePanelMode() {
    return await this.panelManager.refreshPanelMode();
  }
  
  /**
   * FIXED: Update single mode chart
   * @private
   */
  async _updateSingleMode() {
  if (!this.isInitialized) {
    await this._initialize();
    return;
  }

  console.log('Updating chart...');
  
  try {
    // Process data first
    await this._processData();
    
    // Update scales with new data domains
    this._updateScales();
    
    // Update axes with new scales
    this._updateAxes();
    
    // Update grid with new scales
    this._updateGrid();
    
    // CRITICAL: Generate paths for rendering after scales are updated
    await this._preprocessDataForRenderer();
    
    // Re-render with new data
    await this.render();
    
    console.log('Chart updated successfully');
    
  } catch (error) {
    console.error('Error updating chart:', error);
    throw error;
  }
}

  /**
   * Update grid with new scales and chart area
   * @private
   */
  _updateGrid() {
    if (this.grid && this.scales.x && this.scales.y) {
      this.grid.updateScales(this.scales.x, this.scales.y);
      this.grid.updateChartArea(this.chartArea);
    }
  }
  
  /**
 * FIXED: Debug method to verify data structure
 */
_debugDataStructure() {
  console.log('=== DATA STRUCTURE DEBUG ===');
  
  if (!this.config.data || this.config.data.length === 0) {
    console.log('No data available');
    return;
  }
  
  const firstDataset = this.config.data[0];
  console.log('Dataset structure:', {
    id: firstDataset.id,
    name: firstDataset.name,
    hasData: !!firstDataset.data,
    dataLength: firstDataset.data ? firstDataset.data.length : 0,
    processed: firstDataset.processed,
    processedDataCount: firstDataset.processedDataCount,
    originalDataCount: firstDataset.originalDataCount
  });
  
  if (firstDataset.data && firstDataset.data.length > 0) {
    const firstPoint = firstDataset.data[0];
    console.log('First data point structure:', {
      keys: Object.keys(firstPoint),
      x: firstPoint.x,
      y: firstPoint.y,
      hasUnifiedCoords: !!(firstPoint.unifiedX && firstPoint.unifiedY)
    });
  }
  
  console.log('Data domains:', this.dataDomains);
  console.log('Data point count:', this.dataPointCount);
}

  /**
   * UPDATED: Determine optimal renderer without setting it
   */
  _determineOptimalRenderer() {
    if (this.config.options.forceRenderer) {
      return this.config.options.forceRenderer;
    }
    
    const webglSupported = browserSupport.hasWebGL();
    
    if (this.dataPointCount > this.performanceThresholds.canvas && webglSupported) {
      return 'webgl';
    } else {
      return 'canvas';
    }
  }
  
  /**
   * UPDATED: Get renderer performance information
   */
  getRendererInfo() {
    return {
      activeRenderer: this.activeRenderer,
      dataPointCount: this.dataPointCount,
      thresholds: this.performanceThresholds,
      rendererCapabilities: this.rendererInstance ? this.rendererInstance.getPerformanceProfile() : null,
      webglSupported: browserSupport.hasWebGL(),
      webglCapabilities: browserSupport.getWebGLCapabilities(),
      coordinateSystem: this.coordinateSystem ? this.coordinateSystem.getCoordinateInfo() : null
    };
  }
  
  /**
   * UPDATED: Force switch to a specific renderer
   */
  async switchRenderer(rendererType) {
    if (!['canvas', 'webgl'].includes(rendererType)) {
      throw new Error(`Invalid renderer type: ${rendererType}`);
    }
    
    // UPDATED: Use centralized browser support
    if (rendererType === 'webgl' && !browserSupport.hasWebGL()) {
      throw new Error('WebGL is not supported in this browser');
    }
    
    if (rendererType === this.activeRenderer) {
      console.log(`Already using ${rendererType} renderer`);
      return;
    }
    
    console.log(`Manually switching to ${rendererType} renderer with unified coordinates`);
    
    // Destroy current renderer
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
    }
    
    // Set new renderer
    this.activeRenderer = rendererType;
    this.config.options.forceRenderer = rendererType;
    
    // Update coordinate system
    if (this.coordinateSystem) {
      this.coordinateSystem.setTargetRenderer(rendererType);
    }
    
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
    
    // ← ADD: Update panel grids if in panel mode
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
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
    
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
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
    
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
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

    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
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
    
    // ← ADD: Update panel grids if in panel mode
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    
    this.render();
    return this;
  }

  /**
   * Update all panel grids with current grid options
   * @private
   */
  _updatePanelGrids() {
    if (!this.panelManager || !this.panelManager.panels) return;
    
    const gridOptions = {
      showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
      showYGrid: this.config.options.showYGrid && this.config.options.showGrid,
      xGridColor: this.config.options.gridColor || '#e0e0e0',
      yGridColor: this.config.options.gridColor || '#e0e0e0',
      xGridOpacity: this.config.options.gridOpacity || 0.5,
      yGridOpacity: this.config.options.gridOpacity || 0.5
    };
    
    // Update each panel's grid
    for (const panel of this.panelManager.panels) {
      if (panel.grid) {
        panel.grid.updateOptions(gridOptions);
        
        // Update panel config for future renders
        Object.assign(panel.config, {
          showGrid: this.config.options.showGrid,
          showXGrid: this.config.options.showXGrid,
          showYGrid: this.config.options.showYGrid,
          gridColor: this.config.options.gridColor,
          gridOpacity: this.config.options.gridOpacity
        });
      }
    }
    
    console.log('Updated grid options for all panels');
  }

  /**
   * Update dataset color
   * @param {string} datasetId - The ID of the dataset to update
   */
  updateDatasetColor(datasetId, newColor) {
    const dataset = this.config.data.find(d => d.id === datasetId);
    if (!dataset) return false;
    
    dataset.color = newColor;
    
    if (this.legend) {
      this.legend.updateDatasetColor(datasetId, newColor);
    }

    if (this.endingLabels) {
      this.endingLabels.updateDatasetColor(datasetId, newColor);
    }
    
    this.render();
    return true;
  }
  
  /**
   * Update legend with current datasets
   * @private
   */
  _updateLegend() {
    if (this.legend && this.config.data) {
      this.legend.updateDatasets(this.config.data);
      
      // Re-render legend if SVG overlay exists
      if (this.svgOverlay && this.chartArea) {
        this.legend.render(this.svgOverlay, this.chartArea);
      }
    }
  }

  /**
   * Update ending labels with current datasets
   * @private
   */
  _updateEndingLabels() {
    if (this.endingLabels && this.config.data) {
      this.endingLabels.updateDatasets(this.config.data);
      
      // Re-render ending labels if SVG overlay exists
      if (this.svgOverlay && this.chartArea) {
        this.endingLabels.render(this.svgOverlay, this.chartArea);
      }
    }
  }

  /**
   * Toggle ending labels visibility
   * @param {boolean} show - Force show/hide state, or null to toggle
   * @returns {boolean} New visibility state
   */
  toggleEndingLabels(show = null) {
    if (!this.endingLabels) {
      console.warn('EndingLabels component not available');
      return false;
    }
    
    const newState = this.endingLabels.toggle(show);
    
    console.log(`EndingLabels ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * Configure ending labels appearance
   * @param {Object} config - Configuration options
   */
  setEndingLabelsConfig(config) {
    if (this.endingLabels) {
      this.endingLabels.updateConfig(config);
    }
    return this;
  }

  /**
   * Get ending labels state for debugging
   */
  getEndingLabelsInfo() {
    return this.endingLabels ? this.endingLabels.getState() : { enabled: false };
  }

  /**
   * Toggle average line visibility
   */
  toggleAverageLine(show = null) {
    if (!this.averageLine) {
      console.warn('AverageLine component not available');
      return false;
    }
    
    const newState = this.averageLine.toggle(show);
    
    console.log(`AverageLine ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * Toggle median line visibility
   */
  toggleMedianLine(show = null) {
    if (!this.medianLine) {
      console.warn('MedianLine component not available');
      return false;
    }
    
    const newState = this.medianLine.toggle(show);
    
    console.log(`MedianLine ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * Get current statistical values (average and median)
   */
  getStatisticalValues() {
    return {
      average: this.averageLine ? this.averageLine.getAverageValue() : null,
      median: this.medianLine ? this.medianLine.getMedianValue() : null,
      averageInRange: this.averageLine ? this.averageLine.getState().averageInRange : false,
      medianInRange: this.medianLine ? this.medianLine.getState().medianInRange : false
    };
  }

  /**
   * Configure average line appearance and behavior
   * @param {Object} config - Configuration for average line
   */
  setAverageLineConfig(config) {
    if (this.averageLine) {
      this.averageLine.updateConfig(config);
    }
    return this;
  }

  /**
   * Configure median line appearance and behavior
   * @param {Object} config - Configuration for median line
   */
  setMedianLineConfig(config) {
    if (this.medianLine) {
      this.medianLine.updateConfig(config);
    }
    return this;
  }

  /**
   * Set whether statistical lines should calculate across all datasets or just the first
   * @param {boolean} useAllDatasets - Whether to use all datasets for calculation
   */
  setStatisticalDataScope(useAllDatasets) {
    if (this.averageLine) {
      this.averageLine.updateConfig({ useAllDatasets });
    }
    if (this.medianLine) {
      this.medianLine.updateConfig({ useAllDatasets });
    }
    return this;
  }

  /**
   * Get statistical lines state for debugging
   */
  getStatisticalLinesInfo() {
    return {
      average: this.averageLine ? this.averageLine.getState() : { enabled: false },
      median: this.medianLine ? this.medianLine.getState() : { enabled: false }
    };
  }

  /**
 * FIXED: Clear render without destroying generated paths
 */
_clearRender() {
  try {
    // Clear the renderer (canvas/webgl)
    if (this.rendererInstance && this.rendererInstance.clear) {
      this.rendererInstance.clear();
    }
    
    // Clear grid canvas
    if (this.gridCanvas) {
      const gridCtx = this.gridCanvas.getContext('2d');
      if (gridCtx) {
        gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
      }
    }
    
    // Clear SVG overlay elements but preserve structure
    if (this.svgOverlay) {
      const children = Array.from(this.svgOverlay.children);
      children.forEach(child => {
        // Don't remove crosshair or other persistent components
        if (child.classList && 
            !child.classList.contains('crosshair') && 
            !child.classList.contains('tooltip')) {
          if (child.parentNode) {
            child.parentNode.removeChild(child);
          }
        }
      });
    }
    
    // Clear title element if it exists separately
    if (this.titleElement && this.titleElement.parentNode) {
      this.titleElement.parentNode.removeChild(this.titleElement);
      this.titleElement = null;
    }
    
    // ✅ FIX: DON'T clear generated paths here - they'll be regenerated when needed
    // this.generatedPaths = null;  // ❌ REMOVED: This was causing the bug
    
  } catch (error) {
    console.warn('Error clearing render:', error);
    // Don't throw - allow rendering to continue
  }
}

/**
 * Public method to ensure chart is ready before use
 * Add this to your Chart class for cleaner initialization handling
 */
async ensureInitialized() {
  if (this._initPromise) {
    await this._initPromise;
  }
  return this.isInitialized;
}
  
  /**
   * Destroy the chart and clean up resources
   */
  destroy() {
    // Cleanup crosshair
    if (this.crosshair) {
      this.crosshair.destroy();
      this.crosshair = null;
    }
    
    // Cleanup tooltip
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    // Cleanup recession lines
    if (this.recessionLines) {
      this.recessionLines.destroy();
      this.recessionLines = null; 
    }

    // Cleanup zero line
    if (this.zeroLine) {
      this.zeroLine.destroy();
      this.zeroLine = null;
    }

    // Cleanup average and median lines
    if (this.averageLine) {
      this.averageLine.destroy();
      this.averageLine = null;
    }

    if (this.medianLine) {
      this.medianLine.destroy();
      this.medianLine = null;
    }

    // Cleanup ending labels
    if (this.endingLabels) {
      this.endingLabels.destroy();
      this.endingLabels = null;
    }
    
    // Remove mouse event listeners
    if (this._boundMouseMove && this.container) {
      this.container.removeEventListener('mousemove', this._boundMouseMove);
      this.container.removeEventListener('mouseleave', this._boundMouseLeave);
      this._boundMouseMove = null;
      this._boundMouseLeave = null;
    }
    
    if (this.titleElement) {
      this.titleElement.remove();
      this.titleElement = null;
    }

    if (this.panelManager) {
      this.panelManager.destroy();
      this.panelManager = null;
    }
    
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }
    
    if (this.coordinateSystem) {
      this.coordinateSystem.clearCache();
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.renderers.clear();
    this.isInitialized = false;
    
    console.log('Chart destroyed and resources cleaned up');
  }
  
  _setupCrosshair() {
  if (!this.svgOverlay) {
    console.warn('SVG overlay not available for crosshair');
    return;
  }
  
  console.log('SVG overlay before crosshair render:', this.svgOverlay);
  console.log('Chart area before crosshair render:', this.chartArea);
  
  this.crosshair = new Crosshair({
    enabled: true,
    lineColor: '#666666',
    lineOpacity: 0.7,
    highlightRadius: 3
  });

  this.tooltip = new CrosshairTooltip({
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    textColor: '#ffffff',
    fontSize: 12,
    dateFormat: 'medium',
    valueDecimals: 2,
    offsetX: 15,
    offsetY: 15
  });
  
  // Debug the render call
  console.log('About to call crosshair.render with:', this.svgOverlay, this.chartArea);
  this.crosshair.render(this.svgOverlay, this.chartArea);
  console.log('Crosshair render completed');
  
  // Check if the crosshair group was actually added
  const crosshairGroup = this.svgOverlay.querySelector('.crosshair');
  console.log('Crosshair group after render:', crosshairGroup);
  
  this._setupCrosshairEvents();
  console.log('Crosshair component created');
}

  /**
   * Set up crosshair mouse event listeners
   * @private
   */
  _setupCrosshairEvents() {
    if (!this.container || !this.crosshair) return;
    
    // Mouse move handler
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseLeave = this._onMouseLeave.bind(this);
    
    // Add event listeners to the container
    this.container.addEventListener('mousemove', this._boundMouseMove);
    this.container.addEventListener('mouseleave', this._boundMouseLeave);
    
    console.log('Crosshair mouse events setup');
  }

  /**
   * Handle mouse move events for crosshair
   * @private
   */
  _onMouseMove(event) {
    if (!this.crosshair || !this.isInitialized) {
      return;
    }
    
    try {
      // Get mouse coordinates relative to container
      const rect = this.container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Check if mouse is within chart area
      if (!this._isMouseInChartArea(mouseX, mouseY)) {
        this.crosshair.hide();
        // Hide tooltip when outside chart area
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      
      // Apply distance threshold to avoid excessive updates
      if (this.lastMousePosition) {
        const deltaX = Math.abs(mouseX - this.lastMousePosition.x);
        const deltaY = Math.abs(mouseY - this.lastMousePosition.y);
        
        if (deltaX < this.mouseThreshold && deltaY < this.mouseThreshold) {
          // Update tooltip position even if crosshair doesn't update
          if (this.tooltip && this.tooltip.isVisible) {
            this.tooltip.updatePosition(mouseX, mouseY);
          }
          return; // Skip update if mouse hasn't moved enough
        }
      }
      
      this.lastMousePosition = { x: mouseX, y: mouseY };
      
      // Convert mouse coordinates to data coordinates
      const dataCoords = this._mouseToDataCoordinates(mouseX, mouseY);
      
      if (dataCoords.x != null && dataCoords.y != null) {
        // Update crosshair with new position
        this._updateCrosshair(dataCoords.x, mouseX, mouseY);
      }
      
    } catch (error) {
      console.error('Error handling crosshair mouse move:', error);
    }
  }

  /**
   * Handle mouse leave events for crosshair
   * @private
   */
  _onMouseLeave(event) {
    if (this.crosshair) {
      this.crosshair.hide();
      this.lastMousePosition = null;
    }
    if (this.tooltip) {
      this.tooltip.hide();
    }
  }

  /**
   * Check if mouse is within chart area
   * @private
   */
  _isMouseInChartArea(mouseX, mouseY) {
    const chartArea = this.chartArea;
    return mouseX >= chartArea.x && 
           mouseX <= chartArea.x + chartArea.width &&
           mouseY >= chartArea.y && 
           mouseY <= chartArea.y + chartArea.height;
  }

  /**
   * Convert mouse coordinates to data coordinates
   * @private
   */
  _mouseToDataCoordinates(mouseX, mouseY) {
    if (!this.scales.x || !this.scales.y) {
      return { x: null, y: null };
    }
    
    try {
      const dataX = this.scales.x.invert(mouseX);
      const dataY = this.scales.y.invert(mouseY);
      
      return { x: dataX, y: dataY };
      
    } catch (error) {
      console.error('Error converting mouse to data coordinates:', error);
      return { x: null, y: null };
    }
  }

  /**
   * Calculate proximity tolerance based on visible time range
   * @private
   */
  _calculateMouseProximityTolerance() {
    // Base tolerance on visible time range, not dataset frequency
    const xScale = this.scales.x;
    if (!xScale) return 3600000; // 1 hour fallback
    
    const visibleTimeRange = xScale.domain[1] - xScale.domain[0];
    const chartPixelWidth = this.chartArea.width;
    
    // Calculate milliseconds per pixel
    const msPerPixel = visibleTimeRange / chartPixelWidth;
    
    // Use tolerance of ~10 pixels worth of time (reasonable mouse precision)
    const tolerancePixels = 10;
    const tolerance = msPerPixel * tolerancePixels;
    
    // Cap at reasonable limits (5 minutes to 12 hours)
    return Math.max(300000, Math.min(43200000, tolerance));
  }

  /**
 * Get actual data points at specific X coordinate
 * @private
  */
  _getDataPointsAtX(exactDataX) {
    const dataPoints = [];
    
    if (!Array.isArray(this.config.data) || exactDataX == null) {
      return dataPoints;
    }
    
    // Get points from each dataset at the exact X coordinate
    for (const dataset of this.config.data) {
      if (dataset.data && Array.isArray(dataset.data)) {
        const points = this.getDataPointsAtX(exactDataX, dataset);
        if (points && points.length > 0) {
          dataPoints.push(...points);
        }
      }
    }
    
    return dataPoints;
  }

  /**
   * Update crosshair position and highlights
   * @private
   */
  _updateCrosshair(targetDataX, mouseX, mouseY) {
    console.log('=== _updateCrosshair called ===');
    console.log('targetDataX:', targetDataX, 'mouseX:', mouseX, 'mouseY:', mouseY);
    
    if (!this.crosshair) {
      console.log('No crosshair - returning');
      return;
    }
    
    try {
      // Find candidate points
      const candidatePoints = this._findCandidateDataPoints(targetDataX);
      console.log('candidatePoints:', candidatePoints.length);
      
      if (candidatePoints.length === 0) {
        console.log('No candidates - hiding tooltip');
        this.crosshair.hide();
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      
      // Select best X
      const bestDataX = this._findBestDataX(candidatePoints, targetDataX);
      console.log('bestDataX:', bestDataX);
      
      // Get actual points
      const actualDataPoints = this._getDataPointsAtX(bestDataX);
      console.log('actualDataPoints:', actualDataPoints);
      console.log('actualDataPoints structure:', actualDataPoints.map(p => ({
        dataset: p.dataset ? p.dataset.name : 'no dataset',
        dataX: p.dataX,
        dataY: p.dataY,
        color: p.color
      })));
      
      if (actualDataPoints.length === 0) {
        console.log('No actual points - hiding tooltip');
        this.crosshair.hide();
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      
      // Update crosshair
      const primaryPoint = actualDataPoints[0];
      const crosshairX = primaryPoint.unifiedX;
      const crosshairY = primaryPoint.unifiedY;
      
      this.crosshair.show();
      this.crosshair.updatePosition(crosshairX, crosshairY);
      this.crosshair.updateHighlights(actualDataPoints);
      
      // SHOW TOOLTIP - Debug this part carefully
      if (this.tooltip) {
        console.log('About to call tooltip.show with:', {
          dataPoints: actualDataPoints.length,
          mouseX: mouseX,
          mouseY: mouseY
        });
        
        this.tooltip.show(actualDataPoints, mouseX, mouseY);
        
        console.log('Tooltip state after show:', this.tooltip.getState());
      } else {
        console.log('No tooltip object available');
      }
      
    } catch (error) {
      console.error('Error updating crosshair:', error);
      if (this.tooltip) {
        this.tooltip.hide();
      }
    }
  }

  /**
   * Find the best X coordinate across all candidate points
   * @private
   */
  _findBestDataX(candidatePoints, mouseDataX) {
    if (candidatePoints.length === 0) return null;
    if (candidatePoints.length === 1) return candidatePoints[0].dataX;
    
    // FIXED: Find X coordinate closest to mouse position
    let bestX = null;
    let minDistance = Infinity;
    
    // Group by X coordinate and find closest to mouse
    const xGroups = new Map();
    candidatePoints.forEach(point => {
      const dataX = point.dataX;
      if (!xGroups.has(dataX)) {
        xGroups.set(dataX, []);
      }
      xGroups.get(dataX).push(point);
    });
    
    for (const [dataX, points] of xGroups) {
      const distance = Math.abs(dataX - mouseDataX);
      if (distance < minDistance) {
        minDistance = distance;
        bestX = dataX;
      }
    }
    
    console.log(`Best X: ${bestX}, distance from mouse: ${minDistance}ms`);
    return bestX;
  }

  /**
   * Find candidate data points from all datasets
   * @private
   */
  _findCandidateDataPoints(targetDataX) {
    const candidates = [];
    
    if (!Array.isArray(this.config.data)) {
      return candidates;
    }
    
    // Get closest points from each dataset
    for (const dataset of this.config.data) {
      if (dataset.data && Array.isArray(dataset.data) && dataset.data.length > 0) {
        const closestPoints = this.findClosestDataPoints(targetDataX, dataset);
        if (closestPoints && closestPoints.length > 0) {
          candidates.push(...closestPoints);
        }
      }
    }
    
    return candidates;
  }

  testNewCrosshairLogic(mouseDataX) {
    console.log(`\n=== Testing New Crosshair Logic at ${mouseDataX} ===`);
    
    const tolerance = this._calculateMouseProximityTolerance();
    console.log(`Global tolerance: ${tolerance}ms (${tolerance/60000} minutes)`);
    
    this.config.data.forEach((dataset, i) => {
      const points = this.getDataPointsAtX(mouseDataX, dataset);
      console.log(`\nDataset ${i} (${dataset.name}):`);
      console.log(`  Found ${points.length} points within tolerance`);
      
      points.forEach(point => {
        const diff = Math.abs(point.dataX - mouseDataX);
        console.log(`    Point at ${point.dataX}, diff: ${diff}ms (${diff/60000} minutes)`);
      });
      
      if (points.length === 0) {
        // Find actual closest for comparison
        const closest = this.findClosestDataPoints(mouseDataX, dataset);
        if (closest.length > 0) {
          const diff = Math.abs(closest[0].dataX - mouseDataX);
          console.log(`    Closest point (rejected): ${closest[0].dataX}, diff: ${diff}ms (${diff/60000} minutes)`);
        }
      }
    });
  }

  // PLACEHOLDER METHODS (implemented in LineChart/BarChart)
  findClosestDataPoints(targetDataX, dataset) {
    console.warn('findClosestDataPoints not implemented');
    return [];
  }

  getDataPointsAtX(exactDataX, dataset) {
    console.warn('getDataPointsAtX not implemented');
    return [];
  }
  
  /**
   * Configure tooltip appearance
   */
  setTooltipConfig(config) {
    if (this.tooltip) {
      this.tooltip.updateConfig(config);
    }
    return this;
  }

  /**
   * Enable/disable tooltip
   */
  toggleTooltip(enabled = null) {
    const shouldEnable = enabled !== null ? enabled : !this.tooltip;
    
    if (shouldEnable && !this.tooltip) {
      this.tooltip = new CrosshairTooltip();
    } else if (!shouldEnable && this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    
    return shouldEnable;
  }

  /**
   * Get tooltip state for debugging
   */
  getTooltipInfo() {
    return this.tooltip ? this.tooltip.getState() : { enabled: false };
  }
}
/**
 * Chart.js - Enhanced Base Chart Class with Multi-Renderer Support (Updated)
 * 
 * Foundation class for all chart types in VisionCharts.
 * Handles automatic renderer selection (Canvas 2D vs WebGL) based on dataset size.
 * NOW WITH UNIFIED COORDINATE SYSTEM for consistent rendering across all renderers.
 */

import { Axis } from './Axis.js';
import { Scale, ScaleManager } from './Scale.js';
import { Grid } from '../components/Grid.js';
import CanvasRenderer from '../renderers/CanvasRenderer.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CoordinateSystem } from '../utils/CoordinateSystem.js';
import { DataProcessor } from '../utils/DataProcessor.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { Panel } from '../components/Panel.js';
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

    this.isPanelMode = false;
    this.panels = [];
    this.panelContainer = null;
    this.sharedXScale = null;
    this.originalSingleModeState = null;
    
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
 * Process raw data into usable format
 * @private
 */
async _processData() {
  if (!this.config.data || !Array.isArray(this.config.data)) {
    console.warn('No data to process');
    return;
  }

  try {
    console.log('Processing raw data with DataProcessor...');
    
    // ✅ FIX: Create proper options object with all required DataProcessor fields
    const processingOptions = {
      xField: this.config.options.xField,
      yField: this.config.options.yField,
      xType: this.config.options.xType,
      yType: this.config.options.yType,
      // ✅ CRITICAL: Include missing DataProcessor options
      gapThreshold: '1d',           // Prevent the undefined error
      fillGaps: false,
      strictValidation: false,
      autoDetectTimeFormat: true,
      sortByTime: true,
      removeDuplicates: true,
      timeZone: 'UTC',
      enableCaching: true,
      batchSize: 10000
    };
    
    const processedDatasets = [];
    
    for (let i = 0; i < this.config.data.length; i++) {
      const dataset = this.config.data[i];
      console.log(`Processing dataset ${i + 1}/${this.config.data.length}: ${dataset.name || dataset.id || 'Unknown'}`);
      
      if (!dataset.data || !Array.isArray(dataset.data)) {
        console.warn(`Dataset ${i} has invalid data, skipping`);
        continue;
      }

      // ✅ FIX: Use DataProcessor with complete options
      const processedData = await this.dataProcessor.processDataset(dataset, processingOptions);

      processedDatasets.push({
        ...dataset,
        data: processedData
      });
    }

    // Update data point count for renderer selection
    this.dataPointCount = processedDatasets.reduce((count, dataset) => 
      count + (dataset.data ? dataset.data.length : 0), 0);

    // Store processed data back
    this.config.data = processedDatasets;
    
    console.log(`DataProcessor: Successfully processed ${processedDatasets.length} datasets`);
    console.log(`DataProcessor: Cleaned data, ${this.dataPointCount} total points`);

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
 * Calculate data domains from current datasets
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
  
  // Iterate through all datasets
  for (const dataset of this.config.data) {
    if (!dataset.data || !Array.isArray(dataset.data) || dataset.data.length === 0) {
      continue;
    }
    
    // Find min/max for each axis
    for (const point of dataset.data) {
      const xValue = this._getXValue(point);
      const yValue = this._getYValue(point);
      
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
    xMin = 0;
    xMax = 1;
  }
  
  if (yMin === Infinity || yMax === -Infinity) {
    yMin = 0;
    yMax = 1;
  }
  
  // Add padding for better visualization
  const xPadding = (xMax - xMin) * 0.05 || 0.1;
  const yPadding = (yMax - yMin) * 0.05 || 0.1;
  
  this.dataDomains = {
    x: [xMin - xPadding, xMax + xPadding],
    y: [yMin - yPadding, yMax + yPadding]
  };
  
  console.log('Data domains calculated:', this.dataDomains);
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
   * UPDATED: Create scale instances with unified coordinate system
   */
  _createScales() {
    // Determine scale types
    const xScaleType = this.config.options.isLogarithmic ? 'log' : 'linear';
    const yScaleType = this.config.options.isLogarithmic ? 'log' : 'linear';
    
    // UPDATED: X Scale with unified coordinate system
    this.scales.x = new Scale({
      type: xScaleType,
      domain: [...this.dataDomains.x],
      range: [this.chartArea.x, this.chartArea.x + this.chartArea.width], // Standard left-to-right
      dataType: this.config.options.xType,
      coordinateSystem: 'normalized', // Use unified coordinate system
      orientation: 'horizontal',
      options: {
        nice: true,
        padding: 0.05
      }
    });
    
    // UPDATED: Y Scale with unified coordinate system (NO manual inversion)
    this.scales.y = new Scale({
      type: yScaleType,
      domain: [...this.dataDomains.y],
      range: [this.chartArea.y, this.chartArea.y + this.chartArea.height], // Bottom-to-top for unified system
      dataType: this.config.options.yType,
      coordinateSystem: 'normalized', // Use unified coordinate system
      orientation: 'vertical',
      options: {
        nice: true,
        padding: 0.05
      }
    });
    
    // Register scales with manager
    this.scaleManager.setScale('x', this.scales.x);
    this.scaleManager.setScale('y', this.scales.y);
    
    // UPDATED: Set scales in coordinate system for transformation
    if (this.coordinateSystem) {
      this.coordinateSystem.setScales(this.scales);
    }
    
    console.log('Scales created with unified coordinate system');
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
   * Select optimal renderer based on data size and browser capabilities
   */
  _selectOptimalRenderer() {
    // Check for forced renderer
    if (this.config.options.forceRenderer) {
      this.activeRenderer = this.config.options.forceRenderer;
      console.log(`Using forced renderer: ${this.activeRenderer}`);
      return;
    }
    
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
 * Extract X value from data point (can be overridden by subclasses)
 * @private
 */
_getXValue(point) {
  const xField = this.config.options.xField;
  let value = point[xField];
  
  // Convert Date objects to timestamps for calculations
  if (value instanceof Date) {
    value = value.getTime();
  }
  
  return typeof value === 'number' ? value : null;
}

/**
 * Extract Y value from data point (can be overridden by subclasses)  
 * @private
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

      // Step 2: Use PathGenerator to create standardized rendering paths
      console.log('Generating standardized paths with PathGenerator...');
      
      this.generatedPaths = await this.pathGenerator.generatePaths(this.config.data, {
        curve: this.config.options.curve || 'linear',
        strokeWidth: this.config.options.strokeWidth || 2
      });

      console.log('Standardized paths generated from UNIFIED coordinates for', this.activeRenderer, 'renderer');
      
    } catch (error) {
      console.error('Error in preprocessing data for renderer:', error);
      throw error;
    }
  }

  /**
   * Toggle between single chart and panel mode
   */
  async togglePanelMode(force = null) {
    const newPanelMode = force !== null ? force : !this.isPanelMode;
    
    if (newPanelMode === this.isPanelMode) {
      console.log(`Already in ${newPanelMode ? 'panel' : 'single'} mode`);
      return newPanelMode;
    }
    
    console.log(`Switching to ${newPanelMode ? 'panel' : 'single'} mode`);
    
    try {
      if (newPanelMode) {
        await this._switchToPanelMode();
      } else {
        await this._switchToSingleMode();
      }
      
      this.isPanelMode = newPanelMode;
      console.log(`Successfully switched to ${newPanelMode ? 'panel' : 'single'} mode`);
      
      return newPanelMode;
      
    } catch (error) {
      console.error('Error toggling panel mode:', error);
      throw error;
    }
  }
  
  /**
   * Switch to panel mode - destroy single chart and create panels
   * @private
   */
  async _switchToPanelMode() {
    if (this.isPanelMode) return;
    
    // Validate we have multiple datasets
    if (!Array.isArray(this.config.data) || this.config.data.length <= 1) {
      throw new Error('Panel mode requires multiple datasets');
    }
    
    console.log(`Creating panel mode with ${this.config.data.length} panels`);
    
    // Store current single mode state
    this._storeSingleModeState();
    
    // Destroy current single chart components
    this._destroySingleModeComponents();
    
    // Create shared X scale
    this._createSharedXScale();
    
    // Create panel container
    this._createPanelContainer();
    
    // Create individual panels
    await this._createPanels();
    
    // Render all panels
    await this._renderPanels();
    
    console.log('Panel mode activated successfully');
  }
  
  /**
   * Switch to single mode - destroy panels and recreate single chart
   * @private
   */
  async _switchToSingleMode() {
    if (!this.isPanelMode) return;
    
    console.log('Switching back to single chart mode');
    
    // Destroy all panels
    this._destroyPanels();
    
    // Remove panel container
    this._destroyPanelContainer();
    
    // Restore single mode state
    this._restoreSingleModeState();
    
    // Reinitialize single chart
    await this._reinitializeSingleChart();
    
    console.log('Single chart mode restored successfully');
  }
  
  /**
   * Store single mode state for restoration
   * @private
   */
  _storeSingleModeState() {
    this.originalSingleModeState = {
      rendererInstance: this.rendererInstance,
      canvas: this.canvas,
      svgOverlay: this.svgOverlay,
      scales: { ...this.scales },
      axes: { ...this.axes },
      chartArea: { ...this.chartArea },
      generatedPaths: this.generatedPaths ? [...this.generatedPaths] : null,
      transformedData: this.transformedData ? [...this.transformedData] : null
    };
  }
  
  /**
   * Restore single mode state
   * @private
   */
  _restoreSingleModeState() {
    if (!this.originalSingleModeState) {
      console.warn('No stored single mode state to restore');
      return;
    }
    
    // Note: We don't restore the actual instances since they were destroyed
    // Instead, we'll reinitialize them in _reinitializeSingleChart
    this.originalSingleModeState = null;
  }
  
  /**
   * Destroy single mode components
   * @private
   */
  _destroySingleModeComponents() {
    // Destroy renderer
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }
    
    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
    }
    
    // Remove SVG overlay
    if (this.svgOverlay && this.svgOverlay.parentNode) {
      this.svgOverlay.parentNode.removeChild(this.svgOverlay);
      this.svgOverlay = null;
    }
    
    // Clear scales and axes
    this.scales = { x: null, y: null };
    this.axes = { x: null, y: null };
    this.generatedPaths = null;
    this.transformedData = null;
  }
  
  /**
   * Create shared X scale for all panels
   * @private
   */
  _createSharedXScale() {
    // Calculate combined X domain from all datasets
    let xMin = Infinity;
    let xMax = -Infinity;
    
    for (const dataset of this.config.data) {
      if (!dataset.data || !Array.isArray(dataset.data)) continue;
      
      for (const point of dataset.data) {
        if (point.x != null) {
          const xValue = point.x instanceof Date ? 
            point.x.getTime() : point.x;
          xMin = Math.min(xMin, xValue);
          xMax = Math.max(xMax, xValue);
        }
      }
    }
    
    if (xMin === Infinity || xMax === -Infinity) {
      throw new Error('No valid X values found in datasets');
    }
    
    // Create shared X scale
    const xDomain = [xMin, xMax];
    const xRange = [60, this.container.offsetWidth - 20]; // Leave space for Y axes
    
    const scaleType = this.config.options.xType === 'time' ? 'time' : 'linear';
    
    // Use ScaleManager to create scale
    this.sharedXScale = this.scaleManager.createScale(scaleType, {
      domain: xDomain,
      range: xRange,
      dataType: this.config.options.xType,
      coordinateSystem: 'normalized',
      orientation: 'horizontal',
      options: {
        nice: true,
        padding: 0.05
      }
    });
    
    console.log('Shared X scale created:', { domain: xDomain, range: xRange });
  }
  
  /**
   * Create panel container
   * @private
   */
  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panels-container';
    this.panelContainer.style.width = '100%';
    this.panelContainer.style.height = '100%';
    this.panelContainer.style.overflow = 'auto';
    
    // Clear existing container content
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    
    this.container.appendChild(this.panelContainer);
  }
  
  /**
   * Create individual panels for each dataset
   * @private
   */
  async _createPanels() {
    this.panels = [];
    
    const totalPanels = this.config.data.length;
    const panelHeight = Math.max(150, Math.floor((this.container.offsetHeight - 100) / totalPanels));
    
    for (let i = 0; i < this.config.data.length; i++) {
      const dataset = this.config.data[i];
      
      const panel = new Panel({
        dataset: dataset,
        container: this.panelContainer,
        panelIndex: i,
        totalPanels: totalPanels,
        sharedXScale: this.sharedXScale,
        height: panelHeight,
        chartType: this.constructor.name.toLowerCase().replace('chart', ''), // 'line' or 'bar'
        rendererType: this.activeRenderer || 'canvas'
      });
      
      await panel.initialize();
      this.panels.push(panel);
    }
    
    console.log(`Created ${this.panels.length} panels`);
  }
  
  /**
   * Render all panels
   * @private
   */
  async _renderPanels() {
    for (const panel of this.panels) {
      await panel.render();
    }
    
    console.log('All panels rendered');
  }
  
  /**
   * Destroy all panels
   * @private
   */
  _destroyPanels() {
    for (const panel of this.panels) {
      panel.destroy();
    }
    
    this.panels = [];
    this.sharedXScale = null;
  }
  
  /**
   * Destroy panel container
   * @private
   */
  _destroyPanelContainer() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
  }
  
  /**
   * Reinitialize single chart after returning from panel mode
   * @private
   */
  async _reinitializeSingleChart() {
    // Calculate chart area
    this._calculateChartArea();
    
    // Process data
    await this._processData();
    
    // Create scales
    this._createScales();
    
    // Create axes  
    this._createAxes();
    
    // Create grid
    this._createGrid();
    
    // Initialize renderer
    await this._initializeRenderer();
    
    // Create SVG overlay
    this._createSVGOverlay();
    
    // Full render
    await this.render();
  }
  
  /**
   * Render chart - handle both single and panel modes
   */
  async render() {
    if (this.isPanelMode) {
      await this._renderPanels();
    } else {
      await this._renderSingleMode();
    }
  }

  /**
   * Render single mode (original render logic)
   * @private
   */
  async _renderSingleMode() {
  if (!this.isInitialized) {
    console.warn('Chart not initialized, cannot render');
    return;
  }

  console.log('Rendering chart...');
  
  try {
    // Clear previous render
    this._clearRender();
    
    // Render title
    this._renderTitle();
    
    // ✅ FIX: Render grid with canvas context (Grid expects Canvas 2D context)
    if (this.grid && this.config.options.showGrid && this.gridCanvas) {
      // Update grid with current chart area and scales
      this.grid.updateChartArea(this.chartArea);
      this.grid.updateScales(this.scales.x, this.scales.y);
      
      // Get canvas context and render
      const gridCtx = this.gridCanvas.getContext('2d');
      if (gridCtx) {
        // Apply DPI scaling to grid canvas if needed
        const devicePixelRatio = window.devicePixelRatio || 1;
        gridCtx.save();
        gridCtx.scale(devicePixelRatio, devicePixelRatio);
        
        this.grid.render(gridCtx);  // Pass canvas context, not SVG
        
        gridCtx.restore();
      }
    }
    
    // Render chart data (implemented by subclasses)
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
    return {
      isPanelMode: this.isPanelMode,
      panelCount: this.panels.length,
      panels: this.panels.map(panel => panel.getInfo()),
      sharedXScale: this.sharedXScale ? {
        domain: this.sharedXScale.domain,
        range: this.sharedXScale.range,
        type: this.sharedXScale.type
      } : null
    };
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
      return this._updatePanelMode();
    } else {
      return this._updateSingleMode();
    }
  }

  /**
   * Update panel mode
   * @private
   */
  async _updatePanelMode() {
    // Recreate shared X scale
    this._createSharedXScale();
    
    // Update all panels
    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];
      const dataset = this.config.data[i];
      
      if (dataset) {
        await panel.update(dataset);
      }
    }
    
    console.log('Panel mode updated');
  }
  
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
      webglCapabilities: WebGLRenderer.getCapabilities(),
      coordinateSystem: this.coordinateSystem ? this.coordinateSystem.getCoordinateInfo() : null
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
   * Clear previous render content
   * @private
   */
  _clearRender() {
    try {
      // Clear the renderer (canvas/webgl)
      if (this.rendererInstance && this.rendererInstance.clear) {
        this.rendererInstance.clear();
      }
      
      // ✅ Clear grid canvas too
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
          if (child.parentNode) {
            child.parentNode.removeChild(child);
          }
        });
      }
      
      // Clear title element if it exists separately
      if (this.titleElement && this.titleElement.parentNode) {
        this.titleElement.parentNode.removeChild(this.titleElement);
        this.titleElement = null;
      }
      
      // Reset any cached render state
      this.generatedPaths = null;
      
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
    
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }
    
    if (this.coordinateSystem) {
      this.coordinateSystem.clearCache(); // Clear any cached data
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.renderers.clear();
    this.isInitialized = false;
    
    console.log('Chart destroyed and resources cleaned up');
  }
  
  /**
   * Set up crosshair component
   * @private
   */
  _setupCrosshair() {
    if (!this.svgOverlay) {
      console.warn('SVG overlay not available for crosshair');
      return;
    }
    
    // Create crosshair instance (always enabled)
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
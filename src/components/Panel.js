import { Axis } from '../core/Axis.js';
import { Scale } from '../core/Scale.js';
import PanelDataRenderer from './PanelDataRenderer.js';
import { RecessionLines } from './RecessionLines.js';
import { ZeroLine } from './ZeroLine.js';
import { Grid } from './Grid.js';
import { StatisticalLines } from './StatisticalLines.js';
// import StudiesRenderer from './StudiesRenderer.js';

/**
 * Panel component for rendering multi-panel charts
 * Each panel renders a single dataset independently with shared X-axis
 */
export class Panel {
  constructor(config = {}) {
    this.config = {
      dataset: null,                    // Single dataset for this panel
      chartArea: null,                  // Panel-specific chart area
      panelIndex: 0,                    // Index in panel stack
      totalPanels: 1,                   // Total number of panels
      sharedXScale: null,               // Shared X-axis scale
      container: null,                  // Panel container element
      chartType: 'line',                // 'line' or 'bar'
      hasSharedXAxis: false,            // Whether to use shared X-axis

      // Panel-specific options
      height: 200,
      padding: { 
        top: Math.max(5, Math.floor(config.height * 0.05) || 8),  // 5% of height, min 5px
        bottom: config.hasSharedXAxis ? 2 : Math.max(5, Math.floor(config.height * 0.05) || 8),
        left: 60,  // Keep space for Y axis labels
        right: 20 
      },
      showAxisLabels: true,
      showTitle: true,
      
      // Rendering options
      rendererType: 'canvas',           // 'canvas' or 'webgl'
      
      ...config
    };

    if (config.height) {
      this.config.padding.top = Math.max(5, Math.floor(config.height * 0.05));
      this.config.padding.bottom = config.hasSharedXAxis ? 2 : Math.max(5, Math.floor(config.height * 0.05));
    }
    
    // Panel state
    this.isInitialized = false;
    this.isRendered = false;
    
    // Rendering components
    this.yScale = null;
    this.yAxis = null;
    this.panelDataRenderer = null;
    this.grid = null;
    this.canvas = null;
    this.rendererInstance = null;
    this.svgOverlay = null;
    
    // Panel-specific chart area
    this.panelChartArea = null;
    
    console.log(`Panel created for dataset: ${this.config.dataset?.name || 'Unknown'}`);
  }
  
  /**
   * Initialize the panel
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('Panel already initialized');
      return;
    }
    
    if (!this.config.dataset || !this.config.container || !this.config.sharedXScale) {
      throw new Error('Panel requires dataset, container, and shared X scale');
    }
    
    // Create panel container
    this._createPanelContainer();
    
    // Calculate panel chart area
    this._calculateChartArea();
    
    // Create Y scale for this panel's dataset
    this._createYScale();
    
    // Create Y axis
    this._createYAxis();
    
    // Create panel data renderer
    this._createDataRenderer();

    // Create grid for this panel
    this._createGrid();

    // Initialize renderer (Canvas/WebGL)
    await this._initializeRenderer();
    
    this.isInitialized = true;
    console.log(`Panel initialized for ${this.config.dataset.name}`);
  }
  
  /**
   * Render the panel
   */
  async render() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Clear previous render
      this._clearPanel();
      
      // Render grid FIRST (background layer)
      if (this.grid && this.config.showGrid !== false) {
        console.log(`Rendering grid for panel: ${this.config.dataset.name}`);
        this._renderGrid();
      }
      
      // Render Y axis
      this._renderYAxis();
      
      // Render data using panel data renderer
      await this.panelDataRenderer.render(
        this.config.dataset,
        this.config.sharedXScale,
        this.yScale,
        this.panelChartArea,
        this.rendererInstance
      );
      
      // Render panel title if enabled
      if (this.config.showTitle) {
        this._renderPanelTitle();
      }
      
      this.isRendered = true;
      console.log(`Panel rendered: ${this.config.dataset.name}`);
      
    } catch (error) {
      console.error('Error rendering panel:', error);
      throw error;
    }
  }
  
  /**
   * Update panel with new data
   */
  async update(newDataset = null) {
    if (newDataset) {
      this.config.dataset = newDataset;
      
      // Recreate Y scale for new data domain
      this._createYScale();
      this._createYAxis();
      
      // Update grid with new Y scale
      if (this.grid) {
        console.log(`Updating grid for panel: ${this.config.dataset.name}`);
        this.grid.updateScales(this.config.sharedXScale, this.yScale);
        this.grid.updateChartArea(this.panelChartArea);
      }
    }
    
    // Re-render
    await this.render();
  }
  
  /**
   * Destroy panel and cleanup
   */
  destroy() {
    // Cleanup renderer
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }
    
    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    // Remove SVG overlay
    if (this.svgOverlay && this.svgOverlay.parentNode) {
      this.svgOverlay.parentNode.removeChild(this.svgOverlay);
    }
    
    // Remove panel container
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
    }
    
    // Clear references
    this.yScale = null;
    this.yAxis = null;
    this.panelDataRenderer = null;
    this.grid = null;
    this.canvas = null;
    this.svgOverlay = null;
    this.panelContainer = null;
    
    this.isInitialized = false;
    this.isRendered = false;
    
    console.log(`Panel destroyed: ${this.config.dataset?.name || 'Unknown'}`);
  }

  
  /**
   * Create panel container with dynamic sizing
   * @private
   */
  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panel-container';
    this.panelContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: ${this.config.height}px;
      overflow: hidden;
      border-bottom: ${this.config.panelIndex < this.config.totalPanels - 1 ? '1px solid #eee' : 'none'};
      box-sizing: border-box;
    `;
    
    this.config.container.appendChild(this.panelContainer);
  }
  
  /**
   * Calculate panel-specific chart area
   * @private
   */
  _calculateChartArea() {
    const containerRect = this.panelContainer.getBoundingClientRect();
    
    this.panelChartArea = {
      x: this.config.padding.left,
      y: this.config.padding.top,
      width: containerRect.width - this.config.padding.left - this.config.padding.right,
      height: this.config.height - this.config.padding.top - this.config.padding.bottom
    };
  }
  
  /**
   * Create Y scale for this panel
   * @private
   */
  _createYScale() {
    if (!this.config.dataset || !this.config.dataset.data) {
      throw new Error('Panel dataset required for Y scale creation');
    }
    
    // Calculate Y domain for this dataset only
    const yValues = this.config.dataset.data
      .map(d => d.y)
      .filter(y => y != null && !isNaN(y));
    
    if (yValues.length === 0) {
      throw new Error('No valid Y values found in panel dataset');
    }
    
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const yDomain = [yMin, yMax];
    
    // Determine scale type
    const scaleType = this.config.scaleType || 'linear';
    
    // Y scale range: flip for canvas coordinate system (Y increases downward)
    const yRange = [this.panelChartArea.y + this.panelChartArea.height, this.panelChartArea.y];
    
    this.yScale = new Scale({
      type: scaleType,
      domain: yDomain,
      range: yRange,
      coordinateSystem: 'unified',
      orientation: 'vertical',
      options: {
        nice: false,
        padding: 0,
        clamp: true
      }
    });
    
    console.log(`Panel Y scale created for ${this.config.dataset.name}`);
  }
  
  /**
   * Create Y axis for this panel with height-aware tick count
   * @private
   */
  _createYAxis() {
    // Calculate optimal tick count based on panel height
    const availableHeight = this.panelChartArea.height;
    const minTickSpacing = 20; // Minimum pixels between ticks
    const maxTicks = Math.max(2, Math.floor(availableHeight / minTickSpacing));
    const optimalTicks = Math.min(5, maxTicks); // Cap at 5 ticks max
    
    this.yAxis = new Axis({
      orientation: 'y',
      scale: this.yScale,
      options: {
        label: this.config.yAxisName || 'Value',
        fontSize: Math.max(9, Math.min(11, this.config.height / 20)), // Scale font with panel height
        color: '#666',
        showAxisLine: true,
        showTicks: true,
        showTickLabels: true,
        tickCount: optimalTicks,
        abbreviateLabels: true,
        tickPadding: 4 // Reduce padding for small panels
      }
    });
    
    console.log(`Panel Y axis created with ${optimalTicks} ticks for ${availableHeight}px height`);
  }
  
  /**
   * Create panel data renderer
   * @private
   */
  _createDataRenderer() {
    this.panelDataRenderer = new PanelDataRenderer({
      chartType: this.config.chartType,
      rendererType: this.config.rendererType
    });
  }
  
  /**
   * Initialize Canvas/WebGL renderer for this panel
   * @private
   */
  async _initializeRenderer() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.pointerEvents = 'none';
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.panelContainer.offsetWidth * dpr;
    this.canvas.height = this.config.height * dpr;
    this.canvas.style.width = `${this.panelContainer.offsetWidth}px`;
    this.canvas.style.height = `${this.config.height}px`;
    
    this.panelContainer.appendChild(this.canvas);
    
    // Create SVG overlay for axes and labels
    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgOverlay.style.position = 'absolute';
    this.svgOverlay.style.left = '0';
    this.svgOverlay.style.top = '0';
    this.svgOverlay.style.width = '100%';
    this.svgOverlay.style.height = '100%';
    this.svgOverlay.style.pointerEvents = 'none';
    
    this.panelContainer.appendChild(this.svgOverlay);
    
    // Initialize appropriate renderer
    if (this.config.rendererType === 'webgl') {
      const { default: WebGLRenderer } = await import('../renderers/WebGLRenderer.js');
      this.rendererInstance = new WebGLRenderer();
      await this.rendererInstance.initialize(this.canvas, {
          width: this.panelContainer.offsetWidth,
          height: this.config.height
      });
    } else {
      const { default: CanvasRenderer } = await import('../renderers/CanvasRenderer.js');
      this.rendererInstance = new CanvasRenderer();
      await this.rendererInstance.initialize(this.canvas, {
          width: this.panelContainer.offsetWidth,
          height: this.config.height
      });
    }
  }

  /**
   * Create grid for this panel
   * @private
   */
  _createGrid() {
    console.log(`Creating grid for panel: ${this.config.dataset.name}`);
    
    const gridOptions = {
      showXGrid: this.config.showXGrid !== false,
      showYGrid: this.config.showYGrid !== false,
      
      // Visual properties
      xGridColor: '#e0e0e0',
      yGridColor: '#e0e0e0',
      xGridOpacity: 1,
      yGridOpacity: 1,
      xGridWidth: 0.5,
      yGridWidth: 0.5,
      
      skipEdgeLines: true,
    };

    this.grid = new Grid({
      xScale: this.config.sharedXScale,
      yScale: this.yScale,
      chartArea: this.panelChartArea,
      ...gridOptions
    });
    
    console.log(`Panel grid created for: ${this.config.dataset.name}`);
  }

  /**
   * Clear panel content
   * @private
   */
  _clearPanel() {
    if (this.rendererInstance) {
      this.rendererInstance.clear();
    }
    
    // Clear SVG overlay
    if (this.svgOverlay) {
      while (this.svgOverlay.firstChild) {
        this.svgOverlay.removeChild(this.svgOverlay.firstChild);
      }
    }
  }
  
  /**
   * Render Y axis
   * @private
   */
  _renderYAxis() {
    if (this.yAxis && this.svgOverlay) {
      this.yAxis.render(this.svgOverlay, {
        x: this.config.padding.left,
        y: 0
      });
    }
  }
  
  /**
   * Render panel title
   * @private
   */
  _renderPanelTitle() {
    if (!this.svgOverlay || !this.config.dataset.name) return;
    
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    
    titleElement.setAttribute('x', this.panelChartArea.x + 8);
    titleElement.setAttribute('y', this.panelChartArea.y + 8);
    titleElement.setAttribute('text-anchor', 'start');
    titleElement.setAttribute('dominant-baseline', 'hanging');
    titleElement.style.fontSize = '12px';
    titleElement.style.fontWeight = '500';
    titleElement.style.fill = this.config.dataset.color || '#333';
    titleElement.textContent = this.config.dataset.name;
    
    this.svgOverlay.appendChild(titleElement);
  }

  /**
   * Render grid for this panel
   * @private
   */
  _renderGrid() {
    if (!this.grid || !this.canvas) {
      console.log('No grid or canvas available for rendering');
      return;
    }
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      console.log('No canvas context available for grid rendering');
      return;
    }
    
    console.log(`Grid rendering for panel: ${this.config.dataset.name}`);
    
    // Update grid with current scales and chart area
    this.grid.updateScales(this.config.sharedXScale, this.yScale);
    this.grid.updateChartArea(this.panelChartArea);
    
    ctx.save();
    
    
    try {
      this.grid.render(ctx);
      console.log(`Grid rendered successfully for panel: ${this.config.dataset.name}`);
    } catch (error) {
      console.error('Error rendering grid:', error);
    }
    
    ctx.restore();
  }

  /**
 * Get the line endpoint data for this panel
 * Used by PanelManager to collect endpoint coordinates for ending labels
 */
getLineEndpoint() {
  if (!this.config.dataset || !this.config.dataset.data || this.config.dataset.data.length === 0) {
    return null;
  }

  const lastPoint = this.config.dataset.data[this.config.dataset.data.length - 1];
  if (!lastPoint) return null;

  // ✅ FIXED: Calculate coordinates using current scales instead of stored coordinates
  if (!this.config.sharedXScale || !this.yScale) {
    console.warn(`Panel ${this.config.dataset.name}: Missing scales for endpoint calculation`);
    return null;
  }

  // Calculate fresh coordinates using current panel scales
  const endX = this.config.sharedXScale.scale(lastPoint.x);
  const endY = this.yScale.scale(lastPoint.y);

  console.log(`🎯 PANEL ${this.config.panelIndex} LINE ENDPOINT DEBUG:`, {
    datasetName: this.config.dataset.name,
    
    // Raw data point
    lastDataPoint: {
      x: lastPoint.x,
      y: lastPoint.y
    },
    
    // ✅ FRESH CALCULATED coordinates using current scales
    freshCoords: { endX, endY },
    
    // ❌ OLD stored coordinates (for comparison)
    oldStoredCoords: {
      unifiedX: lastPoint.unifiedX,
      unifiedY: lastPoint.unifiedY,
      screenX: lastPoint.screenX,
      screenY: lastPoint.screenY
    },
    
    // Panel info
    panelChartArea: this.panelChartArea,
    
    // Scale verification
    scaleInfo: {
      xScale: {
        domain: this.config.sharedXScale.domain,
        range: this.config.sharedXScale.range,
        inputValue: lastPoint.x,
        outputValue: endX
      },
      yScale: {
        domain: this.yScale.domain,
        range: this.yScale.range,
        inputValue: lastPoint.y,
        outputValue: endY
      }
    }
  });

  if (endX == null || endY == null || !isFinite(endX) || !isFinite(endY)) {
    console.warn(`Panel ${this.config.dataset.name}: Invalid calculated endpoint coordinates`);
    return null;
  }

  // Check if point is within panel chart area
  const tolerance = 50;
  if (endX < this.panelChartArea.x - tolerance || 
      endX > this.panelChartArea.x + this.panelChartArea.width + tolerance ||
      endY < this.panelChartArea.y - tolerance || 
      endY > this.panelChartArea.y + this.panelChartArea.height + tolerance) {
    console.log(`Panel ${this.config.dataset.name}: Calculated endpoint outside chart area`);
    return null;
  }

  return {
    // ✅ Panel-local coordinates calculated fresh from current scales
    localX: endX,
    localY: endY,
    
    // Original data values
    dataX: lastPoint.x,
    dataY: lastPoint.y,
    
    // Dataset info
    dataset: this.config.dataset,
    
    // Panel context for coordinate translation
    panelIndex: this.config.panelIndex,
    panelHeight: this.config.height,
    panelChartArea: this.panelChartArea
  };
}

/**
 * Get panel coordinate and positioning information
 * Used by PanelManager for coordinate translation
 */
getPanelCoordinateInfo() {
  const containerRect = this.panelContainer ? this.panelContainer.getBoundingClientRect() : null;
  const parentRect = this.config.container ? this.config.container.getBoundingClientRect() : null;
  
  return {
    panelIndex: this.config.panelIndex,
    panelHeight: this.config.height,
    panelChartArea: this.panelChartArea,
    
    // Panel positioning within the overall container
    panelStartY: this.config.panelIndex * this.config.height,
    panelEndY: (this.config.panelIndex + 1) * this.config.height,
    
    // Container info
    containerRect: containerRect,
    parentRect: parentRect,
    
    // Padding info
    padding: this.config.padding,
    
    // For debugging
    debug: {
      datasetName: this.config.dataset?.name || 'Unknown',
      isRendered: this.isRendered,
      chartAreaValid: !!this.panelChartArea
    }
  };
}

  /**
   * Get panel information for debugging
   */
  getInfo() {
    return {
      dataset: this.config.dataset?.name || 'Unknown',
      panelIndex: this.config.panelIndex,
      isInitialized: this.isInitialized,
      isRendered: this.isRendered,
      chartArea: this.panelChartArea,
      yDomain: this.yScale?.domain || null,
      rendererType: this.config.rendererType,
      endingLabelsState: this.getEndingLabelsState()
    };
  }
}
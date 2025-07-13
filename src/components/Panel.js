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
      height: 200,                      // Panel height in pixels
      padding: { 
        top: 10, 
        bottom: config.hasSharedXAxis ? 5 : 10,  // Reduce bottom padding when shared axis present
        left: 60, 
        right: 20 
      },
      showAxisLabels: true,
      showTitle: true,
      
      // Rendering options
      rendererType: 'canvas',           // 'canvas' or 'webgl'
      
      ...config
    };
    
    // Panel state
    this.isInitialized = false;
    this.isRendered = false;
    
    // Rendering components
    this.yScale = null;
    this.yAxis = null;
    this.panelDataRenderer = null;
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
    this.canvas = null;
    this.svgOverlay = null;
    this.panelContainer = null;
    
    this.isInitialized = false;
    this.isRendered = false;
    
    console.log(`Panel destroyed: ${this.config.dataset?.name || 'Unknown'}`);
  }
  
  /**
   * Create panel container element
   * @private
   */
  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panel';
    this.panelContainer.style.position = 'relative';
    this.panelContainer.style.width = '100%';
    this.panelContainer.style.height = `${this.config.height}px`;
    this.panelContainer.style.marginBottom = '10px';
    this.panelContainer.style.borderBottom = this.config.panelIndex < this.config.totalPanels - 1 ? '1px solid #eee' : 'none';
    
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
  
  // ✅ REMOVE PADDING: Use exact data bounds
  const yDomain = [yMin, yMax];
  
  // Determine scale type (could be passed via config)
  const scaleType = this.config.scaleType || 'linear';
  
  // Create Y scale with NO PADDING
  this.yScale = new Scale({
    type: scaleType,
    domain: yDomain,
    range: [this.panelChartArea.y + this.panelChartArea.height, this.panelChartArea.y],
    coordinateSystem: 'unified',
    orientation: 'vertical',
    options: {
      nice: false,
      padding: 0,
      clamp: true
    }
  });
  
  console.log('Panel Y scale created with NO PADDING:', yDomain);
}
  
  /**
   * Create Y axis for this panel
   * @private
   */
  _createYAxis() {
    this.yAxis = new Axis({
      orientation: 'y',
      scale: this.yScale,
      options: {
        label: this.config.dataset.name || '',
        fontSize: 11,
        color: '#666',
        showAxisLine: true,
        showTicks: true,
        showTickLabels: true
      }
    });
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
    titleElement.setAttribute('x', this.panelChartArea.x + this.panelChartArea.width + 5);
    titleElement.setAttribute('y', this.panelChartArea.y + this.panelChartArea.height / 2);
    titleElement.setAttribute('text-anchor', 'start');
    titleElement.setAttribute('dominant-baseline', 'middle');
    titleElement.style.fontSize = '12px';
    titleElement.style.fontWeight = '500';
    titleElement.style.fill = this.config.dataset.color || '#333';
    titleElement.textContent = this.config.dataset.name;
    
    this.svgOverlay.appendChild(titleElement);
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
      rendererType: this.config.rendererType
    };
  }
}
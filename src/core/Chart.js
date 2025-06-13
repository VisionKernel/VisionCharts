import Axis from '../core/Axis.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';
import Legend from '../components/Legend.js';

/**
 * Base Chart class that handles common chart functionality
 */
export default class Chart {
  /**
   * Create a new chart instance
   * @param {Object} config - Chart configuration
   * @param {string|HTMLElement} config.container - CSS selector or HTML element to render the chart
   * @param {Array} config.data - Chart data
   * @param {Object} config.options - Chart options
   */
  constructor(config) {
  console.log('Chart constructor called');
  
  // Store the configuration
  this.config = Object.assign({
    // Default configuration
    container: null,
    data: [],
    options: {}
  }, config);

  // Import themes
  let lightTheme, darkTheme;
  try {
    lightTheme = require('../themes/light.js').default;
    darkTheme = require('../themes/dark.js').default;
  } catch (e) {
    console.warn('Chart themes could not be loaded:', e);
    lightTheme = {};
    darkTheme = {};
  }

  // Determine if dark mode is active
  const isDarkMode = (
    this.config.options.theme === 'dark' || 
    (this.config.options.theme === 'auto' && darkTheme.isDarkMode?.())
  );
  
  // Select active theme
  const activeTheme = isDarkMode ? darkTheme : lightTheme;
  
  // Merge options with defaults and theme
  this.options = Object.assign({
    // Default options
    width: null,
    height: null,
    margins: { top: 50, right: 20, bottom: 70, left: 60 },
    title: '',
    xAxisName: '',
    yAxisName: '',
    isLogarithmic: false,
    isPanelView: false,
    showRecessionLines: false,
    recessions: [],
    showZeroLine: false,
    
    // Theme application
    theme: 'auto', // 'light', 'dark', or 'auto'
    
    // Apply theme colors if available
    colors: activeTheme.palette || ['#1468a8', '#34A853', '#FBBC05', '#EA4335'],
    backgroundColor: activeTheme.colors?.background || '#ffffff',
    textColor: activeTheme.colors?.text || '#333',
    axisColor: activeTheme.colors?.axis || '#666',
    gridColor: activeTheme.colors?.grid || '#eee',
    fontFamily: 'sans-serif',
    
    // Keep other options
    responsive: true,
    lineWidth: 2,
    studies: [],
    animation: {
      duration: 300,
      easing: 'ease'
    }
  }, this.config.options);

  // Store active theme for use in rendering
  this.theme = activeTheme;

    // Initialize state
    this.state = {
      container: null,
      svg: null,
      chart: null,
      scales: {},
      axes: {},
      dimensions: {
        width: 0,
        height: 0,
        innerWidth: 0,
        innerHeight: 0
      },
      rendered: false,
      datasets: [],
      processedData: [],
      components: {
        recessionLines: null,
        zeroLine: null,
        tooltip: null,
        legend: null,
        panels: []
      }
    };

    // Initialize the chart
    this.init();
  }

  /**
   * Initialize the chart
   * @private
   */
  init() {
    console.log('Chart init called');
    
    // Select the container
    this.state.container = this.getContainer();
    
    if (!this.state.container) {
      console.error('Failed to get container for chart');
      return;
    }
    
    console.log('Container obtained:', this.state.container);
    
    // Process datasets
    this.processDatasets();
    
    // Create scales, axes, etc.
    this.createScales();
    this.createAxes();
    
    // Set dimensions WITHOUT updating axes
    this.setDimensionsWithoutUpdatingAxes();
    
    // Create event listeners
    this.bindEvents();
    
    console.log('Chart init completed');
  }

  /**
   * Set dimensions without updating axes - new method that doesn't trigger axis updates
   * @private
   */
  setDimensionsWithoutUpdatingAxes() {
    console.log('setDimensionsWithoutUpdatingAxes called');
    
    if (!this.state.container) {
      console.error('Cannot update dimensions: container is null');
      return;
    }
    
    const containerRect = this.state.container.getBoundingClientRect();
    
    // Chart width and height (respecting user-defined values if provided)
    // Ensure dimensions are at least 1px to avoid SVG rendering issues
    const width = Math.max(1, this.options.width || containerRect.width || 300);
    const height = Math.max(1, this.options.height || containerRect.height || 200);
    
    // Automatically adjust margins based on chart size
    if (this.options.responsive) {
      // For smaller charts, reduce margins
      if (width < 400) {
        this.options.margins = {
          top: Math.max(10, this.options.margins.top * 0.8),
          right: Math.max(10, this.options.margins.right * 0.8),
          bottom: Math.max(30, this.options.margins.bottom), // Keep minimum bottom margin for labels
          left: Math.max(25, this.options.margins.left * 0.8)
        };
      }
    }
    
    // Inner chart area dimensions (excluding margins)
    const innerWidth = Math.max(1, width - this.options.margins.left - this.options.margins.right);
    const innerHeight = Math.max(1, height - this.options.margins.top - this.options.margins.bottom);
    
    // Update state
    this.state.dimensions = {
      width,
      height,
      innerWidth,
      innerHeight
    };
    
    // Update scales if already created
    if (Object.keys(this.state.scales).length > 0) {
      this.updateScales();
    }
    
    // DO NOT update axes here at all
    console.log('Dimensions set, scales updated, skipping axes update');
  }

  /**
   * Get the container element
   * @private
   * @returns {HTMLElement|null} The container element or null if not found
   */
  getContainer() {
    let container = null;
    
    try {
      if (typeof this.config.container === 'string') {
        container = document.querySelector(this.config.container);
        if (!container) {
          console.error(`Container selector not found: ${this.config.container}`);
          return null;
        }
      } else if (this.config.container instanceof HTMLElement) {
        container = this.config.container;
      } else {
        console.error('Container must be a CSS selector string or HTML element');
        return null;
      }
      
      // Add resize observer to track container size changes
      if (typeof ResizeObserver !== 'undefined') {
        const resizeObserver = new ResizeObserver(entries => {
          if (this.state.rendered) {
            this.updateDimensions();
            this.update();
          }
        });
        
        resizeObserver.observe(container);
        this.state.resizeObserver = resizeObserver;
      }
    } catch (error) {
      console.error('Error getting container:', error);
      return null;
    }
    
    return container;
  }
  
  // Adjust the handleResize method to properly handle aspect ratio
  handleResize() {
    console.log('handleResize called');
    
    // Always update dimensions when container size changes
    this.updateDimensions();
    
    if (this.state.rendered) {
      this.update();
    }
  }
  
  /**
   * Process datasets into a standardized format
   * @private
   */
  processDatasets() {
    console.log('processDatasets called');
    
    const data = this.config.data;
    
    // Skip if no data
    if (!data) {
      this.state.datasets = [];
      return;
    }
    
    // Handle array of objects (single dataset) vs array of datasets
    if (Array.isArray(data)) {
      if (data.length === 0) {
        this.state.datasets = [];
      } else if (data[0] && data[0].hasOwnProperty('data')) {
        // Array of datasets
        this.state.datasets = data.map((dataset, index) => ({
          id: dataset.id || `dataset-${Math.random().toString(36).substr(2, 9)}`,
          name: dataset.name || `Dataset ${index + 1}`,
          color: dataset.color || this.options.colors[index % this.options.colors.length],
          width: dataset.width || this.options.lineWidth,
          type: dataset.type || 'line',
          data: Array.isArray(dataset.data) ? dataset.data : []
        }));
      } else {
        // Array of data points (single dataset)
        this.state.datasets = [{
          id: 'dataset-1',
          name: 'Dataset',
          color: this.options.colors[0],
          width: this.options.lineWidth,
          type: 'line',
          data: data
        }];
      }
    } else {
      // Object with data property
      this.state.datasets = [{
        id: 'dataset-1',
        name: 'Dataset',
        color: this.options.colors[0],
        width: this.options.lineWidth,
        type: 'line',
        data: data.data || []
      }];
    }
    
    // Process studies if present
    if (this.options.studies && this.options.studies.length) {
      this.processStudies();
    }
    
    // Apply date filtering if needed
    this.applyDateFilter();
    
    console.log('Datasets processed:', this.state.datasets.length);
  }
  
  /**
   * Process studies/indicators
   * @private
   */
  processStudies() {
    // To be implemented by subclasses
  }
  
  /**
   * Apply date filtering to datasets
   * @private
   */
  applyDateFilter() {
    const { startDate, endDate } = this.options;
    
    // Skip if no date filtering is requested
    if (!startDate && !endDate) return;
    
    // Parse dates
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Skip if invalid dates
    if ((start && isNaN(start.getTime())) || 
        (end && isNaN(end.getTime()))) {
      console.warn('Invalid start or end date for filtering');
      return;
    }
    
    // Filter each dataset
    this.state.datasets = this.state.datasets.map(dataset => {
      // Assume 'x' field contains date, or try 'date' field
      const dateField = this.options.xField || 'x' || 'date';
      
      const filteredData = dataset.data.filter(point => {
        // Get date from point
        const pointDate = point[dateField] instanceof Date ? 
                         point[dateField] : new Date(point[dateField]);
        
        // Filter by start and end dates
        return (!start || pointDate >= start) &&
               (!end || pointDate <= end);
      });
      
      return {
        ...dataset,
        data: filteredData
      };
    });
  }

  /**
   * Create scales for the chart
   * @private
   * This should be implemented by subclasses
   */
  createScales() {
    console.log('createScales called - to be implemented by subclass');
    // To be implemented by subclasses
  }

  /**
   * Update the chart dimensions - but don't call updateAxes unless the chart is rendered
   * @private
   */
  updateDimensions() {
    console.log('updateDimensions called');
    
    this.setDimensionsWithoutUpdatingAxes();
    
    // IMPORTANT: Only update axes if the chart has already been rendered
    if (this.state.rendered && this.state.chart) {
      console.log('Chart is already rendered, safe to update axes');
      this.updateAxes();
    } else {
      console.log('Chart is not rendered yet, skipping axes update');
    }
  }

  /**
   * Create event listeners
   * @private
   */
  bindEvents() {
    console.log('bindEvents called');
    
    // Window resize event - using debounced handler to prevent excessive updates
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
    
    // Debounced resize handler
    this.resizeHandler = debounce(this.handleResize.bind(this), 250);
    window.addEventListener('resize', this.resizeHandler);
    
    console.log('Resize event handler bound');
    // Additional events to be implemented by subclasses
  }

  /**
   * Handle window resize
   * @private
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
   * Create the SVG element
   * @private
   */
  createSvg() {
    console.log('createSvg called');
    
    if (!this.state.container) {
      console.error('Cannot create SVG: container is null');
      return;
    }
    
    // Create SVG element using SvgRenderer
    const svg = SvgRenderer.createSvg(this.state.dimensions.width, this.state.dimensions.height);
    
    // Apply background color from theme
    SvgRenderer.applyStyles(svg, { background: this.options.backgroundColor });
    
    // Create chart group with transform for margins
    const chart = SvgRenderer.createGroup({
      transform: `translate(${this.options.margins.left},${this.options.margins.top})`,
      class: 'visioncharts-chart'
    });
    
    // Add chart group to SVG
    svg.appendChild(chart);
    
    // Add SVG to container
    this.state.container.appendChild(svg);
    
    // Update state
    this.state.svg = svg;
    this.state.chart = chart;
    
    console.log('SVG created and added to DOM, chart reference stored');
  }

  /**
   * Modified render method to enforce strict panel mode
   * @public
   */
  render() {
    console.log('render called with isPanelView =', this.options.isPanelView);
    
    // Clear the container
    if (!this.state.container) {
      console.error('Cannot render chart: container is null');
      return this;
    }
    
    this.state.container.innerHTML = '';
    
    // Create SVG
    this.createSvg();
    
    if (!this.state.chart) {
      console.error('Failed to create SVG chart element');
      return this;
    }
    
    console.log('About to render chart content');
    
    // Completely separate rendering modes
    if (this.options.isPanelView) {
      console.log('PANEL MODE: Rendering panel-only content');
      this.renderPanelMode();
    } else {
      console.log('SINGLE MODE: Rendering single-panel content');
      this.renderSingleMode();
    }
    
    // Common components for both modes
    this.renderLegend();
    this.renderTitle();
    this.renderAxisNames();
    
    // Update state
    this.state.rendered = true;
    
    console.log('Chart rendering completed, rendered=true');
    
    return this;
  }
  
  /**
   * Render chart in single-panel mode
   * @private
   */
  renderSingleMode() {
    console.log('renderSingleMode called');
    
    // Standard view mode
    this.renderAxes();
    this.renderData();

    // Render legend if enabled
    if (this.options.showLegend) {
      this.renderLegend();
    }
    
    // Render zero line if enabled
    if (this.options.showZeroLine) {
      this.state.components.zeroLine = new ZeroLine(this.options.zeroLineOptions || {});
      if (this.state.scales.y) {
        this.state.components.zeroLine.render(
          this.state.chart, 
          this.state.scales.y, 
          this.state.dimensions.innerWidth
        );
      }
    }
    
    // Render recession lines if enabled
    if (this.options.showRecessionLines && this.options.recessions && this.options.recessions.length) {
      this.state.components.recessionLines = new RecessionLines(this.options.recessionLinesOptions || {});
      this.state.components.recessionLines.render(
        this.state.chart, 
        this.options.recessions, 
        this.state.scales.x, 
        this.state.dimensions.innerHeight
      );
    }
    
    // Initialize hover features for single mode
    this.initSingleModeHoverFeatures();
    
    // Apply flickering fix
    this.fixCrosshairFlickering();
  }
  
  /**
   * Render chart in panel mode
   * @private
   */
  renderPanelMode() {
    console.log('renderPanelMode called');
    
    // Render ONLY panels - no single-chart components
    this.renderPanels();
    
    // Initialize hover features for panel mode
    this.initPanelModeHoverFeatures();
    
    // Apply flickering fix
    this.fixCrosshairFlickering();
  }
  
  /**
   * Render panels for multi-panel view
   * @private
   */
  renderPanels() {
    console.log('renderPanels called');
    // To be implemented by subclasses
  }

  /**
 * Render chart legend using Legend component
 */
renderLegend() {
  console.log('renderLegend called');
  
  if (!this.options.showLegend || !this.config.data.length) {
    return;
  }
  
  // Clean up existing legend
  if (this.state.components.legend) {
    this.state.components.legend.destroy();
    this.state.components.legend = null;
  }
  
  // Prepare legend items from chart data
  const legendItems = this.config.data.map(dataset => ({
    id: dataset.id,
    label: dataset.name || `Dataset ${this.config.data.indexOf(dataset) + 1}`,
    color: dataset.color || '#1468a8',
    visible: dataset.visible !== false,
    type: this.constructor.name === 'LineChart' ? 'line' : 'rect'
  }));
  
  // Calculate title height offset
  const titleHeight = this.options.title ? 35 : 0; // Title takes ~35px including spacing
  
  // Create legend with appropriate options
  const legendOptions = Object.assign({
    position: 'top', // Changed to 'top' to position under title
    align: 'center',
    orientation: 'horizontal',
    itemMargin: 25, // Increased spacing between items
    symbolSize: 12,
    fontSize: 12,
    fontFamily: 'sans-serif',
    interactive: true,
    padding: { top: 10, right: 15, bottom: 10, left: 15 }, // Better padding
    titleOffset: titleHeight // Pass title offset to legend
  }, this.options.legendOptions || {});
  
  // Create and configure legend
  this.state.components.legend = new Legend(legendOptions);
  this.state.components.legend.setItems(legendItems);
  
  // Render legend with correct dimensions
  this.state.components.legend.render(
    this.state.svg, 
    this.state.dimensions.width,  // Fixed: was totalWidth
    this.state.dimensions.height  // Fixed: was totalHeight
  );
  
  // Add event listener for legend interactions
  this.state.components.legend.element.addEventListener('legend-item-click', (event) => {
    const { id, visible } = event.detail;
    console.log(`Legend item ${id} clicked, visible: ${visible}`);
    
    // Find the dataset and update its visibility
    const dataset = this.config.data.find(d => d.id === id);
    if (dataset) {
      dataset.visible = visible;
      
      // Update the chart
      this.update();
      
      // Dispatch custom event for external listeners
      const chartEvent = new CustomEvent('dataset-visibility-changed', {
        detail: { datasetId: id, visible: visible, dataset: dataset }
      });
      this.state.container.dispatchEvent(chartEvent);
    }
  });
}

  /**
   * Update legend to reflect current chart state
   */
  updateLegend() {
    if (!this.state.components.legend || !this.options.showLegend) {
      return;
    }
    
    // Update legend items with current dataset state
    const legendItems = this.config.data.map(dataset => ({
      id: dataset.id,
      label: dataset.name || `Dataset ${this.config.data.indexOf(dataset) + 1}`,
      color: dataset.color || '#1468a8',
      visible: dataset.visible !== false,
      type: this.constructor.name === 'LineChart' ? 'line' : 'rect'
    }));
    
    // Update legend items and re-render
    this.state.components.legend.setItems(legendItems);
    this.state.components.legend.update();
  }

  /**
   * Render chart title
   * @private
   */
  renderTitle() {
    console.log('renderTitle called');
    
    if (!this.state.svg) return;
    
    if (this.options.title) {
      const title = SvgRenderer.createText(
        this.options.title,
        this.state.dimensions.width / 2,
        25,
        {
          'text-anchor': 'middle',
          'font-size': '16px',
          'font-weight': 'bold',
          'font-family': this.options.fontFamily,
          fill: this.options.textColor,
          class: 'visioncharts-title'
        }
      );
      
      this.state.svg.appendChild(title);
    }
    
    this.renderAxisNames();
  }

  /**
 * Create and configure axes using Axis component - FIXED VERSION
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
      orientation: 'bottom', // FIXED: Ensure bottom orientation
      scale: this.state.scales.x,
      tickCount: this.options.xTickCount || 5,
      tickFormat: this.options.xTickFormat,
      formatType: this.options.xType === 'time' ? 'time' : 'number', // FIXED: Proper format type
      formatOptions: this.options.xFormatOptions || {}, // FIXED: Pass format options
      label: this.options.xAxisName || '',
      grid: this.options.grid?.show || false,
      gridStyle: this.options.grid || {},
      isLogarithmic: false, // X-axis typically not logarithmic
      showTickLabels: this.options.showXLabels !== false,
      tickRotation: this.options.xTickRotation || 0,
      showAxisLabel: false // FIXED: Disable to prevent duplicate with Chart.renderAxisNames()
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
      grid: this.options.grid?.show || false,
      gridStyle: this.options.grid || {},
      isLogarithmic: this.options.isLogarithmic || false,
      showTickLabels: this.options.showYLabels !== false,
      tickRotation: this.options.yTickRotation || 0,
      showAxisLabel: false // FIXED: Disable to prevent duplicate with Chart.renderAxisNames()
    };
    
    this.state.components.axes.y = new Axis(yAxisOptions);
  }
}


/**
 * Render axes using Axis component - FIXED VERSION
 */
renderAxes() {
  console.log('renderAxes called');
  
  if (!this.state.chart) return;
  
  const { innerWidth, innerHeight } = this.state.dimensions;
  
  // Render X axis
  if (this.state.components.axes?.x) {
    this.state.components.axes.x.render(
      this.state.chart, 
      innerWidth, 
      innerHeight
    );
  }
  
  // Render Y axis
  if (this.state.components.axes?.y) {
    this.state.components.axes.y.render(
      this.state.chart, 
      innerWidth, 
      innerHeight
    );
  }
}

/**
 * Update axes with new scales or dimensions - FIXED VERSION
 */
updateAxes() {
  console.log('updateAxes called');
  
  const { innerWidth, innerHeight } = this.state.dimensions;
  
  // Update X axis
  if (this.state.components.axes?.x) {
    this.state.components.axes.x.setScale(this.state.scales.x);
    // FIXED: Update format type based on current options
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
}

/**
 * Set X axis name
 * @param {string} name - X axis name
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
}

/**
 * Set Y axis name  
 * @param {string} name - Y axis name
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
}

/**
 * Clean up axes components
 */
cleanupAxes() {
  if (this.state.components.axes?.x) {
    this.state.components.axes.x.destroy();
    this.state.components.axes.x = null;
  }
  
  if (this.state.components.axes?.y) {
    this.state.components.axes.y.destroy();
    this.state.components.axes.y = null;
  }
}
  
  /**
   * Render axis names
   * @private
   */
  renderAxisNames() {
    console.log('renderAxisNames called');
    
    if (!this.state.svg) return;
    
    const { xAxisName, yAxisName } = this.options;
    const { width, height, innerWidth, innerHeight } = this.state.dimensions;
    const { left, top } = this.options.margins;
    
    // X-axis name
    if (xAxisName) {
      const xAxisNameElement = SvgRenderer.createText(
        xAxisName,
        left + innerWidth / 2,
        height + 5,
        {
          'text-anchor': 'middle',
          'font-size': '14px',
          'font-family': this.options.fontFamily,
          fill: this.options.textColor,
          class: 'visioncharts-axis-name x-axis-name'
        }
      );
      
      this.state.svg.appendChild(xAxisNameElement);
    }
    
    // Y-axis name
    if (yAxisName) {
      const yAxisNameElement = SvgRenderer.createText(
        yAxisName,
        10,
        top + innerHeight / 2,
        {
          'text-anchor': 'middle',
          transform: `rotate(-90, 10, ${top + innerHeight / 2})`,
          'font-size': '14px',
          'font-family': this.options.fontFamily,
          fill: this.options.textColor,
          class: 'visioncharts-axis-name y-axis-name'
        }
      );
      
      this.state.svg.appendChild(yAxisNameElement);
    }
  }

  /**
   * Update the chart
   * @public
   */
  update() {
    console.log('update called with isPanelView =', this.options.isPanelView);
    
    if (!this.state.rendered) {
      console.log('Chart not rendered yet, calling render instead');
      return this.render();
    }
    
    if (!this.state.chart) {
      console.error('Cannot update chart: chart element is null');
      return this;
    }
    
    // Process datasets
    this.processDatasets();
    
    // Update scales
    this.updateScales();
    
    // Clear existing chart content completely
    if (this.state.chart) {
      this.state.chart.innerHTML = '';
    }
    
    // Clean up any existing hover components
    this.cleanupHoverFeatures();
    
    // Re-render based on current mode
    if (this.options.isPanelView) {
      console.log('UPDATE: Re-rendering in panel mode');
      this.renderPanelMode();
    } else {
      console.log('UPDATE: Re-rendering in single mode');
      this.renderSingleMode();
    }
    
    // Update common elements
    const oldLegend = this.state.svg.querySelector('.visioncharts-legend');
    if (oldLegend) {
      oldLegend.parentNode.removeChild(oldLegend);
    }
    this.renderLegend();
    
    return this;
  }

  /**
   * Update scales
   * @private
   * This should be implemented by subclasses
   */
  updateScales() {
    console.log('updateScales called - to be implemented by subclass');
    // To be implemented by subclasses
  }

  /**
   * Update axes
   * @private
   * This should be implemented by subclasses
   */
  updateAxes() {
    console.log('updateAxes called - to be implemented by subclass');
    // To be implemented by subclasses
  }

  /**
   * Update chart data
   * @private
   * This should be implemented by subclasses
   */
  updateData() {
    console.log('updateData called - to be implemented by subclass');
    // To be implemented by subclasses
  }
  
  /**
   * Update zero line
   * @private
   */
  updateZeroLine() {
    console.log('updateZeroLine called');
    
    if (!this.state.chart) return;
    
    // Remove existing zero line
    if (this.state.components.zeroLine) {
      this.state.components.zeroLine.destroy();
      this.state.components.zeroLine = null;
    }
    
    // Re-render zero line if enabled
    if (this.options.showZeroLine && this.state.scales.y) {
      this.state.components.zeroLine = new ZeroLine(this.options.zeroLineOptions || {});
      this.state.components.zeroLine.render(
        this.state.chart, 
        this.state.scales.y, 
        this.state.dimensions.innerWidth
      );
    }
  }
  
  /**
   * Update recession lines
   * @private
   */
    updateRecessionLines() {
    console.log('updateRecessionLines called');
    
    if (!this.state.chart) return;
    
    // Remove existing recession lines
    if (this.state.components.recessionLines) {
      this.state.components.recessionLines.destroy();
      this.state.components.recessionLines = null;
    }
    
    // Re-render recession lines if enabled
    if (this.options.showRecessionLines && this.options.recessions && this.options.recessions.length) {
      this.state.components.recessionLines = new RecessionLines(this.options.recessionLinesOptions || {});
      this.state.components.recessionLines.render(
        this.state.chart, 
        this.options.recessions, 
        this.state.scales.x, 
        this.state.dimensions.innerHeight
      );
    }
  }

  /**
   * Set new data
   * @public
   * @param {Array} data - New chart data
   */
  setData(data) {
    console.log('setData called');
    
    this.config.data = data;
    return this.update();
  }

  /**
   * Set new options
   * @public
   * @param {Object} options - New chart options
   */
  setOptions(options) {
    console.log('setOptions called');
    
    this.options = Object.assign(this.options, options);
    return this.update();
  }

  /**
   * Get chart data
   * @public
   * @returns {Array} Chart data
   */
  getData() {
    return this.config.data;
  }

  /**
   * Get chart options
   * @public
   * @returns {Object} Chart options
   */
  getOptions() {
    return this.options;
  }
  
  /**
   * Toggle logarithmic scale
   * @public
   * @param {boolean} isLogarithmic - Whether to use logarithmic scale
   * @returns {Chart} This chart instance
   */
  toggleLogarithmic(isLogarithmic) {
    console.log('toggleLogarithmic called:', isLogarithmic);
    
    this.options.isLogarithmic = isLogarithmic;
    
    // For logarithmic scale changes, always do a full update
    // since scales need to be recreated
    return this.update();
  }
  
  /**
   * Panel toggle that enforces strict panel mode
   * @public
   * @param {boolean} isPanelView - Whether to use panel view
   */
  togglePanelView(isPanelView) {
    console.log('togglePanelView called with value:', isPanelView);
    
    // Update option
    this.options.isPanelView = Boolean(isPanelView);
    
    // Force complete re-rendering
    if (this.state.svg && this.state.container) {
      // Remove existing SVG completely
      this.state.container.removeChild(this.state.svg);
      this.state.svg = null;
      this.state.chart = null;
    }
    
    // Re-render from scratch to enforce the correct mode
    return this.render();
  }
  
  /**
   * Toggle recession lines
   * @public
   * @param {boolean} showRecessionLines - Whether to show recession lines
   * @returns {Chart} This chart instance
   */
  toggleRecessionLines(showRecessionLines) {
    console.log('toggleRecessionLines called:', showRecessionLines);
    
    this.options.showRecessionLines = showRecessionLines;
    
    if (this.state.rendered) {
      if (this.options.isPanelView) {
        // In panel mode, we need to re-render all panels
        return this.update();
      } else {
        // In single mode, just update recession lines
        this.updateRecessionLines();
      }
    }
    
    return this;
  }
  
  /**
   * Toggle zero line
   * @public
   * @param {boolean} showZeroLine - Whether to show zero line
   * @returns {Chart} This chart instance
   */
  toggleZeroLine(showZeroLine) {
    console.log('toggleZeroLine called:', showZeroLine);
    
    this.options.showZeroLine = showZeroLine;
    
    if (this.state.rendered) {
      if (this.options.isPanelView) {
        // In panel mode, we need to re-render all panels
        return this.update();
      } else {
        // In single mode, just update zero line
        this.updateZeroLine();
      }
    }
    
    return this;
  }
  
  /**
   * Set X axis name
   * @public
   * @param {string} name - X axis name
   * @returns {Chart} This chart instance
   */
  setXAxisName(name) {
    console.log('setXAxisName called:', name);
    
    this.options.xAxisName = name;
    
    if (this.state.rendered && this.state.svg) {
      // Update axis name
      const xAxisName = this.state.svg.querySelector('.x-axis-name');
      if (xAxisName) {
        xAxisName.textContent = name;
      } else {
        this.renderAxisNames();
      }
    }
    
    return this;
  }
  
  /**
   * Set Y axis name
   * @public
   * @param {string} name - Y axis name
   * @returns {Chart} This chart instance
   */
  setYAxisName(name) {
    console.log('setYAxisName called:', name);
    
    this.options.yAxisName = name;
    
    if (this.state.rendered && this.state.svg) {
      // Update axis name
      const yAxisName = this.state.svg.querySelector('.y-axis-name');
      if (yAxisName) {
        yAxisName.textContent = name;
      } else {
        this.renderAxisNames();
      }
    }
    
    return this;
  }
  
  /**
   * Set chart title
   * @public
   * @param {string} title - Chart title
   * @returns {Chart} This chart instance
   */
  setTitle(title) {
    console.log('setTitle called:', title);
    
    this.options.title = title;
    
    if (this.state.rendered && this.state.svg) {
      // Update title
      const titleElement = this.state.svg.querySelector('.visioncharts-title');
      if (titleElement) {
        titleElement.textContent = title;
      } else {
        this.renderTitle();
      }
    }
    
    return this;
  }
  
  /**
   * Filter data by date range
   * @public
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {Chart} This chart instance
   */
  filterByDate(startDate, endDate) {
    console.log('filterByDate called:', startDate, endDate);
    
    this.options.startDate = startDate;
    this.options.endDate = endDate;
    
    return this.update();
  }
  
  /**
   * Add a dataset
   * @public
   * @param {Object} dataset - Dataset configuration
   * @returns {Chart} This chart instance
   */
  addDataset(dataset) {
    console.log('addDataset called with panel mode =', this.options.isPanelView);
    
    // Get current datasets
    const datasets = Array.isArray(this.config.data) ? this.config.data : [];
    
    // Add new dataset
    datasets.push(dataset);
    
    // Update config
    this.config.data = datasets;
    
    // First update processed datasets
    this.processDatasets();
    
    // If in panel view, we need a complete redraw
    if (this.options.isPanelView && this.state.rendered) {
      console.log('Redrawing in strict panel view mode');
      
      // Clear existing chart content completely
      if (this.state.chart) {
        this.state.chart.innerHTML = '';
      }
      
      // Update scales after adding the new dataset
      this.updateScales();
      
      // ONLY render panels - nothing else related to regular chart
      this.renderPanels();
      
      // Render common elements
      this.renderLegend();
      this.renderTitle();
      this.renderAxisNames();
      
      return this;
    }
    
    // Otherwise, normal update
    return this.update();
  }
  
  /**
   * Remove a dataset
   * @public
   * @param {string} datasetId - Dataset ID to remove
   * @returns {Chart} This chart instance
   */
  removeDataset(datasetId) {
    console.log('removeDataset called:', datasetId);
    
    // Get current datasets
    const datasets = Array.isArray(this.config.data) ? this.config.data : [];
    
    // Filter out dataset with matching ID
    const filteredDatasets = datasets.filter(d => d.id !== datasetId);
    
    // Update config
    this.config.data = filteredDatasets;
    
    // Update chart
    return this.update();
  }
  
  /**
   * Add a study/indicator
   * @public
   * @param {string} datasetId - Dataset ID to apply the study to
   * @param {Object} study - Study configuration
   * @returns {Chart} This chart instance
   */
  addStudy(datasetId, study) {
    console.log('addStudy called:', datasetId, study);
    
    // Add study to options
    this.options.studies = this.options.studies || [];
    this.options.studies.push({
      ...study,
      datasetId
    });
    
    // Update chart
    return this.update();
  }
  
  /**
   * Remove a study/indicator
   * @public
   * @param {string} datasetId - Dataset ID
   * @param {string} studyId - Study ID to remove
   * @returns {Chart} This chart instance
   */
  removeStudy(datasetId, studyId) {
    console.log('removeStudy called:', datasetId, studyId);
    
    // Remove study from options
    if (this.options.studies) {
      this.options.studies = this.options.studies.filter(
        s => !(s.datasetId === datasetId && s.id === studyId)
      );
    }
    
    // Update chart
    return this.update();
  }
  
  /**
   * Export chart as SVG string
   * @public
   * @returns {string} SVG string
   */
  exportSVG() {
    console.log('exportSVG called');
    
    if (!this.state.svg) return '';
    
    // Clone the SVG to avoid modifying the original
    const svgClone = this.state.svg.cloneNode(true);
    
    // Set explicit dimensions
    svgClone.setAttribute('width', this.state.dimensions.width);
    svgClone.setAttribute('height', this.state.dimensions.height);
    
    // Convert to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgClone);
  }
  
  /**
   * Export chart as PNG data URL
   * @public
   * @param {number} scale - Scale factor for higher resolution
   * @returns {Promise<string>} PNG data URL
   */
  exportPNG(scale = 2) {
    console.log('exportPNG called');
    
    return new Promise((resolve, reject) => {
      if (!this.state.svg) {
        reject(new Error('Chart is not rendered'));
        return;
      }
      
      // Get SVG data
      const svgData = this.exportSVG();
      const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Create image
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = this.state.dimensions.width * scale;
          canvas.height = this.state.dimensions.height * scale;
          
          // Get context and scale
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          
          // Draw image
          ctx.drawImage(img, 0, 0);
          
          // Get data URL
          const pngUrl = canvas.toDataURL('image/png');
          
          // Clean up
          URL.revokeObjectURL(svgUrl);
          
          resolve(pngUrl);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error('Error loading SVG'));
      };
      
      img.src = svgUrl;
    });
  }

  /**
   * Initialize hover functionality for single-panel mode using existing Tooltip component
   * @private
   */
  initSingleModeHoverFeatures() {
    console.log('initSingleModeHoverFeatures called');
    
    // Skip if no SVG or chart present
    if (!this.state.svg || !this.state.chart) return;
    
    // Create crosshair component
    this.state.components.crosshair = new Crosshair({
      showX: true,
      showY: false, // Only show vertical line
      stroke: '#666',
      strokeWidth: 1,
      strokeDasharray: '4,4',
      snapToData: true
    });
    
    // Create tooltip component using your existing Tooltip.js
    this.state.components.tooltip = new Tooltip({
      followCursor: true,
      offset: { x: 15, y: 10 },
      background: '#fff',
      border: '#ccc',
      borderRadius: 4,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      formatter: this.formatTooltip.bind(this)
    });
    
    // Render components
    this.state.components.crosshair.render(this.state.chart, 
      this.state.dimensions.innerWidth, 
      this.state.dimensions.innerHeight);
    
    this.state.components.tooltip.render(this.state.chart);
    
    // Hide by default
    this.state.components.crosshair.hide();
    this.state.components.tooltip.hide();
    
    // Create hover points for each dataset
    this.createSingleModeHoverPoints();
    
    // Bind mouse events for single mode
    this.bindSingleModeHoverEvents();
  }

  /**
   * Initialize hover functionality for panel mode using existing Tooltip component
   * @private
   */
  initPanelModeHoverFeatures() {
    console.log('initPanelModeHoverFeatures called');
    
    if (!this.state.chart || !this.state.panelScales) return;
    
    // Create single tooltip for all panels using your existing component
    this.state.components.tooltip = new Tooltip({
      followCursor: true,
      offset: { x: 15, y: 10 },
      background: '#fff',
      border: '#ccc',
      borderRadius: 4,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      formatter: this.formatTooltip.bind(this)
    });
    
    // Render tooltip
    this.state.components.tooltip.render(this.state.chart);
    this.state.components.tooltip.hide();
    
    // Initialize hover features for each panel
    this.state.components.panelHoverFeatures = [];
    
    this.state.panelScales.forEach((panelScale, index) => {
      const panel = this.state.chart.querySelector(`.panel-${index}`);
      if (!panel) return;
      
      // Create crosshair for this panel
      const crosshair = new Crosshair({
        showX: true,
        showY: false,
        stroke: '#666',
        strokeWidth: 1,
        strokeDasharray: '4,4'
      });
      
      // Render crosshair
      crosshair.render(panel, panelScale.panelWidth, panelScale.panelHeight);
      crosshair.hide();
      
      // Create hover points for this panel
      const hoverPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      hoverPointsGroup.setAttribute('class', 'visioncharts-panel-hover-points');
      hoverPointsGroup.style.display = 'none';
      panel.appendChild(hoverPointsGroup);
      
      // Create hover point for the dataset in this panel
      const dataset = this.state.datasets[index];
      if (dataset) {
        const hoverPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hoverPoint.setAttribute('r', 4);
        hoverPoint.setAttribute('fill', '#fff');
        hoverPoint.setAttribute('stroke', dataset.color);
        hoverPoint.setAttribute('stroke-width', 2);
        hoverPoint.setAttribute('class', 'visioncharts-panel-hover-point');
        hoverPoint.style.display = 'none';
        hoverPointsGroup.appendChild(hoverPoint);
      }
      
      // Store panel hover features
      this.state.components.panelHoverFeatures[index] = {
        crosshair: crosshair,
        hoverPointsGroup: hoverPointsGroup,
        dataset: dataset,
        panelScale: panelScale
      };
      
      // Bind events for this panel
      this.bindPanelHoverEvents(panel, index);
    });
  }

  /**
   * Bind hover events for a specific panel using existing Tooltip component
   * @private
   * @param {Element} panel - Panel element
   * @param {number} panelIndex - Panel index
   */
  bindPanelHoverEvents(panel, panelIndex) {
    const panelFeatures = this.state.components.panelHoverFeatures[panelIndex];
    if (!panelFeatures) return;
    
    const { panelScale, dataset, crosshair, hoverPointsGroup } = panelFeatures;
    const { xField, yField } = this.options;
    
    // Mouse move handler for panel
    const mouseMoveHandler = (e) => {
      const panelRect = panel.getBoundingClientRect();
      const mouseX = e.clientX - panelRect.left;
      const mouseY = e.clientY - panelRect.top;
      
      // Check if within panel bounds
      if (mouseX < 0 || mouseX > panelScale.panelWidth || 
          mouseY < 0 || mouseY > panelScale.panelHeight) {
        crosshair.hide();
        hoverPointsGroup.style.display = 'none';
        if (this.state.components.tooltip) {
          this.state.components.tooltip.hide();
        }
        return;
      }
      
      // Show crosshair
      crosshair.update(mouseX, 0);
      crosshair.show();
      
      // Find closest data point in this panel's dataset
      let closestPoint = null;
      let minDistance = Infinity;
      
      if (dataset && dataset.data) {
        dataset.data.forEach(point => {
          if (point[xField] === undefined || point[yField] === undefined) return;
          
          const pointX = panelScale.xScale.scale(point[xField]);
          const distance = Math.abs(mouseX - pointX);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        });
      }
      
      // Show hover point and tooltip if close enough
      if (closestPoint && minDistance < 50) {
        const pointX = panelScale.xScale.scale(closestPoint[xField]);
        const pointY = panelScale.yScale.scale(closestPoint[yField]);
        
        // Update hover point
        const hoverPoint = hoverPointsGroup.querySelector('.visioncharts-panel-hover-point');
        if (hoverPoint) {
          hoverPoint.setAttribute('cx', pointX);
          hoverPoint.setAttribute('cy', pointY);
          hoverPoint.style.display = 'block';
        }
        hoverPointsGroup.style.display = 'block';
        
        // Show tooltip using existing component
        const closestData = {
          dataset: dataset,
          point: closestPoint,
          x: pointX,
          y: pointY,
          distance: minDistance
        };
        
        if (this.state.components.tooltip) {
          // Calculate tooltip position relative to the main chart container
          const containerRect = this.state.container.getBoundingClientRect();
          const chartRect = this.state.chart.getBoundingClientRect();
          const tooltipX = (chartRect.left - containerRect.left) + mouseX;
          const tooltipY = (chartRect.top - containerRect.top) + mouseY + panelScale.yPos;
          
          this.state.components.tooltip.show(closestData, tooltipX, tooltipY, {
            width: this.state.dimensions.width,
            height: this.state.dimensions.height
          });
        }
      } else {
        hoverPointsGroup.style.display = 'none';
        if (this.state.components.tooltip) {
          this.state.components.tooltip.hide();
        }
      }
    };
    
    // Mouse leave handler for panel
    const mouseLeaveHandler = (e) => {
      crosshair.hide();
      hoverPointsGroup.style.display = 'none';
      if (this.state.components.tooltip) {
        this.state.components.tooltip.hide();
      }
    };
    
    // Add event listeners
    panel.addEventListener('mousemove', mouseMoveHandler);
    panel.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    this.state.eventHandlers = this.state.eventHandlers || {};
    this.state.eventHandlers[`panel-${panelIndex}`] = {
      move: mouseMoveHandler,
      leave: mouseLeaveHandler,
      panel: panel
    };
  }

  /**
   * Bind hover events for single mode using existing Tooltip component
   * @private
   */
  bindSingleModeHoverEvents() {
    // Only bind if chart is rendered
    if (!this.state.chart || !this.state.svg) return;
    
    console.log('Binding single mode hover events with existing Tooltip component');
    
    // Use SVG as the main event target for more reliable event handling
    const eventTarget = this.state.svg;
    
    // Mouse move handler - USING EXISTING TOOLTIP COMPONENT
    const mouseMoveHandler = (e) => {
      // Get mouse position relative to the SVG
      const svgRect = this.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left - this.options.margins.left; // Account for margins
      const mouseY = e.clientY - svgRect.top - this.options.margins.top;   // Account for margins
      
      // Check if within chart bounds (inner chart area)
      if (mouseX < 0 || mouseX > this.state.dimensions.innerWidth || 
          mouseY < 0 || mouseY > this.state.dimensions.innerHeight) {
        this.hideSingleModeHoverElements();
        if (this.state.components.tooltip) {
          this.state.components.tooltip.hide();
        }
        return;
      }
      
      // Always show crosshair for line charts when in bounds
      if (this.options.chartType === 'line' || this.options.chartType === 'area') {
        if (this.state.components.crosshair) {
          this.state.components.crosshair.update(mouseX, 0);
          this.state.components.crosshair.show();
        }
      }
      
      // Update hover points
      this.updateSingleModeHoverPoints(mouseX);
      
      // Show tooltip with closest data using existing Tooltip component
      const closestData = this.findClosestData(mouseX);
      if (closestData && this.state.components.tooltip) {
        // Convert back to SVG coordinates for tooltip positioning
        const tooltipX = mouseX + this.options.margins.left;
        const tooltipY = mouseY + this.options.margins.top;
        
        // Use your existing Tooltip component's show method
        this.state.components.tooltip.show(closestData, tooltipX, tooltipY, {
          width: this.state.dimensions.width,
          height: this.state.dimensions.height
        });
      } else if (this.state.components.tooltip) {
        this.state.components.tooltip.hide();
      }
    };
    
    // Mouse leave handler
    const mouseLeaveHandler = (e) => {
      // Only hide if we're actually leaving the SVG area
      const svgRect = this.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;
      
      // Check if mouse is outside SVG bounds
      if (mouseX < 0 || mouseX > this.state.dimensions.width || 
          mouseY < 0 || mouseY > this.state.dimensions.height) {
        this.hideSingleModeHoverElements();
        if (this.state.components.tooltip) {
          this.state.components.tooltip.hide();
        }
      }
    };
    
    // Add event listeners to SVG for more reliable event handling
    eventTarget.addEventListener('mousemove', mouseMoveHandler);
    eventTarget.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    this.state.eventHandlers = this.state.eventHandlers || {};
    this.state.eventHandlers.hover = {
      move: mouseMoveHandler,
      leave: mouseLeaveHandler,
      target: eventTarget // Store target for cleanup
    };
    
    console.log('Single mode hover events bound to SVG element with existing Tooltip component');
  }

  /**
   * Create hover points for single mode
   * @private
   */
  createSingleModeHoverPoints() {
    // Create a group for hover points
    this.state.components.hoverPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.state.components.hoverPointsGroup.setAttribute('class', 'visioncharts-hover-points');
    this.state.components.hoverPointsGroup.style.display = 'none';
    this.state.chart.appendChild(this.state.components.hoverPointsGroup);
    
    // Create hover points for each dataset
    this.state.components.hoverPoints = this.state.datasets.map(dataset => {
      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      point.setAttribute('r', 4); // Slightly larger than normal points
      point.setAttribute('fill', '#fff');
      point.setAttribute('stroke', dataset.color);
      point.setAttribute('stroke-width', 2);
      point.setAttribute('class', `visioncharts-hover-point-${dataset.id}`);
      point.style.display = 'none';
      
      this.state.components.hoverPointsGroup.appendChild(point);
      
      return {
        element: point,
        dataset: dataset
      };
    });
  }

  /**
   * Update hover points for single mode
   * @private
   * @param {number} mouseX - Mouse X position (relative to chart area)
   */
  updateSingleModeHoverPoints(mouseX) {
    // Skip if no hover points
    if (!this.state.components.hoverPoints) return;
    
    // Show hover points group
    if (this.state.components.hoverPointsGroup) {
      this.state.components.hoverPointsGroup.style.display = 'block';
    }
    
    // Use the correct scales
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    if (!xScale || !yScale) {
      console.warn('Scales not available for hover points');
      return;
    }
    
    // Find closest data points for each dataset
    this.state.components.hoverPoints.forEach(hoverPoint => {
      const dataset = hoverPoint.dataset;
      const { xField, yField } = this.options;
      
      // Find closest data point
      let closestPoint = null;
      let minDistance = Infinity;
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined || point[yField] === undefined) return;
        
        const xPos = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - xPos);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });
      
      // Show hover point if we found a close point
      // For line charts, be more generous with the threshold
      const proximityThreshold = (this.options.chartType === 'line' || this.options.chartType === 'area') ? 100 : 25;
      
      if (closestPoint && minDistance < proximityThreshold) {
        const x = xScale.scale(closestPoint[xField]);
        const y = yScale.scale(closestPoint[yField]);
        
        hoverPoint.element.setAttribute('cx', x);
        hoverPoint.element.setAttribute('cy', y);
        hoverPoint.element.style.display = 'block';
        
        // Store data for tooltip
        hoverPoint.data = closestPoint;
      } else {
        // Hide hover point if too far
        hoverPoint.element.style.display = 'none';
        hoverPoint.data = null;
      }
    });
  }

  /**
   * Find closest data point to mouse position
   * @private
   * @param {number} mouseX - Mouse X position
   * @returns {Object|null} Closest data point info
   */
  findClosestData(mouseX) {
    if (!this.state.datasets || !this.state.datasets.length) return null;
    
    const { xField, yField } = this.options;
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    if (!xScale || !yScale) return null;
    
    let closestData = null;
    let minDistance = Infinity;
    
    // Check all datasets
    this.state.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined || point[yField] === undefined) return;
        
        const pointX = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - pointX);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestData = {
            dataset: dataset,
            point: point,
            x: pointX,
            y: yScale.scale(point[yField]),
            distance: distance
          };
        }
      });
    });
    
    // Only return if reasonably close (within 50 pixels for line charts)
    const threshold = this.options.chartType === 'line' ? 50 : 25;
    return (closestData && minDistance < threshold) ? closestData : null;
  }

  /**
   * Format tooltip content for your existing Tooltip component
   * @private
   * @param {Object} data - Data point information
   * @returns {string} Formatted HTML content
   */
  formatTooltip(data) {
    if (!data || !data.point) return '';
    
    const { xField, yField, xType, yType } = this.options;
    const point = data.point;
    const dataset = data.dataset;
    
    // Format X value
    let xValue = point[xField];
    let xLabel = '';
    
    if (xType === 'time') {
      const date = xValue instanceof Date ? xValue : new Date(xValue);
      xLabel = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      xLabel = typeof xValue === 'number' ? xValue.toFixed(2) : xValue;
    }
    
    // Format Y value
    let yValue = point[yField];
    let yLabel = '';
    
    if (yType === 'percent') {
      yLabel = (yValue * 100).toFixed(1) + '%';
    } else if (yType === 'currency') {
      yLabel = '$' + yValue.toLocaleString(undefined, { minimumFractionDigits: 2 });
    } else {
      yLabel = typeof yValue === 'number' ? yValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : yValue;
    }
    
    // Return formatted HTML for your Tooltip component
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.4;">
        <div style="font-weight: 600; color: ${dataset.color}; margin-bottom: 4px;">
          ${dataset.name || 'Series'}
        </div>
        <div style="color: #666; margin-bottom: 2px;">
          <strong>Date:</strong> ${xLabel}
        </div>
        <div style="color: #333;">
          <strong>Value:</strong> ${yLabel}
        </div>
      </div>
    `;
  }

  /**
   * Hide hover elements for single mode
   * @private
   */
  hideSingleModeHoverElements() {
    if (this.state.components.crosshair) {
      this.state.components.crosshair.hide();
    }
    
    if (this.state.components.tooltip) {
      this.state.components.tooltip.hide();
    }
    
    if (this.state.components.hoverPointsGroup) {
      this.state.components.hoverPointsGroup.style.display = 'none';
    }
  }

  /**
   * Fix crosshair flickering by making hover elements non-interactive
   * @private
   */
  fixCrosshairFlickering() {
    console.log('Applying crosshair flickering fix');
    
    // Single mode fixes
    if (this.state.components.crosshair && this.state.components.crosshair.elements.group) {
      this.state.components.crosshair.elements.group.style.pointerEvents = 'none';
      this.state.components.crosshair.elements.group.style.userSelect = 'none';
    }
    
    // Fix existing Tooltip component
    if (this.state.components.tooltip && this.state.components.tooltip.elements) {
      // Make tooltip container non-interactive
      if (this.state.components.tooltip.elements.tooltip) {
        this.state.components.tooltip.elements.tooltip.style.pointerEvents = 'none';
        this.state.components.tooltip.elements.tooltip.style.userSelect = 'none';
      }
      
      // Also check for other tooltip elements your component might have
      Object.keys(this.state.components.tooltip.elements).forEach(key => {
        const element = this.state.components.tooltip.elements[key];
        if (element && element.style) {
          element.style.pointerEvents = 'none';
          element.style.userSelect = 'none';
        }
      });
    }
    
    if (this.state.components.hoverPointsGroup) {
      this.state.components.hoverPointsGroup.style.pointerEvents = 'none';
      this.state.components.hoverPointsGroup.style.userSelect = 'none';
    }
    
    if (this.state.components.hoverPoints) {
      this.state.components.hoverPoints.forEach(hoverPoint => {
        if (hoverPoint.element) {
          hoverPoint.element.style.pointerEvents = 'none';
          hoverPoint.element.style.userSelect = 'none';
        }
      });
    }
    
    // Panel mode fixes
    if (this.state.components.panelHoverFeatures) {
      this.state.components.panelHoverFeatures.forEach(panelFeatures => {
        if (panelFeatures.crosshair && panelFeatures.crosshair.elements.group) {
          panelFeatures.crosshair.elements.group.style.pointerEvents = 'none';
          panelFeatures.crosshair.elements.group.style.userSelect = 'none';
        }
        
        if (panelFeatures.hoverPointsGroup) {
          panelFeatures.hoverPointsGroup.style.pointerEvents = 'none';
          panelFeatures.hoverPointsGroup.style.userSelect = 'none';
        }
      });
    }
    
    console.log('Crosshair flickering fix applied');
  }

  /**
   * Clean up hover features
   * @private
   */
  cleanupHoverFeatures() {
    console.log('cleanupHoverFeatures called');
    
    // Clean up single mode hover features
    if (this.state.components.crosshair) {
      this.state.components.crosshair.destroy();
      this.state.components.crosshair = null;
    }
    
    if (this.state.components.tooltip) {
      this.state.components.tooltip.destroy();
      this.state.components.tooltip = null;
    }
    
    if (this.state.components.hoverPointsGroup) {
      if (this.state.components.hoverPointsGroup.parentNode) {
        this.state.components.hoverPointsGroup.parentNode.removeChild(this.state.components.hoverPointsGroup);
      }
      this.state.components.hoverPointsGroup = null;
    }

    if (this.state.components.recessionLines) {
      this.state.components.recessionLines.destroy();
      this.state.components.recessionLines = null;
    }

    if (this.state.components.zeroLine) {
      this.state.components.zeroLine.destroy();
      this.state.components.zeroLine = null;
    }
    
    // Clean up panel mode hover features
    if (this.state.components.panelHoverFeatures) {
      this.state.components.panelHoverFeatures.forEach(panelFeatures => {
        if (panelFeatures.crosshair) {
          panelFeatures.crosshair.destroy();
        }
        if (panelFeatures.tooltip) {
          panelFeatures.tooltip.destroy();
        }
      });
      this.state.components.panelHoverFeatures = null;
    }
    
    // Clean up event handlers
    if (this.state.eventHandlers) {
      Object.keys(this.state.eventHandlers).forEach(key => {
        const handler = this.state.eventHandlers[key];
        
        if (key.startsWith('panel-')) {
          const panelIndex = key.split('-')[1];
          const panel = this.state.chart && this.state.chart.querySelector(`.panel-${panelIndex}`);
          if (panel && handler) {
            if (handler.move) panel.removeEventListener('mousemove', handler.move);
            if (handler.leave) panel.removeEventListener('mouseleave', handler.leave);
          }
        } else if (key === 'hover' && handler) {
          // Clean up single mode hover events
          const target = handler.target || this.state.svg;
          if (target && handler.move) {
            target.removeEventListener('mousemove', handler.move);
          }
          if (target && handler.leave) {
            target.removeEventListener('mouseleave', handler.leave);
          }
        }
      });
      
      this.state.eventHandlers = {};
    }
    
    console.log('Hover features cleaned up');
  }
  
  /**
   * Get chart configuration for saving
   * @public
   * @returns {Object} Serialized chart configuration
   */
  serialize() {
    console.log('serialize called');
    
    // Create a clean object with configuration for saving
    return {
      id: this.options.id || 'chart',
      title: this.options.title || 'Chart',
      chartType: this.options.chartType || 'line',
      chartLibrary: 'VisionCharts',
      isLogarithmic: this.options.isLogarithmic || false,
      isPanelView: this.options.isPanelView || false,
      showRecessionLines: this.options.showRecessionLines || false,
      showZeroLine: this.options.showZeroLine || false,
      xAxisName: this.options.xAxisName || '',
      yAxisName: this.options.yAxisName || '',
      studies: this.options.studies || [],
      // Store datasets without the data array to save space
      datasets: this.state.datasets.map(dataset => {
        const { data, ...rest } = dataset;
        return rest;
      })
    };
  }
  
  /**
   * Load chart configuration
   * @public
   * @param {Object} config - Chart configuration
   * @returns {Chart} This chart instance
   */
  loadConfig(config) {
    console.log('loadConfig called');
    
    // Update options with loaded configuration
    Object.assign(this.options, config);
    
    // Datasets are handled separately since they typically
    // need to be reloaded with actual data
    
    // Update chart
    return this.update();
  }

 /**
 * Destroy the chart and clean up
 * @public
 */
destroy() {
  console.log('destroy called');
  
  // Remove event listeners
  window.removeEventListener('resize', this.resizeHandler);
  
  // Clean up resize observer
  if (this.state.resizeObserver) {
    this.state.resizeObserver.disconnect();
    this.state.resizeObserver = null;
  }
  
  // Clean up hover features
  this.cleanupHoverFeatures();

  // Destroy axes
  this.cleanupAxes();

  // Destroy legend
  if (this.state.components.legend) {
    this.state.components.legend.destroy();
    this.state.components.legend = null;
  }
  
  // Remove SVG
  if (this.state.svg && this.state.container) {
    if (this.state.container.contains(this.state.svg)) {
      this.state.container.removeChild(this.state.svg);
    }
  }
  
  // Reset state
  this.state.rendered = false;
  this.state.svg = null;
  this.state.chart = null;
 }
}
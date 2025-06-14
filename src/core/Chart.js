import Axis from '../core/Axis.js';
import InteractionManager from '../core/InteractionManager.js';
import ScaleManager from '../core/ScaleManager.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber, formatDateValue } from '../utils/chartUtils.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';
import { AverageLine } from '../components/AverageLine.js';
import { MedianLine } from '../components/MedianLine.js';
import Legend from '../components/Legend.js';
import Grid from '../components/Grid.js';
import Panel from '../components/Panel.js';
import { calculateIndicator } from '../utils/math.js';

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
    showAverageLine: false,
    showMedianLine: false,
    
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
        averageLine: null,
        medianLine: null,
        tooltip: null,
        legend: null,
        panels: [],
        grid: null
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
    
    // Store existing dataset settings to preserve area, areaOpacity, etc.
    const existingSettings = {};
    if (this.state.datasets) {
      this.state.datasets.forEach(dataset => {
        existingSettings[dataset.id] = {
          area: dataset.area,
          areaOpacity: dataset.areaOpacity,
          width: dataset.width,
          color: dataset.color,
          visible: dataset.visible
        };
      });
    }
    
    // Handle array of objects (single dataset) vs array of datasets
    if (Array.isArray(data)) {
      if (data.length === 0) {
        this.state.datasets = [];
      } else if (data[0] && data[0].hasOwnProperty('data')) {
        // Array of datasets
        this.state.datasets = data.map((dataset, index) => {
          const id = dataset.id || `dataset-${Math.random().toString(36).substr(2, 9)}`;
          const existing = existingSettings[id] || {};
          
          return {
            id: id,
            name: dataset.name || `Dataset ${index + 1}`,
            color: existing.color || dataset.color || this.options.colors[index % this.options.colors.length],
            width: existing.width || dataset.width || this.options.lineWidth,
            type: dataset.type || 'line',
            area: existing.area !== undefined ? existing.area : (dataset.area || false),
            areaOpacity: existing.areaOpacity !== undefined ? existing.areaOpacity : (dataset.areaOpacity || 0.2),
            visible: existing.visible !== undefined ? existing.visible : (dataset.visible !== false),
            data: Array.isArray(dataset.data) ? dataset.data : []
          };
        });
      } else {
        // Array of data points (single dataset)
        const existing = existingSettings['dataset-1'] || {};
        
        this.state.datasets = [{
          id: 'dataset-1',
          name: 'Dataset',
          color: existing.color || this.options.colors[0],
          width: existing.width || this.options.lineWidth,
          type: 'line',
          area: existing.area !== undefined ? existing.area : false,
          areaOpacity: existing.areaOpacity !== undefined ? existing.areaOpacity : 0.2,
          visible: existing.visible !== undefined ? existing.visible : true,
          data: data
        }];
      }
    } else {
      // Object with data property
      const existing = existingSettings['dataset-1'] || {};
      
      this.state.datasets = [{
        id: 'dataset-1',
        name: 'Dataset',
        color: existing.color || this.options.colors[0],
        width: existing.width || this.options.lineWidth,
        type: 'line',
        area: existing.area !== undefined ? existing.area : false,
        areaOpacity: existing.areaOpacity !== undefined ? existing.areaOpacity : 0.2,
        visible: existing.visible !== undefined ? existing.visible : true,
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
   * Process studies/indicators - FIXED VERSION
   * @private
   */
  processStudies() {
    console.log('Chart.processStudies called');
    
    const { studies } = this.options;
    
    // Skip if no studies
    if (!studies || !studies.length) {
      console.log('No studies to process');
      return;
    }
    
    // Process each study
    studies.forEach(study => {
      // Find dataset to apply the study to
      const dataset = this.state.datasets.find(d => d.id === study.datasetId);
      if (!dataset || !dataset.data || !dataset.data.length) {
        console.log('Dataset not found for study:', study.id);
        return;
      }
      
      console.log('Processing study:', study.type, 'for dataset:', dataset.id);
      
      try {
        // FIXED: Map your data structure to what the math functions expect
        const studyData = dataset.data.map(point => ({
          x: point[this.options.xField] || point.x || point.date,
          y: point[this.options.yField] || point.y || point.price || point.value,
          // Preserve original point for reference
          ...point
        }));
        
        // Use the consolidated math function with proper field mapping
        const calculatedStudy = calculateIndicator(study.type, studyData, {
          ...study.params,
          xField: 'x',
          yField: 'y'
        });
        
        // Check if we got a valid result
        if (!calculatedStudy || !calculatedStudy.length) {
          console.warn('Study calculation returned no data:', study.type);
          return;
        }
        
        // Convert back to your chart's data format
        const chartStudyData = calculatedStudy.map(point => {
          const result = {
            [this.options.xField]: point.x || point[this.options.xField],
          };
          
          // Handle different study types' output formats
          if (study.type === 'bollinger') {
            // Bollinger bands return multiple values
            result[this.options.yField] = point.middle;
            result.upper = point.upper;
            result.lower = point.lower;
          } else if (study.type === 'macd') {
            // MACD returns multiple values
            result[this.options.yField] = point.macd;
            result.signal = point.signal;
            result.histogram = point.histogram;
          } else if (study.type === 'rsi') {
            // RSI returns rsi value
            result[this.options.yField] = point.rsi;
          } else {
            // SMA, EMA return single values
            result[this.options.yField] = point[this.options.yField] || point.y;
          }
          
          return result;
        });
        
        // Add study dataset - FIXED: Don't add if already exists
        const existingStudyIndex = this.state.datasets.findIndex(d => d.id === study.id);
        const studyDataset = {
          id: study.id,
          name: study.name || `${study.type.toUpperCase()}(${study.params?.period || 14})`,
          color: study.color || '#888',
          width: study.width || 1,
          area: study.area || false,
          type: 'study',
          studyType: study.type,
          data: chartStudyData
        };
        
        if (existingStudyIndex >= 0) {
          // Update existing study
          this.state.datasets[existingStudyIndex] = studyDataset;
        } else {
          // Add new study
          this.state.datasets.push(studyDataset);
        }
        
        console.log('Study added as dataset:', study.id, 'with', chartStudyData.length, 'points');
      } catch (error) {
        console.error(`Error calculating study ${study.type}:`, error);
      }
    });
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
   * Create scales for the chart using ScaleManager
   * @private
   */
  createScales() {
    console.log('Chart.createScales called - using ScaleManager');
    
    // Use ScaleManager to create scales
    const scales = ScaleManager.createScales(this);
    
    // Store scales in state
    this.state.scales = scales;
    
    console.log('Chart scales created via ScaleManager');
  }

  /**
   * Update the chart dimensions - but don't call updateAxes unless the chart is rendered
   * @private
   */
  updateDimensions() {
    console.log('updateDimensions called');
    
    this.setDimensionsWithoutUpdatingAxes();
    
    // Update scale ranges when dimensions change
    if (this.state.scales && Object.keys(this.state.scales).length > 0) {
      ScaleManager.updateScaleRanges(this.state.scales, this.state.dimensions);
    }
    
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


    if (this.options.showAverageLine && this.averageLine) {
      const data = this.getDataForStatistics();
      const valueField = this.getValueField();
      this.averageLine.render(this, data, valueField);
    }
    
    // Render median line if enabled
    if (this.options.showMedianLine && this.medianLine) {
      const data = this.getDataForStatistics();
      const valueField = this.getValueField();
      this.medianLine.render(this, data, valueField);
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

    if (this.options.grid?.show) {
      this.state.components.grid = new Grid(this.options.grid);
      this.state.components.grid.render(
        this.state.chart,
        this.state.scales.x,
        this.state.scales.y,
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight,
        this.options
      );
    }

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
    
    // Initialize hover features using InteractionManager
    InteractionManager.initSingleMode(this);
  }
  
  /**
   * Render chart in panel mode
   * @private
   */
  renderPanelMode() {
    console.log('renderPanelMode called');
    
    // Render panels using the Panel component
    const chartSpecificRenderer = this.renderPanelData ? this.renderPanelData.bind(this) : null;
    Panel.renderForChart(this, chartSpecificRenderer);
    
    // Initialize hover features using InteractionManager
    InteractionManager.initPanelMode(this);
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

  if (this.state.components.grid && this.options.grid?.show) {
    this.state.components.grid.update(
      this.state.scales.x,
      this.state.scales.y,
      innerWidth,
      innerHeight,
      this.options
    );
  } else if (this.options.grid?.show) {
    this.state.components.grid = new Grid(this.options.grid);
    this.state.components.grid.render(
      this.state.chart,
      this.state.scales.x,
      this.state.scales.y,
      innerWidth,
      innerHeight,
      this.options
    );
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
   * Update scales using ScaleManager
   * @private
   */
  updateScales() {
    console.log('Chart.updateScales called - using ScaleManager');
    
    // Use ScaleManager to update scales
    ScaleManager.updateScales(this, this.state.scales);
    
    console.log('Chart scales updated via ScaleManager');
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
   * Toggle average line visibility
   * @param {boolean} show - Whether to show the average line
   * @param {string} datasetId - Optional: specific dataset to calculate average from
   */
  toggleAverageLine(show = null, datasetId = null) {
    if (show === null) {
      show = !this.options.showAverageLine;
    }
    
    this.options.showAverageLine = show;
    
    if (show) {
      if (!this.averageLine) {
        this.averageLine = new AverageLine(this.options.averageLineConfig || {});
      }
      
      // Get data for calculation
      const data = this.getDataForStatistics(datasetId);
      const valueField = this.getValueField();
      
      if (data && data.length > 0) {
        this.averageLine.render(this, data, valueField);
      }
    } else if (this.averageLine) {
      this.averageLine.remove();
    }
    
    return this;
  }

  /**
   * Toggle median line visibility
   * @param {boolean} show - Whether to show the median line
   * @param {string} datasetId - Optional: specific dataset to calculate median from
   */
  toggleMedianLine(show = null, datasetId = null) {
    if (show === null) {
      show = !this.options.showMedianLine;
    }
    
    this.options.showMedianLine = show;
    
    if (show) {
      if (!this.medianLine) {
        this.medianLine = new MedianLine(this.options.medianLineConfig || {});
      }
      
      // Get data for calculation
      const data = this.getDataForStatistics(datasetId);
      const valueField = this.getValueField();
      
      if (data && data.length > 0) {
        this.medianLine.render(this, data, valueField);
      }
    } else if (this.medianLine) {
      this.medianLine.remove();
    }
    
    return this;
  }

  /**
 * Get data for statistical calculations
 * @param {string} datasetId - Optional: specific dataset ID
 * @returns {Array} - Data array for calculations
 */
getDataForStatistics(datasetId = null) {
  if (!this.config.data || this.config.data.length === 0) {
    return [];
  }
  
  if (datasetId) {
    // Find specific dataset
    const dataset = this.config.data.find(d => d.id === datasetId);
    return dataset ? dataset.data : [];
  } else {
    // Use first dataset by default
    return this.config.data[0].data;
  }
}

/**
 * Get the appropriate value field name for the chart type
 * @returns {string} - Field name for values
 */
getValueField() {
  if (this.options.yField) {
    return this.options.yField;
  }
  
  // Try to detect field name from data
  if (this.config.data && this.config.data.length > 0 && this.config.data[0].data && this.config.data[0].data.length > 0) {
    const samplePoint = this.config.data[0].data[0];
    
    // Common field names in order of preference
    const possibleFields = ['price', 'value', 'y', 'amount', 'count'];
    
    for (const field of possibleFields) {
      if (samplePoint.hasOwnProperty(field) && typeof samplePoint[field] === 'number') {
        return field;
      }
    }
  }
  
  // Default fallback
  return 'y';
}

/**
 * Update statistical lines when data changes
 */
updateStatisticalLines() {
  if (this.options.showAverageLine && this.averageLine) {
    const data = this.getDataForStatistics();
    const valueField = this.getValueField();
    this.averageLine.update(this, data, valueField);
  }
  
  if (this.options.showMedianLine && this.medianLine) {
    const data = this.getDataForStatistics();
    const valueField = this.getValueField();
    this.medianLine.update(this, data, valueField);
  }
}

/**
 * Configure average line appearance
 * @param {Object} config - Configuration object
 */
configureAverageLine(config) {
  this.options.averageLineConfig = { ...this.options.averageLineConfig, ...config };
  
  if (this.averageLine) {
    this.averageLine.updateConfig(config);
    
    if (this.options.showAverageLine) {
      const data = this.getDataForStatistics();
      const valueField = this.getValueField();
      this.averageLine.update(this, data, valueField);
    }
  }
  
  return this;
}

/**
 * Configure median line appearance
 * @param {Object} config - Configuration object
 */
configureMedianLine(config) {
  this.options.medianLineConfig = { ...this.options.medianLineConfig, ...config };
  
  if (this.medianLine) {
    this.medianLine.updateConfig(config);
    
    if (this.options.showMedianLine) {
      const data = this.getDataForStatistics();
      const valueField = this.getValueField();
      this.medianLine.update(this, data, valueField);
    }
  }
  
  return this;
}

/**
 * Get statistical information about the current dataset
 * @param {string} datasetId - Optional: specific dataset ID
 * @returns {Object} - Statistical information
 */
getStatisticalInfo(datasetId = null) {
  const data = this.getDataForStatistics(datasetId);
  const valueField = this.getValueField();
  
  if (!data || data.length === 0) {
    return {
      average: null,
      median: null,
      count: 0,
      min: null,
      max: null
    };
  }
  
  // Calculate statistics
  const tempAverageLine = new AverageLine();
  const tempMedianLine = new MedianLine();
  
  const average = tempAverageLine.calculateAverage(data, valueField);
  const median = tempMedianLine.calculateMedian(data, valueField);
  const medianStats = tempMedianLine.getStatistics(data, valueField);
  
  return {
    average: average,
    median: median,
    count: medianStats.count,
    min: medianStats.min,
    max: medianStats.max,
    quartiles: medianStats.quartiles
  };
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
   * Add a study/indicator - FIXED VERSION
   * @public
   * @param {string} datasetId - Dataset ID to apply the study to
   * @param {Object} study - Study configuration
   * @returns {Chart} This chart instance
   */
  addStudy(datasetId, study) {
    console.log('addStudy called:', datasetId, study);
    
    // Initialize studies array if it doesn't exist
    this.options.studies = this.options.studies || [];
    
    // Add study to options
    const studyConfig = {
      ...study,
      datasetId: datasetId,
      id: study.id || `study-${study.type}-${Date.now()}`
    };
    
    // Remove existing study with same ID if it exists
    this.options.studies = this.options.studies.filter(s => s.id !== studyConfig.id);
    
    // Add the new study
    this.options.studies.push(studyConfig);
    
    console.log('Study added to options:', studyConfig);
    
    // Update chart
    return this.update();
  }
  
  /**
   * Remove a study/indicator - FIXED VERSION
   * @public
   * @param {string} datasetId - Dataset ID (for compatibility)
   * @param {string} studyId - Study ID to remove
   * @returns {Chart} This chart instance
   */
  removeStudy(datasetId, studyId) {
    console.log('removeStudy called:', datasetId, studyId);
    
    // Remove study from options
    if (this.options.studies) {
      const beforeCount = this.options.studies.length;
      this.options.studies = this.options.studies.filter(s => s.id !== studyId);
      const afterCount = this.options.studies.length;
      
      console.log(`Removed ${beforeCount - afterCount} studies with ID ${studyId}`);
    }
    
    // Remove study dataset from state
    if (this.state.datasets) {
      const beforeCount = this.state.datasets.length;
      this.state.datasets = this.state.datasets.filter(d => d.id !== studyId);
      const afterCount = this.state.datasets.length;
      
      console.log(`Removed ${beforeCount - afterCount} study datasets with ID ${studyId}`);
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
   * Clean up hover features using InteractionManager
   * @private
   */
  cleanupHoverFeatures() {
    console.log('cleanupHoverFeatures called');
    
    // Clean up recession lines and zero lines (not handled by InteractionManager)
    if (this.state.components.recessionLines) {
      this.state.components.recessionLines.destroy();
      this.state.components.recessionLines = null;
    }

    if (this.state.components.zeroLine) {
      this.state.components.zeroLine.destroy();
      this.state.components.zeroLine = null;
    }
    
    // Use InteractionManager for all interaction cleanup
    InteractionManager.cleanup(this);
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

  // Remove statistical lines
  if (this.averageLine) {
    this.averageLine.remove();
    this.averageLine = null;
  }
  if (this.medianLine) {
    this.medianLine.remove();
    this.medianLine = null;
  }

  // Destroy axes
  this.cleanupAxes();

  // Destroy grids
  if (this.state.components.grid) {
    this.state.components.grid.destroy();
    this.state.components.grid = null;
  }

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
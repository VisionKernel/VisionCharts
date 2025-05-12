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

    // Merge options with defaults
    
    this.options = Object.assign({
      // Default options
      width: null,
      height: null,
      // Increase top margin to 50px and bottom margin to 70px
      margins: { top: 50, right: 20, bottom: 70, left: 60 },
      title: '',
      xAxisName: '',
      yAxisName: '',
      isLogarithmic: false,
      isPanelView: false,
      showRecessionLines: false,
      recessions: [],
      showZeroLine: false,
      
      // Keep other options
      responsive: true,
      colors: ['#1468a8', '#34A853', '#FBBC05', '#EA4335'],
      lineWidth: 2,
      studies: [],
      theme: 'light',
      fontFamily: 'sans-serif',
      textColor: '#333',
      animation: {
        duration: 300,
        easing: 'ease'
      }
    }, this.config.options);

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
  
  // Modify destroy method to clean up the ResizeObserver
  destroy() {
    console.log('destroy called');
    
    // Remove event listeners
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clean up resize observer
    if (this.state.resizeObserver) {
      this.state.resizeObserver.disconnect();
      this.state.resizeObserver = null;
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
   * Create axes for the chart
   * @private
   * This should be implemented by subclasses
   */
  createAxes() {
    console.log('createAxes called - to be implemented by subclass');
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
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', this.state.dimensions.width);
    svg.setAttribute('height', this.state.dimensions.height);
    svg.setAttribute('class', 'visioncharts-svg');
    
    // Add viewport - Increase extra space for axis labels to 40px
    svg.setAttribute('viewBox', `0 0 ${this.state.dimensions.width} ${this.state.dimensions.height + 40}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    
    // Create chart group with transform for margins
    const chart = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chart.setAttribute('transform', `translate(${this.options.margins.left},${this.options.margins.top})`);
    chart.setAttribute('class', 'visioncharts-chart');
    
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
    
    // Strict panel mode enforcement
    if (this.options.isPanelView) {
      console.log('STRICTLY rendering only panel content');
      // Render ONLY panels - no other chart components
      this.renderPanels();
    } else {
      // Standard view mode
      this.renderAxes();
      this.renderData();
      
      // Render zero line if enabled
      if (this.options.showZeroLine) {
        this.renderZeroLine();
      }
      
      // Render recession lines if enabled
      if (this.options.showRecessionLines && this.options.recessions && this.options.recessions.length) {
        this.renderRecessionLines();
      }
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
   * Render panels for multi-panel view
   * @private
   */
  renderPanels() {
    console.log('renderPanels called');
    // To be implemented by subclasses
  }
  
  /**
   * Render zero line
   * @private
   */
  renderZeroLine() {
    console.log('renderZeroLine called');
    
    if (!this.state.chart) return;
    
    const yScale = this.state.scales.y;
    if (!yScale) return;
    
    const zeroY = yScale.scale(0);
    
    // Only render if zero is within the visible range
    if (zeroY >= 0 && zeroY <= this.state.dimensions.innerHeight) {
      const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      zeroLine.setAttribute('x1', 0);
      zeroLine.setAttribute('y1', zeroY);
      zeroLine.setAttribute('x2', this.state.dimensions.innerWidth);
      zeroLine.setAttribute('y2', zeroY);
      zeroLine.setAttribute('stroke', '#666');
      zeroLine.setAttribute('stroke-width', 1);
      zeroLine.setAttribute('stroke-dasharray', '4,4');
      zeroLine.setAttribute('class', 'visioncharts-zero-line');
      
      this.state.chart.appendChild(zeroLine);
    }
  }
  
  /**
   * Render recession lines
   * @private
   */
  renderRecessionLines() {
    console.log('renderRecessionLines called');
    
    if (!this.state.chart) return;
    
    const { recessions } = this.options;
    const { innerHeight, innerWidth } = this.state.dimensions;
    const xScale = this.state.scales.x;
    
    if (!xScale) return;
    
    // Create recession lines group
    const recessionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    recessionsGroup.setAttribute('class', 'visioncharts-recession-lines');
    
    // Process each recession period
    recessions.forEach((recession, index) => {
      // Extract dates
      const startDate = recession.start instanceof Date ? 
                      recession.start : new Date(recession.start);
      const endDate = recession.end instanceof Date ? 
                      recession.end : (recession.end ? new Date(recession.end) : new Date());
      
      // Validate dates
      if (!startDate || isNaN(startDate.getTime())) {
        console.warn('Invalid recession start date:', recession.start);
        return;
      }
      
      if (!endDate || isNaN(endDate.getTime())) {
        console.warn('Invalid recession end date:', recession.end);
        return;
      }
      
      try {
        // Get x coordinates using the scale
        const startX = xScale.scale(startDate);
        const endX = xScale.scale(endDate);
        
        // Create recession area
        const recessionArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        recessionArea.setAttribute('x', startX);
        recessionArea.setAttribute('y', 0);
        recessionArea.setAttribute('width', endX - startX);
        recessionArea.setAttribute('height', innerHeight);
        recessionArea.setAttribute('fill', 'rgba(235, 54, 54, 0.15)');
        recessionArea.setAttribute('stroke', 'rgba(235, 54, 54, 0.3)');
        recessionArea.setAttribute('stroke-width', 1);
        recessionArea.setAttribute('class', `visioncharts-recession-area recession-${index}`);
        
        // Add to group
        recessionsGroup.appendChild(recessionArea);
        
        // Add label if there's enough space
        if (endX - startX > 30) {
          const labelText = `${startDate.getFullYear()}${endDate ? '-' + endDate.getFullYear() : ''}`;
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          label.setAttribute('x', startX + (endX - startX) / 2);
          label.setAttribute('y', 15);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('font-size', '10px');
          label.setAttribute('fill', '#888');
          label.setAttribute('class', 'visioncharts-recession-label');
          
          recessionsGroup.appendChild(label);
        }
      } catch (error) {
        console.error('Error rendering recession area:', error);
      }
    });
    
    // Add to chart
    this.state.chart.appendChild(recessionsGroup);
  }

  /**
   * Render axes
   * @private
   * This should be implemented by subclasses
   */
  renderAxes() {
    console.log('renderAxes called - to be implemented by subclass');
    // To be implemented by subclasses
  }

  /**
 * Render chart legend - centered under title
 * @private
 */
  renderLegend() {
    console.log('Chart.renderLegend called');
    
    if (!this.state.svg) return;
    
    // Only render legend if we have multiple datasets
    if (this.state.datasets.length <= 1) return;
    
    // Create legend group
    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legendGroup.setAttribute('class', 'visioncharts-legend');
    
    // Calculate legend position - explicitly below title with increased spacing
    const titleHeight = 40; // Standard height for title across all charts
    const legendY = titleHeight + 5; // Increased space between title and legend
    
    // Create legend items
    const itemElements = [];
    const itemSpacing = 40; // Spacing between items
    const rowHeight = 25; // Height of each row for wrapping
    let totalWidth = 0;
    
    // First pass - create all items and calculate total width
    this.state.datasets.forEach(dataset => {
      // Create item group
      const itemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Create symbol based on dataset type
      if (dataset.type === 'line' || dataset.type === 'area') {
        // Line symbol
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', 10);
        line.setAttribute('x2', 20);
        line.setAttribute('y2', 10);
        line.setAttribute('stroke', dataset.color);
        line.setAttribute('stroke-width', 2);
        itemGroup.appendChild(line);
      } else {
        // Rectangle symbol for bar or other types
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 5);
        rect.setAttribute('width', 20);
        rect.setAttribute('height', 10);
        rect.setAttribute('fill', dataset.color);
        itemGroup.appendChild(rect);
      }
      
      // Create label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = dataset.name || 'Dataset';
      label.setAttribute('x', 25);
      label.setAttribute('y', 10);
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '14px'); // Reduced font size slightly
      label.setAttribute('font-family', this.options.fontFamily || 'sans-serif');
      label.setAttribute('fill', this.options.textColor || '#333');
      itemGroup.appendChild(label);
      
      // Calculate width more accurately
      // Add a bit more space for each character
      const labelWidth = dataset.name ? dataset.name.length * 8 : 70;
      const itemWidth = 30 + labelWidth; // symbol + text + padding
      
      itemElements.push({
        element: itemGroup,
        width: itemWidth
      });
      
      totalWidth += itemWidth + itemSpacing;
    });
    
    // Account for last spacing
    totalWidth -= itemSpacing;
    
    // Calculate if we need to wrap legends to multiple rows
    const svgWidth = this.state.dimensions.width;
    const maxWidthPerRow = svgWidth * 0.9; // Use 90% of available width
    const needsWrapping = totalWidth > maxWidthPerRow;
    
    if (needsWrapping) {
      // Wrap to multiple rows
      let currentX = 0;
      let currentY = 0;
      let rowWidth = 0;
      
      itemElements.forEach(item => {
        // Check if adding this item would exceed max width
        if (rowWidth + item.width > maxWidthPerRow && rowWidth > 0) {
          // Start new row
          currentY += rowHeight;
          currentX = 0;
          rowWidth = 0;
        }
        
        // Position item
        item.element.setAttribute('transform', `translate(${currentX}, ${currentY})`);
        legendGroup.appendChild(item.element);
        
        // Update for next item
        currentX += item.width + itemSpacing;
        rowWidth += item.width + itemSpacing;
      });
      
      // Adjust legend Y to center it vertically if multiple rows
      const totalHeight = currentY + rowHeight;
      const centerY = legendY - totalHeight / 2 + rowHeight / 2;
      
      // Position the legend below the title, centered
      legendGroup.setAttribute('transform', `translate(${(svgWidth - maxWidthPerRow) / 2}, ${legendY})`);
    } else {
      // Single row - center horizontally
      const startX = Math.max(0, (svgWidth - totalWidth) / 2);
      
      // Position items horizontally
      let currentX = 0;
      itemElements.forEach(item => {
        item.element.setAttribute('transform', `translate(${currentX}, 0)`);
        legendGroup.appendChild(item.element);
        currentX += item.width + itemSpacing;
      });
      
      // Position the legend below the title, centered
      legendGroup.setAttribute('transform', `translate(${startX}, ${legendY})`);
    }
    
    // Add to SVG
    this.state.svg.appendChild(legendGroup);
  }

  /**
   * Render chart title
   * @private
   */
  renderTitle() {
    console.log('renderTitle called');
    
    if (!this.state.svg) return;
    
    if (this.options.title) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.textContent = this.options.title;
      title.setAttribute('x', this.state.dimensions.width / 2);
      title.setAttribute('y', 25); // Increased from 15 to 25
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-size', '16px');
      title.setAttribute('font-weight', 'bold');
      title.setAttribute('font-family', this.options.fontFamily);
      title.setAttribute('fill', this.options.textColor);
      title.setAttribute('class', 'visioncharts-title');
      
      this.state.svg.appendChild(title);
    }
    
    // Render axis names if provided
    this.renderAxisNames();
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
    const { left, top, right, bottom } = this.options.margins;
    
    // X-axis name - position it lower
    if (xAxisName) {
      const xAxisNameElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xAxisNameElement.textContent = xAxisName;
      xAxisNameElement.setAttribute('x', left + innerWidth / 2);
      xAxisNameElement.setAttribute('y', height + 5); // Position it below the chart
      xAxisNameElement.setAttribute('text-anchor', 'middle');
      xAxisNameElement.setAttribute('font-size', '14px');
      xAxisNameElement.setAttribute('font-family', this.options.fontFamily);
      xAxisNameElement.setAttribute('fill', this.options.textColor);
      xAxisNameElement.setAttribute('class', 'visioncharts-axis-name x-axis-name');
      
      this.state.svg.appendChild(xAxisNameElement);
    }
    
    // Y-axis name - position it further left
    if (yAxisName) {
      const yAxisNameElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yAxisNameElement.textContent = yAxisName;
      yAxisNameElement.setAttribute('x', 10); // Move further left from 15
      yAxisNameElement.setAttribute('y', top + innerHeight / 2);
      yAxisNameElement.setAttribute('text-anchor', 'middle');
      yAxisNameElement.setAttribute('transform', `rotate(-90, 10, ${top + innerHeight / 2})`);
      yAxisNameElement.setAttribute('font-size', '14px');
      yAxisNameElement.setAttribute('font-family', this.options.fontFamily);
      yAxisNameElement.setAttribute('fill', this.options.textColor);
      yAxisNameElement.setAttribute('class', 'visioncharts-axis-name y-axis-name');
      
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
    
    // Handle panel view mode specially
    if (this.options.isPanelView) {
      // Clear existing chart content - important for panel mode
      if (this.state.chart) {
        this.state.chart.innerHTML = '';
      }
      
      // Only render panels in panel mode - no regular chart elements
      this.renderPanels();
      
      // Update common elements
      // We already have the legend and title from the initial render,
      // but we'll update them in case dataset names changed
      const oldLegend = this.state.svg.querySelector('.visioncharts-legend');
      if (oldLegend) {
        oldLegend.parentNode.removeChild(oldLegend);
      }
      this.renderLegend();
      
      return this;
    }
    
    // Standard view mode updates
    this.updateAxes();
    this.updateData();
    
    // Update zero line if enabled
    if (this.options.showZeroLine) {
      this.updateZeroLine();
    }
    
    // Update recession lines if enabled
    if (this.options.showRecessionLines) {
      this.updateRecessionLines();
    }
    
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
    const existingZeroLine = this.state.chart.querySelector('.visioncharts-zero-line');
    if (existingZeroLine) {
      existingZeroLine.parentNode.removeChild(existingZeroLine);
    }
    
    // Re-render zero line
    if (this.options.showZeroLine) {
      this.renderZeroLine();
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
    const existingRecessionLines = this.state.chart.querySelector('.visioncharts-recession-lines');
    if (existingRecessionLines) {
      existingRecessionLines.parentNode.removeChild(existingRecessionLines);
    }
    
    // Re-render recession lines if enabled
    if (this.options.showRecessionLines && this.options.recessions && this.options.recessions.length) {
      this.renderRecessionLines();
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
      this.updateRecessionLines();
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
      this.updateZeroLine();
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
 * Initialize hover functionality
 * @private
 */
initHoverFeatures() {
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
  
  // Create tooltip component
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
  this.createHoverPoints();
  
  // Bind mouse events
  this.bindHoverEvents();
}

/**
 * Create hover points for each dataset
 * @private
 */
createHoverPoints() {
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
 * Bind hover events
 * @private
 */
bindHoverEvents() {
  // Only bind if chart is rendered
  if (!this.state.chart) return;
  
  const chartRect = this.state.chart.getBoundingClientRect();
  
  // Mouse move handler
  const mouseMoveHandler = (e) => {
    // Get mouse position relative to chart
    const rect = this.state.chart.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if within chart bounds
    if (x < 0 || x > this.state.dimensions.innerWidth || 
        y < 0 || y > this.state.dimensions.innerHeight) {
      this.hideHoverElements();
      return;
    }
    
    // Show crosshair
    this.state.components.crosshair.update(x, 0);
    this.state.components.crosshair.show();
    
    // Update hover points
    this.updateHoverPoints(x);
    
    // Show tooltip with closest data
    const closestData = this.findClosestData(x);
    if (closestData) {
      this.state.components.tooltip.show(closestData, x, y, {
        width: this.state.dimensions.innerWidth,
        height: this.state.dimensions.innerHeight
      });
    }
  };
  
  // Mouse leave handler
  const mouseLeaveHandler = () => {
    this.hideHoverElements();
  };
  
  // Add event listeners
  this.state.chart.addEventListener('mousemove', mouseMoveHandler);
  this.state.chart.addEventListener('mouseleave', mouseLeaveHandler);
  
  // Store handlers for cleanup
  this.state.eventHandlers = this.state.eventHandlers || {};
  this.state.eventHandlers.hover = {
    move: mouseMoveHandler,
    leave: mouseLeaveHandler
  };
}

/**
 * Hide hover elements
 * @private
 */
hideHoverElements() {
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
 * Update hover points
 * @private
 * @param {number} mouseX - Mouse X position
 */
updateHoverPoints(mouseX) {
  // Skip if no hover points
  if (!this.state.components.hoverPoints) return;
  
  // Show hover points group
  if (this.state.components.hoverPointsGroup) {
    this.state.components.hoverPointsGroup.style.display = 'block';
  }
  
  // Convert mouse position to domain value
  const xValue = this.state.scales.x.invert(mouseX);
  
  // Find closest data points for each dataset
  this.state.components.hoverPoints.forEach(hoverPoint => {
    const dataset = hoverPoint.dataset;
    const { xField, yField } = this.options;
    
    // Find closest data point
    let closestPoint = null;
    let minDistance = Infinity;
    
    dataset.data.forEach(point => {
      if (point[xField] === undefined || point[yField] === undefined) return;
      
      const xVal = point[xField] instanceof Date ? 
                  point[xField].getTime() : point[xField];
      const xPos = this.state.scales.x.scale(point[xField]);
      
      const distance = Math.abs(mouseX - xPos);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });
    
    // Update hover point position
    if (closestPoint && minDistance < 50) { // Only show if reasonably close
      const x = this.state.scales.x.scale(closestPoint[xField]);
      const y = this.state.scales.y.scale(closestPoint[yField]);
      
      hoverPoint.element.setAttribute('cx', x);
      hoverPoint.element.setAttribute('cy', y);
      hoverPoint.element.style.display = 'block';
      
      // Store data for tooltip
      hoverPoint.data = closestPoint;
    } else {
      // Hide if no close point
      hoverPoint.element.style.display = 'none';
      hoverPoint.data = null;
    }
  });
}

/**
 * Find closest data to mouse position
 * @private
 * @param {number} mouseX - Mouse X position
 * @returns {Object} Closest data points
 */
findClosestData(mouseX) {
  // Skip if no hover points
  if (!this.state.components.hoverPoints) return null;
  
  // Get visible hover points with data
  const visiblePoints = this.state.components.hoverPoints
    .filter(hp => hp.element.style.display !== 'none' && hp.data)
    .map(hp => ({
      dataset: hp.dataset,
      data: hp.data
    }));
  
  if (!visiblePoints.length) return null;
  
  // Find x value (date or number)
  const xValue = visiblePoints[0].data[this.options.xField];
  
  // Format x value
  let xText;
  if (xValue instanceof Date) {
    xText = xValue.toLocaleDateString();
  } else {
    xText = String(xValue);
  }
  
  // Return data for tooltip
  return {
    x: xText,
    points: visiblePoints
  };
}

/**
 * Format tooltip content
 * @private
 * @param {Object} data - Tooltip data
 * @returns {string} Formatted tooltip content
 */
formatTooltip(data) {
  if (!data || !data.points || !data.points.length) return '';
  
  const { yField } = this.options;
  const lines = [];
  
  // Add header (X value)
  lines.push(`<tspan font-weight="bold">${data.x}</tspan>`);
  
  // Add data points
  data.points.forEach(point => {
    const value = point.data[yField];
    let formattedValue;
    
    // Format value based on type
    if (this.options.yType === 'currency') {
      formattedValue = '$' + value.toFixed(2);
    } else if (this.options.yType === 'percent') {
      formattedValue = (value * 100).toFixed(2) + '%';
    } else {
      formattedValue = value.toFixed(2);
    }
    
    // Create line with color indicator
    const line = `<tspan x="10" dy="18">
      <tspan fill="${point.dataset.color}">●</tspan> 
      <tspan font-weight="bold">${point.dataset.name}:</tspan> 
      ${formattedValue}
    </tspan>`;
    
    lines.push(line);
  });
  
  return lines;
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
  
  // Remove hover event listeners
  if (this.state.eventHandlers && this.state.eventHandlers.hover) {
    if (this.state.chart) {
      this.state.chart.removeEventListener('mousemove', this.state.eventHandlers.hover.move);
      this.state.chart.removeEventListener('mouseleave', this.state.eventHandlers.hover.leave);
    }
  }
  
  // Destroy components
  if (this.state.components.crosshair) {
    this.state.components.crosshair.destroy();
  }
  
  if (this.state.components.tooltip) {
    this.state.components.tooltip.destroy();
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


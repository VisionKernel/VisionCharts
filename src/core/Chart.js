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
        margins: { top: 20, right: 20, bottom: 30, left: 40 },
        title: '',
        theme: 'light',
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
        rendered: false
      };
  
      // Initialize the chart
      this.init();
    }
  
    /**
     * Initialize the chart
     * @private
     */
    init() {
      // Select the container
      this.state.container = this.getContainer();
      
      // Create scales, axes, etc.
      this.createScales();
      this.createAxes();
      
      // Set dimensions
      this.updateDimensions();
      
      // Create event listeners
      this.bindEvents();
    }
  
    /**
     * Get the container element
     * @private
     * @returns {HTMLElement} The container element
     */
    getContainer() {
      let container;
      
      if (typeof this.config.container === 'string') {
        container = document.querySelector(this.config.container);
      } else if (this.config.container instanceof HTMLElement) {
        container = this.config.container;
      } else {
        throw new Error('Container must be a CSS selector string or HTML element');
      }
      
      if (!container) {
        throw new Error(`Container not found: ${this.config.container}`);
      }
      
      return container;
    }
  
    /**
     * Create scales for the chart
     * @private
     * This should be implemented by subclasses
     */
    createScales() {
      // To be implemented by subclasses
    }
  
    /**
     * Create axes for the chart
     * @private
     * This should be implemented by subclasses
     */
    createAxes() {
      // To be implemented by subclasses
    }
  
    /**
     * Update the chart dimensions
     * @private
     */
    updateDimensions() {
      const containerRect = this.state.container.getBoundingClientRect();
      
      // Chart width and height (respecting user-defined values if provided)
      const width = this.options.width || containerRect.width;
      const height = this.options.height || containerRect.height;
      
      // Inner chart area dimensions (excluding margins)
      const innerWidth = width - this.options.margins.left - this.options.margins.right;
      const innerHeight = height - this.options.margins.top - this.options.margins.bottom;
      
      // Update state
      this.state.dimensions = {
        width,
        height,
        innerWidth,
        innerHeight
      };
    }
  
    /**
     * Create event listeners
     * @private
     */
    bindEvents() {
      // Window resize event
      window.addEventListener('resize', this.handleResize.bind(this));
      
      // Additional events to be implemented by subclasses
    }
  
    /**
     * Handle window resize
     * @private
     */
    handleResize() {
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
      // Create SVG element
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', this.state.dimensions.width);
      svg.setAttribute('height', this.state.dimensions.height);
      svg.setAttribute('class', 'visioncharts-svg');
      
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
    }
  
    /**
     * Render the chart
     * @public
     */
    render() {
      // Clear the container
      this.state.container.innerHTML = '';
      
      // Create SVG
      this.createSvg();
      
      // Render components
      this.renderAxes();
      this.renderData();
      this.renderLegend();
      this.renderTitle();
      
      // Update state
      this.state.rendered = true;
      
      return this;
    }
  
    /**
     * Render axes
     * @private
     * This should be implemented by subclasses
     */
    renderAxes() {
      // To be implemented by subclasses
    }
  
    /**
     * Render chart data
     * @private
     * This should be implemented by subclasses
     */
    renderData() {
      // To be implemented by subclasses
    }
  
    /**
     * Render chart legend
     * @private
     */
    renderLegend() {
      // To be implemented by subclasses
    }
  
    /**
     * Render chart title
     * @private
     */
    renderTitle() {
      if (this.options.title) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.textContent = this.options.title;
        title.setAttribute('x', this.state.dimensions.width / 2);
        title.setAttribute('y', 15);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('class', 'visioncharts-title');
        
        this.state.svg.appendChild(title);
      }
    }
  
    /**
     * Update the chart
     * @public
     */
    update() {
      if (!this.state.rendered) {
        return this.render();
      }
      
      // Update scales
      this.updateScales();
      
      // Update components
      this.updateAxes();
      this.updateData();
      
      return this;
    }
  
    /**
     * Update scales
     * @private
     * This should be implemented by subclasses
     */
    updateScales() {
      // To be implemented by subclasses
    }
  
    /**
     * Update axes
     * @private
     * This should be implemented by subclasses
     */
    updateAxes() {
      // To be implemented by subclasses
    }
  
    /**
     * Update chart data
     * @private
     * This should be implemented by subclasses
     */
    updateData() {
      // To be implemented by subclasses
    }
  
    /**
     * Set new data
     * @public
     * @param {Array} data - New chart data
     */
    setData(data) {
      this.config.data = data;
      return this.update();
    }
  
    /**
     * Set new options
     * @public
     * @param {Object} options - New chart options
     */
    setOptions(options) {
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
     * Destroy the chart and clean up
     * @public
     */
    destroy() {
      // Remove event listeners
      window.removeEventListener('resize', this.handleResize.bind(this));
      
      // Remove SVG
      if (this.state.svg && this.state.container.contains(this.state.svg)) {
        this.state.container.removeChild(this.state.svg);
      }
      
      // Reset state
      this.state.rendered = false;
      this.state.svg = null;
      this.state.chart = null;
    }
  }
import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * BarChart class for rendering trading volume data
 */
export default class BarChart extends Chart {
  /**
   * Create a new bar chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor
    super(config);
    
    // Merge options with specific defaults for bar charts
    this.options = Object.assign({
      dateField: 'date',
      volumeField: 'volume',
      priceField: 'close',
      xType: 'time',
      xFormat: '',
      yFormat: { notation: 'compact' },
      xAxisLabel: 'Date',
      yAxisLabel: 'Volume',
      barWidth: 0.8, // Width of bar as percentage of available space
      colors: {
        up: '#34A853', // Green for up bars
        down: '#EA4335', // Red for down bars
        neutral: '#4285F4' // Blue for neutral bars
      },
      grid: true,
      tooltip: true,
      animation: {
        enabled: true,
        duration: 300
      }
    }, this.options);
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    // Create X scale (time)
    this.state.scales.x = new TimeScale([0, 1], [0, 1]);
    
    // Create Y scale (volume)
    this.state.scales.y = new LinearScale([0, 1], [0, 1]);
    
    // Update scales with actual data
    this.updateScales();
  }
  
  /**
   * Create axes for the chart
   * @private
   */
  createAxes() {
    // Create X axis
    this.state.axes.x = new Axis({
      orientation: 'bottom',
      scale: this.state.scales.x,
      formatType: this.options.xType,
      formatOptions: this.options.xFormat,
      label: this.options.xAxisLabel,
      grid: this.options.grid
    });
    
    // Create Y axis
    this.state.axes.y = new Axis({
      orientation: 'left',
      scale: this.state.scales.y,
      formatType: 'number',
      formatOptions: this.options.yFormat,
      label: this.options.yAxisLabel,
      grid: this.options.grid
    });
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    const { dateField, volumeField } = this.options;
    const data = this.config.data;
    
    if (!data || !data.length) return;
    
    // Extract values
    const dates = data.map(d => d[dateField]);
    const volumes = data.map(d => d[volumeField] || 0);
    
    // Calculate domains
    const xMin = new Date(Math.min(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    const xMax = new Date(Math.max(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    const yMax = Math.max(...volumes);
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([0, yMax * 1.05]); // Add a bit of padding at the top
    
    // Set ranges
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
  }
  
  /**
   * Render the chart - explicitly override the parent method
   * @public
   */
  render() {
    // Clear the container
    this.state.container.innerHTML = '';
    
    // Create SVG
    this.createSvg();
    
    // Update scales to ensure proper initialization
    this.updateScales();
    
    // Render components
    this.renderAxes();
    this.renderData();
    this.renderLegend();
    this.renderTitle();
    
    // Render tooltip if enabled
    if (this.options.tooltip) {
      this.renderTooltip();
    }
    
    // Update state
    this.state.rendered = true;
    
    return this;
  }

  /**
   * Render axes
   * @private
   */
  renderAxes() {
    if (!this.state.chart) return;
    
    // Render X axis
    this.state.axes.x.render(
      this.state.chart,
      this.state.dimensions.innerWidth,
      this.state.dimensions.innerHeight
    );
    
    // Render Y axis
    this.state.axes.y.render(
      this.state.chart,
      this.state.dimensions.innerWidth,
      this.state.dimensions.innerHeight
    );
  }

  /**
   * Render chart data
   * @private
   */
  renderData() {
    if (!this.state.chart) return;
    
    const {
      dateField,
      volumeField,
      priceField,
      colors,
      barWidth
    } = this.options;
    
    const data = this.config.data;
    if (!data || !data.length) return;
    
    // Create data group
    const barGroup = SvgRenderer.createGroup({
      class: 'visioncharts-bar-chart-bars'
    });
    
    // Calculate bar width
    const availableWidth = this.state.dimensions.innerWidth / data.length;
    const actualBarWidth = availableWidth * barWidth;
    
    // Track previous price to determine direction
    let prevPrice = null;
    
    // Render each bar
    data.forEach((d, i) => {
      const date = d[dateField];
      const volume = d[volumeField] || 0;
      const price = d[priceField];
      
      // Get direction
      let direction = 'neutral';
      
      if (price !== undefined && prevPrice !== null) {
        direction = price > prevPrice ? 'up' : (price < prevPrice ? 'down' : 'neutral');
      }
      
      prevPrice = price;
      
      // Get bar color
      const barColor = colors[direction];
      
      // Get scaled coordinates
      const x = this.state.scales.x.scale(date);
      const y = this.state.scales.y.scale(volume);
      const height = this.state.dimensions.innerHeight - y;
      
      // Create bar
      const barRect = SvgRenderer.createRect(
        x - actualBarWidth / 2,
        y,
        actualBarWidth,
        Math.max(1, height), // Ensure at least 1px height for visibility
        {
          class: `visioncharts-bar-chart-bar ${direction}`,
          fill: barColor,
          stroke: 'none',
          'data-index': i,
          'data-date': date,
          'data-volume': volume
        }
      );
      
      // Add to bar group
      barGroup.appendChild(barRect);
    });
    
    // Add data group to chart
    this.state.chart.appendChild(barGroup);
  }
  
  /**
   * Render tooltip
   * @private
   */
  renderTooltip() {
    if (!this.options.tooltip || !this.state.svg) return;
    
    const {
      dateField,
      volumeField,
      priceField,
      xType,
      xFormat
    } = this.options;
    
    // Create tooltip elements
    const tooltipGroup = SvgRenderer.createGroup({
      class: 'visioncharts-tooltip',
      opacity: 0
    });
    
    // Create tooltip background
    const tooltipBg = SvgRenderer.createRect(0, 0, 0, 0, {
      class: 'visioncharts-tooltip-bg',
      rx: 4,
      ry: 4,
      fill: '#fff',
      stroke: '#ccc',
      'stroke-width': 1
    });
    
    // Create tooltip text
    const tooltipText = SvgRenderer.createText('', 0, 0, {
      class: 'visioncharts-tooltip-text',
      'font-size': '12px',
      'font-family': 'sans-serif'
    });
    
    // Create vertical crosshair
    const crosshairX = SvgRenderer.createLine(0, 0, 0, this.state.dimensions.innerHeight, {
      class: 'visioncharts-crosshair-x',
      stroke: '#999',
      'stroke-width': 1,
      'stroke-dasharray': '4,4',
      opacity: 0
    });
    
    // Add elements to group
    tooltipGroup.appendChild(tooltipBg);
    tooltipGroup.appendChild(tooltipText);
    
    // Add crosshair to chart
    this.state.chart.appendChild(crosshairX);
    
    // Add tooltip group to chart (outside of inner chart area)
    this.state.svg.appendChild(tooltipGroup);
    
    // Create event listener area
    const eventRect = SvgRenderer.createRect(
      0,
      0,
      this.state.dimensions.innerWidth,
      this.state.dimensions.innerHeight,
      {
        class: 'visioncharts-event-rect',
        fill: 'transparent',
        'pointer-events': 'all'
      }
    );
    
    // Add event listeners
    eventRect.addEventListener('mousemove', e => {
      // Get mouse position relative to chart
      const rect = this.state.svg.getBoundingClientRect();
      const x = e.clientX - rect.left - this.options.margins.left;
      
      // Find closest data point
      const xScale = this.state.scales.x;
      
      // Convert mouse position back to data domain
      const xValue = xScale.invert(x);
      
      // Find closest data point
      let closestPoint = null;
      let minDistance = Infinity;
      let closestIndex = -1;
      
      this.config.data.forEach((d, i) => {
        const date = d[dateField];
        const distance = Math.abs(date - xValue);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = d;
          closestIndex = i;
        }
      });
      
      if (!closestPoint) return;
      
      // Get point coordinates
      const pointX = xScale.scale(closestPoint[dateField]);
      
      // Update crosshair
      crosshairX.setAttribute('x1', pointX);
      crosshairX.setAttribute('x2', pointX);
      crosshairX.setAttribute('opacity', 1);
      
      // Format values
      const dateFormatted = SvgRenderer.formatTickValue(
        closestPoint[dateField],
        xType,
        xFormat
      );
      
      const volumeFormatted = SvgRenderer.formatTickValue(
        closestPoint[volumeField] || 0,
        'number',
        { notation: 'compact' }
      );
      
      // Update tooltip text
      tooltipText.textContent = '';
      
      const dateSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      dateSpan.textContent = dateFormatted;
      dateSpan.setAttribute('x', 8);
      dateSpan.setAttribute('dy', 16);
      tooltipText.appendChild(dateSpan);
      
      const volumeSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      volumeSpan.textContent = `Volume: ${volumeFormatted}`;
      volumeSpan.setAttribute('x', 8);
      volumeSpan.setAttribute('dy', 16);
      tooltipText.appendChild(volumeSpan);
      
      // Add price if available
      if (closestPoint[priceField] !== undefined) {
        const priceFormatted = SvgRenderer.formatTickValue(
          closestPoint[priceField],
          'number',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        );
        
        const priceSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        priceSpan.textContent = `Price: ${priceFormatted}`;
        priceSpan.setAttribute('x', 8);
        priceSpan.setAttribute('dy', 16);
        tooltipText.appendChild(priceSpan);
      }
      
      // Get tooltip dimensions
      const tooltipBox = tooltipText.getBBox();
      const tooltipWidth = tooltipBox.width + 16;
      const tooltipHeight = tooltipBox.height + 8;
      
      // Position tooltip to avoid going off chart
      let tooltipX = pointX + 8;
      
      // Adjust if it would go off the right edge
      if (tooltipX + tooltipWidth > this.state.dimensions.innerWidth) {
        tooltipX = pointX - tooltipWidth - 8;
      }
      
      // Update tooltip position and dimensions
      tooltipGroup.setAttribute('transform', `translate(${tooltipX + this.options.margins.left},${this.options.margins.top})`);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', tooltipHeight);
      
      // Show tooltip
      tooltipGroup.setAttribute('opacity', 1);
      
      // Highlight active bar
      const allBars = this.state.chart.querySelectorAll('.visioncharts-bar-chart-bar');
      allBars.forEach(bar => {
        bar.setAttribute('opacity', 0.5);
      });
      
      const activeBar = this.state.chart.querySelector(`.visioncharts-bar-chart-bar[data-index="${closestIndex}"]`);
      if (activeBar) {
        activeBar.setAttribute('opacity', 1);
      }
    });
    
    eventRect.addEventListener('mouseleave', () => {
      // Hide tooltip and crosshair
      tooltipGroup.setAttribute('opacity', 0);
      crosshairX.setAttribute('opacity', 0);
      
      // Reset bar highlights
      const allBars = this.state.chart.querySelectorAll('.visioncharts-bar-chart-bar');
      allBars.forEach(bar => {
        bar.setAttribute('opacity', 1);
      });
    });
    
    // Add event rect to chart
    this.state.chart.appendChild(eventRect);
  }
  
  /**
   * Update chart data - improved with proper cleanup
   * @private
   */
  updateData() {
    // Remove existing bars
    const existingBars = this.state.chart.querySelector('.visioncharts-bar-chart-bars');
    if (existingBars && existingBars.parentNode) {
      existingBars.parentNode.removeChild(existingBars);
    }
    
    // Re-render data
    this.renderData();
  }
}
import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * CandlestickChart class for rendering OHLC price data
 */
export default class CandlestickChart extends Chart {
  /**
   * Create a new candlestick chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor
    super(config);
    
    // Merge options with specific defaults for candlestick charts
    this.options = Object.assign({
      dateField: 'date',
      openField: 'open',
      highField: 'high',
      lowField: 'low',
      closeField: 'close',
      volumeField: 'volume',
      xType: 'time',
      yType: 'number',
      xFormat: '',
      yFormat: { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 2
      },
      xAxisLabel: 'Date',
      yAxisLabel: 'Price',
      colors: {
        up: '#34A853', // Green for up candles
        down: '#EA4335', // Red for down candles
        wick: '#333333'  // Dark gray for wicks
      },
      candleWidth: 0.6, // Width of candle as percentage of available space
      grid: true,
      tooltip: true,
      showVolume: false, // Whether to show volume bars at the bottom
      volumeHeight: 0.2, // Height of volume section as percentage of chart
      animation: {
        enabled: true,
        duration: 300
      }
    }, this.options);
    
    // Extend state with candlestick-specific properties
    this.state = Object.assign(this.state, {
      volumeArea: null,
      priceArea: null
    });
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    // Create X scale (time)
    this.state.scales.x = new TimeScale([0, 1], [0, 1]);
    
    // Create Y scale (price)
    this.state.scales.y = new LinearScale([0, 1], [0, 1]);
    
    // Create volume scale if needed
    if (this.options.showVolume) {
      this.state.scales.volume = new LinearScale([0, 1], [0, 1]);
    }
    
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
      formatType: this.options.yType,
      formatOptions: this.options.yFormat,
      label: this.options.yAxisLabel,
      grid: this.options.grid
    });
    
    // Create volume axis if needed
    if (this.options.showVolume) {
      this.state.axes.volume = new Axis({
        orientation: 'right',
        scale: this.state.scales.volume,
        formatType: 'number',
        formatOptions: { 
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: 'compact'
        },
        grid: false
      });
    }
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    const {
      dateField,
      openField,
      highField,
      lowField,
      closeField,
      volumeField,
      showVolume
    } = this.options;
    
    const data = this.config.data;
    
    if (!data || !data.length) return;
    
    // Extract values
    const dates = data.map(d => d[dateField]);
    const highs = data.map(d => d[highField]);
    const lows = data.map(d => d[lowField]);
    
    // Calculate domains
    const xMin = new Date(Math.min(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    const xMax = new Date(Math.max(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    const yMin = Math.min(...lows);
    const yMax = Math.max(...highs);
    
    // Add some padding to Y domain
    const yPadding = (yMax - yMin) * 0.05;
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([yMin - yPadding, yMax + yPadding]);
    
    // Handle volume scale if needed
    if (showVolume && volumeField) {
      const volumes = data.map(d => d[volumeField]);
      const volumeMax = Math.max(...volumes);
      
      this.state.scales.volume.setDomain([0, volumeMax * 1.05]);
    }
    
    // Set ranges
    this.updateScaleRanges();
  }
  
  /**
   * Update scale ranges based on current dimensions
   * @private
   */
  updateScaleRanges() {
    const { showVolume, volumeHeight } = this.options;
    const { dimensions } = this.state;
    
    // Calculate areas
    if (showVolume) {
      // Split the chart area
      const priceHeight = dimensions.innerHeight * (1 - volumeHeight);
      const volumeAreaHeight = dimensions.innerHeight * volumeHeight;
      
      // Set price scale range
      this.state.scales.y.setRange([priceHeight, 0]);
      
      // Set volume scale range
      this.state.scales.volume.setRange([dimensions.innerHeight, priceHeight]);
      
      // Set x scale range
      this.state.scales.x.setRange([0, dimensions.innerWidth]);
      
      // Store area dimensions
      this.state.priceArea = {
        x: 0,
        y: 0,
        width: dimensions.innerWidth,
        height: priceHeight
      };
      
      this.state.volumeArea = {
        x: 0,
        y: priceHeight,
        width: dimensions.innerWidth,
        height: volumeAreaHeight
      };
    } else {
      // Use full chart area for price
      this.state.scales.x.setRange([0, dimensions.innerWidth]);
      this.state.scales.y.setRange([dimensions.innerHeight, 0]);
      
      // Store area dimensions
      this.state.priceArea = {
        x: 0,
        y: 0,
        width: dimensions.innerWidth,
        height: dimensions.innerHeight
      };
      
      this.state.volumeArea = null;
    }
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
    
    // Create chart areas
    this.createChartAreas();
    
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
   * Create chart areas
   * @private
   */
  createChartAreas() {
    if (!this.options.showVolume) {
      // No need for separate areas
      return;
    }
    
    // Create a group for price chart
    const priceGroup = SvgRenderer.createGroup({
      class: 'visioncharts-price-area'
    });
    
    // Create a group for volume chart
    const volumeGroup = SvgRenderer.createGroup({
      class: 'visioncharts-volume-area',
      transform: `translate(0,${this.state.priceArea.height})`
    });
    
    // Add groups to chart
    this.state.chart.appendChild(priceGroup);
    this.state.chart.appendChild(volumeGroup);
    
    // Store references
    this.state.priceGroup = priceGroup;
    this.state.volumeGroup = volumeGroup;
  }
  
  /**
   * Render axes
   * @private
   */
  renderAxes() {
    if (!this.state.chart) return;
    
    const { showVolume } = this.options;
    const { dimensions, priceArea, volumeArea } = this.state;
    
    // Render X axis at the bottom
    this.state.axes.x.render(
      this.state.chart,
      dimensions.innerWidth,
      dimensions.innerHeight
    );
    
    // Render Y axis for prices
    this.state.axes.y.render(
      this.state.chart,
      dimensions.innerWidth,
      showVolume ? priceArea.height : dimensions.innerHeight
    );
    
    // Render volume axis if needed
    if (showVolume && this.state.axes.volume) {
      this.state.axes.volume.render(
        this.state.volumeGroup,
        dimensions.innerWidth,
        volumeArea.height
      );
    }
  }
  
  /**
   * Render chart data
   * @private
   */
  renderData() {
    if (!this.state.chart) return;
    
    const {
      dateField,
      openField,
      highField,
      lowField,
      closeField,
      volumeField,
      colors,
      candleWidth,
      showVolume
    } = this.options;
    
    const data = this.config.data;
    if (!data || !data.length) return;
    
    // Create data group for candlesticks
    const candlesticksGroup = SvgRenderer.createGroup({
      class: 'visioncharts-candlesticks'
    });
    
    // Get container for candlesticks
    const container = showVolume ? this.state.priceGroup : this.state.chart;
    container.appendChild(candlesticksGroup);
    
    // Calculate candle width
    const availableWidth = this.state.dimensions.innerWidth / data.length;
    const actualCandleWidth = availableWidth * candleWidth;
    
    // Render each candlestick
    data.forEach((d, i) => {
      const date = d[dateField];
      const open = d[openField];
      const high = d[highField];
      const low = d[lowField];
      const close = d[closeField];
      
      // Skip if missing required data
      if (open === undefined || high === undefined || 
          low === undefined || close === undefined) {
        return;
      }
      
      // Determine if this is an up or down candle
      const isUp = close >= open;
      const candleColor = isUp ? colors.up : colors.down;
      
      // Get scaled coordinates
      const x = this.state.scales.x.scale(date);
      const yOpen = this.state.scales.y.scale(open);
      const yHigh = this.state.scales.y.scale(high);
      const yLow = this.state.scales.y.scale(low);
      const yClose = this.state.scales.y.scale(close);
      
      // Calculate candle body coordinates
      const bodyTop = isUp ? yClose : yOpen;
      const bodyBottom = isUp ? yOpen : yClose;
      const bodyHeight = Math.max(1, Math.abs(bodyBottom - bodyTop));
      
      // Create candle group
      const candleGroup = SvgRenderer.createGroup({
        class: `visioncharts-candle ${isUp ? 'up' : 'down'}`,
        'data-index': i,
        'data-date': date,
        'data-open': open,
        'data-high': high,
        'data-low': low,
        'data-close': close
      });
      
      // Create wick
      const wick = SvgRenderer.createLine(
        x,
        yHigh,
        x,
        yLow,
        {
          class: 'visioncharts-candle-wick',
          stroke: colors.wick,
          'stroke-width': 1
        }
      );
      
      // Create body
      const body = SvgRenderer.createRect(
        x - actualCandleWidth / 2,
        bodyTop,
        actualCandleWidth,
        bodyHeight,
        {
          class: 'visioncharts-candle-body',
          fill: candleColor,
          stroke: candleColor,
          'stroke-width': 1
        }
      );
      
      // Add elements to candle group
      candleGroup.appendChild(wick);
      candleGroup.appendChild(body);
      
      // Add candle to group
      candlesticksGroup.appendChild(candleGroup);
    });
    
    // Render volume bars if enabled
    if (showVolume && volumeField) {
      this.renderVolumeData(data);
    }
  }
  
  /**
   * Render volume data
   * @private
   * @param {Array} data - Chart data
   */
  renderVolumeData(data) {
    const {
      dateField,
      openField,
      closeField,
      volumeField,
      colors,
      candleWidth
    } = this.options;
    
    // Create volume group
    const volumeGroup = SvgRenderer.createGroup({
      class: 'visioncharts-volume-bars'
    });
    
    // Add to volume area
    this.state.volumeGroup.appendChild(volumeGroup);
    
    // Calculate bar width
    const availableWidth = this.state.dimensions.innerWidth / data.length;
    const barWidth = availableWidth * candleWidth;
    
    // Render each volume bar
    data.forEach((d, i) => {
      const date = d[dateField];
      const open = d[openField];
      const close = d[closeField];
      const volume = d[volumeField];
      
      // Skip if missing volume
      if (volume === undefined) return;
      
      // Determine if this is an up or down candle
      const isUp = close >= open;
      const barColor = isUp ? colors.up : colors.down;
      
      // Get scaled coordinates
      const x = this.state.scales.x.scale(date);
      const y = this.state.scales.volume.scale(volume);
      const height = this.state.volumeArea.height - (y - this.state.priceArea.height);
      
      // Create volume bar
      const volumeBar = SvgRenderer.createRect(
        x - barWidth / 2,
        y,
        barWidth,
        height,
        {
          class: 'visioncharts-volume-bar',
          fill: barColor,
          'fill-opacity': 0.5,
          stroke: 'none',
          'data-volume': volume
        }
      );
      
      // Add to volume group
      volumeGroup.appendChild(volumeBar);
    });
  }
  
  /**
   * Render tooltip
   * @private
   */
  renderTooltip() {
    if (!this.options.tooltip || !this.state.svg) return;
    
    const {
      dateField,
      openField,
      highField,
      lowField,
      closeField,
      volumeField,
      xType,
      yType,
      xFormat,
      yFormat,
      showVolume
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
    
    // Create tooltip text container
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
    
    // Create horizontal crosshair
    const crosshairY = SvgRenderer.createLine(0, 0, this.state.dimensions.innerWidth, 0, {
      class: 'visioncharts-crosshair-y',
      stroke: '#999',
      'stroke-width': 1,
      'stroke-dasharray': '4,4',
      opacity: 0
    });
    
    // Add elements to group
    tooltipGroup.appendChild(tooltipBg);
    tooltipGroup.appendChild(tooltipText);
    
    // Add crosshairs to chart
    this.state.chart.appendChild(crosshairX);
    this.state.chart.appendChild(crosshairY);
    
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
      const y = e.clientY - rect.top - this.options.margins.top;
      
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
      const pointY = this.state.scales.y.scale(closestPoint[closeField]);
      
      // Update crosshairs
      crosshairX.setAttribute('x1', pointX);
      crosshairX.setAttribute('x2', pointX);
      crosshairX.setAttribute('opacity', 1);
      
      if (y <= this.state.priceArea.height) {
        // Mouse is in price area
        crosshairY.setAttribute('y1', y);
        crosshairY.setAttribute('y2', y);
        crosshairY.setAttribute('opacity', 1);
      } else {
        // Hide horizontal crosshair in volume area
        crosshairY.setAttribute('opacity', 0);
      }
      
      // Format values
      const dateFormatted = SvgRenderer.formatTickValue(
        closestPoint[dateField],
        xType,
        xFormat
      );
      
      const openFormatted = SvgRenderer.formatTickValue(
        closestPoint[openField],
        yType,
        yFormat
      );
      
      const highFormatted = SvgRenderer.formatTickValue(
        closestPoint[highField],
        yType,
        yFormat
      );
      
      const lowFormatted = SvgRenderer.formatTickValue(
        closestPoint[lowField],
        yType,
        yFormat
      );
      
      const closeFormatted = SvgRenderer.formatTickValue(
        closestPoint[closeField],
        yType,
        yFormat
      );
      
      // Generate tooltip content
      let tooltipContent = dateFormatted;
      
      // Build tooltip with tspan elements for multiline
      tooltipText.textContent = ''; // Clear existing content
      
      const dateSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      dateSpan.textContent = dateFormatted;
      dateSpan.setAttribute('x', 8);
      dateSpan.setAttribute('dy', 16);
      tooltipText.appendChild(dateSpan);
      
      const openSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      openSpan.textContent = `O: ${openFormatted}`;
      openSpan.setAttribute('x', 8);
      openSpan.setAttribute('dy', 16);
      tooltipText.appendChild(openSpan);
      
      const highSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      highSpan.textContent = `H: ${highFormatted}`;
      highSpan.setAttribute('x', 8);
      highSpan.setAttribute('dy', 16);
      tooltipText.appendChild(highSpan);
      
      const lowSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      lowSpan.textContent = `L: ${lowFormatted}`;
      lowSpan.setAttribute('x', 8);
      lowSpan.setAttribute('dy', 16);
      tooltipText.appendChild(lowSpan);
      
      const closeSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      closeSpan.textContent = `C: ${closeFormatted}`;
      closeSpan.setAttribute('x', 8);
      closeSpan.setAttribute('dy', 16);
      tooltipText.appendChild(closeSpan);
      
      // Add volume if available
      if (showVolume && closestPoint[volumeField] !== undefined) {
        const volumeFormatted = SvgRenderer.formatTickValue(
          closestPoint[volumeField],
          'number',
          { notation: 'compact' }
        );
        
        const volumeSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        volumeSpan.textContent = `V: ${volumeFormatted}`;
        volumeSpan.setAttribute('x', 8);
        volumeSpan.setAttribute('dy', 16);
        tooltipText.appendChild(volumeSpan);
      }
      
      // Get tooltip dimensions
      const tooltipBox = tooltipText.getBBox();
      const tooltipWidth = tooltipBox.width + 16;
      const tooltipHeight = tooltipBox.height + 8;
      
      // Position tooltip to avoid going off chart
      let tooltipX = pointX + 8;
      let tooltipY = 0;
      
      // Adjust if it would go off the right edge
      if (tooltipX + tooltipWidth > this.state.dimensions.innerWidth) {
        tooltipX = pointX - tooltipWidth - 8;
      }
      
      // Update tooltip position and dimensions
      tooltipGroup.setAttribute('transform', `translate(${tooltipX + this.options.margins.left},${tooltipY + this.options.margins.top})`);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', tooltipHeight);
      
      // Show tooltip
      tooltipGroup.setAttribute('opacity', 1);
      
      // Highlight active candle
      const allCandles = this.state.chart.querySelectorAll('.visioncharts-candle');
      allCandles.forEach(candle => {
        candle.setAttribute('opacity', 0.5);
      });
      
      const activeCandle = this.state.chart.querySelector(`.visioncharts-candle[data-index="${closestIndex}"]`);
      if (activeCandle) {
        activeCandle.setAttribute('opacity', 1);
      }
    });
    
    eventRect.addEventListener('mouseleave', () => {
      // Hide tooltip and crosshairs
      tooltipGroup.setAttribute('opacity', 0);
      crosshairX.setAttribute('opacity', 0);
      crosshairY.setAttribute('opacity', 0);
      
      // Reset candle highlights
      const allCandles = this.state.chart.querySelectorAll('.visioncharts-candle');
      allCandles.forEach(candle => {
        candle.setAttribute('opacity', 1);
      });
    });
    
    // Add event rect to chart
    this.state.chart.appendChild(eventRect);
  }
  
  /**
   * Update scales
   * @private
   */
  updateScales() {
    super.updateScales();
    this.updateScaleRanges();
  }
  
  /**
   * Update chart data
   * @private
   */
  updateData() {
    // Remove existing data groups
    const existingCandlesticks = this.state.chart.querySelector('.visioncharts-candlesticks');
    if (existingCandlesticks) {
      existingCandlesticks.parentNode.removeChild(existingCandlesticks);
    }
    
    if (this.options.showVolume) {
      const existingVolume = this.state.chart.querySelector('.visioncharts-volume-bars');
      if (existingVolume) {
        existingVolume.parentNode.removeChild(existingVolume);
      }
    }
    
    // Re-render data
    this.renderData();
  }
}
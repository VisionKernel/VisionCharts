import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import LineChart from './LineChart.js';
import CandlestickChart from './CandlestickChart.js';
import VolumeChart from './VolumeChart.js';

/**
 * CombinedChart class for rendering multiple chart types together
 * Typically used for financial data with price and volume
 */
export default class CombinedChart extends Chart {
  /**
   * Create a new combined chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor
    super(config);
    
    // Merge options with specific defaults
    this.options = Object.assign({
      // Layout options
      layout: [
        { type: 'candlestick', height: 0.7 },
        { type: 'volume', height: 0.3 }
      ],
      // Time axis options
      dateField: 'date',
      xType: 'time',
      xFormat: '',
      xAxisLabel: 'Date',
      // Chart-specific options
      charts: {
        candlestick: {
          openField: 'open',
          highField: 'high',
          lowField: 'low',
          closeField: 'close',
          yFormat: { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 2
          },
          yAxisLabel: 'Price',
          colors: {
            up: '#34A853', // Green for up candles
            down: '#EA4335', // Red for down candles
            wick: '#333333'  // Dark gray for wicks
          }
        },
        line: {
          yField: 'close',
          yFormat: { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 2
          },
          yAxisLabel: 'Price',
          strokeWidth: 2,
          showPoints: false,
          curve: 'monotone',
          color: '#4285F4'
        },
        volume: {
          volumeField: 'volume',
          yFormat: { notation: 'compact' },
          yAxisLabel: 'Volume',
          colors: {
            up: '#34A853', // Green for up volume
            down: '#EA4335', // Red for down volume
            neutral: '#4285F4' // Blue for neutral volume
          }
        }
      },
      // Common options
      grid: true,
      tooltip: true,
      animation: {
        enabled: true,
        duration: 300
      }
    }, this.options);
    
    // Initialize sub-charts
    this.subCharts = [];
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    // Create common X scale (time) - shared across all subcharts
    this.state.scales.x = new TimeScale([0, 1], [0, 1]);
    
    // Each subchart will create its own Y scale in renderSubCharts
  }
  
  /**
   * Create axes for the chart
   * @private
   */
  createAxes() {
    // Create X axis (shared)
    this.state.axes.x = new Axis({
      orientation: 'bottom',
      scale: this.state.scales.x,
      formatType: this.options.xType,
      formatOptions: this.options.xFormat,
      label: this.options.xAxisLabel,
      grid: this.options.grid
    });
    
    // Y axes will be created by subcharts
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    const { dateField } = this.options;
    const data = this.config.data;
    
    if (!data || !data.length) return;
    
    // Extract dates
    const dates = data.map(d => d[dateField]);
    
    // Calculate domain
    const xMin = new Date(Math.min(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    const xMax = new Date(Math.max(...dates.map(d => d instanceof Date ? d.getTime() : d)));
    
    // Set X scale domain (shared)
    this.state.scales.x.setDomain([xMin, xMax]);
    
    // Set X scale range
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    
    // Each subchart will update its own Y scale
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
    
    // Create chart areas based on layout
    this.createChartAreas();
    
    // Render subcharts
    this.renderSubCharts();
    
    // Render X axis
    this.renderXAxis();
    
    // Render title
    this.renderTitle();
    
    // Update state
    this.state.rendered = true;
    
    return this;
  }
  
  /**
   * Create chart areas based on layout
   * @private
   */
  createChartAreas() {
    const { layout } = this.options;
    const totalHeight = this.state.dimensions.innerHeight;
    
    // Store chart areas
    this.state.chartAreas = [];
    
    // Calculate pixel heights
    let y = 0;
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i];
      const height = Math.round(totalHeight * item.height);
      
      // Create area group
      const areaGroup = SvgRenderer.createGroup({
        class: `visioncharts-area visioncharts-${item.type}-area`,
        transform: `translate(0,${y})`
      });
      
      // Store area info
      this.state.chartAreas.push({
        type: item.type,
        group: areaGroup,
        x: 0,
        y,
        width: this.state.dimensions.innerWidth,
        height,
        index: i
      });
      
      // Add to chart
      this.state.chart.appendChild(areaGroup);
      
      // Update y position for next area
      y += height;
    }
  }
  
  /**
   * Render X axis
   * @private
   */
  renderXAxis() {
    if (!this.state.chart) return;
    
    // Render X axis at the bottom
    this.state.axes.x.render(
      this.state.chart,
      this.state.dimensions.innerWidth,
      this.state.dimensions.innerHeight
    );
  }
  
  /**
   * Render subcharts
   * @private
   */
  renderSubCharts() {
    // Clear existing subcharts
    this.subCharts = [];
    
    // Render each subchart
    this.state.chartAreas.forEach(area => {
      const subChart = this.createSubChart(area);
      if (subChart) {
        this.subCharts.push(subChart);
      }
    });
  }
  
  /**
   * Create a subchart for a given area
   * @private
   * @param {Object} area - Chart area
   * @returns {Object} Subchart configuration
   */
  createSubChart(area) {
    const { type, group, x, y, width, height, index } = area;
    
    // Get options for this chart type
    const chartOptions = this.options.charts[type];
    if (!chartOptions) {
      console.error(`No options found for chart type: ${type}`);
      return null;
    }
    
    // Common properties
    const commonProps = {
      dateField: this.options.dateField,
      xType: this.options.xType,
      xFormat: this.options.xFormat,
      grid: index === 0 ? this.options.grid : false // Grid only on first chart
    };
    
    // Create scale
    let yScale;
    
    switch (type) {
      case 'candlestick':
        {
          // Y scale for price
          yScale = new LinearScale([0, 1], [height, 0]);
          
          // Extract price values
          const highs = this.config.data.map(d => d[chartOptions.highField]);
          const lows = this.config.data.map(d => d[chartOptions.lowField]);
          
          // Calculate domain
          const yMin = Math.min(...lows);
          const yMax = Math.max(...highs);
          
          // Add padding
          const yPadding = (yMax - yMin) * 0.05;
          yScale.setDomain([yMin - yPadding, yMax + yPadding]);
          
          // Create Y axis
          const yAxis = new Axis({
            orientation: 'left',
            scale: yScale,
            formatType: 'number',
            formatOptions: chartOptions.yFormat,
            label: chartOptions.yAxisLabel,
            grid: index === 0 ? this.options.grid : false // Grid only on first chart
          });
          
          // Render Y axis
          yAxis.render(group, width, height);
          
          // Render candlesticks
          this.renderCandlesticks(group, yScale, chartOptions, width, height);
          
          return {
            type,
            area,
            yScale,
            yAxis
          };
        }
      
      case 'line':
        {
          // Y scale for line
          yScale = new LinearScale([0, 1], [height, 0]);
          
          // Extract price values
          const values = this.config.data.map(d => d[chartOptions.yField]);
          
          // Calculate domain
          const yMin = Math.min(...values);
          const yMax = Math.max(...values);
          
          // Add padding
          const yPadding = (yMax - yMin) * 0.05;
          yScale.setDomain([yMin - yPadding, yMax + yPadding]);
          
          // Create Y axis
          const yAxis = new Axis({
            orientation: 'left',
            scale: yScale,
            formatType: 'number',
            formatOptions: chartOptions.yFormat,
            label: chartOptions.yAxisLabel,
            grid: index === 0 ? this.options.grid : false // Grid only on first chart
          });
          
          // Render Y axis
          yAxis.render(group, width, height);
          
          // Render line
          this.renderLine(group, yScale, chartOptions, width, height);
          
          return {
            type,
            area,
            yScale,
            yAxis
          };
        }
      
      case 'volume':
        {
          // Y scale for volume
          yScale = new LinearScale([0, 1], [height, 0]);
          
          // Extract volume values
          const volumes = this.config.data.map(d => d[chartOptions.volumeField] || 0);
          
          // Calculate domain
          const yMax = Math.max(...volumes);
          yScale.setDomain([0, yMax * 1.05]); // Add a bit of padding
          
          // Create Y axis
          const yAxis = new Axis({
            orientation: 'left',
            scale: yScale,
            formatType: 'number',
            formatOptions: chartOptions.yFormat,
            label: chartOptions.yAxisLabel,
            grid: false
          });
          
          // Render Y axis
          yAxis.render(group, width, height);
          
          // Render volume bars
          this.renderVolume(group, yScale, chartOptions, width, height);
          
          return {
            type,
            area,
            yScale,
            yAxis
          };
        }
      
      default:
        console.error(`Unsupported chart type: ${type}`);
        return null;
    }
  }
  
  /**
   * Render candlesticks in a subchart
   * @private
   */
  renderCandlesticks(group, yScale, options, width, height) {
    const {
      openField,
      highField,
      lowField,
      closeField,
      colors
    } = options;
    
    const { dateField } = this.options;
    const xScale = this.state.scales.x;
    const data = this.config.data;
    
    // Create data group
    const candlesticksGroup = SvgRenderer.createGroup({
      class: 'visioncharts-candlesticks'
    });
    
    // Calculate candle width
    const availableWidth = width / data.length;
    const candleWidth = availableWidth * 0.6;
    
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
      const x = xScale.scale(date);
      const yOpen = yScale.scale(open);
      const yHigh = yScale.scale(high);
      const yLow = yScale.scale(low);
      const yClose = yScale.scale(close);
      
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
        x - candleWidth / 2,
        bodyTop,
        candleWidth,
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
    
    // Add data group to chart
    group.appendChild(candlesticksGroup);
  }
  
  /**
   * Render line in a subchart
   * @private
   */
  renderLine(group, yScale, options, width, height) {
    const {
      yField,
      color,
      strokeWidth,
      showPoints,
      curve
    } = options;
    
    const { dateField } = this.options;
    const xScale = this.state.scales.x;
    const data = this.config.data;
    
    // Create data group
    const lineGroup = SvgRenderer.createGroup({
      class: 'visioncharts-line-data'
    });
    
    // Map data points to coordinates
    const points = data.map(d => [
      xScale.scale(d[dateField]),
      yScale.scale(d[yField])
    ]);
    
    // Generate path definition based on curve type
    let pathDefinition;
    
    switch (curve) {
      case 'monotone':
        pathDefinition = this.generateMonotonePath(points);
        break;
      case 'cardinal':
        pathDefinition = this.generateCardinalPath(points);
        break;
      case 'step':
        pathDefinition = this.generateStepPath(points);
        break;
      case 'linear':
      default:
        pathDefinition = SvgRenderer.linePathDefinition(points);
    }
    
    // Create line
    const lineElement = SvgRenderer.createPath(pathDefinition, {
      class: 'visioncharts-line',
      stroke: color,
      'stroke-width': strokeWidth,
      fill: 'none'
    });
    
    lineGroup.appendChild(lineElement);
    
    // Render points if enabled
    if (showPoints) {
      data.forEach((d, i) => {
        const x = xScale.scale(d[dateField]);
        const y = yScale.scale(d[yField]);
        
        const point = SvgRenderer.createCircle(x, y, 3, {
          class: 'visioncharts-point',
          fill: '#fff',
          stroke: color,
          'stroke-width': strokeWidth / 2
        });
        
        lineGroup.appendChild(point);
      });
    }
    
    // Add line group to chart
    group.appendChild(lineGroup);
  }
  
  /**
   * Render volume bars in a subchart
   * @private
   */
  renderVolume(group, yScale, options, width, height) {
    const {
      volumeField,
      colors
    } = options;
    
    const { dateField } = this.options;
    const xScale = this.state.scales.x;
    const data = this.config.data;
    
    // Track previous close for determining direction
    let prevClose = null;
    
    // Field to check for up/down
    const priceField = this.options.charts.candlestick ? 
      this.options.charts.candlestick.closeField : 'close';
    
    // Create data group
    const volumeGroup = SvgRenderer.createGroup({
      class: 'visioncharts-volume-bars'
    });
    
    // Calculate bar width
    const availableWidth = width / data.length;
    const barWidth = availableWidth * 0.8;
    
    // Render each volume bar
    data.forEach((d, i) => {
      const date = d[dateField];
      const volume = d[volumeField] || 0;
      const close = d[priceField];
      
      // Get direction
      let direction = 'neutral';
      
      if (close !== undefined && prevClose !== null) {
        direction = close > prevClose ? 'up' : (close < prevClose ? 'down' : 'neutral');
      }
      
      prevClose = close;
      
      // Get bar color
      const barColor = colors[direction];
      
      // Get scaled coordinates
      const x = xScale.scale(date);
      const y = yScale.scale(volume);
      const barHeight = height - y;
      
      // Create volume bar
      const volumeBar = SvgRenderer.createRect(
        x - barWidth / 2,
        y,
        barWidth,
        Math.max(1, barHeight), // Ensure at least 1px height for visibility
        {
          class: `visioncharts-volume-bar ${direction}`,
          fill: barColor,
          stroke: 'none',
          'data-index': i,
          'data-date': date,
          'data-volume': volume
        }
      );
      
      // Add to volume group
      volumeGroup.appendChild(volumeBar);
    });
    
    // Add to chart
    group.appendChild(volumeGroup);
  }
  
  /**
   * Generate monotone curve path
   * @private
   */
  generateMonotonePath(points) {
    if (points.length < 3) return SvgRenderer.linePathDefinition(points);
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Calculate slope for each segment
    const n = points.length;
    const tangents = new Array(n);
    
    // Initialize slopes
    for (let i = 0; i < n - 1; i++) {
      tangents[i] = (points[i + 1][1] - points[i][1]) / 
                  (points[i + 1][0] - points[i][0]);
    }
    
    // Set the slope at each point to be the average of adjacent segments
    // This ensures monotonicity
    tangents[n - 1] = tangents[n - 2];
    
    for (let i = 1; i < n - 1; i++) {
      if (tangents[i - 1] * tangents[i] <= 0) {
        // If slopes have different signs, set to zero
        tangents[i] = 0;
      } else {
        // Otherwise, use harmonic mean of slopes
        const a = tangents[i - 1];
        const b = tangents[i];
        tangents[i] = (a * b) / (a + b);
      }
    }
    
    // Generate the curve segments
    for (let i = 0; i < n - 1; i++) {
      const dx = (points[i + 1][0] - points[i][0]) / 3;
      
      const cp1x = points[i][0] + dx;
      const cp1y = points[i][1] + dx * tangents[i];
      
      const cp2x = points[i + 1][0] - dx;
      const cp2y = points[i + 1][1] - dx * tangents[i + 1];
      
      pathParts.push(
        `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1][0]},${points[i + 1][1]}`
      );
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate cardinal spline path
   * @private
   */
  generateCardinalPath(points, tension = 0.5) {
    if (points.length < 2) return SvgRenderer.linePathDefinition(points);
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Helper function to calculate control points
    const getControlPoints = (p0, p1, p2, t) => {
      const d1x = (p2[0] - p0[0]) * t;
      const d1y = (p2[1] - p0[1]) * t;
      
      return [
        [p1[0] - d1x, p1[1] - d1y], // CP1
        [p1[0] + d1x, p1[1] + d1y]  // CP2
      ];
    };
    
    // Need at least 3 points for cardinal spline
    if (points.length < 3) {
      return SvgRenderer.linePathDefinition(points);
    }
    
    // For the first segment, use the first point as the previous point
    let [cp1, cp2] = getControlPoints(
      firstPoint,
      firstPoint,
      restPoints[0],
      tension
    );
    
    for (let i = 0; i < restPoints.length; i++) {
      const current = restPoints[i];
      const prev = i > 0 ? restPoints[i - 1] : firstPoint;
      const next = i < restPoints.length - 1 ? restPoints[i + 1] : current;
      
      if (i > 0) {
        [cp1, cp2] = getControlPoints(
          prev,
          current,
          next,
          tension
        );
      }
      
      // Add cubic bezier curve segment
      pathParts.push(`C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${current[0]},${current[1]}`);
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate step path
   * @private
   */
  generateStepPath(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    for (let i = 0; i < restPoints.length; i++) {
      const [x, y] = restPoints[i];
      const prevX = i > 0 ? restPoints[i - 1][0] : firstX;
      
      pathParts.push(`H ${x}`);
      pathParts.push(`V ${y}`);
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Render tooltip
   * @private
   */
  renderTooltip() {
    if (!this.options.tooltip || !this.state.svg) return;
    
    // Add common crosshair across all charts
    this.renderCrosshairTooltip();
  }
  
  /**
   * Render crosshair tooltip
   * @private
   */
  renderCrosshairTooltip() {
    const { dateField } = this.options;
    
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
    
    // Create vertical crosshair across all charts
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
    
    // Add tooltip group to chart
    this.state.svg.appendChild(tooltipGroup);
    
    // Create event listener area for whole chart
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
      
      // Find which chart area the mouse is in
      let activeArea = null;
      for (const area of this.state.chartAreas) {
        if (y >= area.y && y < area.y + area.height) {
          activeArea = area;
          break;
        }
      }
      
      if (!activeArea) return;
      
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
      
      // Format date
      const dateFormatted = SvgRenderer.formatTickValue(
        closestPoint[dateField],
        this.options.xType,
        this.options.xFormat
      );
      
      // Clear tooltip content
      tooltipText.textContent = '';
      
      // Add date
      const dateSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      dateSpan.textContent = dateFormatted;
      dateSpan.setAttribute('x', 8);
      dateSpan.setAttribute('dy', 16);
      tooltipText.appendChild(dateSpan);
      
      // Add data based on chart types
      this.options.layout.forEach(layout => {
        const chartOptions = this.options.charts[layout.type];
        
        switch (layout.type) {
          case 'candlestick':
            {
              const { openField, highField, lowField, closeField, yFormat } = chartOptions;
              
              // Add OHLC values
              const openFormatted = SvgRenderer.formatTickValue(
                closestPoint[openField],
                'number',
                yFormat
              );
              
              const highFormatted = SvgRenderer.formatTickValue(
                closestPoint[highField],
                'number',
                yFormat
              );
              
              const lowFormatted = SvgRenderer.formatTickValue(
                closestPoint[lowField],
                'number',
                yFormat
              );
              
              const closeFormatted = SvgRenderer.formatTickValue(
                closestPoint[closeField],
                'number',
                yFormat
              );
              
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
              
              break;
            }
          
          case 'line':
            {
              const { yField, yFormat } = chartOptions;
              
              const valueFormatted = SvgRenderer.formatTickValue(
                closestPoint[yField],
                'number',
                yFormat
              );
              
              const valueSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
              valueSpan.textContent = `${chartOptions.yAxisLabel}: ${valueFormatted}`;
              valueSpan.setAttribute('x', 8);
              valueSpan.setAttribute('dy', 16);
              tooltipText.appendChild(valueSpan);
              
              break;
            }
          
          case 'volume':
            {
              const { volumeField, yFormat } = chartOptions;
              
              const volumeFormatted = SvgRenderer.formatTickValue(
                closestPoint[volumeField] || 0,
                'number',
                yFormat
              );
              
              const volumeSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
              volumeSpan.textContent = `Volume: ${volumeFormatted}`;
              volumeSpan.setAttribute('x', 8);
              volumeSpan.setAttribute('dy', 16);
              tooltipText.appendChild(volumeSpan);
              
              break;
            }
        }
      });
      
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
      
      // Highlight active elements in all charts
      this.highlightElements(closestIndex);
    });
    
    eventRect.addEventListener('mouseleave', () => {
      // Hide tooltip and crosshair
      tooltipGroup.setAttribute('opacity', 0);
      crosshairX.setAttribute('opacity', 0);
      
      // Reset highlights
      this.resetHighlights();
    });
    
    // Add event rect to chart
    this.state.chart.appendChild(eventRect);
  }
  
  /**
   * Highlight elements at a specific index
   * @private
   * @param {number} index - Data index
   */
  highlightElements(index) {
    // Dim all elements
    const allCandles = this.state.chart.querySelectorAll('.visioncharts-candle');
    allCandles.forEach(candle => candle.setAttribute('opacity', 0.5));
    
    const allBars = this.state.chart.querySelectorAll('.visioncharts-volume-bar');
    allBars.forEach(bar => bar.setAttribute('opacity', 0.5));
    
    // Highlight active elements
    const activeCandle = this.state.chart.querySelector(`.visioncharts-candle[data-index="${index}"]`);
    if (activeCandle) {
      activeCandle.setAttribute('opacity', 1);
    }
    
    const activeBar = this.state.chart.querySelector(`.visioncharts-volume-bar[data-index="${index}"]`);
    if (activeBar) {
      activeBar.setAttribute('opacity', 1);
    }
  }
  
  /**
   * Reset element highlights
   * @private
   */
  resetHighlights() {
    const allCandles = this.state.chart.querySelectorAll('.visioncharts-candle');
    allCandles.forEach(candle => candle.setAttribute('opacity', 1));
    
    const allBars = this.state.chart.querySelectorAll('.visioncharts-volume-bar');
    allBars.forEach(bar => bar.setAttribute('opacity', 1));
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
    
    // Update subcharts
    this.updateSubCharts();
    
    // Update X axis
    this.updateXAxis();
    
    return this;
  }
  
  /**
   * Update X axis
   * @private
   */
  updateXAxis() {
    if (this.state.axes.x) {
      this.state.axes.x.update();
    }
  }
  
  /**
   * Update subcharts
   * @private
   */
  updateSubCharts() {
    // Remove existing elements
    this.state.chartAreas.forEach(area => {
      const group = area.group;
      
      // Remove all children except axes (which will be updated separately)
      const children = Array.from(group.children);
      children.forEach(child => {
        if (!child.classList.contains('visioncharts-axis')) {
          group.removeChild(child);
        }
      });
    });
    
    // Re-render subcharts
    this.renderSubCharts();
  }
}
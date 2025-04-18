import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';

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
        { type: 'line', height: 0.7 },
        { type: 'volume', height: 0.3 }
      ],
      // Time axis options
      dateField: 'date',
      xType: 'time',
      xFormat: '',
      xAxisLabel: 'Date',
      // Chart-specific options
      charts: {
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
    
    // Ensure scales are updated first
    this.updateScales();
    
    // Create chart areas based on layout
    this.createChartAreas();
    
    // Render subcharts
    this.renderSubCharts();
    
    // Render X axis
    this.renderXAxis();
    
    // Render title
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
    const { type, group, width, height, index } = area;
    
    // Get options for this chart type
    const chartOptions = this.options.charts[type];
    if (!chartOptions) {
      console.error(`No options found for chart type: ${type}`);
      return null;
    }
    
    // Create scale and render the appropriate chart type
    try {
      switch (type) {
        case 'line':
          return this.createLineChart(area, chartOptions);
        
        case 'volume':
          return this.createVolumeChart(area, chartOptions);
        
        default:
          console.error(`Unsupported chart type: ${type}`);
          return null;
      }
    } catch (err) {
      console.error(`Error creating ${type} chart:`, err);
      return null;
    }
  }
  
  /**
   * Create a line chart
   * @private
   * @param {Object} area - Chart area
   * @param {Object} chartOptions - Chart options
   * @returns {Object} Chart configuration
   */
  createLineChart(area, chartOptions) {
    const { group, width, height, index } = area;
    
    // Create Y scale
    const yScale = new LinearScale([0, 1], [height, 0]);
    
    try {
      // Extract values
      const values = this.config.data.map(d => d[chartOptions.yField] || 0);
      
      // Calculate domain
      const yMin = Math.min(...values);
      const yMax = Math.max(...values);
      
      // Add padding
      const yPadding = (yMax - yMin) * 0.05 || 1;
      yScale.setDomain([yMin - yPadding, yMax + yPadding]);
      
      // Create Y axis
      const yAxis = new Axis({
        orientation: 'left',
        scale: yScale,
        formatType: 'number',
        formatOptions: chartOptions.yFormat,
        label: chartOptions.yAxisLabel,
        grid: index === 0 ? this.options.grid : false
      });
      
      // Render Y axis
      yAxis.render(group, width, height);
      
      // Render line
      this.renderLine(group, yScale, chartOptions);
      
      return { type: 'line', area, yScale, yAxis };
    } catch (err) {
      console.error('Error rendering line chart:', err);
      return null;
    }
  }
  
  /**
   * Create a volume chart
   * @private
   * @param {Object} area - Chart area
   * @param {Object} chartOptions - Chart options
   * @returns {Object} Chart configuration
   */
  createVolumeChart(area, chartOptions) {
    const { group, width, height, index } = area;
    
    // Create Y scale
    const yScale = new LinearScale([0, 1], [height, 0]);
    
    try {
      // Extract volume values
      const volumes = this.config.data.map(d => d[chartOptions.volumeField] || 0);
      
      // Calculate domain
      const yMax = Math.max(...volumes);
      yScale.setDomain([0, yMax * 1.05]); // Add padding
      
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
      this.renderVolume(group, yScale, chartOptions);
      
      return { type: 'volume', area, yScale, yAxis };
    } catch (err) {
      console.error('Error rendering volume chart:', err);
      return null;
    }
  }
  
  /**
   * Render line in a subchart
   * @private
   * @param {SVGElement} group - Chart group element
   * @param {Scale} yScale - Y scale
   * @param {Object} options - Chart options
   */
  renderLine(group, yScale, options) {
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
      yScale.scale(d[yField] || 0)
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
        const y = yScale.scale(d[yField] || 0);
        
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
   * @param {SVGElement} group - Chart group element
   * @param {Scale} yScale - Y scale
   * @param {Object} options - Chart options
   */
  renderVolume(group, yScale, options) {
    const {
      volumeField,
      colors
    } = options;
    
    const { dateField } = this.options;
    const xScale = this.state.scales.x;
    const data = this.config.data;
    const width = this.state.dimensions.innerWidth;
    const height = group.parentNode ? parseFloat(group.parentNode.getAttribute('height')) : 0;
    
    // Track previous close for determining direction
    let prevPrice = null;
    
    // Field to check for up/down
    const priceField = 'close';
    
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
      const x = xScale.scale(date);
      const y = yScale.scale(volume);
      const barHeight = height - (y - group.getBoundingClientRect().top);
      
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
   * @param {Array} points - Array of [x, y] points
   * @returns {string} Path definition
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
   * @param {Array} points - Array of [x, y] points
   * @param {number} tension - Curve tension (0-1)
   * @returns {string} Path definition
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
   * @param {Array} points - Array of [x, y] points
   * @returns {string} Path definition
   */
  generateStepPath(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    for (let i = 0; i < restPoints.length; i++) {
      const [x, y] = restPoints[i];
      
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
    const allBars = this.state.chart.querySelectorAll('.visioncharts-volume-bar');
    allBars.forEach(bar => bar.setAttribute('opacity', 0.5));
    
    // Highlight active elements
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
    const allBars = this.state.chart.querySelectorAll('.visioncharts-volume-bar');
    allBars.forEach(bar => bar.setAttribute('opacity', 1));
  }
  
  /**
   * Update the chart - completely improved
   * @public
   */
  update() {
    if (!this.state.rendered) {
      return this.render();
    }
    
    // Update scales
    this.updateScales();
    
    // Clean up before recreating
    this.state.chartAreas.forEach(area => {
      if (area.group && area.group.parentNode) {
        area.group.parentNode.removeChild(area.group);
      }
    });
    
    // Reset chart areas
    this.state.chartAreas = [];
    
    // Recreate chart areas
    this.createChartAreas();
    
    // Render subcharts
    this.renderSubCharts();
    
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
      if (this.state.axes.x.element && this.state.axes.x.element.parentNode) {
        this.state.axes.x.element.parentNode.removeChild(this.state.axes.x.element);
      }
      
      if (this.state.axes.x.gridElement && this.state.axes.x.gridElement.parentNode) {
        this.state.axes.x.gridElement.parentNode.removeChild(this.state.axes.x.gridElement);
      }
      
      this.state.axes.x.render(
        this.state.chart,
        this.state.dimensions.innerWidth,
        this.state.dimensions.innerHeight
      );
    }
  }
}
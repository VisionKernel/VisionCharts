import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * LineChart class for rendering line charts
 */
export default class LineChart extends Chart {
  /**
   * Create a new line chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor
    super(config);
    
    // Merge options with specific defaults for line charts
    this.options = Object.assign({
      curve: 'linear', // 'linear', 'step', 'cardinal', 'monotone'
      showPoints: true,
      pointRadius: 3,
      strokeWidth: 2,
      xField: 'x',
      yField: 'y',
      xType: 'number', // 'number', 'time'
      yType: 'number',
      xFormat: '',
      yFormat: '',
      xAxisLabel: '',
      yAxisLabel: '',
      colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335'], // Google colors as defaults
      area: false,
      areaOpacity: 0.2,
      grid: true,
      tooltip: true,
      legend: true,
      transition: true,
      transitionDuration: 300
    }, this.options);
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    const { xType, yType } = this.options;
    
    // Create X scale
    this.state.scales.x = xType === 'time' ? 
      new TimeScale([0, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    // Create Y scale
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
      formatType: this.options.yType,
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
    const { xField, yField } = this.options;
    const data = this.config.data;
    
    if (!data || !data.length) return;
    
    // Extract X and Y values
    const xValues = data.map(d => d[xField]);
    const yValues = data.map(d => d[yField]);
    
    // Calculate domains
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    
    // Add some padding to Y domain
    const yPadding = (yMax - yMin) * 0.1;
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([yMin - yPadding, yMax + yPadding]);
    
    // Set ranges based on dimensions
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
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
   * Generate line path based on data
   * @private
   * @param {Array} data - Chart data
   * @returns {string} Path definition
   */
  generateLinePath(data) {
    const { xField, yField, curve } = this.options;
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    // Map data points to coordinates
    const points = data.map(d => [
      xScale.scale(d[xField]),
      yScale.scale(d[yField])
    ]);
    
    // Generate path definition based on curve type
    switch (curve) {
      case 'step':
        return this.generateStepPath(points);
      case 'cardinal':
        return this.generateCardinalPath(points);
      case 'monotone':
        return this.generateMonotonePath(points);
      case 'linear':
      default:
        return SvgRenderer.linePathDefinition(points);
    }
  }
  
  /**
   * Generate step line path
   * @private
   * @param {Array} points - Array of [x, y] coordinates
   * @returns {string} Path definition
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
   * Generate cardinal spline path
   * @private
   * @param {Array} points - Array of [x, y] coordinates
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
   * Generate monotone cubic interpolation path
   * This ensures the curve is monotonic and doesn't overshoot
   * @private
   * @param {Array} points - Array of [x, y] coordinates
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
   * Generate area path based on data
   * @private
   * @param {Array} data - Chart data
   * @returns {string} Path definition
   */
  generateAreaPath(data) {
    const { xField, yField, curve } = this.options;
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    // Map data points to coordinates
    const points = data.map(d => [
      xScale.scale(d[xField]),
      yScale.scale(d[yField])
    ]);
    
    // Baseline Y coordinate (bottom of chart)
    const baselineY = this.state.dimensions.innerHeight;
    
    // Generate path definition
    return SvgRenderer.areaPathDefinition(points, baselineY);
  }
  
  /**
   * Render data
   * @private
   */
  renderData() {
    if (!this.state.chart) return;
    
    const {
      xField,
      yField,
      showPoints,
      pointRadius,
      strokeWidth,
      colors,
      area,
      areaOpacity
    } = this.options;
    
    const data = this.config.data;
    if (!data || !data.length) return;
    
    // Create data group
    const dataGroup = SvgRenderer.createGroup({
      class: 'visioncharts-data'
    });
    
    // Get color for this series
    const color = colors[0];
    
    // Render area if enabled
    if (area) {
      const areaPath = this.generateAreaPath(data);
      const areaElement = SvgRenderer.createPath(areaPath, {
        class: 'visioncharts-area',
        fill: color,
        'fill-opacity': areaOpacity,
        stroke: 'none'
      });
      
      dataGroup.appendChild(areaElement);
    }
    
    // Render line
    const linePath = this.generateLinePath(data);
    const lineElement = SvgRenderer.createPath(linePath, {
      class: 'visioncharts-line',
      stroke: color,
      'stroke-width': strokeWidth,
      fill: 'none'
    });
    
    dataGroup.appendChild(lineElement);
    
    // Render points if enabled
    if (showPoints) {
      const pointsGroup = SvgRenderer.createGroup({
        class: 'visioncharts-points'
      });
      
      data.forEach(d => {
        const x = this.state.scales.x.scale(d[xField]);
        const y = this.state.scales.y.scale(d[yField]);
        
        const point = SvgRenderer.createCircle(x, y, pointRadius, {
          class: 'visioncharts-point',
          fill: '#fff',
          stroke: color,
          'stroke-width': strokeWidth / 2
        });
        
        pointsGroup.appendChild(point);
      });
      
      dataGroup.appendChild(pointsGroup);
    }
    
    // Add data group to chart
    this.state.chart.appendChild(dataGroup);
  }
  
  /**
   * Render tooltip
   * @private
   */
  renderTooltip() {
    if (!this.options.tooltip || !this.state.svg) return;
    
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
      const { xField, yField, xType, yType } = this.options;
      const xScale = this.state.scales.x;
      const yScale = this.state.scales.y;
      
      // Convert mouse position back to data domain
      const xValue = xScale.invert(x);
      
      // Find closest data point
      let closestPoint = null;
      let minDistance = Infinity;
      
      this.config.data.forEach(d => {
        const distance = Math.abs(d[xField] - xValue);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = d;
        }
      });
      
      if (!closestPoint) return;
      
      // Get point coordinates
      const pointX = xScale.scale(closestPoint[xField]);
      const pointY = yScale.scale(closestPoint[yField]);
      
      // Update crosshairs
      crosshairX.setAttribute('x1', pointX);
      crosshairX.setAttribute('x2', pointX);
      crosshairX.setAttribute('opacity', 1);
      
      crosshairY.setAttribute('y1', pointY);
      crosshairY.setAttribute('y2', pointY);
      crosshairY.setAttribute('opacity', 1);
      
      // Format values
      const xFormatted = SvgRenderer.formatTickValue(
        closestPoint[xField],
        xType,
        this.options.xFormat
      );
      
      const yFormatted = SvgRenderer.formatTickValue(
        closestPoint[yField],
        yType,
        this.options.yFormat
      );
      
      // Update tooltip text
      tooltipText.textContent = `${xFormatted}: ${yFormatted}`;
      
      // Get tooltip dimensions
      const tooltipWidth = tooltipText.getBBox().width + 16;
      const tooltipHeight = tooltipText.getBBox().height + 8;
      
      // Position tooltip to avoid going off chart
      let tooltipX = pointX + 8;
      let tooltipY = pointY - tooltipHeight - 8;
      
      // Adjust if it would go off the right edge
      if (tooltipX + tooltipWidth > this.state.dimensions.innerWidth) {
        tooltipX = pointX - tooltipWidth - 8;
      }
      
      // Adjust if it would go off the top edge
      if (tooltipY < 0) {
        tooltipY = pointY + 8;
      }
      
      // Update tooltip position and dimensions
      tooltipGroup.setAttribute('transform', `translate(${tooltipX + this.options.margins.left},${tooltipY + this.options.margins.top})`);
      tooltipBg.setAttribute('width', tooltipWidth);
      tooltipBg.setAttribute('height', tooltipHeight);
      tooltipText.setAttribute('x', 8);
      tooltipText.setAttribute('y', tooltipHeight / 2 + 4);
      
      // Show tooltip
      tooltipGroup.setAttribute('opacity', 1);
    });
    
    eventRect.addEventListener('mouseleave', () => {
      // Hide tooltip and crosshairs
      tooltipGroup.setAttribute('opacity', 0);
      crosshairX.setAttribute('opacity', 0);
      crosshairY.setAttribute('opacity', 0);
    });
    
    // Add event rect to chart
    this.state.chart.appendChild(eventRect);
  }
  
  /**
   * Render the chart
   * @public
   */
  render() {
    // Call parent render method
    super.render();
    
    // Render tooltip if enabled
    if (this.options.tooltip) {
      this.renderTooltip();
    }
    
    return this;
  }
  
  /**
   * Update scales
   * @private
   */
  updateScales() {
    if (this.config.data && this.config.data.length) {
      const { xField, yField } = this.options;
      
      // Extract X and Y values
      const xValues = this.config.data.map(d => d[xField]);
      const yValues = this.config.data.map(d => d[yField]);
      
      // Calculate domains
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      
      // Add some padding to Y domain
      const yPadding = (yMax - yMin) * 0.1 || 1;
      
      // Set domains
      this.state.scales.x.setDomain([xMin, xMax]);
      this.state.scales.y.setDomain([yMin - yPadding, yMax + yPadding]);
      
      // Set ranges based on dimensions
      this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
      this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
    }
  }
  
  /**
   * Update axes
   * @private
   */
  updateAxes() {
    if (this.state.axes.x) {
      this.state.axes.x.update();
    }
    
    if (this.state.axes.y) {
      this.state.axes.y.update();
    }
  }
  
  /**
   * Update chart data
   * @private
   */
  updateData() {
    // Remove existing data group
    const existingDataGroup = this.state.chart.querySelector('.visioncharts-data');
    if (existingDataGroup) {
      this.state.chart.removeChild(existingDataGroup);
    }
    
    // Re-render data
    this.renderData();
  }
}
import Chart from '../core/Chart.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
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
    // Call parent constructor with merged options
    super({
      ...config,
      options: {
        chartType: 'line',
        curve: 'linear', // 'linear', 'step', 'cardinal', 'monotone'
        showPoints: true,
        pointRadius: 3,
        xField: 'x',
        yField: 'y',
        xType: 'number', // 'number', 'time'
        yType: 'number',
        ...config.options
      }
    });
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    const { xType, yType, isLogarithmic } = this.options;
    
    // Create X scale
    this.state.scales.x = xType === 'time' ? 
      new TimeScale([0, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    // Create Y scale - use LogScale if isLogarithmic is true
    this.state.scales.y = isLogarithmic ? 
      new LogScale([0.1, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    // Update scales with actual data
    this.updateScales();
  }
  
  /**
   * Create axes for the chart
   * @private
   */
  createAxes() {
    // Create X axis
    this.state.axes.x = {
      render: (container, width, height) => {
        const { xType, xField } = this.options;
        const scale = this.state.scales.x;
        
        // Create axis group
        const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        axisGroup.setAttribute('class', 'visioncharts-x-axis');
        
        // Draw axis line
        const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axisLine.setAttribute('x1', 0);
        axisLine.setAttribute('y1', height);
        axisLine.setAttribute('x2', width);
        axisLine.setAttribute('y2', height);
        axisLine.setAttribute('stroke', '#ccc');
        axisLine.setAttribute('stroke-width', 1);
        axisGroup.appendChild(axisLine);
        
        // Generate ticks
        const tickCount = 5;
        const domain = scale.domain;
        
        // Create tick values based on domain
        let tickValues = [];
        
        if (xType === 'time') {
          // Time scale ticks
          const start = domain[0];
          const end = domain[1];
          const range = end - start;
          const timeStep = range / tickCount;
          
          for (let i = 0; i <= tickCount; i++) {
            tickValues.push(new Date(start.getTime() + timeStep * i));
          }
        } else {
          // Numeric scale ticks
          const start = domain[0];
          const end = domain[1];
          const step = (end - start) / tickCount;
          
          for (let i = 0; i <= tickCount; i++) {
            tickValues.push(start + step * i);
          }
        }
        
        // Draw ticks and labels
        tickValues.forEach(value => {
          const x = scale.scale(value);
          
          // Draw tick
          const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          tick.setAttribute('x1', x);
          tick.setAttribute('y1', height);
          tick.setAttribute('x2', x);
          tick.setAttribute('y2', height + 6);
          tick.setAttribute('stroke', '#ccc');
          tick.setAttribute('stroke-width', 1);
          axisGroup.appendChild(tick);
          
          // Format label text
          let labelText;
          if (xType === 'time') {
            labelText = value.toLocaleDateString();
          } else {
            labelText = value.toFixed(1);
          }
          
          // Draw label
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          label.setAttribute('x', x);
          label.setAttribute('y', height + 20);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('font-size', '12px');
          label.setAttribute('font-family', this.options.fontFamily);
          label.setAttribute('fill', this.options.textColor);
          axisGroup.appendChild(label);
          
          // Draw grid line if needed
          if (this.options.grid) {
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', 0);
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', height);
            gridLine.setAttribute('stroke', '#eee');
            gridLine.setAttribute('stroke-width', 1);
            gridLine.setAttribute('stroke-dasharray', '4,4');
            axisGroup.appendChild(gridLine);
          }
        });
        
        // Add to container
        container.appendChild(axisGroup);
        
        return axisGroup;
      }
    };
    
    // Create Y axis
    this.state.axes.y = {
      render: (container, width, height) => {
        const { yType, isLogarithmic } = this.options;
        const scale = this.state.scales.y;
        
        // Create axis group
        const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        axisGroup.setAttribute('class', 'visioncharts-y-axis');
        
        // Draw axis line
        const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axisLine.setAttribute('x1', 0);
        axisLine.setAttribute('y1', 0);
        axisLine.setAttribute('x2', 0);
        axisLine.setAttribute('y2', height);
        axisLine.setAttribute('stroke', '#ccc');
        axisLine.setAttribute('stroke-width', 1);
        axisGroup.appendChild(axisLine);
        
        // Generate ticks
        const tickCount = 5;
        const domain = scale.domain;
        
        // Create tick values based on domain and scale type
        let tickValues = [];
        
        if (isLogarithmic) {
          // Logarithmic scale ticks
          const minExp = Math.floor(Math.log10(domain[0]));
          const maxExp = Math.ceil(Math.log10(domain[1]));
          
          for (let exp = minExp; exp <= maxExp; exp++) {
            tickValues.push(Math.pow(10, exp));
          }
        } else {
          // Linear scale ticks
          const start = domain[0];
          const end = domain[1];
          const step = (end - start) / tickCount;
          
          for (let i = 0; i <= tickCount; i++) {
            tickValues.push(start + step * i);
          }
        }
        
        // Draw ticks and labels
        tickValues.forEach(value => {
          const y = scale.scale(value);
          
          // Skip if out of range
          if (y < 0 || y > height) return;
          
          // Draw tick
          const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          tick.setAttribute('x1', 0);
          tick.setAttribute('y1', y);
          tick.setAttribute('x2', -6);
          tick.setAttribute('y2', y);
          tick.setAttribute('stroke', '#ccc');
          tick.setAttribute('stroke-width', 1);
          axisGroup.appendChild(tick);
          
          // Format label text
          let labelText;
          if (yType === 'percent') {
            labelText = (value * 100).toFixed(0) + '%';
          } else if (yType === 'currency') {
            labelText = '$' + value.toFixed(2);
          } else {
            labelText = value.toFixed(isLogarithmic ? 0 : 1);
          }
          
          // Draw label
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          label.setAttribute('x', -10);
          label.setAttribute('y', y);
          label.setAttribute('text-anchor', 'end');
          label.setAttribute('dominant-baseline', 'middle');
          label.setAttribute('font-size', '12px');
          label.setAttribute('font-family', this.options.fontFamily);
          label.setAttribute('fill', this.options.textColor);
          axisGroup.appendChild(label);
          
          // Draw grid line if needed
          if (this.options.grid) {
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', 0);
            gridLine.setAttribute('y1', y);
            gridLine.setAttribute('x2', width);
            gridLine.setAttribute('y2', y);
            gridLine.setAttribute('stroke', '#eee');
            gridLine.setAttribute('stroke-width', 1);
            gridLine.setAttribute('stroke-dasharray', '4,4');
            axisGroup.appendChild(gridLine);
          }
        });
        
        // Add to container
        container.appendChild(axisGroup);
        
        return axisGroup;
      }
    };
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    const { xField, yField, isLogarithmic } = this.options;
    
    // Get all data points from all datasets
    const allPoints = this.state.datasets.reduce((acc, dataset) => {
      return acc.concat(dataset.data || []);
    }, []);
    
    if (!allPoints.length) {
      // Set default domain if no data
      this.state.scales.x.setDomain([0, 1]);
      this.state.scales.y.setDomain(isLogarithmic ? [0.1, 1] : [0, 1]);
      
      // Set ranges based on dimensions
      this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
      this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
      return;
    }
    
    // Extract X and Y values
    const xValues = allPoints.map(d => d[xField]);
    const yValues = allPoints.map(d => d[yField]);
    
    // Calculate domains
    let xMin, xMax, yMin, yMax;
    
    if (this.options.xType === 'time') {
      // For time type, convert string dates to Date objects
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      xMax = new Date(Math.max(...dates.map(d => d.getTime())));
    } else {
      xMin = Math.min(...xValues);
      xMax = Math.max(...xValues);
    }
    
    yMin = Math.min(...yValues);
    yMax = Math.max(...yValues);
    
    // Add some padding to Y domain
    const yPadding = (yMax - yMin) * 0.1;
    
    // For logarithmic scale, ensure minimum is positive
    if (isLogarithmic) {
      yMin = Math.max(yMin, 0.01); // Ensure minimum positive value
    }
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([
      isLogarithmic ? yMin : (yMin - yPadding),
      yMax + yPadding
    ]);
    
    // Set ranges based on dimensions
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
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
    const points = data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return '';
    
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
        return this.generateLinearPath(points);
    }
  }
  
  /**
   * Generate linear path
   * @private
   * @param {Array} points - Array of [x, y] coordinates
   * @returns {string} Path definition
   */
  generateLinearPath(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [
      `M ${firstX},${firstY}`,
      ...restPoints.map(([x, y]) => `L ${x},${y}`)
    ];
    
    return pathParts.join(' ');
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
    if (points.length < 2) return this.generateLinearPath(points);
    
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
      return this.generateLinearPath(points);
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
   * @private
   * @param {Array} points - Array of [x, y] coordinates
   * @returns {string} Path definition
   */
  generateMonotonePath(points) {
    if (points.length < 3) return this.generateLinearPath(points);
    
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
    const points = data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return '';
    
    // Baseline Y coordinate (bottom of chart)
    const baselineY = this.state.dimensions.innerHeight;
    
    // Get line path
    let linePath;
    switch (curve) {
      case 'step':
        linePath = this.generateStepPath(points);
        break;
      case 'cardinal':
        linePath = this.generateCardinalPath(points);
        break;
      case 'monotone':
        linePath = this.generateMonotonePath(points);
        break;
      case 'linear':
      default:
        linePath = this.generateLinearPath(points);
        break;
    }
    
    if (!linePath) return '';
    
    // Add area path
    const [firstPoint] = points;
    const [firstX] = firstPoint;
    
    const [lastPoint] = [...points].reverse();
    const [lastX] = lastPoint;
    
    return `${linePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
  }
  
  /**
   * Render chart data
   * @private
   */
  renderData() {
    if (!this.state.chart) return;
    
    const {
      xField,
      yField,
      showPoints,
      pointRadius,
      area
    } = this.options;
    
    // Create data group
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-data');
    
    // No data to render
    if (!this.state.datasets.length) {
      this.state.chart.appendChild(dataGroup);
      return;
    }
    
    // Render each dataset
    this.state.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      // Create dataset group
      const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
      
      // Render area if enabled
      if (area) {
        const areaPath = this.generateAreaPath(dataset.data);
        const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaElement.setAttribute('d', areaPath);
        areaElement.setAttribute('fill', dataset.color);
        areaElement.setAttribute('fill-opacity', 0.2);
        areaElement.setAttribute('stroke', 'none');
        areaElement.setAttribute('class', 'visioncharts-area');
        
        datasetGroup.appendChild(areaElement);
      }
      
      // Render line
      const linePath = this.generateLinePath(dataset.data);
      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lineElement.setAttribute('d', linePath);
      lineElement.setAttribute('stroke', dataset.color);
      lineElement.setAttribute('stroke-width', dataset.width);
      lineElement.setAttribute('fill', 'none');
      lineElement.setAttribute('class', 'visioncharts-line');
      
      datasetGroup.appendChild(lineElement);
      
      // Render points if enabled
      if (showPoints) {
        const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pointsGroup.setAttribute('class', 'visioncharts-points');
        
        dataset.data.forEach(d => {
          if (d[xField] === undefined || d[yField] === undefined) return;
          
          const x = this.state.scales.x.scale(d[xField]);
          const y = this.state.scales.y.scale(d[yField]);
          
          const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          point.setAttribute('cx', x);
          point.setAttribute('cy', y);
          point.setAttribute('r', pointRadius);
          point.setAttribute('fill', '#fff');
          point.setAttribute('stroke', dataset.color);
          point.setAttribute('stroke-width', dataset.width / 2);
          point.setAttribute('class', 'visioncharts-point');
          
          pointsGroup.appendChild(point);
        });
        
        datasetGroup.appendChild(pointsGroup);
      }
      
      // Add to data group
      dataGroup.appendChild(datasetGroup);
    });
    
    // Add data group to chart
    this.state.chart.appendChild(dataGroup);
  }
  
  /**
   * Render panels for multi-panel view
   * @private
   */
  renderPanels() {
    if (!this.state.chart) return;
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    // Determine number of panels (one per dataset)
    const panelCount = this.state.datasets.length;
    if (panelCount === 0) return;
    
    // Calculate panel dimensions
    const panelHeight = innerHeight / panelCount;
    const panelMargin = 20;
    const effectivePanelHeight = panelHeight - panelMargin;
    
    // Create panel for each dataset
    this.state.datasets.forEach((dataset, index) => {
      // Create panel group
      const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
      panelGroup.setAttribute('transform', `translate(0, ${index * panelHeight})`);
      
      // Create panel background
      const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      panelBg.setAttribute('x', 0);
      panelBg.setAttribute('y', 0);
      panelBg.setAttribute('width', innerWidth);
      panelBg.setAttribute('height', effectivePanelHeight);
      panelBg.setAttribute('fill', '#f9f9f9');
      panelBg.setAttribute('stroke', '#eee');
      panelGroup.appendChild(panelBg);
      
      // Create local scales for this panel
      const xScale = { ...this.state.scales.x };
      const yScale = this.options.isLogarithmic ? 
        new LogScale([0.1, 1], [0, 1]) :
        new LinearScale([0, 1], [0, 1]);
      
      // Update Y scale range to panel height
      yScale.setRange([effectivePanelHeight, 0]);
      
      // Calculate Y domain for this dataset
      const yValues = dataset.data.map(d => d[this.options.yField]);
      if (yValues.length) {
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const yPadding = (yMax - yMin) * 0.1;
        
        // Set domain based on scale type
        if (this.options.isLogarithmic) {
          yScale.setDomain([Math.max(yMin, 0.01), yMax + yPadding]);
        } else {
          yScale.setDomain([yMin - yPadding, yMax + yPadding]);
        }
      }
      
      // Render panel axes
      this.renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight);
      
      // Render panel data
      this.renderPanelData(panelGroup, dataset, xScale, yScale);
      
      // Render panel label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = dataset.name;
      label.setAttribute('x', 5);
      label.setAttribute('y', 15);
      label.setAttribute('font-size', '12px');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('fill', dataset.color);
      panelGroup.appendChild(label);
      
      // Add panel to chart
      this.state.chart.appendChild(panelGroup);
    });
  }
  
  /**
   * Render axes for a panel
   * @private
   */
  renderPanelAxes(panel, xScale, yScale, width, height) {
    // X-axis (simplified, only draw line)
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', 0);
    xAxis.setAttribute('y1', height);
    xAxis.setAttribute('x2', width);
    xAxis.setAttribute('y2', height);
    xAxis.setAttribute('stroke', '#ccc');
    xAxis.setAttribute('stroke-width', 1);
    panel.appendChild(xAxis);
    
    // Y-axis (simplified, only show a few ticks)
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', 0);
    yAxis.setAttribute('y1', 0);
    yAxis.setAttribute('x2', 0);
    yAxis.setAttribute('y2', height);
    yAxis.setAttribute('stroke', '#ccc');
    yAxis.setAttribute('stroke-width', 1);
    panel.appendChild(yAxis);
    
    // Y-axis ticks (only show min and max)
    const domain = yScale.domain;
    const tickValues = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
    
    tickValues.forEach(value => {
      const y = yScale.scale(value);
      
      // Skip if out of range
      if (y < 0 || y > height) return;
      
      // Format label text
      let labelText;
      if (this.options.yType === 'percent') {
        labelText = (value * 100).toFixed(0) + '%';
      } else if (this.options.yType === 'currency') {
        labelText = '$' + value.toFixed(2);
      } else {
        labelText = value.toFixed(this.options.isLogarithmic ? 0 : 1);
      }
      
      // Draw label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = labelText;
      label.setAttribute('x', 5);
      label.setAttribute('y', y);
      label.setAttribute('font-size', '10px');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('fill', '#666');
      panel.appendChild(label);
    });
  }
  
  /**
   * Render data for a panel
   * @private
   */
  renderPanelData(panel, dataset, xScale, yScale) {
    const { xField, yField, curve, showPoints, pointRadius } = this.options;
    
    if (!dataset.data || !dataset.data.length) return;
    
    // Map data points to coordinates using panel-specific scales
    const points = dataset.data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    // Generate line path based on curve type
    let pathD;
    switch (curve) {
      case 'step':
        pathD = this.generateStepPath(points);
        break;
      case 'cardinal':
        pathD = this.generateCardinalPath(points);
        break;
      case 'monotone':
        pathD = this.generateMonotonePath(points);
        break;
      case 'linear':
      default:
        pathD = this.generateLinearPath(points);
        break;
    }
    
    // Render line
    const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lineElement.setAttribute('d', pathD);
    lineElement.setAttribute('stroke', dataset.color);
    lineElement.setAttribute('stroke-width', dataset.width);
    lineElement.setAttribute('fill', 'none');
    lineElement.setAttribute('class', 'visioncharts-panel-line');
    panel.appendChild(lineElement);
    
    // Render points if enabled
    if (showPoints) {
      dataset.data.forEach(d => {
        if (d[xField] === undefined || d[yField] === undefined) return;
        
        const x = xScale.scale(d[xField]);
        const y = yScale.scale(d[yField]);
        
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        point.setAttribute('cx', x);
        point.setAttribute('cy', y);
        point.setAttribute('r', pointRadius);
        point.setAttribute('fill', '#fff');
        point.setAttribute('stroke', dataset.color);
        point.setAttribute('stroke-width', dataset.width / 2);
        point.setAttribute('class', 'visioncharts-panel-point');
        
        panel.appendChild(point);
      });
    }
  }
  
  /**
   * Process studies/indicators
   * @private
   */
  processStudies() {
    const { studies } = this.options;
    
    // Skip if no studies
    if (!studies || !studies.length) return;
    
    // Process each study
    studies.forEach(study => {
      // Find dataset to apply the study to
      const dataset = this.state.datasets.find(d => d.id === study.datasetId);
      if (!dataset || !dataset.data || !dataset.data.length) return;
      
      // Create study dataset
      let studyData;
      switch (study.type) {
        case 'sma':
          studyData = this.calculateSMA(dataset.data, study.params);
          break;
        case 'ema':
          studyData = this.calculateEMA(dataset.data, study.params);
          break;
        default:
          console.warn(`Unsupported study type: ${study.type}`);
          return;
      }
      
      // Add study dataset
      this.state.datasets.push({
        id: study.id,
        name: study.name || `${study.type.toUpperCase()}(${study.params?.period || 14})`,
        color: study.color || '#888',
        width: study.width || 1,
        type: 'line',
        data: studyData
      });
    });
  }
  
  /**
   * Calculate Simple Moving Average (SMA)
   * @private
   * @param {Array} data - Data array
   * @param {Object} params - SMA parameters
   * @returns {Array} Data with SMA values
   */
  calculateSMA(data, params = {}) {
    const { period = 14, valueField = 'y' } = params;
    const xField = this.options.xField;
    const result = [];
    
    // Calculate SMA
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j][valueField];
      }
      
      const sma = sum / period;
      
      // Create data point
      result.push({
        [xField]: data[i][xField],
        [valueField]: sma
      });
    }
    
    return result;
  }
  
  /**
   * Calculate Exponential Moving Average (EMA)
   * @private
   * @param {Array} data - Data array
   * @param {Object} params - EMA parameters
   * @returns {Array} Data with EMA values
   */
  calculateEMA(data, params = {}) {
    const { period = 14, valueField = 'y' } = params;
    const xField = this.options.xField;
    const result = [];
    
    // Calculate multiplier
    const multiplier = 2 / (period + 1);
    
    // Calculate EMA
    let ema = null;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        continue;
      }
      
      // For the first point, use SMA as the initial EMA
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j][valueField];
        }
        ema = sum / period;
      } else {
        // Calculate EMA using previous EMA
        const value = data[i][valueField];
        ema = (value - ema) * multiplier + ema;
      }
      
      // Create data point
      result.push({
        [xField]: data[i][xField],
        [valueField]: ema
      });
    }
    
    return result;
  }
  
  /**
   * Update axes
   * @private
   */
  updateAxes() {
    // Remove existing axes
    const xAxis = this.state.chart.querySelector('.visioncharts-x-axis');
    if (xAxis) {
      xAxis.parentNode.removeChild(xAxis);
    }
    
    const yAxis = this.state.chart.querySelector('.visioncharts-y-axis');
    if (yAxis) {
      yAxis.parentNode.removeChild(yAxis);
    }
    
    // Re-render axes
    this.renderAxes();
  }
  
  /**
   * Update chart data
   * @private
   */
  updateData() {
    // Remove existing data
    const dataGroup = this.state.chart.querySelector('.visioncharts-data');
    if (dataGroup) {
      dataGroup.parentNode.removeChild(dataGroup);
    }
    
    // Re-render data
    this.renderData();
  }
  
  /**
   * Toggle logarithmic scale
   * @public
   * @param {boolean} isLogarithmic - Whether to use logarithmic scale
   */
  toggleLogarithmic(isLogarithmic) {
    this.options.isLogarithmic = isLogarithmic;
    
    // Re-create Y scale based on type
    this.state.scales.y = isLogarithmic ? 
      new LogScale([0.1, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    return this.update();
  }
}
import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';

/**
 * LineChart class for rendering line charts with optional per-dataset area fills
 */
export default class LineChart extends Chart {
  constructor(config) {
    console.log('LineChart constructor called');

    const defaultLineChartOptions = {
      chartType: 'line',
      curve: 'linear',
      showPoints: false,
      pointRadius: 3,
      xField: 'x',
      yField: 'y',
      xType: 'number',
      yType: 'number',
      areaOpacity: 0.2,
      gradient: false,
      tickLabelFontSize: '13px',
      xFormatOptions: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      yFormatOptions: {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
  },
      grid: {
        show: true,
        color: '#e0e0e0',
        strokeWidth: 1,
        dashArray: '4,4'
      }
      // ... any other existing default options ...
    };

    // Merge options: user's config.options take precedence, with special handling for grid
    const mergedOptions = {
      ...defaultLineChartOptions,
      ...(config.options || {}), // Spread user's top-level options
      grid: { // Deep merge for the grid object
        ...defaultLineChartOptions.grid, // Start with LineChart's grid defaults
        ...((config.options && config.options.grid) || {}) // Override with user's grid options
      }
    };

    // Call parent constructor with the fully merged config
    super({
      ...config, // Pass through other parts of config like container, data
      options: mergedOptions // Use the carefully merged options
    });
    
    console.log('LineChart constructor finished with merged options:', this.options);
  }
  
  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    console.log('LineChart.createScales called');
    
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
    
    console.log('LineChart scales created');
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    console.log('LineChart.updateScales called');
    
    const { xField, yField, isLogarithmic } = this.options;
    
    // Get all data points from all datasets
    const allPoints = this.state.datasets.reduce((acc, dataset) => {
      return acc.concat(dataset.data || []);
    }, []);
    
    console.log('Collected data points:', allPoints.length);
    
    if (!allPoints.length) {
      // Set default domain if no data
      this.state.scales.x.setDomain([0, 1]);
      this.state.scales.y.setDomain(isLogarithmic ? [0.1, 1] : [0, 1]);
      
      // Set ranges based on dimensions
      this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
      this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
      console.log('No data points, using default domains');
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
    
    console.log('Scales updated with domains:', 
        'x:', [xMin, xMax],
        'y:', [isLogarithmic ? yMin : (yMin - yPadding), yMax + yPadding]);
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
   * Create gradient definitions for area fills
   * @private
   */
  createGradients() {
    // Create defs element if it doesn't exist
    let defs = this.state.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.state.svg.insertBefore(defs, this.state.svg.firstChild);
    }
    
    // Create gradient for each dataset that has area enabled
    this.state.datasets.forEach(dataset => {
      if (!dataset.area) return; // Skip if area is not enabled for this dataset
      
      const gradientId = `area-gradient-${dataset.id}`;
      
      // Check if gradient already exists
      if (defs.querySelector(`#${gradientId}`)) return;
      
      // Create linear gradient
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('x1', '0');
      gradient.setAttribute('y1', '0');
      gradient.setAttribute('x2', '0');
      gradient.setAttribute('y2', '1');
      
      // Create stops
      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', dataset.color);
      stop1.setAttribute('stop-opacity', '0.8');
      
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', dataset.color);
      stop2.setAttribute('stop-opacity', '0.1');
      
      // Add stops to gradient
      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      
      // Add gradient to defs
      defs.appendChild(gradient);
    });
  }
  
  /**
   * Render chart data - FIXED VERSION
   * @private
   */
  renderData() {
    console.log('LineChart.renderData called');
    
    if (!this.state.chart) {
      console.error('Cannot render data: chart element is null');
      return;
    }
    
    try {
      const {
        xField,
        yField,
        showPoints,
        pointRadius,
        areaOpacity,
        gradient
      } = this.options;
      
      // Create data group
      const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      dataGroup.setAttribute('class', 'visioncharts-data');
      
      // No data to render
      if (!this.state.datasets.length) {
        this.state.chart.appendChild(dataGroup);
        console.log('No datasets to render');
        return;
      }
      
      console.log('Rendering', this.state.datasets.length, 'datasets');
      
      // Create gradient definitions if needed
      if (gradient) {
        this.createGradients();
      }
      
      // Render each dataset
      this.state.datasets.forEach((dataset, index) => {
        if (!dataset.data || !dataset.data.length) {
          console.log('Dataset', index, 'has no data, skipping');
          return;
        }
        
        console.log('Rendering dataset', index, 'with', dataset.data.length, 'points', 
                   'area enabled:', Boolean(dataset.area));
        
        // Create dataset group
        const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
        
        // Render area if enabled for this dataset
        if (dataset.area) {
          const areaPath = this.generateAreaPath(dataset.data);
          const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          areaElement.setAttribute('d', areaPath);
          
          // Apply fill (either gradient or color)
          if (gradient) {
            const gradientId = `area-gradient-${dataset.id}`;
            areaElement.setAttribute('fill', `url(#${gradientId})`);
          } else {
            areaElement.setAttribute('fill', dataset.color);
            areaElement.setAttribute('fill-opacity', dataset.areaOpacity || areaOpacity);
          }
          
          areaElement.setAttribute('stroke', 'none');
          areaElement.setAttribute('class', 'visioncharts-area');
          
          datasetGroup.appendChild(areaElement);
        }
        
        // Render line - FIXED: Use correct scales
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
      console.log('Data rendered successfully');
    } catch (error) {
      console.error('Error rendering data:', error);
    }
  }
  
  /**
   * Render panels for multi-panel view
   * @private
   */
  renderPanels() {
    console.log('LineChart.renderPanels called');
    
    if (!this.state.chart) {
      console.error('Cannot render panels: chart element is null');
      return;
    }
    
    try {
      const { innerWidth, innerHeight } = this.state.dimensions;
      
      // Determine number of panels (one per dataset)
      const panelCount = this.state.datasets.length;
      if (panelCount === 0) {
        console.log('No datasets for panels');
        return;
      }
      
      console.log('Rendering', panelCount, 'panels');
      
      // Store panel scales for hover functionality
      this.state.panelScales = [];
      
      // Create panel for each dataset
      this.state.datasets.forEach((dataset, index) => {
        // Calculate panel dimensions
        const panelHeight = innerHeight / panelCount;
        const panelMargin = index === 0 ? 30 : 20;  // Extra margin for first panel
        const effectivePanelHeight = panelHeight - panelMargin;
        
        // Create panel group
        const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
        // Add top margin of 10px for the first panel
        const yPos = index * panelHeight + (index === 0 ? 20 : 0);
        panelGroup.setAttribute('transform', `translate(0, ${yPos})`);
        
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
        const { xField, yField, xType, isLogarithmic } = this.options;
        const xValues = dataset.data.map(d => d[xField]);
        const yValues = dataset.data.map(d => d[yField]);
        
        // Create X scale for this panel
        let xScale;
        if (xType === 'time') {
          // For time, handle date objects
          const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
          const xMin = new Date(Math.min(...dates.map(d => d.getTime())));
          const xMax = new Date(Math.max(...dates.map(d => d.getTime())));
          xScale = new TimeScale([xMin, xMax], [0, innerWidth]);
        } else {
          // For numeric data
          const xMin = Math.min(...xValues);
          const xMax = Math.max(...xValues);
          xScale = new LinearScale([xMin, xMax], [0, innerWidth]);
        }
        
        // Create Y scale for this panel
        let yScale;
        if (isLogarithmic) {
          yScale = new LogScale([0.1, 1], [effectivePanelHeight, 0]);
        } else {
          yScale = new LinearScale([0, 1], [effectivePanelHeight, 0]);
        }
        
        // Calculate Y domain for this dataset
        if (yValues.length) {
          const yMin = Math.min(...yValues);
          const yMax = Math.max(...yValues);
          const yPadding = (yMax - yMin) * 0.1;
          
          // Set domain based on scale type
          if (isLogarithmic) {
            yScale.setDomain([Math.max(0.01, yMin), yMax + yPadding]);
          } else {
            yScale.setDomain([yMin - yPadding, yMax + yPadding]);
          }
        }
        
        // Store scales for hover functionality
        this.state.panelScales[index] = { 
          xScale, 
          yScale, 
          panelHeight: effectivePanelHeight,
          panelWidth: innerWidth,
          yPos: yPos
        };
        
        // Render panel axes
        this.renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, index === this.state.datasets.length - 1);
        
        // Render zero line for this panel if enabled
        if (this.options.showZeroLine) {
          ZeroLine.renderForPanel(panelGroup, yScale, innerWidth, this.options.zeroLineOptions);
        }
        
        // Render recession lines for this panel if enabled
        if (this.options.showRecessionLines && this.options.recessions && this.options.recessions.length) {
          RecessionLines.renderForPanel(
            panelGroup, 
            this.options.recessions, 
            xScale, 
            effectivePanelHeight, 
            innerWidth,
            this.options.xType,
            this.options.recessionLinesOptions || {}
          );
        }
        
        // Render panel data
        this.renderPanelData(panelGroup, dataset, xScale, yScale, effectivePanelHeight);
        
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
      
      console.log('Panels rendered successfully');
    } catch (error) {
      console.error('Error rendering panels:', error);
    }
  }
  
  /**
   * Render data for a panel with area support
   * @private
   */
  renderPanelData(panel, dataset, xScale, yScale, panelHeight) {
    const { xField, yField, curve, showPoints, pointRadius, areaOpacity, gradient } = this.options;
    
    if (!dataset.data || !dataset.data.length) return;
    
    // Map data points to coordinates using panel-specific scales
    const points = dataset.data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    // Render area if enabled for this dataset
    if (dataset.area) {
      // Generate area path
      const baselineY = panelHeight;
      let areaPathD;
      
      switch (curve) {
        case 'step':
          areaPathD = this.generateStepPath(points);
          break;
        case 'cardinal':
          areaPathD = this.generateCardinalPath(points);
          break;
        case 'monotone':
          areaPathD = this.generateMonotonePath(points);
          break;
        case 'linear':
        default:
          areaPathD = this.generateLinearPath(points);
          break;
      }
      
      if (areaPathD) {
        // Complete area path
        const [firstPoint] = points;
        const [firstX] = firstPoint;
        const [lastPoint] = [...points].reverse();
        const [lastX] = lastPoint;
        
        const areaPath = `${areaPathD} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
        
        const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaElement.setAttribute('d', areaPath);
        
        // Apply fill (either gradient or color)
        if (gradient) {
          const gradientId = `area-gradient-panel-${dataset.id}`;
          areaElement.setAttribute('fill', `url(#${gradientId})`);
        } else {
          areaElement.setAttribute('fill', dataset.color);
          areaElement.setAttribute('fill-opacity', dataset.areaOpacity || areaOpacity);
        }
        
        areaElement.setAttribute('stroke', 'none');
        areaElement.setAttribute('class', 'visioncharts-panel-area');
        
        panel.appendChild(areaElement);
      }
    }
    
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
    console.log('LineChart.processStudies called');
    
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
        area: false, // Studies typically don't have area enabled by default
        data: studyData
      });
      
      console.log('Study added as dataset:', study.id);
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
 * Render axes for each panel in panel view
 * @param {SVGElement} panelGroup - Panel container
 * @param {Object} xScale - X scale for this panel
 * @param {Object} yScale - Y scale for this panel
 * @param {number} innerWidth - Panel width
 * @param {number} effectivePanelHeight - Panel height
 * @param {boolean} isLastPanel - Whether this is the last panel
 */
renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, isLastPanel = false) {
  console.log('renderPanelAxes called for panel, isLastPanel:', isLastPanel);
  
  // Render axes using the static Axis method
  Axis.renderForPanel(
    panelGroup, 
    xScale, 
    yScale, 
    innerWidth, 
    effectivePanelHeight,
    {
      // Axis configuration
      showXAxis: isLastPanel, // Only show X axis on bottom panel
      showYAxis: true,
      showXLabels: isLastPanel, // Only show X labels on bottom panel
      showYLabels: true,
      xAxisName: isLastPanel ? this.options.xAxisName : '',
      yAxisName: this.options.yAxisName,
      isLogarithmic: this.options.isLogarithmic || false,
      
      // Grid configuration
      grid: this.options.grid?.show || false,
      
      // Custom axis options
      xAxisOptions: {
        tickCount: this.options.xTickCount || 5,
        tickFormat: this.options.xTickFormat,
        formatType: this.options.xType === 'time' ? 'time' : 'number',
        formatOptions: this.options.xFormatOptions || {},
        grid: false, // Usually no grid for individual panels
        tickRotation: this.options.xTickRotation || 0
      },
      
      yAxisOptions: {
        tickCount: this.options.yTickCount || 4, // Fewer ticks for panels
        tickFormat: this.options.yTickFormat,
        formatType: 'number',
        formatOptions: this.options.yFormatOptions || {},
        grid: this.options.grid?.show || false,
        gridStyle: this.options.grid || {},
        tickRotation: this.options.yTickRotation || 0
      }
    }
  );
}

  /**
   * Create individual axes for single-panel mode (override parent method if needed)
   */
  createAxes() {
    console.log('createAxes called for LineChart/BarChart');
    
    // Call parent method
    super.createAxes();
    
    // Add any chart-type specific axis configuration
    if (this.state.components.axes?.x) {
      // LineChart/BarChart specific X-axis options
      this.state.components.axes.x.setOptions({
        tickCount: this.options.xTickCount || (this.options.xType === 'time' ? 6 : 5),
        formatType: this.options.xType === 'time' ? 'time' : 'number'
      });
    }
    
    if (this.state.components.axes?.y) {
      // LineChart/BarChart specific Y-axis options  
      this.state.components.axes.y.setOptions({
        tickCount: this.options.yTickCount || 5,
        isLogarithmic: this.options.isLogarithmic || false
      });
    }
  }
  
  /**
   * Update axes
   * @private
   */
  updateAxes() {
    console.log('LineChart.updateAxes called');
    
    // Print chart state for debugging
    console.log('Chart state:', {
      rendered: this.state.rendered,
      hasChart: Boolean(this.state.chart),
      chartClassName: this.state.chart ? this.state.chart.className : 'N/A'
    });
    
    // Safety check - don't try to update DOM elements that don't exist yet
    if (!this.state.rendered) {
      console.log('Chart not rendered yet, skipping updateAxes');
      return;
    }
    
    if (!this.state.chart) {
      console.error('Cannot update axes: chart element is null');
      return;
    }
    
    try {
      // Checking if chart is attached to DOM
      if (!this.state.chart.ownerDocument || !this.state.chart.parentNode) {
        console.error('Chart element is not attached to DOM');
        return;
      }
      
      console.log('Finding existing axes elements');
      
      // Look for existing axes with error handling
      let xAxis = null;
      let yAxis = null;
      
      try {
        xAxis = this.state.chart.querySelector('.visioncharts-x-axis');
        console.log('Found X axis:', Boolean(xAxis));
      } catch (error) {
        console.error('Error finding X axis:', error);
      }
      
      try {
        yAxis = this.state.chart.querySelector('.visioncharts-y-axis');
        console.log('Found Y axis:', Boolean(yAxis));
      } catch (error) {
        console.error('Error finding Y axis:', error);
      }
      
      // Remove existing axes if found
      if (xAxis) {
        try {
          xAxis.parentNode.removeChild(xAxis);
          console.log('Removed X axis');
        } catch (error) {
          console.error('Error removing X axis:', error);
        }
      }
      
      if (yAxis) {
        try {
          yAxis.parentNode.removeChild(yAxis);
          console.log('Removed Y axis');
        } catch (error) {
          console.error('Error removing Y axis:', error);
        }
      }
      
      // Re-render axes
      console.log('Re-rendering axes');
      this.renderAxes();
      
      console.log('Axes updated successfully');
    } catch (error) {
      console.error('Fatal error in updateAxes:', error);
    }
  }
  
  /**
   * Update chart data
   * @private
   */
  updateData() {
    console.log('LineChart.updateData called');
    
    if (!this.state.chart) {
      console.error('Cannot update data: chart element is null');
      return;
    }
    
    try {
      // Remove existing data
      const dataGroup = this.state.chart.querySelector('.visioncharts-data');
      if (dataGroup) {
        dataGroup.parentNode.removeChild(dataGroup);
        console.log('Removed existing data');
      } else {
        console.log('No existing data to remove');
      }
      
      // Re-render data
      this.renderData();
    } catch (error) {
      console.error('Error updating data:', error);
    }
  }
  
  /**
   * Toggle logarithmic scale
   * @public
   * @param {boolean} isLogarithmic - Whether to use logarithmic scale
   */
  toggleLogarithmic(isLogarithmic) {
    console.log('LineChart.toggleLogarithmic called:', isLogarithmic);
    
    this.options.isLogarithmic = isLogarithmic;
    
    // Re-create Y scale based on type
    this.state.scales.y = isLogarithmic ? 
      new LogScale([0.1, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    return this.update();
  }
  
  /**
   * Toggle area fill for a specific dataset
   * @public
   * @param {string} datasetId - Dataset ID
   * @param {boolean} showArea - Whether to show area fill
   * @returns {LineChart} This chart instance
   */
  toggleDatasetArea(datasetId, showArea) {
    console.log('LineChart.toggleDatasetArea called:', datasetId, showArea);
    
    // Find the dataset and update its area property
    const dataset = this.state.datasets.find(d => d.id === datasetId);
    if (dataset) {
      dataset.area = Boolean(showArea);
      
      // Update the chart
      return this.update();
    } else {
      console.warn('Dataset not found:', datasetId);
      return this;
    }
  }
  
  /**
   * Set area opacity for a specific dataset
   * @public
   * @param {string} datasetId - Dataset ID
   * @param {number} opacity - Opacity value (0-1)
   * @returns {LineChart} This chart instance
   */
  setDatasetAreaOpacity(datasetId, opacity) {
    console.log('LineChart.setDatasetAreaOpacity called:', datasetId, opacity);
    
    // Find the dataset and update its area opacity
    const dataset = this.state.datasets.find(d => d.id === datasetId);
    if (dataset) {
      dataset.areaOpacity = Math.max(0, Math.min(1, opacity));
      
      // Update the chart if area is enabled for this dataset
      if (dataset.area) {
        return this.update();
      }
    } else {
      console.warn('Dataset not found:', datasetId);
    }
    
    return this;
  }
  
  /**
   * Toggle gradient fill globally
   * @public
   * @param {boolean} gradient - Whether to use gradient fills
   * @returns {LineChart} This chart instance
   */
  toggleGradient(gradient) {
    console.log('LineChart.toggleGradient called:', gradient);
    
    this.options.gradient = gradient;
    return this.update();
  }
}
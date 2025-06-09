import Chart from '../core/Chart.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import RecessionLines from '../components/RecessionLines.js';
import { calculateAverage, calculateMedian } from '../utils/math.js'; // Added import

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
      grid: {
        show: true,
        color: '#e0e0e0',
        strokeWidth: 1,
        dashArray: '4,4'
      },
      showAverageLine: false,
      averageLineOptions: {
        color: 'rgba(255, 165, 0, 0.8)', // Orange
        strokeWidth: 1.5,
        dashArray: '8,4',
        label: 'Avg',
        labelColor: 'rgba(255, 165, 0, 1)',
        labelFontSize: '10px',
        labelOffsetX: 5,
        labelOffsetY: -4,
        labelAnchor: 'start' // 'start', 'middle', 'end'
      },
      showMedianLine: false,
      medianLineOptions: {
        color: 'rgba(128, 0, 128, 0.8)', // Purple
        strokeWidth: 1.5,
        dashArray: '3,3',
        label: 'Med',
        labelColor: 'rgba(128, 0, 128, 1)',
        labelFontSize: '10px',
        labelOffsetX: 5,
        labelOffsetY: 4, // Position below the line
        labelAnchor: 'start'
      },
      showStatisticalLineLabels: true,
      //any other defaults we want to set
    };

    // Merge options: user's config.options take precedence, with special handling for grid
    const mergedOptions = {
      ...defaultLineChartOptions,
      ...(config.options || {}), // Spread user's top-level options
      grid: { // Deep merge for the grid object
        ...defaultLineChartOptions.grid, 
        ...((config.options && config.options.grid) || {}) 
      },
      averageLineOptions: {
        ...defaultLineChartOptions.averageLineOptions,
        ...((config.options && config.options.averageLineOptions) || {})
      },
      medianLineOptions: {
        ...defaultLineChartOptions.medianLineOptions,
        ...((config.options && config.options.medianLineOptions) || {})
      }
    };

    // Call parent constructor with the fully merged config
    super({
      ...config, 
      options: mergedOptions 
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
   * Create axes for the chart
   * @private
   */
  createAxes() {
    console.log('LineChart.createAxes called');
    const { xType, yType, isLogarithmic, dateFormat, skipLabels, fontFamily, textColor, tickLabelFontSize } = this.options; // Added tickLabelFontSize
    const { innerWidth, innerHeight } = this.state.dimensions;

    // Create X axis
    this.state.axes.x = {
      render: (container, width, height) => {
        const scale = this.state.scales.x;
        
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
        const tickCount = Math.min(5, Math.floor(width / 100)); // Reduce tick count on small screens
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
        
        // Calculate if labels need rotation (always rotate if width is small)
        const needsRotation = tickValues.length > 3 || width < 500;
        
        // Draw ticks and labels
        tickValues.forEach((value, index) => {
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
            // Use more compact date format
            if (width < 400) {
              labelText = value.toLocaleDateString(undefined, {month: 'short'});
            } else {
              labelText = value.toLocaleDateString();
            }
          } else {
            labelText = value.toFixed(1);
          }
          
          // Draw label with rotation if needed
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          
          if (needsRotation) {
            // For rotated labels, position them further below
            label.setAttribute('x', x);
            label.setAttribute('y', height + 18); // Increased space for rotated labels
            label.setAttribute('transform', `rotate(-45, ${x}, ${height + 18})`);
            label.setAttribute('text-anchor', 'end');
          } else {
            label.setAttribute('x', x);
            label.setAttribute('y', height + 24); // Increased from 20 to 24
            label.setAttribute('text-anchor', 'middle');
          }
          
          // Skip labels if they would overlap
          // Simple solution: only show every nth label if space is tight
          if (width < 400 && index % 2 === 1 && tickValues.length > 5) {
            // Skip every other label on small screens for X-axis
          } else {
            label.setAttribute('font-size', tickLabelFontSize); // Use new option
            label.setAttribute('font-family', fontFamily);
            label.setAttribute('fill', textColor);
            axisGroup.appendChild(label);
          }
          
          // Draw grid line if needed
          if (this.options.grid && this.options.grid.show) {
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', x);
            gridLine.setAttribute('y1', 0); // Top of the plotting area
            gridLine.setAttribute('x2', x);
            gridLine.setAttribute('y2', height); // Bottom of the plotting area
            gridLine.setAttribute('stroke', this.options.grid.color);
            gridLine.setAttribute('stroke-width', this.options.grid.strokeWidth);
            if (this.options.grid.dashArray) {
              gridLine.setAttribute('stroke-dasharray', this.options.grid.dashArray);
            }
            gridLine.setAttribute('class', 'visioncharts-grid-line visioncharts-grid-line-x');
            // Prepend gridLine to axisGroup so it's drawn behind ticks/labels
            if (axisGroup.firstChild) {
              axisGroup.insertBefore(gridLine, axisGroup.firstChild);
            } else {
              axisGroup.appendChild(gridLine);
            }
          }
        });
        
        container.appendChild(axisGroup);
        return axisGroup;
      }
    };
    
    // Create Y axis
    this.state.axes.y = {
      render: (container, width, height) => {
        const scale = this.state.scales.y;
        
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
        tickValues.forEach((value, index) => {
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
          if (this.options.grid && this.options.grid.show) {
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', 0); // Left of the plotting area
            gridLine.setAttribute('y1', y);
            gridLine.setAttribute('x2', width); // Right of the plotting area
            gridLine.setAttribute('y2', y);
            gridLine.setAttribute('stroke', this.options.grid.color);
            gridLine.setAttribute('stroke-width', this.options.grid.strokeWidth);
            if (this.options.grid.dashArray) {
              gridLine.setAttribute('stroke-dasharray', this.options.grid.dashArray);
            }
            gridLine.setAttribute('class', 'visioncharts-grid-line visioncharts-grid-line-y');
            // Prepend gridLine to axisGroup so it's drawn behind ticks/labels
            if (axisGroup.firstChild) {
              axisGroup.insertBefore(gridLine, axisGroup.firstChild);
            } else {
              axisGroup.appendChild(gridLine);
            }
          }
        });
        
        container.appendChild(axisGroup);
        return axisGroup;
      }
    };
    console.log('LineChart axes creation setup complete');
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
   * Render axes
   * @private
   */
  renderAxes() {
    console.log('LineChart.renderAxes called');
    
    try {
      if (!this.state.chart) {
        console.error('Cannot render axes: chart element is null');
        return;
      }
      
      const { innerWidth, innerHeight } = this.state.dimensions;
      
      // Render X axis
      if (this.state.axes.x && this.state.axes.x.render) {
        this.state.axes.x.render(this.state.chart, innerWidth, innerHeight);
      }
      
      // Render Y axis
      if (this.state.axes.y && this.state.axes.y.render) {
        this.state.axes.y.render(this.state.chart, innerWidth, innerHeight);
      }
      
      console.log('Axes rendered successfully');
    } catch (error) {
      console.error('Error rendering axes:', error);
    }
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
   * Render recession lines for a panel
   * @private
   */
  renderPanelRecessionLines(panel, xScale, panelHeight) {
    if (!this.options.showRecessionLines || !this.options.recessions || !this.options.recessions.length) {
      return;
    }
    
    // Create a temporary recession lines component for this panel
    const panelRecessionLines = new RecessionLines(this.options.recessionLinesOptions || {});
    
    // Render recession lines into the panel
    panelRecessionLines.render(panel, this.options.recessions, xScale, panelHeight);
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
   * Render or update statistical lines (average, median)
   * @private
   * @param {SVGElement} container - The SVG group to append lines to.
   * @param {Scale} yScale - The Y-axis scale.
   * @param {number} width - The width for the horizontal lines.
   * @param {Array} datasetsToConsider - Datasets for calculation.
   * @param {Object} options - Chart options.
   */
  renderOrUpdateStatisticalLines(container, yScale, width, datasetsToConsider, options) {
    // Remove previously drawn stat lines from this container
    container.querySelectorAll('.visioncharts-stat-line, .visioncharts-stat-label').forEach(el => el.remove());

    const allYValues = datasetsToConsider.reduce((acc, ds) => {
        (ds.data || []).forEach(d => {
            const val = d[options.yField];
            if (typeof val === 'number' && !isNaN(val)) {
                acc.push(val);
            }
        });
        return acc;
    }, []);

    if (allYValues.length === 0) return;

    const drawLineAndLabel = (value, lineOpts, statClassSuffix) => {
        if (isNaN(value)) return;

        const yPos = yScale.scale(value);
        
        // Check if yPos is within the visible range of the y-axis
        const yRange = yScale.range; // [maxPixel, minPixel]
        if (yPos < Math.min(yRange[0], yRange[1]) || yPos > Math.max(yRange[0], yRange[1])) {
            return; // Value is outside the visible pixel range
        }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', yPos);
        line.setAttribute('x2', width);
        line.setAttribute('y2', yPos);
        line.setAttribute('stroke', lineOpts.color);
        line.setAttribute('stroke-width', lineOpts.strokeWidth);
        if (lineOpts.dashArray) {
            line.setAttribute('stroke-dasharray', lineOpts.dashArray);
        }
        line.setAttribute('class', `visioncharts-stat-line visioncharts-${statClassSuffix}-line`);
        container.appendChild(line);

        if (options.showStatisticalLineLabels && lineOpts.label) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.textContent = `${lineOpts.label}: ${value.toFixed(2)}`; // Display value as well
            
            let labelXPosition = lineOpts.labelOffsetX || 0;
            if (lineOpts.labelAnchor === 'end') {
                labelXPosition = width + (lineOpts.labelOffsetX || 0); // If anchor is end, offset from width
            } else if (lineOpts.labelAnchor === 'middle') {
                labelXPosition = width / 2 + (lineOpts.labelOffsetX || 0);
            }

            label.setAttribute('x', labelXPosition);
            label.setAttribute('y', yPos + (lineOpts.labelOffsetY || 0));
            label.setAttribute('fill', lineOpts.labelColor || lineOpts.color);
            label.setAttribute('font-size', lineOpts.labelFontSize || '10px');
            label.setAttribute('text-anchor', lineOpts.labelAnchor || 'start');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('class', `visioncharts-stat-label visioncharts-${statClassSuffix}-label`);
            container.appendChild(label);
        }
    };

    // Average Line
    if (options.showAverageLine) {
        const avgValue = calculateAverage(allYValues);
        drawLineAndLabel(avgValue, options.averageLineOptions, 'avg');
    }

    // Median Line
    if (options.showMedianLine) {
        const medValue = calculateMedian(allYValues);
        drawLineAndLabel(medValue, options.medianLineOptions, 'median');
    }
  }

  /**
   * Render chart data
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
      
      // No data to render (datasets)
      if (!this.state.datasets.length) {
        this.state.chart.appendChild(dataGroup); // Append empty group
        console.log('No datasets to render');
        // Still render statistical lines if applicable with no data (they won't show)
        if (!this.options.isPanelView) {
            let globalStatGroup = this.state.chart.querySelector('.visioncharts-global-statistical-lines');
            if (!globalStatGroup) {
                globalStatGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                globalStatGroup.setAttribute('class', 'visioncharts-global-statistical-lines');
                this.state.chart.appendChild(globalStatGroup);
            }
            this.renderOrUpdateStatisticalLines(
                globalStatGroup, this.state.scales.y, this.state.dimensions.innerWidth, [], this.options
            );
        }
        return;
      }
      
      console.log('Rendering', this.state.datasets.length, 'datasets');
      
      if (gradient) {
        this.createGradients();
      }
      
      this.state.datasets.forEach((dataset, index) => {
        if (!dataset.data || !dataset.data.length) {
          console.log('Dataset', index, 'has no data, skipping');
          return;
        }
        
        console.log('Rendering dataset', index, 'with', dataset.data.length, 'points', 
                   'area enabled:', Boolean(dataset.area));
        
        const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
        
        if (dataset.area) {
          const areaPath = this.generateAreaPath(dataset.data);
          const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          areaElement.setAttribute('d', areaPath);
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
        
        const linePath = this.generateLinePath(dataset.data);
        const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        lineElement.setAttribute('d', linePath);
        lineElement.setAttribute('stroke', dataset.color);
        lineElement.setAttribute('stroke-width', dataset.width);
        lineElement.setAttribute('fill', 'none');
        lineElement.setAttribute('class', 'visioncharts-line');
        datasetGroup.appendChild(lineElement);
        
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
            point.setAttribute('stroke-width', dataset.width / 2); // Or a fixed value like 1 or 1.5
            point.setAttribute('class', 'visioncharts-point');
            pointsGroup.appendChild(point);
          });
          datasetGroup.appendChild(pointsGroup);
        }
        dataGroup.appendChild(datasetGroup);
      });
      
      this.state.chart.appendChild(dataGroup);

      // Render global statistical lines if not in panel view
      if (!this.options.isPanelView) {
        let globalStatGroup = this.state.chart.querySelector('.visioncharts-global-statistical-lines');
        if (!globalStatGroup) {
            globalStatGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            globalStatGroup.setAttribute('class', 'visioncharts-global-statistical-lines');
            this.state.chart.appendChild(globalStatGroup);
        }
        this.renderOrUpdateStatisticalLines(
            globalStatGroup,
            this.state.scales.y,
            this.state.dimensions.innerWidth,
            this.state.datasets, // All datasets for global calculation
            this.options
        );
      }
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
      const panelCount = this.state.datasets.length;
      if (panelCount === 0) {
        console.log('No datasets for panels');
        return;
      }
      
      console.log('Rendering', panelCount, 'panels');

      let defs = this.state.svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        this.state.svg.insertBefore(defs, this.state.svg.firstChild);
      }
      
      this.state.datasets.forEach((dataset, index) => {
        const panelHeight = innerHeight / panelCount;
        const panelMargin = index === 0 ? 30 : 20;
        const effectivePanelHeight = panelHeight - panelMargin;
        
        const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
        const yPos = index * panelHeight + (index === 0 ? 20 : 0);
        panelGroup.setAttribute('transform', `translate(0, ${yPos})`);

        const clipPathId = `panel-clip-${dataset.id || index}`;
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipPathId);
        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', 0);
        clipRect.setAttribute('y', 0);
        clipRect.setAttribute('width', innerWidth);
        clipRect.setAttribute('height', effectivePanelHeight);
        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);
        panelGroup.setAttribute('clip-path', `url(#${clipPathId})`);
        
        const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelBg.setAttribute('x', 0);
        panelBg.setAttribute('y', 0);
        panelBg.setAttribute('width', innerWidth);
        panelBg.setAttribute('height', effectivePanelHeight);
        panelBg.setAttribute('fill', '#f9f9f9');
        panelBg.setAttribute('stroke', '#eee');
        panelGroup.appendChild(panelBg);
        
        let xScalePanel;
        const { xField, xType, isLogarithmic: isYLogarithmic } = this.options; // Renamed for clarity
        const xValues = dataset.data.map(d => d[xField]);
        let xMinPanel, xMaxPanel;

        if (xType === 'time') {
          const dates = xValues.map(x => x instanceof Date ? x : new Date(x)).filter(d => !isNaN(d.getTime()));
          if (dates.length > 0) {
            xMinPanel = new Date(Math.min(...dates.map(d => d.getTime())));
            xMaxPanel = new Date(Math.max(...dates.map(d => d.getTime())));
          } else { // Default if no valid dates
            xMinPanel = new Date();
            xMaxPanel = new Date(xMinPanel.getTime() + 86400000); // 1 day range
          }
        } else {
          const numericXValues = xValues.filter(v => typeof v === 'number' && !isNaN(v));
          if (numericXValues.length > 0) {
            xMinPanel = Math.min(...numericXValues);
            xMaxPanel = Math.max(...numericXValues);
          } else { // Default if no valid numbers
             xMinPanel = 0;
             xMaxPanel = 1;
          }
        }
         if (xMinPanel === xMaxPanel) { // Handle single data point for X
            if (xType === 'time') xMaxPanel = new Date(xMinPanel.getTime() + 86400000);
            else xMaxPanel = xMinPanel + 1;
        }


        if (xType === 'time') {
          xScalePanel = new TimeScale([xMinPanel, xMaxPanel], [0, innerWidth]);
        } else { // Assuming numeric, log scale for X is not typical for line chart panels here
          xScalePanel = new LinearScale([xMinPanel, xMaxPanel], [0, innerWidth]);
        }
        
        let yScalePanel;
        if (isYLogarithmic) { // Use the chart-wide isLogarithmic for Y-axis of panel
          yScalePanel = new LogScale([0.1, 1], [effectivePanelHeight, 0]);
        } else {
          yScalePanel = new LinearScale([0, 1], [effectivePanelHeight, 0]);
        }
        
        const yValues = dataset.data.map(d => d[this.options.yField]).filter(v => typeof v === 'number' && !isNaN(v));
        if (yValues.length) {
          let yMinDataset = Math.min(...yValues);
          let yMaxDataset = Math.max(...yValues);
          
          if (yMinDataset === yMaxDataset) { // Handle single Y value or all same Y values
             yMinDataset -= (yMinDataset === 0 ? 0.5 : Math.abs(yMinDataset * 0.1) || 0.5);
             yMaxDataset += (yMaxDataset === 0 ? 0.5 : Math.abs(yMaxDataset * 0.1) || 0.5);
          }
          const yPadding = (yMaxDataset - yMinDataset) * 0.1;

          if (isYLogarithmic) {
            yScalePanel.setDomain([Math.max(yMinDataset > 0 ? yMinDataset : 0.01, 0.01), yMaxDataset + yPadding]);
          } else {
            yScalePanel.setDomain([yMinDataset - yPadding, yMaxDataset + yPadding]);
          }
        } else { // Default Y domain if no data
            yScalePanel.setDomain(isYLogarithmic ? [0.1,1] : [0,1]);
        }
        
        this.renderPanelAxes(panelGroup, xScalePanel, yScalePanel, innerWidth, effectivePanelHeight);
        this.renderPanelData(panelGroup, dataset, xScalePanel, yScalePanel, effectivePanelHeight);
        this.renderPanelRecessionLines(panelGroup, xScalePanel, effectivePanelHeight);

        // Add statistical lines for this panel
        this.renderOrUpdateStatisticalLines(
            panelGroup, // Lines are added directly to the panel group
            yScalePanel,     // Panel's Y scale
            innerWidth, // Panel's width
            [dataset],  // Only this panel's dataset for calculation
            this.options
        );
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.textContent = dataset.name;
        label.setAttribute('x', 5);
        label.setAttribute('y', 15);
        label.setAttribute('font-size', '12px');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('fill', dataset.color);
        panelGroup.appendChild(label);
        
        this.state.chart.appendChild(panelGroup);
      });
      
      console.log('Panels rendered successfully');
    } catch (error) {
      console.error('Error rendering panels:', error);
    }
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
   * Render axes
   * @private
   */
  renderAxes() {
    console.log('LineChart.renderAxes called');
    
    try {
      if (!this.state.chart) {
        console.error('Cannot render axes: chart element is null');
        return;
      }
      
      const { innerWidth, innerHeight } = this.state.dimensions;
      
      // Render X axis
      if (this.state.axes.x && this.state.axes.x.render) {
        this.state.axes.x.render(this.state.chart, innerWidth, innerHeight);
      }
      
      // Render Y axis
      if (this.state.axes.y && this.state.axes.y.render) {
        this.state.axes.y.render(this.state.chart, innerWidth, innerHeight);
      }
      
      console.log('Axes rendered successfully');
    } catch (error) {
      console.error('Error rendering axes:', error);
    }
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
   * Render recession lines for a panel
   * @private
   */
  renderPanelRecessionLines(panel, xScale, panelHeight) {
    if (!this.options.showRecessionLines || !this.options.recessions || !this.options.recessions.length) {
      return;
    }
    
    // Create a temporary recession lines component for this panel
    const panelRecessionLines = new RecessionLines(this.options.recessionLinesOptions || {});
    
    // Render recession lines into the panel
    panelRecessionLines.render(panel, this.options.recessions, xScale, panelHeight);
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
   * Render or update statistical lines (average, median)
   * @private
   * @param {SVGElement} container - The SVG group to append lines to.
   * @param {Scale} yScale - The Y-axis scale.
   * @param {number} width - The width for the horizontal lines.
   * @param {Array} datasetsToConsider - Datasets for calculation.
   * @param {Object} options - Chart options.
   */
  renderOrUpdateStatisticalLines(container, yScale, width, datasetsToConsider, options) {
    // Remove previously drawn stat lines from this container
    container.querySelectorAll('.visioncharts-stat-line, .visioncharts-stat-label').forEach(el => el.remove());

    const allYValues = datasetsToConsider.reduce((acc, ds) => {
        (ds.data || []).forEach(d => {
            const val = d[options.yField];
            if (typeof val === 'number' && !isNaN(val)) {
                acc.push(val);
            }
        });
        return acc;
    }, []);

    if (allYValues.length === 0) return;

    const drawLineAndLabel = (value, lineOpts, statClassSuffix) => {
        if (isNaN(value)) return;

        const yPos = yScale.scale(value);
        
        // Check if yPos is within the visible range of the y-axis
        const yRange = yScale.range; // [maxPixel, minPixel]
        if (yPos < Math.min(yRange[0], yRange[1]) || yPos > Math.max(yRange[0], yRange[1])) {
            return; // Value is outside the visible pixel range
        }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', yPos);
        line.setAttribute('x2', width);
        line.setAttribute('y2', yPos);
        line.setAttribute('stroke', lineOpts.color);
        line.setAttribute('stroke-width', lineOpts.strokeWidth);
        if (lineOpts.dashArray) {
            line.setAttribute('stroke-dasharray', lineOpts.dashArray);
        }
        line.setAttribute('class', `visioncharts-stat-line visioncharts-${statClassSuffix}-line`);
        container.appendChild(line);

        if (options.showStatisticalLineLabels && lineOpts.label) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.textContent = `${lineOpts.label}: ${value.toFixed(2)}`; // Display value as well
            
            let labelXPosition = lineOpts.labelOffsetX || 0;
            if (lineOpts.labelAnchor === 'end') {
                labelXPosition = width + (lineOpts.labelOffsetX || 0); // If anchor is end, offset from width
            } else if (lineOpts.labelAnchor === 'middle') {
                labelXPosition = width / 2 + (lineOpts.labelOffsetX || 0);
            }

            label.setAttribute('x', labelXPosition);
            label.setAttribute('y', yPos + (lineOpts.labelOffsetY || 0));
            label.setAttribute('fill', lineOpts.labelColor || lineOpts.color);
            label.setAttribute('font-size', lineOpts.labelFontSize || '10px');
            label.setAttribute('text-anchor', lineOpts.labelAnchor || 'start');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('class', `visioncharts-stat-label visioncharts-${statClassSuffix}-label`);
            container.appendChild(label);
        }
    };

    // Average Line
    if (options.showAverageLine) {
        const avgValue = calculateAverage(allYValues);
        drawLineAndLabel(avgValue, options.averageLineOptions, 'avg');
    }

    // Median Line
    if (options.showMedianLine) {
        const medValue = calculateMedian(allYValues);
        drawLineAndLabel(medValue, options.medianLineOptions, 'median');
    }
  }

  /**
   * Render chart data
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
      
      // No data to render (datasets)
      if (!this.state.datasets.length) {
        this.state.chart.appendChild(dataGroup); // Append empty group
        console.log('No datasets to render');
        // Still render statistical lines if applicable with no data (they won't show)
        if (!this.options.isPanelView) {
            let globalStatGroup = this.state.chart.querySelector('.visioncharts-global-statistical-lines');
            if (!globalStatGroup) {
                globalStatGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                globalStatGroup.setAttribute('class', 'visioncharts-global-statistical-lines');
                this.state.chart.appendChild(globalStatGroup);
            }
            this.renderOrUpdateStatisticalLines(
                globalStatGroup, this.state.scales.y, this.state.dimensions.innerWidth, [], this.options
            );
        }
        return;
      }
      
      console.log('Rendering', this.state.datasets.length, 'datasets');
      
      if (gradient) {
        this.createGradients();
      }
      
      this.state.datasets.forEach((dataset, index) => {
        if (!dataset.data || !dataset.data.length) {
          console.log('Dataset', index, 'has no data, skipping');
          return;
        }
        
        console.log('Rendering dataset', index, 'with', dataset.data.length, 'points', 
                   'area enabled:', Boolean(dataset.area));
        
        const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
        
        if (dataset.area) {
          const areaPath = this.generateAreaPath(dataset.data);
          const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          areaElement.setAttribute('d', areaPath);
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
        
        const linePath = this.generateLinePath(dataset.data);
        const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        lineElement.setAttribute('d', linePath);
        lineElement.setAttribute('stroke', dataset.color);
        lineElement.setAttribute('stroke-width', dataset.width);
        lineElement.setAttribute('fill', 'none');
        lineElement.setAttribute('class', 'visioncharts-line');
        datasetGroup.appendChild(lineElement);
        
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
            point.setAttribute('stroke-width', dataset.width / 2); // Or a fixed value like 1 or 1.5
            point.setAttribute('class', 'visioncharts-point');
            pointsGroup.appendChild(point);
          });
          datasetGroup.appendChild(pointsGroup);
        }
        dataGroup.appendChild(datasetGroup);
      });
      
      this.state.chart.appendChild(dataGroup);

      // Render global statistical lines if not in panel view
      if (!this.options.isPanelView) {
        let globalStatGroup = this.state.chart.querySelector('.visioncharts-global-statistical-lines');
        if (!globalStatGroup) {
            globalStatGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            globalStatGroup.setAttribute('class', 'visioncharts-global-statistical-lines');
            this.state.chart.appendChild(globalStatGroup);
        }
        this.renderOrUpdateStatisticalLines(
            globalStatGroup,
            this.state.scales.y,
            this.state.dimensions.innerWidth,
            this.state.datasets, // All datasets for global calculation
            this.options
        );
      }
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
      const panelCount = this.state.datasets.length;
      if (panelCount === 0) {
        console.log('No datasets for panels');
        return;
      }
      
      console.log('Rendering', panelCount, 'panels');

      let defs = this.state.svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        this.state.svg.insertBefore(defs, this.state.svg.firstChild);
      }
      
      this.state.datasets.forEach((dataset, index) => {
        const panelHeight = innerHeight / panelCount;
        const panelMargin = index === 0 ? 30 : 20;
        const effectivePanelHeight = panelHeight - panelMargin;
        
        const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
        const yPos = index * panelHeight + (index === 0 ? 20 : 0);
        panelGroup.setAttribute('transform', `translate(0, ${yPos})`);

        const clipPathId = `panel-clip-${dataset.id || index}`;
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipPathId);
        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', 0);
        clipRect.setAttribute('y', 0);
        clipRect.setAttribute('width', innerWidth);
        clipRect.setAttribute('height', effectivePanelHeight);
        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);
        panelGroup.setAttribute('clip-path', `url(#${clipPathId})`);
        
        const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelBg.setAttribute('x', 0);
        panelBg.setAttribute('y', 0);
        panelBg.setAttribute('width', innerWidth);
        panelBg.setAttribute('height', effectivePanelHeight);
        panelBg.setAttribute('fill', '#f9f9f9');
        panelBg.setAttribute('stroke', '#eee');
        panelGroup.appendChild(panelBg);
        
        let xScalePanel;
        const { xField, xType, isLogarithmic: isYLogarithmic } = this.options; // Renamed for clarity
        const xValues = dataset.data.map(d => d[xField]);
        let xMinPanel, xMaxPanel;

        if (xType === 'time') {
          const dates = xValues.map(x => x instanceof Date ? x : new Date(x)).filter(d => !isNaN(d.getTime()));
          if (dates.length > 0) {
            xMinPanel = new Date(Math.min(...dates.map(d => d.getTime())));
            xMaxPanel = new Date(Math.max(...dates.map(d => d.getTime())));
          } else { // Default if no valid dates
            xMinPanel = new Date();
            xMaxPanel = new Date(xMinPanel.getTime() + 86400000); // 1 day range
          }
        } else {
          const numericXValues = xValues.filter(v => typeof v === 'number' && !isNaN(v));
          if (numericXValues.length > 0) {
            xMinPanel = Math.min(...numericXValues);
            xMaxPanel = Math.max(...numericXValues);
          } else { // Default if no valid numbers
             xMinPanel = 0;
             xMaxPanel = 1;
          }
        }
         if (xMinPanel === xMaxPanel) { // Handle single data point for X
            if (xType === 'time') xMaxPanel = new Date(xMinPanel.getTime() + 86400000);
            else xMaxPanel = xMinPanel + 1;
        }


        if (xType === 'time') {
          xScalePanel = new TimeScale([xMinPanel, xMaxPanel], [0, innerWidth]);
        } else { // Assuming numeric, log scale for X is not typical for line chart panels here
          xScalePanel = new LinearScale([xMinPanel, xMaxPanel], [0, innerWidth]);
        }
        
        let yScalePanel;
        if (isYLogarithmic) { // Use the chart-wide isLogarithmic for Y-axis of panel
          yScalePanel = new LogScale([0.1, 1], [effectivePanelHeight, 0]);
        } else {
          yScalePanel = new LinearScale([0, 1], [effectivePanelHeight, 0]);
        }
        
        const yValues = dataset.data.map(d => d[this.options.yField]).filter(v => typeof v === 'number' && !isNaN(v));
        if (yValues.length) {
          let yMinDataset = Math.min(...yValues);
          let yMaxDataset = Math.max(...yValues);
          
          if (yMinDataset === yMaxDataset) { // Handle single Y value or all same Y values
             yMinDataset -= (yMinDataset === 0 ? 0.5 : Math.abs(yMinDataset * 0.1) || 0.5);
             yMaxDataset += (yMaxDataset === 0 ? 0.5 : Math.abs(yMaxDataset * 0.1) || 0.5);
          }
          const yPadding = (yMaxDataset - yMinDataset) * 0.1;

          if (isYLogarithmic) {
            yScalePanel.setDomain([Math.max(yMinDataset > 0 ? yMinDataset : 0.01, 0.01), yMaxDataset + yPadding]);
          } else {
            yScalePanel.setDomain([yMinDataset - yPadding, yMaxDataset + yPadding]);
          }
        } else { // Default Y domain if no data
            yScalePanel.setDomain(isYLogarithmic ? [0.1,1] : [0,1]);
        }
        
        this.renderPanelAxes(panelGroup, xScalePanel, yScalePanel, innerWidth, effectivePanelHeight);
        this.renderPanelData(panelGroup, dataset, xScalePanel, yScalePanel, effectivePanelHeight);
        this.renderPanelRecessionLines(panelGroup, xScalePanel, effectivePanelHeight);

        // Add statistical lines for this panel
        this.renderOrUpdateStatisticalLines(
            panelGroup, // Lines are added directly to the panel group
            yScalePanel,     // Panel's Y scale
            innerWidth, // Panel's width
            [dataset],  // Only this panel's dataset for calculation
            this.options
        );
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.textContent = dataset.name;
        label.setAttribute('x', 5);
        label.setAttribute('y', 15);
        label.setAttribute('font-size', '12px');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('fill', dataset.color);
        panelGroup.appendChild(label);
        
        this.state.chart.appendChild(panelGroup);
      });
      
      console.log('Panels rendered successfully');
    } catch (error) {
      console.error('Error rendering panels:', error);
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
  
  /**
   * Toggle the average line
   * @public
   * @param {boolean} show - Whether to show the average line.
   * @param {Object} [options=null] - Optional new settings for averageLineOptions.
   * @returns {LineChart} This chart instance.
   */
  toggleAverageLine(show, options = null) {
    this.options.showAverageLine = Boolean(show);
    if (options) {
      this.options.averageLineOptions = { ...this.options.averageLineOptions, ...options };
    }
    return this.update();
  }

  /**
   * Toggle the median line
   * @public
   * @param {boolean} show - Whether to show the median line.
   * @param {Object} [options=null] - Optional new settings for medianLineOptions.
   * @returns {LineChart} This chart instance.
   */
  toggleMedianLine(show, options = null) {
    this.options.showMedianLine = Boolean(show);
    if (options) {
      this.options.medianLineOptions = { ...this.options.medianLineOptions, ...options };
    }
    return this.update();
  }
  
  /**
   * Toggle labels for statistical lines
   * @public
   * @param {boolean} show - Whether to show labels for statistical lines.
   * @returns {LineChart} This chart instance.
   */
  toggleStatisticalLineLabels(show) {
    this.options.showStatisticalLineLabels = Boolean(show);
    return this.update();
  }
}
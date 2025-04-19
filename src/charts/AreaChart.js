import LineChart from './LineChart.js';

/**
 * AreaChart class for rendering area charts
 * Extends LineChart with area-specific functionality
 */
export default class AreaChart extends LineChart {
  /**
   * Create a new area chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor with merged options
    super({
      ...config,
      options: {
        // Default to area enabled
        area: true,
        areaOpacity: 0.2,
        // Add stacked option for multiple datasets
        stacked: false,
        // Add gradient option for better visuals
        gradient: false,
        // Add smooth curve option (use monotone by default)
        curve: 'monotone',
        // Default to nicer colors for areas
        colors: ['rgba(66, 133, 244, 0.8)', 'rgba(52, 168, 83, 0.8)', 
                 'rgba(251, 188, 5, 0.8)', 'rgba(234, 67, 53, 0.8)'],
        chartType: 'area',
        ...config.options
      }
    });
  }
  
  /**
   * Process datasets for stacked areas
   * @private
   */
  processDatasets() {
    // Call parent method first
    super.processDatasets();
    
    // Process stacked datasets if needed
    if (this.options.stacked && this.state.datasets.length > 1) {
      this.createStackedData();
    }
  }
  
  /**
   * Create stacked data for multiple datasets
   * @private
   */
  createStackedData() {
    const { xField, yField } = this.options;
    
    // Get all x values across all datasets
    const allXValues = new Set();
    this.state.datasets.forEach(dataset => {
      dataset.data.forEach(d => {
        if (d[xField] !== undefined) {
          allXValues.add(d[xField] instanceof Date ? 
                         d[xField].getTime() : d[xField]);
        }
      });
    });
    
    // Sort x values
    const sortedXValues = Array.from(allXValues).sort((a, b) => a - b);
    
    // Create a lookup map for each dataset
    const datasetMaps = this.state.datasets.map(dataset => {
      const map = new Map();
      dataset.data.forEach(d => {
        if (d[xField] !== undefined && d[yField] !== undefined) {
          const xVal = d[xField] instanceof Date ? 
                      d[xField].getTime() : d[xField];
          map.set(xVal, d[yField]);
        }
      });
      return map;
    });
    
    // Create stacked data for each dataset
    this.state.datasets = this.state.datasets.map((dataset, datasetIndex) => {
      // Skip first dataset (it's the base)
      if (datasetIndex === 0) return dataset;
      
      // Create stacked data
      const stackedData = sortedXValues.map(xVal => {
        // Get value for this dataset
        const value = datasetMaps[datasetIndex].get(xVal) || 0;
        
        // Sum values from previous datasets
        let stackedValue = value;
        for (let i = 0; i < datasetIndex; i++) {
          stackedValue += datasetMaps[i].get(xVal) || 0;
        }
        
        // Create data point
        return {
          [xField]: xVal instanceof Date ? new Date(xVal) : xVal,
          [yField]: stackedValue,
          originalValue: value
        };
      });
      
      // Update dataset
      return {
        ...dataset,
        data: stackedData
      };
    });
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
      area,
      areaOpacity,
      gradient,
      stacked
    } = this.options;
    
    // No data to render
    if (!this.state.datasets.length) {
      return super.renderData();
    }
    
    // Create data group
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-data');
    
    // Create gradient definitions if needed
    if (gradient) {
      this.createGradients();
    }
    
    // Render datasets in reverse order for proper stacking visualization
    // (first dataset should be on top in the SVG)
    const reversedDatasets = [...this.state.datasets].reverse();
    
    reversedDatasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      // Create dataset group
      const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
      
      // Render area if enabled
      if (area) {
        let areaPath;
        
        if (stacked) {
          // Generate stacked area path (connects to the dataset below it)
          areaPath = this.generateStackedAreaPath(dataset);
        } else {
          // Generate simple area path (connects to the x-axis)
          areaPath = this.generateAreaPath(dataset.data);
        }
        
        const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaElement.setAttribute('d', areaPath);
        
        // Apply fill (either gradient or color)
        if (gradient) {
          const gradientId = `area-gradient-${dataset.id}`;
          areaElement.setAttribute('fill', `url(#${gradientId})`);
        } else {
          areaElement.setAttribute('fill', dataset.color);
          areaElement.setAttribute('fill-opacity', areaOpacity);
        }
        
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
    
    // Create gradient for each dataset
    this.state.datasets.forEach(dataset => {
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
   * Generate stacked area path
   * @private
   * @param {Object} dataset - Dataset
   * @returns {string} Path definition
   */
  generateStackedAreaPath(dataset) {
    const { xField, yField } = this.options;
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    // Get dataset index
    const datasetIndex = this.state.datasets.findIndex(d => d.id === dataset.id);
    if (datasetIndex <= 0) {
      // First dataset uses standard area path
      return this.generateAreaPath(dataset.data);
    }
    
    // Get previous dataset
    const prevDataset = this.state.datasets[datasetIndex - 1];
    
    // Create a map of x values to previous dataset y values
    const prevDataMap = new Map();
    prevDataset.data.forEach(d => {
      const xVal = d[xField] instanceof Date ? d[xField].getTime() : d[xField];
      prevDataMap.set(xVal, d[yField]);
    });
    
    // Generate points for current dataset
    const currentPoints = dataset.data.map(d => {
      return [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ];
    });
    
    // Generate baseline points from previous dataset in reverse order
    const baselinePoints = [...dataset.data]
      .reverse()
      .map(d => {
        const xVal = d[xField] instanceof Date ? d[xField].getTime() : d[xField];
        const yVal = prevDataMap.get(xVal) || 0;
        
        return [
          xScale.scale(d[xField]),
          yScale.scale(yVal)
        ];
      });
    
    // Combine points to create a closed path
    const allPoints = [...currentPoints, ...baselinePoints];
    
    // Generate path
    if (allPoints.length === 0) return '';
    
    const [firstPoint, ...restPoints] = allPoints;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [
      `M ${firstX},${firstY}`,
      ...restPoints.map(([x, y]) => `L ${x},${y}`),
      'Z' // Close the path
    ];
    
    return pathParts.join(' ');
  }
  
  /**
   * Update scales with actual data
   * Overrides parent method to handle stacked data correctly
   * @private
   */
  updateScales() {
    const { xField, yField, isLogarithmic, stacked } = this.options;
    
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
    
    // For stacked area charts, we need to consider the sum of values
    let yValues;
    if (stacked && this.state.datasets.length > 1) {
      // Get all x values
      const uniqueXValues = Array.from(new Set(xValues.map(x => 
        x instanceof Date ? x.getTime() : x
      )));
      
      // Create a map of x values to arrays of y values from each dataset
      const yValuesByX = new Map();
      uniqueXValues.forEach(x => yValuesByX.set(x, []));
      
      this.state.datasets.forEach(dataset => {
        dataset.data.forEach(d => {
          const xVal = d[xField] instanceof Date ? d[xField].getTime() : d[xField];
          const yVal = d[yField] || 0;
          
          const values = yValuesByX.get(xVal) || [];
          values.push(yVal);
          yValuesByX.set(xVal, values);
        });
      });
      
      // Calculate sums for each x value
      yValues = Array.from(yValuesByX.values()).map(values => 
        values.reduce((sum, val) => sum + val, 0)
      );
    } else {
      // Standard non-stacked chart
      yValues = allPoints.map(d => d[yField]);
    }
    
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
   * Toggle stacked mode
   * @public
   * @param {boolean} stacked - Whether to enable stacked mode
   * @returns {AreaChart} This chart instance
   */
  toggleStacked(stacked) {
    this.options.stacked = stacked;
    return this.update();
  }
  
  /**
   * Toggle gradient fill
   * @public
   * @param {boolean} gradient - Whether to enable gradient fill
   * @returns {AreaChart} This chart instance
   */
  toggleGradient(gradient) {
    this.options.gradient = gradient;
    return this.update();
  }
  
  /**
   * Set area opacity
   * @public
   * @param {number} opacity - Opacity value (0-1)
   * @returns {AreaChart} This chart instance
   */
  setAreaOpacity(opacity) {
    this.options.areaOpacity = Math.max(0, Math.min(1, opacity));
    return this.update();
  }
}
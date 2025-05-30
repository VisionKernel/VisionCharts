import Chart from '../core/Chart.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import RecessionLines from '../components/RecessionLines.js'; // Keep for type hinting if needed, but Chart.js handles instance

/**
 * BarChart class for rendering bar charts.
 * Can use a time-based or category-based x-axis.
 */
export default class BarChart extends Chart {
  constructor(config) {
    console.log('BarChart constructor called');

    const defaultBarChartOptions = {
      chartType: 'bar',
      xField: 'x', // Default field for x-axis data (e.g., time or category)
      yField: 'y',
      xType: 'time', // Default to 'time' to align with LineChart for recession logic
      yType: 'number',
      barWidth: 0.7, // For category: % of available space. For time: interpreted differently or use timeBarPixelWidth.
      timeBarPixelWidth: 10, // Default pixel width for bars when xType is 'time'
      barSpacing: 0.2, // Primarily for category type
      showValues: false,
      valuePosition: 'top',
      colors: ['#1468a8', '#34A853', '#FBBC05', '#EA4335'],
      stacked: true, // Note: Stacking logic for xType: 'time' needs careful implementation if data points don't align.
      dateFormat: { year: 'numeric', month: 'short', day: 'numeric' }, // Default date format for time axis
      skipLabels: 1, // Default skip labels (1 means show all initially for time)
      grid: {
        show: false, // Default grid to OFF, user can enable
        color: '#e0e0e0',
        strokeWidth: 1,
        dashArray: '4,4'
      }
    };

    const mergedOptions = {
      ...defaultBarChartOptions,
      ...(config.options || {}),
      grid: {
        ...defaultBarChartOptions.grid,
        ...((config.options && config.options.grid) || {})
      }
    };

    super({
      ...config,
      options: mergedOptions
    });
    
    console.log('BarChart constructor finished with merged options:', this.options);
  }

  /**
   * Create scales for the chart
   * @private
   */
  createScales() {
    console.log('BarChart.createScales called');
    
    const { xType, yType, isLogarithmic } = this.options;
    
    // Create X scale - use TimeScale for time data
    this.state.scales.x = xType === 'time' ? 
      new TimeScale([0, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    // Create Y scale - use LogScale if isLogarithmic is true
    this.state.scales.y = isLogarithmic ? 
      new LogScale([0.1, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    // Update scales with actual data
    this.updateScales();
    
    console.log('BarChart scales created');
  }
  
  /**
   * Create axes for the chart - consistent with Line and Area charts
   * @private
   */
  createAxes() {
    console.log('BarChart.createAxes called');
    
    this.state.axes.x = {
      render: (container, width, height) => {
        const { xType, xField, dateFormat, skipLabels } = this.options;
        const scale = this.state.scales.x;
        const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        axisGroup.setAttribute('class', 'visioncharts-x-axis');
        
        const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axisLine.setAttribute('x1', 0); axisLine.setAttribute('y1', height);
        axisLine.setAttribute('x2', width); axisLine.setAttribute('y2', height);
        axisLine.setAttribute('stroke', '#ccc'); axisLine.setAttribute('stroke-width', 1);
        axisGroup.appendChild(axisLine);

        let tickValues = [];
        if (xType === 'time') {
          tickValues = scale.ticks(Math.max(2, Math.floor(width / 100))); // Auto ticks for TimeScale
        } else { // category or number
          // Existing category logic for collecting uniqueXValues and sorting them
          const uniqueXValuesSet = new Set();
          this.state.datasets.forEach(dataset => {
            dataset.data.forEach(d => {
              if (d[xField] !== undefined) uniqueXValuesSet.add(d[xField]);
            });
          });
          tickValues = Array.from(uniqueXValuesSet);
          // Sorting for category/number (simplified, might need original sorting logic from your file)
          tickValues.sort((a, b) => String(a).localeCompare(String(b)));
        }
        
        const needsRotation = tickValues.length * (xType === 'time' ? 80 : 50) > width || width < 400; // Adjust estimate
        const labelInterval = skipLabels || 1;

        tickValues.forEach((value, index) => {
          if (index % labelInterval !== 0 && index !== tickValues.length -1 && tickValues.length > 5) return; // Smart skipping

          let xPos, labelText;
          if (xType === 'time') {
            xPos = scale.scale(value); // value is a Date object
            labelText = new Intl.DateTimeFormat('en-US', dateFormat).format(value);
          } else { // category
            const barWidthCat = width / tickValues.length; // Width per category slot
            xPos = index * barWidthCat + barWidthCat / 2; // Center of category slot
            labelText = String(value);
          }

          const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          tick.setAttribute('x1', xPos); tick.setAttribute('y1', height);
          tick.setAttribute('x2', xPos); tick.setAttribute('y2', height + 6);
          tick.setAttribute('stroke', '#ccc'); axisGroup.appendChild(tick);

          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.textContent = labelText;
          if (needsRotation) {
            label.setAttribute('x', xPos); label.setAttribute('y', height + 20);
            label.setAttribute('transform', `rotate(-45, ${xPos}, ${height + 20})`);
            label.setAttribute('text-anchor', 'end');
          } else {
            label.setAttribute('x', xPos); label.setAttribute('y', height + 25);
            label.setAttribute('text-anchor', 'middle');
          }
          label.setAttribute('font-size', '12px'); label.setAttribute('fill', this.options.textColor || '#333');
          axisGroup.appendChild(label);

          if (this.options.grid && this.options.grid.show) {
            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', xPos); gridLine.setAttribute('y1', 0);
            gridLine.setAttribute('x2', xPos); gridLine.setAttribute('y2', height);
            gridLine.setAttribute('stroke', this.options.grid.color);
            gridLine.setAttribute('stroke-width', this.options.grid.strokeWidth);
            if (this.options.grid.dashArray) gridLine.setAttribute('stroke-dasharray', this.options.grid.dashArray);
            if (axisGroup.firstChild) axisGroup.insertBefore(gridLine, axisGroup.firstChild);
            else axisGroup.appendChild(gridLine);
          }
        });
        container.appendChild(axisGroup);
        return axisGroup;
      }
    };
    
    // Y-axis logic remains largely the same as in your provided BarChart.js
    this.state.axes.y = {
      render: (container, width, height) => {
        const { yType, isLogarithmic } = this.options;
        const scale = this.state.scales.y;
        const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        axisGroup.setAttribute('class', 'visioncharts-y-axis');
        
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
          
          // Format label text - use K/M suffix for large numbers
          let labelText;
          if (yType === 'percent') {
            labelText = (value * 100).toFixed(0) + '%';
          } else if (yType === 'currency') {
            labelText = '$' + this.formatLargeNumber(value);
          } else {
            // Format large numbers with K/M suffix
            labelText = this.formatLargeNumber(value);
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
    
    console.log('BarChart axes created (render functions defined)');
  }
  
  /**
   * Format large numbers with K/M suffix
   * @private
   * @param {number} value - The number to format
   * @returns {string} Formatted number
   */
  formatLargeNumber(value) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else {
      return value.toFixed(isNaN(value) || Math.floor(value) === value ? 0 : 1);
    }
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    console.log('BarChart.updateScales called');
    
    const { xField, yField, xType, isLogarithmic } = this.options;
    
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
      console.log('No data points, using default domains');
      return;
    }
    
    // Extract unique X values
    const xValues = allPoints.map(d => d[xField]);
    
    // For stacked bars, we need to calculate the sum of Y values for each X value
    const uniqueXValues = Array.from(new Set(xValues));
    const stackedYValues = [];
    
    uniqueXValues.forEach(xValue => {
      let sum = 0;
      this.state.datasets.forEach(dataset => {
        const matchingPoint = dataset.data.find(d => d[xField] === xValue);
        if (matchingPoint) {
          sum += matchingPoint[yField] || 0;
        }
      });
      stackedYValues.push(sum);
    });
    
    // Get the max of stacked values for Y scale
    const maxYValue = Math.max(...stackedYValues);
    
    // Set X domain based on type
    let xMin, xMax;
    if (xType === 'time') {
      // For time type, convert string dates to Date objects if needed
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      xMax = new Date(Math.max(...dates.map(d => d.getTime())));
    } else if (xType === 'number') {
      xMin = Math.min(...xValues);
      xMax = Math.max(...xValues);
    } else {
      // For category, we need to create a band scale but are using linear scale as approximation
      // Set range from -0.5 to (uniqueValues.length - 0.5) to center bars
      xMin = -0.5;
      xMax = uniqueXValues.length - 0.5;
      
      // Store unique values for bar positioning
      this.state.uniqueXValues = uniqueXValues;
    }
    
    // Y domain - starting from 0 for bar charts with some padding at the top
    const yMin = 0;
    const yMax = maxYValue * 1.1; // Add 10% padding at the top
    
    // For logarithmic scale, ensure minimum is positive
    const effectiveYMin = isLogarithmic ? Math.max(0.01, yMin) : yMin;
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([effectiveYMin, yMax]);
    
    // Set ranges based on dimensions
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
    
    console.log('Scales updated with domains:', 
        'x:', [xMin, xMax],
        'y:', [effectiveYMin, yMax]);
  }
  
  /**
   * Render chart data
   * @private
   */
  renderData() {
    console.log('BarChart.renderData called');
    if (!this.state.chart) return;
    
    const { xField, yField, xType, timeBarPixelWidth, barWidth, barSpacing, colors } = this.options;
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-data');

    if (xType === 'time') {
      // Simplified rendering for time-based bars (non-stacked for this example)
      this.state.datasets.forEach((dataset, datasetIndex) => {
        const color = dataset.color || colors[datasetIndex % colors.length];
        dataset.data.forEach(dataPoint => {
          const xValue = dataPoint[xField]; // Should be a Date object
          const yValue = dataPoint[yField] || 0;
          if (yValue === 0 && !this.options.showZeroValueBars) return;

          const barCenter = this.state.scales.x.scale(xValue);
          const actualBarWidth = timeBarPixelWidth;
          const barX = barCenter - actualBarWidth / 2;

          const zeroY = this.state.scales.y.scale(0);
          const valueY = this.state.scales.y.scale(yValue);
          const barHeight = Math.abs(zeroY - valueY);
          // Ensure y is the top of the bar (min of zeroY, valueY for positive bars)
          const finalY = (yValue >= 0) ? valueY : zeroY; 

          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', barX);
          bar.setAttribute('y', finalY);
          bar.setAttribute('width', actualBarWidth);
          bar.setAttribute('height', Math.max(0, barHeight)); // Height can be 0
          bar.setAttribute('fill', color);
          bar.setAttribute('class', 'visioncharts-bar');
          // Add data attributes for tooltips
          bar.setAttribute('data-x', xValue instanceof Date ? xValue.toISOString() : xValue);
          bar.setAttribute('data-y', yValue);
          bar.setAttribute('data-dataset', dataset.id || `dataset-${datasetIndex}`);
          dataGroup.appendChild(bar);
          // Add value labels if enabled (simplified)
        });
      });
    } else { // Category logic (taken from your provided BarChart.js)
      const allXValuesSet = new Set();
      this.state.datasets.forEach(dataset => {
        dataset.data.forEach(d => { if (d[xField] !== undefined) allXValuesSet.add(d[xField]); });
      });
      const uniqueXValues = Array.from(allXValuesSet);
      // Sorting for category (simplified, might need original sorting logic)
      uniqueXValues.sort((a, b) => String(a).localeCompare(String(b)));

      const totalCategorySlotWidth = this.state.dimensions.innerWidth / uniqueXValues.length;
      const actualBarWidthCategory = totalCategorySlotWidth * (1 - barSpacing) * barWidth;
      
      uniqueXValues.forEach((xCatValue, xIndex) => {
        const categorySlotX = xIndex * totalCategorySlotWidth;
        const barGroupXOffset = categorySlotX + (totalCategorySlotWidth - actualBarWidthCategory) / 2; // Centering the bar(s) in the slot

        let currentStackHeight = 0; // For stacked bars

        this.state.datasets.forEach((dataset, datasetIndex) => {
          const dataPoint = dataset.data.find(d => d[xField] === xCatValue);
          if (!dataPoint) return;
          const yValue = dataPoint[yField] || 0;
          if (yValue === 0 && !this.options.showZeroValueBars) return;

          const color = dataset.color || colors[datasetIndex % colors.length];
          const valueY = this.state.scales.y.scale(yValue);
          const zeroY = this.state.scales.y.scale(0);
          const barSegmentHeight = Math.abs(zeroY - valueY);

          const barY = this.state.scales.y.scale(currentStackHeight + yValue);
          
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', barGroupXOffset);
          bar.setAttribute('y', barY);
          bar.setAttribute('width', actualBarWidthCategory);
          bar.setAttribute('height', Math.max(0, barSegmentHeight));
          bar.setAttribute('fill', color);
          bar.setAttribute('class', 'visioncharts-bar');
          // Add data attributes
          bar.setAttribute('data-x', xCatValue);
          bar.setAttribute('data-y', yValue);
          bar.setAttribute('data-dataset', dataset.id || `dataset-${datasetIndex}`);
          dataGroup.appendChild(bar);

          currentStackHeight += yValue; // For stacked bars
        });
      });
    }
    this.state.chart.appendChild(dataGroup);
    console.log('Data rendered successfully');
  }
  
  /**
   * Format large numbers with K/M suffix
   * @private
   * @param {number} value - The number to format
   * @returns {string} Formatted number
   */
  formatLargeNumber(value) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else {
      return value.toFixed(isNaN(value) || Math.floor(value) === value ? 0 : 1);
    }
  }
  
  /**
   * Update scales with actual data
   * @private
   */
  updateScales() {
    console.log('BarChart.updateScales called');
    
    const { xField, yField, xType, isLogarithmic } = this.options;
    
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
      console.log('No data points, using default domains');
      return;
    }
    
    // Extract unique X values
    const xValues = allPoints.map(d => d[xField]);
    
    // For stacked bars, we need to calculate the sum of Y values for each X value
    const uniqueXValues = Array.from(new Set(xValues));
    const stackedYValues = [];
    
    uniqueXValues.forEach(xValue => {
      let sum = 0;
      this.state.datasets.forEach(dataset => {
        const matchingPoint = dataset.data.find(d => d[xField] === xValue);
        if (matchingPoint) {
          sum += matchingPoint[yField] || 0;
        }
      });
      stackedYValues.push(sum);
    });
    
    // Get the max of stacked values for Y scale
    const maxYValue = Math.max(...stackedYValues);
    
    // Set X domain based on type
    let xMin, xMax;
    if (xType === 'time') {
      // For time type, convert string dates to Date objects if needed
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      xMax = new Date(Math.max(...dates.map(d => d.getTime())));
    } else if (xType === 'number') {
      xMin = Math.min(...xValues);
      xMax = Math.max(...xValues);
    } else {
      // For category, we need to create a band scale but are using linear scale as approximation
      // Set range from -0.5 to (uniqueValues.length - 0.5) to center bars
      xMin = -0.5;
      xMax = uniqueXValues.length - 0.5;
      
      // Store unique values for bar positioning
      this.state.uniqueXValues = uniqueXValues;
    }
    
    // Y domain - starting from 0 for bar charts with some padding at the top
    const yMin = 0;
    const yMax = maxYValue * 1.1; // Add 10% padding at the top
    
    // For logarithmic scale, ensure minimum is positive
    const effectiveYMin = isLogarithmic ? Math.max(0.01, yMin) : yMin;
    
    // Set domains
    this.state.scales.x.setDomain([xMin, xMax]);
    this.state.scales.y.setDomain([effectiveYMin, yMax]);
    
    // Set ranges based on dimensions
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
    
    console.log('Scales updated with domains:', 
        'x:', [xMin, xMax],
        'y:', [effectiveYMin, yMax]);
  }
  
  /**
   * Render chart data
   * @private
   */
  renderData() {
    console.log('BarChart.renderData called');
    if (!this.state.chart) return;
    
    const { xField, yField, xType, timeBarPixelWidth, barWidth, barSpacing, colors } = this.options;
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-data');

    if (xType === 'time') {
      // Simplified rendering for time-based bars (non-stacked for this example)
      this.state.datasets.forEach((dataset, datasetIndex) => {
        const color = dataset.color || colors[datasetIndex % colors.length];
        dataset.data.forEach(dataPoint => {
          const xValue = dataPoint[xField]; // Should be a Date object
          const yValue = dataPoint[yField] || 0;
          if (yValue === 0 && !this.options.showZeroValueBars) return;

          const barCenter = this.state.scales.x.scale(xValue);
          const actualBarWidth = timeBarPixelWidth;
          const barX = barCenter - actualBarWidth / 2;

          const zeroY = this.state.scales.y.scale(0);
          const valueY = this.state.scales.y.scale(yValue);
          const barHeight = Math.abs(zeroY - valueY);
          // Ensure y is the top of the bar (min of zeroY, valueY for positive bars)
          const finalY = (yValue >= 0) ? valueY : zeroY; 

          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', barX);
          bar.setAttribute('y', finalY);
          bar.setAttribute('width', actualBarWidth);
          bar.setAttribute('height', Math.max(0, barHeight)); // Height can be 0
          bar.setAttribute('fill', color);
          bar.setAttribute('class', 'visioncharts-bar');
          // Add data attributes for tooltips
          bar.setAttribute('data-x', xValue instanceof Date ? xValue.toISOString() : xValue);
          bar.setAttribute('data-y', yValue);
          bar.setAttribute('data-dataset', dataset.id || `dataset-${datasetIndex}`);
          dataGroup.appendChild(bar);
          // Add value labels if enabled (simplified)
        });
      });
    } else { // Category logic (taken from your provided BarChart.js)
      const allXValuesSet = new Set();
      this.state.datasets.forEach(dataset => {
        dataset.data.forEach(d => { if (d[xField] !== undefined) allXValuesSet.add(d[xField]); });
      });
      const uniqueXValues = Array.from(allXValuesSet);
      // Sorting for category (simplified, might need original sorting logic)
      uniqueXValues.sort((a, b) => String(a).localeCompare(String(b)));

      const totalCategorySlotWidth = this.state.dimensions.innerWidth / uniqueXValues.length;
      const actualBarWidthCategory = totalCategorySlotWidth * (1 - barSpacing) * barWidth;
      
      uniqueXValues.forEach((xCatValue, xIndex) => {
        const categorySlotX = xIndex * totalCategorySlotWidth;
        const barGroupXOffset = categorySlotX + (totalCategorySlotWidth - actualBarWidthCategory) / 2; // Centering the bar(s) in the slot

        let currentStackHeight = 0; // For stacked bars

        this.state.datasets.forEach((dataset, datasetIndex) => {
          const dataPoint = dataset.data.find(d => d[xField] === xCatValue);
          if (!dataPoint) return;
          const yValue = dataPoint[yField] || 0;
          if (yValue === 0 && !this.options.showZeroValueBars) return;

          const color = dataset.color || colors[datasetIndex % colors.length];
          const valueY = this.state.scales.y.scale(yValue);
          const zeroY = this.state.scales.y.scale(0);
          const barSegmentHeight = Math.abs(zeroY - valueY);

          const barY = this.state.scales.y.scale(currentStackHeight + yValue);
          
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', barGroupXOffset);
          bar.setAttribute('y', barY);
          bar.setAttribute('width', actualBarWidthCategory);
          bar.setAttribute('height', Math.max(0, barSegmentHeight));
          bar.setAttribute('fill', color);
          bar.setAttribute('class', 'visioncharts-bar');
          // Add data attributes
          bar.setAttribute('data-x', xCatValue);
          bar.setAttribute('data-y', yValue);
          bar.setAttribute('data-dataset', dataset.id || `dataset-${datasetIndex}`);
          dataGroup.appendChild(bar);

          currentStackHeight += yValue; // For stacked bars
        });
      });
    }
    this.state.chart.appendChild(dataGroup);
    console.log('Data rendered successfully');
  }

  /**
   * Render chart title - consistent with other charts
   * @private
   */
  renderTitle() {
    console.log('BarChart.renderTitle called');
    
    // Use the parent Chart class's renderTitle method
    super.renderTitle();
  }
  
  /**
   * Render chart legend - consistent with other charts
   * @private
   */
  renderLegend() {
    console.log('BarChart.renderLegend called');
    
    // Use the parent Chart class's renderLegend method
    super.renderLegend();
  }
  
  /**
   * Render axis names - consistent with other charts
   * @private
   */
  renderAxisNames() {
    console.log('BarChart.renderAxisNames called');
    
    // Use the parent Chart class's renderAxisNames method
    super.renderAxisNames();
  }
  
  /**
   * Render the chart.
   * Overridden to ensure hover elements are on top if specific z-ordering is needed beyond parent.
   * @public
   */
  render() {
    super.render(); // This will call Chart.js render, which calls renderRecessionLines
    
    // Ensure hover elements are on top (from your existing BarChart.js)
    if (this.state.chart && this.state.components) {
        const { crosshair, tooltip } = this.state.components;
        if (crosshair && crosshair.elements.group && crosshair.elements.group.parentNode === this.state.chart) {
            this.state.chart.appendChild(crosshair.elements.group);
        }
        if (tooltip && tooltip.elements.tooltip && tooltip.elements.tooltip.parentNode === this.state.svg) {
            this.state.svg.appendChild(tooltip.elements.tooltip);
        }
    }
    return this;
  }
}
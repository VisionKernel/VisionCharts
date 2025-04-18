import Chart from '../core/Chart.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';

/**
 * BarChart class for rendering bar charts
 */
export default class BarChart extends Chart {
  /**
   * Create a new bar chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    // Call parent constructor with merged options
    super({
      ...config,
      options: {
        chartType: 'bar',
        xField: 'x',
        yField: 'y',
        xType: 'category', // 'category', 'time', 'number'
        yType: 'number',
        barWidth: 0.7, // Width of bar as percentage of available space
        barSpacing: 0.2, // Spacing between groups of bars
        barGap: 0.05, // Gap between bars in a group
        groupBars: true, // Group bars for multiple datasets
        showValues: false, // Whether to show values on bars
        valuePosition: 'top', // 'top', 'middle', 'bottom'
        colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335'],
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
        
        // Get unique x values for bar charts
        let tickValues = [];
        
        if (this.state.datasets.length > 0) {
          // Collect all unique x values across datasets
          const uniqueXValues = new Set();
          this.state.datasets.forEach(dataset => {
            dataset.data.forEach(d => {
              if (d[xField] !== undefined) {
                uniqueXValues.add(d[xField]);
              }
            });
          });
          
          // Convert to array and sort
          tickValues = Array.from(uniqueXValues);
          
          // Sort based on type
          if (xType === 'time') {
            tickValues.sort((a, b) => {
              const dateA = a instanceof Date ? a : new Date(a);
              const dateB = b instanceof Date ? b : new Date(b);
              return dateA - dateB;
            });
          } else if (xType === 'number') {
            tickValues.sort((a, b) => a - b);
          } else {
            // String sorting for category
            tickValues.sort();
          }
        }
        
        // Draw ticks and labels
        tickValues.forEach((value, index) => {
          // For bar charts, position tick in the middle of the bar
          const barWidth = width / tickValues.length;
          const x = index * barWidth + barWidth / 2;
          
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
            const date = value instanceof Date ? value : new Date(value);
            labelText = date.toLocaleDateString();
          } else {
            labelText = String(value);
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
          
          // Rotate label if more than 10 ticks
          if (tickValues.length > 10) {
            label.setAttribute('transform', `rotate(-45, ${x}, ${height + 20})`);
            label.setAttribute('text-anchor', 'end');
          }
          
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
      return;
    }
    
    // Extract unique X values and all Y values
    const xValues = allPoints.map(d => d[xField]);
    const yValues = allPoints.map(d => d[yField]);
    
    let xMin, xMax, yMin, yMax;
    
    // X domain depends on the type
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
      const uniqueValues = Array.from(new Set(xValues));
      xMin = -0.5;
      xMax = uniqueValues.length - 0.5;
      
      // Store unique values for bar positioning
      this.state.uniqueXValues = uniqueValues;
    }
    
    // Y domain
    yMin = Math.min(0, ...yValues); // Include 0 for bar charts
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
      isLogarithmic ? yMin : yMin - yPadding,
      yMax + yPadding
    ]);
    
    // Set ranges based on dimensions
    this.state.scales.x.setRange([0, this.state.dimensions.innerWidth]);
    this.state.scales.y.setRange([this.state.dimensions.innerHeight, 0]);
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
      barWidth,
      barGap,
      barSpacing,
      groupBars,
      showValues,
      valuePosition
    } = this.options;
    
    // Create data group
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-data');
    
    // No data to render
    if (!this.state.datasets.length) {
      this.state.chart.appendChild(dataGroup);
      return;
    }
    
    // Get unique X values
    const allXValues = new Set();
    this.state.datasets.forEach(dataset => {
      dataset.data.forEach(d => {
        if (d[xField] !== undefined) {
          allXValues.add(d[xField]);
        }
      });
    });
    
    const uniqueXValues = Array.from(allXValues);
    
    // Sort X values based on type
    if (this.options.xType === 'time') {
      uniqueXValues.sort((a, b) => {
        const dateA = a instanceof Date ? a : new Date(a);
        const dateB = b instanceof Date ? b : new Date(b);
        return dateA - dateB;
      });
    } else if (this.options.xType === 'number') {
      uniqueXValues.sort((a, b) => a - b);
    } else {
      // String sorting for category
      uniqueXValues.sort();
    }
    
    // Calculate bar dimensions
    const totalGroupWidth = this.state.dimensions.innerWidth / uniqueXValues.length;
    const usableGroupWidth = totalGroupWidth * (1 - barSpacing);
    
    // Render each dataset
    this.state.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset.data || !dataset.data.length) return;
      
      // Create dataset group
      const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      datasetGroup.setAttribute('class', `visioncharts-dataset-${dataset.id}`);
      
      // Create a map for faster lookup
      const dataMap = new Map();
      dataset.data.forEach(d => {
        dataMap.set(d[xField], d[yField]);
      });
      
      // Calculate dataset-specific bar width
      let singleBarWidth;
      
      if (groupBars && this.state.datasets.length > 1) {
        // Multiple datasets, divide group width among them
        singleBarWidth = (usableGroupWidth * barWidth) / this.state.datasets.length;
      } else {
        // Single dataset gets the full width
        singleBarWidth = usableGroupWidth * barWidth;
      }
      
      // Render bars for each X value
      uniqueXValues.forEach((xValue, xIndex) => {
        // Get y value for this x value
        const yValue = dataMap.get(xValue);
        
        // Skip if no y value
        if (yValue === undefined) return;
        
        // Calculate bar position
        let x;
        if (groupBars && this.state.datasets.length > 1) {
          // Position bar within the group
          const groupX = xIndex * totalGroupWidth + (totalGroupWidth - usableGroupWidth) / 2;
          x = groupX + datasetIndex * singleBarWidth;
        } else {
          // Center bar in the group
          const groupX = xIndex * totalGroupWidth + (totalGroupWidth - usableGroupWidth) / 2;
          x = groupX + (usableGroupWidth - singleBarWidth) / 2;
        }
        
        // Calculate bar height
        const zeroY = this.state.scales.y.scale(0);
        const valueY = this.state.scales.y.scale(yValue);
        
        // Bars go from zero to value
        const barY = yValue >= 0 ? valueY : zeroY;
        const barHeight = Math.abs(zeroY - valueY);
        
        // Create bar element
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', x);
        bar.setAttribute('y', barY);
        bar.setAttribute('width', singleBarWidth);
        bar.setAttribute('height', Math.max(1, barHeight)); // Ensure at least 1px height
        bar.setAttribute('fill', dataset.color);
        bar.setAttribute('class', 'visioncharts-bar');
        
        // Add data attributes for tooltips
        bar.setAttribute('data-x', xValue);
        bar.setAttribute('data-y', yValue);
        bar.setAttribute('data-dataset', dataset.id);
        
        datasetGroup.appendChild(bar);
        
        // Show values if enabled
        if (showValues) {
          const value = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          value.textContent = yValue.toFixed(1);
          
          // Position value based on option
          let valueX = x + singleBarWidth / 2;
          let valueY;
          
          if (valuePosition === 'top') {
            valueY = barY - 5;
          } else if (valuePosition === 'middle') {
            valueY = barY + barHeight / 2;
          } else { // bottom
            valueY = barY + barHeight + 15;
          }
          
          value.setAttribute('x', valueX);
          value.setAttribute('y', valueY);
          value.setAttribute('text-anchor', 'middle');
          value.setAttribute('font-size', '10px');
          value.setAttribute('font-family', this.options.fontFamily);
          value.setAttribute('fill', this.options.textColor);
          value.setAttribute('class', 'visioncharts-bar-value');
          
          datasetGroup.appendChild(value);
        }
      });
      
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
        const yMin = Math.min(0, ...yValues); // Include 0 for bar charts
        const yMax = Math.max(...yValues);
        const yPadding = (yMax - yMin) * 0.1;
        
        // Set domain based on scale type
        if (this.options.isLogarithmic) {
          yScale.setDomain([Math.max(yMin, 0.01), yMax + yPadding]);
        } else {
          yScale.setDomain([yMin - yPadding, yMax + yPadding]);
        }
      }
      
      // Render simplified panel axes
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
    const { 
      xField, 
      yField, 
      barWidth, 
      barSpacing 
    } = this.options;
    
    if (!dataset.data || !dataset.data.length) return;
    
    // Get unique X values for this dataset
    const xValues = dataset.data.map(d => d[xField]);
    const uniqueXValues = Array.from(new Set(xValues));
    
    // Sort X values based on type
    if (this.options.xType === 'time') {
      uniqueXValues.sort((a, b) => {
        const dateA = a instanceof Date ? a : new Date(a);
        const dateB = b instanceof Date ? b : new Date(b);
        return dateA - dateB;
      });
    } else if (this.options.xType === 'number') {
      uniqueXValues.sort((a, b) => a - b);
    } else {
      // String sorting for category
      uniqueXValues.sort();
    }
    
    // Calculate bar dimensions
    const totalBarWidth = xScale.range()[1] / uniqueXValues.length;
    const usableBarWidth = totalBarWidth * (1 - barSpacing);
    const actualBarWidth = usableBarWidth * barWidth;
    
    // Create a map for faster lookup
    const dataMap = new Map();
    dataset.data.forEach(d => {
      dataMap.set(d[xField], d[yField]);
    });
    
    // Render bars
    uniqueXValues.forEach((xValue, index) => {
      // Get y value for this x value
      const yValue = dataMap.get(xValue);
      
      // Skip if no y value
      if (yValue === undefined) return;
      
      // Calculate bar position
      const x = index * totalBarWidth + (totalBarWidth - actualBarWidth) / 2;
      
      // Calculate bar height
      const zeroY = yScale.scale(0);
      const valueY = yScale.scale(yValue);
      
      // Bars go from zero to value
      const barY = yValue >= 0 ? valueY : zeroY;
      const barHeight = Math.abs(zeroY - valueY);
      
      // Create bar element
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', x);
      bar.setAttribute('y', barY);
      bar.setAttribute('width', actualBarWidth);
      bar.setAttribute('height', Math.max(1, barHeight)); // Ensure at least 1px height
      bar.setAttribute('fill', dataset.color);
      bar.setAttribute('class', 'visioncharts-panel-bar');
      
      panel.appendChild(bar);
    });
  }
  
  /**
   * Process studies/indicators
   * Currently not implemented for bar charts
   * @private
   */
  processStudies() {
    // Bar charts typically don't have studies like moving averages
    // This is a placeholder for potential future implementation
    console.warn('Studies are not implemented for bar charts yet');
  }
  
  /**
   * Toggle grouping of bars
   * @public
   * @param {boolean} groupBars - Whether to group bars
   * @returns {BarChart} This chart instance
   */
  toggleGroupBars(groupBars) {
    this.options.groupBars = groupBars;
    return this.update();
  }
  
  /**
   * Toggle showing of values on bars
   * @public
   * @param {boolean} showValues - Whether to show values
   * @param {string} position - Position of values ('top', 'middle', 'bottom')
   * @returns {BarChart} This chart instance
   */
  toggleShowValues(showValues, position) {
    this.options.showValues = showValues;
    if (position) {
      this.options.valuePosition = position;
    }
    return this.update();
  }
  
  /**
   * Set bar width
   * @public
   * @param {number} width - Bar width (0-1)
   * @returns {BarChart} This chart instance
   */
  setBarWidth(width) {
    this.options.barWidth = Math.max(0.1, Math.min(1, width));
    return this.update();
  }
  
  /**
   * Set bar spacing
   * @public
   * @param {number} spacing - Bar spacing (0-1)
   * @returns {BarChart} This chart instance
   */
  setBarSpacing(spacing) {
    this.options.barSpacing = Math.max(0, Math.min(0.5, spacing));
    return this.update();
  }
  
  /**
   * Toggle logarithmic scale
   * @public
   * @param {boolean} isLogarithmic - Whether to use logarithmic scale
   * @returns {BarChart} This chart instance
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
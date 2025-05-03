import Chart from '../core/Chart.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';

/**
 * BarChart class for rendering bar charts with time series data
 * Styled to match the Line and Area charts
 */
export default class BarChart extends Chart {
  /**
   * Create a new bar chart
   * @param {Object} config - Chart configuration
   */
  constructor(config) {
    console.log('BarChart constructor called');
    
    // Call parent constructor with merged options
    super({
      ...config,
      options: {
        chartType: 'bar',
        xField: 'category', // Default field for category labels
        yField: 'y',
        xType: 'category', // 'category', 'time', 'number'
        yType: 'number',
        barWidth: 0.7, // Width of bar as percentage of available space
        barSpacing: 0.2, // Spacing between bars
        showValues: false, // Whether to show values on bars
        valuePosition: 'top', // 'top', 'middle', 'bottom'
        colors: ['#1468a8', '#34A853', '#FBBC05', '#EA4335'],
        stacked: true, // Always stacked by default
        dateFormat: { year: 'numeric', month: 'short' }, // Format for date labels
        skipLabels: 3, // Skip labels for readability in time series
        ...config.options
      }
    });
    
    console.log('BarChart constructor finished');
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
    
    // Create X axis
    this.state.axes.x = {
      render: (container, width, height) => {
        const { xType, xField, dateFormat, skipLabels } = this.options;
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
            // For category, try to sort based on timestamp if available
            const firstDataset = this.state.datasets[0];
            if (firstDataset && firstDataset.data.length > 0 && firstDataset.data[0].x) {
              // Create a map of category to timestamp
              const categoryMap = new Map();
              firstDataset.data.forEach(d => {
                if (d.x && d[xField]) {
                  categoryMap.set(d[xField], d.x);
                }
              });
              
              // Sort by timestamp if available
              if (categoryMap.size > 0) {
                tickValues.sort((a, b) => {
                  const timeA = categoryMap.get(a) || 0;
                  const timeB = categoryMap.get(b) || 0;
                  return timeA - timeB;
                });
              } else {
                // Default string sorting
                tickValues.sort();
              }
            } else {
              // Default string sorting
              tickValues.sort();
            }
          }
        }
        
        // Calculate if labels need rotation (if there are many or if container is small)
        const needsRotation = tickValues.length > 4 || width < 400;
        
        // For large datasets, skip some labels for readability
        const labelInterval = skipLabels || 1;
        
        // Draw ticks and labels
        tickValues.forEach((value, index) => {
          // Skip some labels for readability
          const showLabel = index % labelInterval === 0;
          
          // For bar charts, position tick in the middle of the bar
          const barWidth = width / tickValues.length;
          const x = index * barWidth + barWidth / 2;
          
          // Draw tick
          const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          tick.setAttribute('x1', x);
          tick.setAttribute('y1', height);
          tick.setAttribute('x2', x);
          tick.setAttribute('y2', height + (showLabel ? 6 : 3)); // Shorter ticks for skipped labels
          tick.setAttribute('stroke', '#ccc');
          tick.setAttribute('stroke-width', 1);
          axisGroup.appendChild(tick);
          
          // Only show some labels for readability
          if (showLabel) {
            // Format label text
            let labelText;
            if (xType === 'time') {
              const date = value instanceof Date ? value : new Date(value);
              labelText = new Intl.DateTimeFormat('en-US', dateFormat).format(date);
            } else {
              labelText = String(value);
            }
            
            // Draw label with rotation if needed
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.textContent = labelText;
            
            if (needsRotation) {
              // For rotated labels, position them further below
              label.setAttribute('x', x);
              label.setAttribute('y', height + 20); // Increased from 16 to 20
              label.setAttribute('transform', `rotate(-45, ${x}, ${height + 20})`);
              label.setAttribute('text-anchor', 'end');
            } else {
              label.setAttribute('x', x);
              label.setAttribute('y', height + 25); // Increased from 20 to 25
              label.setAttribute('text-anchor', 'middle');
            }
            
            label.setAttribute('font-size', '12px');
            label.setAttribute('font-family', this.options.fontFamily);
            label.setAttribute('fill', this.options.textColor);
            axisGroup.appendChild(label);
          }
          
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
    
    if (!this.state.chart) {
      console.error('Cannot render data: chart element is null');
      return;
    }
    
    try {
      const {
        xField,
        yField,
        barWidth,
        barSpacing,
        showValues,
        valuePosition
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
        // For category, try to sort based on timestamp if available
        const firstDataset = this.state.datasets[0];
        if (firstDataset && firstDataset.data.length > 0 && firstDataset.data[0].x) {
          // Create a map of category to timestamp
          const categoryMap = new Map();
          firstDataset.data.forEach(d => {
            if (d.x && d[xField]) {
              categoryMap.set(d[xField], d.x);
            }
          });
          
          // Sort by timestamp if available
          if (categoryMap.size > 0) {
            uniqueXValues.sort((a, b) => {
              const timeA = categoryMap.get(a) || 0;
              const timeB = categoryMap.get(b) || 0;
              return timeA - timeB;
            });
          } else {
            // Default string sorting
            uniqueXValues.sort();
          }
        } else {
          // Default string sorting
          uniqueXValues.sort();
        }
      }
      
      // Calculate bar dimensions
      const totalBarWidth = this.state.dimensions.innerWidth / uniqueXValues.length;
      const usableBarWidth = totalBarWidth * (1 - barSpacing);
      const actualBarWidth = usableBarWidth * barWidth;
      
      // For each unique X value, create a stacked bar
      uniqueXValues.forEach((xValue, xIndex) => {
        // Calculate bar x position
        const barX = xIndex * totalBarWidth + (totalBarWidth - actualBarWidth) / 2;
        
        // Keep track of the stack position (height)
        let stackTop = this.state.dimensions.innerHeight;
        
        // Process each dataset from bottom to top
        this.state.datasets.forEach((dataset, datasetIndex) => {
          // Find data point for this X value in this dataset
          const dataPoint = dataset.data.find(d => d[xField] === xValue);
          
          // Skip if no data point found
          if (!dataPoint) return;
          
          const value = dataPoint[yField] || 0;
          
          // Skip if value is 0
          if (value === 0) return;
          
          // Calculate Y positions
          const zeroY = this.state.scales.y.scale(0);
          const valueY = this.state.scales.y.scale(value);
          const barHeight = Math.abs(zeroY - valueY);
          
          // Calculate the new top of the stack
          const newStackTop = stackTop - barHeight;
          
          // Create bar element
          const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bar.setAttribute('x', barX);
          bar.setAttribute('y', newStackTop);
          bar.setAttribute('width', actualBarWidth);
          bar.setAttribute('height', Math.max(1, barHeight)); // Ensure at least 1px height
          bar.setAttribute('fill', dataset.color);
          bar.setAttribute('class', 'visioncharts-bar');
          
          // Add data attributes for tooltips
          bar.setAttribute('data-x', xValue);
          bar.setAttribute('data-y', value);
          bar.setAttribute('data-dataset', dataset.id);
          
          dataGroup.appendChild(bar);
          
          // Show values if enabled
          if (showValues) {
            const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            // Format large numbers with K/M suffix
            valueText.textContent = this.formatLargeNumber(value);
            
            // Position value based on option
            let valueX = barX + actualBarWidth / 2;
            let valueY;
            
            if (valuePosition === 'top') {
              valueY = newStackTop - 5;
            } else if (valuePosition === 'middle') {
              valueY = newStackTop + barHeight / 2;
            } else { // bottom
              valueY = newStackTop + barHeight - 5;
            }
            
            valueText.setAttribute('x', valueX);
            valueText.setAttribute('y', valueY);
            valueText.setAttribute('text-anchor', 'middle');
            valueText.setAttribute('font-size', '10px');
            valueText.setAttribute('font-family', this.options.fontFamily);
            valueText.setAttribute('fill', valuePosition === 'middle' ? '#fff' : this.options.textColor);
            valueText.setAttribute('class', 'visioncharts-bar-value');
            
            dataGroup.appendChild(valueText);
          }
          
          // Update stack top for next dataset
          stackTop = newStackTop;
        });
      });
      
      // Add data group to chart
      this.state.chart.appendChild(dataGroup);
      console.log('Data rendered successfully');
    } catch (error) {
      console.error('Error rendering data:', error);
    }
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
   * Render the chart
   * @public
   */
  render() {
    console.log('BarChart.render called');
    
    // Use the parent Chart class's render method
    return super.render();
  }
  
  /**
   * Render axes
   * @private
   */
  renderAxes() {
    console.log('BarChart.renderAxes called');
    
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
   * Update axes
   * @private
   */
  updateAxes() {
    console.log('BarChart.updateAxes called');
    
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
    console.log('BarChart.updateData called');
    
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
   * Update the chart
   * @public
   */
  update() {
    console.log('BarChart.update called');
    
    // Use the parent Chart class's update method
    return super.update();
  }
  
  /**
   * Toggle logarithmic scale
   * @public
   * @param {boolean} isLogarithmic - Whether to use logarithmic scale
   * @returns {BarChart} This chart instance
   */
  toggleLogarithmic(isLogarithmic) {
    console.log('BarChart.toggleLogarithmic called:', isLogarithmic);
    
    this.options.isLogarithmic = isLogarithmic;
    
    // Re-create Y scale based on type
    this.state.scales.y = isLogarithmic ? 
      new LogScale([0.1, 1], [0, 1]) :
      new LinearScale([0, 1], [0, 1]);
    
    return this.update();
  }
}
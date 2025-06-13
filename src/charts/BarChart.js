import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';

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

    const defaultBarChartOptions = {
      chartType: 'bar',
      xField: 'category', 
      yField: 'y',
      xType: 'time', 
      yType: 'number',
      barWidth: 0.7, 
      barSpacing: 0.2, 
      showValues: false, 
      valuePosition: 'top', 
      colors: ['#1468a8', '#34A853', '#FBBC05', '#EA4335'],
      stacked: true, 
      dateFormat: { year: 'numeric', month: 'short' },
      xFormatOptions: {
        year: 'numeric',
        month: 'short'
      },
      yFormatOptions: {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
      },
      skipLabels: 3, 
      grid: { 
        show: true,
        color: '#e0e0e0', 
        strokeWidth: 1,   
        dashArray: '4,4'  
      },
      isPanelView: false, // Changed from panelView to isPanelView
      timeBarPixelWidth: 10, // New option for panel time bars
      showZeroValueBars: true, // New option for panel bars
      // Options for recession lines (if used)
      // showRecessionLines: false,
      // recessions: [],
      // recessionLinesOptions: {},
    };

    // Merge options: user's config.options take precedence, with special handling for grid
    const mergedOptions = {
      ...defaultBarChartOptions,
      ...(config.options || {}), // Spread user's top-level options
      grid: { // Deep merge for the grid object
        ...defaultBarChartOptions.grid, // Start with BarChart's grid defaults
        ...((config.options && config.options.grid) || {}) // Override with user's grid options
      }
    };

    // Call parent constructor with the fully merged config
    super({
      ...config, // Pass through other parts of config like container, data
      options: mergedOptions // Use the carefully merged options
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
    if (this.options.isPanelView) { // Changed from panelView
      console.log('Panel view enabled, skipping main data rendering.');
      // Ensure a data group exists, even if empty, for consistency if other parts expect it
      const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      dataGroup.setAttribute('class', 'visioncharts-data');
      if (this.state.chart && !this.state.chart.querySelector('.visioncharts-data')) {
        this.state.chart.appendChild(dataGroup);
      }
      return;
    }
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
    // Call parent render method. This will set up the SVG, dimensions,
    // and call methods like createScales, renderTitle, renderLegend,
    // and (conditionally, due to our changes) renderAxes and renderData.
    super.render(); 

    if (this.options.isPanelView) { // Changed from panelView
      // If isPanelView is true, call renderPanels after super.render()
      // has prepared the main chart container.
      // renderPanels will draw its own axes and data per panel.
      this.renderPanels();
    }
    
    // Ensure hover elements (crosshair, tooltip) are rendered on top,
    // regardless of whether it's panel view or regular view.
    if (this.state.chart) {
      const crosshair = this.state.chart.querySelector('.visioncharts-crosshair');
      if (crosshair && crosshair.parentNode) {
        crosshair.parentNode.appendChild(crosshair);
      }
      
      const tooltip = this.state.chart.querySelector('.visioncharts-tooltip');
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.appendChild(tooltip);
      }
      
      const hoverPoints = this.state.chart.querySelector('.visioncharts-hover-points');
      if (hoverPoints && hoverPoints.parentNode) {
        hoverPoints.parentNode.appendChild(hoverPoints);
      }
    }
    
    return this;
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
  
  /**
   * Render panels for multi-panel view
   * @private
   */
  renderPanels() {
    console.log('BarChart.renderPanels called');
    
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
        } else if (xType === 'number') {
          // For numeric data
          const xMin = Math.min(...xValues);
          const xMax = Math.max(...xValues);
          xScale = new LinearScale([xMin, xMax], [0, innerWidth]);
        } else {
          // For category data, we need to set up a special domain
          const uniqueXValues = Array.from(new Set(xValues));
          
          // Sort based on original data order if possible
          if (dataset.data.length > 0 && dataset.data[0].x) {
            const categoryMap = new Map();
            dataset.data.forEach(d => {
              if (d.x && d[xField]) {
                categoryMap.set(d[xField], d.x);
              }
            });
            
            if (categoryMap.size > 0) {
              uniqueXValues.sort((a, b) => {
                const timeA = categoryMap.get(a) || 0;
                const timeB = categoryMap.get(b) || 0;
                return timeA - timeB;
              });
            }
          }
          
          // Setup a linear scale with domain that creates even spacing
          xScale = new LinearScale(
            [-0.5, uniqueXValues.length - 0.5],
            [0, innerWidth]
          );
          
          // Store unique values for bar positioning
          xScale._uniqueXValues = uniqueXValues;
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
          const yMin = 0; // Bar charts start at 0
          const yMax = Math.max(...yValues);
          const yPadding = yMax * 0.1;
          
          // Set domain based on scale type
          if (isLogarithmic) {
            yScale.setDomain([Math.max(0.01, yMin), yMax + yPadding]);
          } else {
            yScale.setDomain([yMin, yMax + yPadding]);
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
        
        // Render panel data - FIXED: Added missing datasetIndex parameter
        this.renderPanelData(panelGroup, dataset, xScale, yScale, effectivePanelHeight, index);
        
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
   * Render data for a panel - FIXED version
   * @private
   */
  renderPanelData(panel, dataset, xScale, yScale, panelHeight, datasetIndex = 0) {
    const { xField, yField, xType, timeBarPixelWidth, colors, showZeroValueBars } = this.options;
    
    if (!dataset.data || !dataset.data.length) return;
    
    const color = dataset.color || colors[datasetIndex % colors.length] || colors[0];
    
    if (xType === 'time') {
      // Time-based bars
      dataset.data.forEach(dataPoint => {
        const xValue = dataPoint[xField] instanceof Date ? dataPoint[xField] : new Date(dataPoint[xField]);
        const yValue = dataPoint[yField] || 0;
        if (yValue === 0 && !showZeroValueBars) return;
        
        const barCenter = xScale.scale(xValue);
        const actualBarWidth = (typeof timeBarPixelWidth === 'number' && timeBarPixelWidth > 0) ? timeBarPixelWidth : 10;
        const barX = barCenter - actualBarWidth / 2;
        
        const zeroY = yScale.scale(0);
        const valueY = yScale.scale(yValue);
        const barHeight = Math.abs(zeroY - valueY);
        const finalY = (yValue >= 0) ? valueY : zeroY;
        
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', barX);
        bar.setAttribute('y', finalY);
        bar.setAttribute('width', actualBarWidth);
        bar.setAttribute('height', Math.max(0, barHeight));
        bar.setAttribute('fill', color);
        bar.setAttribute('class', 'visioncharts-panel-bar');
        panel.appendChild(bar);
      });
    } else if (xType === 'category') {
      // Category bars using stored unique values
      const uniqueXValues = xScale._uniqueXValues || [];
      if (uniqueXValues.length === 0) return;
      
      const barWidth = xScale.range()[1] / uniqueXValues.length; // FIXED: Use range() method
      const actualBarWidth = barWidth * 0.8;
      
      dataset.data.forEach(dataPoint => {
        const xValue = dataPoint[xField];
        const yValue = dataPoint[yField] || 0;
        if (yValue === 0 && !showZeroValueBars) return;
        
        const xIndex = uniqueXValues.indexOf(xValue);
        if (xIndex === -1) return;
        
        const barX = xIndex * barWidth + (barWidth - actualBarWidth) / 2;
        
        const zeroY = yScale.scale(0);
        const valueY = yScale.scale(yValue);
        const barHeight = Math.abs(zeroY - valueY);
        const finalY = (yValue >= 0) ? valueY : zeroY;
        
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', barX);
        bar.setAttribute('y', finalY);
        bar.setAttribute('width', actualBarWidth);
        bar.setAttribute('height', Math.max(0, barHeight));
        bar.setAttribute('fill', color);
        bar.setAttribute('class', 'visioncharts-panel-bar');
        panel.appendChild(bar);
      });
    } else {
      // Numeric bars
      const barCount = dataset.data.length;
      if (barCount === 0) return;

      const rangeMax = xScale.range()[1]; // FIXED: Use range() method
      const categoryWidth = rangeMax / barCount;
      const actualBarWidth = categoryWidth * 0.8;
      
      dataset.data.forEach((dataPoint, i) => {
        const yValue = dataPoint[yField] || 0;
        if (yValue === 0 && !showZeroValueBars) return;
        
        const barX = i * categoryWidth + (categoryWidth - actualBarWidth) / 2;
        
        const zeroY = yScale.scale(0);
        const valueY = yScale.scale(yValue);
        const barHeight = Math.abs(zeroY - valueY);
        const finalY = (yValue >= 0) ? valueY : zeroY;
        
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', barX);
        bar.setAttribute('y', finalY);
        bar.setAttribute('width', actualBarWidth);
        bar.setAttribute('height', Math.max(0, barHeight));
        bar.setAttribute('fill', color);
        bar.setAttribute('class', 'visioncharts-panel-bar');
        panel.appendChild(bar);
      });
    }
  }
}
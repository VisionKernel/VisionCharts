import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber } from '../utils/chartUtils.js';
import StudiesRenderer from '../components/StudiesRenderer.js';
import PanelDataRenderer from '../components/PanelDataRenderer.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';
import Grid from '../components/Grid.js';
import Panel from '../components/Panel.js';

/**
 * BarChart class for rendering bar charts with time series data and studies support
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
      stacked: false, 
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
      isPanelView: false,
      timeBarPixelWidth: 10,
      showZeroValueBars: true,
      
      // Studies rendering options for BarChart
      studiesAsLines: true, // Render studies as lines overlaid on bars
      studyLineWidth: 2,
      studyPointRadius: 0, // No points by default for studies
      
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
   * Check if a dataset is a study/indicator
   * @private
   * @param {Object} dataset - Dataset to check
   * @returns {boolean} True if dataset is a study
   */
  isStudyDataset(dataset) {
    return StudiesRenderer.isStudyDataset(this, dataset);
  }

  /**
   * Get the study configuration for a dataset
   * @private
   * @param {Object} dataset - Dataset to get study config for
   * @returns {Object|null} Study configuration or null
   */
  getStudyConfig(dataset) {
    return StudiesRenderer.getStudyConfig(this, dataset);
  }
  
  /**
   * Render chart data - ENHANCED VERSION with studies support
   * @private
   */
  renderData() {
    if (this.options.isPanelView) {
      console.log('Panel view enabled, skipping main data rendering.');
      // Ensure a data group exists, even if empty, for consistency if other parts expect it
      const dataGroup = SvgRenderer.createGroup({ class: 'visioncharts-data' });
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
        valuePosition,
        stacked,
        studiesAsLines,
        studyLineWidth,
        studyPointRadius
      } = this.options;
      
      // Create data group using SvgRenderer
      const dataGroup = SvgRenderer.createGroup({ class: 'visioncharts-data' });
      
      // No data to render
      if (!this.state.datasets.length) {
        this.state.chart.appendChild(dataGroup);
        console.log('No datasets to render');
        return;
      }
      
      console.log('Rendering', this.state.datasets.length, 'datasets');
      
      // Separate bar datasets from study datasets
      const barDatasets = this.state.datasets.filter(dataset => !this.isStudyDataset(dataset));
      const studyDatasets = this.state.datasets.filter(dataset => this.isStudyDataset(dataset));
      
      console.log('Bar datasets:', barDatasets.length, 'Study datasets:', studyDatasets.length);
      
      // Render bars first (background)
      if (barDatasets.length > 0) {
        this.renderBarData(dataGroup, barDatasets);
      }
      
      // Render studies as lines (foreground)
      if (studyDatasets.length > 0 && studiesAsLines) {
        StudiesRenderer.renderForBarChart(this, studyDatasets, dataGroup);
      }
      
      // Add data group to chart
      this.state.chart.appendChild(dataGroup);
      console.log('Data rendered successfully');
    } catch (error) {
      console.error('Error rendering data:', error);
    }
  }
  
  /**
   * Render bar data (original bar rendering logic)
   * @private
   * @param {SVGElement} dataGroup - Data group to append to
   * @param {Array} barDatasets - Array of bar datasets
   */
  renderBarData(dataGroup, barDatasets) {
    const {
      xField,
      yField,
      barWidth,
      barSpacing,
      showValues,
      valuePosition,
      stacked
    } = this.options;
    
    // Get unique X values
    const allXValues = new Set();
    barDatasets.forEach(dataset => {
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
      const firstDataset = barDatasets[0];
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
    
    // Get zero line position
    const zeroY = this.state.scales.y.scale(0);
    
    // For each unique X value, create bars (stacked or grouped)
    uniqueXValues.forEach((xValue, xIndex) => {
      // Calculate bar x position
      const barX = xIndex * totalBarWidth + (totalBarWidth - actualBarWidth) / 2;
      
      if (stacked) {
        // FIXED: Proper stacking with separate positive/negative stacks
        let positiveStackTop = zeroY; // Start positive stack at zero line
        let negativeStackTop = zeroY; // Start negative stack at zero line
        
        // Process each dataset
        barDatasets.forEach((dataset, datasetIndex) => {
          // Find data point for this X value in this dataset
          const dataPoint = dataset.data.find(d => d[xField] === xValue);
          
          // Skip if no data point found
          if (!dataPoint) return;
          
          const value = dataPoint[yField] || 0;
          
          // Skip if value is 0
          if (value === 0) return;
          
          // Calculate bar dimensions based on positive/negative
          let barY, barHeight;
          
          if (value > 0) {
            // Positive value - stack upward from current positive stack top
            const valueY = this.state.scales.y.scale(value);
            barHeight = Math.abs(positiveStackTop - valueY);
            barY = valueY;
            
            // Update positive stack top for next positive bar
            positiveStackTop = valueY;
          } else {
            // Negative value - stack downward from current negative stack top
            const valueY = this.state.scales.y.scale(value);
            barHeight = Math.abs(negativeStackTop - valueY);
            barY = negativeStackTop;
            
            // Update negative stack top for next negative bar
            negativeStackTop = valueY;
          }
          
          // Create bar element using SvgRenderer
          const bar = SvgRenderer.createRect(
            barX,
            barY,
            actualBarWidth,
            Math.max(1, barHeight),
            {
              fill: dataset.color,
              class: 'visioncharts-bar',
              'data-x': xValue,
              'data-y': value,
              'data-dataset': dataset.id
            }
          );
          
          dataGroup.appendChild(bar);
          
          // Show values if enabled
          if (showValues) {
            // Position value based on option and whether value is positive/negative
            let valueX = barX + actualBarWidth / 2;
            let valueY;
            
            if (valuePosition === 'top') {
              valueY = value > 0 ? barY - 5 : barY + barHeight + 15;
            } else if (valuePosition === 'middle') {
              valueY = barY + barHeight / 2;
            } else { // bottom
              valueY = value > 0 ? barY + barHeight - 5 : barY - 5;
            }
            
            // Create value text using SvgRenderer
            const valueText = SvgRenderer.createText(
              formatLargeNumber(value),
              valueX,
              valueY,
              {
                'text-anchor': 'middle',
                'font-size': '10px',
                'font-family': this.options.fontFamily,
                fill: valuePosition === 'middle' ? '#fff' : this.options.textColor,
                class: 'visioncharts-bar-value'
              }
            );
            
            dataGroup.appendChild(valueText);
          }
        });
      } else {
        // FIXED: Non-stacked (grouped) bars with proper negative handling
        const barWidthPerDataset = actualBarWidth / barDatasets.length;
        
        barDatasets.forEach((dataset, datasetIndex) => {
          // Find data point for this X value in this dataset
          const dataPoint = dataset.data.find(d => d[xField] === xValue);
          
          // Skip if no data point found
          if (!dataPoint) return;
          
          const value = dataPoint[yField] || 0;
          
          // Skip if value is 0
          if (value === 0) return;
          
          // Calculate grouped bar position
          const groupedBarX = barX + (datasetIndex * barWidthPerDataset);
          
          // Calculate Y positions for positive/negative values
          const valueY = this.state.scales.y.scale(value);
          let barY, barHeight;
          
          if (value >= 0) {
            // Positive value - bar goes from zero line up to value
            barY = valueY;
            barHeight = Math.abs(zeroY - valueY);
          } else {
            // Negative value - bar goes from zero line down to value
            barY = zeroY;
            barHeight = Math.abs(zeroY - valueY);
          }
          
          // Create bar element using SvgRenderer
          const bar = SvgRenderer.createRect(
            groupedBarX,
            barY,
            barWidthPerDataset * 0.9, // Small gap between grouped bars
            Math.max(1, barHeight),
            {
              fill: dataset.color,
              class: 'visioncharts-bar',
              'data-x': xValue,
              'data-y': value,
              'data-dataset': dataset.id
            }
          );
          
          dataGroup.appendChild(bar);
          
          // Show values if enabled
          if (showValues) {
            // Position value based on option and whether value is positive/negative
            let valueX = groupedBarX + (barWidthPerDataset * 0.9) / 2;
            let valueY;
            
            if (valuePosition === 'top') {
              valueY = value >= 0 ? barY - 5 : barY + barHeight + 15;
            } else if (valuePosition === 'middle') {
              valueY = barY + barHeight / 2;
            } else { // bottom
              valueY = value >= 0 ? barY + barHeight - 5 : barY - 5;
            }
            
            // Create value text using SvgRenderer
            const valueText = SvgRenderer.createText(
              formatLargeNumber(value),
              valueX,
              valueY,
              {
                'text-anchor': 'middle',
                'font-size': '10px',
                'font-family': this.options.fontFamily,
                fill: valuePosition === 'middle' ? '#fff' : this.options.textColor,
                class: 'visioncharts-bar-value'
              }
            );
            
            dataGroup.appendChild(valueText);
          }
        });
      }
    });
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
   * Toggle studies rendering mode
   * @public
   * @param {boolean} studiesAsLines - Whether to render studies as lines
   * @returns {BarChart} This chart instance
   */
  toggleStudiesAsLines(studiesAsLines) {
    console.log('BarChart.toggleStudiesAsLines called:', studiesAsLines);
    
    this.options.studiesAsLines = Boolean(studiesAsLines);
    return this.update();
  }
  
  /**
   * Set study line width
   * @public
   * @param {number} width - Line width for studies
   * @returns {BarChart} This chart instance
   */
  setStudyLineWidth(width) {
    console.log('BarChart.setStudyLineWidth called:', width);
    
    this.options.studyLineWidth = Math.max(0.5, width);
    return this.update();
  }
  
  /**
   * Toggle study points
   * @public
   * @param {number} radius - Point radius (0 to disable)
   * @returns {BarChart} This chart instance
   */
  setStudyPointRadius(radius) {
    console.log('BarChart.setStudyPointRadius called:', radius);
    
    this.options.studyPointRadius = Math.max(0, radius);
    return this.update();
  }
}
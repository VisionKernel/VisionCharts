import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber } from '../utils/chartUtils.js';
import PathGenerator from '../utils/PathGenerator.js';
import StudiesRenderer from '../components/StudiesRenderer.js';
import PanelDataRenderer from '../components/PanelDataRenderer.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import RecessionLines from '../components/RecessionLines.js';
import ZeroLine from '../components/ZeroLine.js';
import Grid from '../components/Grid.js';
import Panel from '../components/Panel.js';

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
   * Create gradient definitions for area fills
   * @private
   */
  createGradients() {
  // Create defs element if it doesn't exist
  let defs = this.state.svg.querySelector('defs');
  if (!defs) {
    defs = SvgRenderer.createDefs();
    this.state.svg.insertBefore(defs, this.state.svg.firstChild);
  }
  
  // Create gradient for each dataset that has area enabled
  this.state.datasets.forEach(dataset => {
    if (!dataset.area) return; // Skip if area is not enabled for this dataset
    
    const gradientId = `area-gradient-${dataset.id}`;
    
    // Check if gradient already exists
    if (defs.querySelector(`#${gradientId}`)) return;
    
    // Create linear gradient with stops using SvgRenderer
    const gradient = SvgRenderer.createLinearGradient(gradientId, [
      { offset: '0%', color: dataset.color, opacity: 0.8 },
      { offset: '100%', color: dataset.color, opacity: 0.1 }
    ]);
    
    // Add gradient to defs
    defs.appendChild(gradient);
  });
}
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
    
    // Create data group using SvgRenderer
    const dataGroup = SvgRenderer.createGroup({ class: 'visioncharts-data' });
    
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
    
    // Separate regular datasets from study datasets
    const regularDatasets = this.state.datasets.filter(dataset => dataset.type !== 'study');
    const studyDatasets = this.state.datasets.filter(dataset => dataset.type === 'study');
    
    console.log('Regular datasets:', regularDatasets.length, 'Study datasets:', studyDatasets.length);
    
    // Render regular datasets first
    regularDatasets.forEach((dataset, index) => {
      if (!dataset.data || !dataset.data.length) {
        console.log('Dataset', index, 'has no data, skipping');
        return;
      }
      
      console.log('Rendering regular dataset', index, 'with', dataset.data.length, 'points', 
                'area enabled:', Boolean(dataset.area));
      
      // Create dataset group using SvgRenderer
      const datasetGroup = SvgRenderer.createGroup({ 
        class: `visioncharts-dataset-${dataset.id}` 
      });
      
      // Render area if enabled for this dataset
      if (dataset.area) {
        const areaPath = PathGenerator.generateAreaPath(dataset.data, this);
        if (areaPath) {
          const areaAttributes = {
            d: areaPath,
            stroke: 'none',
            class: 'visioncharts-area'
          };
          
          // Apply fill (either gradient or color)
          if (gradient) {
            areaAttributes.fill = `url(#area-gradient-${dataset.id})`;
          } else {
            areaAttributes.fill = dataset.color;
            areaAttributes['fill-opacity'] = dataset.areaOpacity || areaOpacity;
          }
          
          const areaElement = SvgRenderer.createPath(areaPath, areaAttributes);
          datasetGroup.appendChild(areaElement);
        }
      }
      
      // Render line using SvgRenderer
      const linePath = PathGenerator.generateLinePath(dataset.data, this);
      if (linePath) {
        const lineElement = SvgRenderer.createPath(linePath, {
          stroke: dataset.color,
          'stroke-width': dataset.width,
          fill: 'none',
          class: 'visioncharts-line'
        });
        
        datasetGroup.appendChild(lineElement);
      }
      
      // Render points if enabled
      if (showPoints) {
        const pointsGroup = SvgRenderer.createGroup({ class: 'visioncharts-points' });
        
        dataset.data.forEach(d => {
          if (d[xField] === undefined || d[yField] === undefined) return;
          
          const x = this.state.scales.x.scale(d[xField]);
          const y = this.state.scales.y.scale(d[yField]);
          
          const point = SvgRenderer.createCircle(x, y, pointRadius, {
            fill: '#fff',
            stroke: dataset.color,
            'stroke-width': dataset.width / 2,
            class: 'visioncharts-point'
          });
          
          pointsGroup.appendChild(point);
        });
        
        datasetGroup.appendChild(pointsGroup);
      }
      
      // Add to data group
      dataGroup.appendChild(datasetGroup);
    });
    
    // Render all study datasets at once (overlaid on top)
    if (studyDatasets.length > 0) {
      StudiesRenderer.renderForLineChart(this, studyDatasets, dataGroup);
    }
    
    // Add data group to chart
    this.state.chart.appendChild(dataGroup);
    console.log('Data rendered successfully');
  } catch (error) {
    console.error('Error rendering data:', error);
  }
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

  /**
   * Generate line path for dataset - UPDATED VERSION using PathGenerator
   * @private
   * @param {Array} data - Data array
   * @returns {string} SVG path definition
   */
  generateLinePath(data) {
    return PathGenerator.generateLinePath(data, this);
  }

  /**
   * Generate area path for dataset - UPDATED VERSION using PathGenerator
   * @private
   * @param {Array} data - Data array
   * @returns {string} SVG path definition
   */
  generateAreaPath(data) {
    return PathGenerator.generateAreaPath(data, this);
  }
}
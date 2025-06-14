import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber } from '../utils/chartUtils.js';
import StudiesRenderer from '../components/StudiesRenderer.js';
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
    
    // Generate path definition using SvgRenderer methods
    switch (curve) {
      case 'step':
        return SvgRenderer.stepPathDefinition(points);
      case 'cardinal':
        return SvgRenderer.cardinalPathDefinition(points, 0.5); // Default tension
      case 'monotone':
        return this.generateMonotonePath(points); // Keep custom implementation
      case 'linear':
      default:
        return SvgRenderer.linePathDefinition(points);
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
    
    // Map data points to coordinates (same as generateLinePath)
    const points = data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return '';
    
    // Use SvgRenderer for area path generation
    const baselineY = this.state.dimensions.innerHeight;
    return SvgRenderer.curvedAreaPathDefinition(points, baselineY, curve);
  }

  /**
   * Helper method to get data points as coordinates
   * @private
   * @param {Array} data - Chart data
   * @returns {Array} Array of [x, y] coordinate pairs
   */
  getDataPoints(data) {
    const { xField, yField } = this.options;
    const xScale = this.state.scales.x;
    const yScale = this.state.scales.y;
    
    return data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
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
        const areaPath = this.generateAreaPath(dataset.data);
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
      const linePath = this.generateLinePath(dataset.data);
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
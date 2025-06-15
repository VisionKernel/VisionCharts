import SvgRenderer from '../renderers/SvgRenderer.js';
import StudiesRenderer from './StudiesRenderer.js';
import PathGenerator from '../utils/PathGenerator.js';

/**
 * PanelDataRenderer - Centralized component for rendering data in panel mode
 * Handles rendering for both LineChart and BarChart in panel contexts
 */
export default class PanelDataRenderer {
  
  /**
   * Render data for a panel based on chart type
   * @param {Object} chart - Chart instance
   * @param {SVGElement} panel - Panel container
   * @param {Object} dataset - Dataset to render
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelHeight - Panel height
   * @param {number} datasetIndex - Dataset index for color selection (optional)
   */
  static renderForPanel(chart, panel, dataset, xScale, yScale, panelHeight, datasetIndex = 0) {
    console.log('PanelDataRenderer.renderForPanel called for chart type:', chart.options.chartType);
    
    if (!dataset.data || !dataset.data.length) {
      console.log('No data to render for dataset:', dataset.id);
      return;
    }
    
    // Check if this is a study dataset and delegate to StudiesRenderer
    if (StudiesRenderer.isStudyDataset(chart, dataset)) {
      if (chart.options.studiesAsLines !== false) {
        StudiesRenderer.renderForPanel(chart, dataset, panel, xScale, yScale, panelHeight);
      }
      return;
    }
    
    // Render based on chart type
    switch (chart.options.chartType) {
      case 'line':
        this.renderLineDataForPanel(chart, panel, dataset, xScale, yScale, panelHeight);
        break;
      case 'bar':
        this.renderBarDataForPanel(chart, panel, dataset, xScale, yScale, panelHeight, datasetIndex);
        break;
      default:
        console.warn('Unknown chart type for panel rendering:', chart.options.chartType);
        break;
    }
  }
  
  /**
   * Render line/area data for a panel
   * @private
   * @param {Object} chart - Chart instance
   * @param {SVGElement} panel - Panel container
   * @param {Object} dataset - Dataset to render
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelHeight - Panel height
   */
  static renderLineDataForPanel(chart, panel, dataset, xScale, yScale, panelHeight) {
    const { xField, yField, curve, showPoints, pointRadius, areaOpacity, gradient } = chart.options;
    
    console.log('Rendering line data for panel, dataset:', dataset.id);
    
    // Map data points to coordinates using panel-specific scales
    const points = dataset.data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) {
      console.log('No valid points for line rendering');
      return;
    }
    
    // Render area if enabled for this dataset
    if (dataset.area) {
      this.renderAreaForPanel(chart, panel, dataset, points, panelHeight, gradient, areaOpacity);
    }
    
    // Generate and render line path based on curve type
    const pathD = this.generateLinePathForPanel(points, curve);
    if (pathD) {
      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lineElement.setAttribute('d', pathD);
      lineElement.setAttribute('stroke', dataset.color);
      lineElement.setAttribute('stroke-width', dataset.width);
      lineElement.setAttribute('fill', 'none');
      lineElement.setAttribute('class', 'visioncharts-panel-line');
      panel.appendChild(lineElement);
    }
    
    // Render points if enabled
    if (showPoints) {
      this.renderPointsForPanel(chart, panel, dataset, xScale, yScale, pointRadius);
    }
  }
  
  /**
   * Render bar data for a panel
   * @private
   * @param {Object} chart - Chart instance
   * @param {SVGElement} panel - Panel container
   * @param {Object} dataset - Dataset to render
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelHeight - Panel height
   * @param {number} datasetIndex - Dataset index for color selection
   */
  static renderBarDataForPanel(chart, panel, dataset, xScale, yScale, panelHeight, datasetIndex) {
    const { xField, yField, xType, timeBarPixelWidth, colors, showZeroValueBars } = chart.options;
    
    console.log('Rendering bar data for panel, dataset:', dataset.id, 'xType:', xType);
    
    const color = dataset.color || colors[datasetIndex % colors.length] || colors[0];
    const zeroY = yScale.scale(0);
    
    if (xType === 'time') {
      this.renderTimeBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, timeBarPixelWidth, showZeroValueBars);
    } else if (xType === 'category') {
      this.renderCategoryBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, showZeroValueBars);
    } else {
      this.renderNumericBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, showZeroValueBars);
    }
  }
  
  /**
   * Render area for panel (line chart)
   * @private
   */
  static renderAreaForPanel(chart, panel, dataset, points, panelHeight, gradient, areaOpacity) {
    console.log('Rendering area for panel');
    
    const pathD = this.generateLinePathForPanel(points, chart.options.curve);
    
    if (pathD) {
      // Complete area path
      const [firstPoint] = points;
      const [firstX] = firstPoint;
      const [lastPoint] = [...points].reverse();
      const [lastX] = lastPoint;
      
      const areaPath = `${pathD} L ${lastX},${panelHeight} L ${firstX},${panelHeight} Z`;
      
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
  
  /**
   * Render points for panel (line chart)
   * @private
   */
  static renderPointsForPanel(chart, panel, dataset, xScale, yScale, pointRadius) {
    const { xField, yField } = chart.options;
    
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
  
  /**
   * Render time-based bars for panel
   * @private
   */
  static renderTimeBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, timeBarPixelWidth, showZeroValueBars) {
    const { xField, yField } = chart.options;
    
    dataset.data.forEach(dataPoint => {
      const xValue = dataPoint[xField] instanceof Date ? dataPoint[xField] : new Date(dataPoint[xField]);
      const yValue = dataPoint[yField] || 0;
      if (yValue === 0 && !showZeroValueBars) return;
      
      const barCenter = xScale.scale(xValue);
      const actualBarWidth = (typeof timeBarPixelWidth === 'number' && timeBarPixelWidth > 0) ? timeBarPixelWidth : 10;
      const barX = barCenter - actualBarWidth / 2;
      
      // Calculate bar position and height
      const { barY, barHeight } = this.calculateBarDimensions(yValue, yScale.scale(yValue), zeroY);
      
      // Create bar using SvgRenderer
      const bar = SvgRenderer.createRect(
        barX,
        barY,
        actualBarWidth,
        Math.max(0, barHeight),
        {
          fill: color,
          class: 'visioncharts-panel-bar',
          'data-x': xValue,
          'data-y': yValue
        }
      );
      
      panel.appendChild(bar);
    });
  }
  
  /**
   * Render category-based bars for panel
   * @private
   */
  static renderCategoryBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, showZeroValueBars) {
    const { xField, yField } = chart.options;
    
    // Category bars using stored unique values
    const uniqueXValues = xScale._uniqueXValues || [];
    if (uniqueXValues.length === 0) return;
    
    const barWidth = xScale.range()[1] / uniqueXValues.length;
    const actualBarWidth = barWidth * 0.8;
    
    dataset.data.forEach(dataPoint => {
      const xValue = dataPoint[xField];
      const yValue = dataPoint[yField] || 0;
      if (yValue === 0 && !showZeroValueBars) return;
      
      const xIndex = uniqueXValues.indexOf(xValue);
      if (xIndex === -1) return;
      
      const barX = xIndex * barWidth + (barWidth - actualBarWidth) / 2;
      
      // Calculate bar position and height
      const { barY, barHeight } = this.calculateBarDimensions(yValue, yScale.scale(yValue), zeroY);
      
      // Create bar using SvgRenderer
      const bar = SvgRenderer.createRect(
        barX,
        barY,
        actualBarWidth,
        Math.max(0, barHeight),
        {
          fill: color,
          class: 'visioncharts-panel-bar',
          'data-x': xValue,
          'data-y': yValue
        }
      );
      
      panel.appendChild(bar);
    });
  }
  
  /**
   * Render numeric bars for panel
   * @private
   */
  static renderNumericBarsForPanel(chart, panel, dataset, xScale, yScale, zeroY, color, showZeroValueBars) {
    const { yField } = chart.options;
    
    const barCount = dataset.data.length;
    if (barCount === 0) return;

    const rangeMax = xScale.range()[1];
    const categoryWidth = rangeMax / barCount;
    const actualBarWidth = categoryWidth * 0.8;
    
    dataset.data.forEach((dataPoint, i) => {
      const yValue = dataPoint[yField] || 0;
      if (yValue === 0 && !showZeroValueBars) return;
      
      const barX = i * categoryWidth + (categoryWidth - actualBarWidth) / 2;
      
      // Calculate bar position and height
      const { barY, barHeight } = this.calculateBarDimensions(yValue, yScale.scale(yValue), zeroY);
      
      // Create bar using SvgRenderer
      const bar = SvgRenderer.createRect(
        barX,
        barY,
        actualBarWidth,
        Math.max(0, barHeight),
        {
          fill: color,
          class: 'visioncharts-panel-bar',
          'data-x': i,
          'data-y': yValue
        }
      );
      
      panel.appendChild(bar);
    });
  }
  
  /**
   * Calculate bar dimensions for positive/negative values
   * @private
   * @param {number} yValue - Y value
   * @param {number} valueY - Scaled Y position of value
   * @param {number} zeroY - Scaled Y position of zero line
   * @returns {Object} Object with barY and barHeight
   */
  static calculateBarDimensions(yValue, valueY, zeroY) {
    let barY, barHeight;
    
    if (yValue >= 0) {
      // Positive value - bar goes from zero up to value
      barY = valueY;
      barHeight = Math.abs(zeroY - valueY);
    } else {
      // Negative value - bar goes from zero down to value
      barY = zeroY;
      barHeight = Math.abs(zeroY - valueY);
    }
    
    return { barY, barHeight };
  }
  
  /**
   * Generate line path for panel based on curve type - UPDATED to use PathGenerator
   * @private
   * @param {Array} points - Array of [x, y] coordinates
   * @param {string} curve - Curve type
   * @returns {string} SVG path definition
   */
  static generateLinePathForPanel(points, curve) {
    if (points.length === 0) return '';
    
    switch (curve) {
      case 'step':
        return PathGenerator.generateStepPath(points);
      case 'cardinal':
        return PathGenerator.generateCardinalPath(points);
      case 'monotone':
        return PathGenerator.generateMonotonePath(points);
      case 'linear':
      default:
        return PathGenerator.generateLinearPath(points);
    }
  }
}
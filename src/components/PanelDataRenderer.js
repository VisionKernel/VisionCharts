import SvgRenderer from '../renderers/SvgRenderer.js';
import StudiesRenderer from './StudiesRenderer.js';
import PathGenerator from '../utils/PathGenerator.js';
import EndingLabels from './EndingLabels.js';

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

  static renderForPanel(chart, panel, dataset, xScale, yScale, panelHeight, panelWidth, datasetIndex = 0) {
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
    
    // FIXED: Create a properly clipped data area for this panel
    const dataGroup = this.createClippedDataGroup(panel, panelWidth, panelHeight, dataset.id);
    
    // Render based on chart type
    switch (chart.options.chartType) {
      case 'line':
        this.renderLineDataForPanel(chart, dataGroup, dataset, xScale, yScale, panelHeight, panelWidth);
        break;
      case 'bar':
        this.renderBarDataForPanel(chart, dataGroup, dataset, xScale, yScale, panelHeight, datasetIndex);
        break;
      default:
        console.warn('Unknown chart type for panel rendering:', chart.options.chartType);
        break;
    }
    
    // Add the data group to the panel
    panel.appendChild(dataGroup);
    
    // FIXED: Render ending labels OUTSIDE the clipped data group to avoid clipping
    if (chart.options.showEndingLabels) {
      console.log('PanelDataRenderer: Rendering ending label for dataset:', dataset.id, 'outside clipped area');
      EndingLabels.renderForPanel(
        chart, 
        dataset, 
        panel, // Render directly on panel, not dataGroup
        xScale, 
        yScale,
        chart.options.endingLabelsConfig || {}
      );
    }
  }

  /**
   * Create a clipped data group with proper boundaries (no overflow padding)
   * FIXED: Remove padding that was causing overflow
   */
  static createClippedDataGroup(panel, panelWidth, panelHeight, datasetId) {
    // Create unique clip path ID
    const clipPathId = `panel-data-clip-${datasetId}-${Date.now()}`;
    
    // Get or create defs element
    let defs = panel.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      panel.appendChild(defs);
    }
    
    // FIXED: Create clip path that EXACTLY matches panel boundaries
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipPathId);
    
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', '0'); // FIXED: No negative padding
    clipRect.setAttribute('y', '0'); // FIXED: No negative padding
    clipRect.setAttribute('width', panelWidth); // FIXED: Exact panel width
    clipRect.setAttribute('height', panelHeight); // FIXED: Exact panel height
    
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    
    // Create data group with clipping
    const dataGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dataGroup.setAttribute('class', 'visioncharts-panel-data');
    dataGroup.setAttribute('clip-path', `url(#${clipPathId})`);
    
    return dataGroup;
  }
  
  /**
   * Render line/area data for a panel
   * @private
   * @param {Object} chart - Chart instance
   * @param {SVGElement} dataGroup - Clipped data container
   * @param {Object} dataset - Dataset to render
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelHeight - Panel height
   */
  static renderLineDataForPanel(chart, dataGroup, dataset, xScale, yScale, panelHeight, panelWidth) {
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
      this.renderAreaForPanel(chart, dataGroup, dataset, points, panelHeight, panelWidth, gradient, areaOpacity, yScale);
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
      dataGroup.appendChild(lineElement);
    }
    
    // Render points if enabled
    if (showPoints) {
      this.renderPointsForPanel(chart, dataGroup, dataset, xScale, yScale, pointRadius);
    }
    
    // REMOVED: Ending labels now rendered outside clipped area in main renderForPanel method
  }
  
  /**
   * Render bar data for a panel
   * FIXED: Better bar positioning and bounds checking
   */
  static renderBarDataForPanel(chart, dataGroup, dataset, xScale, yScale, panelHeight, datasetIndex) {
    const { xField, yField, xType, timeBarPixelWidth, colors, showZeroValueBars } = chart.options;
    
    console.log('Rendering bar data for panel, dataset:', dataset.id, 'xType:', xType);
    
    const color = dataset.color || colors[datasetIndex % colors.length] || colors[0];
    const zeroY = yScale.scale(0);
    
    // FIXED: Clamp zero line to panel bounds
    const clampedZeroY = Math.max(0, Math.min(panelHeight, zeroY));
    
    if (xType === 'time') {
      this.renderTimeBarsForPanel(chart, dataGroup, dataset, xScale, yScale, clampedZeroY, color, timeBarPixelWidth, showZeroValueBars, panelHeight);
    } else {
      this.renderNumericBarsForPanel(chart, dataGroup, dataset, xScale, yScale, clampedZeroY, color, showZeroValueBars, panelHeight);
    }
    
    // REMOVED: Ending labels now rendered outside clipped area in main renderForPanel method
  }
  
  /**
   * Render area for panel with proper boundary constraints
   * @private
   */
  static renderAreaForPanel(chart, dataGroup, dataset, points, panelHeight, panelWidth, gradient, areaOpacity, yScale) {
    if (points.length === 0) return;
    
    const pathD = this.generateLinePathForPanel(points, chart.options.curve);
    if (!pathD) return;
    
    // Calculate baseline Y position
    const baselineY = yScale.scale(0);
    
    // FIXED: Constrain first and last X coordinates to chart boundaries
    const firstX = Math.max(0, Math.min(panelWidth, points[0][0])); // Clamp to [0, panelWidth]
    const lastX = Math.max(0, Math.min(panelWidth, points[points.length - 1][0])); // Clamp to [0, panelWidth]
    
    // Create area path - close the path to form a filled area
    // Use constrained coordinates to prevent overflow
    const areaPath = `${pathD} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
    
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
    
    dataGroup.appendChild(areaElement);
  }
  
  /**
   * Render points for panel (line chart)
   * @private
   */
  static renderPointsForPanel(chart, dataGroup, dataset, xScale, yScale, pointRadius) {
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
      
      dataGroup.appendChild(point);
    });
  }
  
  /**
   * Render time-based bars for panel - FIXED VERSION
   */
  static renderTimeBarsForPanel(chart, dataGroup, dataset, xScale, yScale, zeroY, color, timeBarPixelWidth, showZeroValueBars, panelHeight) {
    const { xField, yField } = chart.options;
    
    dataset.data.forEach(dataPoint => {
      const xValue = dataPoint[xField] instanceof Date ? dataPoint[xField] : new Date(dataPoint[xField]);
      const yValue = dataPoint[yField] || 0;
      if (yValue === 0 && !showZeroValueBars) return;
      
      const barCenter = xScale.scale(xValue);
      const actualBarWidth = (typeof timeBarPixelWidth === 'number' && timeBarPixelWidth > 0) ? timeBarPixelWidth : 10;
      const barX = barCenter - actualBarWidth / 2;
      
      // FIXED: Calculate bar position and height with proper bounds checking
      const { barY, barHeight } = this.calculateBarDimensionsWithBounds(yValue, yScale.scale(yValue), zeroY, panelHeight);
      
      // Create bar only if it has valid dimensions and is within bounds
      if (barHeight > 0 && barY >= -10 && barY < panelHeight + 10) {
        const bar = SvgRenderer.createRect(
          barX,
          barY,
          actualBarWidth,
          barHeight,
          {
            fill: color,
            class: 'visioncharts-panel-bar',
            'data-x': xValue,
            'data-y': yValue
          }
        );
        
        dataGroup.appendChild(bar);
      }
    });
  }
  
  /**
   * Render numeric bars for panel - FIXED VERSION
   */
  static renderNumericBarsForPanel(chart, dataGroup, dataset, xScale, yScale, zeroY, color, showZeroValueBars, panelHeight) {
    const { yField } = chart.options;
    
    const barCount = dataset.data.length;
    if (barCount === 0) return;

    // FIXED: Better bar width calculation
    const rangeMax = xScale.range[1];
    const categoryWidth = rangeMax / barCount;
    const actualBarWidth = categoryWidth * 0.8;
    
    dataset.data.forEach((dataPoint, i) => {
      const yValue = dataPoint[yField] || 0;
      if (yValue === 0 && !showZeroValueBars) return;
      
      const barX = i * categoryWidth + (categoryWidth - actualBarWidth) / 2;
      
      // FIXED: Calculate bar position and height with proper bounds checking
      const { barY, barHeight } = this.calculateBarDimensionsWithBounds(yValue, yScale.scale(yValue), zeroY, panelHeight);
      
      // Create bar only if it has valid dimensions and is within bounds
      if (barHeight > 0 && barY >= -10 && barY < panelHeight + 10) {
        const bar = SvgRenderer.createRect(
          barX,
          barY,
          actualBarWidth,
          barHeight,
          {
            fill: color,
            class: 'visioncharts-panel-bar',
            'data-x': i,
            'data-y': yValue
          }
        );
        
        dataGroup.appendChild(bar);
      }
    });
  }
  
  /**
   * Calculate bar dimensions for positive/negative values - FIXED VERSION with bounds checking
   * @private
   * @param {number} yValue - Y value
   * @param {number} valueY - Scaled Y position of value
   * @param {number} zeroY - Scaled Y position of zero line
   * @param {number} panelHeight - Panel height for bounds checking
   * @returns {Object} Object with barY and barHeight
   */
  static calculateBarDimensionsWithBounds(yValue, valueY, zeroY, panelHeight) {
    let barY, barHeight;
    
    if (yValue >= 0) {
      // Positive value - bar goes from zero up to value
      barY = Math.max(0, Math.min(panelHeight, valueY));
      barHeight = Math.abs(zeroY - valueY);
    } else {
      // Negative value - bar goes from zero down to value  
      barY = Math.max(0, Math.min(panelHeight, zeroY));
      barHeight = Math.abs(zeroY - valueY);
    }
    
    // FIXED: Ensure bars don't extend beyond panel bounds
    if (barY + barHeight > panelHeight) {
      barHeight = Math.max(1, panelHeight - barY);
    }
    
    if (barY < 0) {
      barHeight = Math.max(1, barHeight + barY);
      barY = 0;
    }
    
    return { 
      barY: barY, 
      barHeight: Math.max(1, barHeight) // Minimum 1px height for visibility
    };
  }
  
  /**
   * Calculate bar dimensions for positive/negative values - ORIGINAL VERSION (kept for compatibility)
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
    
    // FIXED: Ensure valid dimensions without overly restrictive bounds
    return { 
      barY: barY, 
      barHeight: Math.max(1, barHeight) // Minimum 1px height for visibility
    };
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
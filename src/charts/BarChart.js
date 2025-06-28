import Chart from '../core/Chart.js';
import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import { formatLargeNumber } from '../utils/chartUtils.js';
import StudiesRenderer from '../components/StudiesRenderer.js';
import PanelDataRenderer from '../components/PanelDataRenderer.js';
import Panel from '../components/Panel.js';
import EndingLabels from '../components/EndingLabels.js';
import Grid from '../components/Grid.js';

// Legacy import for backwards compatibility
import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * BarChart - Enhanced multi-renderer bar chart implementation
 * 
 * Provides high-performance bar chart rendering with automatic renderer selection,
 * batch rectangle operations, and intelligent optimization for large datasets.
 */
export default class BarChart extends Chart {
  constructor(config) {
    console.log('BarChart constructor called with multi-renderer support');

    // Define BarChart-specific default options
    const defaultBarChartOptions = {
      chartType: 'bar',
      xField: 'x',
      yField: 'y',
      xType: 'category',  // 'category', 'time', or 'number'
      yType: 'number',
      
      // Bar appearance
      barWidth: null,     // Auto-calculated if null
      barSpacing: 0.1,    // Spacing between bars (0-1)
      barMinWidth: 2,     // Minimum bar width in pixels
      barMaxWidth: 100,   // Maximum bar width in pixels
      
      // Stacked bars
      stacked: false,
      stackOrder: 'none', // 'none', 'ascending', 'descending'
      
      // Value labels
      showValues: false,
      valuePosition: 'top', // 'top', 'middle', 'bottom'
      valueFormat: 'auto',  // 'auto', 'short', 'full'
      valueFontSize: '10px',
      
      // Time-specific options
      timeBarPixelWidth: 20,  // Default bar width for time charts
      timeBarAlignment: 'center', // 'left', 'center', 'right'
      
      // Zero values
      showZeroValueBars: true,
      zeroBarHeight: 1, // Minimum height for zero value bars
      
      // Colors
      colors: ['#1468a8', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#34495e'],
      
      // Studies integration
      studiesAsLines: true,
      studyLineWidth: 2,
      studyPointRadius: 3,
      
      // Grid configuration
      grid: {
        show: true,
        color: '#e0e0e0',
        strokeWidth: 1,
        dashArray: '2,2'
      },
      
      // Format options
      xFormatOptions: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      yFormatOptions: {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
      },
      
      // Performance optimizations for BarChart
      enableBatchRendering: true,
      optimizeForLargeDatasets: true,
      adaptiveValueLabels: true, // Hide value labels for large datasets
      
      // Multi-renderer specific options
      preferWebGLThreshold: 10000, // Switch to WebGL for 10K+ bars total
      batchRectThreshold: 500,     // Use batch rect rendering for 500+ bars
      adaptiveBarWidth: true       // Automatically adjust bar width for performance
    };

    // Deep merge options, preserving existing configuration merging logic
    const mergedOptions = {
      ...defaultBarChartOptions,
      ...(config.options || {}),
      
      // Deep merge for complex objects
      grid: {
        ...defaultBarChartOptions.grid,
        ...((config.options && config.options.grid) || {})
      }
    };

    // Call parent constructor with merged configuration
    super({
      ...config,
      options: mergedOptions
    });
    
    // BarChart-specific state
    this.barChartState = {
      barDimensions: new Map(),    // Cache bar dimensions for performance
      valueLabels: new Map(),      // Track value label elements
      barElements: new Map(),      // Track bar elements for interaction
      batchGroups: new Map(),      // Batch rendering groups
      calculatedBarWidth: null,    // Computed optimal bar width
      xCategories: [],             // Cached X categories for performance
      stackedData: new Map()       // Processed stacked data
    };
    
    // Performance tracking for BarChart
    this.barPerformanceMetrics = {
      barCalculationTime: 0,
      barRenderingTime: 0,
      valueLabelsRenderingTime: 0,
      totalBars: 0,
      batchesUsed: 0
    };
    
    console.log('BarChart constructor finished with multi-renderer support');
  }

  /**
   * Enhanced render method for BarChart
   * @returns {BarChart} This chart instance
   */
  async render() {
    console.log('BarChart.render called with multi-renderer support');
    
    // Call parent render method to setup renderer and basic structure
    await super.render();
    
    // BarChart-specific post-render setup
    this._setupBarChartOptimizations();
    
    return this;
  }

  /**
   * Render chart data - enhanced for multi-renderer support
   * @override
   */
  renderData() {
    if (this.options.isPanelView) {
      console.log('Panel view enabled, skipping main data rendering.');
      // Ensure a data group exists for consistency
      const dataGroup = this.renderer.createGroup({ class: 'visioncharts-data' });
      return;
    }
    
    console.log('BarChart.renderData called with multi-renderer support');
    
    if (!this.renderer || !this.state.chart) {
      console.error('Cannot render data: renderer or chart element not available');
      return;
    }
    
    const startTime = performance.now();
    
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
      
      // Create data group using current renderer
      const dataGroup = this.renderer.createGroup({ class: 'visioncharts-data' });
      
      // No data to render
      if (!this.config.datasets || !this.config.datasets.length) {
        console.log('No datasets to render');
        return;
      }
      
      // Calculate total bars for performance tracking
      let totalBars = 0;
      this.config.datasets.forEach(dataset => {
        if (dataset.data && !this.isStudyDataset(dataset)) {
          totalBars += dataset.data.length;
        }
      });
      
      this.barPerformanceMetrics.totalBars = totalBars;
      
      console.log(`Rendering ${this.config.datasets.length} datasets with ${totalBars} total bars using ${this.rendererMetadata?.type} renderer`);
      
      // Separate bar datasets from study datasets
      const barDatasets = this.config.datasets.filter(dataset => !this.isStudyDataset(dataset));
      const studyDatasets = this.config.datasets.filter(dataset => this.isStudyDataset(dataset));
      
      console.log(`Bar datasets: ${barDatasets.length}, Study datasets: ${studyDatasets.length}`);
      
      // Pre-calculate bar dimensions and categories
      this._precalculateBarDimensions(barDatasets);
      
      // Render bars
      if (barDatasets.length > 0) {
        if (stacked) {
          this._renderStackedBars(barDatasets, dataGroup);
        } else {
          this._renderGroupedBars(barDatasets, dataGroup);
        }
      }
      
      // Render study datasets as lines
      if (studyDatasets.length > 0 && studiesAsLines) {
        this._renderStudyDatasets(studyDatasets, dataGroup);
      }
      
      // Add data group to chart
      if (dataGroup.element) {
        this.state.chart.appendChild ? this.state.chart.appendChild(dataGroup.element) : null;
      }
      
      // Render ending labels if enabled
      if (this.options.showEndingLabels) {
        this._renderEndingLabels(dataGroup);
      }
      
      // Update performance metrics
      const renderTime = performance.now() - startTime;
      this.barPerformanceMetrics.barRenderingTime = renderTime;
      
      console.log(`BarChart data rendered in ${renderTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Error rendering BarChart data:', error);
      
      // Fallback to legacy SVG rendering if multi-renderer fails
      this._renderDataFallback();
    }
  }

  /**
   * Create and configure axes for BarChart - enhanced
   * @override
   */
  createAxes() {
    console.log('BarChart.createAxes called');
    
    // Call parent method to create basic axes
    super.createAxes();
    
    // Add BarChart-specific axis configuration
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setOptions({
        tickCount: this.options.xTickCount || (this.options.xType === 'time' ? 6 : Math.min(10, this.barChartState.xCategories.length)),
        formatType: this.options.xType === 'time' ? 'time' : (this.options.xType === 'category' ? 'category' : 'number'),
        formatOptions: this.options.xFormatOptions || {}
      });
    }
    
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setOptions({
        tickCount: this.options.yTickCount || 5,
        isLogarithmic: this.options.isLogarithmic || false,
        formatOptions: this.options.yFormatOptions || {}
      });
    }
  }

  /**
   * Update axes - enhanced for multi-renderer
   * @override
   */
  updateAxes() {
    console.log('BarChart.updateAxes called');
    
    if (!this.state.rendered || !this.state.chart) {
      console.warn('Cannot update axes: chart not rendered');
      return;
    }
    
    const { innerWidth, innerHeight } = this.state.dimensions;
    
    // Update X axis
    if (this.state.components.axes?.x) {
      this.state.components.axes.x.setScale(this.state.scales.x);
      this.state.components.axes.x.setOptions({
        formatType: this.options.xType === 'time' ? 'time' : (this.options.xType === 'category' ? 'category' : 'number'),
        formatOptions: this.options.xFormatOptions || {}
      });
      this.state.components.axes.x.update(innerWidth, innerHeight);
    }
    
    // Update Y axis
    if (this.state.components.axes?.y) {
      this.state.components.axes.y.setScale(this.state.scales.y);
      this.state.components.axes.y.setOptions({
        isLogarithmic: this.options.isLogarithmic || false,
        formatType: this.options.yType === 'time' ? 'time' : 'number',
        formatOptions: this.options.yFormatOptions || {}
      });
      this.state.components.axes.y.update(innerWidth, innerHeight);
    }
    
    // Update grid if enabled
    if (this.state.components.grid && this.options.grid?.show) {
      this.state.components.grid.update(
        this.state.scales.x,
        this.state.scales.y,
        innerWidth,
        innerHeight,
        this.options
      );
    }
  }

  // ===== BAR RENDERING METHODS =====

  /**
   * Pre-calculate bar dimensions for performance
   * @private
   */
  _precalculateBarDimensions(barDatasets) {
    const startTime = performance.now();
    
    const { xField, xType, barWidth, barSpacing, timeBarPixelWidth } = this.options;
    
    // Get unique X values across all datasets
    const allXValues = new Set();
    barDatasets.forEach(dataset => {
      dataset.data.forEach(d => {
        if (d[xField] !== undefined) {
          allXValues.add(d[xField]);
        }
      });
    });
    
    this.barChartState.xCategories = Array.from(allXValues);
    
    // Sort X values based on type
    if (xType === 'time') {
      this.barChartState.xCategories.sort((a, b) => {
        const dateA = a instanceof Date ? a : new Date(a);
        const dateB = b instanceof Date ? b : new Date(b);
        return dateA.getTime() - dateB.getTime();
      });
    } else if (xType === 'number') {
      this.barChartState.xCategories.sort((a, b) => a - b);
    }
    
    // Calculate optimal bar width
    if (xType === 'time') {
      this.barChartState.calculatedBarWidth = timeBarPixelWidth;
    } else {
      const availableWidth = this.state.dimensions.innerWidth;
      const categoryCount = this.barChartState.xCategories.length;
      const datasetCount = barDatasets.length;
      
      if (barWidth) {
        this.barChartState.calculatedBarWidth = barWidth;
      } else if (categoryCount > 0) {
        const categoryWidth = availableWidth / categoryCount;
        const maxBarWidth = categoryWidth * (1 - barSpacing) / datasetCount;
        
        // Apply min/max constraints
        this.barChartState.calculatedBarWidth = Math.max(
          this.options.barMinWidth,
          Math.min(this.options.barMaxWidth, maxBarWidth)
        );
      } else {
        this.barChartState.calculatedBarWidth = 20; // Default fallback
      }
    }
    
    this.barPerformanceMetrics.barCalculationTime = performance.now() - startTime;
    
    console.log(`Pre-calculated dimensions: ${this.barChartState.xCategories.length} categories, bar width: ${this.barChartState.calculatedBarWidth}`);
  }

  /**
   * Render grouped (non-stacked) bars
   * @private
   */
  _renderGroupedBars(barDatasets, dataGroup) {
    const shouldUseBatchRendering = this._shouldUseBatchRendering(barDatasets);
    
    if (shouldUseBatchRendering) {
      this._renderGroupedBarsBatched(barDatasets, dataGroup);
    } else {
      this._renderGroupedBarsIndividual(barDatasets, dataGroup);
    }
  }

  /**
   * Render grouped bars individually (preserves existing logic)
   * @private
   */
  _renderGroupedBarsIndividual(barDatasets, dataGroup) {
    const { xField, yField, colors, showValues, valuePosition, showZeroValueBars } = this.options;
    
    barDatasets.forEach((dataset, datasetIndex) => {
      if (!dataset.data || !dataset.data.length) {
        console.log(`Dataset ${dataset.id} has no data, skipping`);
        return;
      }
      
      console.log(`Rendering individual bars for dataset ${dataset.id}`);
      
      const color = dataset.color || colors[datasetIndex % colors.length];
      const datasetGroup = this.renderer.createGroup({ 
        class: `visioncharts-dataset-${dataset.id}` 
      });
      
      // Render bars for this dataset
      this._renderBarsForDataset(dataset, datasetGroup, datasetIndex, color);
      
      // Render value labels if enabled
      if (showValues && this._shouldShowValueLabels(dataset)) {
        this._renderValueLabelsForDataset(dataset, datasetGroup, datasetIndex, color);
      }
      
      // Add dataset group to data group
      if (datasetGroup.element) {
        dataGroup.appendChild ? dataGroup.appendChild(datasetGroup.element) : null;
      }
    });
  }

  /**
   * Render grouped bars using batch operations
   * @private
   */
  _renderGroupedBarsBatched(barDatasets, dataGroup) {
    console.log('Using batch rendering for bar performance');
    
    const rectangles = [];
    const valueLabels = [];
    
    // Collect all bars for batch rendering
    barDatasets.forEach((dataset, datasetIndex) => {
      if (!dataset.data || !dataset.data.length) return;
      
      const color = dataset.color || this.options.colors[datasetIndex % this.options.colors.length];
      const barsData = this._prepareBarsForBatch(dataset, datasetIndex, color);
      
      rectangles.push(...barsData.rectangles);
      
      if (this.options.showValues && this._shouldShowValueLabels(dataset)) {
        const labelsData = this._prepareValueLabelsForBatch(dataset, datasetIndex);
        valueLabels.push(...labelsData);
      }
    });
    
    // Render in batches
    if (rectangles.length > 0) {
      this._renderRectanglesBatch(rectangles, dataGroup);
    }
    
    if (valueLabels.length > 0) {
      this._renderValueLabelsBatch(valueLabels, dataGroup);
    }
    
    this.barPerformanceMetrics.batchesUsed = Math.ceil(rectangles.length / 1000) + Math.ceil(valueLabels.length / 1000);
  }

  /**
   * Render stacked bars
   * @private
   */
  _renderStackedBars(barDatasets, dataGroup) {
    console.log('Rendering stacked bars');
    
    // Process stacked data
    this._processStackedData(barDatasets);
    
    // Render stacked bars (individual rendering for now, could be optimized with batching)
    this._renderStackedBarsIndividual(barDatasets, dataGroup);
  }

  /**
   * Render bars for a single dataset
   * @private
   */
  _renderBarsForDataset(dataset, datasetGroup, datasetIndex, color) {
    const { xField, yField, xType, showZeroValueBars, zeroBarHeight } = this.options;
    
    dataset.data.forEach((dataPoint, index) => {
      const xValue = dataPoint[xField];
      const yValue = dataPoint[yField] || 0;
      
      if (yValue === 0 && !showZeroValueBars) return;
      
      // Calculate bar position and dimensions
      const barDimensions = this._calculateBarDimensions(xValue, yValue, datasetIndex, index);
      
      if (!barDimensions || barDimensions.height <= 0) return;
      
      // Ensure minimum height for zero value bars
      if (yValue === 0 && barDimensions.height < zeroBarHeight) {
        barDimensions.height = zeroBarHeight;
      }
      
      // Create bar using current renderer
      const barElement = this.renderer.drawRect(
        barDimensions.x,
        barDimensions.y,
        barDimensions.width,
        barDimensions.height,
        {
          fill: color,
          stroke: 'none',
          class: 'visioncharts-bar',
          'data-dataset': dataset.id,
          'data-index': index,
          'data-x': xValue,
          'data-y': yValue
        }
      );
      
      // Track bar element for interaction
      this.barChartState.barElements.set(`bar-${dataset.id}-${index}`, barElement);
    });
  }

  /**
   * Render value labels for a dataset
   * @private
   */
  _renderValueLabelsForDataset(dataset, datasetGroup, datasetIndex, color) {
    const startTime = performance.now();
    
    const { xField, yField, valuePosition, valueFormat, valueFontSize } = this.options;
    
    dataset.data.forEach((dataPoint, index) => {
      const xValue = dataPoint[xField];
      const yValue = dataPoint[yField] || 0;
      
      if (yValue === 0 && !this.options.showZeroValueBars) return;
      
      const barDimensions = this._calculateBarDimensions(xValue, yValue, datasetIndex, index);
      if (!barDimensions) return;
      
      // Calculate label position
      const labelPosition = this._calculateValueLabelPosition(barDimensions, valuePosition);
      
      // Format value
      const formattedValue = this._formatValue(yValue, valueFormat);
      
      // Create value label using current renderer
      const labelElement = this.renderer.drawText(
        formattedValue,
        labelPosition.x,
        labelPosition.y,
        {
          textAnchor: 'middle',
          fontSize: valueFontSize,
          fontFamily: this.options.fontFamily,
          fill: valuePosition === 'middle' ? '#fff' : this.options.textColor,
          class: 'visioncharts-bar-value'
        }
      );
      
      // Track label element
      this.barChartState.valueLabels.set(`label-${dataset.id}-${index}`, labelElement);
    });
    
    this.barPerformanceMetrics.valueLabelsRenderingTime += performance.now() - startTime;
  }

  /**
   * Render study datasets using enhanced StudiesRenderer
   * @private
   */
  _renderStudyDatasets(studyDatasets, dataGroup) {
    console.log(`Rendering ${studyDatasets.length} study datasets as lines`);
    
    try {
      // Use enhanced StudiesRenderer that supports multi-renderer
      StudiesRenderer.renderForBarChart(this, studyDatasets, dataGroup, {
        renderer: this.renderer,
        rendererType: this.rendererMetadata?.type,
        lineWidth: this.options.studyLineWidth,
        pointRadius: this.options.studyPointRadius
      });
    } catch (error) {
      console.warn('Failed to render study datasets:', error);
      
      // Fallback to basic line rendering for studies
      studyDatasets.forEach(dataset => {
        if (dataset.data && dataset.data.length > 0) {
          this._renderStudyAsLine(dataset, dataGroup);
        }
      });
    }
  }

  /**
   * Render ending labels if enabled
   * @private
   */
  _renderEndingLabels(dataGroup) {
    console.log('BarChart: Rendering ending labels');
    
    try {
      if (!this.endingLabels) {
        this.endingLabels = new EndingLabels(this.options.endingLabelsConfig || {});
      }
      
      // Enhanced ending labels with renderer support
      this.endingLabels.renderForSinglePanel(this, dataGroup, {
        renderer: this.renderer,
        rendererType: this.rendererMetadata?.type
      });
    } catch (error) {
      console.warn('Failed to render ending labels:', error);
    }
  }

  // ===== BAR CALCULATION METHODS =====

  /**
   * Calculate bar dimensions for a data point
   * @private
   */
  _calculateBarDimensions(xValue, yValue, datasetIndex, pointIndex) {
    const { xField, yField, xType } = this.options;
    
    // Use cached dimensions if available
    const cacheKey = `${xValue}-${datasetIndex}-${pointIndex}`;
    if (this.barChartState.barDimensions.has(cacheKey)) {
      return this.barChartState.barDimensions.get(cacheKey);
    }
    
    let barX, barY, barWidth, barHeight;
    
    try {
      // Calculate X position based on type
      if (xType === 'time') {
        barX = this._calculateTimeBarX(xValue, datasetIndex);
      } else if (xType === 'category') {
        barX = this._calculateCategoryBarX(xValue, datasetIndex);
      } else {
        barX = this._calculateNumericBarX(xValue, datasetIndex);
      }
      
      // Calculate bar width
      barWidth = this.barChartState.calculatedBarWidth;
      
      // Calculate Y position and height
      const yPixel = this.state.scales.y.scale(yValue);
      const zeroPixel = this.state.scales.y.scale(0);
      
      if (yValue >= 0) {
        barY = yPixel;
        barHeight = zeroPixel - yPixel;
      } else {
        barY = zeroPixel;
        barHeight = yPixel - zeroPixel;
      }
      
      // Ensure positive dimensions
      barHeight = Math.max(0, barHeight);
      
      const dimensions = { x: barX, y: barY, width: barWidth, height: barHeight };
      
      // Cache for future use
      this.barChartState.barDimensions.set(cacheKey, dimensions);
      
      return dimensions;
      
    } catch (error) {
      console.warn(`Failed to calculate bar dimensions for ${xValue}:`, error);
      return null;
    }
  }

  /**
   * Calculate X position for time-based bars
   * @private
   */
  _calculateTimeBarX(xValue, datasetIndex) {
    const dateValue = xValue instanceof Date ? xValue : new Date(xValue);
    const xPixel = this.state.scales.x.scale(dateValue);
    
    // Center the bar on the time point
    return xPixel - (this.barChartState.calculatedBarWidth / 2);
  }

  /**
   * Calculate X position for category-based bars
   * @private
   */
  _calculateCategoryBarX(xValue, datasetIndex) {
    const categoryIndex = this.barChartState.xCategories.indexOf(xValue);
    if (categoryIndex === -1) return 0;
    
    const categoryWidth = this.state.dimensions.innerWidth / this.barChartState.xCategories.length;
    const totalDatasetsWidth = this.barChartState.calculatedBarWidth * this.config.datasets.filter(d => !this.isStudyDataset(d)).length;
    const categoryCenter = categoryIndex * categoryWidth + categoryWidth / 2;
    
    // Position bars side by side within category
    const datasetOffset = (datasetIndex - (this.config.datasets.length - 1) / 2) * this.barChartState.calculatedBarWidth;
    
    return categoryCenter - totalDatasetsWidth / 2 + datasetOffset;
  }

  /**
   * Calculate X position for numeric bars
   * @private
   */
  _calculateNumericBarX(xValue, datasetIndex) {
    const xPixel = this.state.scales.x.scale(xValue);
    
    // For numeric X axis, center the bar on the value
    return xPixel - (this.barChartState.calculatedBarWidth / 2);
  }

  /**
   * Calculate value label position
   * @private
   */
  _calculateValueLabelPosition(barDimensions, valuePosition) {
    const { x, y, width, height } = barDimensions;
    
    let labelX = x + width / 2; // Always centered horizontally
    let labelY;
    
    switch (valuePosition) {
      case 'top':
        labelY = y - 5;
        break;
      case 'middle':
        labelY = y + height / 2;
        break;
      case 'bottom':
      default:
        labelY = y + height + 15;
        break;
    }
    
    return { x: labelX, y: labelY };
  }

  // ===== BATCH RENDERING METHODS =====

  /**
   * Prepare bars for batch rendering
   * @private
   */
  _prepareBarsForBatch(dataset, datasetIndex, color) {
    const rectangles = [];
    const { xField, yField, showZeroValueBars } = this.options;
    
    dataset.data.forEach((dataPoint, index) => {
      const xValue = dataPoint[xField];
      const yValue = dataPoint[yField] || 0;
      
      if (yValue === 0 && !showZeroValueBars) return;
      
      const barDimensions = this._calculateBarDimensions(xValue, yValue, datasetIndex, index);
      if (!barDimensions || barDimensions.height <= 0) return;
      
      rectangles.push({
        x: barDimensions.x,
        y: barDimensions.y,
        width: barDimensions.width,
        height: barDimensions.height,
        fill: color,
        stroke: 'none',
        class: 'visioncharts-bar',
        'data-dataset': dataset.id,
        'data-index': index
      });
    });
    
    return { rectangles };
  }

  /**
   * Render rectangles in batch
   * @private
   */
  _renderRectanglesBatch(rectangles, dataGroup) {
    if (!this.renderer.batchDraw) {
      // Fallback to individual rendering
      rectangles.forEach(rect => {
        this.renderer.drawRect(rect.x, rect.y, rect.width, rect.height, rect);
      });
      return;
    }
    
    // Use batch rendering
    const elementIds = this.renderer.batchDraw('rect', rectangles, {
      class: 'visioncharts-bar'
    });
    
    // Track elements for interaction
    elementIds.forEach((elementId, index) => {
      const rect = rectangles[index];
      this.barChartState.barElements.set(`batch-bar-${index}`, elementId);
    });
  }

  // ===== STACKED BAR METHODS =====

  /**
   * Process data for stacked bars
   * @private
   */
  _processStackedData(barDatasets) {
    // Implementation for stacked bar data processing
    // This would calculate cumulative values for each stack
    console.log('Processing stacked data (implementation needed)');
  }

  /**
   * Render stacked bars individually
   * @private
   */
  _renderStackedBarsIndividual(barDatasets, dataGroup) {
    // Implementation for stacked bar rendering
    console.log('Rendering stacked bars (implementation needed)');
  }

  // ===== CAPABILITY DETECTION =====

  /**
   * Check if batch rendering should be used
   * @private
   */
  _shouldUseBatchRendering() {
    if (!this.options.enableBatchRendering) return false;
    if (!this.renderer || !this.renderer.batchDraw) return false;
    
    return this.barPerformanceMetrics.totalBars >= this.options.batchRectThreshold;
  }

  /**
   * Check if value labels should be shown for a dataset
   * @private
   */
  _shouldShowValueLabels(dataset) {
    if (!this.options.adaptiveValueLabels) return true;
    
    // Hide value labels for large datasets to improve performance
    return dataset.data.length <= 500;
  }

  // ===== PERFORMANCE OPTIMIZATION =====

  /**
   * Setup BarChart-specific optimizations
   * @private
   */
  _setupBarChartOptimizations() {
    if (!this.renderer) return;
    
    const totalBars = this.barPerformanceMetrics.totalBars;
    
    // Apply renderer-specific optimizations
    if (this.renderer.optimizeForDataSize) {
      this.renderer.optimizeForDataSize(totalBars);
    }
    
    // Enable adaptive features based on bar count
    if (totalBars > 5000) {
      console.log('Large bar dataset detected, enabling performance optimizations');
      
      // Disable expensive features for performance
      if (this.options.adaptiveValueLabels && this.options.showValues) {
        this.options.showValues = false;
        console.log('Disabled value labels for performance');
      }
      
      // Reduce bar width for very large datasets
      if (this.options.adaptiveBarWidth && totalBars > 10000) {
        this.barChartState.calculatedBarWidth = Math.max(
          1,
          Math.min(this.barChartState.calculatedBarWidth, 3)
        );
        console.log('Reduced bar width for performance');
      }
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if a dataset is a study/indicator
   * @param {Object} dataset - Dataset to check
   * @returns {boolean} True if dataset is a study
   */
  isStudyDataset(dataset) {
    return StudiesRenderer.isStudyDataset(this, dataset);
  }

  /**
   * Get the study configuration for a dataset
   * @param {Object} dataset - Dataset to get study config for
   * @returns {Object|null} Study configuration or null
   */
  getStudyConfig(dataset) {
    return StudiesRenderer.getStudyConfig(this, dataset);
  }

  /**
   * Format value for display
   * @private
   */
  _formatValue(value, format) {
    switch (format) {
      case 'short':
        return formatLargeNumber(value);
      case 'full':
        return value.toLocaleString();
      case 'auto':
      default:
        return Math.abs(value) >= 1000 ? formatLargeNumber(value) : value.toString();
    }
  }

  /**
   * Render study as line (fallback)
   * @private
   */
  _renderStudyAsLine(dataset, dataGroup) {
    // Basic line rendering for study datasets as fallback
    console.log(`Rendering study ${dataset.id} as line (fallback)`);
    
    // This would implement basic line rendering for studies
    // Similar to LineChart but simplified for bar chart context
  }

  /**
   * Fallback to legacy SVG rendering
   * @private
   */
  _renderDataFallback() {
    console.warn('BarChart: Falling back to legacy SVG rendering');
    
    try {
      // Use original SVG-based rendering logic as fallback
      const dataGroup = SvgRenderer.createGroup({ class: 'visioncharts-data' });
      
      const barDatasets = this.config.datasets.filter(dataset => !this.isStudyDataset(dataset));
      
      barDatasets.forEach((dataset, datasetIndex) => {
        if (!dataset.data || !dataset.data.length) return;
        
        const color = dataset.color || this.options.colors[datasetIndex % this.options.colors.length];
        
        dataset.data.forEach((dataPoint, index) => {
          const xValue = dataPoint[this.options.xField];
          const yValue = dataPoint[this.options.yField] || 0;
          
          if (yValue === 0 && !this.options.showZeroValueBars) return;
          
          const barDimensions = this._calculateBarDimensions(xValue, yValue, datasetIndex, index);
          if (!barDimensions || barDimensions.height <= 0) return;
          
          const barElement = SvgRenderer.createRect(
            barDimensions.x,
            barDimensions.y,
            barDimensions.width,
            barDimensions.height,
            {
              fill: color,
              class: 'visioncharts-bar'
            }
          );
          
          dataGroup.appendChild(barElement);
        });
      });
      
      if (this.state.chart && this.state.chart.appendChild) {
        this.state.chart.appendChild(dataGroup);
      }
      
    } catch (error) {
      console.error('BarChart: Even fallback rendering failed:', error);
    }
  }

  // ===== PRESERVE EXISTING PUBLIC API =====

  /**
   * Override renderPanels to ensure proper panel scales storage
   * @override
   */
  renderPanels() {
    console.log('BarChart.renderPanels called - ensuring panel scales are stored');
    
    // Call Panel.renderForChart which should return panel scales
    const panelScales = Panel.renderForChart(this);
    
    // Ensure panel scales are stored properly for BarChart
    if (panelScales && panelScales.length > 0) {
      this.state.panelScales = panelScales;
      console.log('BarChart: Panel scales stored successfully:', panelScales.length, 'panels');
    } else {
      console.warn('BarChart: No panel scales returned from Panel.renderForChart');
    }
  }

  /**
   * Toggle studies rendering mode
   * @param {boolean} studiesAsLines - Whether to render studies as lines
   * @returns {BarChart} This chart instance
   */
  toggleStudiesAsLines(studiesAsLines) {
    console.log('BarChart.toggleStudiesAsLines called with:', studiesAsLines);
    
    this.options.studiesAsLines = studiesAsLines !== undefined ? studiesAsLines : !this.options.studiesAsLines;
    
    return this.update();
  }

  /**
   * Get BarChart-specific performance metrics
   * @returns {Object} Performance metrics
   */
  getBarChartMetrics() {
    return {
      ...this.getPerformanceMetrics(),
      ...this.barPerformanceMetrics,
      barDimensionsCacheSize: this.barChartState.barDimensions.size,
      calculatedBarWidth: this.barChartState.calculatedBarWidth,
      categoryCount: this.barChartState.xCategories.length
    };
  }

  /**
   * Clear internal caches (useful for memory management)
   */
  clearCaches() {
    this.barChartState.barDimensions.clear();
    this.barChartState.valueLabels.clear();
    this.barChartState.barElements.clear();
    this.barChartState.batchGroups.clear();
    console.log('BarChart caches cleared');
  }

  /**
   * Enhanced destroy method
   * @override
   */
  async destroy() {
    console.log('BarChart.destroy called');
    
    // Clear BarChart-specific state
    this.clearCaches();
    this.barChartState.xCategories = [];
    this.barChartState.stackedData.clear();
    
    // Call parent destroy
    await super.destroy();
  }
}
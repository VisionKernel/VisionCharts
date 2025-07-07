/**
 * BarChart.js - Enhanced Bar Chart Implementation (Updated for Unified Coordinates)
 * 
 * Extends the base Chart class to render bar charts using either Canvas 2D or WebGL
 * based on dataset size. Automatically switches to WebGL for datasets over 50K points.
 * 
 * NOW USES UNIFIED COORDINATE SYSTEM - consistent rendering across all renderers!
 */

import { Chart } from '../core/Chart.js';

export class BarChart extends Chart {
  constructor(config = {}) {
    super(config);
    
    // Bar-specific options
    this.config.options = {
      ...this.config.options,
      barWidth: 0.7, // Percentage of available space per bar
      barSpacing: 0.1, // Spacing between bars as percentage
      showBorder: false, // Whether to show bar borders
      borderWidth: 1, // Border width when enabled
      
      // NEW: Coordinate validation options
      enableCoordinateValidation: true,
      enableRenderingDebug: false,
      
      ...config.options
    };
    
    // NEW: Bar-specific coordinate validation state
    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
    this.barPositioningInfo = null;
    
    console.log('BarChart created with unified coordinate system support');
  }
  
  /**
   * UPDATED: Render bar chart data using unified coordinates
   */
  async _renderChartData() {
    if (!this.rendererInstance) {
      console.error('No renderer instance available');
      return;
    }

    // For bar charts, we still pass the transformed datasets directly to renderers
    // since bar rendering doesn't use the PathGenerator yet (bars need different geometry)
    if (!Array.isArray(this.config.data) || this.config.data.length === 0) {
      console.log('No data to render');
      return;
    }

    try {
      // NEW: Validate unified coordinates before rendering
      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }

      // NEW: Calculate bar positioning info for debugging
      if (this.config.options.enableRenderingDebug) {
        this._calculateBarPositioningInfo();
      }

      // Set viewport for clipping
      this.rendererInstance.setViewport(this.chartArea);

      // Render bars using the selected renderer with unified coordinates
      await this.rendererInstance.renderBars(this.config.data, this.scales, {
        barWidth: this.config.options.barWidth,
        barSpacing: this.config.options.barSpacing,
        showBorder: this.config.options.showBorder,
        borderWidth: this.config.options.borderWidth
      });

      const totalBars = this.config.data.reduce((sum, dataset) => sum + (dataset.data?.length || 0), 0);
      console.log(`BarChart: Rendered ${this.config.data.length} datasets with ${totalBars} total bars using ${this.activeRenderer} with UNIFIED coordinates`);

      // NEW: Collect rendering debug info
      if (this.config.options.enableRenderingDebug) {
        this._collectRenderingDebugInfo();
      }

    } catch (error) {
      console.error('Error rendering bar chart data:', error);
      throw error;
    }
  }

  /**
   * NEW: Validate unified coordinates across all datasets
   * @private
   */
  _validateUnifiedCoordinates() {
    this.coordinateValidationResults = [];

    if (!this.config.data || this.config.data.length === 0) {
      console.warn('BarChart: No data to validate');
      return;
    }

    for (const dataset of this.config.data) {
      const validationResult = this._validateDatasetCoordinates(dataset);
      this.coordinateValidationResults.push(validationResult);
    }

    // Log validation summary
    const totalDatasets = this.coordinateValidationResults.length;
    const validDatasets = this.coordinateValidationResults.filter(r => r.isValid).length;
    const totalPoints = this.coordinateValidationResults.reduce((sum, r) => sum + r.pointCount, 0);
    
    console.log(`BarChart coordinate validation:`, {
      totalDatasets,
      validDatasets,
      totalPoints,
      coordinateSystem: 'unified',
      renderer: this.activeRenderer
    });

    // Warn about invalid coordinates
    const invalidDatasets = this.coordinateValidationResults.filter(r => !r.isValid);
    if (invalidDatasets.length > 0) {
      console.warn(`BarChart: ${invalidDatasets.length} datasets have coordinate issues:`, invalidDatasets);
    }
  }

  /**
   * NEW: Validate coordinates for a single dataset
   * @private
   */
  _validateDatasetCoordinates(dataset) {
    const validation = {
      datasetId: dataset.id,
      datasetName: dataset.name,
      pointCount: dataset.data ? dataset.data.length : 0,
      coordinateSystem: dataset.coordinateSystem || 'unified',
      isValid: true,
      issues: []
    };

    if (!dataset.data || dataset.data.length === 0) {
      validation.isValid = false;
      validation.issues.push('No data points found');
      return validation;
    }

    // Validate point coordinates
    let validPoints = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
      
      // Check for unified coordinates
      const x = point.unifiedX || point.screenX;
      const y = point.unifiedY || point.screenY;
      
      if (x == null || y == null) {
        validation.issues.push(`Point ${i} has null unified coordinates`);
        continue;
      }

      if (!isFinite(x) || !isFinite(y)) {
        validation.issues.push(`Point ${i} has invalid unified coordinates: (${x}, ${y})`);
        continue;
      }

      validPoints++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // Check if coordinates are within reasonable bounds
    const chartArea = this.chartArea;
    const tolerance = 100; // Allow some padding outside chart area

    if (minX < chartArea.x - tolerance || maxX > chartArea.x + chartArea.width + tolerance) {
      validation.issues.push(`X coordinates outside chart bounds: ${minX} to ${maxX}`);
    }

    if (minY < chartArea.y - tolerance || maxY > chartArea.y + chartArea.height + tolerance) {
      validation.issues.push(`Y coordinates outside chart bounds: ${minY} to ${maxY}`);
    }

    validation.validPoints = validPoints;
    validation.bounds = { minX, maxX, minY, maxY };

    if (validation.issues.length > 0) {
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * NEW: Calculate bar positioning information for debugging
   * @private
   */
  _calculateBarPositioningInfo() {
    if (!this.config.data || this.config.data.length === 0) {
      return;
    }

    const firstDataset = this.config.data[0];
    if (!firstDataset || !firstDataset.data || firstDataset.data.length === 0) {
      return;
    }

    const data = firstDataset.data;
    const barWidth = this.config.options.barWidth;
    const barSpacing = this.config.options.barSpacing;

    // Calculate unified coordinate spacing
    const unifiedXValues = data
      .map(point => point.unifiedX || point.screenX)
      .filter(x => x != null && isFinite(x))
      .sort((a, b) => a - b);

    let avgPixelDistance = 0;
    let calculatedBarWidth = 0;

    if (unifiedXValues.length > 1) {
      // Calculate average pixel distance between consecutive points
      let totalDiff = 0;
      for (let i = 1; i < unifiedXValues.length; i++) {
        totalDiff += unifiedXValues[i] - unifiedXValues[i - 1];
      }
      avgPixelDistance = totalDiff / (unifiedXValues.length - 1);
      calculatedBarWidth = Math.max(avgPixelDistance * barWidth, 1);
    }

    this.barPositioningInfo = {
      pointCount: data.length,
      datasetCount: this.config.data.length,
      barWidth: barWidth,
      barSpacing: barSpacing,
      avgPixelDistance: avgPixelDistance,
      calculatedBarWidth: calculatedBarWidth,
      unifiedXRange: unifiedXValues.length > 0 ? {
        min: unifiedXValues[0],
        max: unifiedXValues[unifiedXValues.length - 1]
      } : null,
      chartArea: this.chartArea,
      scaleRange: {
        x: this.scales.x.range,
        y: this.scales.y.range
      }
    };
  }

  /**
   * NEW: Collect rendering debug information
   * @private
   */
  _collectRenderingDebugInfo() {
    this.renderingDebugInfo = {
      timestamp: Date.now(),
      renderer: this.activeRenderer,
      coordinateSystem: 'unified',
      chartArea: this.chartArea,
      scales: {
        x: {
          domain: this.scales.x.domain,
          range: this.scales.x.range,
          type: this.scales.x.type
        },
        y: {
          domain: this.scales.y.domain,
          range: this.scales.y.range,
          type: this.scales.y.type
        }
      },
      datasetInfo: this.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        pointCount: dataset.data?.length || 0,
        coordinateSystem: dataset.coordinateSystem || 'unified',
        samplePoints: dataset.data ? dataset.data.slice(0, 3).map(point => ({
          unifiedX: point.unifiedX || point.screenX,
          unifiedY: point.unifiedY || point.screenY
        })) : []
      })),
      barPositioningInfo: this.barPositioningInfo,
      validationResults: this.coordinateValidationResults
    };

    console.log('BarChart rendering debug info:', this.renderingDebugInfo);
  }
  
  /**
   * Add a new dataset to the chart (UPDATED with legend support)
   */
  addDataset(dataset) {
    if (!dataset || !dataset.data) {
      console.warn('Invalid dataset provided to addDataset');
      return this;
    }
    
    // Ensure required properties
    const processedDataset = {
      id: dataset.id || `dataset-${this.config.data.length + 1}`,
      name: dataset.name || `Dataset ${this.config.data.length + 1}`,
      color: dataset.color || this._getDefaultColor(this.config.data.length),
      fill: dataset.fill !== undefined ? dataset.fill : false, // Bar charts don't use fill, but keep for consistency
      ...dataset
    };
    
    this.config.data.push(processedDataset);
    
    console.log(`BarChart: Added dataset with legend support: ${processedDataset.id} with ${processedDataset.data.length} bars`);
    
    // NEW: Update legend
    if (this.legend) {
      this.legend.updateDatasets(this.config.data);
    }
    
    // Update and re-render
    this.update();
    
    return this;
  }
  
  /**
   * Remove a dataset by ID (UPDATED with legend support)
   */
  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);
    
    if (this.config.data.length < initialCount) {
      console.log(`BarChart: Removed dataset: ${datasetId}`);
      
      // NEW: Update legend
      if (this.legend) {
        this.legend.updateDatasets(this.config.data);
      }
      
      this.update();
    } else {
      console.warn(`BarChart: Dataset not found: ${datasetId}`);
    }
    
    return this;
  }
  
  /**
   * Update a specific dataset (UPDATED with legend support)
   */
  updateDataset(datasetId, newData) {
    const dataset = this.config.data.find(ds => ds.id === datasetId);
    
    if (!dataset) {
      console.warn(`BarChart: Dataset not found: ${datasetId}`);
      return this;
    }
    
    // Update dataset properties
    Object.assign(dataset, newData);
    
    // NEW: Update legend if color changed
    if (newData.color && this.legend) {
      this.legend.updateDatasetColor(datasetId, newData.color);
    }
    
    // NEW: Update legend if name changed
    if (newData.name && this.legend) {
      this.legend.updateDatasets(this.config.data);
    }
    
    console.log(`BarChart: Updated dataset with legend support: ${datasetId}`);
    this.update();
    
    return this;
  }
  
  /**
   * Set bar width as percentage of available space
   */
  setBarWidth(width) {
    if (typeof width !== 'number' || width <= 0 || width > 1) {
      console.warn('Bar width must be a number between 0 and 1');
      return this;
    }
    
    this.config.options.barWidth = width;
    console.log(`BarChart: Bar width set to: ${width}`);
    
    this.render();
    return this;
  }
  
  /**
   * Set spacing between bars
   */
  setBarSpacing(spacing) {
    if (typeof spacing !== 'number' || spacing < 0) {
      console.warn('Bar spacing must be a non-negative number');
      return this;
    }
    
    this.config.options.barSpacing = spacing;
    console.log(`BarChart: Bar spacing set to: ${spacing}`);
    
    this.render();
    return this;
  }
  
  /**
   * Toggle bar borders
   */
  toggleBorders(show = null) {
    this.config.options.showBorder = show !== null ? show : !this.config.options.showBorder;
    console.log(`BarChart: Bar borders ${this.config.options.showBorder ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showBorder;
  }
  
  /**
   * Set border width for bars
   */
  setBorderWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      console.warn('Invalid border width provided');
      return this;
    }
    
    this.config.options.borderWidth = width;
    console.log(`BarChart: Border width set to: ${width}`);
    
    if (this.config.options.showBorder) {
      this.render();
    }
    
    return this;
  }

  /**
   * NEW: Enable/disable coordinate validation
   */
  setCoordinateValidation(enabled) {
    this.config.options.enableCoordinateValidation = enabled;
    console.log(`BarChart: Coordinate validation ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }

  /**
   * NEW: Enable/disable rendering debug info
   */
  setRenderingDebug(enabled) {
    this.config.options.enableRenderingDebug = enabled;
    console.log(`BarChart: Rendering debug ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }

  /**
   * NEW: Get coordinate validation results
   */
  getCoordinateValidationResults() {
    return this.coordinateValidationResults;
  }

  /**
   * NEW: Get rendering debug information
   */
  getRenderingDebugInfo() {
    return this.renderingDebugInfo;
  }

  /**
   * NEW: Get bar positioning information
   */
  getBarPositioningInfo() {
    return this.barPositioningInfo;
  }
  
  /**
   * Get bar chart specific information
   */
  getBarChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    return {
      ...baseInfo,
      chartType: 'bar',
      barWidth: this.config.options.barWidth,
      barSpacing: this.config.options.barSpacing,
      showBorder: this.config.options.showBorder,
      borderWidth: this.config.options.borderWidth,
      coordinateSystem: 'unified',
      coordinateValidation: this.config.options.enableCoordinateValidation,
      renderingDebug: this.config.options.enableRenderingDebug,
      datasets: this.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        color: dataset.color,
        barCount: dataset.data?.length || 0
      })),
      validationResults: this.coordinateValidationResults.length > 0 ? this.coordinateValidationResults : null,
      barPositioningInfo: this.barPositioningInfo
    };
  }
  
  /**
   * Get default color for dataset by index
   * @private
   */
  _getDefaultColor(index) {
    const colors = [
      '#1468a8', // Blue
      '#34A853', // Green
      '#FBBC05', // Yellow
      '#EA4335', // Red
      '#9C27B0', // Purple
      '#00ACC1', // Cyan
      '#FF9800', // Orange
      '#607D8B'  // Blue Grey
    ];
    
    return colors[index % colors.length];
  }
  
  /**
   * Optimize for large datasets by enabling WebGL if needed
   */
  optimizeForLargeDataset() {
    const currentRenderer = this.activeRenderer;
    
    if (this.dataPointCount > this.performanceThresholds.canvas && currentRenderer !== 'webgl') {
      console.log('BarChart: Optimizing for large dataset - switching to WebGL with unified coordinates');
      return this.switchRenderer('webgl');
    } else {
      console.log('BarChart: Dataset size acceptable for current renderer');
      return Promise.resolve();
    }
  }
  
  /**
   * Apply histogram styling automatically for time series data
   */
  applyHistogramStyling() {
    // Automatically adjust bar width and spacing for histogram appearance
    this.config.options.barWidth = 0.95; // Wider bars for histogram
    this.config.options.barSpacing = 0.02; // Minimal spacing
    this.config.options.showBorder = true; // Show borders to define bins
    this.config.options.borderWidth = 1;
    
    console.log('BarChart: Applied histogram styling for time series data with unified coordinates');
    this.render();
    
    return this;
  }

  /**
   * NEW: Test coordinate system consistency between renderers
   */
  async testCoordinateConsistency() {
    if (!this.config.data || this.config.data.length === 0) {
      console.warn('BarChart: No data available for consistency test');
      return null;
    }

    const originalRenderer = this.activeRenderer;
    const testResults = {};

    try {
      // Test with Canvas renderer
      await this.switchRenderer('canvas');
      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }
      if (this.config.options.enableRenderingDebug) {
        this._calculateBarPositioningInfo();
      }
      testResults.canvas = {
        renderer: 'canvas',
        validationResults: [...this.coordinateValidationResults],
        barPositioningInfo: this.barPositioningInfo ? { ...this.barPositioningInfo } : null,
        coordinateSystem: 'unified'
      };

      // Test with WebGL renderer (if supported)
      if (this.getRendererInfo().webglSupported) {
        await this.switchRenderer('webgl');
        if (this.config.options.enableCoordinateValidation) {
          this._validateUnifiedCoordinates();
        }
        if (this.config.options.enableRenderingDebug) {
          this._calculateBarPositioningInfo();
        }
        testResults.webgl = {
          renderer: 'webgl',
          validationResults: [...this.coordinateValidationResults],
          barPositioningInfo: this.barPositioningInfo ? { ...this.barPositioningInfo } : null,
          coordinateSystem: 'unified'
        };
      }

      // Switch back to original renderer
      await this.switchRenderer(originalRenderer);

      console.log('BarChart: Coordinate consistency test completed:', testResults);
      return testResults;

    } catch (error) {
      console.error('BarChart: Coordinate consistency test failed:', error);
      // Ensure we switch back to original renderer
      await this.switchRenderer(originalRenderer);
      throw error;
    }
  }
}
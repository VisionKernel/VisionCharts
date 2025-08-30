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

    this.chartType = 'bar';
    
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

    this.supportsStudies = true;
    
    console.log('BarChart created with FORCED canvas rendering and unified coordinate system support');
  }
  
  /**
 * UPDATED: Render bar chart data - handles both single and panel modes
 */
async _renderChartData() {
  // If in panel mode, rendering is handled by individual panels
  if (this.isPanelMode) {
    console.log('BarChart: Panel mode rendering handled by Panel components');
    return;
  }
  
  // Original single mode rendering logic
  if (!this.rendererInstance) {
    console.error('No renderer instance available');
    return;
  }

  // For bar charts, we pass the transformed datasets directly to renderers
  // since bar rendering doesn't use the PathGenerator yet (bars need different geometry)
  if (!Array.isArray(this.config.data) || this.config.data.length === 0) {
    console.log('No data to render');
    return;
  }

  try {
    // ✅ FIX: Set transformedData to reference the transformed config.data
    this.transformedData = this.config.data;

    // NEW: Validate unified coordinates before rendering
    if (this.config.options.enableCoordinateValidation) {
      this._validateUnifiedCoordinates();
    }

    // Set viewport for clipping
    this.rendererInstance.setViewport(this.chartArea);

    // UPDATED: Render bars with unified coordinates
    await this.rendererInstance.renderBars(this.transformedData, this.scales, {
      barWidth: this.config.options.barWidth,
      showBorder: this.config.options.showBorder,
      borderWidth: this.config.options.borderWidth,
      chartArea: this.chartArea
    });

    const totalBars = this.transformedData.reduce((sum, dataset) => sum + (dataset.data?.length || 0), 0);
    console.log(`BarChart: Rendered ${totalBars} bars across ${this.transformedData.length} datasets using ${this.activeRenderer}`);

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
   * Validate unified coordinates across all datasets - panel mode aware
   * @private
   */
  _validateUnifiedCoordinates() {
    if (this.isPanelMode) {
      console.log('BarChart: Coordinate validation handled by individual panels');
      return;
    }
    
    // Original single mode validation logic
    this.coordinateValidationResults = [];

    if (!this.transformedData || this.transformedData.length === 0) {
      return;
    }

    for (let datasetIndex = 0; datasetIndex < this.transformedData.length; datasetIndex++) {
      const dataset = this.transformedData[datasetIndex];
      const validation = this._validateDatasetCoordinates(dataset, datasetIndex);
      this.coordinateValidationResults.push(validation);
    }

    // Log validation results
    const totalIssues = this.coordinateValidationResults.reduce((sum, result) => sum + result.issues.length, 0);
    if (totalIssues > 0) {
      console.warn(`BarChart coordinate validation found ${totalIssues} issues:`, this.coordinateValidationResults);
    } else {
      console.log('BarChart coordinate validation passed for all datasets');
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
   * Collect rendering debug information - panel mode aware
   * @private
   */
  _collectRenderingDebugInfo() {
    if (this.isPanelMode) {
      console.log('BarChart: Rendering debug info handled by individual panels');
      return;
    }
    
    // Original single mode debug info collection
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
      datasets: this.transformedData.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        barCount: dataset.data?.length || 0,
        sampleBars: dataset.data ? dataset.data.slice(0, 3).map(point => ({
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
      fill: dataset.fill !== undefined ? dataset.fill : false,
      ...dataset
    };
    
    this.config.data.push(processedDataset);
    
    console.log(`BarChart: Added dataset with legend support: ${processedDataset.id} with ${processedDataset.data.length} bars`);
    
    // Update legend
    if (this.legend) {
      this.legend.updateDatasets(this.config.data);
    }
    
    // ✅ FIX: Add panel mode support
    if (this.isPanelMode) {
      return this.panelManager.refreshPanelMode();
    } else {
      return this.update();
    }
  }
  
  /**
   * Remove a dataset by ID (UPDATED with legend support)
   */
  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);
    
    if (this.config.data.length < initialCount) {
      console.log(`BarChart: Removed dataset: ${datasetId}`);
      
      // Update legend
      if (this.legend) {
        this.legend.updateDatasets(this.config.data);
      }
      
      // ✅ FIX: Add panel mode support  
      if (this.isPanelMode) {
        return this.panelManager.refreshPanelMode();
      } else {
        return this.update();
      }
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
    
    // Update legend if color changed
    if (newData.color && this.legend) {
      this.legend.updateDatasetColor(datasetId, newData.color);
    }
    
    // Update legend if name changed
    if (newData.name && this.legend) {
      this.legend.updateDatasets(this.config.data);
    }
    
    console.log(`BarChart: Updated dataset with legend support: ${datasetId}`);
    
    // ✅ FIX: Add panel mode support
    if (this.isPanelMode) {
      return this.panelManager.refreshPanelMode();
    } else {
      return this.update();
    }
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
   * Set bar spacing - works in both single and panel modes
   */
  setBarSpacing(spacing) {
    if (typeof spacing !== 'number' || spacing < 0 || spacing > 1) {
      console.warn('Invalid bar spacing provided (should be between 0 and 1)');
      return this;
    }
    
    this.config.options.barSpacing = spacing;
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ barSpacing: spacing });
        }
      }
    }
    
    console.log(`BarChart: Bar spacing set to: ${spacing}`);
    this.render();
    return this;
  }
  
  /**
   * Toggle bar borders - works in both single and panel modes
   */
  toggleBorders(show = null) {
    this.config.options.showBorder = show !== null ? show : !this.config.options.showBorder;
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ 
            showBorder: this.config.options.showBorder,
            borderWidth: this.config.options.borderWidth
          });
        }
      }
    }
    
    console.log(`BarChart: Bar borders ${this.config.options.showBorder ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showBorder;
  }
  
  /**
   * Set border width for bars - works in both single and panel modes
   */
  setBorderWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      console.warn('Invalid border width provided');
      return this;
    }
    
    this.config.options.borderWidth = width;
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ borderWidth: width });
        }
      }
    }
    
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
   * Get bar chart specific information - includes panel mode details
   */
  getBarChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    const info = {
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
      }))
    };
    
    // Add panel mode information
    if (this.isPanelMode) {
      info.panelMode = this.getPanelModeInfo();
    }
    
    return info;
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

  /**
   * Find closest data points for given X coordinate
   */
  findClosestDataPoints(targetDataX, dataset = null) {
    // Use provided dataset or find from config
    const targetDataset = dataset || this.config.data[0];
    
    if (!targetDataset || !targetDataset.data || targetDataset.data.length === 0) {
      return [];
    }
    
    try {
      const closestPoint = this._binarySearchClosest(targetDataset.data, targetDataX);
      
      if (closestPoint) {
        return [{
          ...closestPoint,
          datasetId: targetDataset.id,
          dataset: targetDataset,
          dataX: this._extractXValue(closestPoint),
          dataY: this._extractYValue(closestPoint),
          color: targetDataset.color
        }];
      }
      
      return [];
      
    } catch (error) {
      console.error('Error finding closest data points:', error);
      return [];
    }
  }

  /**
   * Get data points at exact X coordinate
   */
  getDataPointsAtX(exactDataX, dataset = null) {
    const targetDataset = dataset || this.config.data[0];
    
    if (!targetDataset || !targetDataset.data || targetDataset.data.length === 0) {
      return [];
    }
    
    try {
      const matchingPoints = [];
      
      // FIXED: Use global tolerance method (inherited from Chart base class)
      const tolerance = this._calculateMouseProximityTolerance();
      
      console.log(`Using global tolerance: ${tolerance}ms (${tolerance/60000} minutes) for dataset ${targetDataset.id}`);
      
      // Find all points within reasonable distance of mouse
      for (const point of targetDataset.data) {
        const pointX = this._extractXValue(point);
        
        if (Math.abs(pointX - exactDataX) <= tolerance) {
          matchingPoints.push({
            ...point,
            datasetId: targetDataset.id,
            dataset: targetDataset,
            dataX: pointX,
            dataY: this._extractYValue(point),
            color: targetDataset.color,
            unifiedX: point.unifiedX || point.screenX,
            unifiedY: point.unifiedY || point.screenY
          });
        }
      }

      // FIXED: No fallback to distant points! If no points within tolerance, return empty
      if (matchingPoints.length === 0) {
        console.log(`No points found within ${tolerance}ms of mouse position for dataset ${targetDataset.id}`);
        return [];
      }
      
      return matchingPoints;
      
    } catch (error) {
      console.error('Error getting data points at X:', error);
      return [];
    }
  }

  

  /**
   * Binary search for closest data point by X coordinate
   * @private
   */
  _binarySearchClosest(data, targetX) {
    if (!data || data.length === 0) return null;
    
    // Quick check if data appears to be sorted
    const isSorted = this._isDataSorted(data);
    
    if (isSorted) {
      return this._binarySearchSorted(data, targetX);
    } else {
      console.warn('Data not sorted, falling back to linear search');
      return this._linearSearchClosest(data, targetX);
    }
  }

  /**
   * Binary search on sorted data
   * @private
   */
  _binarySearchSorted(data, targetX) {
    let left = 0;
    let right = data.length - 1;
    let closest = data[0];
    let minDistance = Math.abs(this._extractXValue(data[0]) - targetX);
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midPoint = data[mid];
      const midX = this._extractXValue(midPoint);
      const distance = Math.abs(midX - targetX);
      
      // Update closest if this point is closer
      if (distance < minDistance) {
        minDistance = distance;
        closest = midPoint;
      }
      
      // Navigate search space
      if (midX < targetX) {
        left = mid + 1;
      } else if (midX > targetX) {
        right = mid - 1;
      } else {
        // Exact match found
        return midPoint;
      }
    }
    
    return closest;
  }

  /**
   * Linear search fallback for unsorted data
   * @private
   */
  _linearSearchClosest(data, targetX) {
    let closest = null;
    let minDistance = Infinity;
    
    for (const point of data) {
      const pointX = this._extractXValue(point);
      const distance = Math.abs(pointX - targetX);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = point;
      }
    }
    
    return closest;
  }

  /**
   * Check if data is sorted by X coordinate
   * @private
   */
  _isDataSorted(data) {
    if (data.length < 2) return true;
    
    // Check first few and last few points to determine if sorted
    const checkCount = Math.min(10, Math.floor(data.length / 2));
    
    for (let i = 1; i < checkCount; i++) {
      const prevX = this._extractXValue(data[i - 1]);
      const currX = this._extractXValue(data[i]);
      
      if (prevX > currX) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extract X value from data point
   * @private
   */
  _extractXValue(point) {
    const x = point.x || point.date || point.time || point.timestamp;
    
    // Convert Date objects to timestamps
    if (x instanceof Date) {
      return x.getTime();
    }
    
    if (typeof x === 'string' && this.config.options.xType === 'time') {
      return new Date(x).getTime();
    }
    
    return typeof x === 'number' ? x : null;
  }

  /**
   * Extract Y value from data point
   * @private
   */
  _extractYValue(point) {
    const y = point.y || point.value || point.price || point.close;
    return typeof y === 'number' ? y : null;
  }

  /**
   * Calculate bar tolerance for point selection
   * @private
   */
  _calculateBarTolerance(dataset) {
    if (!dataset.data || dataset.data.length < 2) {
      return 1000; // Default tolerance in milliseconds for time data
    }
    
    // Calculate average distance between consecutive points
    let totalDistance = 0;
    let validDistances = 0;
    
    for (let i = 1; i < Math.min(dataset.data.length, 10); i++) {
      const prevX = this._extractXValue(dataset.data[i - 1]);
      const currX = this._extractXValue(dataset.data[i]);
      
      if (prevX != null && currX != null) {
        totalDistance += Math.abs(currX - prevX);
        validDistances++;
      }
    }
    
    if (validDistances === 0) {
      return 1000; // Default fallback
    }
    
    const avgDistance = totalDistance / validDistances;
    
    // Use half the average distance as tolerance (bar width consideration)
    return avgDistance * 0.5;
  }
}
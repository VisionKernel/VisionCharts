/**
 * LineChart.js - Enhanced Line Chart Implementation (Updated for Unified Coordinates)
 * 
 * Extends the base Chart class to render line charts using either Canvas 2D or WebGL
 * based on dataset size. Automatically switches to WebGL for datasets over 50K points.
 * 
 * NOW USES UNIFIED COORDINATE SYSTEM - consistent rendering across all renderers!
 */

import { Chart } from '../core/Chart.js';

export class LineChart extends Chart {
  constructor(config = {}) {
    super(config);

    this.chartType = 'line';
    
    // Line-specific options
    this.config.options = {
      ...this.config.options,
      curve: 'monotone', // 'linear', 'step', 'cardinal', 'monotone'
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      
      // NEW: Coordinate validation options
      enableCoordinateValidation: true,
      enableRenderingDebug: false,
      
      ...config.options
    };
    
    // NEW: Coordinate validation state
    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
    
    console.log('LineChart created with unified coordinate system support');
  }
  
  /**
   * UPDATED: Render line chart data - handles both single and panel modes
   */
  async _renderChartData() {
    // If in panel mode, rendering is handled by individual panels
    if (this.isPanelMode) {
      console.log('LineChart: Panel mode rendering handled by Panel components');
      return;
    }
    
    // Original single mode rendering logic
    if (!this.rendererInstance) {
      console.error('No renderer instance available');
      return;
    }

    // Use generated paths instead of raw data
    if (!this.generatedPaths || !Array.isArray(this.generatedPaths) || this.generatedPaths.length === 0) {
      console.log('No generated paths to render');
      return;
    }

    try {
      // NEW: Validate unified coordinates before rendering
      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }

      // Set viewport for clipping
      this.rendererInstance.setViewport(this.chartArea);

      // UPDATED: Render with fill support
      await this.rendererInstance.renderLines(this.generatedPaths, this.scales, {
        showPoints: this.config.options.showPoints,
        pointRadius: this.config.options.pointRadius,
        enableFill: true, // NEW: Enable fill rendering
        chartArea: this.chartArea,
        fillOpacity: 0.3  // NEW: 30% opacity for fills
      });

      const totalVertices = this.generatedPaths.reduce((sum, path) => sum + (path.vertexCount || 0), 0);
      console.log(`LineChart: Rendered ${this.generatedPaths.length} datasets with fills using ${this.activeRenderer}`);

      // NEW: Collect rendering debug info
      if (this.config.options.enableRenderingDebug) {
        this._collectRenderingDebugInfo();
      }

    } catch (error) {
      console.error('Error rendering line chart data with fills:', error);
      throw error;
    }
  }

  /**
   * NEW: Validate unified coordinates across all datasets
   * @private
   */
  _validateUnifiedCoordinates() {
    this.coordinateValidationResults = [];

    if (!this.generatedPaths || this.generatedPaths.length === 0) {
      console.warn('LineChart: No generated paths to validate');
      return;
    }

    for (const pathData of this.generatedPaths) {
      const validationResult = this._validatePathCoordinates(pathData);
      this.coordinateValidationResults.push(validationResult);
    }

    // Log validation summary
    const totalPaths = this.coordinateValidationResults.length;
    const validPaths = this.coordinateValidationResults.filter(r => r.isValid).length;
    const totalVertices = this.coordinateValidationResults.reduce((sum, r) => sum + r.vertexCount, 0);
    
    console.log(`LineChart coordinate validation:`, {
      totalPaths,
      validPaths,
      totalVertices,
      coordinateSystem: 'unified',
      renderer: this.activeRenderer
    });

    // Warn about invalid coordinates
    const invalidPaths = this.coordinateValidationResults.filter(r => !r.isValid);
    if (invalidPaths.length > 0) {
      console.warn(`LineChart: ${invalidPaths.length} paths have coordinate issues:`, invalidPaths);
    }
  }

  /**
   * NEW: Validate coordinates for a single path
   * @private
   */
  _validatePathCoordinates(pathData) {
    const validation = {
      pathId: pathData.id,
      pathName: pathData.name,
      vertexCount: pathData.vertices ? pathData.vertices.length : 0,
      coordinateSystem: pathData.coordinateSystem,
      isValid: true,
      issues: []
    };

    if (!pathData.vertices || pathData.vertices.length === 0) {
      validation.isValid = false;
      validation.issues.push('No vertices found');
      return validation;
    }

    // Check coordinate system consistency
    if (pathData.coordinateSystem !== 'unified') {
      validation.issues.push(`Unexpected coordinate system: ${pathData.coordinateSystem}`);
    }

    // Validate vertex coordinates
    let validVertices = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < pathData.vertices.length; i++) {
      const vertex = pathData.vertices[i];
      
      if (vertex.x == null || vertex.y == null) {
        validation.issues.push(`Vertex ${i} has null coordinates`);
        continue;
      }

      if (!isFinite(vertex.x) || !isFinite(vertex.y)) {
        validation.issues.push(`Vertex ${i} has invalid coordinates: (${vertex.x}, ${vertex.y})`);
        continue;
      }

      validVertices++;
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
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

    validation.validVertices = validVertices;
    validation.bounds = { minX, maxX, minY, maxY };

    if (validation.issues.length > 0) {
      validation.isValid = false;
    }

    return validation;
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
      pathData: this.generatedPaths.map(path => ({
        id: path.id,
        name: path.name,
        vertexCount: path.vertexCount,
        coordinateSystem: path.coordinateSystem,
        sampleVertices: path.vertices.slice(0, 3) // First 3 vertices for debugging
      })),
      validationResults: this.coordinateValidationResults
    };

    console.log('LineChart rendering debug info:', this.renderingDebugInfo);
  }

   /**
   * Set curve type for line interpolation - works in both single and panel modes
   */
  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    
    if (!validCurves.includes(curveType)) {
      console.warn(`Invalid curve type: ${curveType}. Valid types: ${validCurves.join(', ')}`);
      return this;
    }
    
    // Update both config and PathGenerator
    this.config.options.curve = curveType;
    this.pathGenerator.setCurveType(curveType);
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.setCurveType(curveType);
        }
      }
    }
    
    console.log(`LineChart curve type set to: ${curveType}`);
    
    this.render(); // Re-render with new curve type
    return this;
  }
  
  /**
   * Update the fill state of a specific dataset - works in both single and panel modes
   */
  updateDatasetFill(datasetId, fillEnabled) {
    try {
      const dataset = this.config.data.find(d => d.id === datasetId);
      
      if (!dataset) {
        console.warn(`Dataset with ID ${datasetId} not found`);
        return false;
      }
      
      // Update dataset fill state
      dataset.fill = fillEnabled;
      
      console.log(`Updated dataset ${datasetId} fill to ${fillEnabled}`);
      
      // Re-render (handles both single and panel modes)
      this.render();
      
      return true;
      
    } catch (error) {
      console.error('Error updating dataset fill:', error);
      return false;
    }
  }

  /**
 * Add a new dataset to the chart (UPDATED with panel mode support)
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
    width: dataset.width || this.config.options.strokeWidth,
    fill: dataset.fill !== undefined ? dataset.fill : false,
    ...dataset
  };
  
  this.config.data.push(processedDataset);
  
  console.log(`LineChart: Added dataset with panel mode support: ${processedDataset.id} (fill: ${processedDataset.fill})`);
  
  // Update legend
  if (this.legend) {
    this.legend.updateDatasets(this.config.data);
  }
  
  // Handle panel mode vs single mode differently
  if (this.isPanelMode) {
    // In panel mode: recreate all panels with new dataset
    this._refreshPanelMode();
  } else {
    // In single mode: normal update
    this.update();
  }
  
  return this;
}

/**
 * Refresh panel mode after dataset changes
 * @private
 */
async _refreshPanelMode() {
  try {
    console.log('Refreshing panel mode with updated datasets');
    
    // Destroy existing panels
    this._destroyPanels();
    
    // CRITICAL: Process new data before creating panels
    await this._processData();
    
    // Recreate shared X scale with all datasets
    this._createSharedXScale();
    
    // Recreate panels
    await this._createPanels();
    
    // Re-render all panels
    await this._renderPanels();
    
    console.log('Panel mode refreshed successfully');
    
  } catch (error) {
    console.error('Error refreshing panel mode:', error);
    throw error;
  }
}
  
  /**
   * Remove a dataset by ID (UPDATED with legend support)
   */
  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);
    
    if (this.config.data.length < initialCount) {
      console.log(`LineChart: Removed dataset: ${datasetId}`);
      
      // NEW: Update legend
      if (this.legend) {
        this.legend.updateDatasets(this.config.data);
      }
      
      this.update();
    } else {
      console.warn(`LineChart: Dataset not found: ${datasetId}`);
    }
    
    return this;
  }
  
  /**
   * Update a specific dataset (UPDATED with legend support)
   */
  updateDataset(datasetId, newData) {
    const dataset = this.config.data.find(ds => ds.id === datasetId);
    
    if (!dataset) {
      console.warn(`LineChart: Dataset not found: ${datasetId}`);
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
    
    console.log(`LineChart: Updated dataset with legend support: ${datasetId}`);
    this.update();
    
    return this;
  }
  
  /**
   * Toggle point display - works in both single and panel modes
   */
  togglePoints(show = null) {
    this.config.options.showPoints = show !== null ? show : !this.config.options.showPoints;
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ 
            showPoints: this.config.options.showPoints,
            pointRadius: this.config.options.pointRadius
          });
        }
      }
    }
    
    console.log(`LineChart: Points ${this.config.options.showPoints ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showPoints;
  }
  
  /**
   * Set stroke width for all lines - works in both single and panel modes
   */
  setStrokeWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      console.warn('Invalid stroke width provided');
      return this;
    }
    
    this.config.options.strokeWidth = width;
    
    // Update all datasets that don't have custom widths
    this.config.data.forEach(dataset => {
      if (!dataset.customWidth) {
        dataset.width = width;
      }
    });
    
    // If in panel mode, update all panel renderers
    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ strokeWidth: width });
        }
      }
    }
    
    console.log(`LineChart: Stroke width set to: ${width}`);
    this.render();
    return this;
  }
  
  /**
   * Set point radius
   */
  setPointRadius(radius) {
    if (typeof radius !== 'number' || radius <= 0) {
      console.warn('Invalid point radius provided');
      return this;
    }
    
    this.config.options.pointRadius = radius;
    console.log(`LineChart: Point radius set to: ${radius}`);
    
    this.render();
    return this;
  }

  /**
   * NEW: Enable/disable coordinate validation
   */
  setCoordinateValidation(enabled) {
    this.config.options.enableCoordinateValidation = enabled;
    
    // Update PathGenerator validation as well
    if (this.pathGenerator) {
      this.pathGenerator.setCoordinateValidation(enabled);
    }
    
    console.log(`LineChart: Coordinate validation ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  }

  /**
   * NEW: Enable/disable rendering debug info
   */
  setRenderingDebug(enabled) {
    this.config.options.enableRenderingDebug = enabled;
    console.log(`LineChart: Rendering debug ${enabled ? 'enabled' : 'disabled'}`);
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
   * Get line chart specific information - includes panel mode details
   */
  getLineChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    const info = {
      ...baseInfo,
      chartType: 'line',
      curveType: this.config.options.curve,
      strokeWidth: this.config.options.strokeWidth,
      showPoints: this.config.options.showPoints,
      pointRadius: this.config.options.pointRadius,
      coordinateSystem: 'unified',
      coordinateValidation: this.config.options.enableCoordinateValidation,
      renderingDebug: this.config.options.enableRenderingDebug,
      datasets: this.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        color: dataset.color,
        pointCount: dataset.data?.length || 0,
        width: dataset.width,
        fill: dataset.fill || false
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
      console.log('LineChart: Optimizing for large dataset - switching to WebGL with unified coordinates');
      return this.switchRenderer('webgl');
    } else {
      console.log('LineChart: Dataset size acceptable for current renderer');
      return Promise.resolve();
    }
  }

  /**
   * NEW: Test coordinate system consistency between renderers
   */
  async testCoordinateConsistency() {
    if (!this.config.data || this.config.data.length === 0) {
      console.warn('LineChart: No data available for consistency test');
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
      testResults.canvas = {
        renderer: 'canvas',
        validationResults: [...this.coordinateValidationResults],
        coordinateSystem: 'unified'
      };

      // Test with WebGL renderer (if supported)
      if (this.getRendererInfo().webglSupported) {
        await this.switchRenderer('webgl');
        if (this.config.options.enableCoordinateValidation) {
          this._validateUnifiedCoordinates();
        }
        testResults.webgl = {
          renderer: 'webgl',
          validationResults: [...this.coordinateValidationResults],
          coordinateSystem: 'unified'
        };
      }

      // Switch back to original renderer
      await this.switchRenderer(originalRenderer);

      console.log('LineChart: Coordinate consistency test completed:', testResults);
      return testResults;

    } catch (error) {
      console.error('LineChart: Coordinate consistency test failed:', error);
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
}
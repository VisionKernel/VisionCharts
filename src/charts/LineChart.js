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
   * UPDATED: Render line chart data using unified coordinates
   */
  async _renderChartData() {
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

      // Render lines using standardized paths with unified coordinates
      await this.rendererInstance.renderLines(this.generatedPaths, this.scales, {
        showPoints: this.config.options.showPoints,
        pointRadius: this.config.options.pointRadius
      });

      const totalVertices = this.generatedPaths.reduce((sum, path) => sum + (path.vertexCount || 0), 0);
      console.log(`LineChart: Rendered ${this.generatedPaths.length} datasets with ${totalVertices} total vertices using ${this.activeRenderer} with UNIFIED coordinates`);

      // NEW: Collect rendering debug info
      if (this.config.options.enableRenderingDebug) {
        this._collectRenderingDebugInfo();
      }

    } catch (error) {
      console.error('Error rendering line chart data:', error);
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
   * Set curve type for line interpolation - now updates PathGenerator
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
    
    console.log(`LineChart curve type set to: ${curveType}`);
    
    this.render(); // Re-render with new curve type
    return this;
  }
  
  /**
   * Add a new dataset to the chart
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
      ...dataset
    };
    
    this.config.data.push(processedDataset);
    
    console.log(`LineChart: Added dataset with unified coordinates: ${processedDataset.id} with ${processedDataset.data.length} points`);
    
    // Update and re-render
    this.update();
    
    return this;
  }
  
  /**
   * Remove a dataset by ID
   */
  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);
    
    if (this.config.data.length < initialCount) {
      console.log(`LineChart: Removed dataset: ${datasetId}`);
      this.update();
    } else {
      console.warn(`LineChart: Dataset not found: ${datasetId}`);
    }
    
    return this;
  }
  
  /**
   * Update a specific dataset
   */
  updateDataset(datasetId, newData) {
    const dataset = this.config.data.find(ds => ds.id === datasetId);
    
    if (!dataset) {
      console.warn(`LineChart: Dataset not found: ${datasetId}`);
      return this;
    }
    
    // Update dataset properties
    Object.assign(dataset, newData);
    
    console.log(`LineChart: Updated dataset with unified coordinates: ${datasetId}`);
    this.update();
    
    return this;
  }
  
  /**
   * Toggle point visibility
   */
  togglePoints(show = null) {
    this.config.options.showPoints = show !== null ? show : !this.config.options.showPoints;
    console.log(`LineChart: Points ${this.config.options.showPoints ? 'enabled' : 'disabled'}`);
    
    this.render();
    return this.config.options.showPoints;
  }
  
  /**
   * Set stroke width for all lines
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
   * Get line chart specific information
   */
  getLineChartInfo() {
    const baseInfo = this.getRendererInfo();
    
    return {
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
        width: dataset.width
      })),
      validationResults: this.coordinateValidationResults.length > 0 ? this.coordinateValidationResults : null
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
}
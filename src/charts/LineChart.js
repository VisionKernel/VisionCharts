import { Chart } from '../core/Chart.js';

export class LineChart extends Chart {
  constructor(config = {}) {
    super(config);
    this.chartType = 'line';
    this.config.options = {
      ...this.config.options,
      curve: 'monotone',
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      enableCoordinateValidation: true,
      enableRenderingDebug: false,
      ...config.options
    };
    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
    this.supportsStudies = true;
  }

  async _renderChartData() {
    if (this.isPanelMode) {
      return;
    }

    if (!this.rendererInstance) {
      return;
    }

    if (!this.generatedPaths || !Array.isArray(this.generatedPaths) || this.generatedPaths.length === 0) {
      return;
    }

    try {
      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }

      this.rendererInstance.setViewport(this.chartArea);

      await this.rendererInstance.renderLines(this.generatedPaths, this.scales, {
        showPoints: this.config.options.showPoints,
        pointRadius: this.config.options.pointRadius,
        enableFill: true,
        chartArea: this.chartArea,
        fillOpacity: 0.3
      });

      const totalVertices = this.generatedPaths.reduce((sum, path) => sum + (path.vertexCount || 0), 0);

      if (this.config.options.enableRenderingDebug) {
        this._collectRenderingDebugInfo();
      }
    } catch (error) {
      throw error;
    }
  }

  _validateUnifiedCoordinates() {
    this.coordinateValidationResults = [];

    if (!this.generatedPaths || this.generatedPaths.length === 0) {
      return;
    }

    for (const pathData of this.generatedPaths) {
      const validationResult = this._validatePathCoordinates(pathData);
      this.coordinateValidationResults.push(validationResult);
    }

    const totalPaths = this.coordinateValidationResults.length;
    const validPaths = this.coordinateValidationResults.filter(r => r.isValid).length;
    const totalVertices = this.coordinateValidationResults.reduce((sum, r) => sum + r.vertexCount, 0);

    const invalidPaths = this.coordinateValidationResults.filter(r => !r.isValid);
    if (invalidPaths.length > 0) {
      // intentionally left blank (no logging)
    }
  }

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

    if (pathData.coordinateSystem !== 'unified') {
      validation.issues.push(`Unexpected coordinate system: ${pathData.coordinateSystem}`);
    }

    let validVertices = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

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

    const chartArea = this.chartArea;
    const tolerance = 100;

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
        sampleVertices: path.vertices.slice(0, 3)
      })),
      validationResults: this.coordinateValidationResults
    };
  }

  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];

    if (!validCurves.includes(curveType)) {
      return this;
    }

    this.config.options.curve = curveType;

    if (this.isPanelMode && this.panelManager && this.panelManager.panels) {
      for (const panel of this.panelManager.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.setCurveType(curveType);
        }
      }
      this.panelManager._renderPanels();
    } else {
      this.render();
    }

    return this;
  }

  updateDatasetFill(datasetId, fillEnabled) {
    try {
      const dataset = this.config.data.find(d => d.id === datasetId);

      if (!dataset) {
        return false;
      }

      dataset.fill = fillEnabled;

      // Clear caches so the updated fill property is not overwritten by cached datasets
      if (this.dataProcessor) {
        this.dataProcessor.clearCache();
      }
      if (this.coordinateSystem) {
        this.coordinateSystem.clearCache();
      }

      this.render();

      return true;
    } catch (error) {
      return false;
    }
  }

  updateDatasetFillOpacity(datasetId, fillOpacity) {
    try {
      const dataset = this.config.data.find(d => d.id === datasetId);

      if (!dataset) {
        return false;
      }

      const validOpacity = Math.max(0, Math.min(1, fillOpacity));
      dataset.fillOpacity = validOpacity;

      if (this.dataProcessor) {
        this.dataProcessor.clearCache();
      }
      if (this.coordinateSystem) {
        this.coordinateSystem.clearCache();
      }

      this.render();

      return true;
    } catch (error) {
      console.error('Error updating dataset fill opacity:', error);
      return false;
    }
  }

  addDataset(dataset) {
    if (!dataset || !dataset.data) {
      return this;
    }

    const processedDataset = {
      id: dataset.id || `dataset-${this.config.data.length + 1}`,
      name: dataset.name || `Dataset ${this.config.data.length + 1}`,
      color: dataset.color || this._getDefaultColor(this.config.data.length),
      width: dataset.width || this.config.options.strokeWidth,
      fill: dataset.fill !== undefined ? dataset.fill : false,
      ...dataset
    };

    this.config.data.push(processedDataset);

    if (this.legend) {
      this.legend.updateDatasets(this.config.data);
    }

    if (this.isPanelMode) {
      return this.panelManager.refreshPanelMode();
    } else {
      return this.update();
    }
  }

  removeDataset(datasetId) {
    const initialCount = this.config.data.length;
    this.config.data = this.config.data.filter(dataset => dataset.id !== datasetId);

    if (this.config.data.length < initialCount) {
      if (this.legend) {
        this.legend.updateDatasets(this.config.data);
      }

      if (this.isPanelMode) {
        return this.panelManager.refreshPanelMode();
      } else {
        return this.update();
      }
    }

    return this;
  }

  updateDataset(datasetId, newData) {
    const dataset = this.config.data.find(ds => ds.id === datasetId);

    if (!dataset) {
      return this;
    }

    Object.assign(dataset, newData);

    if (newData.color && this.legend) {
      this.legend.updateDatasetColor(datasetId, newData.color);
    }

    if (newData.name && this.legend) {
      this.legend.updateDatasets(this.config.data);
    }

    if (this.isPanelMode) {
      return this.panelManager.refreshPanelMode();
    } else {
      return this.update();
    }
  }

  togglePoints(show = null) {
    this.config.options.showPoints = show !== null ? show : !this.config.options.showPoints;

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

    this.render();
    return this.config.options.showPoints;
  }

  setStrokeWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      return this;
    }

    this.config.options.strokeWidth = width;

    this.config.data.forEach(dataset => {
      if (!dataset.customWidth) {
        dataset.width = width;
      }
    });

    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ strokeWidth: width });
        }
      }
    }

    this.render();
    return this;
  }

  setPointRadius(radius) {
    if (typeof radius !== 'number' || radius <= 0) {
      return this;
    }

    this.config.options.pointRadius = radius;

    this.render();
    return this;
  }

  setCoordinateValidation(enabled) {
    this.config.options.enableCoordinateValidation = enabled;

    if (this.pathGenerator) {
      this.pathGenerator.setCoordinateValidation(enabled);
    }

    return this;
  }

  setRenderingDebug(enabled) {
    this.config.options.enableRenderingDebug = enabled;
    return this;
  }

  getCoordinateValidationResults() {
    return this.coordinateValidationResults;
  }

  getRenderingDebugInfo() {
    return this.renderingDebugInfo;
  }

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

    if (this.isPanelMode) {
      info.panelMode = this.getPanelModeInfo();
    }

    return info;
  }

  optimizeForLargeDataset() {
    const currentRenderer = this.activeRenderer;

    if (this.dataPointCount > this.performanceThresholds.canvas && currentRenderer !== 'webgl') {
      return this.switchRenderer('webgl');
    } else {
      return Promise.resolve();
    }
  }

  async testCoordinateConsistency() {
    if (!this.config.data || this.config.data.length === 0) {
      return null;
    }

    const originalRenderer = this.activeRenderer;
    const testResults = {};

    try {
      await this.switchRenderer('canvas');
      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }
      testResults.canvas = {
        renderer: 'canvas',
        validationResults: [...this.coordinateValidationResults],
        coordinateSystem: 'unified'
      };

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

      await this.switchRenderer(originalRenderer);
      return testResults;
    } catch (error) {
      await this.switchRenderer(originalRenderer);
      throw error;
    }
  }

  findClosestDataPoints(targetDataX, dataset = null) {
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
      return [];
    }
  }

  getDataPointsAtX(exactDataX, dataset = null) {
    const targetDataset = dataset || this.config.data[0];

    if (!targetDataset || !targetDataset.data || targetDataset.data.length === 0) {
      return [];
    }

    try {
      const matchingPoints = [];
      const tolerance = this._calculateMouseProximityTolerance();

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

      if (matchingPoints.length === 0) {
        return [];
      }

      return matchingPoints;
    } catch (error) {
      return [];
    }
  }

  _binarySearchClosest(data, targetX) {
    if (!data || data.length === 0) return null;

    const isSorted = this._isDataSorted(data);

    if (isSorted) {
      return this._binarySearchSorted(data, targetX);
    } else {
      return this._linearSearchClosest(data, targetX);
    }
  }

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

      if (distance < minDistance) {
        minDistance = distance;
        closest = midPoint;
      }

      if (midX < targetX) {
        left = mid + 1;
      } else if (midX > targetX) {
        right = mid - 1;
      } else {
        return midPoint;
      }
    }

    return closest;
  }

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

  _isDataSorted(data) {
    if (data.length < 2) return true;

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

  _extractXValue(point) {
    const x = point.x || point.date || point.time || point.timestamp;

    if (x instanceof Date) {
      return x.getTime();
    }

    if (typeof x === 'string' && this.config.options.xType === 'time') {
      return new Date(x).getTime();
    }

    return typeof x === 'number' ? x : null;
  }

  _extractYValue(point) {
    const y = point.y || point.value || point.price || point.close;
    return typeof y === 'number' ? y : null;
  }

  destroy() {
    super.destroy();
    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
  }
}

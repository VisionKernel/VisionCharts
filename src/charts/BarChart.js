import { Chart } from '../core/Chart.js';

export class BarChart extends Chart {
  constructor(config = {}) {
    super(config);

    this.chartType = 'bar';

    this.config.options = {
      ...this.config.options,
      barWidth: 0.7,
      barSpacing: 0.1,
      showBorder: false,
      borderWidth: 1,
      enableCoordinateValidation: true,
      enableRenderingDebug: false,
      ...config.options
    };

    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
    this.barPositioningInfo = null;

    this.supportsStudies = true;
  }

  async _renderChartData() {
    if (this.isPanelMode) {
      return;
    }

    if (!this.rendererInstance) {
      return;
    }

    if (!Array.isArray(this.config.data) || this.config.data.length === 0) {
      return;
    }

    try {
      this.transformedData = this.config.data;

      if (this.config.options.enableCoordinateValidation) {
        this._validateUnifiedCoordinates();
      }

      this.rendererInstance.setViewport(this.chartArea);

      await this.rendererInstance.renderBars(this.transformedData, this.scales, {
        barWidth: this.config.options.barWidth,
        showBorder: this.config.options.showBorder,
        borderWidth: this.config.options.borderWidth,
        chartArea: this.chartArea
      });

      if (this.config.options.enableRenderingDebug) {
        this._collectRenderingDebugInfo();
      }
    } catch (error) {
      throw error;
    }
  }

  _validateUnifiedCoordinates() {
    if (this.isPanelMode) {
      return;
    }

    this.coordinateValidationResults = [];

    if (!this.transformedData || this.transformedData.length === 0) {
      return;
    }

    for (let datasetIndex = 0; datasetIndex < this.transformedData.length; datasetIndex++) {
      const dataset = this.transformedData[datasetIndex];
      const validation = this._validateDatasetCoordinates(dataset, datasetIndex);
      this.coordinateValidationResults.push(validation);
    }
  }

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

    let validPoints = 0;
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (let i = 0; i < dataset.data.length; i++) {
      const point = dataset.data[i];
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

    const chartArea = this.chartArea;
    const tolerance = 100;

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

    const unifiedXValues = data
      .map(point => point.unifiedX || point.screenX)
      .filter(x => x != null && isFinite(x))
      .sort((a, b) => a - b);

    let avgPixelDistance = 0;
    let calculatedBarWidth = 0;

    if (unifiedXValues.length > 1) {
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
      unifiedXRange:
        unifiedXValues.length > 0
          ? {
              min: unifiedXValues[0],
              max: unifiedXValues[unifiedXValues.length - 1]
            }
          : null,
      chartArea: this.chartArea,
      scaleRange: {
        x: this.scales.x.range,
        y: this.scales.y.range
      }
    };
  }

  _collectRenderingDebugInfo() {
    if (this.isPanelMode) {
      return;
    }

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
        sampleBars: dataset.data
          ? dataset.data.slice(0, 3).map(point => ({
              unifiedX: point.unifiedX || point.screenX,
              unifiedY: point.unifiedY || point.screenY
            }))
          : []
      })),
      barPositioningInfo: this.barPositioningInfo,
      validationResults: this.coordinateValidationResults
    };
  }

  addDataset(dataset) {
    if (!dataset || !dataset.data) {
      return this;
    }

    const processedDataset = {
      id: dataset.id || `dataset-${this.config.data.length + 1}`,
      name: dataset.name || `Dataset ${this.config.data.length + 1}`,
      color: dataset.color || this._getDefaultColor(this.config.data.length),
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

  setBarWidth(width) {
    if (typeof width !== 'number' || width <= 0 || width > 1) {
      return this;
    }

    this.config.options.barWidth = width;

    this.render();
    return this;
  }

  setBarSpacing(spacing) {
    if (typeof spacing !== 'number' || spacing < 0 || spacing > 1) {
      return this;
    }

    this.config.options.barSpacing = spacing;

    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ barSpacing: spacing });
        }
      }
    }

    this.render();
    return this;
  }

  toggleBorders(show = null) {
    this.config.options.showBorder = show !== null ? show : !this.config.options.showBorder;

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

    this.render();
    return this.config.options.showBorder;
  }

  setBorderWidth(width) {
    if (typeof width !== 'number' || width <= 0) {
      return this;
    }

    this.config.options.borderWidth = width;

    if (this.isPanelMode) {
      for (const panel of this.panels) {
        if (panel.panelDataRenderer) {
          panel.panelDataRenderer.updateConfig({ borderWidth: width });
        }
      }
    }

    if (this.config.options.showBorder) {
      this.render();
    }

    return this;
  }

  setCoordinateValidation(enabled) {
    this.config.options.enableCoordinateValidation = enabled;
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

  getBarPositioningInfo() {
    return this.barPositioningInfo;
  }

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

  applyHistogramStyling() {
    this.config.options.barWidth = 0.95;
    this.config.options.barSpacing = 0.02;
    this.config.options.showBorder = true;
    this.config.options.borderWidth = 1;

    this.render();

    return this;
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
      if (this.config.options.enableRenderingDebug) {
        this._calculateBarPositioningInfo();
      }
      testResults.canvas = {
        renderer: 'canvas',
        validationResults: [...this.coordinateValidationResults],
        barPositioningInfo: this.barPositioningInfo ? { ...this.barPositioningInfo } : null,
        coordinateSystem: 'unified'
      };

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
        return [
          {
            ...closestPoint,
            datasetId: targetDataset.id,
            dataset: targetDataset,
            dataX: this._extractXValue(closestPoint),
            dataY: this._extractYValue(closestPoint),
            color: targetDataset.color
          }
        ];
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

  _calculateBarTolerance(dataset) {
    if (!dataset.data || dataset.data.length < 2) {
      return 1000;
    }

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
      return 1000;
    }

    const avgDistance = totalDistance / validDistances;

    return avgDistance * 0.5;
  }

  destroy() {
    super.destroy();

    this.coordinateValidationResults = [];
    this.renderingDebugInfo = null;
    this.barPositioningInfo = null;
  }
}

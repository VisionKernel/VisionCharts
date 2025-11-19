export class CoordinateSystem {
  constructor(config = {}) {
    this.config = {
      targetRenderer: config.targetRenderer || 'auto',
      coordinateOrigin: 'bottom-left',
      useUnifiedCoordinates: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      enableHighDPI: true,
      viewport: {
        x: 0,
        y: 0,
        width: 800,
        height: 600
      },
      chartArea: {
        x: 80,
        y: 40,
        width: 660,
        height: 520
      },
      batchSize: 1000,
      enableCaching: true,
      enableClipping: true,
      enableTransforms: true,
      ...config
    };

    this.scales = { x: null, y: null };
    this.transforms = {
      scale: { x: 1, y: 1 },
      translate: { x: 0, y: 0 },
      rotate: 0
    };

    this.coordinateCache = new Map();
    this.transformedDatasets = new Map();

    this.rendererCoordinateSystems = {
      canvas: {
        origin: 'top-left',
        yDirection: 'down',
        requiresFlip: true
      },
      webgl: {
        origin: 'bottom-left',
        yDirection: 'up',
        requiresFlip: false
      },
      svg: {
        origin: 'top-left',
        yDirection: 'down',
        requiresFlip: true
      }
    };

    this.transformStats = {
      totalTransformations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageTransformTime: 0
    };
  }

  setScales(scales) {
    this.scales = scales;
    if (this.config.useUnifiedCoordinates) {
      this._configureScalesForUnifiedCoordinates();
    }
    this._clearCache();
    return this;
  }

  _configureScalesForUnifiedCoordinates() {
    if (this.scales.x) {
      this.scales.x.setCoordinateSystem('normalized', 'horizontal');
    }
    if (this.scales.y) {
      this.scales.y.setCoordinateSystem('normalized', 'vertical');
    }
  }

  setTargetRenderer(renderer) {
    this.config.targetRenderer = renderer;
    this._clearCache();
    return this;
  }

  setViewport(viewport) {
    this.config.viewport = { ...this.config.viewport, ...viewport };
    this._clearCache();
    return this;
  }

  setChartArea(chartArea) {
    this.config.chartArea = { ...this.config.chartArea, ...chartArea };
    this._clearCache();
    return this;
  }

  async transformDatasets(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }

    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales must be set before transforming coordinates');
    }

    const startTime = performance.now();
    const transformedDatasets = [];

    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        const transformedDataset = await this.transformDataset(dataset, options);
        transformedDatasets.push(transformedDataset);
      }

      const transformTime = performance.now() - startTime;
      this._updateTransformStats(transformTime, datasets.length);
      return transformedDatasets;
    } catch (error) {
      throw error;
    }
  }

  async transformDataset(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }

    const cacheKey = this._generateCacheKey(dataset, options);

    if (this.config.enableCaching && this.coordinateCache.has(cacheKey)) {
      this.transformStats.cacheHits++;
      return this.coordinateCache.get(cacheKey);
    }

    this.transformStats.cacheMisses++;

    try {
      const transformedData = await this._transformDataPoints(dataset.data, options);
      const transformedDataset = {
        ...dataset,
        data: transformedData,
        coordinatesTransformed: true,
        coordinateSystem: 'unified',
        transformedAt: Date.now(),
        originalDataCount: dataset.data.length,
        transformedDataCount: transformedData.length
      };

      if (this.config.enableCaching) {
        this.coordinateCache.set(cacheKey, transformedDataset);
      }

      return transformedDataset;
    } catch (error) {
      throw error;
    }
  }

  async _transformDataPoints(data, options) {
    const transformedData = [];
    let processedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];

      try {
        const dataCoords = this._extractDataCoordinates(point);

        if (dataCoords.x == null || dataCoords.y == null) {
          if (options.strictValidation) {
            throw new Error(`Missing coordinates at point ${i}`);
          }
          console.warn(`Skipping point ${i} due to missing coordinates`);
          continue;
        }

        const unifiedCoords = this.dataToUnified(dataCoords.x, dataCoords.y);

        if (unifiedCoords.x == null || unifiedCoords.y == null) {
          if (options.strictValidation) {
            throw new Error(`Invalid unified coordinates at point ${i}`);
          }
          console.warn(`Skipping point ${i} due to invalid unified coordinates`);
          continue;
        }

        const transformedPoint = {
          ...point,
          dataX: dataCoords.x,
          dataY: dataCoords.y,
          unifiedX: unifiedCoords.x,
          unifiedY: unifiedCoords.y,
          screenX: unifiedCoords.x,
          screenY: unifiedCoords.y,
          pixelX: unifiedCoords.x,
          pixelY: unifiedCoords.y,
          inBounds: this._isPointInBounds(unifiedCoords.x, unifiedCoords.y),
          coordinateSystem: 'unified',
          ...(this.config.enableHighDPI && this.config.devicePixelRatio > 1 ? {
            hiDPIX: unifiedCoords.x * this.config.devicePixelRatio,
            hiDPIY: unifiedCoords.y * this.config.devicePixelRatio
          } : {})
        };

        transformedData.push(transformedPoint);
        processedCount++;
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        console.warn(`Error transforming point ${i}:`, error.message);
      }

      if (i % this.config.batchSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return transformedData;
  }

  _extractDataCoordinates(point) {
    const x = point.x || point.date || point.time || point.timestamp;
    const y = point.y || point.value || point.price || point.close;

    let normalizedX = x;
    if (x instanceof Date) {
      normalizedX = x.getTime();
    } else if (typeof x === 'string') {
      const parsed = new Date(x);
      if (!isNaN(parsed.getTime())) {
        normalizedX = parsed.getTime();
      } else {
        normalizedX = parseFloat(x);
      }
    }

    let normalizedY = y;
    if (typeof y === 'string') {
      normalizedY = parseFloat(y);
    }

    return {
      x: normalizedX,
      y: normalizedY
    };
  }

  dataToUnified(dataX, dataY) {
    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales not available for coordinate transformation');
    }

    try {
      let unifiedX = this.scales.x.scale(dataX);
      let unifiedY = this.scales.y.scale(dataY);

      if (!isFinite(unifiedX) || !isFinite(unifiedY)) {
        return { x: null, y: null };
      }

      const transformedCoords = this._applyUnifiedCoordinateTransforms(unifiedX, unifiedY);

      return {
        x: transformedCoords.x,
        y: transformedCoords.y
      };
    } catch (error) {
      console.error('Error in dataToUnified transformation:', error);
      return { x: null, y: null };
    }
  }

  unifiedToRenderer(unifiedX, unifiedY, targetRenderer) {
    const rendererSystem = this.rendererCoordinateSystems[targetRenderer];

    if (!rendererSystem) {
      console.warn(`Unknown renderer: ${targetRenderer}, using unified coordinates`);
      return { x: unifiedX, y: unifiedY };
    }

    let rendererX = unifiedX;
    let rendererY = unifiedY;

    if (rendererSystem.requiresFlip) {
      const chartArea = this.config.chartArea;
      const chartHeight = chartArea.height;
      const chartTop = chartArea.y;
      rendererY = chartTop + chartHeight - (unifiedY - chartTop);
    }

    return {
      x: rendererX,
      y: rendererY,
      coordinateSystem: targetRenderer
    };
  }

  rendererToUnified(rendererX, rendererY, sourceRenderer) {
    const rendererSystem = this.rendererCoordinateSystems[sourceRenderer];

    if (!rendererSystem) {
      console.warn(`Unknown renderer: ${sourceRenderer}, using coordinates as-is`);
      return { x: rendererX, y: rendererY };
    }

    let unifiedX = rendererX;
    let unifiedY = rendererY;

    if (rendererSystem.requiresFlip) {
      const chartArea = this.config.chartArea;
      const chartHeight = chartArea.height;
      const chartTop = chartArea.y;
      unifiedY = chartTop + chartHeight - (rendererY - chartTop);
    }

    return {
      x: unifiedX,
      y: unifiedY,
      coordinateSystem: 'unified'
    };
  }

  unifiedToData(unifiedX, unifiedY) {
    if (!this.scales.x || !this.scales.y) {
      throw new Error('Scales not available for coordinate transformation');
    }

    try {
      const originalCoords = this._reverseUnifiedCoordinateTransforms(unifiedX, unifiedY);
      const dataX = this.scales.x.invert(originalCoords.x);
      const dataY = this.scales.y.invert(originalCoords.y);
      return { x: dataX, y: dataY };
    } catch (error) {
      console.error('Error in unifiedToData transformation:', error);
      return { x: null, y: null };
    }
  }

  dataToPixel(dataX, dataY) {
    return this.dataToUnified(dataX, dataY);
  }

  pixelToData(pixelX, pixelY) {
    return this.unifiedToData(pixelX, pixelY);
  }

  _applyUnifiedCoordinateTransforms(x, y) {
    let transformedX = x;
    let transformedY = y;

    if (this.config.enableTransforms) {
      transformedX *= this.transforms.scale.x;
      transformedY *= this.transforms.scale.y;
      transformedX += this.transforms.translate.x;
      transformedY += this.transforms.translate.y;
      if (this.transforms.rotate !== 0) {
        const cos = Math.cos(this.transforms.rotate);
        const sin = Math.sin(this.transforms.rotate);
        const rotatedX = transformedX * cos - transformedY * sin;
        const rotatedY = transformedX * sin + transformedY * cos;
        transformedX = rotatedX;
        transformedY = rotatedY;
      }
    }

    return { x: transformedX, y: transformedY };
  }

  _reverseUnifiedCoordinateTransforms(x, y) {
    let originalX = x;
    let originalY = y;

    if (this.config.enableTransforms) {
      if (this.transforms.rotate !== 0) {
        const cos = Math.cos(-this.transforms.rotate);
        const sin = Math.sin(-this.transforms.rotate);
        const rotatedX = originalX * cos - originalY * sin;
        const rotatedY = originalX * sin + originalY * cos;
        originalX = rotatedX;
        originalY = rotatedY;
      }
      originalX -= this.transforms.translate.x;
      originalY -= this.transforms.translate.y;
      originalX /= this.transforms.scale.x;
      originalY /= this.transforms.scale.y;
    }

    return { x: originalX, y: originalY };
  }

  _isPointInBounds(x, y) {
    const chartArea = this.config.chartArea;
    return x >= chartArea.x &&
      x <= chartArea.x + chartArea.width &&
      y >= chartArea.y &&
      y <= chartArea.y + chartArea.height;
  }

  eventToData(event, element, sourceRenderer = 'canvas') {
    const rect = element.getBoundingClientRect();
    const rendererX = event.clientX - rect.left;
    const rendererY = event.clientY - rect.top;
    const unifiedCoords = this.rendererToUnified(rendererX, rendererY, sourceRenderer);
    return this.unifiedToData(unifiedCoords.x, unifiedCoords.y);
  }

  dataToEvent(dataX, dataY, element, targetRenderer = 'canvas') {
    const unifiedCoords = this.dataToUnified(dataX, dataY);
    const rendererCoords = this.unifiedToRenderer(unifiedCoords.x, unifiedCoords.y, targetRenderer);
    const rect = element.getBoundingClientRect();
    return {
      x: rendererCoords.x + rect.left,
      y: rendererCoords.y + rect.top
    };
  }

  setTransforms(transforms) {
    this.transforms = { ...this.transforms, ...transforms };
    this._clearCache();
    return this;
  }

  resetTransforms() {
    this.transforms = {
      scale: { x: 1, y: 1 },
      translate: { x: 0, y: 0 },
      rotate: 0
    };
    this._clearCache();
    return this;
  }

  getCoordinateInfo() {
    return {
      config: this.config,
      coordinateSystem: 'unified',
      targetRenderer: this.config.targetRenderer,
      scales: {
        x: this.scales.x ? {
          domain: this.scales.x.domain,
          range: this.scales.x.range,
          type: this.scales.x.type,
          coordinateSystem: this.scales.x.coordinateSystem
        } : null,
        y: this.scales.y ? {
          domain: this.scales.y.domain,
          range: this.scales.y.range,
          type: this.scales.y.type,
          coordinateSystem: this.scales.y.coordinateSystem
        } : null
      },
      transforms: this.transforms,
      performanceStats: this.transformStats,
      rendererCoordinateSystems: this.rendererCoordinateSystems
    };
  }

  clearCache() {
    this._clearCache();
  }

  _clearCache() {
    this.coordinateCache.clear();
    this.transformedDatasets.clear();
  }

  _generateCacheKey(dataset, options) {
    const scaleInfo = {
      x: this.scales.x ? {
        domain: this.scales.x.domain,
        range: this.scales.x.range,
        type: this.scales.x.type,
        coordinateSystem: this.scales.x.coordinateSystem
      } : null,
      y: this.scales.y ? {
        domain: this.scales.y.domain,
        range: this.scales.y.range,
        type: this.scales.y.type,
        coordinateSystem: this.scales.y.coordinateSystem
      } : null
    };

    const cacheData = {
      datasetId: dataset.id || 'unknown',
      dataHash: this._hashData(dataset.data),
      scales: scaleInfo,
      transforms: this.transforms,
      config: {
        coordinateOrigin: this.config.coordinateOrigin,
        useUnifiedCoordinates: this.config.useUnifiedCoordinates,
        targetRenderer: this.config.targetRenderer,
        viewport: this.config.viewport,
        chartArea: this.config.chartArea
      },
      options
    };

    return this._hashObject(cacheData);
  }

  _hashData(data) {
    if (!Array.isArray(data) || data.length === 0) return '0';
    const first = data[0];
    const middle = data[Math.floor(data.length / 2)];
    const last = data[data.length - 1];
    return `${data.length}-${JSON.stringify(first)}-${JSON.stringify(middle)}-${JSON.stringify(last)}`.replace(/\s/g, '');
  }

  _hashObject(obj) {
    return JSON.stringify(obj).replace(/\s/g, '');
  }

  _updateTransformStats(transformTime, datasetCount) {
    this.transformStats.totalTransformations += datasetCount;
    const alpha = 0.1;
    this.transformStats.averageTransformTime =
      this.transformStats.averageTransformTime * (1 - alpha) +
      transformTime * alpha;
  }

  getPerformanceStats() {
    return {
      ...this.transformStats,
      cacheEfficiency: this.transformStats.cacheHits /
        (this.transformStats.cacheHits + this.transformStats.cacheMisses) || 0
    };
  }

  static createForChart(chartType, viewport, chartArea, options = {}) {
    const config = {
      viewport,
      chartArea,
      coordinateOrigin: 'bottom-left',
      useUnifiedCoordinates: true,
      targetRenderer: 'auto',
      ...options
    };

    switch (chartType) {
      case 'line':
      case 'area':
        config.enableTransforms = true;
        break;
      case 'bar':
        config.enableClipping = true;
        break;
      case 'scatter':
        config.enableHighDPI = true;
        break;
    }

    return new CoordinateSystem(config);
  }
}
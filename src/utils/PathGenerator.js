export class PathGenerator {
  constructor(config = {}) {
    this.config = {
      curve: 'linear',
      targetRenderer: 'auto',
      batchSize: 1000,
      enableOptimization: true,
      smoothing: 0.5,
      tension: 0.4,
      enableCoordinateValidation: true,
      fillOpacity: 0.3,
      ...config
    };
  }

  static async generatePaths(datasets, options = {}) {
    const generator = PathGenerator.getSharedInstance(options);
    return await generator.generatePaths(datasets, options);
  }

  static async generatePath(dataset, options = {}) {
    const generator = PathGenerator.getSharedInstance(options);
    return await generator.generatePath(dataset, options);
  }

  static getSharedInstance(config = {}) {
    const configKey = `${config.curve || 'linear'}-${config.targetRenderer || 'auto'}`;

    if (!PathGenerator._sharedInstances) {
      PathGenerator._sharedInstances = new Map();
    }

    let instance = PathGenerator._sharedInstances.get(configKey);

    if (!instance) {
      instance = new PathGenerator(config);
      PathGenerator._sharedInstances.set(configKey, instance);
    }

    return instance;
  }

  static updateSharedConfig(configKey, newConfig) {
    if (!PathGenerator._sharedInstances) return false;

    const instance = PathGenerator._sharedInstances.get(configKey);
    if (instance) {
      Object.assign(instance.config, newConfig);
      return true;
    }
    return false;
  }

  static clearSharedInstances() {
    if (PathGenerator._sharedInstances) {
      PathGenerator._sharedInstances.clear();
    }
  }

  async generatePaths(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }

    const pathOptions = { ...this.config, ...options };
    const generatedPaths = [];

    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        const pathData = await this.generatePath(dataset, pathOptions);
        generatedPaths.push(pathData);
      }

      return generatedPaths;
    } catch (error) {
      throw error;
    }
  }

  async generatePath(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }

    const pathOptions = { ...this.config, ...options };
    const data = dataset.data;

    const unifiedPoints = this._extractUnifiedCoordinates(data);

    if (unifiedPoints.length === 0) {
      return this._createEmptyPath(dataset);
    }

    if (pathOptions.enableCoordinateValidation) {
      this._validateUnifiedCoordinates(unifiedPoints, dataset.name || dataset.id);
    }

    const vertices = await this._generateVertices(unifiedPoints, pathOptions);
    const colors = this._generateColors(vertices, dataset, pathOptions);

    return {
      id: dataset.id,
      name: dataset.name,
      color: dataset.color,
      fill: dataset.fill || false,
      fillOpacity: pathOptions.fillOpacity || 0.6,
      vertices: vertices,
      colors: colors,
      lineWidth: dataset.width || pathOptions.strokeWidth || 2,
      curveType: pathOptions.curve,
      vertexCount: vertices.length,
      coordinateSystem: 'unified',
      targetRenderer: pathOptions.targetRenderer,
      originalDataset: dataset,
      generatedAt: Date.now(),
      unifiedPointCount: unifiedPoints.length
    };
  }

  _extractUnifiedCoordinates(data) {
    return data
      .map(point => ({
        x: point.unifiedX || point.screenX || point.x,
        y: point.unifiedY || point.screenY || point.y
      }))
      .filter(point => point.x !== undefined && point.y !== undefined && !isNaN(point.x) && !isNaN(point.y));
  }

  _validateUnifiedCoordinates(points, datasetName) {
    if (points.length === 0) {
      // intentionally no-op beyond length check
    }
  }

  async _generateVertices(points, options) {
    if (!points || points.length === 0) {
      return [];
    }

    const curveType = options.curve || 'linear';

    switch (curveType) {
      case 'linear':
        return this._generateLinearVertices(points);
      case 'step':
        return this._generateStepVertices(points);
      case 'cardinal':
        return this._generateCardinalVertices(points);
      case 'monotone':
        return this._generateMonotoneVertices(points);
      default:
        return this._generateLinearVertices(points);
    }
  }

  _generateLinearVertices(points) {
    return points.map(point => ({ x: point.x, y: point.y }));
  }

  _generateStepVertices(points) {
    if (points.length < 2) return points;

    const vertices = [];

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      vertices.push({ x: current.x, y: current.y });
      vertices.push({ x: next.x, y: current.y });
    }

    vertices.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });

    return vertices;
  }

  _generateCardinalVertices(points) {
    if (points.length < 3) return this._generateLinearVertices(points);

    const vertices = [];
    const tension = 0.5;

    vertices.push({ x: points[0].x, y: points[0].y });

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const segments = 10;
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const x = this._cardinalSpline(p0.x, p1.x, p2.x, p3.x, t, tension);
        const y = this._cardinalSpline(p0.y, p1.y, p2.y, p3.y, t, tension);
        vertices.push({ x, y });
      }
    }

    return vertices;
  }

  _generateMonotoneVertices(points) {
    if (points.length < 3) return this._generateLinearVertices(points);

    const vertices = [];

    vertices.push({ x: points[0].x, y: points[0].y });

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const m0 = this._calculateMonotoneTangent(p0, p1, p2);
      const m1 = this._calculateMonotoneTangent(p1, p2, p3);

      const segments = 10;
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const x = this._cubicHermite(p1.x, p2.x, m0.x, m1.x, t);
        const y = this._cubicHermite(p1.y, p2.y, m0.y, m1.y, t);
        vertices.push({ x, y });
      }
    }

    return vertices;
  }

  _cardinalSpline(p0, p1, p2, p3, t, tension) {
    const t2 = t * t;
    const t3 = t2 * t;

    const c0 = -tension * t3 + 2 * tension * t2 - tension * t;
    const c1 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
    const c2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
    const c3 = tension * t3 - tension * t2;

    return c0 * p0 + c1 * p1 + c2 * p2 + c3 * p3;
  }

  _calculateMonotoneTangent(p0, p1, p2) {
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return { x: 0, y: 0 };

    const tangent = { x: dx / length, y: dy / length };

    const d1 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
    const d2 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const scale = Math.min(d1, d2) / 3;

    return {
      x: tangent.x * scale,
      y: tangent.y * scale
    };
  }

  _cubicHermite(p0, p1, m0, m1, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }

  _generateColors(vertices, dataset, options) {
    const baseColor = this._parseColor(dataset.color);
    return vertices.map(() => baseColor);
  }

  _parseColor(colorString) {
    if (typeof colorString !== 'string') {
      return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
    }

    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      let r, g, b;

      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
      }

      return { r: r / 255, g: g / 255, b: b / 255, a: 1.0 };
    }

    const rgbaMatch = colorString.match(/rgba?\(([^)]+)\)/);
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(',').map(s => s.trim());
      return {
        r: parseInt(parts[0]) / 255,
        g: parseInt(parts[1]) / 255,
        b: parseInt(parts[2]) / 255,
        a: parts[3] ? parseFloat(parts[3]) : 1.0
      };
    }

    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
  }

  _createEmptyPath(dataset) {
    return {
      id: dataset.id,
      name: dataset.name,
      color: dataset.color,
      fill: dataset.fill || false,
      fillOpacity: 0.3,
      vertices: [],
      colors: [],
      lineWidth: dataset.width || 2,
      curveType: 'linear',
      vertexCount: 0,
      coordinateSystem: 'unified',
      targetRenderer: this.config.targetRenderer,
      originalDataset: dataset,
      generatedAt: Date.now(),
      unifiedPointCount: 0
    };
  }

  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    if (validCurves.includes(curveType)) {
      this.config.curve = curveType;
    }
    return this;
  }

  setTargetRenderer(renderer) {
    const validRenderers = ['canvas', 'webgl', 'auto'];
    if (validRenderers.includes(renderer)) {
      this.config.targetRenderer = renderer;
    }
    return this;
  }
}

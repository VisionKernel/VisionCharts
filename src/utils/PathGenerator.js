/**
 * PathGenerator - SINGLE SOURCE for all path generation (Enhanced)
 * 
 * Now designed as a centralized service that can be shared across components
 * without duplication. Supports both static utility methods and instance-based usage.
 */

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
    
    console.log('PathGenerator created with unified coordinate system support');
  }

  // ===================================================================
  // STATIC METHODS - Primary interface for centralized path generation
  // ===================================================================

  /**
   * ✅ MAIN ENTRY POINT: Generate paths using shared static instance
   * This eliminates the need for multiple PathGenerator instances
   */
  static async generatePaths(datasets, options = {}) {
    const generator = PathGenerator.getSharedInstance(options);
    return await generator.generatePaths(datasets, options);
  }

  /**
   * ✅ MAIN ENTRY POINT: Generate single path using shared static instance
   */
  static async generatePath(dataset, options = {}) {
    const generator = PathGenerator.getSharedInstance(options);
    return await generator.generatePath(dataset, options);
  }

  /**
   * ✅ Get or create shared PathGenerator instance
   * This prevents creating multiple instances across components
   */
  static getSharedInstance(config = {}) {
    // Create a key based on critical config properties
    const configKey = `${config.curve || 'linear'}-${config.targetRenderer || 'auto'}`;
    
    if (!PathGenerator._sharedInstances) {
      PathGenerator._sharedInstances = new Map();
    }

    let instance = PathGenerator._sharedInstances.get(configKey);
    
    if (!instance) {
      instance = new PathGenerator(config);
      PathGenerator._sharedInstances.set(configKey, instance);
      console.log(`Created shared PathGenerator instance: ${configKey}`);
    }

    return instance;
  }

  /**
   * ✅ Update configuration for shared instance
   */
  static updateSharedConfig(configKey, newConfig) {
    if (!PathGenerator._sharedInstances) return false;
    
    const instance = PathGenerator._sharedInstances.get(configKey);
    if (instance) {
      Object.assign(instance.config, newConfig);
      console.log(`Updated shared PathGenerator config: ${configKey}`);
      return true;
    }
    return false;
  }

  /**
   * ✅ Clear shared instances (useful for testing or memory management)
   */
  static clearSharedInstances() {
    if (PathGenerator._sharedInstances) {
      PathGenerator._sharedInstances.clear();
      console.log('Cleared all shared PathGenerator instances');
    }
  }

  // ===================================================================
  // INSTANCE METHODS - Keep existing functionality for backwards compatibility
  // ===================================================================

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

      console.log(`PathGenerator: Generated ${generatedPaths.length} standardized paths`);
      return generatedPaths;

    } catch (error) {
      console.error('Error generating paths:', error);
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
      console.warn('No valid unified coordinates found in dataset');
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

  // ===================================================================
  // PRIVATE HELPER METHODS (existing functionality)
  // ===================================================================

  _extractUnifiedCoordinates(data) {
    return data.map(point => ({
      x: point.unifiedX || point.screenX || point.x,
      y: point.unifiedY || point.screenY || point.y
    })).filter(point => 
      point.x !== undefined && point.y !== undefined &&
      !isNaN(point.x) && !isNaN(point.y)
    );
  }

  _validateUnifiedCoordinates(points, datasetName) {
    // Add validation logic as needed
    if (points.length === 0) {
      console.warn(`No valid coordinates for dataset: ${datasetName}`);
    }
  }

  async _generateVertices(points, options) {
    // Implement curve generation based on options.curve
    // This is simplified - implement actual curve algorithms
    return points.map(point => ({ x: point.x, y: point.y }));
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

  // Keep existing setter methods for backwards compatibility
  setCurveType(curveType) {
    const validCurves = ['linear', 'step', 'cardinal', 'monotone'];
    if (validCurves.includes(curveType)) {
      this.config.curve = curveType;
      console.log(`PathGenerator curve type set to: ${curveType}`);
    }
    return this;
  }

  setTargetRenderer(renderer) {
    const validRenderers = ['canvas', 'webgl', 'auto'];
    if (validRenderers.includes(renderer)) {
      this.config.targetRenderer = renderer;
      console.log(`PathGenerator target renderer set to: ${renderer}`);
    }
    return this;
  }
}

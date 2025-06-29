/**
 * DataProcessor - Multi-Renderer Data Preparation Pipeline
 * 
 * Handles data normalization, validation, and transformation for optimal 
 * performance across SVG, Canvas, and WebGL rendering backends.
 * 
 * Key Features:
 * - Multi-format data ingestion and normalization
 * - Renderer-specific data optimization
 * - Performance-aware data structures
 * - Financial data type handling (OHLC, time series, etc.)
 * - Memory-efficient processing for large datasets
 * - Coordinate system normalization
 */
export default class DataProcessor {
  constructor(options = {}) {
    this.options = {
      // Performance thresholds
      canvasOptimizationThreshold: 10000,
      webglOptimizationThreshold: 100000,
      memoryOptimizationThreshold: 50000,
      
      // Data validation
      enableDataValidation: true,
      enableTypeCoercion: true,
      removeInvalidPoints: true,
      
      // Caching
      enableDataCaching: true,
      cacheSize: 100,
      cacheTTL: 300000, // 5 minutes
      
      // Financial data support
      supportOHLCData: true,
      supportTimeSeriesData: true,
      defaultTimeFormat: 'auto',
      
      // Memory management
      enableMemoryOptimization: true,
      batchProcessingSize: 5000,
      useTypedArrays: true,
      
      ...options
    };
    
    // Data processing state
    this.processingMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
      optimizationsApplied: 0
    };
    
    // Data cache for performance
    this.dataCache = new Map();
    this.cacheKeys = new Set();
    
    // Data type processors
    this.typeProcessors = new Map([
      ['financial', this._processFinancialData.bind(this)],
      ['timeseries', this._processTimeSeriesData.bind(this)],
      ['ohlc', this._processOHLCData.bind(this)],
      ['xy', this._processXYData.bind(this)],
      ['categorical', this._processCategoricalData.bind(this)],
      ['study', this._processStudyData.bind(this)]
    ]);
    
    // Renderer-specific optimizers
    this.rendererOptimizers = new Map([
      ['svg', this._optimizeForSVG.bind(this)],
      ['canvas', this._optimizeForCanvas.bind(this)],
      ['webgl', this._optimizeForWebGL.bind(this)]
    ]);
    
    // Data format detectors
    this.formatDetectors = [
      this._detectFinancialFormat.bind(this),
      this._detectTimeSeriesFormat.bind(this),
      this._detectOHLCFormat.bind(this),
      this._detectXYFormat.bind(this),
      this._detectCategoricalFormat.bind(this)
    ];
    
    console.log('DataProcessor initialized with multi-renderer pipeline');
  }

  // ===== MAIN PROCESSING METHODS =====

  /**
   * Process datasets for optimal rendering performance
   * @param {Array} datasets - Array of dataset objects
   * @param {Object} chartConfig - Chart configuration
   * @param {string} rendererType - Target renderer type
   * @param {Object} scales - Chart scales for coordinate transformation
   * @returns {Promise<Object>} Processed data structure
   */
  async processDatasets(datasets, chartConfig, rendererType, scales) {
    console.log(`DataProcessor.processDatasets called for ${rendererType} renderer`);
    
    const processingStartTime = performance.now();
    
    try {
      // Validate inputs
      this._validateInputs(datasets, chartConfig, rendererType, scales);
      
      // Generate cache key
      const cacheKey = this._generateCacheKey(datasets, chartConfig, rendererType, scales);
      
      // Check cache first
      if (this.options.enableDataCaching && this.dataCache.has(cacheKey)) {
        this.processingMetrics.cacheHits++;
        return this.dataCache.get(cacheKey);
      }
      
      this.processingMetrics.cacheMisses++;
      
      // Process datasets
      const processedResult = await this._processDatasetsPipeline(
        datasets, 
        chartConfig, 
        rendererType, 
        scales
      );
      
      // Cache result
      if (this.options.enableDataCaching) {
        this._cacheResult(cacheKey, processedResult);
      }
      
      // Update metrics
      const processingTime = performance.now() - processingStartTime;
      this._updateProcessingMetrics(processingTime);
      
      console.log(`DataProcessor: Processed ${datasets.length} datasets in ${processingTime.toFixed(2)}ms`);
      
      return processedResult;
      
    } catch (error) {
      console.error('DataProcessor: Processing failed:', error);
      throw new Error(`Data processing failed: ${error.message}`);
    }
  }

  /**
   * Process single dataset for specific use case
   * @param {Object} dataset - Dataset object
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed dataset
   */
  async processDataset(dataset, options = {}) {
    console.log(`DataProcessor.processDataset called for dataset: ${dataset.id}`);
    
    const processingOptions = {
      validateData: true,
      optimizeForRenderer: 'canvas',
      enableTypeCoercion: true,
      ...options
    };
    
    try {
      // Detect data format
      const dataFormat = this._detectDataFormat(dataset.data);
      console.log(`Detected data format: ${dataFormat} for dataset ${dataset.id}`);
      
      // Get appropriate processor
      const processor = this.typeProcessors.get(dataFormat) || this._processXYData.bind(this);
      
      // Process data
      const processedData = await processor(dataset, processingOptions);
      
      // Apply renderer-specific optimizations
      const optimizer = this.rendererOptimizers.get(processingOptions.optimizeForRenderer);
      if (optimizer) {
        return optimizer(processedData, processingOptions);
      }
      
      return processedData;
      
    } catch (error) {
      console.error(`DataProcessor: Failed to process dataset ${dataset.id}:`, error);
      throw error;
    }
  }

  // ===== DATA PROCESSING PIPELINE =====

  /**
   * Main data processing pipeline
   * @private
   */
  async _processDatasetsPipeline(datasets, chartConfig, rendererType, scales) {
    console.log('Running comprehensive data processing pipeline');
    
    // Phase 1: Data Validation and Cleanup
    const validatedDatasets = await this._validateAndCleanupDatasets(datasets, chartConfig);
    
    // Phase 2: Data Normalization
    const normalizedDatasets = await this._normalizeDatasets(validatedDatasets, chartConfig);
    
    // Phase 3: Coordinate Transformation
    const transformedDatasets = await this._transformCoordinates(normalizedDatasets, scales, chartConfig);
    
    // Phase 4: Renderer Optimization
    const optimizedDatasets = await this._optimizeForRenderer(transformedDatasets, rendererType, chartConfig);
    
    // Phase 5: Performance Analysis
    const performanceMetadata = this._analyzeDatasetPerformance(optimizedDatasets, rendererType);
    
    return {
      datasets: optimizedDatasets,
      metadata: {
        originalCount: datasets.length,
        processedCount: optimizedDatasets.length,
        rendererType,
        performance: performanceMetadata,
        processingTime: performance.now()
      }
    };
  }

  /**
   * Validate and cleanup datasets
   * @private
   */
  async _validateAndCleanupDatasets(datasets, chartConfig) {
    console.log('Phase 1: Validating and cleaning up datasets');
    
    const cleanedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        // Skip empty datasets
        if (!dataset.data || !dataset.data.length) {
          console.warn(`Dataset ${dataset.id} is empty, skipping`);
          continue;
        }
        
        // Validate data structure
        if (this.options.enableDataValidation) {
          this._validateDatasetStructure(dataset, chartConfig);
        }
        
        // Clean up data points
        const cleanedData = this._cleanupDataPoints(dataset.data, chartConfig);
        
        // Create cleaned dataset
        const cleanedDataset = {
          ...dataset,
          data: cleanedData,
          originalDataCount: dataset.data.length,
          cleanedDataCount: cleanedData.length
        };
        
        cleanedDatasets.push(cleanedDataset);
        
      } catch (error) {
        console.error(`Validation failed for dataset ${dataset.id}:`, error);
        
        if (this.options.removeInvalidPoints) {
          console.warn(`Skipping invalid dataset ${dataset.id}`);
          this.processingMetrics.validationErrors++;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Phase 1 complete: ${cleanedDatasets.length}/${datasets.length} datasets validated`);
    return cleanedDatasets;
  }

  /**
   * Normalize datasets to standard format
   * @private
   */
  async _normalizeDatasets(datasets, chartConfig) {
    console.log('Phase 2: Normalizing datasets to standard format');
    
    const { xField, yField, xType, yType } = chartConfig;
    const normalizedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        // Detect data format if not specified
        const dataFormat = dataset.type || this._detectDataFormat(dataset.data);
        
        // Get appropriate processor
        const processor = this.typeProcessors.get(dataFormat) || this._processXYData.bind(this);
        
        // Process dataset
        const processedDataset = await processor(dataset, {
          xField,
          yField,
          xType,
          yType,
          chartConfig
        });
        
        normalizedDatasets.push(processedDataset);
        
      } catch (error) {
        console.error(`Normalization failed for dataset ${dataset.id}:`, error);
        throw error;
      }
    }
    
    console.log(`Phase 2 complete: ${normalizedDatasets.length} datasets normalized`);
    return normalizedDatasets;
  }

  /**
   * Transform coordinates using chart scales
   * @private
   */
  async _transformCoordinates(datasets, scales, chartConfig) {
    console.log('Phase 3: Transforming coordinates using chart scales');
    
    if (!scales || !scales.x || !scales.y) {
      console.warn('No scales provided, skipping coordinate transformation');
      return datasets;
    }
    
    const { xField, yField } = chartConfig;
    const transformedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        // Transform data points to screen coordinates
        const transformedData = dataset.data.map(point => {
          const xValue = point[xField];
          const yValue = point[yField];
          
          // Calculate screen coordinates
          const screenX = scales.x.scale(xValue);
          const screenY = scales.y.scale(yValue);
          
          return {
            ...point,
            // Preserve original values
            [xField]: xValue,
            [yField]: yValue,
            // Add screen coordinates
            screenX,
            screenY,
            // Add normalized coordinates (0-1 range)
            normalizedX: (screenX - scales.x.range[0]) / (scales.x.range[1] - scales.x.range[0]),
            normalizedY: (screenY - scales.y.range[0]) / (scales.y.range[1] - scales.y.range[0])
          };
        });
        
        const transformedDataset = {
          ...dataset,
          data: transformedData,
          coordinatesTransformed: true,
          scaleInfo: {
            xDomain: scales.x.domain,
            yDomain: scales.y.domain,
            xRange: scales.x.range,
            yRange: scales.y.range
          }
        };
        
        transformedDatasets.push(transformedDataset);
        
      } catch (error) {
        console.error(`Coordinate transformation failed for dataset ${dataset.id}:`, error);
        throw error;
      }
    }
    
    console.log(`Phase 3 complete: ${transformedDatasets.length} datasets transformed`);
    return transformedDatasets;
  }

  /**
   * Optimize datasets for specific renderer
   * @private
   */
  async _optimizeForRenderer(datasets, rendererType, chartConfig) {
    console.log(`Phase 4: Optimizing datasets for ${rendererType} renderer`);
    
    const optimizer = this.rendererOptimizers.get(rendererType);
    if (!optimizer) {
      console.warn(`No optimizer found for renderer ${rendererType}`);
      return datasets;
    }
    
    const optimizedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        const optimizedDataset = await optimizer(dataset, {
          rendererType,
          chartConfig,
          dataSize: dataset.data.length
        });
        
        optimizedDatasets.push(optimizedDataset);
        this.processingMetrics.optimizationsApplied++;
        
      } catch (error) {
        console.error(`Renderer optimization failed for dataset ${dataset.id}:`, error);
        throw error;
      }
    }
    
    console.log(`Phase 4 complete: ${optimizedDatasets.length} datasets optimized for ${rendererType}`);
    return optimizedDatasets;
  }

  // ===== DATA TYPE PROCESSORS =====

  /**
   * Process financial data (price, volume, etc.)
   * @private
   */
  async _processFinancialData(dataset, options) {
    console.log(`Processing financial data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'price' } = options;
    
    // Financial data often needs special handling for dates and prices
    const processedData = dataset.data.map(point => {
      let processedPoint = { ...point };
      
      // Handle date field
      if (point[xField]) {
        const dateValue = point[xField];
        if (typeof dateValue === 'string') {
          processedPoint[xField] = new Date(dateValue);
        } else if (typeof dateValue === 'number') {
          processedPoint[xField] = new Date(dateValue);
        }
      }
      
      // Handle price field - ensure numeric
      if (point[yField] !== undefined) {
        const priceValue = point[yField];
        if (typeof priceValue === 'string') {
          processedPoint[yField] = parseFloat(priceValue);
        }
      }
      
      // Add financial metadata
      processedPoint._dataType = 'financial';
      
      return processedPoint;
    });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'financial'
    };
  }

  /**
   * Process time series data
   * @private
   */
  async _processTimeSeriesData(dataset, options) {
    console.log(`Processing time series data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'value' } = options;
    
    // Sort by time field to ensure proper ordering
    const sortedData = [...dataset.data].sort((a, b) => {
      const dateA = new Date(a[xField]);
      const dateB = new Date(b[xField]);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Process data points
    const processedData = sortedData.map((point, index) => {
      let processedPoint = { ...point };
      
      // Ensure date is properly formatted
      if (point[xField]) {
        processedPoint[xField] = new Date(point[xField]);
      }
      
      // Ensure value is numeric
      if (point[yField] !== undefined && typeof point[yField] === 'string') {
        processedPoint[yField] = parseFloat(point[yField]);
      }
      
      // Add time series metadata
      processedPoint._dataType = 'timeseries';
      processedPoint._index = index;
      
      return processedPoint;
    });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'timeseries',
      isSorted: true
    };
  }

  /**
   * Process OHLC (Open, High, Low, Close) data
   * @private
   */
  async _processOHLCData(dataset, options) {
    console.log(`Processing OHLC data for dataset ${dataset.id}`);
    
    const processedData = dataset.data.map(point => {
      let processedPoint = { ...point };
      
      // Ensure OHLC values are numeric
      ['open', 'high', 'low', 'close'].forEach(field => {
        if (point[field] !== undefined && typeof point[field] === 'string') {
          processedPoint[field] = parseFloat(point[field]);
        }
      });
      
      // Handle date
      if (point.date) {
        processedPoint.date = new Date(point.date);
      }
      
      // Add OHLC metadata
      processedPoint._dataType = 'ohlc';
      
      return processedPoint;
    });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'ohlc'
    };
  }

  /**
   * Process basic XY data
   * @private
   */
  async _processXYData(dataset, options) {
    console.log(`Processing XY data for dataset ${dataset.id}`);
    
    const { xField = 'x', yField = 'y' } = options;
    
    const processedData = dataset.data.map(point => {
      let processedPoint = { ...point };
      
      // Ensure numeric values
      if (point[xField] !== undefined && typeof point[xField] === 'string') {
        processedPoint[xField] = parseFloat(point[xField]);
      }
      
      if (point[yField] !== undefined && typeof point[yField] === 'string') {
        processedPoint[yField] = parseFloat(point[yField]);
      }
      
      // Add XY metadata
      processedPoint._dataType = 'xy';
      
      return processedPoint;
    });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'xy'
    };
  }

  /**
   * Process categorical data
   * @private
   */
  async _processCategoricalData(dataset, options) {
    console.log(`Processing categorical data for dataset ${dataset.id}`);
    
    const { xField = 'category', yField = 'value' } = options;
    
    const processedData = dataset.data.map(point => {
      let processedPoint = { ...point };
      
      // Ensure category is string
      if (point[xField] !== undefined && typeof point[xField] !== 'string') {
        processedPoint[xField] = String(point[xField]);
      }
      
      // Ensure value is numeric
      if (point[yField] !== undefined && typeof point[yField] === 'string') {
        processedPoint[yField] = parseFloat(point[yField]);
      }
      
      // Add categorical metadata
      processedPoint._dataType = 'categorical';
      
      return processedPoint;
    });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'categorical'
    };
  }

  /**
   * Process study/indicator data
   * @private
   */
  async _processStudyData(dataset, options) {
    console.log(`Processing study data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'value' } = options;
    
    // Studies often have null/undefined values that need handling
    const processedData = dataset.data
      .filter(point => point[yField] !== null && point[yField] !== undefined)
      .map(point => {
        let processedPoint = { ...point };
        
        // Handle date field
        if (point[xField]) {
          processedPoint[xField] = new Date(point[xField]);
        }
        
        // Ensure numeric value
        if (typeof point[yField] === 'string') {
          processedPoint[yField] = parseFloat(point[yField]);
        }
        
        // Add study metadata
        processedPoint._dataType = 'study';
        processedPoint._studyType = dataset.studyType || 'unknown';
        
        return processedPoint;
      });
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'study'
    };
  }

  // ===== RENDERER OPTIMIZERS =====

  /**
   * Optimize data for SVG renderer
   * @private
   */
  async _optimizeForSVG(dataset, options) {
    console.log(`Optimizing dataset ${dataset.id} for SVG renderer`);
    
    // SVG can handle moderate amounts of data well
    // Apply path simplification for very large datasets
    let optimizedData = dataset.data;
    
    if (dataset.data.length > 2000) {
      console.log(`Applying SVG optimization for ${dataset.data.length} points`);
      // Could apply Douglas-Peucker simplification here
      // For now, just thin the data
      optimizedData = this._thinDataPoints(dataset.data, 2000);
    }
    
    return {
      ...dataset,
      data: optimizedData,
      optimizedFor: 'svg',
      optimizationApplied: dataset.data.length !== optimizedData.length
    };
  }

  /**
   * Optimize data for Canvas renderer
   * @private
   */
  async _optimizeForCanvas(dataset, options) {
    console.log(`Optimizing dataset ${dataset.id} for Canvas renderer`);
    
    let optimizedData = dataset.data;
    
    // Canvas can handle larger datasets efficiently
    if (dataset.data.length > this.options.canvasOptimizationThreshold) {
      console.log(`Applying Canvas optimization for ${dataset.data.length} points`);
      
      // Pre-calculate coordinate arrays for faster rendering
      const coordinates = optimizedData.map(point => [point.screenX, point.screenY]);
      
      optimizedData = optimizedData.map((point, index) => ({
        ...point,
        _coordinates: coordinates[index],
        _optimizedForCanvas: true
      }));
    }
    
    return {
      ...dataset,
      data: optimizedData,
      optimizedFor: 'canvas',
      renderingHints: {
        useCoordinateArrays: dataset.data.length > 1000,
        enableBatching: dataset.data.length > 5000
      }
    };
  }

  /**
   * Optimize data for WebGL renderer
   * @private
   */
  async _optimizeForWebGL(dataset, options) {
    console.log(`Optimizing dataset ${dataset.id} for WebGL renderer`);
    
    // WebGL works best with typed arrays and pre-computed vertex data
    const dataLength = dataset.data.length;
    
    if (this.options.useTypedArrays && dataLength > 1000) {
      console.log(`Creating typed arrays for ${dataLength} points`);
      
      // Create vertex array for lines
      const vertices = new Float32Array(dataLength * 2);
      const colors = new Float32Array(dataLength * 4);
      
      dataset.data.forEach((point, index) => {
        const i = index * 2;
        const ci = index * 4;
        
        // Position
        vertices[i] = point.screenX || 0;
        vertices[i + 1] = point.screenY || 0;
        
        // Color (RGBA)
        const color = this._parseColor(dataset.color || '#1468a8');
        colors[ci] = color.r;
        colors[ci + 1] = color.g;
        colors[ci + 2] = color.b;
        colors[ci + 3] = color.a;
      });
      
      return {
        ...dataset,
        data: dataset.data,
        optimizedFor: 'webgl',
        webglBuffers: {
          vertices,
          colors,
          vertexCount: dataLength
        },
        renderingHints: {
          useVertexBuffers: true,
          enableInstancing: dataLength > 10000,
          useBatching: true
        }
      };
    }
    
    return {
      ...dataset,
      optimizedFor: 'webgl',
      renderingHints: {
        useVertexBuffers: false,
        enableInstancing: false,
        useBatching: dataLength > 1000
      }
    };
  }

  // ===== DATA FORMAT DETECTION =====

  /**
   * Detect data format automatically
   * @private
   */
  _detectDataFormat(data) {
    if (!data || !data.length) return 'xy';
    
    // Try each detector
    for (const detector of this.formatDetectors) {
      const result = detector(data);
      if (result) {
        console.log(`Detected data format: ${result}`);
        return result;
      }
    }
    
    // Default to XY format
    return 'xy';
  }

  /**
   * Detect financial data format
   * @private
   */
  _detectFinancialFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const financialFields = ['price', 'value', 'close', 'date', 'timestamp'];
    const hasFinancialFields = financialFields.some(field => sample.hasOwnProperty(field));
    
    return hasFinancialFields ? 'financial' : null;
  }

  /**
   * Detect time series format
   * @private
   */
  _detectTimeSeriesFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const hasDate = sample.hasOwnProperty('date') || sample.hasOwnProperty('timestamp');
    const hasValue = sample.hasOwnProperty('value') || sample.hasOwnProperty('y');
    
    return (hasDate && hasValue) ? 'timeseries' : null;
  }

  /**
   * Detect OHLC format
   * @private
   */
  _detectOHLCFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const ohlcFields = ['open', 'high', 'low', 'close'];
    const hasAllOHLC = ohlcFields.every(field => sample.hasOwnProperty(field));
    
    return hasAllOHLC ? 'ohlc' : null;
  }

  /**
   * Detect XY format
   * @private
   */
  _detectXYFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const hasX = sample.hasOwnProperty('x');
    const hasY = sample.hasOwnProperty('y');
    
    return (hasX && hasY) ? 'xy' : null;
  }

  /**
   * Detect categorical format
   * @private
   */
  _detectCategoricalFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const hasCategory = sample.hasOwnProperty('category') || sample.hasOwnProperty('name');
    const hasValue = sample.hasOwnProperty('value') || sample.hasOwnProperty('y');
    
    return (hasCategory && hasValue) ? 'categorical' : null;
  }

  // ===== UTILITY METHODS =====

  /**
   * Validate dataset structure
   * @private
   */
  _validateDatasetStructure(dataset, chartConfig) {
    if (!dataset.id) {
      throw new Error('Dataset must have an id');
    }
    
    if (!Array.isArray(dataset.data)) {
      throw new Error('Dataset data must be an array');
    }
    
    if (dataset.data.length === 0) {
      throw new Error('Dataset data cannot be empty');
    }
    
    // Validate data points have required fields
    const { xField, yField } = chartConfig;
    const sample = dataset.data[0];
    
    if (!sample.hasOwnProperty(xField)) {
      throw new Error(`Data points must have ${xField} field`);
    }
    
    if (!sample.hasOwnProperty(yField)) {
      throw new Error(`Data points must have ${yField} field`);
    }
  }

  /**
   * Clean up data points
   * @private
   */
  _cleanupDataPoints(data, chartConfig) {
    const { xField, yField } = chartConfig;
    
    return data.filter(point => {
      // Remove points with invalid coordinates
      const xValue = point[xField];
      const yValue = point[yField];
      
      return xValue !== null && 
             xValue !== undefined && 
             yValue !== null && 
             yValue !== undefined && 
             !isNaN(yValue);
    });
  }

  /**
   * Thin data points to target count
   * @private
   */
  _thinDataPoints(data, targetCount) {
    if (data.length <= targetCount) return data;
    
    const step = Math.floor(data.length / targetCount);
    const thinned = [];
    
    for (let i = 0; i < data.length; i += step) {
      thinned.push(data[i]);
    }
    
    // Always include the last point
    if (thinned[thinned.length - 1] !== data[data.length - 1]) {
      thinned.push(data[data.length - 1]);
    }
    
    return thinned;
  }

  /**
   * Parse color string to RGBA components
   * @private
   */
  _parseColor(colorString) {
    // Simple color parser - could be enhanced
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b, a: 1.0 };
    }
    
    // Default color
    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 }; // #1468a8
  }

  /**
   * Analyze dataset performance characteristics
   * @private
   */
  _analyzeDatasetPerformance(datasets, rendererType) {
    const totalPoints = datasets.reduce((sum, dataset) => sum + dataset.data.length, 0);
    
    return {
      totalDatasets: datasets.length,
      totalDataPoints: totalPoints,
      averageDatasetSize: Math.round(totalPoints / datasets.length),
      recommendedRenderer: this._getRecommendedRenderer(totalPoints),
      currentRenderer: rendererType,
      optimizationsApplied: this.processingMetrics.optimizationsApplied
    };
  }

  /**
   * Get recommended renderer based on data size
   * @private
   */
  _getRecommendedRenderer(totalPoints) {
    if (totalPoints >= this.options.webglOptimizationThreshold) {
      return 'webgl';
    } else if (totalPoints >= 1000) {
      return 'canvas';
    } else {
      return 'svg';
    }
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Generate cache key for processed data
   * @private
   */
  _generateCacheKey(datasets, chartConfig, rendererType, scales) {
    const dataHash = datasets.map(d => `${d.id}-${d.data.length}`).join(',');
    const configHash = JSON.stringify({
      xField: chartConfig.xField,
      yField: chartConfig.yField,
      xType: chartConfig.xType,
      yType: chartConfig.yType
    });
    const scaleHash = scales ? `${scales.x.domain}-${scales.y.domain}` : 'no-scales';
    
    return `${dataHash}-${configHash}-${rendererType}-${scaleHash}`;
  }

  /**
   * Cache processing result
   * @private
   */
  _cacheResult(cacheKey, result) {
    // Implement LRU cache
    if (this.dataCache.size >= this.options.cacheSize) {
      const firstKey = this.cacheKeys.values().next().value;
      this.dataCache.delete(firstKey);
      this.cacheKeys.delete(firstKey);
    }
    
    this.dataCache.set(cacheKey, result);
    this.cacheKeys.add(cacheKey);
  }

  /**
   * Validate processing inputs
   * @private
   */
  _validateInputs(datasets, chartConfig, rendererType, scales) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }
    
    if (!chartConfig) {
      throw new Error('Chart configuration is required');
    }
    
    if (!rendererType) {
      throw new Error('Renderer type is required');
    }
    
    if (!['svg', 'canvas', 'webgl'].includes(rendererType)) {
      throw new Error(`Unsupported renderer type: ${rendererType}`);
    }
  }

  /**
   * Update processing metrics
   * @private
   */
  _updateProcessingMetrics(processingTime) {
    this.processingMetrics.totalProcessed++;
    
    // Calculate rolling average
    const count = this.processingMetrics.totalProcessed;
    const currentAvg = this.processingMetrics.averageProcessingTime;
    this.processingMetrics.averageProcessingTime = 
      (currentAvg * (count - 1) + processingTime) / count;
  }

  /**
   * Get processing metrics
   * @returns {Object} Current processing metrics
   */
  getMetrics() {
    return { ...this.processingMetrics };
  }

  /**
   * Clear data cache
   */
  clearCache() {
    this.dataCache.clear();
    this.cacheKeys.clear();
    console.log('DataProcessor cache cleared');
  }

  /**
   * Cleanup and destroy processor
   */
  destroy() {
    this.clearCache();
    this.typeProcessors.clear();
    this.rendererOptimizers.clear();
    console.log('DataProcessor destroyed');
  }
}
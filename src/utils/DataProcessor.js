/**
 * DataProcessor - Time Series Focused Data Preparation Pipeline
 * 
 * Specialized for financial and economic time series data processing
 * with enhanced time-based features and multi-renderer optimization.
 * 
 * Key Features:
 * - Time series data validation and normalization
 * - Financial data type handling (OHLC, price series, etc.)
 * - Advanced time parsing and frequency detection
 * - Gap detection and interpolation
 * - Time zone support and conversion
 * - Missing data handling
 * - Performance optimization for large time series
 * - Multi-renderer coordinate transformation
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
      
      // Time series specific options
      enableTimeValidation: true,
      enableGapDetection: true,
      enableFrequencyDetection: true,
      enableInterpolation: true,
      maxGapSize: 5, // Maximum gaps to interpolate
      defaultTimeZone: 'UTC',
      
      // Caching
      enableDataCaching: true,
      cacheSize: 100,
      cacheTTL: 300000, // 5 minutes
      
      // Financial data support
      supportOHLCData: true,
      supportMultipleTimeFormats: true,
      enablePriceValidation: true,
      
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
      optimizationsApplied: 0,
      timeParsingErrors: 0,
      gapsDetected: 0,
      pointsInterpolated: 0
    };
    
    // Data cache for performance
    this.dataCache = new Map();
    this.cacheKeys = new Set();
    
    // Time series data type processors
    this.typeProcessors = new Map([
      ['timeseries', this._processTimeSeriesData.bind(this)],
      ['financial', this._processFinancialData.bind(this)],
      ['ohlc', this._processOHLCData.bind(this)],
      ['study', this._processStudyData.bind(this)]
    ]);
    
    // Renderer-specific optimizers
    this.rendererOptimizers = new Map([
      ['svg', this._optimizeForSVG.bind(this)],
      ['canvas', this._optimizeForCanvas.bind(this)],
      ['webgl', this._optimizeForWebGL.bind(this)]
    ]);
    
    // Time series format detectors
    this.formatDetectors = [
      this._detectFinancialFormat.bind(this),
      this._detectOHLCFormat.bind(this),
      this._detectTimeSeriesFormat.bind(this),
      this._detectStudyFormat.bind(this)
    ];
    
    // Time format patterns
    this.timeFormats = [
      // ISO formats
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2})?$/,
      
      // Date formats
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/,
      
      // Timestamp formats
      /^\d{10}$/, // Unix timestamp (seconds)
      /^\d{13}$/, // Unix timestamp (milliseconds)
      
      // Financial date formats
      /^\d{4}\d{2}\d{2}$/, // YYYYMMDD
      /^[A-Za-z]{3}\s\d{1,2},?\s\d{4}$/ // Mon DD, YYYY
    ];
    
    // Common time frequencies (in milliseconds)
    this.timeFrequencies = {
      minute: 60 * 1000,
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000, // Approximate
      quarterly: 90 * 24 * 60 * 60 * 1000, // Approximate
      yearly: 365 * 24 * 60 * 60 * 1000 // Approximate
    };
    
    console.log('DataProcessor initialized for time series data processing');
  }

  // ===== MAIN PROCESSING METHODS =====

  /**
   * Process time series datasets for optimal rendering performance
   * @param {Array} datasets - Array of time series dataset objects
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
      
      console.log(`DataProcessor: Processed ${datasets.length} time series datasets in ${processingTime.toFixed(2)}ms`);
      
      return processedResult;
      
    } catch (error) {
      console.error('DataProcessor: Time series processing failed:', error);
      throw new Error(`Time series data processing failed: ${error.message}`);
    }
  }

  /**
   * Process single time series dataset
   * @param {Object} dataset - Time series dataset object
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed dataset
   */
  async processDataset(dataset, options = {}) {
    console.log(`DataProcessor.processDataset called for time series dataset: ${dataset.id}`);
    
    const processingOptions = {
      validateData: true,
      optimizeForRenderer: 'canvas',
      enableTypeCoercion: true,
      detectFrequency: true,
      handleMissingData: true,
      ...options
    };
    
    try {
      // Detect time series data format
      const dataFormat = this._detectTimeSeriesDataFormat(dataset.data);
      console.log(`Detected time series format: ${dataFormat} for dataset ${dataset.id}`);
      
      // Get appropriate processor
      const processor = this.typeProcessors.get(dataFormat) || this._processTimeSeriesData.bind(this);
      
      // Process data with time series enhancements
      const processedData = await processor(dataset, processingOptions);
      
      // Apply renderer-specific optimizations
      const optimizer = this.rendererOptimizers.get(processingOptions.optimizeForRenderer);
      if (optimizer) {
        return optimizer(processedData, processingOptions);
      }
      
      return processedData;
      
    } catch (error) {
      console.error(`DataProcessor: Failed to process time series dataset ${dataset.id}:`, error);
      throw error;
    }
  }

  // ===== ENHANCED TIME SERIES PROCESSORS =====

  /**
   * Process time series data with advanced time handling
   * @private
   */
  async _processTimeSeriesData(dataset, options) {
    console.log(`Processing time series data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'value' } = options;
    
    // Step 1: Parse and validate time values
    const parsedData = this._parseTimeValues(dataset.data, xField, yField);
    
    // Step 2: Sort by time field to ensure proper ordering
    const sortedData = this._sortByTime(parsedData, xField);
    
    // Step 3: Detect time frequency if enabled
    let frequency = null;
    if (options.detectFrequency) {
      frequency = this._detectTimeFrequency(sortedData, xField);
      console.log(`Detected time frequency: ${frequency} for dataset ${dataset.id}`);
    }
    
    // Step 4: Detect and handle gaps if enabled
    let gapInfo = null;
    if (this.options.enableGapDetection) {
      gapInfo = this._detectTimeGaps(sortedData, xField, frequency);
      if (gapInfo.gaps.length > 0) {
        console.log(`Detected ${gapInfo.gaps.length} time gaps in dataset ${dataset.id}`);
        this.processingMetrics.gapsDetected += gapInfo.gaps.length;
      }
    }
    
    // Step 5: Handle missing data if enabled
    let processedData = sortedData;
    if (options.handleMissingData && gapInfo && gapInfo.gaps.length > 0) {
      processedData = this._handleMissingTimeData(sortedData, gapInfo, xField, yField);
    }
    
    // Step 6: Add metadata to each point
    processedData = processedData.map((point, index) => ({
      ...point,
      _dataType: 'timeseries',
      _index: index,
      _frequency: frequency,
      _hasGaps: gapInfo ? gapInfo.gaps.length > 0 : false
    }));
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'timeseries',
      isSorted: true,
      timeMetadata: {
        frequency,
        gapInfo,
        timeRange: {
          start: processedData[0][xField],
          end: processedData[processedData.length - 1][xField]
        },
        totalPoints: processedData.length
      }
    };
  }

  /**
   * Process financial data with enhanced price validation
   * @private
   */
  async _processFinancialData(dataset, options) {
    console.log(`Processing financial data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'price' } = options;
    
    // Parse time values first
    const parsedData = this._parseTimeValues(dataset.data, xField, yField);
    
    // Sort by time
    const sortedData = this._sortByTime(parsedData, xField);
    
    // Validate price data
    const validatedData = this._validateFinancialPrices(sortedData, yField);
    
    // Add financial metadata
    const processedData = validatedData.map((point, index) => ({
      ...point,
      _dataType: 'financial',
      _index: index,
      _priceValidated: true
    }));
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'financial',
      isSorted: true,
      financialMetadata: {
        priceField: yField,
        priceRange: {
          min: Math.min(...processedData.map(p => p[yField])),
          max: Math.max(...processedData.map(p => p[yField]))
        }
      }
    };
  }

  /**
   * Process OHLC data with financial validation
   * @private
   */
  async _processOHLCData(dataset, options) {
    console.log(`Processing OHLC data for dataset ${dataset.id}`);
    
    const parsedData = dataset.data.map(point => {
      let processedPoint = { ...point };
      
      // Parse date
      if (point.date) {
        processedPoint.date = this._parseTimeValue(point.date);
      }
      
      // Validate OHLC values
      ['open', 'high', 'low', 'close'].forEach(field => {
        if (point[field] !== undefined) {
          const value = typeof point[field] === 'string' ? parseFloat(point[field]) : point[field];
          if (isNaN(value)) {
            console.warn(`Invalid ${field} value in OHLC data:`, point[field]);
            this.processingMetrics.validationErrors++;
          } else {
            processedPoint[field] = value;
          }
        }
      });
      
      // Validate OHLC relationships
      if (processedPoint.high < processedPoint.low) {
        console.warn('OHLC validation failed: High < Low', processedPoint);
        this.processingMetrics.validationErrors++;
      }
      
      if (processedPoint.open > processedPoint.high || processedPoint.open < processedPoint.low) {
        console.warn('OHLC validation failed: Open outside High-Low range', processedPoint);
        this.processingMetrics.validationErrors++;
      }
      
      if (processedPoint.close > processedPoint.high || processedPoint.close < processedPoint.low) {
        console.warn('OHLC validation failed: Close outside High-Low range', processedPoint);
        this.processingMetrics.validationErrors++;
      }
      
      // Add OHLC metadata
      processedPoint._dataType = 'ohlc';
      
      return processedPoint;
    });
    
    // Sort by date
    const sortedData = this._sortByTime(parsedData, 'date');
    
    return {
      ...dataset,
      data: sortedData,
      processedType: 'ohlc',
      isSorted: true
    };
  }

  /**
   * Process study/indicator data with time alignment
   * @private
   */
  async _processStudyData(dataset, options) {
    console.log(`Processing study data for dataset ${dataset.id}`);
    
    const { xField = 'date', yField = 'value' } = options;
    
    // Parse time values
    const parsedData = this._parseTimeValues(dataset.data, xField, yField);
    
    // Sort by time
    const sortedData = this._sortByTime(parsedData, xField);
    
    // Studies often have null/undefined values that need handling
    const processedData = sortedData
      .filter(point => point[yField] !== null && point[yField] !== undefined && !isNaN(point[yField]))
      .map((point, index) => ({
        ...point,
        _dataType: 'study',
        _studyType: dataset.studyType || 'unknown',
        _index: index
      }));
    
    return {
      ...dataset,
      data: processedData,
      processedType: 'study',
      isSorted: true,
      studyMetadata: {
        studyType: dataset.studyType,
        originalLength: sortedData.length,
        validPoints: processedData.length,
        nullPoints: sortedData.length - processedData.length
      }
    };
  }

  // ===== ENHANCED TIME PROCESSING UTILITIES =====

  /**
   * Parse time values with multiple format support
   * @private
   */
  _parseTimeValues(data, xField, yField) {
    return data.map(point => {
      let processedPoint = { ...point };
      
      // Parse time field
      if (point[xField] !== undefined) {
        processedPoint[xField] = this._parseTimeValue(point[xField]);
      }
      
      // Parse value field
      if (point[yField] !== undefined && typeof point[yField] === 'string') {
        const numValue = parseFloat(point[yField]);
        if (isNaN(numValue)) {
          console.warn(`Invalid numeric value: ${point[yField]}`);
          this.processingMetrics.validationErrors++;
        } else {
          processedPoint[yField] = numValue;
        }
      }
      
      return processedPoint;
    });
  }

  /**
   * Parse individual time value with format detection
   * @private
   */
  _parseTimeValue(timeValue) {
    if (timeValue instanceof Date) {
      return timeValue;
    }
    
    if (typeof timeValue === 'number') {
      // Handle Unix timestamps
      if (timeValue > 1000000000 && timeValue < 10000000000) {
        // Unix timestamp in seconds
        return new Date(timeValue * 1000);
      } else if (timeValue > 1000000000000) {
        // Unix timestamp in milliseconds
        return new Date(timeValue);
      }
    }
    
    if (typeof timeValue === 'string') {
      // Try parsing as ISO date
      const isoDate = new Date(timeValue);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
      
      // Try parsing with specific formats
      for (const format of this.timeFormats) {
        if (format.test(timeValue)) {
          const parsedDate = new Date(timeValue);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      }
    }
    
    console.warn(`Unable to parse time value: ${timeValue}`);
    this.processingMetrics.timeParsingErrors++;
    return new Date(timeValue); // Fallback - may result in Invalid Date
  }

  /**
   * Sort data by time field
   * @private
   */
  _sortByTime(data, timeField) {
    return [...data].sort((a, b) => {
      const timeA = a[timeField];
      const timeB = b[timeField];
      
      if (timeA instanceof Date && timeB instanceof Date) {
        return timeA.getTime() - timeB.getTime();
      }
      
      return 0; // Keep original order if comparison fails
    });
  }

  /**
   * Detect time frequency in the data
   * @private
   */
  _detectTimeFrequency(data, timeField) {
    if (data.length < 3) return null;
    
    // Calculate intervals between consecutive points
    const intervals = [];
    for (let i = 1; i < Math.min(data.length, 20); i++) {
      const current = data[i][timeField];
      const previous = data[i - 1][timeField];
      
      if (current instanceof Date && previous instanceof Date) {
        intervals.push(current.getTime() - previous.getTime());
      }
    }
    
    if (intervals.length === 0) return null;
    
    // Find the most common interval
    const intervalCounts = {};
    intervals.forEach(interval => {
      // Round to nearest common frequency
      const rounded = this._roundToNearestFrequency(interval);
      intervalCounts[rounded] = (intervalCounts[rounded] || 0) + 1;
    });
    
    // Return the most common frequency
    const mostCommon = Object.keys(intervalCounts).reduce((a, b) => 
      intervalCounts[a] > intervalCounts[b] ? a : b
    );
    
    return this._getFrequencyName(parseInt(mostCommon));
  }

  /**
   * Round interval to nearest known frequency
   * @private
   */
  _roundToNearestFrequency(interval) {
    const frequencies = Object.values(this.timeFrequencies);
    
    let closestFreq = frequencies[0];
    let minDiff = Math.abs(interval - closestFreq);
    
    frequencies.forEach(freq => {
      const diff = Math.abs(interval - freq);
      if (diff < minDiff) {
        minDiff = diff;
        closestFreq = freq;
      }
    });
    
    return closestFreq;
  }

  /**
   * Get frequency name from millisecond value
   * @private
   */
  _getFrequencyName(milliseconds) {
    for (const [name, value] of Object.entries(this.timeFrequencies)) {
      if (Math.abs(milliseconds - value) < value * 0.1) { // 10% tolerance
        return name;
      }
    }
    return 'custom';
  }

  /**
   * Detect gaps in time series data
   * @private
   */
  _detectTimeGaps(data, timeField, expectedFrequency) {
    const gaps = [];
    
    if (!expectedFrequency || data.length < 2) {
      return { gaps, expectedFrequency };
    }
    
    const expectedInterval = this.timeFrequencies[expectedFrequency];
    if (!expectedInterval) return { gaps, expectedFrequency };
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i][timeField];
      const previous = data[i - 1][timeField];
      
      if (current instanceof Date && previous instanceof Date) {
        const actualInterval = current.getTime() - previous.getTime();
        const expectedGapSize = Math.round(actualInterval / expectedInterval);
        
        if (expectedGapSize > 1) {
          gaps.push({
            startIndex: i - 1,
            endIndex: i,
            startTime: previous,
            endTime: current,
            expectedPoints: expectedGapSize - 1,
            actualInterval,
            expectedInterval
          });
        }
      }
    }
    
    return { gaps, expectedFrequency };
  }

  /**
   * Handle missing data through interpolation or other methods
   * @private
   */
  _handleMissingTimeData(data, gapInfo, timeField, valueField) {
    if (!this.options.enableInterpolation) {
      return data;
    }
    
    let processedData = [...data];
    
    // Process gaps in reverse order to maintain indices
    for (let i = gapInfo.gaps.length - 1; i >= 0; i--) {
      const gap = gapInfo.gaps[i];
      
      // Only interpolate small gaps
      if (gap.expectedPoints <= this.options.maxGapSize) {
        const interpolatedPoints = this._interpolateTimeSeriesGap(
          data[gap.startIndex],
          data[gap.endIndex],
          gap.expectedPoints,
          timeField,
          valueField
        );
        
        // Insert interpolated points
        processedData.splice(gap.endIndex, 0, ...interpolatedPoints);
        this.processingMetrics.pointsInterpolated += interpolatedPoints.length;
      }
    }
    
    return processedData;
  }

  /**
   * Interpolate values for a time series gap
   * @private
   */
  _interpolateTimeSeriesGap(startPoint, endPoint, expectedPoints, timeField, valueField) {
    const interpolatedPoints = [];
    
    const startTime = startPoint[timeField].getTime();
    const endTime = endPoint[timeField].getTime();
    const startValue = startPoint[valueField];
    const endValue = endPoint[valueField];
    
    const timeStep = (endTime - startTime) / (expectedPoints + 1);
    const valueStep = (endValue - startValue) / (expectedPoints + 1);
    
    for (let i = 1; i <= expectedPoints; i++) {
      const interpolatedPoint = {
        [timeField]: new Date(startTime + timeStep * i),
        [valueField]: startValue + valueStep * i,
        _interpolated: true,
        _dataType: 'timeseries'
      };
      
      interpolatedPoints.push(interpolatedPoint);
    }
    
    return interpolatedPoints;
  }

  /**
   * Validate financial price data
   * @private
   */
  _validateFinancialPrices(data, priceField) {
    return data.filter(point => {
      const price = point[priceField];
      
      if (typeof price !== 'number' || isNaN(price)) {
        console.warn(`Invalid price value: ${price}`);
        this.processingMetrics.validationErrors++;
        return false;
      }
      
      if (price < 0) {
        console.warn(`Negative price value: ${price}`);
        this.processingMetrics.validationErrors++;
        return false;
      }
      
      return true;
    });
  }

  // ===== DATA FORMAT DETECTION (TIME SERIES ONLY) =====

  /**
   * Detect time series data format automatically
   * @private
   */
  _detectTimeSeriesDataFormat(data) {
    if (!data || !data.length) return 'timeseries';
    
    // Try each time series detector
    for (const detector of this.formatDetectors) {
      const result = detector(data);
      if (result) {
        console.log(`Detected time series format: ${result}`);
        return result;
      }
    }
    
    // Default to time series format
    return 'timeseries';
  }

  /**
   * Detect financial data format
   * @private
   */
  _detectFinancialFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const financialFields = ['price', 'value', 'close'];
    const timeFields = ['date', 'timestamp', 'time'];
    
    const hasFinancialField = financialFields.some(field => sample.hasOwnProperty(field));
    const hasTimeField = timeFields.some(field => sample.hasOwnProperty(field));
    
    return (hasFinancialField && hasTimeField) ? 'financial' : null;
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
    const hasDate = sample.hasOwnProperty('date') || sample.hasOwnProperty('timestamp');
    
    return (hasAllOHLC && hasDate) ? 'ohlc' : null;
  }

  /**
   * Detect time series format
   * @private
   */
  _detectTimeSeriesFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    const timeFields = ['date', 'timestamp', 'time'];
    const valueFields = ['value', 'y', 'price'];
    
    const hasTimeField = timeFields.some(field => sample.hasOwnProperty(field));
    const hasValueField = valueFields.some(field => sample.hasOwnProperty(field));
    
    return (hasTimeField && hasValueField) ? 'timeseries' : null;
  }

  /**
   * Detect study/indicator format
   * @private
   */
  _detectStudyFormat(data) {
    const sample = data[0];
    if (!sample) return null;
    
    // Check for study metadata or specific study fields
    if (sample._studyType || sample.studyType) {
      return 'study';
    }
    
    // Check for common study field patterns
    const studyFields = ['sma', 'ema', 'rsi', 'macd', 'bollinger'];
    const hasStudyField = studyFields.some(field => 
      Object.keys(sample).some(key => key.toLowerCase().includes(field))
    );
    
    return hasStudyField ? 'study' : null;
  }

  // ===== RENDERER OPTIMIZERS (INHERITED FROM ORIGINAL) =====

  /**
   * Optimize data for SVG renderer
   * @private
   */
  async _optimizeForSVG(dataset, options) {
    const dataLength = dataset.data.length;
    
    // SVG handles moderate datasets well
    if (dataLength > this.options.canvasOptimizationThreshold) {
      console.log(`Dataset has ${dataLength} points, suggesting Canvas renderer instead of SVG`);
    }
    
    return {
      ...dataset,
      optimizedFor: 'svg',
      renderingHints: {
        usePaths: true,
        enableAnimations: dataLength < 1000,
        enableInteractivity: true
      }
    };
  }

  /**
   * Optimize data for Canvas renderer
   * @private
   */
  async _optimizeForCanvas(dataset, options) {
    const dataLength = dataset.data.length;
    
    return {
      ...dataset,
      optimizedFor: 'canvas',
      renderingHints: {
        useBatching: dataLength > 1000,
        enableOffscreenCanvas: dataLength > 5000,
        useLinePath: true,
        antialiasing: dataLength < 10000
      }
    };
  }

  /**
   * Optimize data for WebGL renderer
   * @private
   */
  async _optimizeForWebGL(dataset, options) {
    const dataLength = dataset.data.length;
    
    // Create typed arrays for large datasets
    if (this.options.useTypedArrays && dataLength > 1000) {
      console.log(`Creating typed arrays for ${dataLength} time series points`);
      
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

  // ===== PIPELINE PROCESSING METHODS (INHERITED AND ADAPTED) =====

  /**
   * Main data processing pipeline for time series
   * @private
   */
  async _processDatasetsPipeline(datasets, chartConfig, rendererType, scales) {
    console.log('Running time series data processing pipeline');
    
    // Phase 1: Data Validation and Cleanup
    const validatedDatasets = await this._validateAndCleanupDatasets(datasets, chartConfig);
    
    // Phase 2: Time Series Normalization
    const normalizedDatasets = await this._normalizeTimeSeriesDatasets(validatedDatasets, chartConfig);
    
    // Phase 3: Coordinate Transformation
    const transformedDatasets = await this._transformCoordinates(normalizedDatasets, scales, chartConfig);
    
    // Phase 4: Renderer Optimization
    const optimizedDatasets = await this._optimizeForRenderer(transformedDatasets, rendererType, chartConfig);
    
    return {
      datasets: optimizedDatasets,
      processingMetadata: {
        totalDatasets: datasets.length,
        totalDataPoints: optimizedDatasets.reduce((sum, ds) => sum + ds.data.length, 0),
        rendererType,
        processingTime: performance.now(),
        optimizationsApplied: this.processingMetrics.optimizationsApplied
      }
    };
  }

  /**
   * Validate and cleanup time series datasets
   * @private
   */
  async _validateAndCleanupDatasets(datasets, chartConfig) {
    console.log('Phase 1: Validating and cleaning time series datasets');
    
    const validatedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        // Validate dataset structure for time series
        this._validateTimeSeriesDatasetStructure(dataset, chartConfig);
        
        // Clean up data points
        const cleanedData = this._cleanupTimeSeriesDataPoints(dataset.data, chartConfig);
        
        const validatedDataset = {
          ...dataset,
          data: cleanedData
        };
        
        validatedDatasets.push(validatedDataset);
        
      } catch (error) {
        console.error(`Validation failed for dataset ${dataset.id}:`, error);
        this.processingMetrics.validationErrors++;
        
        if (!this.options.removeInvalidDatasets) {
          throw error;
        }
      }
    }
    
    console.log(`Phase 1 complete: ${validatedDatasets.length} time series datasets validated`);
    return validatedDatasets;
  }

  /**
   * Normalize time series datasets
   * @private
   */
  async _normalizeTimeSeriesDatasets(datasets, chartConfig) {
    console.log('Phase 2: Normalizing time series datasets');
    
    const normalizedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        // Detect format and process accordingly
        const dataFormat = this._detectTimeSeriesDataFormat(dataset.data);
        const processor = this.typeProcessors.get(dataFormat) || this._processTimeSeriesData.bind(this);
        
        const normalizedDataset = await processor(dataset, {
          xField: chartConfig.xField || 'date',
          yField: chartConfig.yField || 'value',
          detectFrequency: true,
          handleMissingData: true
        });
        
        normalizedDatasets.push(normalizedDataset);
        
      } catch (error) {
        console.error(`Normalization failed for dataset ${dataset.id}:`, error);
        throw error;
      }
    }
    
    console.log(`Phase 2 complete: ${normalizedDatasets.length} time series datasets normalized`);
    return normalizedDatasets;
  }

  // ===== UTILITY METHODS =====

  /**
   * Validate time series dataset structure
   * @private
   */
  _validateTimeSeriesDatasetStructure(dataset, chartConfig) {
    if (!dataset.id) {
      throw new Error('Time series dataset must have an id');
    }
    
    if (!Array.isArray(dataset.data)) {
      throw new Error('Time series dataset data must be an array');
    }
    
    if (dataset.data.length === 0) {
      throw new Error('Time series dataset data cannot be empty');
    }
    
    // Validate that data points have time fields
    const { xField = 'date', yField = 'value' } = chartConfig;
    const sample = dataset.data[0];
    
    if (!sample.hasOwnProperty(xField)) {
      throw new Error(`Time series data points must have time field: ${xField}`);
    }
    
    if (!sample.hasOwnProperty(yField)) {
      throw new Error(`Time series data points must have value field: ${yField}`);
    }
  }

  /**
   * Clean up time series data points
   * @private
   */
  _cleanupTimeSeriesDataPoints(data, chartConfig) {
    const { xField = 'date', yField = 'value' } = chartConfig;
    
    return data.filter(point => {
      // Remove points with invalid time values
      const timeValue = point[xField];
      const numValue = point[yField];
      
      if (timeValue === null || timeValue === undefined) {
        return false;
      }
      
      if (numValue === null || numValue === undefined || 
          (typeof numValue === 'number' && isNaN(numValue))) {
        return false;
      }
      
      return true;
    });
  }

  // ===== COORDINATE TRANSFORMATION (INHERITED) =====

  /**
   * Transform coordinates for rendering
   * @private
   */
  async _transformCoordinates(datasets, scales, chartConfig) {
    console.log('Phase 3: Transforming coordinates for time series data');
    
    const transformedDatasets = [];
    
    for (const dataset of datasets) {
      try {
        const { xField = 'date', yField = 'value' } = chartConfig;
        
        const transformedData = dataset.data.map(point => {
          const xValue = point[xField];
          const yValue = point[yField];
          
          // Scale coordinates
          const screenX = scales.x.scale(xValue);
          const screenY = scales.y.scale(yValue);
          
          return {
            ...point,
            screenX,
            screenY,
            // Normalized coordinates (0-1 range)
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
    
    console.log(`Phase 3 complete: ${transformedDatasets.length} time series datasets transformed`);
    return transformedDatasets;
  }

  // ===== UTILITY METHODS (INHERITED AND ENHANCED) =====

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
    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
  }

  /**
   * Generate cache key for processed data
   * @private
   */
  _generateCacheKey(datasets, chartConfig, rendererType, scales) {
    const dataHash = datasets.map(ds => `${ds.id}-${ds.data.length}`).join('|');
    const configHash = JSON.stringify({
      xField: chartConfig.xField,
      yField: chartConfig.yField,
      rendererType
    });
    const scaleHash = JSON.stringify({
      xDomain: scales.x.domain,
      yDomain: scales.y.domain
    });
    
    return `${dataHash}-${configHash}-${scaleHash}`.slice(0, 64);
  }

  /**
   * Cache processing result
   * @private
   */
  _cacheResult(cacheKey, result) {
    // Implement simple LRU cache
    if (this.dataCache.size >= this.options.cacheSize) {
      const firstKey = this.cacheKeys.values().next().value;
      this.dataCache.delete(firstKey);
      this.cacheKeys.delete(firstKey);
    }
    
    this.dataCache.set(cacheKey, result);
    this.cacheKeys.add(cacheKey);
  }

  /**
   * Update processing metrics
   * @private
   */
  _updateProcessingMetrics(processingTime) {
    this.processingMetrics.totalProcessed++;
    this.processingMetrics.averageProcessingTime = 
      (this.processingMetrics.averageProcessingTime * (this.processingMetrics.totalProcessed - 1) + processingTime) /
      this.processingMetrics.totalProcessed;
  }

  /**
   * Validate inputs
   * @private
   */
  _validateInputs(datasets, chartConfig, rendererType, scales) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }
    
    if (!chartConfig || typeof chartConfig !== 'object') {
      throw new Error('Chart configuration is required');
    }
    
    if (!rendererType || typeof rendererType !== 'string') {
      throw new Error('Renderer type is required');
    }
    
    if (!scales || !scales.x || !scales.y) {
      throw new Error('Scales configuration is required');
    }
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get processing metrics
   * @returns {Object} Processing metrics
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
   * Destroy the processor and clean up resources
   */
  destroy() {
    this.clearCache();
    this.typeProcessors.clear();
    this.rendererOptimizers.clear();
    this.formatDetectors.length = 0;
    
    console.log('DataProcessor destroyed');
  }
}
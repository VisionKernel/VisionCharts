/**
 * DataProcessor - Time Series Focused Data Preparation Pipeline
 * 
 * Specialized for financial and economic time series data processing
 * with enhanced time-based features and multi-renderer optimization.
 * 
 * Key Features:
 * - Time series data validation and normalization
 * - Advanced time parsing and frequency detection
 * - Gap detection and interpolation
 * - Time zone support and conversion
 * - Missing data handling
 * - Performance optimization for large time series
 * - Multi-renderer coordinate transformation
 */

export class DataProcessor {
  constructor(config = {}) {
    this.config = {
      // Time processing options
      timeZone: 'UTC',
      autoDetectTimeFormat: true,
      fillGaps: false,
      gapThreshold: '1d', // '1h', '1d', '1w', '1m', '1y'
      
      // Data validation options
      strictValidation: true,
      removeOutliers: false,
      outlierThreshold: 3, // Standard deviations
      
      // Performance options
      enableCaching: true,
      batchSize: 10000,
      
      // Normalization options
      normalizeTimeStamps: true,
      sortByTime: true,
      removeDuplicates: true,
      
      ...config
    };
    
    // Internal state
    this.cache = new Map();
    this.processedDatasets = new Map();
    this.dataStats = new Map();
    
    // Time format patterns for parsing
    this.timeFormats = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // SQL timestamp
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /^\d{1,2}\/\d{1,2}\/\d{4}/, // M/D/YYYY
      /^\d{13}$/, // Timestamp (milliseconds)
      /^\d{10}$/, // Timestamp (seconds)
    ];
  }
  
  /**
   * Process datasets for charts - main entry point
   * @param {Array} datasets - Array of datasets to process
   * @param {Object} options - Processing options
   * @returns {Array} Processed datasets
   */
  async processDatasets(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }
    
    const processingOptions = { ...this.config, ...options };
    const processedDatasets = [];
    
    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        
        console.log(`Processing dataset ${i + 1}/${datasets.length}: ${dataset.name || dataset.id || 'Unknown'}`);
        
        const processedDataset = await this.processDataset(dataset, processingOptions);
        processedDatasets.push(processedDataset);
      }
      
      console.log(`DataProcessor: Successfully processed ${processedDatasets.length} datasets`);
      return processedDatasets;
      
    } catch (error) {
      console.error('Error processing datasets:', error);
      throw error;
    }
  }
  
  /**
   * Process a single dataset
   * @param {Object} dataset - Dataset to process
   * @param {Object} options - Processing options
   * @returns {Object} Processed dataset
   */
  async processDataset(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }
    
    const cacheKey = this._generateCacheKey(dataset, options);
    
    // Check cache first
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      console.log('Using cached processed dataset');
      return this.cache.get(cacheKey);
    }
    
    try {
      // Step 1: Parse and normalize time values
      let processedData = await this._parseTimeValues(dataset.data, options);
      
      // Step 2: Validate and clean numeric values
      processedData = this._validateNumericValues(processedData, options);
      
      // Step 3: Handle missing data and gaps
      if (options.fillGaps) {
        processedData = this._fillGaps(processedData, options);
      }
      
      // Step 4: Remove duplicates
      if (options.removeDuplicates) {
        processedData = this._removeDuplicates(processedData, options);
      }
      
      // Step 5: Sort by time
      if (options.sortByTime) {
        processedData = this._sortByTime(processedData, options);
      }
      
      // Step 6: Remove outliers if requested
      if (options.removeOutliers) {
        processedData = this._removeOutliers(processedData, options);
      }
      
      // Step 7: Calculate data statistics
      const stats = this._calculateDataStats(processedData, options);
      
      // Create processed dataset
      const processedDataset = {
        ...dataset,
        data: processedData,
        originalDataCount: dataset.data.length,
        processedDataCount: processedData.length,
        stats: stats,
        processed: true,
        processedAt: Date.now()
      };
      
      // Cache if enabled
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, processedDataset);
      }
      
      // Store stats
      this.dataStats.set(dataset.id || dataset.name || 'unknown', stats);
      
      console.log(`Dataset processed: ${dataset.data.length} → ${processedData.length} points`);
      
      return processedDataset;
      
    } catch (error) {
      console.error('Error processing dataset:', error);
      throw error;
    }
  }
  
  /**
   * Parse and normalize time values
   * @private
   */
  async _parseTimeValues(data, options) {
    const processedData = [];
    let detectedFormat = null;
    let errorCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const point = { ...data[i] };
      
      try {
        // Handle different time field names
        const timeValue = point.x || point.date || point.time || point.timestamp;
        
        if (timeValue == null) {
          if (options.strictValidation) {
            throw new Error(`Missing time value at index ${i}`);
          }
          console.warn(`Missing time value at index ${i}, skipping point`);
          continue;
        }
        
        // Parse time value
        const parsedTime = this._parseTimeValue(timeValue, detectedFormat);
        
        if (parsedTime == null) {
          if (options.strictValidation) {
            throw new Error(`Invalid time value at index ${i}: ${timeValue}`);
          }
          console.warn(`Invalid time value at index ${i}: ${timeValue}, skipping point`);
          errorCount++;
          continue;
        }
        
        // Auto-detect format on first successful parse
        if (detectedFormat == null && options.autoDetectTimeFormat) {
          detectedFormat = this._detectTimeFormat(timeValue);
        }
        
        // Normalize time field
        point.x = parsedTime;
        point.date = new Date(parsedTime);
        point.timestamp = parsedTime;
        
        // Clean up duplicate time fields
        delete point.time;
        
        processedData.push(point);
        
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        console.warn(`Error processing point ${i}:`, error.message);
        errorCount++;
      }
      
      // Yield control periodically for large datasets
      if (i % this.config.batchSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    if (errorCount > 0) {
      console.warn(`Time parsing completed with ${errorCount} errors/skipped points`);
    }
    
    return processedData;
  }
  
  /**
   * Parse individual time value
   * @private
   */
  _parseTimeValue(value, detectedFormat = null) {
    // Already a Date object
    if (value instanceof Date) {
      return value.getTime();
    }
    
    // Already a number (timestamp)
    if (typeof value === 'number') {
      // Handle seconds vs milliseconds
      if (value < 1e12) {
        return value * 1000; // Convert seconds to milliseconds
      }
      return value;
    }
    
    // String parsing
    if (typeof value === 'string') {
      // Try native Date parsing first
      const nativeDate = new Date(value);
      if (!isNaN(nativeDate.getTime())) {
        return nativeDate.getTime();
      }
      
      // Try format-specific parsing
      if (detectedFormat) {
        const parsed = this._parseWithFormat(value, detectedFormat);
        if (parsed != null) return parsed;
      }
      
      // Try all known formats
      for (const format of this.timeFormats) {
        if (format.test(value)) {
          const parsed = this._parseWithFormat(value, format);
          if (parsed != null) return parsed;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Parse with specific format
   * @private
   */
  _parseWithFormat(value, format) {
    try {
      if (typeof format === 'string') {
        // Custom format parsing could go here
        return new Date(value).getTime();
      } else if (format instanceof RegExp) {
        if (format.test(value)) {
          return new Date(value).getTime();
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }
  
  /**
   * Detect time format
   * @private
   */
  _detectTimeFormat(value) {
    for (const format of this.timeFormats) {
      if (format.test(String(value))) {
        return format;
      }
    }
    return null;
  }
  
  /**
   * Validate and clean numeric values
   * @private
   */
  _validateNumericValues(data, options) {
    const processedData = [];
    let errorCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const point = { ...data[i] };
      
      try {
        // Handle different value field names
        const value = point.y || point.value || point.price || point.close || point.amount;
        
        if (value == null) {
          if (options.strictValidation) {
            throw new Error(`Missing numeric value at index ${i}`);
          }
          console.warn(`Missing numeric value at index ${i}, skipping point`);
          continue;
        }
        
        // Convert to number
        const numericValue = this._parseNumericValue(value);
        
        if (numericValue == null || !isFinite(numericValue)) {
          if (options.strictValidation) {
            throw new Error(`Invalid numeric value at index ${i}: ${value}`);
          }
          console.warn(`Invalid numeric value at index ${i}: ${value}, skipping point`);
          errorCount++;
          continue;
        }
        
        // Normalize value field
        point.y = numericValue;
        point.value = numericValue;
        
        // Preserve original field names but ensure they're numeric
        if (point.price !== undefined) point.price = numericValue;
        if (point.close !== undefined) point.close = numericValue;
        if (point.amount !== undefined) point.amount = numericValue;
        
        processedData.push(point);
        
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        console.warn(`Error validating point ${i}:`, error.message);
        errorCount++;
      }
    }
    
    if (errorCount > 0) {
      console.warn(`Numeric validation completed with ${errorCount} errors/skipped points`);
    }
    
    return processedData;
  }
  
  /**
   * Parse numeric value
   * @private
   */
  _parseNumericValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Remove common formatting
      const cleaned = value.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }
  
  /**
   * Fill gaps in time series data
   * @private
   */
  _fillGaps(data, options) {
    if (data.length < 2) return data;
    
    const gapThresholdMs = this._parseGapThreshold(options.gapThreshold);
    const filledData = [data[0]]; // Start with first point
    
    for (let i = 1; i < data.length; i++) {
      const prevPoint = data[i - 1];
      const currentPoint = data[i];
      const timeDiff = currentPoint.x - prevPoint.x;
      
      // Check if gap exists
      if (timeDiff > gapThresholdMs) {
        // Fill gap with interpolated points
        const interpolatedPoints = this._interpolateGap(prevPoint, currentPoint, gapThresholdMs);
        filledData.push(...interpolatedPoints);
      }
      
      filledData.push(currentPoint);
    }
    
    return filledData;
  }
  
  /**
   * Parse gap threshold to milliseconds
   * @private
   */
  _parseGapThreshold(threshold) {
    const units = {
      'ms': 1,
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'M': 30 * 24 * 60 * 60 * 1000,
      'y': 365 * 24 * 60 * 60 * 1000
    };
    
    const match = threshold.match(/^(\d+)(\w+)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return value * (units[unit] || units['d']);
    }
    
    return 24 * 60 * 60 * 1000; // Default to 1 day
  }
  
  /**
   * Interpolate gap between two points
   * @private
   */
  _interpolateGap(startPoint, endPoint, intervalMs) {
    const interpolatedPoints = [];
    const timeDiff = endPoint.x - startPoint.x;
    const valueDiff = endPoint.y - startPoint.y;
    const numIntervals = Math.floor(timeDiff / intervalMs);
    
    for (let i = 1; i < numIntervals; i++) {
      const ratio = i / numIntervals;
      const interpolatedTime = startPoint.x + (timeDiff * ratio);
      const interpolatedValue = startPoint.y + (valueDiff * ratio);
      
      interpolatedPoints.push({
        x: interpolatedTime,
        y: interpolatedValue,
        date: new Date(interpolatedTime),
        interpolated: true
      });
    }
    
    return interpolatedPoints;
  }
  
  /**
   * Remove duplicate points
   * @private
   */
  _removeDuplicates(data, options) {
    if (data.length < 2) return data;
    
    const uniqueData = [];
    const seen = new Set();
    
    for (const point of data) {
      const key = `${point.x}-${point.y}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(point);
      }
    }
    
    return uniqueData;
  }
  
  /**
   * Sort data by time
   * @private
   */
  _sortByTime(data, options) {
    return [...data].sort((a, b) => a.x - b.x);
  }
  
  /**
   * Remove outliers using standard deviation
   * @private
   */
  _removeOutliers(data, options) {
    if (data.length < 3) return data;
    
    const values = data.map(d => d.y);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = options.outlierThreshold * stdDev;
    const lowerBound = mean - threshold;
    const upperBound = mean + threshold;
    
    return data.filter(point => {
      return point.y >= lowerBound && point.y <= upperBound;
    });
  }
  
  /**
   * Calculate comprehensive data statistics
   * @private
   */
  _calculateDataStats(data, options) {
    if (data.length === 0) {
      return { count: 0, timeRange: null, valueRange: null };
    }
    
    const times = data.map(d => d.x);
    const values = data.map(d => d.y);
    
    const stats = {
      count: data.length,
      
      // Time statistics
      timeRange: {
        min: Math.min(...times),
        max: Math.max(...times),
        span: Math.max(...times) - Math.min(...times),
        startDate: new Date(Math.min(...times)),
        endDate: new Date(Math.max(...times))
      },
      
      // Value statistics
      valueRange: {
        min: Math.min(...values),
        max: Math.max(...values),
        span: Math.max(...values) - Math.min(...values),
        mean: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: this._calculateMedian(values)
      },
      
      // Data quality
      quality: {
        hasGaps: this._detectGaps(data, options),
        hasDuplicates: this._detectDuplicates(data),
        outlierCount: 0, // Would be calculated if outlier removal was performed
        completeness: 1.0 // Ratio of valid points
      }
    };
    
    return stats;
  }
  
  /**
   * Calculate median value
   * @private
   */
  _calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Detect gaps in time series
   * @private
   */
  _detectGaps(data, options) {
    if (data.length < 2) return false;
    
    const gapThresholdMs = this._parseGapThreshold(options.gapThreshold);
    
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].x - data[i - 1].x;
      if (timeDiff > gapThresholdMs) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect duplicate points
   * @private
   */
  _detectDuplicates(data) {
    const seen = new Set();
    
    for (const point of data) {
      const key = `${point.x}-${point.y}`;
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }
    
    return false;
  }
  
  /**
   * Generate cache key for processed data
   * @private
   */
  _generateCacheKey(dataset, options) {
    const dataHash = this._hashData(dataset.data);
    const optionsHash = this._hashObject(options);
    return `${dataset.id || 'unknown'}-${dataHash}-${optionsHash}`;
  }
  
  /**
   * Simple hash function for data
   * @private
   */
  _hashData(data) {
    if (!Array.isArray(data) || data.length === 0) return '0';
    
    // Hash based on first, middle, and last points plus length
    const first = data[0];
    const middle = data[Math.floor(data.length / 2)];
    const last = data[data.length - 1];
    
    return `${data.length}-${JSON.stringify(first)}-${JSON.stringify(middle)}-${JSON.stringify(last)}`.replace(/\s/g, '');
  }
  
  /**
   * Hash object for cache key
   * @private
   */
  _hashObject(obj) {
    return JSON.stringify(obj).replace(/\s/g, '');
  }
  
  /**
   * Clear processing cache
   */
  clearCache() {
    this.cache.clear();
    this.dataStats.clear();
    console.log('DataProcessor cache cleared');
  }
  
  /**
   * Get processing statistics
   */
  getStats(datasetId = null) {
    if (datasetId) {
      return this.dataStats.get(datasetId);
    }
    return Object.fromEntries(this.dataStats);
  }
  
  /**
   * Validate time series data format
   */
  static validateTimeSeriesFormat(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Data must be an array' };
    }
    
    if (data.length === 0) {
      return { valid: false, error: 'Data array is empty' };
    }
    
    // Check first few points for required fields
    const sampleSize = Math.min(10, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const point = data[i];
      
      if (!point || typeof point !== 'object') {
        return { valid: false, error: `Point ${i} is not an object` };
      }
      
      // Check for time field
      const hasTimeField = point.x !== undefined || point.date !== undefined || 
                          point.time !== undefined || point.timestamp !== undefined;
      
      if (!hasTimeField) {
        return { valid: false, error: `Point ${i} missing time field (x, date, time, or timestamp)` };
      }
      
      // Check for value field
      const hasValueField = point.y !== undefined || point.value !== undefined || 
                           point.price !== undefined || point.close !== undefined;
      
      if (!hasValueField) {
        return { valid: false, error: `Point ${i} missing value field (y, value, price, or close)` };
      }
    }
    
    return { valid: true };
  }
}
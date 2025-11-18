export class DataProcessor {
  constructor(config = {}) {
    this.config = {
      timeZone: 'UTC',
      autoDetectTimeFormat: true,
      fillGaps: false,
      gapThreshold: '1d',
      strictValidation: true,
      removeOutliers: false,
      outlierThreshold: 3,
      enableCaching: true,
      batchSize: 10000,
      normalizeTimeStamps: true,
      sortByTime: true,
      removeDuplicates: true,
      ...config
    };

    this.cache = new Map();
    this.processedDatasets = new Map();
    this.dataStats = new Map();

    this.timeFormats = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\d{1,2}\/\d{1,2}\/\d{4}/,
      /^\d{13}$/,
      /^\d{10}$/
    ];
  }

  async processDatasets(datasets, options = {}) {
    if (!Array.isArray(datasets)) {
      throw new Error('Datasets must be an array');
    }

    const processingOptions = { ...this.config, ...options };
    const processedDatasets = [];

    try {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        const processedDataset = await this.processDataset(dataset, processingOptions);
        processedDatasets.push(processedDataset);
      }

      return processedDatasets;
    } catch (error) {
      throw error;
    }
  }

  async processDataset(dataset, options = {}) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset must have a data array');
    }

    const cacheKey = this._generateCacheKey(dataset, options);

    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      let processedData = await this._parseTimeValues(dataset.data, options);
      processedData = this._validateNumericValues(processedData, options);

      if (processedData.length === 0) {
        return {
          ...dataset,
          data: [],
          originalDataCount: dataset.data.length,
          processedDataCount: 0,
          isEmpty: true,
          processed: true,
          processedAt: Date.now(),
          stats: {
            count: 0,
            timeRange: null,
            valueRange: null
          }
        };
      }

      if (options.fillGaps) {
        processedData = this._fillGaps(processedData, options);
      }

      if (options.removeDuplicates) {
        processedData = this._removeDuplicates(processedData, options);
      }

      if (options.sortByTime) {
        processedData = this._sortByTime(processedData, options);
      }

      if (options.removeOutliers) {
        const beforeOutlierRemoval = processedData.length;
        processedData = this._removeOutliers(processedData, options);

        if (processedData.length === 0) {
          processedData = this._removeOutliers(dataset.data, { ...options, removeOutliers: false });
          processedData = await this._parseTimeValues(dataset.data, options);
          processedData = this._validateNumericValues(processedData, options);
          if (options.sortByTime) {
            processedData = this._sortByTime(processedData, options);
          }
        }
      }

      const stats = this._calculateDataStats(processedData, options);

      const processedDataset = {
        ...dataset,
        data: processedData,
        originalDataCount: dataset.data.length,
        processedDataCount: processedData.length,
        isEmpty: processedData.length === 0,
        isSinglePoint: processedData.length === 1,
        stats: stats,
        processed: true,
        processedAt: Date.now()
      };

      if (this.config.enableCaching) {
        this.cache.set(cacheKey, processedDataset);
      }

      this.dataStats.set(dataset.id || dataset.name || 'unknown', stats);

      return processedDataset;
    } catch (error) {
      throw error;
    }
  }

  async _parseTimeValues(data, options) {
    const processedData = [];
    let detectedFormat = null;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const point = { ...data[i] };

      try {
        const timeValue = point.x || point.date || point.time || point.timestamp;

        if (timeValue == null) {
          if (options.strictValidation) {
            throw new Error(`Missing time value at index ${i}`);
          }
          errorCount++;
          continue;
        }

        const parsedTime = this._parseTimeValue(timeValue, detectedFormat);

        if (parsedTime == null) {
          if (options.strictValidation) {
            throw new Error(`Invalid time value at index ${i}: ${timeValue}`);
          }
          errorCount++;
          continue;
        }

        if (detectedFormat == null && options.autoDetectTimeFormat) {
          detectedFormat = this._detectTimeFormat(timeValue);
        }

        point.x = parsedTime;
        point.date = new Date(parsedTime);
        point.timestamp = parsedTime;

        delete point.time;

        processedData.push(point);
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        errorCount++;
      }

      if (i % this.config.batchSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return processedData;
  }

  _parseTimeValue(value, detectedFormat = null) {
    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'number') {
      if (value < 1e12) {
        return value * 1000;
      }
      return value;
    }

    if (typeof value === 'string') {
      const nativeDate = new Date(value);
      if (!isNaN(nativeDate.getTime())) {
        return nativeDate.getTime();
      }

      if (detectedFormat) {
        const parsed = this._parseWithFormat(value, detectedFormat);
        if (parsed != null) return parsed;
      }

      for (const format of this.timeFormats) {
        if (format.test(value)) {
          const parsed = this._parseWithFormat(value, format);
          if (parsed != null) return parsed;
        }
      }
    }

    return null;
  }

  _parseWithFormat(value, format) {
    try {
      if (typeof format === 'string') {
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

  _detectTimeFormat(value) {
    for (const format of this.timeFormats) {
      if (format.test(String(value))) {
        return format;
      }
    }
    return null;
  }

  _validateNumericValues(data, options) {
    const processedData = [];
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const point = { ...data[i] };

      try {
        const value = point.y || point.value || point.price || point.close || point.amount;

        if (value == null) {
          if (options.strictValidation) {
            throw new Error(`Missing numeric value at index ${i}`);
          }
          errorCount++;
          continue;
        }

        const numericValue = this._parseNumericValue(value);

        if (numericValue == null || !isFinite(numericValue)) {
          if (options.strictValidation) {
            throw new Error(`Invalid numeric value at index ${i}: ${value}`);
          }
          errorCount++;
          continue;
        }

        point.y = numericValue;
        point.value = numericValue;

        if (point.price !== undefined) point.price = numericValue;
        if (point.close !== undefined) point.close = numericValue;
        if (point.amount !== undefined) point.amount = numericValue;

        processedData.push(point);
      } catch (error) {
        if (options.strictValidation) {
          throw error;
        }
        errorCount++;
      }
    }

    return processedData;
  }

  _parseNumericValue(value) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  _fillGaps(data, options) {
    if (data.length < 2) return data;

    const gapThresholdMs = this._parseGapThreshold(options.gapThreshold);
    const filledData = [data[0]];

    for (let i = 1; i < data.length; i++) {
      const prevPoint = data[i - 1];
      const currentPoint = data[i];
      const timeDiff = currentPoint.x - prevPoint.x;

      if (timeDiff > gapThresholdMs) {
        const interpolatedPoints = this._interpolateGap(prevPoint, currentPoint, gapThresholdMs);
        filledData.push(...interpolatedPoints);
      }

      filledData.push(currentPoint);
    }

    return filledData;
  }

  _parseGapThreshold(threshold) {
    const units = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      M: 30 * 24 * 60 * 60 * 1000,
      y: 365 * 24 * 60 * 60 * 1000
    };

    const match = threshold.match(/^(\d+)(\w+)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return value * (units[unit] || units['d']);
    }

    return 24 * 60 * 60 * 1000;
  }

  _interpolateGap(startPoint, endPoint, intervalMs) {
    const interpolatedPoints = [];
    const timeDiff = endPoint.x - startPoint.x;
    const valueDiff = endPoint.y - startPoint.y;
    const numIntervals = Math.floor(timeDiff / intervalMs);

    for (let i = 1; i < numIntervals; i++) {
      const ratio = i / numIntervals;
      const interpolatedTime = startPoint.x + timeDiff * ratio;
      const interpolatedValue = startPoint.y + valueDiff * ratio;

      interpolatedPoints.push({
        x: interpolatedTime,
        y: interpolatedValue,
        date: new Date(interpolatedTime),
        interpolated: true
      });
    }

    return interpolatedPoints;
  }

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

  _sortByTime(data, options) {
    return [...data].sort((a, b) => a.x - b.x);
  }

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

  _calculateDataStats(data, options) {
    if (data.length === 0) {
      return { count: 0, timeRange: null, valueRange: null };
    }

    const times = data.map(d => d.x);
    const values = data.map(d => d.y);

    const stats = {
      count: data.length,
      timeRange: {
        min: Math.min(...times),
        max: Math.max(...times),
        span: Math.max(...times) - Math.min(...times),
        startDate: new Date(Math.min(...times)),
        endDate: new Date(Math.max(...times))
      },
      valueRange: {
        min: Math.min(...values),
        max: Math.max(...values),
        span: Math.max(...values) - Math.min(...values),
        mean: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: this._calculateMedian(values)
      },
      quality: {
        hasGaps: this._detectGaps(data, options),
        hasDuplicates: this._detectDuplicates(data),
        outlierCount: 0,
        completeness: 1.0
      }
    };

    return stats;
  }

  _calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

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

  _generateCacheKey(dataset, options) {
    const dataHash = this._hashData(dataset.data);
    const optionsHash = this._hashObject(options);
    return `${dataset.id || 'unknown'}-${dataHash}-${optionsHash}`;
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

  clearCache() {
    this.cache.clear();
    this.dataStats.clear();
  }

  getStats(datasetId = null) {
    if (datasetId) {
      return this.dataStats.get(datasetId);
    }
    return Object.fromEntries(this.dataStats);
  }

  static validateTimeSeriesFormat(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Data must be an array' };
    }

    if (data.length === 0) {
      return { valid: false, error: 'Data array is empty' };
    }

    const sampleSize = Math.min(10, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const point = data[i];

      if (!point || typeof point !== 'object') {
        return { valid: false, error: `Point ${i} is not an object` };
      }

      const hasTimeField = point.x !== undefined || point.date !== undefined || point.time !== undefined || point.timestamp !== undefined;

      if (!hasTimeField) {
        return { valid: false, error: `Point ${i} missing time field (x, date, time, or timestamp)` };
      }

      const hasValueField = point.y !== undefined || point.value !== undefined || point.price !== undefined || point.close !== undefined;

      if (!hasValueField) {
        return { valid: false, error: `Point ${i} missing value field (y, value, price, or close)` };
      }
    }

    return { valid: true };
  }
}

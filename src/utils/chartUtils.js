/**
 * Utility functions for VisionCharts
 */

/**
 * Format date value for display
 * @param {Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date
 */
export function formatDateValue(date, format = 'MMM dd, yyyy') {
    if (!date) return '';
    
    // Convert to Date object if string
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check for valid date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    // Use Intl.DateTimeFormat for formatting
    let options = {};
    
    // Custom format handler
    if (format === 'MMM dd, yyyy') {
      options = { 
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      };
    } else if (format === 'yyyy-MM-dd') {
      // ISO format
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (format === 'MM/dd/yyyy') {
      // US format
      options = { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };
    } else if (format === 'HH:mm:ss') {
      // Time only
      options = { 
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
    } else if (format === 'full') {
      // Full date and time
      options = { 
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  }
  
  /**
   * Calculate technical indicator values
   * @param {string} indicator - Indicator type
   * @param {Array} data - Data array
   * @param {Object} params - Indicator parameters
   * @returns {Array} Calculated indicator values
   */
  export function calculateIndicator(indicator, data, params = {}) {
    // Safety check
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    switch (indicator.toLowerCase()) {
      case 'sma':
        return calculateSMA(data, params);
      case 'ema':
        return calculateEMA(data, params);
      case 'bollinger':
        return calculateBollingerBands(data, params);
      case 'rsi':
        return calculateRSI(data, params);
      case 'macd':
        return calculateMACD(data, params);
      default:
        throw new Error(`Unsupported indicator: ${indicator}`);
    }
  }
  
  /**
   * Calculate Simple Moving Average (SMA)
   * @param {Array} data - Data array
   * @param {Object} params - SMA parameters
   * @returns {Array} SMA values
   */
  function calculateSMA(data, params = {}) {
    const { period = 14, valueField = 'y', xField = 'x' } = params;
    
    // Validate period
    if (period <= 0 || !Number.isInteger(period)) {
      throw new Error('SMA period must be a positive integer');
    }
    
    // Calculate SMA
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const value = data[i - j][valueField];
        if (typeof value !== 'number') {
          throw new Error(`Invalid value at index ${i - j} for field ${valueField}`);
        }
        sum += value;
      }
      
      const sma = sum / period;
      
      // Create data point
      result.push({
        [xField]: data[i][xField],
        [valueField]: sma,
        original: data[i][valueField]
      });
    }
    
    return result;
  }
  
  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {Array} data - Data array
   * @param {Object} params - EMA parameters
   * @returns {Array} EMA values
   */
  function calculateEMA(data, params = {}) {
    const { period = 14, valueField = 'y', xField = 'x' } = params;
    
    // Validate period
    if (period <= 0 || !Number.isInteger(period)) {
      throw new Error('EMA period must be a positive integer');
    }
    
    // Calculate multiplier
    const multiplier = 2 / (period + 1);
    
    // Calculate EMA
    const result = [];
    let ema = null;
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        continue;
      }
      
      // For the first point, use SMA as the initial EMA
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j][valueField];
        }
        ema = sum / period;
      } else {
        // Calculate EMA using previous EMA
        const value = data[i][valueField];
        ema = (value - ema) * multiplier + ema;
      }
      
      // Create data point
      result.push({
        [xField]: data[i][xField],
        [valueField]: ema,
        original: data[i][valueField]
      });
    }
    
    return result;
  }
  
  /**
   * Calculate Bollinger Bands
   * @param {Array} data - Data array
   * @param {Object} params - Bollinger Bands parameters
   * @returns {Array} Bollinger Bands values
   */
  function calculateBollingerBands(data, params = {}) {
    const { 
      period = 20, 
      deviations = 2,
      valueField = 'y',
      xField = 'x'
    } = params;
    
    // Validate parameters
    if (period <= 0 || !Number.isInteger(period)) {
      throw new Error('Bollinger Bands period must be a positive integer');
    }
    
    if (deviations <= 0) {
      throw new Error('Bollinger Bands deviations must be positive');
    }
    
    // Calculate Bollinger Bands
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        continue;
      }
      
      // Calculate SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j][valueField];
      }
      const sma = sum / period;
      
      // Calculate standard deviation
      let sumSquaredDeviations = 0;
      for (let j = 0; j < period; j++) {
        const deviation = data[i - j][valueField] - sma;
        sumSquaredDeviations += deviation ** 2;
      }
      const stdDev = Math.sqrt(sumSquaredDeviations / period);
      
      // Calculate bands
      const upperBand = sma + (stdDev * deviations);
      const lowerBand = sma - (stdDev * deviations);
      
      // Create data point
      result.push({
        [xField]: data[i][xField],
        middle: sma,
        upper: upperBand,
        lower: lowerBand,
        original: data[i][valueField]
      });
    }
    
    return result;
  }
  
  /**
   * Calculate Relative Strength Index (RSI)
   * @param {Array} data - Data array
   * @param {Object} params - RSI parameters
   * @returns {Array} RSI values
   */
  function calculateRSI(data, params = {}) {
    const { period = 14, valueField = 'y', xField = 'x' } = params;
    
    // Validate period
    if (period <= 0 || !Number.isInteger(period)) {
      throw new Error('RSI period must be a positive integer');
    }
    
    // Calculate RSI
    const result = [];
    let gains = 0;
    let losses = 0;
    
    // First pass - calculate initial averages
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        continue;
      }
      
      const currentValue = data[i][valueField];
      const previousValue = data[i - 1][valueField];
      const change = currentValue - previousValue;
      
      if (i <= period) {
        // Accumulate initial gain/loss sums
        if (change >= 0) {
          gains += change;
        } else {
          losses -= change; // Make positive
        }
        
        if (i < period) {
          continue;
        }
        
        // First RSI value
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) {
          // No losses, RSI = 100
          result.push({
            [xField]: data[i][xField],
            rsi: 100,
            avgGain,
            avgLoss,
            original: data[i][valueField]
          });
        } else {
          const rs = avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));
          result.push({
            [xField]: data[i][xField],
            rsi,
            avgGain,
            avgLoss,
            original: data[i][valueField]
          });
        }
      } else {
        // Use smoothed averages for the rest
        const previousAvgGain = result[result.length - 1].avgGain;
        const previousAvgLoss = result[result.length - 1].avgLoss;
        
        const currentGain = change >= 0 ? change : 0;
        const currentLoss = change < 0 ? -change : 0;
        
        const avgGain = ((previousAvgGain * (period - 1)) + currentGain) / period;
        const avgLoss = ((previousAvgLoss * (period - 1)) + currentLoss) / period;
        
        if (avgLoss === 0) {
          // No losses, RSI = 100
          result.push({
            [xField]: data[i][xField],
            rsi: 100,
            avgGain,
            avgLoss,
            original: data[i][valueField]
          });
        } else {
          const rs = avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));
          result.push({
            [xField]: data[i][xField],
            rsi,
            avgGain,
            avgLoss,
            original: data[i][valueField]
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param {Array} data - Data array
   * @param {Object} params - MACD parameters
   * @returns {Array} MACD values
   */
  function calculateMACD(data, params = {}) {
    const { 
      fastPeriod = 12, 
      slowPeriod = 26, 
      signalPeriod = 9,
      valueField = 'y',
      xField = 'x'
    } = params;
    
    // Validate periods
    if (fastPeriod <= 0 || !Number.isInteger(fastPeriod)) {
      throw new Error('MACD fast period must be a positive integer');
    }
    
    if (slowPeriod <= 0 || !Number.isInteger(slowPeriod)) {
      throw new Error('MACD slow period must be a positive integer');
    }
    
    if (signalPeriod <= 0 || !Number.isInteger(signalPeriod)) {
      throw new Error('MACD signal period must be a positive integer');
    }
    
    // Calculate fast EMA
    const fastMultiplier = 2 / (fastPeriod + 1);
    let fastEMA = null;
    const fastEMAs = new Array(data.length).fill(null);
    
    // Calculate slow EMA
    const slowMultiplier = 2 / (slowPeriod + 1);
    let slowEMA = null;
    const slowEMAs = new Array(data.length).fill(null);
    
    // Calculate both EMAs
    for (let i = 0; i < data.length; i++) {
      const value = data[i][valueField];
      
      // Fast EMA
      if (i < fastPeriod - 1) {
        // Not enough data
      } else if (i === fastPeriod - 1) {
        // Initial SMA for fast EMA
        let sum = 0;
        for (let j = 0; j < fastPeriod; j++) {
          sum += data[i - j][valueField];
        }
        fastEMA = sum / fastPeriod;
        fastEMAs[i] = fastEMA;
      } else {
        fastEMA = (value - fastEMA) * fastMultiplier + fastEMA;
        fastEMAs[i] = fastEMA;
      }
      
      // Slow EMA
      if (i < slowPeriod - 1) {
        // Not enough data
      } else if (i === slowPeriod - 1) {
        // Initial SMA for slow EMA
        let sum = 0;
        for (let j = 0; j < slowPeriod; j++) {
          sum += data[i - j][valueField];
        }
        slowEMA = sum / slowPeriod;
        slowEMAs[i] = slowEMA;
      } else {
        slowEMA = (value - slowEMA) * slowMultiplier + slowEMA;
        slowEMAs[i] = slowEMA;
      }
    }
    
    // Calculate MACD line
    const macdLine = new Array(data.length).fill(null);
    
    for (let i = 0; i < data.length; i++) {
      if (i < slowPeriod - 1 || fastEMAs[i] === null || slowEMAs[i] === null) {
        // Not enough data
      } else {
        macdLine[i] = fastEMAs[i] - slowEMAs[i];
      }
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalMultiplier = 2 / (signalPeriod + 1);
    let signalEMA = null;
    const signalLine = new Array(data.length).fill(null);
    
    for (let i = 0; i < data.length; i++) {
      if (i < slowPeriod + signalPeriod - 2 || macdLine[i] === null) {
        // Not enough data
      } else if (i === slowPeriod + signalPeriod - 2) {
        // Initial SMA for signal line
        let sum = 0;
        let count = 0;
        for (let j = 0; j < signalPeriod; j++) {
          if (i - j >= 0 && macdLine[i - j] !== null) {
            sum += macdLine[i - j];
            count++;
          }
        }
        signalEMA = count > 0 ? sum / count : null;
        signalLine[i] = signalEMA;
      } else if (signalEMA !== null) {
        signalEMA = (macdLine[i] - signalEMA) * signalMultiplier + signalEMA;
        signalLine[i] = signalEMA;
      }
    }
    
    // Combine into result
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) {
        continue;
      }
      
      result.push({
        [xField]: data[i][xField],
        macd: macdLine[i],
        signal: signalLine[i],
        histogram: macdLine[i] - signalLine[i],
        original: data[i][valueField]
      });
    }
    
    return result;
  }
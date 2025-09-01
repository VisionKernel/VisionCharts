/**
 * Mathematical utility functions for VisionCharts
 * These functions support chart operations and technical indicators
 */

/**
 * Calculate the sum of an array of numbers
 * @param {Array<number>} values - Array of values
 * @returns {number} Sum of values
 */
export function sum(values) {
  return values.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculate the mean (average) of an array of numbers
 * @param {Array<number>} values - Array of values
 * @returns {number} Mean value
 */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  return sum(values) / values.length;
}

/**
 * Calculate the median of an array of numbers
 * @param {Array<number>} values - Array of values
 * @returns {number} Median value
 */
export function median(values) {
  if (!values || values.length === 0) return 0;
  
  // Filter out non-finite values and sort
  const validValues = values.filter(val => typeof val === 'number' && isFinite(val));
  
  if (validValues.length === 0) return 0;
  
  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    // Even number of values - return average of middle two
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    // Odd number of values - return middle value
    return sorted[mid];
  }
}

/**
 * Calculate the variance of an array of numbers
 * @param {Array<number>} values - Array of values
 * @param {boolean} sample - Whether to calculate sample variance (n-1) or population variance (n)
 * @returns {number} Variance
 */
export function variance(values, sample = true) {
  if (!values || values.length === 0) return 0;
  
  const avg = mean(values);
  const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
  
  // Sample variance uses n-1, population variance uses n
  const divisor = sample ? values.length - 1 : values.length;
  return sum(squaredDiffs) / divisor;
}

/**
 * Calculate the standard deviation of an array of numbers
 * @param {Array<number>} values - Array of values
 * @param {boolean} sample - Whether to calculate sample std dev (n-1) or population std dev (n)
 * @returns {number} Standard deviation
 */
export function standardDeviation(values, sample = true) {
  return Math.sqrt(variance(values, sample));
}

/**
 * Calculate the min value in an array of numbers
 * @param {Array<number>} values - Array of values
 * @returns {number} Minimum value
 */
export function min(values) {
  if (!values || values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate the max value in an array of numbers
 * @param {Array<number>} values - Array of values
 * @returns {number} Maximum value
 */
export function max(values) {
  if (!values || values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Calculate linear regression for a series of points
 * @param {Array<Array<number>>} points - Array of [x,y] points
 * @returns {Object} Regression parameters {slope, intercept, r2}
 */
export function linearRegression(points) {
  if (!points || points.length === 0) {
    return { slope: 0, intercept: 0, r2: 0 };
  }
  
  const n = points.length;
  const xValues = points.map(p => p[0]);
  const yValues = points.map(p => p[1]);
  
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    const x = xValues[i];
    const y = yValues[i];
    
    numerator += (x - xMean) * (y - yMean);
    denominator += Math.pow(x - xMean, 2);
  }
  
  // Calculate slope and intercept
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  
  // Calculate R-squared (coefficient of determination)
  let ssRes = 0;
  let ssTot = 0;
  
  for (let i = 0; i < n; i++) {
    const x = xValues[i];
    const y = yValues[i];
    const yPred = slope * x + intercept;
    
    ssRes += Math.pow(y - yPred, 2);
    ssTot += Math.pow(y - yMean, 2);
  }
  
  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
  
  return { slope, intercept, r2 };
}

/**
 * Calculate a linear interpolation between two points
 * @param {number} x - Input value
 * @param {number} x0 - First x value
 * @param {number} y0 - First y value
 * @param {number} x1 - Second x value
 * @param {number} y1 - Second y value
 * @returns {number} Interpolated value
 */
export function lerp(x, x0, y0, x1, y1) {
  if (x0 === x1) return (y0 + y1) / 2;
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}

/**
 * Normalize values to a specific range
 * @param {Array<number>} values - Array of values
 * @param {number} targetMin - Target minimum value
 * @param {number} targetMax - Target maximum value
 * @returns {Array<number>} Normalized values
 */
export function normalize(values, targetMin = 0, targetMax = 1) {
  const minVal = min(values);
  const maxVal = max(values);
  
  if (minVal === maxVal) return values.map(() => (targetMin + targetMax) / 2);
  
  return values.map(value => {
    return targetMin + (value - minVal) * (targetMax - targetMin) / (maxVal - minVal);
  });
}

/**
 * Calculate the percentage change between two values
 * @param {number} oldValue - Original value
 * @param {number} newValue - New value
 * @returns {number} Percentage change
 */
export function percentChange(oldValue, newValue) {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Calculate the compound annual growth rate (CAGR)
 * @param {number} startValue - Starting value
 * @param {number} endValue - Ending value
 * @param {number} years - Number of years
 * @returns {number} CAGR as a decimal (not percentage)
 */
export function cagr(startValue, endValue, years) {
  if (startValue <= 0 || years <= 0) return 0;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Calculate correlation coefficient between two arrays
 * @param {Array<number>} xValues - First array of values
 * @param {Array<number>} yValues - Second array of values 
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export function correlation(xValues, yValues) {
  if (!xValues || !yValues || xValues.length !== yValues.length || xValues.length === 0) {
    return 0;
  }
  
  const n = xValues.length;
  const xMean = mean(xValues);
  const yMean = mean(yValues);
  
  let numerator = 0;
  let xDenom = 0;
  let yDenom = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    
    numerator += xDiff * yDiff;
    xDenom += xDiff * xDiff;
    yDenom += yDiff * yDiff;
  }
  
  const denominator = Math.sqrt(xDenom * yDenom);
  
  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Round a number to a specified number of decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded value
 */
export function round(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// =============================================================================
// TECHNICAL INDICATORS / STUDIES
// =============================================================================

/**
 * Calculate Simple Moving Average (SMA) for chart data
 * @param {Array} data - Chart data array
 * @param {Object} params - SMA parameters
 * @returns {Array} Data with SMA values
 */
export function calculateSMA(data, params = {}) {
  const { period = 14, valueField = 'y', xField = 'x' } = params;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error('SMA period must be a positive integer');
  }
  
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
 * Calculate Exponential Moving Average (EMA) for chart data
 * @param {Array} data - Chart data array
 * @param {Object} params - EMA parameters
 * @returns {Array} Data with EMA values
 */
export function calculateEMA(data, params = {}) {
  const { period = 14, valueField = 'y', xField = 'x' } = params;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
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
 * Calculate Bollinger Bands for chart data
 * @param {Array} data - Chart data array
 * @param {Object} params - Bollinger Bands parameters
 * @returns {Array} Data with Bollinger Bands values
 */
export function calculateBollingerBands(data, params = {}) {
  const { 
    period = 20, 
    deviations = 2,
    valueField = 'y',
    xField = 'x'
  } = params;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error('Bollinger Bands period must be a positive integer');
  }
  
  if (deviations <= 0) {
    throw new Error('Bollinger Bands deviations must be positive');
  }
  
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
 * Calculate Relative Strength Index (RSI) for chart data
 * @param {Array} data - Chart data array
 * @param {Object} params - RSI parameters
 * @returns {Array} Data with RSI values
 */
export function calculateRSI(data, params = {}) {
  const { period = 14, valueField = 'y', xField = 'x' } = params;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error('RSI period must be a positive integer');
  }
  
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
 * Calculate MACD (Moving Average Convergence Divergence) for chart data
 * @param {Array} data - Chart data array
 * @param {Object} params - MACD parameters
 * @returns {Array} Data with MACD values
 */
export function calculateMACD(data, params = {}) {
  const { 
    fastPeriod = 12, 
    slowPeriod = 26, 
    signalPeriod = 9,
    valueField = 'y',
    xField = 'x'
  } = params;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  
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

/**
 * Calculate indicator based on type - main entry point for studies
 * @param {string} indicator - Indicator type
 * @param {Array} data - Data array
 * @param {Object} params - Indicator parameters
 * @returns {Array} Calculated indicator values
 */
export function calculateIndicator(indicator, data, params = {}) {
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

// Keep existing EMA, RSI, ATR functions for backward compatibility
export function ema(values, period, alpha = null) {
  if (!values || values.length === 0 || period <= 0) {
    return [];
  }
  
  const smoothing = alpha !== null ? alpha : 2 / (period + 1);
  
  const result = [];
  let emaValue = null;
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    
    if (emaValue === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      emaValue = sum / period;
    } else {
      emaValue = values[i] * smoothing + emaValue * (1 - smoothing);
    }
    
    result.push(emaValue);
  }
  
  return result;
}

export function rsi(values, period = 14) {
  if (!values || values.length === 0 || period <= 0) {
    return [];
  }
  
  const result = [];
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = period; i < values.length; i++) {
    if (i > period) {
      const change = values[i] - values[i - 1];
      
      if (change >= 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }
    
    const rs = avgLoss !== 0 ? avgGain / avgLoss : 100;
    const rsiValue = 100 - (100 / (1 + rs));
    
    result.push(rsiValue);
  }
  
  const padding = Array(period).fill(null);
  return [...padding, ...result];
}

export function atr(data, period = 14) {
  if (!data || data.length === 0 || period <= 0) {
    return [];
  }
  
  const trueRanges = [];
  
  for (let i = 0; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const close = i > 0 ? data[i - 1].close : data[i].open;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - close);
    const tr3 = Math.abs(low - close);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  const result = [];
  let atrValue = null;
  
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    
    if (atrValue === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += trueRanges[i - j];
      }
      atrValue = sum / period;
    } else {
      atrValue = ((period - 1) * atrValue + trueRanges[i]) / period;
    }
    
    result.push(atrValue);
  }
  
  return result;
}
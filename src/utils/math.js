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
   * Calculate the exponential moving average (EMA) with optional alpha parameter
   * @param {Array<number>} values - Array of values
   * @param {number} period - EMA period
   * @param {number|null} alpha - Smoothing factor (if null, calculated from period)
   * @returns {Array<number>} EMA values
   */
  export function ema(values, period, alpha = null) {
    if (!values || values.length === 0 || period <= 0) {
      return [];
    }
    
    // Calculate alpha if not provided
    const smoothing = alpha !== null ? alpha : 2 / (period + 1);
    
    const result = [];
    let emaValue = null;
    
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        // Not enough data yet
        result.push(null);
        continue;
      }
      
      if (emaValue === null) {
        // First EMA value is SMA
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += values[i - j];
        }
        emaValue = sum / period;
      } else {
        // Calculate EMA
        emaValue = values[i] * smoothing + emaValue * (1 - smoothing);
      }
      
      result.push(emaValue);
    }
    
    return result;
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
   * Calculate the Relative Strength Index (RSI)
   * @param {Array<number>} values - Array of price values
   * @param {number} period - RSI period (typically 14)
   * @returns {Array<number>} RSI values
   */
  export function rsi(values, period = 14) {
    if (!values || values.length === 0 || period <= 0) {
      return [];
    }
    
    const result = [];
    let avgGain = 0;
    let avgLoss = 0;
    
    // Calculate first average gain and loss
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
    
    // Calculate RSI
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
    
    // Fill beginning with nulls
    const padding = Array(period).fill(null);
    return [...padding, ...result];
  }
  
  /**
   * Calculate the Average True Range (ATR)
   * @param {Array<Object>} data - Array of OHLC data objects
   * @param {number} period - ATR period (typically 14)
   * @returns {Array<number>} ATR values
   */
  export function atr(data, period = 14) {
    if (!data || data.length === 0 || period <= 0) {
      return [];
    }
    
    const trueRanges = [];
    
    // Calculate true ranges
    for (let i = 0; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const close = i > 0 ? data[i - 1].close : data[i].open;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - close);
      const tr3 = Math.abs(low - close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Calculate ATR
    const result = [];
    let atrValue = null;
    
    for (let i = 0; i < trueRanges.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      
      if (atrValue === null) {
        // First ATR is SMA of TR
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += trueRanges[i - j];
        }
        atrValue = sum / period;
      } else {
        // Subsequent ATRs use smoothing formula
        atrValue = ((period - 1) * atrValue + trueRanges[i]) / period;
      }
      
      result.push(atrValue);
    }
    
    return result;
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
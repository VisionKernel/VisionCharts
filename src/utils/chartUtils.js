/**
 * Utility functions for VisionCharts
 */

// Re-export calculateIndicator from math.js for convenience
export { calculateIndicator } from './math.js';

/**
 * Format large numbers with K/M/B/T suffixes
 * @param {number} value - The number to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted number
 */
export function formatLargeNumber(value, options = {}) {
  const { decimals = 1 } = options;
  
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000000000) {
    // Trillions
    return sign + (absValue / 1000000000000).toFixed(decimals) + 'T';
  } else if (absValue >= 1000000000) {
    // Billions
    return sign + (absValue / 1000000000).toFixed(decimals) + 'B';
  } else if (absValue >= 1000000) {
    // Millions
    return sign + (absValue / 1000000).toFixed(decimals) + 'M';
  } else if (absValue >= 1000) {
    // Thousands
    return sign + (absValue / 1000).toFixed(decimals) + 'K';
  } else {
    // Less than 1000
    const isInteger = Math.floor(absValue) === absValue;
    return sign + (isInteger ? absValue.toString() : absValue.toFixed(decimals));
  }
}

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
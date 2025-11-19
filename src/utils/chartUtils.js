export { calculateIndicator } from './math.js';

export function formatLargeNumber(value, options = {}) {
  const { decimals = 1 } = options;
  
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1000000000000) {
    return sign + (absValue / 1000000000000).toFixed(decimals) + 'T';
  } else if (absValue >= 1000000000) {
    return sign + (absValue / 1000000000).toFixed(decimals) + 'B';
  } else if (absValue >= 1000000) {
    return sign + (absValue / 1000000).toFixed(decimals) + 'M';
  } else if (absValue >= 1000) {
    return sign + (absValue / 1000).toFixed(decimals) + 'K';
  } else {
    const isInteger = Math.floor(absValue) === absValue;
    return sign + (isInteger ? absValue.toString() : absValue.toFixed(decimals));
  }
}

export function formatDateValue(date, format = 'MMM dd, yyyy') {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  let options = {};
  
  if (format === 'MMM dd, yyyy') {
    options = { 
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    };
  } else if (format === 'yyyy-MM-dd') {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (format === 'MM/dd/yyyy') {
    options = { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
  } else if (format === 'HH:mm:ss') {
    options = { 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
  } else if (format === 'full') {
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
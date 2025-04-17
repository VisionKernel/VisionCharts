/**
 * Scale base class for transforming data values to visual coordinates
 */
export class Scale {
    /**
     * Create a scale
     * @param {Array} domain - Data domain [min, max]
     * @param {Array} range - Output range [min, max]
     */
    constructor(domain, range) {
      this.domain = domain;
      this.range = range;
    }
    
    /**
     * Set domain
     * @param {Array} domain - New domain [min, max]
     * @returns {Scale} This scale instance
     */
    setDomain(domain) {
      this.domain = domain;
      return this;
    }
    
    /**
     * Set range
     * @param {Array} range - New range [min, max]
     * @returns {Scale} This scale instance
     */
    setRange(range) {
      this.range = range;
      return this;
    }
    
    /**
     * Convert a domain value to a range value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    scale(value) {
      throw new Error('Method must be implemented by subclass');
    }
    
    /**
     * Invert a range value back to a domain value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    invert(value) {
      throw new Error('Method must be implemented by subclass');
    }
  }
  
  /**
   * Linear scale for continuous data
   */
  export class LinearScale extends Scale {
    /**
     * Convert a domain value to a range value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    scale(value) {
      const [d0, d1] = this.domain;
      const [r0, r1] = this.range;
      
      // Handle edge cases
      if (d0 === d1) return r0;
      
      // Linear interpolation
      return r0 + (value - d0) * (r1 - r0) / (d1 - d0);
    }
    
    /**
     * Invert a range value back to a domain value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    invert(value) {
      const [d0, d1] = this.domain;
      const [r0, r1] = this.range;
      
      // Handle edge cases
      if (r0 === r1) return d0;
      
      // Linear interpolation
      return d0 + (value - r0) * (d1 - d0) / (r1 - r0);
    }
  }
  
  /**
   * Time scale for date/time data
   */
  export class TimeScale extends LinearScale {
    /**
     * Convert a domain value to a range value
     * @param {Date|number} value - Value to convert
     * @returns {number} Converted value
     */
    scale(value) {
      // Convert to timestamp if needed
      const timestamp = value instanceof Date ? value.getTime() : value;
      return super.scale(timestamp);
    }
    
    /**
     * Invert a range value back to a domain value
     * @param {number} value - Value to convert
     * @returns {Date} Converted value as Date
     */
    invert(value) {
      const timestamp = super.invert(value);
      return new Date(timestamp);
    }
  }
  
  /**
   * Log scale for data with exponential distribution
   */
  export class LogScale extends Scale {
    /**
     * Create a log scale
     * @param {Array} domain - Data domain [min, max]
     * @param {Array} range - Output range [min, max]
     * @param {number} base - Logarithm base (default: 10)
     */
    constructor(domain, range, base = 10) {
      super(domain, range);
      this.base = base;
      this.log = value => Math.log(value) / Math.log(base);
      this.pow = value => Math.pow(base, value);
    }
    
    /**
     * Convert a domain value to a range value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    scale(value) {
      const [d0, d1] = this.domain;
      const [r0, r1] = this.range;
      
      // Handle edge cases
      if (value <= 0) throw new Error('Log scale domain must be positive');
      if (d0 === d1) return r0;
      
      // Log interpolation
      return r0 + (this.log(value) - this.log(d0)) * (r1 - r0) / (this.log(d1) - this.log(d0));
    }
    
    /**
     * Invert a range value back to a domain value
     * @param {number} value - Value to convert
     * @returns {number} Converted value
     */
    invert(value) {
      const [d0, d1] = this.domain;
      const [r0, r1] = this.range;
      
      // Handle edge cases
      if (r0 === r1) return d0;
      
      // Log interpolation
      return this.pow(this.log(d0) + (value - r0) * (this.log(d1) - this.log(d0)) / (r1 - r0));
    }
  }
  
  /**
   * Create a nice domain for axis ticks
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {number} count - Desired number of ticks
   * @returns {Array} Nice domain [min, max]
   */
  export function createNiceDomain(min, max, count = 5) {
    // Handle edge cases
    if (min === max) {
      return [min - 1, max + 1];
    }
    
    // Calculate step size
    const range = max - min;
    let step = Math.pow(10, Math.floor(Math.log10(range / count)));
    
    // Adjust step for better tick values
    const ratio = range / (count * step);
    if (ratio >= 5) step *= 5;
    else if (ratio >= 2) step *= 2;
    
    // Calculate nice min and max
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    
    return [niceMin, niceMax];
  }
  
  /**
   * Create nice time domain ticks
   * @param {Date|number} min - Minimum date/time
   * @param {Date|number} max - Maximum date/time
   * @param {number} count - Desired number of ticks
   * @returns {Array} Array of tick values as Date objects
   */
  export function createTimeTickValues(min, max, count = 5) {
    // Convert to Date objects if needed
    const minDate = min instanceof Date ? min : new Date(min);
    const maxDate = max instanceof Date ? max : new Date(max);
    
    // Get timestamps
    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    const range = maxTime - minTime;
    
    // Choose appropriate interval based on range
    let interval, intervalMs;
    
    if (range < 1000 * 60 * 60) {
      // Less than an hour: use minutes
      interval = 'minute';
      intervalMs = 1000 * 60;
    } else if (range < 1000 * 60 * 60 * 24) {
      // Less than a day: use hours
      interval = 'hour';
      intervalMs = 1000 * 60 * 60;
    } else if (range < 1000 * 60 * 60 * 24 * 7) {
      // Less than a week: use days
      interval = 'day';
      intervalMs = 1000 * 60 * 60 * 24;
    } else if (range < 1000 * 60 * 60 * 24 * 30) {
      // Less than a month: use weeks
      interval = 'week';
      intervalMs = 1000 * 60 * 60 * 24 * 7;
    } else if (range < 1000 * 60 * 60 * 24 * 365) {
      // Less than a year: use months
      interval = 'month';
      // Approximate month in milliseconds
      intervalMs = 1000 * 60 * 60 * 24 * 30;
    } else {
      // More than a year: use years
      interval = 'year';
      // Approximate year in milliseconds
      intervalMs = 1000 * 60 * 60 * 24 * 365;
    }
    
    // Calculate step size
    const step = Math.max(1, Math.round(range / (count * intervalMs)));
    
    // Generate tick values
    const tickValues = [];
    const startDate = new Date(minDate);
    
    // Adjust to nice starting point
    switch (interval) {
      case 'minute':
        startDate.setSeconds(0, 0);
        break;
      case 'hour':
        startDate.setMinutes(0, 0, 0);
        break;
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // Start on a Sunday or Monday
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }
    
    // Generate ticks
    const currentDate = new Date(startDate);
    while (currentDate <= maxDate) {
      tickValues.push(new Date(currentDate));
      
      // Increment by step
      switch (interval) {
        case 'minute':
          currentDate.setMinutes(currentDate.getMinutes() + step);
          break;
        case 'hour':
          currentDate.setHours(currentDate.getHours() + step);
          break;
        case 'day':
          currentDate.setDate(currentDate.getDate() + step);
          break;
        case 'week':
          currentDate.setDate(currentDate.getDate() + 7 * step);
          break;
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + step);
          break;
        case 'year':
          currentDate.setFullYear(currentDate.getFullYear() + step);
          break;
      }
    }
    
    return tickValues;
  }
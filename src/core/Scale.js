/**
 * Scale.js - Unified Scaling System (Updated for Renderer Agnostic Coordinates)
 * 
 * Provides consistent data-to-pixel mapping for both axes and chart rendering.
 * Supports linear, logarithmic, and time scales with renderer-agnostic coordinate system.
 */

export class Scale {
  constructor(config = {}) {
    this.type = config.type || 'linear'; // 'linear', 'log', 'time', 'ordinal'
    this.domain = config.domain || [0, 1]; // [min, max] data values
    this.range = config.range || [0, 100]; // [min, max] pixel values
    this.dataType = config.dataType || 'number'; // 'number', 'time', 'category'
    
    // NEW: Coordinate system configuration
    this.coordinateSystem = config.coordinateSystem || 'normalized'; // 'normalized', 'canvas', 'webgl'
    this.orientation = config.orientation || 'horizontal'; // 'horizontal' for x-axis, 'vertical' for y-axis
    
    // Options
    this.options = {
      nice: false,
      padding: 0,
      clamp: true,
      ...config.options
    };
    
    // Internal state
    this._domainExtent = null;
    this._rangeExtent = null;
    
    this._updateInternalState();
  }
  
  /**
   * Update internal calculations
   */
  _updateInternalState() {
    this._domainExtent = this.domain[1] - this.domain[0];
    this._rangeExtent = this.range[1] - this.range[0];
  }
  
  /**
   * Scale a data value to pixel position (forward transform)
   * NOW RENDERER-AGNOSTIC: Always produces consistent output regardless of target renderer
   */
  scale(value) {
    if (value == null || isNaN(value)) {
      return null;
    }
    
    let normalizedValue;
    
    switch (this.type) {
      case 'linear':
        normalizedValue = this._linearScale(value);
        break;
      case 'log':
        normalizedValue = this._logScale(value);
        break;
      case 'time':
        normalizedValue = this._timeScale(value);
        break;
      case 'ordinal':
        normalizedValue = this._ordinalScale(value);
        break;
      default:
        normalizedValue = this._linearScale(value);
    }
    
    // Clamp if requested
    if (this.options.clamp) {
      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
    }
    
    // Convert to pixel range using RENDERER-AGNOSTIC coordinate system
    return this._convertToPixelRange(normalizedValue);
  }
  
  /**
   * Convert normalized value to pixel range (renderer-agnostic)
   * This replaces the old direct range conversion
   */
  _convertToPixelRange(normalizedValue) {
    if (this.coordinateSystem === 'normalized') {
      // For normalized coordinate system, always use bottom-up for Y-axis
      // This ensures consistent behavior regardless of renderer
      if (this.orientation === 'vertical') {
        // Y-axis: 0 at bottom, 1 at top (mathematical coordinate system)
        return this.range[0] + (1 - normalizedValue) * this._rangeExtent;
      } else {
        // X-axis: 0 at left, 1 at right (standard left-to-right)
        return this.range[0] + normalizedValue * this._rangeExtent;
      }
    } else {
      // Legacy behavior for backward compatibility
      return this.range[0] + normalizedValue * this._rangeExtent;
    }
  }
  
  /**
   * Scale a pixel position back to data value (inverse transform)
   */
  invert(pixel) {
    if (pixel == null || isNaN(pixel)) {
      return null;
    }
    
    // Convert pixel to normalized value (0-1) using renderer-agnostic system
    const normalizedValue = this._convertFromPixelRange(pixel);
    
    // Clamp if requested
    const clampedValue = this.options.clamp ? 
      Math.max(0, Math.min(1, normalizedValue)) : 
      normalizedValue;
    
    switch (this.type) {
      case 'linear':
        return this._linearInvert(clampedValue);
      case 'log':
        return this._logInvert(clampedValue);
      case 'time':
        return this._timeInvert(clampedValue);
      case 'ordinal':
        return this._ordinalInvert(clampedValue);
      default:
        return this._linearInvert(clampedValue);
    }
  }
  
  /**
   * Convert pixel range to normalized value (renderer-agnostic)
   */
  _convertFromPixelRange(pixel) {
    if (this.coordinateSystem === 'normalized') {
      if (this.orientation === 'vertical') {
        // Y-axis: Reverse the transformation applied in _convertToPixelRange
        const rawNormalized = (pixel - this.range[0]) / this._rangeExtent;
        return 1 - rawNormalized; // Flip back to mathematical coordinate system
      } else {
        // X-axis: Standard left-to-right
        return (pixel - this.range[0]) / this._rangeExtent;
      }
    } else {
      // Legacy behavior
      return (pixel - this.range[0]) / this._rangeExtent;
    }
  }
  
  /**
   * Update the domain (data range)
   */
  setDomain(newDomain) {
    this.domain = [...newDomain];
    this._updateInternalState();
    return this;
  }
  
  /**
   * Update the range (pixel range)
   */
  setRange(newRange) {
    this.range = [...newRange];
    this._updateInternalState();
    return this;
  }
  
  /**
   * NEW: Set coordinate system and orientation
   */
  setCoordinateSystem(coordinateSystem, orientation) {
    this.coordinateSystem = coordinateSystem;
    if (orientation) {
      this.orientation = orientation;
    }
    return this;
  }
  
  /**
   * Get ticks for this scale
   */
  getTicks(count = 'auto') {
    const tickCount = count === 'auto' ? this._getOptimalTickCount() : count;
    
    switch (this.type) {
      case 'linear':
        return this._getLinearTicks(tickCount);
      case 'log':
        return this._getLogTicks(tickCount);
      case 'time':
        return this._getTimeTicks(tickCount);
      case 'ordinal':
        return this._getOrdinalTicks();
      default:
        return this._getLinearTicks(tickCount);
    }
  }
  
  /**
   * Copy this scale with new configuration
   */
  copy(newConfig = {}) {
    return new Scale({
      type: this.type,
      domain: [...this.domain],
      range: [...this.range],
      dataType: this.dataType,
      coordinateSystem: this.coordinateSystem,
      orientation: this.orientation,
      options: { ...this.options },
      ...newConfig
    });
  }
  
  // ========================================================================
  // PRIVATE SCALING METHODS (unchanged)
  // ========================================================================
  
  /**
   * Linear scaling (default)
   */
  _linearScale(value) {
    return (value - this.domain[0]) / this._domainExtent;
  }
  
  _linearInvert(normalizedValue) {
    return this.domain[0] + normalizedValue * this._domainExtent;
  }
  
  /**
   * Logarithmic scaling
   */
  _logScale(value) {
    if (value <= 0) return 0; // Handle non-positive values
    
    const logDomainMin = Math.log(Math.max(this.domain[0], 1e-10));
    const logDomainMax = Math.log(this.domain[1]);
    const logValue = Math.log(value);
    
    return (logValue - logDomainMin) / (logDomainMax - logDomainMin);
  }
  
  _logInvert(normalizedValue) {
    const logDomainMin = Math.log(Math.max(this.domain[0], 1e-10));
    const logDomainMax = Math.log(this.domain[1]);
    
    return Math.exp(logDomainMin + normalizedValue * (logDomainMax - logDomainMin));
  }
  
  /**
   * Time scaling (treats values as timestamps)
   */
  _timeScale(value) {
    // Time is essentially linear scaling with timestamp values
    return this._linearScale(value);
  }
  
  _timeInvert(normalizedValue) {
    return this._linearInvert(normalizedValue);
  }
  
  /**
   * Ordinal/categorical scaling
   */
  _ordinalScale(value) {
    // For ordinal, domain should be an array of categories
    const index = this.domain.indexOf(value);
    if (index === -1) return 0;
    
    return index / (this.domain.length - 1);
  }
  
  _ordinalInvert(normalizedValue) {
    const index = Math.round(normalizedValue * (this.domain.length - 1));
    return this.domain[index] || this.domain[0];
  }
  
  // ========================================================================
  // TICK GENERATION
  // ========================================================================
  
  /**
   * Generate linear ticks - SIMPLIFIED for no-padding mode
   */
  _getLinearTicks(count) {
    const [min, max] = this.domain;
    const range = max - min;
    
    // ✅ SIMPLE APPROACH: If nice numbers disabled, use simple even spacing
    if (!this.options.nice) {
      const ticks = [];
      for (let i = 0; i < count; i++) {
        const ratio = i / (count - 1);
        const value = min + ratio * range;
        ticks.push({
          value: value,
          position: this.scale(value)
        });
      }
      return ticks;
    }
    
    // Original complex nice number logic for when nice: true
    const roughStep = range / (count - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;
    
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;
    
    const step = niceStep * magnitude;
    
    // Generate tick values
    const ticks = [];
    const start = Math.ceil(min / step) * step;
    
    for (let value = start; value <= max + step * 0.001; value += step) {
      ticks.push({
        value: value,
        position: this.scale(value)
      });
    }
    
    return ticks;
  }
  
  /**
   * Generate logarithmic ticks
   */
  _getLogTicks(count) {
    const [min, max] = this.domain;
    const logMin = Math.log10(Math.max(min, 1e-10));
    const logMax = Math.log10(max);
    
    const ticks = [];
    const step = (logMax - logMin) / (count - 1);
    
    for (let i = 0; i < count; i++) {
      const logValue = logMin + i * step;
      const value = Math.pow(10, logValue);
      
      ticks.push({
        value: value,
        position: this.scale(value)
      });
    }
    
    return ticks;
  }
  
  /**
   * Generate time ticks - SIMPLIFIED for no-padding mode
   */
  _getTimeTicks(count) {
    const [minTime, maxTime] = this.domain;
    
    // ✅ SIMPLE APPROACH: If nice numbers disabled, use simple even spacing
    if (!this.options.nice) {
      const ticks = [];
      const timeRange = maxTime - minTime;
      
      for (let i = 0; i < count; i++) {
        const ratio = i / (count - 1);
        const timestamp = minTime + ratio * timeRange;
        ticks.push({
          value: timestamp,
          position: this.scale(timestamp)
        });
      }
      return ticks;
    }
    
    // Original complex time interval logic for when nice: true
    const timeRange = maxTime - minTime;
    
    // Determine appropriate time interval
    const intervals = [
      { label: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
      { label: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
      { label: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
      { label: 'day', ms: 24 * 60 * 60 * 1000 },
      { label: 'hour', ms: 60 * 60 * 1000 },
      { label: 'minute', ms: 60 * 1000 }
    ];
    
    const targetInterval = timeRange / count;
    const interval = intervals.find(int => int.ms <= targetInterval) || intervals[intervals.length - 1];
    
    // Generate time ticks
    const ticks = [];
    const start = new Date(minTime);
    
    // Round start to nice boundary
    if (interval.label === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (interval.label === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (interval.label === 'day') {
      start.setHours(0, 0, 0, 0);
    }
    
    let current = new Date(start);
    while (current.getTime() <= maxTime) {
      const timestamp = current.getTime();
      ticks.push({
        value: timestamp,
        position: this.scale(timestamp)
      });
      
      // Increment by interval
      if (interval.label === 'year') {
        current.setFullYear(current.getFullYear() + 1);
      } else if (interval.label === 'month') {
        current.setMonth(current.getMonth() + 1);
      } else {
        current = new Date(current.getTime() + interval.ms);
      }
    }
    
    return ticks;
  }
  
  /**
   * Generate ordinal ticks
   */
  _getOrdinalTicks() {
    return this.domain.map((category, index) => ({
      value: category,
      position: this.scale(category)
    }));
  }
  
  /**
   * Make domain "nice" by rounding to clean numbers
   */
  _makeNice() {
    // Prevent recursion
    if (this._nicingInProgress) return;
    this._nicingInProgress = true;
    
    const [min, max] = this.domain;
    const range = max - min;
    
    if (range === 0) {
      this._nicingInProgress = false;
      return;
    }
    
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    const normalizedRange = range / magnitude;
    
    let niceRange;
    if (normalizedRange <= 1) niceRange = 1;
    else if (normalizedRange <= 2) niceRange = 2;
    else if (normalizedRange <= 5) niceRange = 5;
    else niceRange = 10;
    
    const step = niceRange * magnitude / 10; // Subdivide for nice bounds
    
    this.domain[0] = Math.floor(min / step) * step;
    this.domain[1] = Math.ceil(max / step) * step;
    
    // Update internal state manually without triggering nice again
    this._domainExtent = this.domain[1] - this.domain[0];
    this._nicingInProgress = false;
  }
  
  /**
   * Get optimal tick count based on range size - REDUCED for cleaner axes
   */
  _getOptimalTickCount() {
    const rangeSize = Math.abs(this._rangeExtent);
    
    // ✅ REDUCED TICK COUNTS for cleaner axes
    if (rangeSize < 100) return 2;
    if (rangeSize < 200) return 3;
    if (rangeSize < 400) return 4;
    if (rangeSize < 600) return 5;
    return 6;  // Maximum 6 ticks instead of 12
  }
}

/**
 * Utility function to create renderer-agnostic scales
 */
export function createScale(type, domain, range, options = {}) {
  return new Scale({
    type,
    domain,
    range,
    coordinateSystem: 'normalized', // Default to normalized coordinate system
    ...options
  });
}

/**
 * Scale Manager - manages multiple scales for a chart
 */
export class ScaleManager {
  constructor() {
    this.scales = new Map();
  }
  
  /**
   * Add or update a scale
   */
  setScale(name, scale) {
    this.scales.set(name, scale);
    return this;
  }
  
  /**
   * Get a scale by name
   */
  getScale(name) {
    return this.scales.get(name);
  }
  
  /**
   * Remove a scale
   */
  removeScale(name) {
    return this.scales.delete(name);
  }
  
  /**
   * Get all scale names
   */
  getScaleNames() {
    return Array.from(this.scales.keys());
  }
  
  /**
   * Clear all scales
   */
  clear() {
    this.scales.clear();
  }

    /**
   * Create a new scale instance
   */
  createScale(type, config = {}) {
    const scale = new Scale({
      type: type,
      coordinateSystem: 'normalized', // Default to normalized
      ...config
    });
    
    return scale;
  }
}
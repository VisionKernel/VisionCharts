export class Scale {
  constructor(config = {}) {
    this.type = config.type || 'linear';
    this.domain = config.domain || [0, 1];
    this.range = config.range || [0, 100];
    this.dataType = config.dataType || 'number';
    this.coordinateSystem = config.coordinateSystem || 'normalized';
    this.orientation = config.orientation || 'horizontal';
    this.options = {
      nice: false,
      padding: 0,
      clamp: true,
      ...config.options
    };
    this._domainExtent = null;
    this._rangeExtent = null;
    this._updateInternalState();
  }

  _updateInternalState() {
    this._domainExtent = this.domain[1] - this.domain[0];
    this._rangeExtent = this.range[1] - this.range[0];
  }

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

    if (this.options.clamp) {
      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
    }

    return this._convertToPixelRange(normalizedValue);
  }

  _convertToPixelRange(normalizedValue) {
    if (this.coordinateSystem === 'normalized') {
      if (this.orientation === 'vertical') {
        if (this._rangeExtent < 0) {
          return this.range[0] + normalizedValue * this._rangeExtent;
        } else {
          return this.range[0] + (1 - normalizedValue) * this._rangeExtent;
        }
      } else {
        return this.range[0] + normalizedValue * this._rangeExtent;
      }
    } else {
      return this.range[0] + normalizedValue * this._rangeExtent;
    }
  }

  invert(pixel) {
    if (pixel == null || isNaN(pixel)) {
      return null;
    }

    const normalizedValue = this._convertFromPixelRange(pixel);

    const clampedValue = this.options.clamp
      ? Math.max(0, Math.min(1, normalizedValue))
      : normalizedValue;

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

  _convertFromPixelRange(pixel) {
    if (this.coordinateSystem === 'normalized') {
      if (this.orientation === 'vertical') {
        const rawNormalized = (pixel - this.range[0]) / this._rangeExtent;
        if (this._rangeExtent < 0) {
          return rawNormalized;
        } else {
          return 1 - rawNormalized;
        }
      } else {
        return (pixel - this.range[0]) / this._rangeExtent;
      }
    } else {
      return (pixel - this.range[0]) / this._rangeExtent;
    }
  }

  setDomain(newDomain) {
    this.domain = [...newDomain];
    this._updateInternalState();
    return this;
  }

  setRange(newRange) {
    this.range = [...newRange];
    this._updateInternalState();
    return this;
  }

  setCoordinateSystem(coordinateSystem, orientation) {
    this.coordinateSystem = coordinateSystem;
    if (orientation) {
      this.orientation = orientation;
    }
    return this;
  }

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

  _linearScale(value) {
    return (value - this.domain[0]) / this._domainExtent;
  }

  _linearInvert(normalizedValue) {
    return this.domain[0] + normalizedValue * this._domainExtent;
  }

  _logScale(value) {
    if (value <= 0) return 0;
    const logDomainMin = Math.log10(Math.max(this.domain[0], 1e-10));
    const logDomainMax = Math.log10(this.domain[1]);
    const logValue = Math.log10(value);
    return (logValue - logDomainMin) / (logDomainMax - logDomainMin);
  }

  _logInvert(normalizedValue) {
    const logDomainMin = Math.log10(Math.max(this.domain[0], 1e-10));
    const logDomainMax = Math.log10(this.domain[1]);
    return Math.pow(10, logDomainMin + normalizedValue * (logDomainMax - logDomainMin));
  }

  _timeScale(value) {
    return this._linearScale(value);
  }

  _timeInvert(normalizedValue) {
    return this._linearInvert(normalizedValue);
  }

  _ordinalScale(value) {
    const index = this.domain.indexOf(value);
    if (index === -1) return 0;
    return index / (this.domain.length - 1);
  }

  _ordinalInvert(normalizedValue) {
    const index = Math.round(normalizedValue * (this.domain.length - 1));
    return this.domain[index] || this.domain[0];
  }

  _getLinearTicks(count) {
    const [min, max] = this.domain;
    const range = max - min;

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

    const roughStep = range / (count - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;

    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
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

  _getTimeTicks(count) {
    const [minTime, maxTime] = this.domain;

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

    const timeRange = maxTime - minTime;
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
    const ticks = [];
    const start = new Date(minTime);

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

  _getOrdinalTicks() {
    return this.domain.map((category, index) => ({
      value: category,
      position: this.scale(category)
    }));
  }

  _makeNice() {
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

    const step = (niceRange * magnitude) / 10;
    this.domain[0] = Math.floor(min / step) * step;
    this.domain[1] = Math.ceil(max / step) * step;
    this._domainExtent = this.domain[1] - this.domain[0];
    this._nicingInProgress = false;
  }

  _getOptimalTickCount() {
    const rangeSize = Math.abs(this._rangeExtent);
    if (rangeSize < 100) return 2;
    if (rangeSize < 200) return 3;
    if (rangeSize < 400) return 4;
    if (rangeSize < 600) return 5;
    return 6;
  }
}

export function createScale(type, domain, range, options = {}) {
  return new Scale({
    type,
    domain,
    range,
    coordinateSystem: 'normalized',
    ...options
  });
}

export class ScaleManager {
  constructor() {
    this.scales = new Map();
  }

  setScale(name, scale) {
    this.scales.set(name, scale);
    return this;
  }

  getScale(name) {
    return this.scales.get(name);
  }

  removeScale(name) {
    return this.scales.delete(name);
  }

  getScaleNames() {
    return Array.from(this.scales.keys());
  }

  clear() {
    this.scales.clear();
  }

  createScale(type, config = {}) {
    const scale = new Scale({
      type: type,
      coordinateSystem: 'normalized',
      ...config
    });
    return scale;
  }
}

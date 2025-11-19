export class Axis {
  constructor(config = {}) {
    this.orientation = config.orientation || 'x';
    this.scale = config.scale;

    if (!this.scale) {
      throw new Error('Axis requires a Scale instance');
    }

    this.options = {
      label: config.label || '',
      tickCount: config.tickCount || 'auto',
      tickSize: config.tickSize || 6,
      tickPadding: config.tickPadding || 8,
      fontSize: config.fontSize || 12,
      fontFamily: config.fontFamily || 'Arial, sans-serif',
      color: config.color || '#333',
      strokeWidth: config.strokeWidth || 1,
      showTicks: config.showTicks !== false,
      showTickLabels: config.showTickLabels !== false,
      showAxisLine: config.showAxisLine !== false,
      ...config.options
    };

    this.ticks = [];
    this.svgGroup = null;
  }

  calculateTicks() {
    const tickCount = this._getOptimalTickCount();
    const scaleTicks = this.scale.getTicks(tickCount);
    this.ticks = scaleTicks.map(tick => ({
      value: tick.value,
      position: tick.position,
      label: this._formatTickLabel(tick.value)
    }));
    return this.ticks;
  }

  render(svgParent, position) {
    if (this.svgGroup) {
      this.svgGroup.remove();
    }

    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', `axis axis-${this.orientation}`);

    this.calculateTicks();
    this._setAxisTransform(position);

    if (this.options.showAxisLine) {
      this._renderAxisLine();
    }

    if (this.options.showTicks && this.options.showTickLabels) {
      this._renderTicks();
    }

    this._renderAxisLabel(position);

    svgParent.appendChild(this.svgGroup);

    return this.svgGroup;
  }

  updateScale(newScale) {
    this.scale = newScale;
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }

  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }

  update(newConfig = {}) {
    if (newConfig.scale) {
      this.scale = newConfig.scale;
    }
    if (newConfig.options) {
      Object.assign(this.options, newConfig.options);
    }

    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }
    return this;
  }

  _setAxisTransform(position) {
    if (this.orientation === 'x') {
      this.svgGroup.setAttribute('transform', `translate(0, ${position.y})`);
    } else {
      this.svgGroup.setAttribute('transform', `translate(${position.x}, 0)`);
    }
  }

  _renderAxisLine() {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const range = this.scale.range;

    if (this.orientation === 'x') {
      line.setAttribute('x1', range[0]);
      line.setAttribute('x2', range[1]);
      line.setAttribute('y1', 0);
      line.setAttribute('y2', 0);
    } else {
      line.setAttribute('x1', 0);
      line.setAttribute('x2', 0);
      line.setAttribute('y1', range[0]);
      line.setAttribute('y2', range[1]);
    }

    line.setAttribute('stroke', this.options.color);
    line.setAttribute('stroke-width', this.options.strokeWidth);
    line.setAttribute('fill', 'none');

    this.svgGroup.appendChild(line);
  }

  _renderTicks() {
    this.ticks.forEach(tick => {
      if (this.options.showTicks) {
        this._renderTickMark(tick);
      }
      if (this.options.showTickLabels) {
        this._renderTickLabel(tick);
      }
    });
  }

  _renderTickMark(tick) {
    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    if (this.orientation === 'x') {
      tickLine.setAttribute('x1', tick.position);
      tickLine.setAttribute('x2', tick.position);
      tickLine.setAttribute('y1', 0);
      tickLine.setAttribute('y2', this.options.tickSize);
    } else {
      tickLine.setAttribute('x1', -this.options.tickSize);
      tickLine.setAttribute('x2', 0);
      tickLine.setAttribute('y1', tick.position);
      tickLine.setAttribute('y2', tick.position);
    }

    tickLine.setAttribute('stroke', this.options.color);
    tickLine.setAttribute('stroke-width', this.options.strokeWidth);

    this.svgGroup.appendChild(tickLine);
  }

  _renderTickLabel(tick) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    if (this.orientation === 'x') {
      label.setAttribute('x', tick.position);
      label.setAttribute('y', this.options.tickSize + this.options.tickPadding + this.options.fontSize);
      label.setAttribute('text-anchor', 'middle');
    } else {
      label.setAttribute('x', -(this.options.tickSize + this.options.tickPadding));
      label.setAttribute('y', tick.position + this.options.fontSize / 3);
      label.setAttribute('text-anchor', 'end');
    }

    label.setAttribute('font-size', this.options.fontSize);
    label.setAttribute('font-family', this.options.fontFamily);
    label.setAttribute('fill', this.options.color);
    label.textContent = tick.label;

    this.svgGroup.appendChild(label);
  }

  _renderAxisLabel(position) {
    if (!this.options.label) return;

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const range = this.scale.range;

    if (this.orientation === 'x') {
      const centerX = (range[0] + range[1]) / 2;
      label.setAttribute('x', centerX);
      label.setAttribute('y', this.options.tickSize + this.options.tickPadding + this.options.fontSize + 20);
      label.setAttribute('text-anchor', 'middle');
    } else {
      const centerY = (range[0] + range[1]) / 2;
      label.setAttribute('x', -(this.options.tickSize + this.options.tickPadding + 40));
      label.setAttribute('y', centerY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('transform', `rotate(-90, ${-(this.options.tickSize + this.options.tickPadding + 40)}, ${centerY})`);
    }

    label.setAttribute('font-size', this.options.fontSize + 2);
    label.setAttribute('font-family', this.options.fontFamily);
    label.setAttribute('font-weight', '600');
    label.setAttribute('fill', this.options.color);
    label.textContent = this.options.label;

    this.svgGroup.appendChild(label);
  }

  _formatTickLabel(value) {
    if (this.scale.type === 'time') {
      return this._formatTimeValue(value);
    }

    if (this.orientation === 'y' && this.options.abbreviateLabels) {
      return this._formatAbbreviatedNumber(value);
    }

    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      } else if (value % 1 === 0) {
        return value.toString();
      } else {
        return value.toFixed(2);
      }
    }

    return value.toString();
  }

  _formatAbbreviatedNumber(value) {
    if (typeof value !== 'number') return value.toString();

    const absValue = Math.abs(value);

    if (absValue >= 1e9) {
      return (value / 1e9).toFixed(1) + 'B';
    } else if (absValue >= 1e6) {
      return (value / 1e6).toFixed(1) + 'M';
    } else if (absValue >= 1e3) {
      return (value / 1e3).toFixed(1) + 'K';
    } else if (absValue >= 1) {
      return value.toFixed(0);
    } else if (absValue >= 0.01) {
      return value.toFixed(2);
    } else {
      return value.toExponential(1);
    }
  }

  _formatTimeValue(timestamp) {
    const date = new Date(timestamp);
    const range = this.scale.domain;
    const timeSpan = range[1] - range[0];

    if (timeSpan < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (timeSpan < 365 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } else {
      return date.getFullYear().toString();
    }
  }

  _formatLogLabel(value) {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (value >= 1) {
      return value.toFixed(0);
    } else {
      return value.toExponential(1);
    }
  }

  _formatNumericLabel(value) {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (value % 1 === 0) {
      return value.toString();
    } else {
      return value.toFixed(2);
    }
  }

  _getOptimalTickCount() {
    if (this.options.tickCount !== 'auto') {
      return this.options.tickCount;
    }

    const range = this.scale.range;
    const rangeSize = Math.abs(range[1] - range[0]);

    if (this.orientation === 'x') {
      const minSpacing = 80;
      return Math.max(2, Math.floor(rangeSize / minSpacing));
    } else {
      const minSpacing = this.options.fontSize * 3;
      const maxTicks = 5;
      const calculatedTicks = Math.max(2, Math.floor(rangeSize / minSpacing));
      return Math.min(maxTicks, calculatedTicks);
    }
  }

  _getCurrentPosition() {
    if (this.svgGroup) {
      const transform = this.svgGroup.getAttribute('transform');
      if (transform) {
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  renderSharedXAxis(svgParent, position, panels = []) {
    if (this.orientation !== 'x') {
      return this.render(svgParent, position);
    }

    if (!svgParent || !position) {
      return;
    }

    if (this.svgGroup) {
      this.svgGroup.remove();
    }

    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', `axis axis-${this.orientation} shared-axis visioncharts-shared-x-axis`);

    this.calculateTicks();
    this._setAxisTransform(position);

    if (this.options.showAxisLine) {
      this._renderAxisLine();
      const axisLine = this.svgGroup.querySelector('line');
      if (axisLine) {
        axisLine.setAttribute('stroke-width', '1.5');
        axisLine.setAttribute('stroke', this.options.color || '#666');
      }
    }

    if (this.options.showTicks && this.options.showTickLabels) {
      this._renderTicks();
    }

    this._renderSharedAxisLabel(position);

    svgParent.appendChild(this.svgGroup);

    return this.svgGroup;
  }

  _renderSharedAxisLabel(position) {
    if (!this.options.label) return;

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const range = this.scale.range;

    if (this.orientation === 'x') {
      label.setAttribute('x', (range[0] + range[1]) / 2);
      label.setAttribute('y', position.y + 45);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'hanging');
    } else {
      label.setAttribute('x', position.x - 40);
      label.setAttribute('y', (range[0] + range[1]) / 2);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('transform', `rotate(-90, ${position.x - 40}, ${(range[0] + range[1]) / 2})`);
    }

    label.style.fontSize = `${this.options.fontSize + 1}px`;
    label.style.fontFamily = this.options.fontFamily || 'Arial, sans-serif';
    label.style.fontWeight = '600';
    label.style.fill = this.options.color || '#444';
    label.textContent = this.options.label;
    label.setAttribute('class', 'visioncharts-shared-axis-label');

    this.svgGroup.appendChild(label);
  }

  static createPanelYAxis(config = {}) {
    const panelOptions = {
      tickCount: 3,
      fontSize: 10,
      tickPadding: 6,
      showAxisLine: false,
      ...config.options
    };

    return new Axis({
      orientation: 'y',
      scale: config.scale,
      options: panelOptions
    });
  }

  static createSharedXAxis(config = {}) {
    const sharedOptions = {
      tickCount: 'auto',
      fontSize: 11,
      tickPadding: 8,
      showAxisLine: true,
      showTicks: true,
      showTickLabels: true,
      color: '#666',
      fontFamily: 'Arial, sans-serif',
      abbreviateLabels: false,
      ...config.options
    };

    return new Axis({
      orientation: 'x',
      scale: config.scale,
      options: sharedOptions
    });
  }

  updateForPanelMode(isPanelMode, isSharedAxis = false) {
    if (isPanelMode) {
      if (this.orientation === 'y') {
        this.options.tickCount = 3;
        this.options.fontSize = 10;
        this.options.abbreviateLabels = true;
        this.options.showAxisLine = false;
      } else if (isSharedAxis) {
        this.options.fontSize = 11;
        this.options.tickPadding = 10;
      }
    } else {
      this.options.tickCount = 'auto';
      this.options.fontSize = 12;
      this.options.abbreviateLabels = false;
      this.options.showAxisLine = true;
      this.options.tickPadding = 8;
    }

    if (this.svgGroup && this.svgGroup.parentNode) {
      const parent = this.svgGroup.parentNode;
      const position = this._getCurrentPosition();
      this.render(parent, position);
    }

    return this;
  }
}

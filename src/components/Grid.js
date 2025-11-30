export class Grid {
  constructor(config = {}) {
    this.themeManager = config.themeManager || null;
    
    const themeGridColor = this.themeManager?.getColor('grid') || '#e0e0e0';

    this.scales = {
      x: config.xScale || null,
      y: config.yScale || null
    };

    this.chartArea = config.chartArea || { x: 0, y: 0, width: 400, height: 300 };

    this.options = {
      showXGrid: config.showXGrid !== false,
      showYGrid: config.showYGrid !== false,
      xGridColor: config.xGridColor || themeGridColor,
      xGridWidth: config.xGridWidth || 1,
      xGridOpacity: config.xGridOpacity || 1,
      xGridDash: config.xGridDash || [],
      yGridColor: config.yGridColor || themeGridColor,
      yGridWidth: config.yGridWidth || 1,
      yGridOpacity: config.yGridOpacity || 1,
      yGridDash: config.yGridDash || [],
      xTickCount: config.xTickCount || 'auto',
      yTickCount: config.yTickCount || 'auto',
      skipEdgeLines: config.skipEdgeLines !== false,
      ...config.options
    };

    this.xTicks = [];
    this.yTicks = [];
  }

  updateScales(xScale, yScale) {
    this.scales.x = xScale;
    this.scales.y = yScale;
    return this;
  }

  updateChartArea(chartArea) {
    this.chartArea = chartArea;
    return this;
  }

  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    return this;
  }

  calculateGridLines() {
    this.xTicks = [];
    this.yTicks = [];

    if (this.options.showXGrid && this.scales.x) {
      const tickCount =
        this.options.xTickCount === 'auto' ? this._getOptimalTickCount('x') : this.options.xTickCount;

      const scaleTicks = this.scales.x.getTicks(tickCount);

      this.xTicks = scaleTicks
        .filter(tick => this._shouldIncludeTick(tick, 'x'))
        .map(tick => ({
          value: tick.value,
          position: tick.position
        }));
    }

    if (this.options.showYGrid && this.scales.y) {
      const tickCount =
        this.options.yTickCount === 'auto' ? this._getOptimalTickCount('y') : this.options.yTickCount;

      const scaleTicks = this.scales.y.getTicks(tickCount);

      this.yTicks = scaleTicks
        .filter(tick => this._shouldIncludeTick(tick, 'y'))
        .map(tick => ({
          value: tick.value,
          position: tick.position
        }));
    }

    return { xTicks: this.xTicks, yTicks: this.yTicks };
  }

  render(ctx) {
    if (!ctx) {
      return;
    }

    this.calculateGridLines();

    ctx.save();

    ctx.beginPath();
    ctx.rect(this.chartArea.x, this.chartArea.y, this.chartArea.width, this.chartArea.height);
    ctx.clip();

    if (this.options.showXGrid) {
      this._renderXGridLines(ctx);
    }

    if (this.options.showYGrid) {
      this._renderYGridLines(ctx);
    }

    ctx.restore();
  }

  _renderXGridLines(ctx) {
    if (!this.xTicks.length) return;

    ctx.strokeStyle = this.options.xGridColor;
    ctx.lineWidth = this.options.xGridWidth;
    ctx.globalAlpha = this.options.xGridOpacity;

    if (this.options.xGridDash.length > 0) {
      ctx.setLineDash(this.options.xGridDash);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();

    this.xTicks.forEach(tick => {
      const x = tick.position;

      if (x >= this.chartArea.x && x <= this.chartArea.x + this.chartArea.width) {
        ctx.moveTo(x, this.chartArea.y);
        ctx.lineTo(x, this.chartArea.y + this.chartArea.height);
      }
    });

    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  _renderYGridLines(ctx) {
    if (!this.yTicks.length) return;

    ctx.strokeStyle = this.options.yGridColor;
    ctx.lineWidth = this.options.yGridWidth;
    ctx.globalAlpha = this.options.yGridOpacity;

    if (this.options.yGridDash.length > 0) {
      ctx.setLineDash(this.options.yGridDash);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();

    this.yTicks.forEach(tick => {
      const y = tick.position;

      if (y >= this.chartArea.y && y <= this.chartArea.y + this.chartArea.height) {
        ctx.moveTo(this.chartArea.x, y);
        ctx.lineTo(this.chartArea.x + this.chartArea.width, y);
      }
    });

    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  _shouldIncludeTick(tick, orientation) {
    if (this.options.skipEdgeLines) {
      const scale = this.scales[orientation];
      const range = scale.range;
      const tolerance = 2;

      if (Math.abs(tick.position - range[0]) < tolerance || Math.abs(tick.position - range[1]) < tolerance) {
        return false;
      }
    }

    return true;
  }

  _getOptimalTickCount(orientation) {
    const chartArea = this.chartArea;

    if (orientation === 'x') {
      const width = chartArea.width;
      if (width < 200) return 4;
      if (width < 400) return 6;
      if (width < 600) return 8;
      return 10;
    } else {
      const height = chartArea.height;
      if (height < 150) return 3;
      if (height < 300) return 5;
      if (height < 450) return 7;
      return 8;
    }
  }

  toggleXGrid(show = null) {
    this.options.showXGrid = show !== null ? show : !this.options.showXGrid;
    return this.options.showXGrid;
  }

  toggleYGrid(show = null) {
    this.options.showYGrid = show !== null ? show : !this.options.showYGrid;
    return this.options.showYGrid;
  }

  setGridColor(color) {
    this.options.xGridColor = color;
    this.options.yGridColor = color;
    return this;
  }

  setGridOpacity(opacity) {
    this.options.xGridOpacity = opacity;
    this.options.yGridOpacity = opacity;
    return this;
  }

  setGridDash(dashArray) {
    this.options.xGridDash = dashArray;
    this.options.yGridDash = dashArray;
    return this;
  }

  copy(newOptions = {}) {
    return new Grid({
      xScale: this.scales.x,
      yScale: this.scales.y,
      chartArea: { ...this.chartArea },
      ...this.options,
      ...newOptions
    });
  }
}
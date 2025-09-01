/**
 * Grid.js - Canvas Grid Rendering
 * 
 * Renders grid lines on Canvas 2D using the unified Scale system for perfect
 * alignment with axes. Uses HYBRID RENDERING ARCHITECTURE:
 * 
 * - Grid: Always Canvas 2D (this component)
 * - Data: Canvas 2D (<50K points) or WebGL (50K+ points)  
 * - Axes: Always SVG
 * 
 * This ensures grid rendering is simple and reliable while data rendering
 * can scale to WebGL for performance without affecting grid compatibility.
 */

export class Grid {
  constructor(config = {}) {
    this.scales = {
      x: config.xScale || null,
      y: config.yScale || null
    };
    
    this.chartArea = config.chartArea || { x: 0, y: 0, width: 400, height: 300 };
    
    // Grid options
    this.options = {
      showXGrid: config.showXGrid !== false,
      showYGrid: config.showYGrid !== false,
      
      // X Grid styling
      xGridColor: config.xGridColor || '#e0e0e0',
      xGridWidth: config.xGridWidth || 1,
      xGridOpacity: config.xGridOpacity || 1,
      xGridDash: config.xGridDash || [], // [5, 5] for dashed lines
      
      // Y Grid styling  
      yGridColor: config.yGridColor || '#e0e0e0',
      yGridWidth: config.yGridWidth || 1,
      yGridOpacity: config.yGridOpacity || 1,
      yGridDash: config.yGridDash || [],
      
      // Tick overrides
      xTickCount: config.xTickCount || 'auto',
      yTickCount: config.yTickCount || 'auto',
      
      // Skip edge lines (often redundant with axes)
      skipEdgeLines: config.skipEdgeLines !== false,
      
      ...config.options
    };
    
    // Internal state
    this.xTicks = [];
    this.yTicks = [];
  }
  
  /**
   * Update scales (called when chart updates)
   */
  updateScales(xScale, yScale) {
    this.scales.x = xScale;
    this.scales.y = yScale;
    return this;
  }
  
  /**
   * Update chart area (called when chart resizes)
   */
  updateChartArea(chartArea) {
    this.chartArea = chartArea;
    return this;
  }
  
  /**
   * Update grid options
   */
  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    return this;
  }
  
  /**
   * Calculate grid line positions using scales
   */
  calculateGridLines() {
    this.xTicks = [];
    this.yTicks = [];
    
    // Get X grid lines
    if (this.options.showXGrid && this.scales.x) {
      const tickCount = this.options.xTickCount === 'auto' ? 
        this._getOptimalTickCount('x') : 
        this.options.xTickCount;
        
      const scaleTicks = this.scales.x.getTicks(tickCount);
      
      this.xTicks = scaleTicks
        .filter(tick => this._shouldIncludeTick(tick, 'x'))
        .map(tick => ({
          value: tick.value,
          position: tick.position
        }));
    }
    
    // Get Y grid lines
    if (this.options.showYGrid && this.scales.y) {
      const tickCount = this.options.yTickCount === 'auto' ? 
        this._getOptimalTickCount('y') : 
        this.options.yTickCount;
        
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
  
  /**
   * Render grid to canvas
   */
  render(ctx) {
    if (!ctx) {
      console.warn('Grid: No canvas context provided');
      return;
    }
    
    // Calculate grid lines
    this.calculateGridLines();
    
    // Save canvas state
    ctx.save();
    
    // Set up clipping to chart area
    ctx.beginPath();
    ctx.rect(this.chartArea.x, this.chartArea.y, this.chartArea.width, this.chartArea.height);
    ctx.clip();
    
    // Render X grid lines (vertical)
    if (this.options.showXGrid) {
      this._renderXGridLines(ctx);
    }
    
    // Render Y grid lines (horizontal)
    if (this.options.showYGrid) {
      this._renderYGridLines(ctx);
    }
    
    // Restore canvas state
    ctx.restore();
  }
  
  /**
   * Render vertical grid lines (X axis ticks)
   */
  _renderXGridLines(ctx) {
    if (!this.xTicks.length) return;
    
    // Set line style
    ctx.strokeStyle = this.options.xGridColor;
    ctx.lineWidth = this.options.xGridWidth;
    ctx.globalAlpha = this.options.xGridOpacity;
    
    // Set dash pattern if specified
    if (this.options.xGridDash.length > 0) {
      ctx.setLineDash(this.options.xGridDash);
    } else {
      ctx.setLineDash([]);
    }
    
    // Draw vertical lines
    ctx.beginPath();
    
    this.xTicks.forEach(tick => {
      const x = tick.position;
      
      // Check if line is within chart area
      if (x >= this.chartArea.x && x <= this.chartArea.x + this.chartArea.width) {
        ctx.moveTo(x, this.chartArea.y);
        ctx.lineTo(x, this.chartArea.y + this.chartArea.height);
      }
    });
    
    ctx.stroke();
    
    // Reset alpha and dash
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  
  /**
   * Render horizontal grid lines (Y axis ticks)
   */
  _renderYGridLines(ctx) {
    if (!this.yTicks.length) return;
    
    // Set line style
    ctx.strokeStyle = this.options.yGridColor;
    ctx.lineWidth = this.options.yGridWidth;
    ctx.globalAlpha = this.options.yGridOpacity;
    
    // Set dash pattern if specified
    if (this.options.yGridDash.length > 0) {
      ctx.setLineDash(this.options.yGridDash);
    } else {
      ctx.setLineDash([]);
    }
    
    // Draw horizontal lines
    ctx.beginPath();
    
    this.yTicks.forEach(tick => {
      const y = tick.position;
      
      // Check if line is within chart area
      if (y >= this.chartArea.y && y <= this.chartArea.y + this.chartArea.height) {
        ctx.moveTo(this.chartArea.x, y);
        ctx.lineTo(this.chartArea.x + this.chartArea.width, y);
      }
    });
    
    ctx.stroke();
    
    // Reset alpha and dash
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
  
  /**
   * Determine if a tick should be included in grid
   */
  _shouldIncludeTick(tick, orientation) {
    // Skip edge lines if requested
    if (this.options.skipEdgeLines) {
      const scale = this.scales[orientation];
      const range = scale.range;
      const tolerance = 2; // pixels
      
      // Skip if too close to edges
      if (Math.abs(tick.position - range[0]) < tolerance ||
          Math.abs(tick.position - range[1]) < tolerance) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get optimal tick count for grid lines
   */
  _getOptimalTickCount(orientation) {
    const chartArea = this.chartArea;
    
    if (orientation === 'x') {
      // Base on chart width
      const width = chartArea.width;
      if (width < 200) return 4;
      if (width < 400) return 6;
      if (width < 600) return 8;
      return 10;
    } else {
      // Base on chart height
      const height = chartArea.height;
      if (height < 150) return 3;
      if (height < 300) return 5;
      if (height < 450) return 7;
      return 8;
    }
  }
  
  /**
   * Toggle X grid visibility
   */
  toggleXGrid(show = null) {
    this.options.showXGrid = show !== null ? show : !this.options.showXGrid;
    return this.options.showXGrid;
  }
  
  /**
   * Toggle Y grid visibility
   */
  toggleYGrid(show = null) {
    this.options.showYGrid = show !== null ? show : !this.options.showYGrid;
    return this.options.showYGrid;
  }
  
  /**
   * Set grid color for both X and Y
   */
  setGridColor(color) {
    this.options.xGridColor = color;
    this.options.yGridColor = color;
    return this;
  }
  
  /**
   * Set grid opacity for both X and Y
   */
  setGridOpacity(opacity) {
    this.options.xGridOpacity = opacity;
    this.options.yGridOpacity = opacity;
    return this;
  }
  
  /**
   * Set grid dash pattern for both X and Y
   */
  setGridDash(dashArray) {
    this.options.xGridDash = dashArray;
    this.options.yGridDash = dashArray;
    return this;
  }
  
  /**
   * Create a copy of this grid with new options
   */
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
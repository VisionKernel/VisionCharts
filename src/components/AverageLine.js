/**
 * AverageLine - Enhanced multi-renderer average line component
 * 
 * Renders a horizontal line representing the average (mean) value of the dataset
 * with support for SVG, Canvas, and WebGL rendering backends.
 * 
 * Key Features:
 * - Multi-renderer support (SVG, Canvas, WebGL)
 * - Automatic renderer detection and optimization
 * - Configurable styling and positioning
 * - Optional labeling with smart positioning
 * - Performance optimized with caching
 */
export default class AverageLine {
  constructor(config = {}) {
    this.config = {
      // Line styling
      color: config.color || '#FF6B35',
      width: config.width || 2,
      opacity: config.opacity || 0.8,
      strokeDasharray: config.strokeDasharray || '5,5',
      className: config.className || 'visioncharts-average-line',
      
      // Label styling
      showLabel: config.showLabel !== false,
      labelText: config.labelText || 'Average',
      labelPosition: config.labelPosition || 'right', // 'left', 'center', 'right'
      labelOffset: config.labelOffset || { x: 5, y: -5 },
      labelStyle: {
        fontSize: config.labelStyle?.fontSize || '12px',
        fontFamily: config.labelStyle?.fontFamily || 'Arial, sans-serif',
        fill: config.labelStyle?.fill || config.color || '#FF6B35',
        fontWeight: config.labelStyle?.fontWeight || 'bold',
        textAnchor: config.labelStyle?.textAnchor || 'end',
        dominantBaseline: config.labelStyle?.dominantBaseline || 'middle',
        ...config.labelStyle
      },
      
      // Performance options
      enableCaching: config.enableCaching !== false,
      preciseDraw: config.preciseDraw !== false,
      
      // Multi-renderer options
      htmlOverlayForCanvas: config.htmlOverlayForCanvas !== false,
      webglFallbackToCanvas: config.webglFallbackToCanvas !== false
    };
    
    // Component state
    this.isInitialized = false;
    this.isVisible = false;
    this.currentRenderer = null;
    this.renderMode = 'svg'; // 'svg', 'canvas', 'webgl', 'html-overlay'
    
    // Calculated values
    this.averageValue = null;
    this.yPosition = null;
    this.chartDimensions = null;
    
    // Rendered elements (renderer-specific)
    this.renderedElements = [];
    this.elementId = `average-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // HTML overlay elements (for Canvas/WebGL)
    this.htmlOverlay = null;
    this.htmlContainer = null;
    
    // Performance tracking
    this.metrics = {
      renderCount: 0,
      lastRenderTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageRenderTime: 0
    };
    
    // Value cache for performance
    this.valueCache = new Map();
    this.maxCacheSize = 100;
    
    console.log('AverageLine component initialized with multi-renderer support');
  }

  // ===== CORE CALCULATION METHODS =====

  /**
   * Calculate the average value from dataset
   * @param {Array} data - Array of data points
   * @param {string} valueField - Field name containing the values (e.g., 'y', 'price', 'value')
   * @returns {number} - Average value
   */
  calculateAverage(data, valueField = 'y') {
    if (!data || data.length === 0) {
      return null;
    }

    // Check cache first
    const cacheKey = this._generateCacheKey(data, valueField);
    if (this.config.enableCaching && this.valueCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.valueCache.get(cacheKey);
    }

    // Calculate average
    const validValues = data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(v => v !== null);

    if (validValues.length === 0) {
      return null;
    }

    const sum = validValues.reduce((acc, val) => acc + val, 0);
    const average = sum / validValues.length;

    // Cache result
    this._cacheValue(cacheKey, average);
    this.metrics.cacheMisses++;

    return average;
  }

  // ===== MULTI-RENDERER METHODS =====

  /**
   * Initialize with renderer
   * @param {AbstractRenderer} renderer - The chart renderer
   * @param {HTMLElement} container - Chart container
   */
  initialize(renderer, container) {
    console.log('AverageLine.initialize called with renderer:', renderer.constructor.name);
    
    this.currentRenderer = renderer;
    this.htmlContainer = container;
    
    // Determine render mode based on renderer type
    this._determineRenderMode(renderer);
    
    // Initialize renderer-specific elements
    this._initializeForRenderer();
    
    this.isInitialized = true;
    console.log('AverageLine initialized in mode:', this.renderMode);
  }

  /**
   * Render the average line on the chart
   * @param {Object} chart - Chart instance containing scales and dimensions
   * @param {Array} data - Dataset to calculate average from
   * @param {string} valueField - Field name for values
   */
  async render(chart, data, valueField = 'y') {
    const startTime = performance.now();
    
    if (!this.isInitialized) {
      console.warn('AverageLine: Component not initialized');
      return this;
    }

    if (!chart || !chart.state || !chart.renderer) {
      console.warn('AverageLine: Invalid chart instance provided');
      return this;
    }

    // Remove existing average line
    this.remove();

    // Calculate average value
    this.averageValue = this.calculateAverage(data, valueField);
    
    if (this.averageValue === null || isNaN(this.averageValue)) {
      console.warn('AverageLine: Could not calculate valid average');
      return this;
    }

    // Get chart information
    const { scales, dimensions } = chart.state;
    const yScale = scales.y;
    
    if (!yScale) {
      console.warn('AverageLine: Y scale not found in chart');
      return this;
    }

    // Store chart dimensions
    this.chartDimensions = {
      width: dimensions.innerWidth,
      height: dimensions.innerHeight,
      margins: dimensions.margins || { top: 0, right: 0, bottom: 0, left: 0 }
    };
    
    // Convert average value to y coordinate using the scale
    this.yPosition = yScale.scale(this.averageValue);
    
    // Check if the average line is within the visible chart area
    if (this.yPosition < 0 || this.yPosition > this.chartDimensions.height) {
      console.warn('AverageLine: Average value is outside chart bounds', {
        yPosition: this.yPosition,
        chartHeight: this.chartDimensions.height,
        averageValue: this.averageValue
      });
      return this;
    }

    // Render using appropriate method based on renderer
    await this._renderForCurrentRenderer(chart);
    
    this.isVisible = true;
    
    // Update metrics
    const renderTime = performance.now() - startTime;
    this._updateMetrics(renderTime);
    
    console.log('AverageLine rendered successfully', {
      averageValue: this.averageValue,
      yPosition: this.yPosition,
      renderMode: this.renderMode,
      renderTime: renderTime.toFixed(2) + 'ms'
    });

    return this;
  }

  /**
   * Update the average line (recalculate and re-render)
   * @param {Object} chart - Chart instance
   * @param {Array} data - Updated dataset
   * @param {string} valueField - Field name for values
   */
  async update(chart, data, valueField = 'y') {
    console.log('AverageLine.update called');
    return this.render(chart, data, valueField);
  }

  /**
   * Remove the average line from the chart
   */
  remove() {
    console.log('AverageLine.remove called');
    
    // Remove rendered elements based on render mode
    switch (this.renderMode) {
      case 'svg':
        this._removeSVGElements();
        break;
        
      case 'canvas':
        this._removeCanvasElements();
        break;
        
      case 'webgl':
        this._removeWebGLElements();
        break;
        
      case 'html-overlay':
        this._removeHTMLOverlay();
        break;
    }
    
    // Reset state
    this.isVisible = false;
    this.renderedElements = [];
    this.averageValue = null;
    this.yPosition = null;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    console.log('AverageLine.updateConfig called');
    
    this.config = { ...this.config, ...newConfig };
    
    // If visible, re-render with new config
    if (this.isVisible && this.currentChart && this.currentData) {
      this.render(this.currentChart, this.currentData, this.currentValueField);
    }
  }

  // ===== RENDERER-SPECIFIC METHODS =====

  /**
   * Determine render mode based on renderer type
   * @private
   */
  _determineRenderMode(renderer) {
    const rendererName = renderer.constructor.name.toLowerCase();
    
    if (rendererName.includes('svg')) {
      this.renderMode = 'svg';
    } else if (rendererName.includes('canvas')) {
      this.renderMode = this.config.htmlOverlayForCanvas ? 'html-overlay' : 'canvas';
    } else if (rendererName.includes('webgl')) {
      this.renderMode = this.config.webglFallbackToCanvas ? 'canvas' : 'webgl';
    } else {
      // Fallback to SVG for unknown renderers
      this.renderMode = 'svg';
      console.warn('AverageLine: Unknown renderer type, falling back to SVG mode');
    }
    
    console.log('AverageLine render mode determined:', this.renderMode);
  }

  /**
   * Initialize renderer-specific elements
   * @private
   */
  _initializeForRenderer() {
    switch (this.renderMode) {
      case 'html-overlay':
        this._initializeHTMLOverlay();
        break;
        
      case 'svg':
      case 'canvas':
      case 'webgl':
        // No special initialization needed
        break;
    }
  }

  /**
   * Render for current renderer
   * @private
   */
  async _renderForCurrentRenderer(chart) {
    switch (this.renderMode) {
      case 'svg':
        await this._renderSVG(chart);
        break;
        
      case 'canvas':
        await this._renderCanvas(chart);
        break;
        
      case 'webgl':
        await this._renderWebGL(chart);
        break;
        
      case 'html-overlay':
        await this._renderHTMLOverlay(chart);
        break;
    }
  }

  /**
   * Render using SVG
   * @private
   */
  async _renderSVG(chart) {
    const renderer = chart.renderer;
    const { width } = this.chartDimensions;
    
    // Create line element
    const lineElement = await renderer.drawLine(
      0, this.yPosition,
      width, this.yPosition,
      {
        stroke: this.config.color,
        strokeWidth: this.config.width,
        strokeOpacity: this.config.opacity,
        strokeDasharray: this.config.strokeDasharray,
        className: `${this.config.className}-line`,
        pointerEvents: 'none'
      }
    );
    
    this.renderedElements.push(lineElement);
    
    // Add label if enabled
    if (this.config.showLabel) {
      const labelElement = await this._renderSVGLabel(chart, renderer);
      if (labelElement) {
        this.renderedElements.push(labelElement);
      }
    }
  }

  /**
   * Render using Canvas
   * @private
   */
  async _renderCanvas(chart) {
    const renderer = chart.renderer;
    const { width } = this.chartDimensions;
    
    // Set line styles
    await renderer.save();
    
    await renderer.applyStyles(null, {
      strokeStyle: this.config.color,
      lineWidth: this.config.width,
      globalAlpha: this.config.opacity,
      lineCap: 'butt'
    });
    
    // Set dash pattern if specified
    if (this.config.strokeDasharray) {
      const dashArray = this.config.strokeDasharray.split(',').map(Number);
      await renderer.setLineDash(dashArray);
    }
    
    // Draw line
    await renderer.beginPath();
    await renderer.moveTo(0, this.yPosition);
    await renderer.lineTo(width, this.yPosition);
    await renderer.stroke();
    
    await renderer.restore();
    
    // Add label if enabled
    if (this.config.showLabel) {
      await this._renderCanvasLabel(chart, renderer);
    }
  }

  /**
   * Render using WebGL
   * @private
   */
  async _renderWebGL(chart) {
    const renderer = chart.renderer;
    const { width } = this.chartDimensions;
    
    // Create line geometry
    const linePoints = [
      [0, this.yPosition],
      [width, this.yPosition]
    ];
    
    // Render line using WebGL
    await renderer.drawLine(
      linePoints[0][0], linePoints[0][1],
      linePoints[1][0], linePoints[1][1],
      {
        color: this.config.color,
        width: this.config.width,
        opacity: this.config.opacity,
        dashed: this.config.strokeDasharray !== 'none'
      }
    );
    
    // Add label if enabled (may fall back to HTML overlay)
    if (this.config.showLabel) {
      await this._renderWebGLLabel(chart, renderer);
    }
  }

  /**
   * Render using HTML overlay
   * @private
   */
  async _renderHTMLOverlay(chart) {
    if (!this.htmlOverlay) {
      this._initializeHTMLOverlay();
    }
    
    const { width } = this.chartDimensions;
    const containerRect = this.htmlContainer.getBoundingClientRect();
    
    // Create line element
    const lineDiv = document.createElement('div');
    lineDiv.className = `${this.config.className}-line`;
    lineDiv.style.cssText = `
      position: absolute;
      left: 0px;
      top: ${this.yPosition}px;
      width: ${width}px;
      height: ${this.config.width}px;
      background-color: ${this.config.color};
      opacity: ${this.config.opacity};
      pointer-events: none;
      ${this.config.strokeDasharray !== 'none' ? 
        `background-image: repeating-linear-gradient(
          to right,
          ${this.config.color} 0px,
          ${this.config.color} 5px,
          transparent 5px,
          transparent 10px
        );` : ''}
    `;
    
    this.htmlOverlay.appendChild(lineDiv);
    this.renderedElements.push(lineDiv);
    
    // Add label if enabled
    if (this.config.showLabel) {
      const labelDiv = this._createHTMLLabel();
      this.htmlOverlay.appendChild(labelDiv);
      this.renderedElements.push(labelDiv);
    }
  }

  // ===== LABEL RENDERING METHODS =====

  /**
   * Render SVG label
   * @private
   */
  async _renderSVGLabel(chart, renderer) {
    const { width } = this.chartDimensions;
    const labelText = `${this.config.labelText}: ${this.averageValue.toLocaleString()}`;
    
    let labelX, textAnchor;
    
    // Determine label position
    switch (this.config.labelPosition) {
      case 'left':
        labelX = Math.abs(this.config.labelOffset.x);
        textAnchor = 'start';
        break;
      case 'center':
        labelX = width / 2;
        textAnchor = 'middle';
        break;
      case 'right':
      default:
        labelX = width - Math.abs(this.config.labelOffset.x);
        textAnchor = 'end';
        break;
    }
    
    const labelY = this.yPosition + this.config.labelOffset.y;
    
    // Create text element
    return await renderer.drawText(
      labelText,
      labelX,
      labelY,
      {
        ...this.config.labelStyle,
        textAnchor,
        className: `${this.config.className}-label`
      }
    );
  }

  /**
   * Render Canvas label
   * @private
   */
  async _renderCanvasLabel(chart, renderer) {
    const { width } = this.chartDimensions;
    const labelText = `${this.config.labelText}: ${this.averageValue.toLocaleString()}`;
    
    let labelX;
    let textAlign;
    
    // Determine label position
    switch (this.config.labelPosition) {
      case 'left':
        labelX = Math.abs(this.config.labelOffset.x);
        textAlign = 'left';
        break;
      case 'center':
        labelX = width / 2;
        textAlign = 'center';
        break;
      case 'right':
      default:
        labelX = width - Math.abs(this.config.labelOffset.x);
        textAlign = 'right';
        break;
    }
    
    const labelY = this.yPosition + this.config.labelOffset.y;
    
    await renderer.save();
    
    // Set text styles
    await renderer.applyStyles(null, {
      fillStyle: this.config.labelStyle.fill,
      font: `${this.config.labelStyle.fontWeight} ${this.config.labelStyle.fontSize} ${this.config.labelStyle.fontFamily}`,
      textAlign,
      textBaseline: 'middle'
    });
    
    // Draw text
    await renderer.fillText(labelText, labelX, labelY);
    
    await renderer.restore();
  }

  /**
   * Render WebGL label (falls back to HTML overlay)
   * @private
   */
  async _renderWebGLLabel(chart, renderer) {
    // WebGL text rendering is complex, so we fall back to HTML overlay
    if (!this.htmlOverlay) {
      this._initializeHTMLOverlay();
    }
    
    const labelDiv = this._createHTMLLabel();
    this.htmlOverlay.appendChild(labelDiv);
    this.renderedElements.push(labelDiv);
  }

  // ===== HTML OVERLAY METHODS =====

  /**
   * Initialize HTML overlay
   * @private
   */
  _initializeHTMLOverlay() {
    if (!this.htmlContainer) {
      console.warn('AverageLine: No HTML container available for overlay');
      return;
    }
    
    this.htmlOverlay = document.createElement('div');
    this.htmlOverlay.className = `${this.config.className}-overlay`;
    this.htmlOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    
    this.htmlContainer.appendChild(this.htmlOverlay);
  }

  /**
   * Create HTML label element
   * @private
   */
  _createHTMLLabel() {
    const { width } = this.chartDimensions;
    const labelText = `${this.config.labelText}: ${this.averageValue.toLocaleString()}`;
    
    let labelX;
    let textAlign;
    
    // Determine label position
    switch (this.config.labelPosition) {
      case 'left':
        labelX = Math.abs(this.config.labelOffset.x);
        textAlign = 'left';
        break;
      case 'center':
        labelX = width / 2;
        textAlign = 'center';
        break;
      case 'right':
      default:
        labelX = width - Math.abs(this.config.labelOffset.x);
        textAlign = 'right';
        break;
    }
    
    const labelY = this.yPosition + this.config.labelOffset.y;
    
    const labelDiv = document.createElement('div');
    labelDiv.className = `${this.config.className}-label`;
    labelDiv.textContent = labelText;
    labelDiv.style.cssText = `
      position: absolute;
      left: ${labelX}px;
      top: ${labelY}px;
      font-size: ${this.config.labelStyle.fontSize};
      font-family: ${this.config.labelStyle.fontFamily};
      font-weight: ${this.config.labelStyle.fontWeight};
      color: ${this.config.labelStyle.fill};
      text-align: ${textAlign};
      white-space: nowrap;
      pointer-events: none;
      transform: translateX(-50%) translateY(-50%);
    `;
    
    return labelDiv;
  }

  // ===== CLEANUP METHODS =====

  /**
   * Remove SVG elements
   * @private
   */
  _removeSVGElements() {
    this.renderedElements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }

  /**
   * Remove Canvas elements (triggers redraw)
   * @private
   */
  _removeCanvasElements() {
    // Canvas elements are not persistent, so we just clear our tracking
    // The chart will handle redraws as needed
  }

  /**
   * Remove WebGL elements
   * @private
   */
  _removeWebGLElements() {
    // WebGL elements are managed by the renderer
    // We just clear our tracking
  }

  /**
   * Remove HTML overlay
   * @private
   */
  _removeHTMLOverlay() {
    this.renderedElements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    if (this.htmlOverlay && this.htmlOverlay.parentNode) {
      this.htmlOverlay.parentNode.removeChild(this.htmlOverlay);
      this.htmlOverlay = null;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate cache key for value calculation
   * @private
   */
  _generateCacheKey(data, valueField) {
    // Create a simple hash of the data structure
    const dataHash = data.length + '_' + valueField + '_' + 
      (data.length > 0 ? JSON.stringify(data[0]) : '');
    return dataHash;
  }

  /**
   * Cache calculated value
   * @private
   */
  _cacheValue(key, value) {
    if (!this.config.enableCaching) return;
    
    // Implement simple LRU cache
    if (this.valueCache.size >= this.maxCacheSize) {
      const firstKey = this.valueCache.keys().next().value;
      this.valueCache.delete(firstKey);
    }
    
    this.valueCache.set(key, value);
  }

  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(renderTime) {
    this.metrics.renderCount++;
    this.metrics.lastRenderTime = renderTime;
    
    // Calculate rolling average
    const count = this.metrics.renderCount;
    const currentAvg = this.metrics.averageRenderTime;
    this.metrics.averageRenderTime = 
      (currentAvg * (count - 1) + renderTime) / count;
  }

  // ===== PUBLIC API =====

  /**
   * Get current average value
   * @returns {number|null} Current average value
   */
  getValue() {
    return this.averageValue;
  }

  /**
   * Get current Y position
   * @returns {number|null} Current Y position in pixels
   */
  getPosition() {
    return this.yPosition;
  }

  /**
   * Check if component is visible
   * @returns {boolean} True if visible
   */
  isRendered() {
    return this.isVisible;
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Destroy component and cleanup resources
   */
  destroy() {
    console.log('AverageLine.destroy called');
    
    this.remove();
    this.valueCache.clear();
    this.currentRenderer = null;
    this.htmlContainer = null;
    this.isInitialized = false;
    
    console.log('AverageLine destroyed');
  }
}
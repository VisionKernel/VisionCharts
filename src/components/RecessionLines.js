/**
 * RecessionLines component for financial charts
 * Visualizes economic recession periods as shaded areas
 * Renders user-provided recession periods as vertical shaded areas using SVG.
 * Integrates with the unified coordinate system and chart scales.
 */

export class RecessionLines {
  constructor(config = {}) {
    this.config = {
      // Visual styling
      fillColor: 'rgba(235, 54, 54, 0.15)',      // Default light red with transparency
      fillOpacity: 0.15,
      strokeColor: 'rgba(235, 54, 54, 0.3)',     // Slightly more opaque border
      strokeWidth: 0,                             // No border by default
      
      // Behavior
      enabled: false,                             // Off by default as requested
      
      // Theme integration
      useThemeColors: true,                       // Use colors from light/dark themes
      
      // NEW: User-provided recession data
      recessionData: [],                          // Array of recession periods
      
      ...config
    };
    
    // SVG elements
    this.svgElement = null;
    this.recessionGroup = null;
    this.currentRecessions = [];
    
    // Chart integration
    this.scales = null;
    this.chartArea = null;
    
    // State
    this.isVisible = false;
    this.isRendered = false;
    
    console.log('RecessionLines component created');
  }
  
  /**
   * Set recession data from user
   * @param {Array} recessionData - Array of recession periods
   *   Format: [{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }, ...]
   *   Or: [{ start: timestamp, end: timestamp }, ...]
   */
  setRecessionData(recessionData) {
    if (!Array.isArray(recessionData)) {
      console.warn('RecessionLines: recessionData must be an array');
      return this;
    }
    
    // Convert to standardized format with timestamps
    this.config.recessionData = recessionData.map(recession => {
      const startTime = this._parseDate(recession.start);
      const endTime = this._parseDate(recession.end);
      
      return {
        start: startTime,
        end: endTime,
        startDate: recession.start,
        endDate: recession.end,
        name: recession.name || `Recession ${recession.start} - ${recession.end}`
      };
    });
    
    console.log(`RecessionLines: Set ${this.config.recessionData.length} recession periods`);
    
    // Update visible recessions if already rendered
    if (this.isRendered) {
      this._updateVisibleRecessions();
      this._renderRecessionRects();
    }
    
    return this;
  }
  
  /**
   * Parse date string or timestamp to milliseconds
   * @private
   */
  _parseDate(dateValue) {
    if (typeof dateValue === 'number') {
      return dateValue; // Already a timestamp
    }
    
    if (typeof dateValue === 'string') {
      return new Date(dateValue).getTime();
    }
    
    if (dateValue instanceof Date) {
      return dateValue.getTime();
    }
    
    console.warn('RecessionLines: Invalid date format:', dateValue);
    return Date.now(); // Fallback
  }
  
  /**
   * Get recessions that overlap with a given date range
   * @private
   */
  _getRecessionsByDateRange(startTime, endTime) {
    if (!Array.isArray(this.config.recessionData)) {
      return [];
    }
    
    return this.config.recessionData.filter(recession => {
      // Include recession if it overlaps with the date range at all
      return recession.start <= endTime && recession.end >= startTime;
    });
  }
  
  /**
   * Initialize and render recession areas in dedicated SVG
   * @param {HTMLElement} container - Container to add SVG to
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} scales - Chart scales for coordinate conversion
   */
  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      console.warn('RecessionLines: Container, chart area, and scales required');
      return;
    }
    
    this.chartArea = chartArea;
    this.scales = scales;
    
    // Remove existing SVG if present
    this._remove();
    
    // Create dedicated recession SVG layer
    this._createRecessionSVG(container, chartArea);
    
    // Calculate visible recessions
    this._updateVisibleRecessions();
    
    // Render recession rectangles
    this._renderRecessionRects();
    
    this.isRendered = true;
    
    // Show/hide based on current state
    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
    
    console.log(`RecessionLines rendered: ${this.currentRecessions.length} periods in view`);
  }
  
  /**
   * Show recession areas
   */
  show() {
    if (!this.isRendered) {
      console.warn('RecessionLines: Must render before showing');
      return false;
    }
    
    this.config.enabled = true;
    this.isVisible = true;
    
    if (this.svgElement) {
      this.svgElement.style.display = 'block';
    }
    
    return true;
  }
  
  /**
   * Hide recession areas
   */
  hide() {
    this.config.enabled = false;
    this.isVisible = false;
    
    if (this.svgElement) {
      this.svgElement.style.display = 'none';
    }
    
    return true;
  }
  
  /**
   * Toggle recession areas visibility
   * @param {boolean} show - Force show/hide state, or null to toggle
   * @returns {boolean} New visibility state
   */
  toggle(show = null) {
    const newState = show !== null ? show : !this.config.enabled;
    
    if (newState) {
      return this.show();
    } else {
      return this.hide();
    }
  }
  
  /**
   * Update with new scales (when chart updates)
   * @param {Object} newScales - Updated chart scales
   */
  updateScales(newScales) {
    this.scales = newScales;
    
    if (this.isRendered) {
      this._updateVisibleRecessions();
      this._renderRecessionRects();
    }
  }
  
  /**
   * Update chart area (when chart resizes)
   * @param {Object} newChartArea - Updated chart area
   */
  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;
    
    if (this.svgElement) {
      this.svgElement.setAttribute('width', newChartArea.width);
      this.svgElement.setAttribute('height', newChartArea.height);
    }
    
    if (this.isRendered) {
      this._renderRecessionRects();
    }
  }
  
  /**
   * Update styling/theme colors
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    if (this.isRendered) {
      this._renderRecessionRects();
    }
  }
  
  /**
   * Get current recession component state
   */
  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      recessionCount: this.currentRecessions.length,
      totalRecessionData: this.config.recessionData.length,
      hasScales: !!this.scales,
      hasChartArea: !!this.chartArea
    };
  }
  
  /**
   * Create dedicated SVG element for recession areas
   * @private
   */
  _createRecessionSVG(container, chartArea) {
    // Create SVG element with z-index: 0.5 (between grid and data)
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '0.5';  // Between grid (0) and data (1)
    this.svgElement.style.pointerEvents = 'none'; // Don't interfere with interactions
    this.svgElement.setAttribute('class', 'recession-lines-svg');
    
    // Create group for recession rectangles
    this.recessionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.recessionGroup.setAttribute('class', 'recession-periods');
    this.svgElement.appendChild(this.recessionGroup);
    
    // Add to container
    container.appendChild(this.svgElement);
    
    console.log('Recession SVG layer created with z-index: 0.5');
  }
  
  /**
   * Calculate which recessions are visible in current chart range
   * @private
   */
  _updateVisibleRecessions() {
    if (!this.scales || !this.scales.x) {
      this.currentRecessions = [];
      return;
    }
    
    // Get current chart time range
    const xDomain = this.scales.x.domain;
    const chartStartTime = xDomain[0];
    const chartEndTime = xDomain[1];
    
    // Get recessions that overlap with visible range
    this.currentRecessions = this._getRecessionsByDateRange(chartStartTime, chartEndTime);
    
    console.log(`Found ${this.currentRecessions.length} recessions in visible range: ${new Date(chartStartTime).getFullYear()}-${new Date(chartEndTime).getFullYear()}`);
  }
  
  /**
   * Render recession rectangles using chart scales
   * @private
   */
  _renderRecessionRects() {
    if (!this.recessionGroup || !this.scales || !this.chartArea) {
      return;
    }
    
    // Clear existing rectangles
    this.recessionGroup.innerHTML = '';
    
    // Get current colors (theme-aware)
    const colors = this._getCurrentColors();
    
    // Create rectangle for each visible recession
    this.currentRecessions.forEach((recession, index) => {
      const rect = this._createRecessionRect(recession, colors, index);
      if (rect) {
        this.recessionGroup.appendChild(rect);
      }
    });
  }
  
  /**
   * Create single recession rectangle
   * @private
   */
  _createRecessionRect(recession, colors, index) {
    try {
      // Convert recession dates to pixel coordinates using chart scales
      const startX = this.scales.x.scale(recession.start);
      const endX = this.scales.x.scale(recession.end);
      
      // Skip if recession is completely outside visible area
      if (endX < this.chartArea.x || startX > this.chartArea.x + this.chartArea.width) {
        return null;
      }
      
      // Clamp to chart area bounds
      const clampedStartX = Math.max(startX, this.chartArea.x);
      const clampedEndX = Math.min(endX, this.chartArea.x + this.chartArea.width);
      const rectWidth = clampedEndX - clampedStartX;
      
      // Skip if width is too small to be visible
      if (rectWidth < 1) {
        return null;
      }
      
      // Create SVG rectangle
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'recession-period');
      rect.setAttribute('x', clampedStartX);
      rect.setAttribute('y', this.chartArea.y);
      rect.setAttribute('width', rectWidth);
      rect.setAttribute('height', this.chartArea.height);
      rect.setAttribute('fill', colors.fill);
      rect.setAttribute('fill-opacity', colors.opacity);
      
      if (this.config.strokeWidth > 0) {
        rect.setAttribute('stroke', colors.stroke);
        rect.setAttribute('stroke-width', this.config.strokeWidth);
      }
      
      // Add metadata for debugging
      rect.setAttribute('data-recession-start', recession.startDate);
      rect.setAttribute('data-recession-end', recession.endDate);
      rect.setAttribute('data-recession-index', index);
      
      // Add title for tooltip (optional)
      if (recession.name) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = recession.name;
        rect.appendChild(title);
      }
      
      return rect;
      
    } catch (error) {
      console.error('Error creating recession rectangle:', error);
      return null;
    }
  }
  
  /**
   * Get current colors based on theme and configuration
   * @private
   */
  _getCurrentColors() {
    // TODO: In the future, we could integrate with theme system here
    // For now, use the configured colors
    
    return {
      fill: this.config.fillColor,
      opacity: this.config.fillOpacity,
      stroke: this.config.strokeColor
    };
  }
  
  /**
   * Remove recession SVG from DOM
   * @private
   */
  _remove() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }
    
    this.svgElement = null;
    this.recessionGroup = null;
    this.isRendered = false;
  }
  
  /**
   * Destroy recession lines and clean up resources
   */
  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.currentRecessions = [];
    this.config.recessionData = [];
    this.isVisible = false;
    
    console.log('RecessionLines destroyed');
  }
}
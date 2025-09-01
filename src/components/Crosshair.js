/**
 * Crosshair - Enhanced multi-renderer crosshair implementation
 * 
 * 
 */
export class Crosshair {
  constructor(config = {}) {
    this.config = {
      // Crosshair line styling
      lineColor: '#666666',
      lineWidth: 1,
      lineOpacity: 0.7,
      lineDash: [2, 2], // dashed lines
      
      // Point highlight styling  
      highlightRadius: 3,
      highlightStrokeWidth: 2,
      highlightStroke: '#ffffff', // white outline
      highlightOpacity: 1.0,
      
      // Behavior
      enabled: true,
      
      ...config
    };
    
    // SVG elements
    this.svgGroup = null;
    this.verticalLine = null;
    this.horizontalLine = null;
    this.highlightGroup = null;
    
    // State
    this.isVisible = false;
    this.currentPosition = { x: 0, y: 0 };
    this.currentHighlights = [];
    
    console.log('Crosshair component created');
  }
  
  /**
   * Initialize crosshair in SVG container
   */
  render(svgContainer, chartArea) {
    if (!svgContainer || !chartArea) {
      console.warn('Crosshair: SVG container and chart area required');
      return;
    }
    
    this.chartArea = chartArea;
    this.svgContainer = svgContainer;
    
    // Remove existing crosshair if present
    this._remove();
    
    // Create main crosshair group
    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', 'crosshair');
    this.svgGroup.style.pointerEvents = 'none'; // Don't interfere with mouse events
    this.svgGroup.style.display = 'none'; // Hidden by default
    
    // Create crosshair lines
    this._createCrosshairLines();
    
    // Create highlight group for data points
    this._createHighlightGroup();
    
    // Add to SVG container
    svgContainer.appendChild(this.svgGroup);
    
    console.log('Crosshair rendered in SVG overlay');
  }
  
  /**
   * Show crosshair
   */
  show() {
    if (!this.config.enabled || !this.svgGroup) return;
    
    this.svgGroup.style.display = 'block';
    this.isVisible = true;
  }
  
  /**
   * Hide crosshair
   */
  hide() {
    if (!this.svgGroup) return;
    
    this.svgGroup.style.display = 'none';
    this.isVisible = false;
  }
  
  /**
   * Update crosshair position
   */
  updatePosition(unifiedX, unifiedY) {
    if (!this.svgGroup || !this.chartArea) return;
    
    // Clamp coordinates to chart area
    const clampedX = Math.max(this.chartArea.x, 
                     Math.min(this.chartArea.x + this.chartArea.width, unifiedX));
    const clampedY = Math.max(this.chartArea.y,
                     Math.min(this.chartArea.y + this.chartArea.height, unifiedY));
    
    this.currentPosition = { x: clampedX, y: clampedY };
    
    // Update vertical line (spans full chart height)
    if (this.verticalLine) {
      this.verticalLine.setAttribute('x1', clampedX);
      this.verticalLine.setAttribute('x2', clampedX);
      this.verticalLine.setAttribute('y1', this.chartArea.y);
      this.verticalLine.setAttribute('y2', this.chartArea.y + this.chartArea.height);
    }
    
    // Update horizontal line (spans full chart width)
    if (this.horizontalLine) {
      this.horizontalLine.setAttribute('x1', this.chartArea.x);
      this.horizontalLine.setAttribute('x2', this.chartArea.x + this.chartArea.width);
      this.horizontalLine.setAttribute('y1', clampedY);
      this.horizontalLine.setAttribute('y2', clampedY);
    }
  }
  
  /**
   * Update data point highlights
   */
  updateHighlights(dataPoints = []) {
    if (!this.highlightGroup) return;
    
    // Clear existing highlights
    this.highlightGroup.innerHTML = '';
    this.currentHighlights = [];
    
    // Create new highlights for each data point
    dataPoints.forEach((point, index) => {
      if (point && point.unifiedX != null && point.unifiedY != null) {
        this._createPointHighlight(point, index);
      }
    });
  }
  
  /**
   * Get current crosshair state
   */
  getState() {
    return {
      isVisible: this.isVisible,
      enabled: this.config.enabled,
      position: this.currentPosition,
      highlightCount: this.currentHighlights.length
    };
  }
  
  /**
   * Create crosshair lines (vertical + horizontal)
   * @private
   */
  _createCrosshairLines() {
    // Vertical line
    this.verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.verticalLine.setAttribute('class', 'crosshair-vertical');
    this.verticalLine.setAttribute('stroke', this.config.lineColor);
    this.verticalLine.setAttribute('stroke-width', this.config.lineWidth);
    this.verticalLine.setAttribute('stroke-opacity', this.config.lineOpacity);
    this.verticalLine.setAttribute('stroke-dasharray', this.config.lineDash.join(' '));
    this.verticalLine.setAttribute('shape-rendering', 'crispEdges');
    
    // Horizontal line
    this.horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.horizontalLine.setAttribute('class', 'crosshair-horizontal');
    this.horizontalLine.setAttribute('stroke', this.config.lineColor);
    this.horizontalLine.setAttribute('stroke-width', this.config.lineWidth);
    this.horizontalLine.setAttribute('stroke-opacity', this.config.lineOpacity);
    this.horizontalLine.setAttribute('stroke-dasharray', this.config.lineDash.join(' '));
    this.horizontalLine.setAttribute('shape-rendering', 'crispEdges');
    
    // Add to group
    this.svgGroup.appendChild(this.verticalLine);
    this.svgGroup.appendChild(this.horizontalLine);
  }
  
  /**
   * Create highlight group for data points
   * @private
   */
  _createHighlightGroup() {
    this.highlightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.highlightGroup.setAttribute('class', 'crosshair-highlights');
    this.svgGroup.appendChild(this.highlightGroup);
  }
  
  /**
   * Create highlight circle for a single data point
   * @private
   */
  _createPointHighlight(dataPoint, index) {
    // Create highlight circle
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    highlight.setAttribute('class', 'crosshair-highlight');
    highlight.setAttribute('cx', dataPoint.unifiedX);
    highlight.setAttribute('cy', dataPoint.unifiedY);
    highlight.setAttribute('r', this.config.highlightRadius);
    
    // Use dataset color or fallback
    const fillColor = dataPoint.color || dataPoint.dataset?.color || '#1468a8';
    highlight.setAttribute('fill', fillColor);
    highlight.setAttribute('fill-opacity', this.config.highlightOpacity);
    
    // White stroke for visibility
    highlight.setAttribute('stroke', this.config.highlightStroke);
    highlight.setAttribute('stroke-width', this.config.highlightStrokeWidth);
    
    // Add to highlights group
    this.highlightGroup.appendChild(highlight);
    this.currentHighlights.push({
      element: highlight,
      dataPoint: dataPoint,
      index: index
    });
  }
  
  /**
   * Remove crosshair from DOM
   * @private
   */
  _remove() {
    if (this.svgGroup && this.svgGroup.parentElement) {
      this.svgGroup.parentElement.removeChild(this.svgGroup);
    }
    
    this.svgGroup = null;
    this.verticalLine = null;
    this.horizontalLine = null;
    this.highlightGroup = null;
    this.currentHighlights = [];
  }
  
  /**
   * Destroy crosshair and cleanup resources
   */
  destroy() {
    this._remove();
    this.svgContainer = null;
    this.chartArea = null;
    this.currentPosition = { x: 0, y: 0 };
    this.isVisible = false;
    
    console.log('Crosshair destroyed');
  }
}

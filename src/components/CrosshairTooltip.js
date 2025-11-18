/**
 * CrosshairTooltip.js - Professional tooltip for crosshair data points
 * Location: /src/components/CrosshairTooltip.js
 * 
 * Shows dataset values and timestamps when crosshair is active
 */

export class CrosshairTooltip {
  constructor(config = {}) {
    this.config = {
      // Positioning
      offsetX: 15,        // Pixels from mouse
      offsetY: -10,       // Pixels from mouse
      
      // ✅ NEW: Need container reference for proper positioning
      container: null,    // Will be set during initialization
      
      // Styling
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: 6,
      padding: 12,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      textColor: '#ffffff',
      headerColor: '#ffffff',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      
      // Content formatting
      dateFormat: 'medium', // 'short', 'medium', 'long'
      valueDecimals: 2,
      showValueChange: false, // Show change from previous value
      
      ...config
    };
    
    // DOM elements
    this.element = null;
    this.isVisible = false;
    this.currentData = null;
    
    // Create tooltip element
    this._createTooltip();
  }

  /**
   * Show tooltip with data points
   */
  show(dataPoints, mouseX, mouseY) {
    if (!dataPoints || dataPoints.length === 0) {
      this.hide();
      return;
    }
    
    this.currentData = dataPoints;
    
    // Update content
    this._updateContent(dataPoints);
    
    // Position tooltip
    this._positionTooltip(mouseX, mouseY);
    
    // Show tooltip
    this.element.style.display = 'block';
    this.isVisible = true;
    
    // Force a reflow to ensure styles are applied
    void this.element.offsetWidth;
  }

  /**
   * Hide tooltip
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.isVisible = false;
    this.currentData = null;
  }

  /**
   * Update tooltip position
   */
  updatePosition(mouseX, mouseY) {
    if (this.isVisible) {
      this._positionTooltip(mouseX, mouseY);
    }
  }

  /**
   * Create tooltip DOM element
   * @private
   */
  _createTooltip() {
    this.element = document.createElement('div');
    this.element.className = 'crosshair-tooltip';
    this.element.style.cssText = `
      position: fixed;
      z-index: 999999;
      background: ${this.config.backgroundColor};
      border: 1px solid ${this.config.borderColor};
      border-radius: ${this.config.borderRadius}px;
      padding: ${this.config.padding}px;
      font-size: ${this.config.fontSize}px;
      font-family: ${this.config.fontFamily};
      color: ${this.config.textColor};
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      display: none;
      max-width: 300px;
    `;
    
    // Add to document body
    document.body.appendChild(this.element);
  }

  /**
 * Update tooltip content with data points (enhanced for studies)
 * ✅ UPDATED: Added deduplication safety net
 * @private
 */
_updateContent(dataPoints) {
  if (dataPoints.length === 0) return;
  
  // ✅ NEW: Deduplicate by dataset ID as a safety net
  const uniqueDataPoints = [];
  const seenIds = new Set();
  
  for (const point of dataPoints) {
    const key = point.datasetId || point.dataset?.id || Math.random();
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueDataPoints.push(point);
    } else {
      console.warn('CrosshairTooltip: Duplicate dataset filtered:', key);
    }
  }
  
  // Get the timestamp from the first point (should be same for all in crosshair)
  const timestamp = uniqueDataPoints[0].dataX || uniqueDataPoints[0].x;
  const formattedDate = this._formatDate(timestamp);
  
  // Separate regular datasets from studies
  const regularPoints = uniqueDataPoints.filter(point => !point.isStudy);
  const studyPoints = uniqueDataPoints.filter(point => point.isStudy);
  
  // Build HTML content
  let html = `
    <div style="
      font-weight: bold; 
      color: ${this.config.headerColor}; 
      margin-bottom: 8px; 
      padding-bottom: 6px; 
      border-bottom: 1px solid ${this.config.borderColor};
      font-size: ${this.config.fontSize + 1}px;
    ">
      ${formattedDate}
    </div>
  `;
  
  // Add regular dataset values first
  if (regularPoints.length > 0) {
    regularPoints.forEach((point, index) => {
      const datasetName = point.dataset?.name || point.datasetId || `Dataset ${index + 1}`;
      const value = point.dataY || point.y;
      const color = point.color || point.dataset?.color || '#666';
      const formattedValue = this._formatValue(value);
      
      html += `
        <div style="
          display: flex; 
          align-items: center; 
          margin-bottom: 4px;
        ">
          <div style="
            width: 10px; 
            height: 10px; 
            background-color: ${color}; 
            border-radius: 2px; 
            margin-right: 8px;
            flex-shrink: 0;
          "></div>
          <div style="
            display: flex; 
            justify-content: space-between; 
            width: 100%; 
            min-width: 120px;
          ">
            <span style="margin-right: 12px; color: #ccc;">${datasetName}:</span>
            <span style="font-weight: 500;">${formattedValue}</span>
          </div>
        </div>
      `;
    });
  }
  
  // Add separator and studies section if there are studies
  if (studyPoints.length > 0) {
    // Add separator line
    html += `
      <div style="
        border-top: 1px solid ${this.config.borderColor};
        margin: 8px 0 6px 0;
        padding-top: 6px;
      ">
        <div style="
          font-size: ${this.config.fontSize - 1}px;
          color: #999;
          margin-bottom: 4px;
          font-weight: 500;
        ">
          Technical Indicators:
        </div>
      </div>
    `;
    
    // Add study values with slightly different styling
    studyPoints.forEach((point, index) => {
      const studyName = point.dataset?.name || `Study ${index + 1}`;
      const value = point.dataY || point.y;
      const color = point.color || point.dataset?.color || '#666';
      const formattedValue = this._formatValue(value);
      
      html += `
        <div style="
          display: flex; 
          align-items: center; 
          margin-bottom: 3px;
          padding-left: 8px;
        ">
          <div style="
            width: 8px; 
            height: 8px; 
            background-color: ${color}; 
            border-radius: 1px; 
            margin-right: 8px;
            flex-shrink: 0;
            opacity: 0.8;
          "></div>
          <div style="
            display: flex; 
            justify-content: space-between; 
            width: 100%; 
            min-width: 120px;
          ">
            <span style="
              margin-right: 12px; 
              color: #aaa; 
              font-size: ${this.config.fontSize - 1}px;
              font-style: italic;
            ">${studyName}:</span>
            <span style="
              font-weight: 400; 
              font-size: ${this.config.fontSize - 1}px;
              color: ${color};
            ">${formattedValue}</span>
          </div>
        </div>
      `;
    });
  }
  
  this.element.innerHTML = html;
}

  /**
 * Position tooltip near mouse but avoid screen edges
 * ✅ VERIFIED: Properly handles container-relative to viewport conversion
 * @private
 */
_positionTooltip(mouseX, mouseY) {
  if (!this.element) return;
  
  // Get container position to convert coordinates
  let containerRect = { left: 0, top: 0 };
  if (this.config.container) {
    containerRect = this.config.container.getBoundingClientRect();
  }
  
  // Convert container-relative coords to viewport coords
  const viewportX = containerRect.left + mouseX;
  const viewportY = containerRect.top + mouseY;
  
  // Make element visible temporarily to get dimensions
  const wasVisible = this.element.style.display !== 'none';
  if (!wasVisible) {
    this.element.style.display = 'block';
    this.element.style.visibility = 'hidden';
  }
  
  // Get tooltip dimensions
  const rect = this.element.getBoundingClientRect();
  const tooltipWidth = rect.width;
  const tooltipHeight = rect.height;
  
  // Reset visibility
  if (!wasVisible) {
    this.element.style.display = 'none';
    this.element.style.visibility = 'visible';
  }
  
  // Calculate initial position using VIEWPORT coordinates
  let left = viewportX + this.config.offsetX;
  let top = viewportY + this.config.offsetY;
  
  // Edge detection using viewport coordinates
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // ✅ IMPROVED: Better edge detection with padding
  const edgePadding = 10;
  
  // Prevent tooltip from going off right edge
  if (left + tooltipWidth > viewportWidth - edgePadding) {
    left = viewportX - tooltipWidth - this.config.offsetX;
  }
  
  // Prevent tooltip from going off bottom edge  
  if (top + tooltipHeight > viewportHeight - edgePadding) {
    top = viewportY - tooltipHeight - Math.abs(this.config.offsetY);
  }
  
  // Prevent tooltip from going off left edge
  if (left < edgePadding) {
    // Try positioning to the right of cursor
    left = viewportX + this.config.offsetX;
    // If still off edge, pin to edge
    if (left < edgePadding) {
      left = edgePadding;
    }
  }
  
  // Prevent tooltip from going off top edge
  if (top < edgePadding) {
    // Try positioning below cursor
    top = viewportY + this.config.offsetY;
    // If still off edge, pin to edge
    if (top < edgePadding) {
      top = edgePadding;
    }
  }
  
  // Apply position
  this.element.style.left = left + 'px';
  this.element.style.top = top + 'px';
}

  /**
   * Format date for display
   * @private
   */
  _formatDate(timestamp) {
    const date = new Date(timestamp);
    
    switch (this.config.dateFormat) {
      case 'short':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
        
      case 'long':
        return date.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
      case 'medium':
      default:
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
    }
  }

  /**
   * Format value for display
   * @private
   */
  _formatValue(value) {
    if (value == null || isNaN(value)) {
      return 'N/A';
    }
    
    // Format large numbers with K/M/B suffixes
    const absValue = Math.abs(value);
    
    if (absValue >= 1000000000) {
      return (value / 1000000000).toFixed(this.config.valueDecimals) + 'B';
    } else if (absValue >= 1000000) {
      return (value / 1000000).toFixed(this.config.valueDecimals) + 'M';
    } else if (absValue >= 1000) {
      return (value / 1000).toFixed(this.config.valueDecimals) + 'K';
    } else {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: this.config.valueDecimals,
        maximumFractionDigits: this.config.valueDecimals
      });
    }
  }

  /**
   * Update tooltip styling
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    // Update element styles
    if (this.element) {
      const style = this.element.style;
      style.backgroundColor = this.config.backgroundColor;
      style.borderColor = this.config.borderColor;
      style.borderRadius = this.config.borderRadius + 'px';
      style.padding = this.config.padding + 'px';
      style.fontSize = this.config.fontSize + 'px';
      style.fontFamily = this.config.fontFamily;
      style.color = this.config.textColor;
    }
    
    // Refresh content if visible
    if (this.isVisible && this.currentData) {
      this._updateContent(this.currentData);
    }
  }

  /**
   * Get current tooltip state
   */
  getState() {
    return {
      isVisible: this.isVisible,
      hasData: this.currentData && this.currentData.length > 0,
      dataPointCount: this.currentData ? this.currentData.length : 0
    };
  }

  /**
   * Destroy tooltip and clean up
   */
  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    
    this.element = null;
    this.isVisible = false;
    this.currentData = null;
  }
}
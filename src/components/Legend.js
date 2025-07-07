/**
 * Legend.js - Professional Legend Component for Financial Charts
 * Location: /src/components/Legend.js
 * 
 * Renders dataset legends with color indicators and names.
 * Designed for investment/portfolio manager use cases.
 */

export class Legend {
  constructor(config = {}) {
    this.config = {
      // Positioning
      position: 'center-top', // Under title, centered
      marginTop: 20,          // Space below title
      marginBottom: 20,       // Space above chart
      
      // Styling
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      textColor: '#333333',
      
      // Layout
      itemSpacing: 20,        // Space between legend items
      indicatorSize: 10,      // Size of color squares
      indicatorSpacing: 6,    // Space between indicator and text
      
      // Professional styling
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid #e0e0e0',
      borderRadius: 4,
      padding: 8,
      
      ...config
    };
    
    this.element = null;
    this.datasets = [];
  }

  /**
   * Update datasets and re-render legend
   * @param {Array} datasets - Array of dataset objects
   */
  updateDatasets(datasets) {
    this.datasets = datasets || [];
    this.render();
  }

  /**
   * Render legend to SVG container
   * @param {SVGElement} svgContainer - SVG element to render into
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} options - Additional options
   */
  render(svgContainer, chartArea, options = {}) {
    if (!svgContainer || !chartArea) {
      console.warn('Legend: SVG container and chart area required for rendering');
      return;
    }

    // Remove existing legend
    this._remove();

    // Don't render if no datasets
    if (!this.datasets || this.datasets.length === 0) {
      return;
    }

    // Create legend group
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.element.setAttribute('class', 'chart-legend');

    // Calculate initial legend dimensions and position
    const legendData = this._calculateLegendLayout(chartArea);
    
    // Create legend items first
    this._createLegendItems(legendData);
    
    // Measure actual dimensions of the created items
    const actualDimensions = this._measureLegendItems();
    
    // Create background with actual dimensions
    this._createBackground(legendData, actualDimensions);

    // Add to SVG
    svgContainer.appendChild(this.element);
    
    console.log(`Legend rendered with ${this.datasets.length} datasets`);
  }

  /**
   * Measure the actual dimensions of all legend items
   * @private
   */
  _measureLegendItems() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    // Get all legend items
    const items = this.element.querySelectorAll('.legend-item');
    
    // Find the bounding box that contains all items
    items.forEach(item => {
      const bbox = item.getBBox();
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Calculate legend layout and positioning
   * @private
   */
  _calculateLegendLayout(chartArea) {
    const itemWidth = this._estimateItemWidth();
    const totalWidth = Math.min(
      this.datasets.length * itemWidth + (this.datasets.length - 1) * this.config.itemSpacing,
      chartArea.width - 40 // Leave margin on sides
    );
    
    // Center horizontally in chart area
    const x = chartArea.x + (chartArea.width - totalWidth) / 2;
    
    // Position under title with margin, now 15px lower
    const y = chartArea.y - this.config.marginBottom + 15;
    
    return {
      x: x,
      y: y,
      totalWidth: totalWidth,
      itemWidth: itemWidth,
      height: this.config.fontSize + this.config.padding * 2
    };
  }

  /**
   * Estimate width needed for each legend item
   * @private
   */
  _estimateItemWidth() {
    // Rough estimation: indicator + spacing + average text width
    const avgTextWidth = 60; // Rough estimate for "Dataset X"
    return this.config.indicatorSize + this.config.indicatorSpacing + avgTextWidth;
  }

  /**
   * Create individual legend items
   * @private
   */
  _createLegendItems(legendData) {
    this.datasets.forEach((dataset, index) => {
      const itemX = legendData.x + index * (legendData.itemWidth + this.config.itemSpacing);
      const itemY = legendData.y;
      
      // Create legend item group
      const itemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      itemGroup.setAttribute('class', 'legend-item');
      
      // Color indicator (square)
      const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      indicator.setAttribute('x', itemX);
      indicator.setAttribute('y', itemY - this.config.indicatorSize / 2);
      indicator.setAttribute('width', this.config.indicatorSize);
      indicator.setAttribute('height', this.config.indicatorSize);
      indicator.setAttribute('fill', dataset.color || '#1468a8');
      indicator.setAttribute('stroke', '#999');
      indicator.setAttribute('stroke-width', '0.5');
      
      // Dataset name text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', itemX + this.config.indicatorSize + this.config.indicatorSpacing);
      text.setAttribute('y', itemY + this.config.fontSize / 3); // Vertically center
      text.setAttribute('font-size', this.config.fontSize);
      text.setAttribute('font-family', this.config.fontFamily);
      text.setAttribute('font-weight', this.config.fontWeight);
      text.setAttribute('fill', this.config.textColor);
      text.setAttribute('text-anchor', 'start');
      text.textContent = dataset.name || dataset.id || 'Unnamed Dataset';
      
      // Add to item group
      itemGroup.appendChild(indicator);
      itemGroup.appendChild(text);
      
      // Add to legend
      this.element.appendChild(itemGroup);
    });
  }

  /**
   * Create legend background
   * @private
   */
  _createBackground(legendData, actualDimensions) {
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    
    // Position and size based on actual dimensions plus padding
    background.setAttribute('x', actualDimensions.x - this.config.padding);
    background.setAttribute('y', actualDimensions.y - this.config.padding);
    background.setAttribute('width', actualDimensions.width + this.config.padding * 2);
    background.setAttribute('height', actualDimensions.height + this.config.padding * 2);
    background.setAttribute('fill', this.config.backgroundColor);
    background.setAttribute('stroke', this.config.border.split(' ')[2]); // Extract color
    background.setAttribute('stroke-width', '1');
    background.setAttribute('rx', this.config.borderRadius);
    
    // Insert at the beginning so it's behind the text
    this.element.insertBefore(background, this.element.firstChild);
  }

  /**
   * Remove legend from DOM
   * @private
   */
  _remove() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
    }
  }

  /**
   * Update legend when dataset color changes
   * @param {string} datasetId - ID of dataset that changed
   * @param {string} newColor - New color value
   */
  updateDatasetColor(datasetId, newColor) {
    const dataset = this.datasets.find(d => d.id === datasetId);
    if (dataset) {
      dataset.color = newColor;
      
      // Update the specific indicator in the DOM
      if (this.element) {
        const legendItems = this.element.querySelectorAll('.legend-item');
        const datasetIndex = this.datasets.findIndex(d => d.id === datasetId);
        
        if (legendItems[datasetIndex]) {
          const indicator = legendItems[datasetIndex].querySelector('rect');
          if (indicator) {
            indicator.setAttribute('fill', newColor);
          }
        }
      }
    }
  }

  /**
   * Get legend height for layout calculations
   */
  getHeight() {
    return this.config.fontSize + this.config.padding * 2 + this.config.marginTop + this.config.marginBottom;
  }

  /**
   * Show/hide legend
   */
  setVisible(visible) {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Destroy legend and clean up
   */
  destroy() {
    this._remove();
    this.datasets = [];
  }
}
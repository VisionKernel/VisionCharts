/**
 * Enhanced Legend.js - Professional Legend Component with Inline Studies Display
 * Location: /src/components/Legend.js
 * 
 * Renders dataset legends with inline studies attached to each dataset.
 * Format: [Dataset] • Study1 • Study2 • Study3
 */

export class Legend {
  constructor(config = {}) {
    this.config = {
      // Positioning
      position: 'center-top', // Under title, centered
      marginTop: 20,          // Space below title
      marginBottom: 20,       // Space above chart
      
      // Dataset styling
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      textColor: '#333333',
      
      // Study styling (smaller than datasets)
      studyFontSize: 10,
      studyTextColor: '#666666',
      studyIndicatorSize: 6,
      studySeparator: ' • ',
      
      // Layout
      itemSpacing: 25,        // Space between dataset groups
      indicatorSize: 10,      // Size of dataset color squares
      indicatorSpacing: 6,    // Space between indicator and text
      studySpacing: 4,        // Space between study elements
      
      // Professional styling
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid #e0e0e0',
      borderRadius: 4,
      padding: 8,
      
      ...config
    };
    
    this.element = null;
    this.datasets = [];
    this.studiesByDataset = new Map(); // Map of datasetId -> studies array
  }

  /**
   * Update datasets and studies, then re-render legend
   * @param {Array} datasets - Array of dataset objects
   * @param {Array} studies - Array of study objects (optional)
   */
  updateDatasets(datasets, studies = []) {
    this.datasets = datasets || [];
    this._organizeStudiesByDataset(studies);
    this.render();
  }

  /**
   * Update studies data and re-render legend
   * @param {Array} studies - Array of study objects
   */
  updateStudies(studies) {
    this._organizeStudiesByDataset(studies);
    this.render();
  }

  /**
   * Organize studies by their parent dataset
   * @param {Array} studies - Array of study objects
   * @private
   */
  _organizeStudiesByDataset(studies) {
    this.studiesByDataset.clear();
    
    studies.forEach(study => {
      if (!study.datasetId || !study.visible) return;
      
      if (!this.studiesByDataset.has(study.datasetId)) {
        this.studiesByDataset.set(study.datasetId, []);
      }
      
      this.studiesByDataset.get(study.datasetId).push(study);
    });
    
    console.log(`Organized ${studies.length} studies across ${this.studiesByDataset.size} datasets`);
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

    // Calculate legend layout
    const legendData = this._calculateLegendLayout(chartArea);
    
    // Create legend items with inline studies
    this._createLegendItemsWithStudies(legendData);

    // Add to SVG
    svgContainer.appendChild(this.element);
    
    const totalStudies = Array.from(this.studiesByDataset.values()).reduce((sum, studies) => sum + studies.length, 0);
    console.log(`Legend rendered with ${this.datasets.length} datasets and ${totalStudies} inline studies`);
  }

  /**
   * Create legend items with inline studies display
   * @private
   */
  _createLegendItemsWithStudies(legendData) {
    let currentX = legendData.x;
    const itemY = legendData.y;
    
    this.datasets.forEach((dataset, index) => {
      // Create dataset group
      const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      datasetGroup.setAttribute('class', 'legend-dataset-group');
      datasetGroup.setAttribute('data-dataset-id', dataset.id);
      
      // Dataset color indicator (square)
      const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      indicator.setAttribute('x', currentX);
      indicator.setAttribute('y', itemY - this.config.indicatorSize / 2);
      indicator.setAttribute('width', this.config.indicatorSize);
      indicator.setAttribute('height', this.config.indicatorSize);
      indicator.setAttribute('fill', dataset.color || '#1468a8');
      indicator.setAttribute('stroke', '#999');
      indicator.setAttribute('stroke-width', '0.5');
      
      datasetGroup.appendChild(indicator);
      currentX += this.config.indicatorSize + this.config.indicatorSpacing;

      // Dataset name text
      const datasetText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      datasetText.setAttribute('x', currentX);
      datasetText.setAttribute('y', itemY + this.config.fontSize / 3);
      datasetText.setAttribute('font-size', this.config.fontSize);
      datasetText.setAttribute('font-family', this.config.fontFamily);
      datasetText.setAttribute('font-weight', this.config.fontWeight);
      datasetText.setAttribute('fill', this.config.textColor);
      datasetText.setAttribute('text-anchor', 'start');
      datasetText.textContent = dataset.name || dataset.id || 'Unnamed Dataset';
      
      datasetGroup.appendChild(datasetText);
      
      // Calculate dataset text width
      const datasetTextWidth = this._estimateTextWidth(datasetText.textContent, this.config.fontSize);
      currentX += datasetTextWidth;

      // Add inline studies for this dataset
      const datasetStudies = this.studiesByDataset.get(dataset.id) || [];
      
      if (datasetStudies.length > 0) {
        currentX = this._addInlineStudies(datasetGroup, datasetStudies, currentX, itemY);
      }

      // Add dataset group to legend
      this.element.appendChild(datasetGroup);
      
      // Add spacing before next dataset group
      currentX += this.config.itemSpacing;
    });
  }

  /**
   * Add inline studies to a dataset group
   * @param {SVGElement} datasetGroup - Dataset group element
   * @param {Array} studies - Studies for this dataset
   * @param {number} startX - Starting X position
   * @param {number} itemY - Y position
   * @returns {number} Final X position after studies
   * @private
   */
  _addInlineStudies(datasetGroup, studies, startX, itemY) {
    let currentX = startX;
    
    studies.forEach((study, index) => {
      // Add separator
      const separator = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      separator.setAttribute('x', currentX + this.config.studySpacing);
      separator.setAttribute('y', itemY + this.config.studyFontSize / 3);
      separator.setAttribute('font-size', this.config.studyFontSize);
      separator.setAttribute('font-family', this.config.fontFamily);
      separator.setAttribute('fill', this.config.studyTextColor);
      separator.textContent = this.config.studySeparator;
      
      datasetGroup.appendChild(separator);
      
      const separatorWidth = this._estimateTextWidth(this.config.studySeparator, this.config.studyFontSize);
      currentX += this.config.studySpacing + separatorWidth + this.config.studySpacing;

      // Study color indicator (smaller circle)
      const studyIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      studyIndicator.setAttribute('cx', currentX + this.config.studyIndicatorSize / 2);
      studyIndicator.setAttribute('cy', itemY);
      studyIndicator.setAttribute('r', this.config.studyIndicatorSize / 2);
      studyIndicator.setAttribute('fill', study.color || '#666');
      studyIndicator.setAttribute('stroke', '#999');
      studyIndicator.setAttribute('stroke-width', '0.5');
      
      datasetGroup.appendChild(studyIndicator);
      currentX += this.config.studyIndicatorSize + this.config.studySpacing;

      // Study name text
      const studyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      studyText.setAttribute('x', currentX);
      studyText.setAttribute('y', itemY + this.config.studyFontSize / 3);
      studyText.setAttribute('font-size', this.config.studyFontSize);
      studyText.setAttribute('font-family', this.config.fontFamily);
      studyText.setAttribute('font-weight', 'normal');
      studyText.setAttribute('fill', this.config.studyTextColor);
      studyText.setAttribute('text-anchor', 'start');
      
      // Create compact study name (e.g., "SMA(20)", "BB(20,2)")
      const studyDisplayName = this._createStudyDisplayName(study);
      studyText.textContent = studyDisplayName;
      
      datasetGroup.appendChild(studyText);
      
      // Calculate study text width
      const studyTextWidth = this._estimateTextWidth(studyDisplayName, this.config.studyFontSize);
      currentX += studyTextWidth;
    });
    
    return currentX;
  }

  /**
   * Create compact display name for studies
   * @param {Object} study - Study object
   * @returns {string} Compact study name
   * @private
   */
  _createStudyDisplayName(study) {
    const type = study.type.toUpperCase();
    
    // Handle different study types with their key parameters
    switch (study.type.toLowerCase()) {
      case 'sma':
      case 'ema':
        return `${type}(${study.parameters.period || 20})`;
      
      case 'bollinger':
        const period = study.parameters.period || 20;
        const multiplier = study.parameters.multiplier || 2;
        return `BB(${period},${multiplier})`;
      
      case 'rsi':
        return `RSI(${study.parameters.period || 14})`;
      
      case 'macd':
        const fast = study.parameters.fastPeriod || 12;
        const slow = study.parameters.slowPeriod || 26;
        const signal = study.parameters.signalPeriod || 9;
        return `MACD(${fast},${slow},${signal})`;
      
      default:
        // Fallback to first parameter if available
        const firstParam = Object.values(study.parameters || {})[0];
        return firstParam ? `${type}(${firstParam})` : type;
    }
  }

  /**
   * Calculate legend layout with studies consideration
   * @private
   */
  _calculateLegendLayout(chartArea) {
    const totalWidth = this._estimateTotalWidth();
    
    // Center horizontally in chart area, but don't exceed bounds
    const maxWidth = chartArea.width - 40; // Leave margin
    const finalWidth = Math.min(totalWidth, maxWidth);
    const x = chartArea.x + (chartArea.width - finalWidth) / 2;
    
    // Position below title, above chart
    const y = chartArea.y - this.config.marginBottom + 15;
    
    return {
      x: x,
      y: y,
      totalWidth: finalWidth,
      height: Math.max(this.config.fontSize, this.config.studyFontSize) + this.config.padding * 2
    };
  }

  /**
   * Estimate total width needed for all datasets and their studies
   * @returns {number} Estimated total width
   * @private
   */
  _estimateTotalWidth() {
    let totalWidth = 0;
    
    this.datasets.forEach((dataset, index) => {
      // Dataset indicator + spacing + name
      const datasetName = dataset.name || dataset.id || 'Dataset';
      let itemWidth = this.config.indicatorSize + this.config.indicatorSpacing + 
                     this._estimateTextWidth(datasetName, this.config.fontSize);
      
      // Add studies width
      const datasetStudies = this.studiesByDataset.get(dataset.id) || [];
      datasetStudies.forEach(study => {
        const studyName = this._createStudyDisplayName(study);
        const separatorWidth = this._estimateTextWidth(this.config.studySeparator, this.config.studyFontSize);
        const studyWidth = separatorWidth + this.config.studySpacing * 2 + 
                          this.config.studyIndicatorSize + this.config.studySpacing +
                          this._estimateTextWidth(studyName, this.config.studyFontSize);
        itemWidth += studyWidth;
      });
      
      totalWidth += itemWidth;
      
      // Add spacing between dataset groups (except for last)
      if (index < this.datasets.length - 1) {
        totalWidth += this.config.itemSpacing;
      }
    });
    
    return totalWidth;
  }

  /**
   * Estimate text width based on font size
   * @param {string} text - Text to measure
   * @param {number} fontSize - Font size
   * @returns {number} Estimated width
   * @private
   */
  _estimateTextWidth(text, fontSize) {
    // Rough estimation: ~0.6em per character for Arial
    return text.length * fontSize * 0.6;
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
   * Update dataset color and refresh legend
   * @param {string} datasetId - ID of dataset that changed
   * @param {string} newColor - New color value
   */
  updateDatasetColor(datasetId, newColor) {
    const dataset = this.datasets.find(d => d.id === datasetId);
    if (dataset) {
      dataset.color = newColor;
      
      // Update the specific indicator in the DOM
      if (this.element) {
        const datasetGroup = this.element.querySelector(`[data-dataset-id="${datasetId}"]`);
        if (datasetGroup) {
          const indicator = datasetGroup.querySelector('rect');
          if (indicator) {
            indicator.setAttribute('fill', newColor);
          }
        }
      }
    }
  }

  /**
   * Update study color and refresh legend
   * @param {string} studyId - ID of study that changed
   * @param {string} newColor - New color value
   */
  updateStudyColor(studyId, newColor) {
    // Find the study across all datasets
    for (const [datasetId, studies] of this.studiesByDataset) {
      const study = studies.find(s => s.id === studyId);
      if (study) {
        study.color = newColor;
        this.render(); // Re-render to show color change
        break;
      }
    }
  }

  /**
   * Toggle study visibility
   * @param {string} studyId - Study ID to toggle
   */
  toggleStudyVisibility(studyId) {
    for (const [datasetId, studies] of this.studiesByDataset) {
      const study = studies.find(s => s.id === studyId);
      if (study) {
        study.visible = !study.visible;
        this._organizeStudiesByDataset(this._getAllStudiesFlat());
        this.render();
        break;
      }
    }
  }

  /**
   * Get all studies as flat array
   * @returns {Array} All studies
   * @private
   */
  _getAllStudiesFlat() {
    const allStudies = [];
    for (const studies of this.studiesByDataset.values()) {
      allStudies.push(...studies);
    }
    return allStudies;
  }

  /**
   * Get legend height for layout calculations
   */
  getHeight() {
    const maxFontSize = Math.max(this.config.fontSize, this.config.studyFontSize);
    return maxFontSize + this.config.padding * 2 + this.config.marginTop + this.config.marginBottom;
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
    this.studiesByDataset.clear();
  }
}
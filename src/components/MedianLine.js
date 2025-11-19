import { median } from '../utils/math.js';

export class MedianLine {
  constructor(config = {}) {
    this.config = {
      strokeColor: '#9C27B0',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      strokeDash: [8, 4],
      enabled: false,
      useAllDatasets: true,
      showLabel: true,
      labelText: 'Median',
      labelOffset: -70,
      labelVerticalOffset: 12,
      labelColor: '#9C27B0',
      labelFontSize: 11,
      labelPosition: 'right',
      ...config
    };

    this.svgElement = null;
    this.medianLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;

    this.scales = null;
    this.chartArea = null;
    this.datasets = [];

    this.currentMedian = null;

    this.isVisible = false;
    this.isRendered = false;

    this.siblingLines = new Set();
  }

  addSiblingLine(siblingLine) {
    this.siblingLines.add(siblingLine);
  }

  removeSiblingLine(siblingLine) {
    this.siblingLines.delete(siblingLine);
  }

  updateDatasets(datasets) {
    this.datasets = datasets || [];
    this._calculateMedian();

    if (this.isRendered) {
      this._renderMedianLine();
      if (this.config.enabled) {
        this.show();
      }
    }
  }

  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      return;
    }

    this.chartArea = chartArea;
    this.scales = scales;

    this._remove();
    this._createMedianLineSVG(container, chartArea);

    this._calculateMedian();
    this._renderMedianLine();

    this.isRendered = true;

    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (!this.isRendered) {
      return false;
    }

    if (!this._isMedianInRange()) {
      this.hide();
      return false;
    }

    this.config.enabled = true;
    this.isVisible = true;

    if (this.svgElement) {
      this.svgElement.style.display = 'block';
    }

    return true;
  }

  hide() {
    this.config.enabled = false;
    this.isVisible = false;

    if (this.svgElement) {
      this.svgElement.style.display = 'none';
    }

    return true;
  }

  toggle(show = null) {
    const newState = show !== null ? show : !this.config.enabled;

    if (newState) {
      return this.show();
    } else {
      return this.hide();
    }
  }

  updateScales(newScales) {
    this.scales = newScales;

    if (this.isRendered) {
      this._renderMedianLine();
      if (this.config.enabled) {
        this.show();
      }
    }
  }

  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;

    if (this.svgElement) {
      this.svgElement.setAttribute('width', newChartArea.width + newChartArea.x * 2);
      this.svgElement.setAttribute('height', newChartArea.height + newChartArea.y * 2);
    }

    if (this.isRendered) {
      this._renderMedianLine();
    }
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (this.isRendered) {
      this._renderMedianLine();
    }
  }

  getMedianValue() {
    return this.currentMedian;
  }

  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      hasScales: !!this.scales,
      hasChartArea: !!this.chartArea,
      datasetCount: this.datasets.length,
      currentMedian: this.currentMedian,
      medianInRange: this._isMedianInRange()
    };
  }

  _calculateMedian() {
    this.currentMedian = null;

    if (!this.datasets || this.datasets.length === 0) {
      return;
    }

    try {
      let allValues = [];

      if (this.config.useAllDatasets) {
        this.datasets.forEach(dataset => {
          if (dataset.data && Array.isArray(dataset.data)) {
            const values = dataset.data
              .map(point => this._extractYValue(point))
              .filter(value => value != null && isFinite(value));
            allValues.push(...values);
          }
        });
      } else {
        const firstDataset = this.datasets[0];
        if (firstDataset && firstDataset.data && Array.isArray(firstDataset.data)) {
          allValues = firstDataset.data
            .map(point => this._extractYValue(point))
            .filter(value => value != null && isFinite(value));
        }
      }

      if (allValues.length > 0) {
        this.currentMedian = median(allValues);
      }
    } catch (error) {
      this.currentMedian = null;
    }
  }

  _extractYValue(point) {
    const value = point.y || point.value || point.price || point.close || point.amount;
    return typeof value === 'number' ? value : null;
  }

  _createMedianLineSVG(container, chartArea) {
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.7';
    this.svgElement.style.pointerEvents = 'none';
    this.svgElement.setAttribute('class', 'median-line-svg');

    this.medianLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.medianLineGroup.setAttribute('class', 'visioncharts-median-line-group');
    this.svgElement.appendChild(this.medianLineGroup);

    container.appendChild(this.svgElement);
  }

  _renderMedianLine() {
    if (!this.medianLineGroup || !this.scales || !this.chartArea || this.currentMedian == null) {
      return;
    }

    this.medianLineGroup.innerHTML = '';
    this.lineElement = null;
    this.labelElement = null;

    if (!this._isMedianInRange()) {
      return;
    }

    try {
      const medianY = this.scales.y.scale(this.currentMedian);

      if (medianY < this.chartArea.y || medianY > this.chartArea.y + this.chartArea.height) {
        return;
      }

      this._createMedianLineElement(medianY);

      if (this.config.showLabel) {
        this._createMedianLabelElement(medianY);
      }
    } catch (error) {}
  }

  _createMedianLineElement(medianY) {
    this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineElement.setAttribute('class', 'visioncharts-median-line-line');
    this.lineElement.setAttribute('x1', this.chartArea.x);
    this.lineElement.setAttribute('x2', this.chartArea.x + this.chartArea.width);
    this.lineElement.setAttribute('y1', medianY);
    this.lineElement.setAttribute('y2', medianY);
    this.lineElement.setAttribute('stroke', this.config.strokeColor);
    this.lineElement.setAttribute('stroke-width', this.config.strokeWidth);
    this.lineElement.setAttribute('stroke-opacity', this.config.strokeOpacity);
    this.lineElement.setAttribute('shape-rendering', 'geometricPrecision');

    if (this.config.strokeDash.length > 0) {
      this.lineElement.setAttribute('stroke-dasharray', this.config.strokeDash.join(' '));
    }

    this.medianLineGroup.appendChild(this.lineElement);
  }

  _createMedianLabelElement(medianY) {
    this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.labelElement.setAttribute('class', 'visioncharts-median-line-label');

    const labelPosition = this._calculateLabelPosition(medianY);

    this.labelElement.setAttribute('x', labelPosition.x);
    this.labelElement.setAttribute('y', labelPosition.y);
    this.labelElement.setAttribute('font-size', this.config.labelFontSize);
    this.labelElement.setAttribute('font-family', 'Arial, sans-serif');
    this.labelElement.setAttribute('font-weight', '500');
    this.labelElement.setAttribute('fill', this.config.labelColor);
    this.labelElement.setAttribute('dominant-baseline', 'central');
    this.labelElement.setAttribute('text-anchor', 'start');

    const formattedMedian = this._formatValue(this.currentMedian);
    this.labelElement.textContent = `${this.config.labelText}: ${formattedMedian}`;

    this.medianLineGroup.appendChild(this.labelElement);
  }

  _calculateLabelPosition(lineY) {
    let labelX = this.chartArea.x + this.chartArea.width + this.config.labelOffset;
    let labelY = lineY + this.config.labelVerticalOffset;

    const overlappingSibling = this._findOverlappingSibling(lineY);

    if (overlappingSibling) {
      const siblingY = this.scales.y.scale(overlappingSibling.getCurrentValue());

      if (this.currentMedian > overlappingSibling.getCurrentValue()) {
        labelY = lineY - Math.abs(this.config.labelVerticalOffset) - 5;
      } else {
        labelY = lineY + Math.abs(this.config.labelVerticalOffset) + 5;
      }
    }

    const minY = this.chartArea.y + this.config.labelFontSize;
    const maxY = this.chartArea.y + this.chartArea.height - 5;

    labelY = Math.max(minY, Math.min(maxY, labelY));

    return { x: labelX, y: labelY };
  }

  _findOverlappingSibling(lineY) {
    const labelHeight = this.config.labelFontSize + 4;

    for (const sibling of this.siblingLines) {
      if (sibling.isVisible && sibling.getCurrentValue && sibling.getCurrentValue() != null) {
        const siblingY = this.scales.y.scale(sibling.getCurrentValue());
        const distance = Math.abs(lineY - siblingY);

        if (distance < labelHeight * 2) {
          return sibling;
        }
      }
    }

    return null;
  }

  getCurrentValue() {
    return this.currentMedian;
  }

  _formatValue(value) {
    if (value == null || !isFinite(value)) {
      return 'N/A';
    }

    const absValue = Math.abs(value);

    if (absValue >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    } else if (absValue >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (absValue >= 100) {
      return value.toFixed(0);
    } else if (absValue >= 1) {
      return value.toFixed(1);
    } else {
      return value.toFixed(2);
    }
  }

  _isMedianInRange() {
    if (!this.scales || !this.scales.y || this.currentMedian == null) {
      return false;
    }

    const yDomain = this.scales.y.domain;
    return this.currentMedian >= yDomain[0] && this.currentMedian <= yDomain[1];
  }

  _remove() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }

    this.svgElement = null;
    this.medianLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    this.isRendered = false;
  }

  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.datasets = [];
    this.currentMedian = null;
    this.isVisible = false;
    this.siblingLines.clear();
  }
}

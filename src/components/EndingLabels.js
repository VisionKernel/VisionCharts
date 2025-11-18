import { formatLargeNumber } from '../utils/chartUtils.js';

export class EndingLabels {
  constructor(config = {}) {
    this.config = {
      offsetX: 8,
      offsetY: 0,
      fontSize: 11,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '500',
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backgroundPadding: 4,
      borderRadius: 3,
      borderWidth: 1,
      formatValue: true,
      decimals: 1,
      enabled: false,
      ...config
    };

    this.svgGroup = null;
    this.labelElements = [];
    this.chartArea = null;
    this.datasets = [];
    this.isVisible = false;
    this.isRendered = false;
  }

  updateDatasets(datasets) {
    this.datasets = datasets || [];
    if (this.isRendered && this.isVisible) {
      this._renderLabels();
    }
  }

  render(svgContainer, chartArea) {
    if (!svgContainer || !chartArea) {
      return;
    }

    this.chartArea = chartArea;
    this.svgContainer = svgContainer;
    this._remove();

    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', 'ending-labels');
    this.svgGroup.style.pointerEvents = 'none';

    svgContainer.appendChild(this.svgGroup);
    this.isRendered = true;

    if (this.config.enabled && this.datasets.length > 0) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (!this.isRendered) {
      return false;
    }

    this.config.enabled = true;
    this.isVisible = true;

    if (this.svgGroup) {
      this.svgGroup.style.display = 'block';
      this._renderLabels();
    }

    return true;
  }

  hide() {
    this.config.enabled = false;
    this.isVisible = false;

    if (this.svgGroup) {
      this.svgGroup.style.display = 'none';
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

  _renderLabels() {
    if (!this.svgGroup) return;
    this.svgGroup.innerHTML = '';
    this.labelElements = [];
    if (!this.datasets || this.datasets.length === 0) {
      return;
    }
    this.datasets.forEach((dataset, index) => {
      const label = this._createDatasetLabel(dataset, index);
      if (label) {
        this.svgGroup.appendChild(label);
        this.labelElements.push(label);
      }
    });
  }

  _createDatasetLabel(dataset, datasetIndex) {
    if (!dataset || !dataset.data || dataset.data.length === 0) {
      return null;
    }

    const lastPoint = dataset.data[dataset.data.length - 1];
    if (!lastPoint) return null;

    const endX = lastPoint.unifiedX || lastPoint.screenX || lastPoint.pixelX;
    const endY = lastPoint.unifiedY || lastPoint.screenY || lastPoint.pixelY;

    if (endX == null || endY == null || !isFinite(endX) || !isFinite(endY)) {
      return null;
    }

    const tolerance = 100;
    const minX = Math.min(this.chartArea.x - tolerance, 0);
    const maxX = this.chartArea.x + this.chartArea.width + tolerance;
    const minY = Math.min(this.chartArea.y - tolerance, 0);
    const maxY = this.chartArea.y + this.chartArea.height + tolerance;

    if (endX < minX || endX > maxX || endY < minY || endY > maxY) {
      return null;
    }

    const value = this._extractValue(lastPoint);
    if (value == null) {
      return null;
    }

    const formattedValue = this._formatValue(value);
    const color = dataset.color || '#1468a8';

    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'ending-label');
    labelGroup.setAttribute('data-dataset-id', dataset.id || datasetIndex);

    const labelX = endX + this.config.offsetX;
    const labelY = endY + this.config.offsetY;

    if (this.config.showBackground) {
      const background = this._createLabelBackground(labelGroup, labelX, labelY, formattedValue, color);
      if (background) {
        labelGroup.appendChild(background);
      }
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelX + this.config.backgroundPadding);
    text.setAttribute('y', labelY);
    text.setAttribute('font-size', this.config.fontSize);
    text.setAttribute('font-family', this.config.fontFamily);
    text.setAttribute('font-weight', this.config.fontWeight);
    text.setAttribute('fill', this._getTextColor(color));
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('text-anchor', 'start');
    text.textContent = formattedValue;

    labelGroup.appendChild(text);

    return labelGroup;
  }

  _createLabelBackground(labelGroup, x, y, text, datasetColor) {
    const charWidth = this.config.fontSize * 0.6;
    const textWidth = text.length * charWidth;
    const textHeight = this.config.fontSize;

    const bgWidth = textWidth + (this.config.backgroundPadding * 2);
    const bgHeight = textHeight + (this.config.backgroundPadding * 2);

    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', x);
    background.setAttribute('y', y - (bgHeight / 2));
    background.setAttribute('width', bgWidth);
    background.setAttribute('height', bgHeight);
    background.setAttribute('fill', this.config.backgroundColor);
    background.setAttribute('stroke', datasetColor);
    background.setAttribute('stroke-width', this.config.borderWidth);
    background.setAttribute('rx', this.config.borderRadius);

    labelGroup._backgroundWidth = bgWidth;
    labelGroup._backgroundHeight = bgHeight;

    return background;
  }

  _extractValue(point) {
    const value = point.y || point.value || point.price || point.close || point.amount;
    if (typeof value === 'number' && isFinite(value)) {
      return value;
    }
    return null;
  }

  _formatValue(value) {
    if (value == null || !isFinite(value)) {
      return 'N/A';
    }
    if (this.config.formatValue) {
      return formatLargeNumber(value, { decimals: this.config.decimals });
    } else {
      return value.toFixed(this.config.decimals);
    }
  }

  _getTextColor(datasetColor) {
    return datasetColor;
  }

  updateDatasetColor(datasetId, newColor) {
    const labelElement = this.svgGroup?.querySelector(`[data-dataset-id="${datasetId}"]`);
    if (labelElement) {
      const textElement = labelElement.querySelector('text');
      const backgroundElement = labelElement.querySelector('rect');

      if (textElement) {
        textElement.setAttribute('fill', this._getTextColor(newColor));
      }

      if (backgroundElement) {
        backgroundElement.setAttribute('stroke', newColor);
      }
    }
  }

  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      labelCount: this.labelElements.length,
      datasetCount: this.datasets.length
    };
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    if (this.isRendered && this.isVisible) {
      this._renderLabels();
    }
  }

  _remove() {
    if (this.svgGroup && this.svgGroup.parentElement) {
      this.svgGroup.parentElement.removeChild(this.svgGroup);
    }
    this.svgGroup = null;
    this.labelElements = [];
    this.isRendered = false;
  }

  destroy() {
    this._remove();
    this.datasets = [];
    this.chartArea = null;
    this.svgContainer = null;
    this.isVisible = false;
    this.isRendered = false;
  }
}

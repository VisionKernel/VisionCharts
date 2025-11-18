export class Crosshair {
  constructor(config = {}) {
    this.config = {
      lineColor: '#666666',
      lineWidth: 1,
      lineOpacity: 0.7,
      lineDash: [2, 2],
      highlightRadius: 3,
      highlightStrokeWidth: 2,
      highlightStroke: '#ffffff',
      highlightOpacity: 1.0,
      enabled: true,
      ...config
    };

    this.svgGroup = null;
    this.verticalLine = null;
    this.horizontalLine = null;
    this.highlightGroup = null;

    this.isVisible = false;
    this.currentPosition = { x: 0, y: 0 };
    this.currentHighlights = [];
  }

  render(svgContainer, chartArea) {
    if (!svgContainer || !chartArea) return;

    this.chartArea = chartArea;
    this.svgContainer = svgContainer;

    this._remove();

    this.svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup.setAttribute('class', 'crosshair');
    this.svgGroup.style.pointerEvents = 'none';
    this.svgGroup.style.display = 'none';

    this._createCrosshairLines();
    this._createHighlightGroup();

    svgContainer.appendChild(this.svgGroup);
  }

  show() {
    if (!this.config.enabled || !this.svgGroup) return;
    this.svgGroup.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    if (!this.svgGroup) return;
    this.svgGroup.style.display = 'none';
    this.isVisible = false;
  }

  updatePosition(unifiedX, unifiedY) {
    if (!this.svgGroup || !this.chartArea) return;

    const clampedX = Math.max(
      this.chartArea.x,
      Math.min(this.chartArea.x + this.chartArea.width, unifiedX)
    );
    const clampedY = Math.max(
      this.chartArea.y,
      Math.min(this.chartArea.y + this.chartArea.height, unifiedY)
    );

    this.currentPosition = { x: clampedX, y: clampedY };

    if (this.verticalLine) {
      this.verticalLine.setAttribute('x1', clampedX);
      this.verticalLine.setAttribute('x2', clampedX);
      this.verticalLine.setAttribute('y1', this.chartArea.y);
      this.verticalLine.setAttribute('y2', this.chartArea.y + this.chartArea.height);
    }

    if (this.horizontalLine) {
      this.horizontalLine.setAttribute('x1', this.chartArea.x);
      this.horizontalLine.setAttribute('x2', this.chartArea.x + this.chartArea.width);
      this.horizontalLine.setAttribute('y1', clampedY);
      this.horizontalLine.setAttribute('y2', clampedY);
    }
  }

  updateHighlights(dataPoints = []) {
    if (!this.highlightGroup) return;

    this.highlightGroup.innerHTML = '';
    this.currentHighlights = [];

    dataPoints.forEach((point, index) => {
      if (point && point.unifiedX != null && point.unifiedY != null) {
        this._createPointHighlight(point, index);
      }
    });
  }

  getState() {
    return {
      isVisible: this.isVisible,
      enabled: this.config.enabled,
      position: this.currentPosition,
      highlightCount: this.currentHighlights.length
    };
  }

  _createCrosshairLines() {
    this.verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.verticalLine.setAttribute('class', 'crosshair-vertical');
    this.verticalLine.setAttribute('stroke', this.config.lineColor);
    this.verticalLine.setAttribute('stroke-width', this.config.lineWidth);
    this.verticalLine.setAttribute('stroke-opacity', this.config.lineOpacity);
    this.verticalLine.setAttribute('stroke-dasharray', this.config.lineDash.join(' '));
    this.verticalLine.setAttribute('shape-rendering', 'crispEdges');

    this.horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.horizontalLine.setAttribute('class', 'crosshair-horizontal');
    this.horizontalLine.setAttribute('stroke', this.config.lineColor);
    this.horizontalLine.setAttribute('stroke-width', this.config.lineWidth);
    this.horizontalLine.setAttribute('stroke-opacity', this.config.lineOpacity);
    this.horizontalLine.setAttribute('stroke-dasharray', this.config.lineDash.join(' '));
    this.horizontalLine.setAttribute('shape-rendering', 'crispEdges');

    this.svgGroup.appendChild(this.verticalLine);
    this.svgGroup.appendChild(this.horizontalLine);
  }

  _createHighlightGroup() {
    this.highlightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.highlightGroup.setAttribute('class', 'crosshair-highlights');
    this.svgGroup.appendChild(this.highlightGroup);
  }

  _createPointHighlight(dataPoint, index) {
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    highlight.setAttribute('class', 'crosshair-highlight');
    highlight.setAttribute('cx', dataPoint.unifiedX);
    highlight.setAttribute('cy', dataPoint.unifiedY);
    highlight.setAttribute('r', this.config.highlightRadius);

    const fillColor = dataPoint.color || dataPoint.dataset?.color || '#1468a8';
    highlight.setAttribute('fill', fillColor);
    highlight.setAttribute('fill-opacity', this.config.highlightOpacity);

    highlight.setAttribute('stroke', this.config.highlightStroke);
    highlight.setAttribute('stroke-width', this.config.highlightStrokeWidth);

    this.highlightGroup.appendChild(highlight);
    this.currentHighlights.push({
      element: highlight,
      dataPoint: dataPoint,
      index: index
    });
  }

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

  destroy() {
    this._remove();
    this.svgContainer = null;
    this.chartArea = null;
    this.currentPosition = { x: 0, y: 0 };
    this.isVisible = false;
  }
}

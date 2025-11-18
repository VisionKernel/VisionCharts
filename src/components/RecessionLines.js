export class RecessionLines {
  constructor(config = {}) {
    this.config = {
      fillColor: 'rgba(128, 128, 128, 0.2)',
      strokeColor: 'rgba(128, 128, 128, 0.3)',
      strokeWidth: 0,
      enabled: false,
      useThemeColors: true,
      recessionData: [],
      ...config
    };

    this.svgElement = null;
    this.recessionGroup = null;
    this.parentSvg = null;
    this.currentRecessions = [];
    this.scales = null;
    this.chartArea = null;
    this.isVisible = false;
    this.isRendered = false;
  }

  setRecessionData(recessionData) {
    if (!Array.isArray(recessionData)) {
      return this;
    }

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

    if (this.isRendered) {
      this._updateVisibleRecessions();
      this._renderRecessionRects();
    }

    return this;
  }

  _parseDate(dateValue) {
    if (typeof dateValue === 'number') {
      return dateValue;
    }

    if (typeof dateValue === 'string') {
      return new Date(dateValue).getTime();
    }

    if (dateValue instanceof Date) {
      return dateValue.getTime();
    }

    return Date.now();
  }

  _getRecessionsByDateRange(startTime, endTime) {
    if (!Array.isArray(this.config.recessionData)) {
      return [];
    }

    return this.config.recessionData.filter(recession => {
      return recession.start <= endTime && recession.end >= startTime;
    });
  }

  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      return;
    }

    this.chartArea = chartArea;
    this.scales = scales;

    const isSvgContainer = container.tagName === 'svg';

    if (isSvgContainer) {
      this._renderIntoExistingSVG(container);
    } else {
      this._renderWithOwnSVG(container);
    }

    this._updateVisibleRecessions();
    this._renderRecessionRects();
    this.isRendered = true;

    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }

  _renderIntoExistingSVG(svgContainer) {
    this._removeFromSVG(svgContainer);
    this._createRecessionGroup(svgContainer);
  }

  _renderWithOwnSVG(container) {
    this._removeOwnSVG();
    this._createRecessionSVG(container);
  }

  _createRecessionSVG(container) {
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', container.offsetWidth);
    this.svgElement.setAttribute('height', container.offsetHeight);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.5';
    this.svgElement.style.pointerEvents = 'none';
    this.svgElement.setAttribute('class', 'recession-lines-svg');

    this.recessionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.recessionGroup.setAttribute('class', 'recession-periods');
    this.svgElement.appendChild(this.recessionGroup);

    container.appendChild(this.svgElement);
    this.parentSvg = this.svgElement;
  }

  _createRecessionGroup(svgContainer) {
    this.recessionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.recessionGroup.setAttribute('class', 'recession-periods');
    this.recessionGroup.style.pointerEvents = 'none';
    svgContainer.appendChild(this.recessionGroup);
    this.parentSvg = svgContainer;
  }

  _removeFromSVG(svgContainer) {
    const existingGroups = svgContainer.querySelectorAll('.recession-periods');
    existingGroups.forEach(group => {
      if (group.parentNode) {
        group.parentNode.removeChild(group);
      }
    });
  }

  _removeOwnSVG() {
    if (this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }
    this.svgElement = null;
  }

  show() {
    if (!this.isRendered) {
      return false;
    }

    this.config.enabled = true;
    this.isVisible = true;

    if (this.svgElement) {
      this.svgElement.style.display = 'block';
    } else if (this.recessionGroup) {
      this.recessionGroup.style.display = 'block';
    }

    return true;
  }

  hide() {
    this.config.enabled = false;
    this.isVisible = false;

    if (this.svgElement) {
      this.svgElement.style.display = 'none';
    } else if (this.recessionGroup) {
      this.recessionGroup.style.display = 'none';
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
      this._updateVisibleRecessions();
      this._renderRecessionRects();
    }
  }

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

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (this.isRendered) {
      this._renderRecessionRects();
    }
  }

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

  _updateVisibleRecessions() {
    if (!this.scales || !this.scales.x) {
      this.currentRecessions = [];
      return;
    }

    const xDomain = this.scales.x.domain;
    const chartStartTime = xDomain[0];
    const chartEndTime = xDomain[1];

    this.currentRecessions = this._getRecessionsByDateRange(chartStartTime, chartEndTime);
  }

  _renderRecessionRects() {
    if (!this.recessionGroup || !this.scales || !this.chartArea) {
      return;
    }

    this.recessionGroup.innerHTML = '';

    const colors = this._getCurrentColors();

    this.currentRecessions.forEach((recession, index) => {
      const rect = this._createRecessionRect(recession, colors, index);
      if (rect) {
        this.recessionGroup.appendChild(rect);
      }
    });
  }

  _createRecessionRect(recession, colors, index) {
    try {
      const startX = this.scales.x.scale(recession.start);
      const endX = this.scales.x.scale(recession.end);

      if (endX < this.chartArea.x || startX > this.chartArea.x + this.chartArea.width) {
        return null;
      }

      const clampedStartX = Math.max(startX, this.chartArea.x);
      const clampedEndX = Math.min(endX, this.chartArea.x + this.chartArea.width);
      const rectWidth = clampedEndX - clampedStartX;

      if (rectWidth < 1) {
        return null;
      }

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'recession-period');
      rect.setAttribute('x', clampedStartX);
      rect.setAttribute('y', this.chartArea.y);
      rect.setAttribute('width', rectWidth);
      rect.setAttribute('height', this.chartArea.height);
      rect.setAttribute('fill', colors.fill);

      if (this.config.strokeWidth > 0) {
        rect.setAttribute('stroke', colors.stroke);
        rect.setAttribute('stroke-width', this.config.strokeWidth);
      }

      rect.setAttribute('data-recession-start', recession.startDate);
      rect.setAttribute('data-recession-end', recession.endDate);
      rect.setAttribute('data-recession-index', index);

      if (recession.name) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = recession.name;
        rect.appendChild(title);
      }

      return rect;
    } catch (error) {
      return null;
    }
  }

  _getCurrentColors() {
    return {
      fill: this.config.fillColor,
      stroke: this.config.strokeColor
    };
  }

  _remove() {
    this._removeOwnSVG();

    if (this.recessionGroup && this.recessionGroup.parentNode) {
      this.recessionGroup.parentNode.removeChild(this.recessionGroup);
    }

    this.recessionGroup = null;
    this.parentSvg = null;
    this.isRendered = false;
  }

  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.currentRecessions = [];
    this.config.recessionData = [];
    this.isVisible = false;
  }
}

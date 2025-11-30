export class ZeroLine {
  constructor(config = {}) {
    this.config = {
      strokeColor: '#000000',
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDash: [3, 3],
      enabled: false,
      showLabel: false,
      labelText: '0',
      labelOffset: 5,
      labelColor: '#000000',
      labelFontSize: 11,
      ...config
    };

    this.svgElement = null;
    this.zeroLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;

    this.scales = null;
    this.chartArea = null;

    this.isVisible = false;
    this.isRendered = false;
    this.isEmbedded = false; // Track if rendered into existing SVG
  }

  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      return;
    }

    this.chartArea = chartArea;
    this.scales = scales;

    this._remove();

    // Check if container is an SVG element
    const isSvgContainer = container.tagName === 'svg';

    if (isSvgContainer) {
      this._renderIntoExistingSVG(container);
    } else {
      this._renderWithOwnSVG(container, chartArea);
    }

    this._renderZeroLine();

    this.isRendered = true;

    if (this.config.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }

  _renderIntoExistingSVG(svgContainer) {
    this.isEmbedded = true;
    this.svgElement = null; // No separate SVG element when embedded

    // Remove any existing group from this SVG
    const existingGroup = svgContainer.querySelector('.zero-line-group');
    if (existingGroup) {
      existingGroup.remove();
    }

    // Create and append the group directly to the SVG overlay
    this.zeroLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.zeroLineGroup.setAttribute('class', 'zero-line-group');
    svgContainer.appendChild(this.zeroLineGroup);

    // Store reference to parent SVG for cleanup
    this._parentSvg = svgContainer;
  }

  _renderWithOwnSVG(container, chartArea) {
    this.isEmbedded = false;
    this._createZeroLineSVG(container, chartArea);
  }

  show() {
    if (!this.isRendered) {
      return false;
    }

    const yScale = this.scales.y;
    if (!yScale) {
      return false;
    }

    const yDomain = yScale.domain;
    const zeroInRange = 0 >= yDomain[0] && 0 <= yDomain[1];

    if (!zeroInRange) {
      this.hide();
      return false;
    }

    this.config.enabled = true;
    this.isVisible = true;

    if (this.isEmbedded) {
      // When embedded, toggle the group visibility
      if (this.zeroLineGroup) {
        this.zeroLineGroup.style.display = 'block';
      }
    } else {
      // When using own SVG, toggle the SVG element
      if (this.svgElement) {
        this.svgElement.style.display = 'block';
      }
    }

    return true;
  }

  hide() {
    this.config.enabled = false;
    this.isVisible = false;

    if (this.isEmbedded) {
      if (this.zeroLineGroup) {
        this.zeroLineGroup.style.display = 'none';
      }
    } else {
      if (this.svgElement) {
        this.svgElement.style.display = 'none';
      }
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
      this._renderZeroLine();
      if (this.config.enabled) {
        this.show();
      }
    }
  }

  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;

    // Only update SVG dimensions if we have our own SVG element
    if (!this.isEmbedded && this.svgElement) {
      this.svgElement.setAttribute('width', newChartArea.width + newChartArea.x * 2);
      this.svgElement.setAttribute('height', newChartArea.height + newChartArea.y * 2);
    }

    if (this.isRendered) {
      this._renderZeroLine();
    }
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (this.isRendered) {
      this._renderZeroLine();
    }
  }

  getState() {
    return {
      enabled: this.config.enabled,
      isVisible: this.isVisible,
      isRendered: this.isRendered,
      hasScales: !!this.scales,
      hasChartArea: !!this.chartArea,
      zeroInRange: this._isZeroInRange()
    };
  }

  _createZeroLineSVG(container, chartArea) {
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', chartArea.width + chartArea.x * 2);
    this.svgElement.setAttribute('height', chartArea.height + chartArea.y * 2);
    this.svgElement.style.position = 'absolute';
    this.svgElement.style.top = '0';
    this.svgElement.style.left = '0';
    this.svgElement.style.zIndex = '1.5';
    this.svgElement.style.pointerEvents = 'none';
    this.svgElement.setAttribute('class', 'zero-line-svg');

    this.zeroLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.zeroLineGroup.setAttribute('class', 'zero-line-group');
    this.svgElement.appendChild(this.zeroLineGroup);

    container.appendChild(this.svgElement);
  }

  _renderZeroLine() {
    if (!this.zeroLineGroup || !this.scales || !this.chartArea) {
      return;
    }

    this.zeroLineGroup.innerHTML = '';
    this.lineElement = null;
    this.labelElement = null;

    if (!this._isZeroInRange()) {
      return;
    }

    try {
      const zeroY = this.scales.y.scale(0);

      if (zeroY < this.chartArea.y || zeroY > this.chartArea.y + this.chartArea.height) {
        return;
      }

      this._createZeroLineElement(zeroY);

      if (this.config.showLabel) {
        this._createZeroLabelElement(zeroY);
      }
    } catch (error) {
      // intentionally left blank
    }
  }

  _createZeroLineElement(zeroY) {
    this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.lineElement.setAttribute('class', 'zero-line');
    this.lineElement.setAttribute('x1', this.chartArea.x);
    this.lineElement.setAttribute('x2', this.chartArea.x + this.chartArea.width);
    this.lineElement.setAttribute('y1', zeroY);
    this.lineElement.setAttribute('y2', zeroY);
    this.lineElement.setAttribute('stroke', this.config.strokeColor);
    this.lineElement.setAttribute('stroke-width', this.config.strokeWidth);
    this.lineElement.setAttribute('stroke-opacity', this.config.strokeOpacity);
    this.lineElement.setAttribute('shape-rendering', 'crispEdges');

    if (this.config.strokeDash.length > 0) {
      this.lineElement.setAttribute('stroke-dasharray', this.config.strokeDash.join(' '));
    }

    this.zeroLineGroup.appendChild(this.lineElement);
  }

  _createZeroLabelElement(zeroY) {
    this.labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.labelElement.setAttribute('class', 'zero-line-label');
    this.labelElement.setAttribute('x', this.chartArea.x + this.chartArea.width + this.config.labelOffset);
    this.labelElement.setAttribute('y', zeroY);
    this.labelElement.setAttribute('font-size', this.config.labelFontSize);
    this.labelElement.setAttribute('font-family', 'Arial, sans-serif');
    this.labelElement.setAttribute('fill', this.config.labelColor);
    this.labelElement.setAttribute('dominant-baseline', 'central');
    this.labelElement.setAttribute('text-anchor', 'start');
    this.labelElement.textContent = this.config.labelText;

    this.zeroLineGroup.appendChild(this.labelElement);
  }

  _isZeroInRange() {
    if (!this.scales || !this.scales.y) {
      return false;
    }

    const yDomain = this.scales.y.domain;
    return 0 >= yDomain[0] && 0 <= yDomain[1];
  }

  _remove() {
    // Handle embedded mode (group inside existing SVG)
    if (this.isEmbedded && this.zeroLineGroup) {
      if (this.zeroLineGroup.parentElement) {
        this.zeroLineGroup.parentElement.removeChild(this.zeroLineGroup);
      }
    }

    // Handle standalone mode (own SVG element)
    if (!this.isEmbedded && this.svgElement && this.svgElement.parentElement) {
      this.svgElement.parentElement.removeChild(this.svgElement);
    }

    this.svgElement = null;
    this.zeroLineGroup = null;
    this.lineElement = null;
    this.labelElement = null;
    this.isRendered = false;
    this._parentSvg = null;
  }

  destroy() {
    this._remove();
    this.scales = null;
    this.chartArea = null;
    this.isVisible = false;
    this.isEmbedded = false;
  }
}
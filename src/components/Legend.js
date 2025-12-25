export class Legend {
  constructor(config = {}) {
    this.themeManager = config.themeManager || null;

    const themeTextColor = this.themeManager?.getColor('legend.text') || '#333333';
    const themeStudyTextColor = this.themeManager?.getColor('text') || '#666666';
    const themeBgColor = this.themeManager?.getColor('legend.background') || 'rgba(255, 255, 255, 0.9)';
    const themeBorderColor = this.themeManager?.getColor('legend.border') || '#e0e0e0';

    this.config = {
      position: 'top-center',
      marginTop: 20,
      marginBottom: 20,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      textColor: config.textColor || themeTextColor,
      studyFontSize: 10,
      studyTextColor: config.studyTextColor || themeStudyTextColor,
      studyIndicatorSize: 6,
      studySeparator: ' • ',
      itemSpacing: 25,
      indicatorSize: 10,
      indicatorSpacing: 6,
      studySpacing: 4,
      backgroundColor: config.backgroundColor || themeBgColor,
      border: config.border || `1px solid ${themeBorderColor}`,
      borderRadius: 4,
      padding: 8,
      ...config
    };

    this.element = null;
    this.datasets = [];
    this.studiesByDataset = new Map();
  }

  updateDatasets(datasets, studies = []) {
    this.datasets = datasets || [];
    this._organizeStudiesByDataset(studies);
  }

  updateStudies(studies) {
    this._organizeStudiesByDataset(studies);
    this.render();
  }

  updateThemeColors(colors) {
    if (colors.textColor) this.config.textColor = colors.textColor;
    if (colors.studyTextColor) this.config.studyTextColor = colors.studyTextColor;
    if (colors.backgroundColor) this.config.backgroundColor = colors.backgroundColor;
    if (colors.border) this.config.border = colors.border;
  }

  _organizeStudiesByDataset(studies) {
    this.studiesByDataset.clear();

    studies.forEach(study => {
      if (!study.datasetId || !study.visible) {
        return;
      }

      if (!this.studiesByDataset.has(study.datasetId)) {
        this.studiesByDataset.set(study.datasetId, []);
      }

      this.studiesByDataset.get(study.datasetId).push(study);
    });
  }

  render(svgContainer, chartArea, options = {}) {
    if (!svgContainer || !chartArea) {
      return;
    }

    this._remove();

    if (!this.datasets || this.datasets.length === 0) {
      return;
    }

    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.element.setAttribute('class', 'chart-legend');

    const legendData = this._calculateLegendLayout(chartArea);

    this._createLegendItemsWithStudies(legendData);

    svgContainer.appendChild(this.element);
  }

  _createLegendItemsWithStudies(legendData) {
    let currentX = legendData.x;
    const itemY = legendData.y;

    this.datasets.forEach((dataset, index) => {
      const datasetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      datasetGroup.setAttribute('class', 'legend-dataset-group');
      datasetGroup.setAttribute('data-dataset-id', dataset.id);

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

      const datasetTextWidth = this._estimateTextWidth(datasetText.textContent, this.config.fontSize);
      currentX += datasetTextWidth;

      const datasetStudies = this.studiesByDataset.get(dataset.id) || [];

      if (datasetStudies.length > 0) {
        currentX = this._addInlineStudies(datasetGroup, datasetStudies, currentX, itemY);
      }

      this.element.appendChild(datasetGroup);

      currentX += this.config.itemSpacing;
    });
  }

  _addInlineStudies(datasetGroup, studies, startX, itemY) {
    let currentX = startX;

    studies.forEach((study, index) => {
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

      const studyIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      studyIndicator.setAttribute('cx', currentX + this.config.studyIndicatorSize / 2);
      studyIndicator.setAttribute('cy', itemY);
      studyIndicator.setAttribute('r', this.config.studyIndicatorSize / 2);
      studyIndicator.setAttribute('fill', study.color || '#666');
      studyIndicator.setAttribute('stroke', '#999');
      studyIndicator.setAttribute('stroke-width', '0.5');

      datasetGroup.appendChild(studyIndicator);
      currentX += this.config.studyIndicatorSize + this.config.studySpacing;

      const studyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      studyText.setAttribute('x', currentX);
      studyText.setAttribute('y', itemY + this.config.studyFontSize / 3);
      studyText.setAttribute('font-size', this.config.studyFontSize);
      studyText.setAttribute('font-family', this.config.fontFamily);
      studyText.setAttribute('font-weight', 'normal');
      studyText.setAttribute('fill', this.config.studyTextColor);
      studyText.setAttribute('text-anchor', 'start');

      const studyDisplayName = this._createStudyDisplayName(study);
      studyText.textContent = studyDisplayName;

      datasetGroup.appendChild(studyText);

      const studyTextWidth = this._estimateTextWidth(studyDisplayName, this.config.studyFontSize);
      currentX += studyTextWidth;
    });

    return currentX;
  }

  _createStudyDisplayName(study) {
    const type = study.type.toUpperCase();

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
        const firstParam = Object.values(study.parameters || {})[0];
        return firstParam ? `${type}(${firstParam})` : type;
    }
  }

  _calculateLegendLayout(chartArea) {
    const totalWidth = this._estimateTotalWidth();

    const maxWidth = chartArea.width - 40;
    const finalWidth = Math.min(totalWidth, maxWidth);
    const legendHeight = Math.max(this.config.fontSize, this.config.studyFontSize) + this.config.padding * 2;

    const position = this.config.position || 'top-center';
    const { x, y } = this._calculatePosition(position, chartArea, finalWidth, legendHeight);

    return {
      x: x,
      y: y,
      totalWidth: finalWidth,
      height: legendHeight
    };
  }

  _calculatePosition(position, chartArea, legendWidth, legendHeight) {
    const margin = 10;
    let x, y;

    // Parse position string (e.g., 'top-left', 'bottom-center', 'center')
    const parts = position.toLowerCase().split('-');
    const vertical = parts.find(p => ['top', 'bottom', 'middle'].includes(p)) || 'top';
    const horizontal = parts.find(p => ['left', 'center', 'right'].includes(p)) || 'center';

    // Calculate horizontal position
    switch (horizontal) {
      case 'left':
        x = chartArea.x + margin;
        break;
      case 'right':
        x = chartArea.x + chartArea.width - legendWidth - margin;
        break;
      case 'center':
      default:
        x = chartArea.x + (chartArea.width - legendWidth) / 2;
        break;
    }

    // Calculate vertical position
    switch (vertical) {
      case 'top':
        y = chartArea.y + margin;
        break;
      case 'bottom':
        y = chartArea.y + chartArea.height - legendHeight - margin;
        break;
      case 'middle':
        y = chartArea.y + (chartArea.height - legendHeight) / 2;
        break;
      default:
        y = chartArea.y + margin;
        break;
    }

    return { x, y };
  }

  _estimateTotalWidth() {
    let totalWidth = 0;

    this.datasets.forEach((dataset, index) => {
      const datasetName = dataset.name || dataset.id || 'Dataset';
      let itemWidth = this.config.indicatorSize + this.config.indicatorSpacing +
        this._estimateTextWidth(datasetName, this.config.fontSize);

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

      if (index < this.datasets.length - 1) {
        totalWidth += this.config.itemSpacing;
      }
    });

    return totalWidth;
  }

  _estimateTextWidth(text, fontSize) {
    return text.length * fontSize * 0.6;
  }

  _remove() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
      this.element = null;
    }
  }

  updateDatasetColor(datasetId, newColor) {
    const dataset = this.datasets.find(d => d.id === datasetId);
    if (dataset) {
      dataset.color = newColor;

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

  updateStudyColor(studyId, newColor) {
    for (const [datasetId, studies] of this.studiesByDataset) {
      const study = studies.find(s => s.id === studyId);
      if (study) {
        study.color = newColor;
        this.render();
        break;
      }
    }
  }

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

  _getAllStudiesFlat() {
    const allStudies = [];
    for (const studies of this.studiesByDataset.values()) {
      allStudies.push(...studies);
    }
    return allStudies;
  }

  getHeight() {
    const maxFontSize = Math.max(this.config.fontSize, this.config.studyFontSize);
    return maxFontSize + this.config.padding * 2 + this.config.marginTop + this.config.marginBottom;
  }

  setVisible(visible) {
    if (this.element) {
      this.element.style.display = visible ? 'block' : 'none';
    }
  }

  setPosition(position) {
    this.config.position = position;
    // Re-render is handled by the caller (Chart or PanelManager)
  }

  destroy() {
    this._remove();
    this.datasets = [];
    this.studiesByDataset.clear();
  }
}

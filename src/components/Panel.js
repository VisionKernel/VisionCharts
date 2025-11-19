import { Axis } from '../core/Axis.js';
import { Scale } from '../core/Scale.js';
import PanelDataRenderer from './PanelDataRenderer.js';
import { RecessionLines } from './RecessionLines.js';
import { ZeroLine } from './ZeroLine.js';
import { Grid } from './Grid.js';
import { StatisticalLines } from './StatisticalLines.js';

export class Panel {
  constructor(config = {}) {
    this.config = {
      dataset: null,
      chartArea: null,
      panelIndex: 0,
      totalPanels: 1,
      sharedXScale: null,
      container: null,
      chartType: 'line',
      hasSharedXAxis: false,
      isLogarithmic: false,
      height: 200,
      padding: {
        top: Math.max(5, Math.floor(config.height * 0.05) || 8),
        bottom: config.hasSharedXAxis ? 2 : Math.max(5, Math.floor(config.height * 0.05) || 8),
        left: 60,
        right: 20
      },
      showAxisLabels: true,
      showTitle: true,
      rendererType: 'canvas',
      ...config
    };

    this.chart = config.chart;

    if (config.height) {
      this.config.padding.top = Math.max(5, Math.floor(config.height * 0.05));
      this.config.padding.bottom = config.hasSharedXAxis ? 2 : Math.max(5, Math.floor(config.height * 0.05));
    }

    this.isInitialized = false;
    this.isRendered = false;

    this.yScale = null;
    this.yAxis = null;
    this.panelDataRenderer = null;
    this.grid = null;
    this.recessionLines = null;
    this.canvas = null;
    this.rendererInstance = null;
    this.svgOverlay = null;
    this.panelChartArea = null;
    this.statisticalLines = null;
    this.zeroLine = null;
    this.studiesRenderer = null;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (!this.config.dataset || !this.config.container || !this.config.sharedXScale) {
      throw new Error('Panel requires dataset, container, and shared X scale');
    }

    this._createPanelContainer();
    this._calculateChartArea();
    this._createYScale();
    this._createYAxis();
    this._createDataRenderer();
    this._createGrid();
    this._createRecessionLines();
    this._createStatisticalLines();
    this._createZeroLine();
    this._createStudiesRenderer();
    await this._initializeRenderer();

    this.isInitialized = true;
  }

  async render() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this._clearPanel();

      if (this.grid && this.config.showGrid !== false) {
        this._renderGrid();
      }

      this._renderYAxis();

      await this.panelDataRenderer.render(
        this.config.dataset,
        this.config.sharedXScale,
        this.yScale,
        this.panelChartArea,
        this.rendererInstance
      );

      if (this.config.showTitle) {
        this._renderPanelTitle();
      }

      this._renderStatisticalLines();
      this._renderZeroLine();
      this._renderRecessionLines();

      if (this.studiesRenderer && this.chart.studiesManager) {
        await this.studiesRenderer.renderPanelStudies(this);
      }

      this.isRendered = true;
    } catch (error) {
      throw error;
    }
  }

  async update(newDataset = null) {
    if (newDataset) {
      this.config.dataset = newDataset;
      this._createYScale();
      this._createYAxis();

      if (this.grid) {
        this.grid.updateScales(this.config.sharedXScale, this.yScale);
        this.grid.updateChartArea(this.panelChartArea);
      }
    }

    await this.render();
  }

  destroy() {
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
      this.rendererInstance = null;
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    if (this.svgOverlay && this.svgOverlay.parentNode) {
      this.svgOverlay.parentNode.removeChild(this.svgOverlay);
    }

    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
    }

    if (this.recessionLines) {
      this.recessionLines.destroy();
      this.recessionLines = null;
    }

    if (this.statisticalLines) {
      this.statisticalLines.destroy();
      this.statisticalLines = null;
    }

    if (this.zeroLine) {
      this.zeroLine.destroy();
      this.zeroLine = null;
    }

    if (this.studiesRenderer) {
      this.studiesRenderer = null;
    }

    this.yScale = null;
    this.yAxis = null;
    this.panelDataRenderer = null;
    this.grid = null;
    this.canvas = null;
    this.svgOverlay = null;
    this.panelContainer = null;

    this.isInitialized = false;
    this.isRendered = false;
  }

  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panel-container';
    this.panelContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: ${this.config.height}px;
      overflow: hidden;
      border-bottom: ${this.config.panelIndex < this.config.totalPanels - 1 ? '1px solid #eee' : 'none'};
      box-sizing: border-box;
    `;
    this.config.container.appendChild(this.panelContainer);
  }

  _calculateChartArea() {
    const containerRect = this.panelContainer.getBoundingClientRect();

    this.panelChartArea = {
      x: this.config.padding.left,
      y: this.config.padding.top,
      width: containerRect.width - this.config.padding.left - this.config.padding.right,
      height: this.config.height - this.config.padding.top - this.config.padding.bottom
    };
  }

  _createYScale() {
    if (!this.config.dataset || !this.config.dataset.data) {
      throw new Error('Panel dataset required for Y scale creation');
    }

    const yValues = this.config.dataset.data
      .map(d => d.y)
      .filter(y => y != null && !isNaN(y));

    if (yValues.length === 0) {
      throw new Error('No valid Y values found in panel dataset');
    }

    let yMin = Math.min(...yValues);
    let yMax = Math.max(...yValues);

    if (yMin === yMax) {
      const expansion = yMin !== 0 ? Math.abs(yMin) * 0.1 : 1;
      yMin = yMin - expansion;
      yMax = yMax + expansion;
    }

    const yDataRange = yMax - yMin;
    const yPadding = yDataRange * 0.05;
    const yDomain = [yMin - yPadding, yMax + yPadding];
    const scaleType = 'linear';
    const yRange = [this.panelChartArea.y + this.panelChartArea.height, this.panelChartArea.y];

    this.yScale = new Scale({
      type: scaleType,
      domain: yDomain,
      range: yRange,
      coordinateSystem: 'unified',
      orientation: 'vertical',
      options: {
        nice: false,
        padding: 0,
        clamp: true
      }
    });
  }

  _createYAxis() {
    const availableHeight = this.panelChartArea.height;
    const minTickSpacing = 20;
    const maxTicks = Math.max(2, Math.floor(availableHeight / minTickSpacing));
    const optimalTicks = Math.min(5, maxTicks);

    const axisOptions = {
      label: this.config.yAxisName || 'Value',
      fontSize: Math.max(9, Math.min(11, this.config.height / 20)),
      color: '#666',
      showAxisLine: true,
      showTicks: true,
      showTickLabels: true,
      tickCount: optimalTicks,
      tickPadding: 4
    };

    if (this.config.isLogarithmic) {
      axisOptions.abbreviateLabels = false;
      axisOptions.tickFormatOptions = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      };
    } else {
      axisOptions.abbreviateLabels = true;
    }

    this.yAxis = new Axis({
      orientation: 'y',
      scale: this.yScale,
      options: axisOptions
    });
  }

  _createDataRenderer() {
    this.panelDataRenderer = new PanelDataRenderer({
      chartType: this.config.chartType,
      rendererType: this.config.rendererType
    });
  }

  async _initializeRenderer() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.pointerEvents = 'none';

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.panelContainer.offsetWidth * dpr;
    this.canvas.height = this.config.height * dpr;
    this.canvas.style.width = `${this.panelContainer.offsetWidth}px`;
    this.canvas.style.height = `${this.config.height}px`;

    this.panelContainer.appendChild(this.canvas);

    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgOverlay.style.position = 'absolute';
    this.svgOverlay.style.left = '0';
    this.svgOverlay.style.top = '0';
    this.svgOverlay.style.width = '100%';
    this.svgOverlay.style.height = '100%';
    this.svgOverlay.style.pointerEvents = 'none';

    this.panelContainer.appendChild(this.svgOverlay);

    if (this.config.rendererType === 'webgl') {
      const { default: WebGLRenderer } = await import('../renderers/WebGLRenderer.js');
      this.rendererInstance = new WebGLRenderer();
      await this.rendererInstance.initialize(this.canvas, {
        width: this.panelContainer.offsetWidth,
        height: this.config.height
      });
    } else {
      const { default: CanvasRenderer } = await import('../renderers/CanvasRenderer.js');
      this.rendererInstance = new CanvasRenderer();
      await this.rendererInstance.initialize(this.canvas, {
        width: this.panelContainer.offsetWidth,
        height: this.config.height
      });
    }
  }

  _createGrid() {
    const gridOptions = {
      showXGrid: this.config.showXGrid !== false,
      showYGrid: this.config.showYGrid !== false,
      xGridColor: '#e0e0e0',
      yGridColor: '#e0e0e0',
      xGridOpacity: 1,
      yGridOpacity: 1,
      xGridWidth: 0.5,
      yGridWidth: 0.5,
      skipEdgeLines: true
    };

    this.grid = new Grid({
      xScale: this.config.sharedXScale,
      yScale: this.yScale,
      chartArea: this.panelChartArea,
      ...gridOptions
    });
  }

  _createStudiesRenderer() {
    this.studiesRenderer = {
      async renderPanelStudies(panel) {
        if (!panel.chart.studiesManager) return;

        try {
          const panelStudies = panel.chart.studiesManager.getStudiesForDataset(panel.config.dataset.id);
          const visibleStudies = panelStudies.filter(study => study.visible);

          if (visibleStudies.length === 0) {
            return;
          }

          const studyDatasets = panel._convertStudiesToDatasets(visibleStudies);

          for (const studyDataset of studyDatasets) {
            await panel.panelDataRenderer.render(
              studyDataset,
              panel.config.sharedXScale,
              panel.yScale,
              panel.panelChartArea,
              panel.rendererInstance
            );
          }
        } catch (error) {
          // suppressed
        }
      }
    };
  }

  _createRecessionLines() {
    if (!this.config.recessionData) {
      return;
    }

    this.recessionLines = new RecessionLines({
      enabled: false,
      fillColor: 'rgba(128, 128, 128, 0.2)',
      strokeColor: 'rgba(128, 128, 128, 0.3)',
      strokeWidth: 0,
      recessionData: this.config.recessionData
    });
  }

  _renderRecessionLines() {
    if (!this.recessionLines || !this.config.sharedXScale || !this.yScale || !this.svgOverlay) {
      return;
    }

    this.recessionLines.render(this.svgOverlay, this.panelChartArea, {
      x: this.config.sharedXScale,
      y: this.yScale
    });
  }

  toggleRecessionLines(show = null) {
    if (!this.recessionLines) {
      return false;
    }

    const newState = this.recessionLines.toggle(show);
    return newState;
  }

  _clearPanel() {
    if (this.rendererInstance) {
      this.rendererInstance.clear();
    }

    if (this.svgOverlay) {
      while (this.svgOverlay.firstChild) {
        this.svgOverlay.removeChild(this.svgOverlay.firstChild);
      }
    }
  }

  _renderYAxis() {
    if (this.yAxis && this.svgOverlay) {
      this.yAxis.render(this.svgOverlay, {
        x: this.config.padding.left,
        y: 0
      });
    }
  }

  _renderPanelTitle() {
    if (!this.svgOverlay || !this.config.dataset.name) return;

    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    titleElement.setAttribute('x', this.panelChartArea.x + 8);
    titleElement.setAttribute('y', this.panelChartArea.y + 8);
    titleElement.setAttribute('text-anchor', 'start');
    titleElement.setAttribute('dominant-baseline', 'hanging');
    titleElement.style.fontSize = '12px';
    titleElement.style.fontWeight = '500';
    titleElement.style.fill = this.config.dataset.color || '#333';
    titleElement.textContent = this.config.dataset.name;

    this.svgOverlay.appendChild(titleElement);
  }

  toggleLogarithmicScale(isLog) {
    this.config.isLogarithmic = isLog;
    this._createYScale();
    this._createYAxis();
    this.render();
  }

  toggleAverageLine(show) {
    if (this.statisticalLines) {
      this.statisticalLines.toggleAverage(show);
    }
  }

  toggleMedianLine(show) {
    if (this.statisticalLines) {
      this.statisticalLines.toggleMedian(show);
    }
  }

  toggleZeroLine(show) {
    if (this.zeroLine) {
      this.zeroLine.toggle(show);
    }
  }

  _createStatisticalLines() {
    this.statisticalLines = new StatisticalLines({
      averageConfig: { useAllDatasets: false },
      medianConfig: { useAllDatasets: false }
    });
  }

  _renderStatisticalLines() {
    if (this.statisticalLines) {
      this.statisticalLines.updateDatasets([this.config.dataset]);
      this.statisticalLines.render(this.panelContainer, this.panelChartArea, { x: this.config.sharedXScale, y: this.yScale });
    }
  }

  _createZeroLine() {
    this.zeroLine = new ZeroLine({});
  }

  _renderZeroLine() {
    if (this.zeroLine) {
      this.zeroLine.render(this.panelContainer, this.panelChartArea, { x: this.config.sharedXScale, y: this.yScale });
    }
  }

  getDataPointsAtX(dataX) {
    const tolerance = (this.config.sharedXScale.domain[1] - this.config.sharedXScale.domain[0]) * 0.01;
    const allPoints = [];

    const datasetPoints = this.config.dataset.data.filter(p => Math.abs(p.x - dataX) < tolerance);
    const mappedDatasetPoints = datasetPoints.map(p => ({
      ...p,
      pixelX: this.config.sharedXScale.scale(p.x),
      pixelY: this.yScale.scale(p.y),
      panelIndex: this.config.panelIndex,
      datasetId: this.config.dataset.id,
      dataset: this.config.dataset,
      color: this.config.dataset.color,
      dataX: p.x,
      dataY: p.y
    }));

    allPoints.push(...mappedDatasetPoints);

    if (this.chart && this.chart.studiesManager) {
      try {
        const panelStudies = this.chart.studiesManager.getStudiesForDataset(this.config.dataset.id);
        const visibleStudies = panelStudies.filter(study => study.visible && study.data);

        for (const study of visibleStudies) {
          const studyPoints = study.data.filter(p => Math.abs(p.x - dataX) < tolerance);

          for (const studyPoint of studyPoints) {
            if (study.type === 'bollinger') {
              allPoints.push(
                {
                  x: studyPoint.x,
                  y: studyPoint.upper,
                  pixelX: this.config.sharedXScale.scale(studyPoint.x),
                  pixelY: this.yScale.scale(studyPoint.upper),
                  panelIndex: this.config.panelIndex,
                  datasetId: `${study.id}_upper`,
                  dataset: {
                    id: `${study.id}_upper`,
                    name: `${study.name} (Upper)`,
                    color: study.color,
                    isStudy: true
                  },
                  color: study.color,
                  isStudy: true,
                  dataX: studyPoint.x,
                  dataY: studyPoint.upper
                },
                {
                  x: studyPoint.x,
                  y: studyPoint.middle,
                  pixelX: this.config.sharedXScale.scale(studyPoint.x),
                  pixelY: this.yScale.scale(studyPoint.middle),
                  panelIndex: this.config.panelIndex,
                  datasetId: `${study.id}_middle`,
                  dataset: {
                    id: `${study.id}_middle`,
                    name: `${study.name} (Middle)`,
                    color: study.color,
                    isStudy: true
                  },
                  color: study.color,
                  isStudy: true,
                  dataX: studyPoint.x,
                  dataY: studyPoint.middle
                },
                {
                  x: studyPoint.x,
                  y: studyPoint.lower,
                  pixelX: this.config.sharedXScale.scale(studyPoint.x),
                  pixelY: this.yScale.scale(studyPoint.lower),
                  panelIndex: this.config.panelIndex,
                  datasetId: `${study.id}_lower`,
                  dataset: {
                    id: `${study.id}_lower`,
                    name: `${study.name} (Lower)`,
                    color: study.color,
                    isStudy: true
                  },
                  color: study.color,
                  isStudy: true,
                  dataX: studyPoint.x,
                  dataY: studyPoint.lower
                }
              );
            } else {
              allPoints.push({
                x: studyPoint.x,
                y: studyPoint.y,
                pixelX: this.config.sharedXScale.scale(studyPoint.x),
                pixelY: this.yScale.scale(studyPoint.y),
                panelIndex: this.config.panelIndex,
                datasetId: study.id,
                dataset: {
                  id: study.id,
                  name: study.name,
                  color: study.color,
                  isStudy: true
                },
                color: study.color,
                isStudy: true,
                dataX: studyPoint.x,
                dataY: studyPoint.y
              });
            }
          }
        }
      } catch (error) {
        // suppressed
      }
    }

    return allPoints;
  }

  _renderGrid() {
    if (!this.grid || !this.canvas) {
      return;
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    this.grid.updateScales(this.config.sharedXScale, this.yScale);
    this.grid.updateChartArea(this.panelChartArea);

    ctx.save();

    try {
      this.grid.render(ctx);
    } catch (error) {
      // suppressed
    }

    ctx.restore();
  }

  getLineEndpoint() {
    if (!this.config.dataset || !this.config.dataset.data || this.config.dataset.data.length === 0) {
      return null;
    }

    const lastPoint = this.config.dataset.data[this.config.dataset.data.length - 1];
    if (!lastPoint) return null;

    if (!this.config.sharedXScale || !this.yScale) {
      return null;
    }

    const endX = this.config.sharedXScale.scale(lastPoint.x);
    const endY = this.yScale.scale(lastPoint.y);

    if (endX == null || endY == null || !isFinite(endX) || !isFinite(endY)) {
      return null;
    }

    const tolerance = 50;
    if (endX < this.panelChartArea.x - tolerance ||
      endX > this.panelChartArea.x + this.panelChartArea.width + tolerance ||
      endY < this.panelChartArea.y - tolerance ||
      endY > this.panelChartArea.y + this.panelChartArea.height + tolerance) {
      return null;
    }

    return {
      localX: endX,
      localY: endY,
      dataX: lastPoint.x,
      dataY: lastPoint.y,
      dataset: this.config.dataset,
      panelIndex: this.config.panelIndex,
      panelHeight: this.config.height,
      panelChartArea: this.panelChartArea
    };
  }

  getPanelCoordinateInfo() {
    const containerRect = this.panelContainer ? this.panelContainer.getBoundingClientRect() : null;
    const parentRect = this.config.container ? this.config.container.getBoundingClientRect() : null;

    return {
      panelIndex: this.config.panelIndex,
      panelHeight: this.config.height,
      panelChartArea: this.panelChartArea,
      panelStartY: this.config.panelIndex * this.config.height,
      panelEndY: (this.config.panelIndex + 1) * this.config.height,
      containerRect: containerRect,
      parentRect: parentRect,
      padding: this.config.padding,
      debug: {
        datasetName: this.config.dataset?.name || 'Unknown',
        isRendered: this.isRendered,
        chartAreaValid: !!this.panelChartArea
      }
    };
  }

  getInfo() {
    return {
      dataset: this.config.dataset?.name || 'Unknown',
      panelIndex: this.config.panelIndex,
      isInitialized: this.isInitialized,
      isRendered: this.isRendered,
      chartArea: this.panelChartArea,
      yDomain: this.yScale?.domain || null,
      rendererType: this.config.rendererType,
      endingLabelsState: this.getEndingLabelsState()
    };
  }

  _convertStudiesToDatasets(studies) {
    const studyDatasets = [];

    for (const study of studies) {
      if (!study.data || study.data.length === 0) continue;

      if (study.type === 'bollinger') {
        studyDatasets.push(
          this._createBollingerDataset(study, 'upper'),
          this._createBollingerDataset(study, 'middle'),
          this._createBollingerDataset(study, 'lower')
        );
      } else {
        studyDatasets.push({
          id: `${study.id}_line`,
          name: study.name,
          color: study.color,
          strokeWidth: study.strokeWidth,
          strokeOpacity: study.strokeOpacity,
          fill: false,
          isStudy: true,
          studyId: study.id,
          studyType: study.type,
          data: study.data
        });
      }
    }

    return studyDatasets;
  }

  _createBollingerDataset(study, line) {
    const colors = { upper: study.color, middle: study.color, lower: study.color };
    const opacities = { upper: 0.6, middle: 0.8, lower: 0.6 };

    const lineData = study.data.map(point => ({
      x: point.x,
      y: point[line],
      original: point.original
    }));

    return {
      id: `${study.id}_${line}`,
      name: `${study.name} (${line})`,
      color: colors[line],
      strokeWidth: line === 'middle' ? study.strokeWidth : Math.max(1, study.strokeWidth - 1),
      strokeOpacity: opacities[line],
      fill: false,
      isStudy: true,
      studyId: study.id,
      studyType: study.type,
      bollingerLine: line,
      data: lineData
    };
  }
}
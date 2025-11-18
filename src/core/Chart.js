import { browserSupport } from '../utils/BrowserSupport.js';
import { Axis } from './Axis.js';
import { Scale, ScaleManager } from './Scale.js';
import { Grid } from '../components/Grid.js';
import CanvasRenderer from '../renderers/CanvasRenderer.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { PanelManager } from '../components/PanelManager.js';
import { CoordinateSystem } from '../utils/CoordinateSystem.js';
import { DataProcessor } from '../utils/DataProcessor.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { Legend } from '../components/Legend.js';
import { EndingLabels } from '../components/EndingLabels.js';
import { Crosshair } from '../components/Crosshair.js';
import { ZeroLine } from '../components/ZeroLine.js';
import { AverageLine } from '../components/AverageLine.js';
import { MedianLine } from '../components/MedianLine.js';
import { CrosshairTooltip } from '../components/CrosshairTooltip.js';
import { RecessionLines } from '../components/RecessionLines.js';
import { StudiesManager } from './StudiesManager.js';
import { StudiesRenderer } from '../components/StudiesRenderer.js';

export class Chart {
  constructor(config = {}) {
    this.container = this._resolveContainer(config.container);
    this.config = {
      data: config.data || [],
      legend: {
        visible: config.legend?.visible !== false,
        position: 'center-top',
        ...config.legend
      },
      options: {
        width: 800,
        height: 400,
        title: config.options?.title || '',
        xAxisName: 'X Axis',
        yAxisName: 'Y Axis',
        xField: 'x',
        yField: 'y',
        xType: 'time',
        yType: 'number',
        margin: { top: 40, right: 60, bottom: 60, left: 80 },
        titleFontSize: 16,
        titleFontFamily: 'Arial, sans-serif',
        titleFontWeight: 'bold',
        titleColor: '#333333',
        titlePadding: 10,
        showGrid: true,
        showXGrid: true,
        showYGrid: true,
        gridColor: '#e0e0e0',
        gridOpacity: 0.7,
        gridDash: [],
        showRecessionLines: false,
        recessionFillColor: 'rgba(128, 122, 122, 0.2)',
        recessionStrokeColor: 'rgba(128, 122, 122, 0.2)',
        isLogarithmic: false,
        forceRenderer: null,
        ...config.options
      }
    };

    this.dataProcessor = new DataProcessor({
      strictValidation: false,
      autoDetectTimeFormat: true,
      sortByTime: true,
      removeDuplicates: true
    });

    this.pathGenerator = new PathGenerator({
      curve: 'linear',
      enableOptimization: true
    });

    this.generatedPaths = null;
    this.renderers = new Map();
    this.activeRenderer = null;
    this.rendererInstance = null;
    this.svgOverlay = null;
    this.dataPointCount = 0;
    this.performanceThresholds = {
      canvas: 50000,
      webgl: 100000
    };
    this.axes = { x: null, y: null };
    this.chartArea = { x: 0, y: 0, width: 0, height: 0 };
    this.dataDomains = { x: [0, 1], y: [0, 1] };
    this.scaleManager = new ScaleManager();
    this.scales = { x: null, y: null };
    this.coordinateSystem = null;
    this.transformedData = null;
    this.grid = null;
    this.titleElement = null;
    this.isInitialized = false;
    this._isDestroying = false;
    this._isDestroyed = false;
    this.panelManager = new PanelManager(this);
    this.legend = new Legend({
      fontSize: 12,
      fontFamily: this.config.options.titleFontFamily || 'Arial, sans-serif',
      textColor: '#333333',
      itemSpacing: 30,
      marginTop: 15,
      marginBottom: 15,
      studyFontSize: 10,
      studyTextColor: '#666666',
      studyIndicatorSize: 6,
      studySeparator: ' • ',
      studySpacing: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid #e0e0e0',
      borderRadius: 4,
      padding: 8
    });
    this.endingLabels = new EndingLabels({
      fontSize: 11,
      fontFamily: this.config.options.titleFontFamily || 'Arial, sans-serif',
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatValue: true,
      decimals: 1,
      enabled: false
    });
    this.crosshair = null;
    this.lastMousePosition = null;
    this.mouseThreshold = 5;
    this._tooltipOwner = null;
    this._isSettingUpCrosshair = false;
    this.recessionLines = new RecessionLines({
      enabled: this.config.options.showRecessionLines,
      fillColor: this.config.options.recessionFillColor,
      strokeColor: this.config.options.recessionStrokeColor
    });
    this.studiesManager = new StudiesManager(this);
    this.studiesRenderer = new StudiesRenderer(this);
    this.zeroLine = new ZeroLine({
      enabled: false,
      strokeColor: '#000000',
      strokeWidth: 1,
      strokeOpacity: 1,
      strokeDash: [3, 3],
      showLabel: false
    });
    this.averageLine = new AverageLine({
      enabled: false,
      strokeColor: '#FF6B35',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      strokeDash: [5, 5],
      showLabel: true,
      labelText: 'Avg',
      labelPosition: 'right',
      useAllDatasets: true
    });
    this.medianLine = new MedianLine({
      enabled: false,
      strokeColor: '#9C27B0',
      strokeWidth: 2,
      strokeOpacity: 0.8,
      strokeDash: [8, 4],
      showLabel: true,
      labelText: 'Median',
      labelPosition: 'right',
      useAllDatasets: true
    });
    this._initPromise = this._initialize();
  }

  _resolveContainer(container) {
    if (typeof container === 'string') {
      const element = document.querySelector(container) || document.getElementById(container.replace('#', ''));
      if (!element) {
        throw new Error(`Container not found: ${container}`);
      }
      return element;
    }
    if (container && container.nodeType === Node.ELEMENT_NODE) {
      return container;
    }
    throw new Error('Invalid container provided');
  }

  async _initialize() {
    try {
      this.container.innerHTML = '';
      this.container.style.position = 'relative';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      this._calculateDimensions();
      this._setupRenderingLayers();
      await this._processData();
      this._selectOptimalRenderer();
      this._createCoordinateSystem();
      this._createScales();
      this._createGrid();
      this._createAxes();
      this._setupCrosshair();
      await this.studiesRenderer.initialize();
      await this._initializeRenderer();
      this._initializeLegendWithStudies();
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  _calculateDimensions() {
    const containerRect = this.container.getBoundingClientRect();
    this.config.options.width = containerRect.width || this.config.options.width;
    this.config.options.height = containerRect.height || this.config.options.height;
    const margin = this.config.options.margin;
    this.chartArea = {
      x: margin.left,
      y: margin.top,
      width: this.config.options.width - margin.left - margin.right,
      height: this.config.options.height - margin.top - margin.bottom
    };
  }

  _setupRenderingLayers() {
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = this.config.options.width;
    this.gridCanvas.height = this.config.options.height;
    this.gridCanvas.style.position = 'absolute';
    this.gridCanvas.style.top = '0';
    this.gridCanvas.style.left = '0';
    this.gridCanvas.style.zIndex = '0';
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.gridCanvas.width = this.config.options.width * devicePixelRatio;
    this.gridCanvas.height = this.config.options.height * devicePixelRatio;
    this.gridCanvas.style.width = this.config.options.width + 'px';
    this.gridCanvas.style.height = this.config.options.height + 'px';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.options.width;
    this.canvas.height = this.config.options.height;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '1';
    this.svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgOverlay.setAttribute('width', this.config.options.width);
    this.svgOverlay.setAttribute('height', this.config.options.height);
    this.svgOverlay.style.position = 'absolute';
    this.svgOverlay.style.top = '0';
    this.svgOverlay.style.left = '0';
    this.svgOverlay.style.pointerEvents = 'none';
    this.svgOverlay.style.zIndex = '2';
    this.container.appendChild(this.gridCanvas);
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.svgOverlay);
  }

  async _processData() {
    if (!this.config.data || !Array.isArray(this.config.data)) {
      return;
    }
    try {
      const processingOptions = {
        autoDetectTimeFormat: true,
        sortByTime: true,
        removeDuplicates: true,
        strictValidation: false,
        fillGaps: false,
        timeZone: 'UTC',
        enableCaching: true,
        batchSize: 10000,
        normalizeTimeStamps: true,
        gapThreshold: '1d'
      };
      const processedDatasets = [];
      for (let i = 0; i < this.config.data.length; i++) {
        const dataset = this.config.data[i];
        if (!dataset.data || !Array.isArray(dataset.data)) {
          continue;
        }
        const processedDataset = await this.dataProcessor.processDataset(dataset, processingOptions);
        processedDatasets.push(processedDataset);
      }
      this.config.data = processedDatasets;
      for (const dataset of this.config.data) {
        if (!dataset._originalNormalizedData) {
          dataset._originalNormalizedData = JSON.parse(JSON.stringify(dataset.data));
        }
        if (this.config.options.isLogarithmic) {
          dataset.data = dataset._originalNormalizedData.map(p => ({
            ...p,
            y: p.y > 0 ? Math.log10(p.y) : null
          }));
        } else {
          dataset.data = JSON.parse(JSON.stringify(dataset._originalNormalizedData));
        }
      }
      this.dataPointCount = processedDatasets.reduce((count, dataset) => {
        const dataLength = dataset.processedDataCount || (dataset.data && Array.isArray(dataset.data) ? dataset.data.length : 0);
        return count + dataLength;
      }, 0);
      this._calculateDataDomains();
    } catch (error) {
      throw error;
    }
  }

  _updateScales() {
    if (!this.scales.x || !this.scales.y) {
      return;
    }
    this._calculateDataDomains();
    this.scales.x.setDomain([...this.dataDomains.x]);
    this.scales.y.setDomain([...this.dataDomains.y]);
    this.scaleManager.setScale('x', this.scales.x);
    this.scaleManager.setScale('y', this.scales.y);
    if (this.coordinateSystem) {
      this.coordinateSystem.setScales(this.scales);
    }
  }

  _updateAxes() {
    if (!this.axes.x || !this.axes.y) {
      return;
    }
    if (!this.scales.x || !this.scales.y) {
      return;
    }
    this.axes.x.scale = this.scales.x;
    this.axes.y.scale = this.scales.y;
  }

  async togglePanelMode(force = null) {
    return await this.panelManager.togglePanelMode(force);
  }

  get isPanelMode() {
    return this.panelManager.isPanelMode;
  }

  _calculateDataDomains() {
    if (!this.config.data || !Array.isArray(this.config.data) || this.config.data.length === 0) {
      this.dataDomains = { x: [0, 1], y: [0, 1] };
      return;
    }
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    let totalPoints = 0;
    for (const dataset of this.config.data) {
      if (!dataset.data || !Array.isArray(dataset.data) || dataset.data.length === 0) {
        continue;
      }
      for (const point of dataset.data) {
        totalPoints++;
        const xValue = point.x;
        const yValue = point.y;
        if (xValue != null && isFinite(xValue)) {
          xMin = Math.min(xMin, xValue);
          xMax = Math.max(xMax, xValue);
        }
        if (yValue != null && isFinite(yValue)) {
          yMin = Math.min(yMin, yValue);
          yMax = Math.max(yMax, yValue);
        }
      }
    }
    if (xMin === Infinity || xMax === -Infinity) {
      xMin = 0;
      xMax = 1;
    }
    if (yMin === Infinity || yMax === -Infinity) {
      yMin = 0;
      yMax = 1;
    }
    if (xMin === xMax) {
      const expansion = xMin !== 0 ? Math.abs(xMin) * 0.1 : 86400000;
      xMin = xMin - expansion;
      xMax = xMax + expansion;
    }
    if (yMin === yMax) {
      const expansion = yMin !== 0 ? Math.abs(yMin) * 0.1 : 1;
      yMin = yMin - expansion;
      yMax = yMax + expansion;
    }
    if (this.config.options.isLogarithmic && yMin <= 0) {
      yMin = 0.1;
    }
    const yRange = yMax - yMin;
    const yPadding = yRange * 0.05;
    this.dataDomains = {
      x: [xMin, xMax],
      y: [yMin - yPadding, yMax + yPadding]
    };
  }

  _createCoordinateSystem() {
    this.coordinateSystem = CoordinateSystem.createForChart(
      this.constructor.name.toLowerCase().replace('chart', ''),
      {
        x: 0,
        y: 0,
        width: this.config.options.width,
        height: this.config.options.height
      },
      this.chartArea,
      {
        targetRenderer: this.activeRenderer,
        devicePixelRatio: window.devicePixelRatio || 1,
        enableHighDPI: true,
        enableCaching: true,
        useUnifiedCoordinates: true
      }
    );
  }

  _createScales() {
    if (!this.dataDomains || !this.dataDomains.x || !this.dataDomains.y) {
      this._calculateDataDomains();
    }
    const xScaleType = this.config.options.xType === 'time' ? 'time' : 'linear';
    const yScaleType = 'linear';
    this.scales.x = new Scale({
      type: xScaleType,
      domain: [...this.dataDomains.x],
      range: [this.chartArea.x, this.chartArea.x + this.chartArea.width],
      coordinateSystem: 'unified',
      orientation: 'horizontal',
      dataType: this.config.options.xType,
      options: {
        nice: false,
        padding: 0,
        clamp: true
      }
    });
    this.scales.y = new Scale({
      type: yScaleType,
      domain: [...this.dataDomains.y],
      range: [this.chartArea.y + this.chartArea.height, this.chartArea.y],
      coordinateSystem: 'unified',
      orientation: 'vertical',
      dataType: this.config.options.yType,
      options: {
        nice: false,
        padding: 0,
        clamp: true
      }
    });
    this.scaleManager.setScale('x', this.scales.x);
    this.scaleManager.setScale('y', this.scales.y);
  }

  _createGrid() {
    if (!this.scales.x || !this.scales.y) {
      return;
    }
    this.grid = new Grid({
      xScale: this.scales.x,
      yScale: this.scales.y,
      chartArea: this.chartArea,
      showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
      showYGrid: this.config.options.showYGrid && this.config.options.showGrid,
      xGridColor: this.config.options.gridColor,
      yGridColor: this.config.options.gridColor,
      xGridOpacity: this.config.options.gridOpacity,
      yGridOpacity: this.config.options.gridOpacity,
      xGridDash: this.config.options.gridDash,
      yGridDash: this.config.options.gridDash
    });
  }

  _createAxes() {
    if (!this.scales.x || !this.scales.y) {
      return;
    }
    this.axes.x = new Axis({
      orientation: 'x',
      scale: this.scales.x,
      options: {
        label: this.config.options.xAxisName,
        fontSize: 12,
        color: '#333'
      }
    });
    this.axes.y = new Axis({
      orientation: 'y',
      scale: this.scales.y,
      options: {
        label: this.config.options.yAxisName,
        fontSize: 12,
        color: '#333'
      }
    });
  }

  _selectOptimalRenderer() {
    if (this.config.options.forceRenderer) {
      this.activeRenderer = this.config.options.forceRenderer;
      return;
    }
    if (this.chartType === 'bar') {
      this.activeRenderer = 'canvas';
      return;
    }
    const dataPoints = this.dataPointCount;
    const webglSupported = browserSupport.hasWebGL();
    if (dataPoints > this.performanceThresholds.canvas && webglSupported) {
      this.activeRenderer = 'webgl';
    } else if (dataPoints > this.performanceThresholds.webgl) {
      this.activeRenderer = webglSupported ? 'webgl' : 'canvas';
    } else {
      this.activeRenderer = 'canvas';
    }
  }

  async _initializeRenderer() {
    try {
      switch (this.activeRenderer) {
        case 'webgl':
          this.rendererInstance = new WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: false
          });
          break;
        case 'canvas':
        default:
          this.rendererInstance = new CanvasRenderer({
            antialias: true,
            imageSmoothingEnabled: true
          });
          break;
      }
      await this.rendererInstance.initialize(this.canvas, {
        width: this.config.options.width,
        height: this.config.options.height
      });
      if (this.coordinateSystem) {
        this.coordinateSystem.setTargetRenderer(this.activeRenderer);
      }
    } catch (error) {
      if (this.activeRenderer === 'webgl') {
        this.activeRenderer = 'canvas';
        this.rendererInstance = new CanvasRenderer();
        await this.rendererInstance.initialize(this.canvas, {
          width: this.config.options.width,
          height: this.config.options.height
        });
        if (this.coordinateSystem) {
          this.coordinateSystem.setTargetRenderer(this.activeRenderer);
        }
      } else {
        throw error;
      }
    }
  }

  _getXValue(point) {
    let value = point.x;
    if (value == null) {
      value = point.date || point.time || point.timestamp;
      if (value instanceof Date) {
        value = value.getTime();
      } else if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          value = parsed.getTime();
        } else {
          value = parseFloat(value);
        }
      }
    }
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  _getYValue(point) {
    let value = point.y;
    if (value == null) {
      value = point.value || point.price || point.close || point.amount;
      if (typeof value === 'string') {
        value = parseFloat(value);
      }
    }
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  _renderTitle() {
    if (this.titleElement) {
      this.titleElement.remove();
      this.titleElement = null;
    }
    if (!this.config.options.title) {
      return;
    }
    this.titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const centerX = this.config.options.width / 2;
    const titleY = this.config.options.titlePadding + this.config.options.titleFontSize;
    this.titleElement.setAttribute('x', centerX);
    this.titleElement.setAttribute('y', titleY);
    this.titleElement.setAttribute('text-anchor', 'middle');
    this.titleElement.setAttribute('font-size', this.config.options.titleFontSize);
    this.titleElement.setAttribute('font-family', this.config.options.titleFontFamily);
    this.titleElement.setAttribute('font-weight', this.config.options.titleFontWeight);
    this.titleElement.setAttribute('fill', this.config.options.titleColor);
    this.titleElement.setAttribute('class', 'chart-title');
    this.titleElement.textContent = this.config.options.title;
    this.svgOverlay.appendChild(this.titleElement);
  }

  _renderLegend() {
    if (this.isPanelMode) {
      if (this.panelManager && this.panelManager.legend) {
        const allStudies = this.studiesManager ? this.studiesManager.getVisibleStudies() : [];
        this.panelManager.updateLegendWithStudies(allStudies);
      }
      return;
    }
    if (!this.legend || !this.config.legend?.visible) {
      return;
    }
    try {
      const datasets = this.config.data || [];
      const studies = this.studiesManager ? this.studiesManager.getVisibleStudies() : [];
      this.legend.updateDatasets(datasets, studies);
      if (this.svgOverlay && this.chartArea) {
        this.legend.render(this.svgOverlay, this.chartArea);
      }
    } catch (error) {
      return;
    }
  }

  async _preprocessDataForRenderer() {
    if (!Array.isArray(this.config.data) || !this.coordinateSystem) {
      return;
    }
    try {
      this.config.data = await this.coordinateSystem.transformDatasets(this.config.data, {
        strictValidation: false
      });
      this.generatedPaths = await PathGenerator.generatePaths(this.config.data, {
        curve: this.config.options.curve || 'linear',
        strokeWidth: this.config.options.strokeWidth || 2,
        targetRenderer: this.activeRenderer
      });
    } catch (error) {
      throw error;
    }
  }

  async render() {
    try {
      await this._processData();
      this._createScales();
      if (this.coordinateSystem) {
        this.coordinateSystem.setScales(this.scales);
      }
      if (this.isPanelMode && this.panelManager) {
        await this.panelManager.refreshPanelMode();
        return;
      }
      await this._renderSingleMode();
    } catch (error) {
      throw error;
    }
  }

  async _renderSingleMode() {
    if (!this.isInitialized) {
      return;
    }
    try {
      this._clearRender();
      await this._preprocessDataForRenderer();
      this._renderTitle();
      if (this.grid && this.config.options.showGrid && this.gridCanvas) {
        this.grid.updateChartArea(this.chartArea);
        this.grid.updateScales(this.scales.x, this.scales.y);
        const gridCtx = this.gridCanvas.getContext('2d');
        if (gridCtx) {
          const devicePixelRatio = window.devicePixelRatio || 1;
          gridCtx.save();
          gridCtx.scale(devicePixelRatio, devicePixelRatio);
          this.grid.render(gridCtx);
          gridCtx.restore();
        }
      }
      await this._renderChartData();
      if (this.studiesRenderer && this.studiesManager) {
        try {
          this.studiesManager.calculateAllStudies();
          await this.studiesRenderer.render();
        } catch (error) {}
      }
      this._renderAxes();
      this._renderStatisticalLines();
      this._renderRecessionLines();
      this._renderZeroLine();
      this._updateLegendWithStudies();
      this._updateEndingLabels();
    } catch (error) {
      throw error;
    }
  }

  getPanelModeInfo() {
    return this.panelManager.getState();
  }

  _renderAxes() {
    if (!this.axes.x || !this.axes.y) {
      return;
    }
    this.axes.x.render(this.svgOverlay, {
      x: 0,
      y: this.chartArea.y + this.chartArea.height
    });
    this.axes.y.render(this.svgOverlay, {
      x: this.chartArea.x,
      y: 0
    });
  }

  toggleLogarithmicScale(show = null) {
    const newState = show !== null ? show : !this.config.options.isLogarithmic;
    if (newState === this.config.options.isLogarithmic) return newState;
    this.config.options.isLogarithmic = newState;
    this.update();
    return newState;
  }

  toggleRecessionLines(show = null) {
    if (this.isPanelMode) {
      this.panelManager.toggleRecessionLines(show);
      return;
    }
    if (!this.recessionLines) {
      return false;
    }
    const newState = this.recessionLines.toggle(show);
    this.config.options.showRecessionLines = newState;
    this.render();
    return newState;
  }

  toggleZeroLine(show = null) {
    if (this.isPanelMode) {
      this.panelManager.toggleZeroLine(show);
      return;
    }
    if (!this.zeroLine) {
      return false;
    }
    const newState = this.zeroLine.toggle(show);
    return newState;
  }

  _renderRecessionLines() {
    if (!this.recessionLines || !this.scales.x || !this.scales.y) {
      return;
    }
    this.recessionLines.render(this.container, this.chartArea, this.scales);
  }

  _renderZeroLine() {
    if (!this.zeroLine || !this.scales.x || !this.scales.y) {
      return;
    }
    this.zeroLine.render(this.container, this.chartArea, this.scales);
  }

  _renderStatisticalLines() {
    if (this.averageLine && this.scales.x && this.scales.y) {
      this.averageLine.updateDatasets(this.config.data);
      this.averageLine.render(this.container, this.chartArea, this.scales);
    }
    if (this.medianLine && this.scales.x && this.scales.y) {
      this.medianLine.updateDatasets(this.config.data);
      this.medianLine.render(this.container, this.chartArea, this.scales);
    }
  }

  async _renderChartData() {
    throw new Error('_renderChartData must be implemented by subclass');
  }

  async update() {
    if (this.isPanelMode) {
      return await this.panelManager.refreshPanelMode();
    } else {
      return this._updateSingleMode();
    }
  }

  toggleLegend(show = null) {
    let currentLegend;
    let newState;
    if (this.isPanelMode) {
      currentLegend = this.panelManager?.legend;
      if (!currentLegend) {
        return false;
      }
    } else {
      currentLegend = this.legend;
      if (!currentLegend) {
        return false;
      }
    }
    if (show !== null) {
      newState = show;
    } else {
      const isCurrentlyVisible = currentLegend.element &&
        currentLegend.element.style.display !== 'none';
      newState = !isCurrentlyVisible;
    }
    currentLegend.setVisible(newState);
    return newState;
  }

  isLegendVisible() {
    const currentLegend = this.isPanelMode
      ? this.panelManager?.legend
      : this.legend;
    if (!currentLegend || !currentLegend.element) {
      return false;
    }
    return currentLegend.element.style.display !== 'none';
  }

  async _updatePanelMode() {
    return await this.panelManager.refreshPanelMode();
  }

  async _updateSingleMode() {
    if (!this.isInitialized) {
      await this._initialize();
      return;
    }
    try {
      await this._processData();
      this._updateScales();
      this._updateAxes();
      this._updateGrid();
      await this._preprocessDataForRenderer();
      await this.render();
      if (this.studiesManager) {
        this.studiesManager.calculateAllStudies();
      }
    } catch (error) {
      throw error;
    }
  }

  _updateGrid() {
    if (this.grid && this.scales.x && this.scales.y) {
      this.grid.updateScales(this.scales.x, this.scales.y);
      this.grid.updateChartArea(this.chartArea);
    }
  }

  _debugDataStructure() {
    if (!this.config.data || this.config.data.length === 0) {
      return;
    }
    const firstDataset = this.config.data[0];
    if (firstDataset.data && firstDataset.data.length > 0) {
      const firstPoint = firstDataset.data[0];
      return {
        dataset: {
          id: firstDataset.id,
          name: firstDataset.name,
          hasData: !!firstDataset.data,
          dataLength: firstDataset.data ? firstDataset.data.length : 0,
          processed: firstDataset.processed,
          processedDataCount: firstDataset.processedDataCount,
          originalDataCount: firstDataset.originalDataCount
        },
        firstPoint: {
          keys: Object.keys(firstPoint),
          x: firstPoint.x,
          y: firstPoint.y,
          hasUnifiedCoords: !!(firstPoint.unifiedX && firstPoint.unifiedY)
        },
        dataDomains: this.dataDomains,
        dataPointCount: this.dataPointCount
      };
    }
    return null;
  }

  _determineOptimalRenderer() {
    if (this.config.options.forceRenderer) {
      return this.config.options.forceRenderer;
    }
    const webglSupported = browserSupport.hasWebGL();
    if (this.dataPointCount > this.performanceThresholds.canvas && webglSupported) {
      return 'webgl';
    } else {
      return 'canvas';
    }
  }

  getRendererInfo() {
    return {
      activeRenderer: this.activeRenderer,
      dataPointCount: this.dataPointCount,
      thresholds: this.performanceThresholds,
      rendererCapabilities: this.rendererInstance ? this.rendererInstance.getPerformanceProfile() : null,
      webglSupported: browserSupport.hasWebGL(),
      webglCapabilities: browserSupport.getWebGLCapabilities(),
      coordinateSystem: this.coordinateSystem ? this.coordinateSystem.getCoordinateInfo() : null
    };
  }

  async switchRenderer(rendererType) {
    if (!['canvas', 'webgl'].includes(rendererType)) {
      throw new Error(`Invalid renderer type: ${rendererType}`);
    }
    if (rendererType === 'webgl' && !browserSupport.hasWebGL()) {
      throw new Error('WebGL is not supported in this browser');
    }
    if (rendererType === this.activeRenderer) {
      return;
    }
    if (this.rendererInstance) {
      this.rendererInstance.destroy();
    }
    this.activeRenderer = rendererType;
    this.config.options.forceRenderer = rendererType;
    if (this.coordinateSystem) {
      this.coordinateSystem.setTargetRenderer(rendererType);
    }
    await this._initializeRenderer();
    await this.render();
  }

  setTitle(title) {
    this.config.options.title = title;
    this._renderTitle();
    return this;
  }

  getTitle() {
    return this.config.options.title;
  }

  toggleGrid(show = null) {
    this.config.options.showGrid = show !== null ? show : !this.config.options.showGrid;
    if (this.grid) {
      this.grid.updateOptions({
        showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
        showYGrid: this.config.options.showYGrid && this.config.options.showGrid
      });
    }
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    this.render();
    return this.config.options.showGrid;
  }

  toggleXGrid(show = null) {
    this.config.options.showXGrid = show !== null ? show : !this.config.options.showXGrid;
    if (this.grid) {
      this.grid.toggleXGrid(this.config.options.showXGrid && this.config.options.showGrid);
    }
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    this.render();
    return this.config.options.showXGrid;
  }

  toggleYGrid(show = null) {
    this.config.options.showYGrid = show !== null ? show : !this.config.options.showYGrid;
    if (this.grid) {
      this.grid.toggleYGrid(this.config.options.showYGrid && this.config.options.showGrid);
    }
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    this.render();
    return this.config.options.showYGrid;
  }

  setGridColor(color) {
    this.config.options.gridColor = color;
    if (this.grid) {
      this.grid.setGridColor(color);
    }
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    this.render();
    return this;
  }

  setGridOpacity(opacity) {
    this.config.options.gridOpacity = opacity;
    if (this.grid) {
      this.grid.setGridOpacity(opacity);
    }
    if (this.isPanelMode && this.panelManager) {
      this._updatePanelGrids();
    }
    this.render();
    return this;
  }

  _updatePanelGrids() {
    if (!this.panelManager || !this.panelManager.panels) return;
    const gridOptions = {
      showXGrid: this.config.options.showXGrid && this.config.options.showGrid,
      showYGrid: this.config.options.showYGrid && this.config.options.showGrid,
      xGridColor: this.config.options.gridColor || '#e0e0e0',
      yGridColor: this.config.options.gridColor || '#e0e0e0',
      xGridOpacity: this.config.options.gridOpacity || 0.5,
      yGridOpacity: this.config.options.gridOpacity || 0.5
    };
    for (const panel of this.panelManager.panels) {
      if (panel.grid) {
        panel.grid.updateOptions(gridOptions);
        Object.assign(panel.config, {
          showGrid: this.config.options.showGrid,
          showXGrid: this.config.options.showXGrid,
          showYGrid: this.config.options.showYGrid,
          gridColor: this.config.options.gridColor,
          gridOpacity: this.config.options.gridOpacity
        });
      }
    }
  }

  _initializeLegendWithStudies() {
    if (this.config.legend?.visible && this.legend) {
      const studies = this.studiesManager ? this.studiesManager.getVisibleStudies() : [];
      if (studies.length > 0) {
        this._updateLegendWithStudies();
      }
    }
  }

  _updateLegend() {
    if (this.legend && this.config.data) {
      this.legend.updateDatasets(this.config.data);
      if (this.svgOverlay && this.chartArea) {
        this.legend.render(this.svgOverlay, this.chartArea);
      }
    }
  }

  _updateEndingLabels() {
    if (this.isPanelMode) {
      if (this.panelManager) {
        this.panelManager.updateEndingLabels();
      }
      return;
    }
    if (this.endingLabels && this.config.data) {
      this.endingLabels.updateDatasets(this.config.data);
      if (this.svgOverlay && this.chartArea) {
        this.endingLabels.render(this.svgOverlay, this.chartArea);
      }
    }
  }

  getEndingLabelsState() {
    if (this.isPanelMode) {
      return this.panelManager ? this.panelManager.getEndingLabelsState() : null;
    } else {
      return this.endingLabels ? this.endingLabels.getState() : null;
    }
  }

  toggleEndingLabels(show = null) {
    if (this.isPanelMode) {
      if (!this.panelManager) {
        return false;
      }
      const newState = this.panelManager.toggleEndingLabels(show);
      return newState;
    }
    if (!this.endingLabels) {
      return false;
    }
    const newState = this.endingLabels.toggle(show);
    return newState;
  }

  setEndingLabelsConfig(config) {
    if (this.endingLabels) {
      this.endingLabels.updateConfig(config);
    }
    return this;
  }

  getEndingLabelsInfo() {
    return this.endingLabels ? this.endingLabels.getState() : { enabled: false };
  }

  toggleAverageLine(show = null) {
    if (this.isPanelMode) {
      this.panelManager.toggleAverageLine(show);
      return;
    }
    if (!this.averageLine) {
      return false;
    }
    const newState = this.averageLine.toggle(show);
    return newState;
  }

  toggleMedianLine(show = null) {
    if (this.isPanelMode) {
      this.panelManager.toggleMedianLine(show);
      return;
    }
    if (!this.medianLine) {
      return false;
    }
    const newState = this.medianLine.toggle(show);
    return newState;
  }

  getStatisticalValues() {
    return {
      average: this.averageLine ? this.averageLine.getAverageValue() : null,
      median: this.medianLine ? this.medianLine.getMedianValue() : null,
      averageInRange: this.averageLine ? this.averageLine.getState().averageInRange : false,
      medianInRange: this.medianLine ? this.medianLine.getState().medianInRange : false
    };
  }

  setAverageLineConfig(config) {
    if (this.averageLine) {
      this.averageLine.updateConfig(config);
    }
    return this;
  }

  setMedianLineConfig(config) {
    if (this.medianLine) {
      this.medianLine.updateConfig(config);
    }
    return this;
  }

  setStatisticalDataScope(useAllDatasets) {
    if (this.averageLine) {
      this.averageLine.updateConfig({ useAllDatasets });
    }
    if (this.medianLine) {
      this.medianLine.updateConfig({ useAllDatasets });
    }
    return this;
  }

  getStatisticalLinesInfo() {
    return {
      average: this.averageLine ? this.averageLine.getState() : { enabled: false },
      median: this.medianLine ? this.medianLine.getState() : { enabled: false }
    };
  }

  addStudy(studyType, config = {}) {
    if (!this.studiesManager) {
      throw new Error('Studies system not initialized');
    }
    const studyId = this.studiesManager.addStudy(studyType, config);
    this._updateLegendWithStudies();
    this.render().catch(error => {});
    return studyId;
  }

  removeStudy(studyId) {
    if (!this.studiesManager) {
      return false;
    }
    const removed = this.studiesManager.removeStudy(studyId);
    if (removed) {
      this._updateLegendWithStudies();
      this.render().catch(error => {});
    }
    return removed;
  }

  updateStudy(studyId, updates) {
    if (!this.studiesManager) {
      throw new Error('Studies system not initialized');
    }
    this.studiesManager.updateStudy(studyId, updates);
    if (updates.color) {
      if (this.legend && this.legend.updateStudyColor) {
        this.legend.updateStudyColor(studyId, updates.color);
      }
    }
    if (updates.visible !== undefined) {
      this._updateLegendWithStudies();
    }
    this.render().catch(error => {});
  }

  _updateLegendWithStudies() {
    if (!this.legend) {
      return;
    }
    try {
      const datasets = this.config.data || [];
      const allStudies = this.studiesManager ? this.studiesManager.getAllStudies() : [];
      const visibleStudies = this.studiesManager ? this.studiesManager.getVisibleStudies() : [];
      this.legend.updateDatasets(datasets, visibleStudies);
      if (this.svgOverlay && this.chartArea) {
        this.legend.render(this.svgOverlay, this.chartArea);
      }
    } catch (error) {}
  }

  getAllStudies() {
    return this.studiesManager ? this.studiesManager.getAllStudies() : [];
  }

  getVisibleStudies() {
    return this.studiesManager ? this.studiesManager.getVisibleStudies() : [];
  }

  getSupportedStudies() {
    return this.studiesManager ? this.studiesManager.getSupportedStudies() : {};
  }

  clearAllStudies() {
    if (this.studiesManager) {
      this.studiesManager.clearAllStudies();
      this._updateLegendWithStudies();
      this.render().catch(error => {});
    }
  }

  updateDatasetColor(datasetId, newColor) {
    const dataset = this.config.data?.find(d => d.id === datasetId);
    if (!dataset) {
      return false;
    }
    dataset.color = newColor;
    this._updateLegendForColorChange(datasetId, newColor);
    this._updateEndingLabelsForColorChange(datasetId, newColor);
    this.render().catch(error => {});
    return true;
  }

  _updateLegendForColorChange(datasetId, newColor) {
    if (this.isPanelMode) {
      if (this.panelManager?.legend?.updateDatasetColor) {
        this.panelManager.legend.updateDatasetColor(datasetId, newColor);
      }
    } else {
      if (this.legend?.updateDatasetColor) {
        this.legend.updateDatasetColor(datasetId, newColor);
      }
    }
  }

  _updateEndingLabelsForColorChange(datasetId, newColor) {
    if (this.isPanelMode) {
      if (this.panelManager?.panels) {
        const panel = this.panelManager.panels.find(p => p.config.dataset.id === datasetId);
        if (panel?.endingLabels?.updateDatasetColor) {
          panel.endingLabels.updateDatasetColor(datasetId, newColor);
        }
      }
    } else {
      if (this.endingLabels?.updateDatasetColor) {
        this.endingLabels.updateDatasetColor(datasetId, newColor);
      }
    }
  }

  _clearRender() {
    try {
      if (this.rendererInstance && this.rendererInstance.clear) {
        this.rendererInstance.clear();
      }
      if (this.gridCanvas) {
        const gridCtx = this.gridCanvas.getContext('2d');
        if (gridCtx) {
          gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        }
      }
      if (this.svgOverlay) {
        const children = Array.from(this.svgOverlay.children);
        children.forEach(child => {
          if (child.classList &&
            !child.classList.contains('crosshair') &&
            !child.classList.contains('tooltip')) {
            if (child.parentNode) {
              child.parentNode.removeChild(child);
            }
          }
        });
      }
      if (this.titleElement && this.titleElement.parentNode) {
        this.titleElement.parentNode.removeChild(this.titleElement);
        this.titleElement = null;
      }
    } catch (error) {}
  }

  async ensureInitialized() {
    if (this._initPromise) {
      await this._initPromise;
    }
    return this.isInitialized;
  }

  destroy() {
    if (this._isDestroying || this._isDestroyed) {
      return;
    }
    this._isDestroying = true;
    try {
      if (this.legend) {
        this.legend.destroy?.();
        this.legend = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy?.();
        this.tooltip = null;
      }
      if (this.recessionLines) {
        this.recessionLines.destroy?.();
        this.recessionLines = null;
      }
      if (this.zeroLine) {
        this.zeroLine.destroy?.();
        this.zeroLine = null;
      }
      if (this.averageLine) {
        this.averageLine.destroy?.();
        this.averageLine = null;
      }
      if (this.medianLine) {
        this.medianLine.destroy?.();
        this.medianLine = null;
      }
      if (this.endingLabels) {
        this.endingLabels.destroy?.();
        this.endingLabels = null;
      }
      if (this.studiesRenderer) {
        this.studiesRenderer.destroy?.();
        this.studiesRenderer = null;
      }
      if (this.studiesManager) {
        this.studiesManager.clearAllStudies?.();
        this.studiesManager = null;
      }
      if (this._boundMouseMove && this.container) {
        try {
          this.container.removeEventListener('mousemove', this._boundMouseMove);
          if (this._boundMouseLeave) {
            this.container.removeEventListener('mouseleave', this._boundMouseLeave);
          }
        } catch (e) {}
        this._boundMouseMove = null;
        this._boundMouseLeave = null;
      }
      if (this.titleElement) {
        try {
          if (this.titleElement.parentNode) {
            this.titleElement.parentNode.removeChild(this.titleElement);
          }
        } catch (e) {}
        this.titleElement = null;
      }
      if (this.panelManager) {
        this.panelManager.destroy?.();
        this.panelManager = null;
      }
      if (this.rendererInstance) {
        this.rendererInstance.destroy?.();
        this.rendererInstance = null;
      }
      if (this.coordinateSystem) {
        this.coordinateSystem.clearCache?.();
        this.coordinateSystem = null;
      }
      if (this.container) {
        try {
          this.container.innerHTML = '';
        } catch (e) {}
      }
      if (this.renderers) {
        this.renderers.clear();
      }
      this.generatedPaths = null;
      this.transformedData = null;
      this.isInitialized = false;
      this._isDestroyed = true;
    } catch (error) {} finally {
      this._isDestroying = false;
    }
  }

  _setupCrosshair() {
    if (this.isPanelMode) {
      return;
    }
    if (this._tooltipOwner === 'chart') {
      return;
    }
    if (this._isSettingUpCrosshair) {
      return;
    }
    this._isSettingUpCrosshair = true;
    try {
      this._cleanupCrosshairAndTooltip();
      if (!this.svgOverlay) {
        return;
      }
      this.crosshair = new Crosshair({
        enabled: true,
        lineColor: '#666666',
        lineOpacity: 0.7,
        highlightRadius: 3
      });
      this.tooltip = new CrosshairTooltip({
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        textColor: '#ffffff',
        fontSize: 12,
        dateFormat: 'medium',
        valueDecimals: 2,
        offsetX: 15,
        offsetY: 15,
        container: this.container
      });
      this.crosshair.render(this.svgOverlay, this.chartArea);
      this._setupCrosshairEvents();
      this._tooltipOwner = 'chart';
    } finally {
      this._isSettingUpCrosshair = false;
    }
  }

  _setupCrosshairEvents() {
    if (!this.container || !this.crosshair) return;
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseLeave = this._onMouseLeave.bind(this);
    this.container.addEventListener('mousemove', this._boundMouseMove);
    this.container.addEventListener('mouseleave', this._boundMouseLeave);
  }

  _cleanupCrosshairAndTooltip() {
    if (this.container) {
      if (this._boundOnMouseMove) {
        this.container.removeEventListener('mousemove', this._boundOnMouseMove);
        this._boundOnMouseMove = null;
      }
      if (this._boundOnMouseLeave) {
        this.container.removeEventListener('mouseleave', this._boundOnMouseLeave);
        this._boundOnMouseLeave = null;
      }
    }
    if (this.crosshair) {
      try {
        this.crosshair.destroy();
      } catch (e) {}
      this.crosshair = null;
    }
    if (this.tooltip) {
      try {
        this.tooltip.destroy();
      } catch (e) {}
      this.tooltip = null;
    }
    this._tooltipOwner = null;
  }

  _onMouseMove(event) {
    if (!this.crosshair || !this.isInitialized) {
      return;
    }
    try {
      const rect = this.container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      if (!this._isMouseInChartArea(mouseX, mouseY)) {
        this.crosshair.hide();
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      if (this.lastMousePosition) {
        const deltaX = Math.abs(mouseX - this.lastMousePosition.x);
        const deltaY = Math.abs(mouseY - this.lastMousePosition.y);
        if (deltaX < this.mouseThreshold && deltaY < this.mouseThreshold) {
          if (this.tooltip && this.tooltip.isVisible) {
            this.tooltip.updatePosition(mouseX, mouseY);
          }
          return;
        }
      }
      this.lastMousePosition = { x: mouseX, y: mouseY };
      const dataCoords = this._mouseToDataCoordinates(mouseX, mouseY);
      if (dataCoords.x != null && dataCoords.y != null) {
        this._updateCrosshair(dataCoords.x, mouseX, mouseY);
      }
    } catch (error) {}
  }

  _onMouseLeave(event) {
    if (this.crosshair) {
      this.crosshair.hide();
    }
    if (this.tooltip) {
      this.tooltip.hide();
    }
  }

  _isMouseInChartArea(mouseX, mouseY) {
    const chartArea = this.chartArea;
    return mouseX >= chartArea.x &&
      mouseX <= chartArea.x + chartArea.width &&
      mouseY >= chartArea.y &&
      mouseY <= chartArea.y + chartArea.height;
  }

  _mouseToDataCoordinates(mouseX, mouseY) {
    if (!this.scales.x || !this.scales.y) {
      return { x: null, y: null };
    }
    try {
      const dataX = this.scales.x.invert(mouseX);
      const dataY = this.scales.y.invert(mouseY);
      return { x: dataX, y: dataY };
    } catch (error) {
      return { x: null, y: null };
    }
  }

  _calculateMouseProximityTolerance() {
    const xScale = this.scales.x;
    if (!xScale) return 3600000;
    const visibleTimeRange = xScale.domain[1] - xScale.domain[0];
    const chartPixelWidth = this.chartArea.width;
    const msPerPixel = visibleTimeRange / chartPixelWidth;
    const tolerancePixels = 10;
    const tolerance = msPerPixel * tolerancePixels;
    return Math.max(300000, Math.min(43200000, tolerance));
  }

  _getDataPointsAtX(exactDataX) {
    const dataPoints = [];
    if (exactDataX == null) {
      return dataPoints;
    }
    if (Array.isArray(this.config.data)) {
      for (const dataset of this.config.data) {
        if (dataset.data && Array.isArray(dataset.data)) {
          const points = this.getDataPointsAtX(exactDataX, dataset);
          if (points && points.length > 0) {
            const enrichedPoints = points.map(p => ({
              ...p,
              dataset: p.dataset || dataset,
              datasetId: p.datasetId || dataset.id
            }));
            dataPoints.push(...enrichedPoints);
          }
        }
      }
    }
    if (this.studiesManager) {
      try {
        const studyPoints = this.studiesManager.getStudyDataPointsAtX(exactDataX);
        if (studyPoints && studyPoints.length > 0) {
          dataPoints.push(...studyPoints);
        }
      } catch (error) {}
    }
    const uniquePoints = [];
    const seenIds = new Set();
    for (const point of dataPoints) {
      const key = `${point.datasetId}_${point.dataX}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        uniquePoints.push(point);
      }
    }
    return uniquePoints;
  }

  _updateCrosshair(targetDataX, mouseX, mouseY) {
    if (!this.crosshair) {
      return;
    }
    try {
      const candidatePoints = this._findCandidateDataPoints(targetDataX);
      if (candidatePoints.length === 0) {
        this.crosshair.hide();
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      const bestDataX = this._findBestDataX(candidatePoints, targetDataX);
      const actualDataPoints = this._getDataPointsAtX(bestDataX);
      if (actualDataPoints.length === 0) {
        this.crosshair.hide();
        if (this.tooltip) {
          this.tooltip.hide();
        }
        return;
      }
      const primaryPoint = actualDataPoints[0];
      const crosshairX = primaryPoint.unifiedX;
      const crosshairY = primaryPoint.unifiedY;
      this.crosshair.show();
      this.crosshair.updatePosition(crosshairX, crosshairY);
      this.crosshair.updateHighlights(actualDataPoints);
      if (this.tooltip) {
        this.tooltip.show(actualDataPoints, mouseX, mouseY);
      }
    } catch (error) {
      if (this.tooltip) {
        this.tooltip.hide();
      }
    }
  }

  _findBestDataX(candidatePoints, mouseDataX) {
    if (candidatePoints.length === 0) return null;
    if (candidatePoints.length === 1) return candidatePoints[0].dataX;
    let bestX = null;
    let minDistance = Infinity;
    const xGroups = new Map();
    candidatePoints.forEach(point => {
      const dataX = point.dataX;
      if (!xGroups.has(dataX)) {
        xGroups.set(dataX, []);
      }
      xGroups.get(dataX).push(point);
    });
    for (const [dataX] of xGroups) {
      const distance = Math.abs(dataX - mouseDataX);
      if (distance < minDistance) {
        minDistance = distance;
        bestX = dataX;
      }
    }
    return bestX;
  }

  _findCandidateDataPoints(targetDataX) {
    const candidates = [];
    if (!Array.isArray(this.config.data)) {
      return candidates;
    }
    for (const dataset of this.config.data) {
      if (dataset.data && Array.isArray(dataset.data) && dataset.data.length > 0) {
        const closestPoints = this.findClosestDataPoints(targetDataX, dataset);
        if (closestPoints && closestPoints.length > 0) {
          candidates.push(...closestPoints);
        }
      }
    }
    return candidates;
  }

  testNewCrosshairLogic(mouseDataX) {
    const tolerance = this._calculateMouseProximityTolerance();
    this.config.data.forEach((dataset, i) => {
      const points = this.getDataPointsAtX(mouseDataX, dataset);
      if (points.length === 0) {
        const closest = this.findClosestDataPoints(mouseDataX, dataset);
        if (closest.length > 0) {
          // no-op
        }
      }
    });
  }

  findClosestDataPoints(targetDataX, dataset) {
    console.warn('findClosestDataPoints not implemented');
    return [];
  }

  getDataPointsAtX(exactDataX, dataset) {
    console.warn('getDataPointsAtX not implemented');
    return [];
  }

  setTooltipConfig(config) {
    if (this.tooltip) {
      this.tooltip.updateConfig(config);
    }
    return this;
  }

  toggleTooltip(enabled = null) {
    const shouldEnable = enabled !== null ? enabled : !this.tooltip;
    if (shouldEnable && !this.tooltip) {
      this.tooltip = new CrosshairTooltip();
    } else if (!shouldEnable && this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    return shouldEnable;
  }

  getTooltipInfo() {
    return this.tooltip ? this.tooltip.getState() : { enabled: false };
  }
}

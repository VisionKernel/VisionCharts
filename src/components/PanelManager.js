import { Panel } from './Panel.js';
import { Axis } from '../core/Axis.js';
import { createScale } from '../core/Scale.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { EndingLabels } from './EndingLabels.js';
import { Legend } from './Legend.js';
import { Crosshair } from './Crosshair.js';
import { CrosshairTooltip } from './CrosshairTooltip.js';
import { RecessionLines } from './RecessionLines.js';

export class PanelManager {
  constructor(chart) {
    this.chart = chart;
    this.PANEL_AREA_PERCENTAGE = 0.85;
    this.AXIS_AREA_PERCENTAGE = 0.15;
    this.isPanelMode = false;
    this.panels = [];
    this.panelContainer = null;
    this.panelSvgOverlay = null;
    this.sharedXScale = null;
    this.sharedXAxis = null;
    this.sharedAxisHeight = 0;
    this.endingLabels = null;
    this.legend = null;
    this.crosshair = null;
    this.tooltip = null;
    this.recessionLines = null;
    this.originalSingleModeState = null;
  }

  async togglePanelMode(force = null) {
    const newPanelMode = force !== null ? force : !this.isPanelMode;
    if (newPanelMode === this.isPanelMode) {
      return newPanelMode;
    }
    try {
      if (newPanelMode) {
        await this._switchToPanelMode();
        this.isPanelMode = true;
      } else {
        await this._switchToSingleMode();
      }
      return this.isPanelMode;
    } catch (error) {
      this.isPanelMode = !newPanelMode;
      throw error;
    }
  }

  getState() {
    return {
      isPanelMode: this.isPanelMode,
      panelCount: this.panels.length,
      hasSharedAxis: !!this.sharedXAxis,
      containerExists: !!this.panelContainer,
      axisAreaPercentage: this.AXIS_AREA_PERCENTAGE,
      panelAreaPercentage: this.PANEL_AREA_PERCENTAGE
    };
  }

  async refreshPanelMode() {
    if (!this.isPanelMode) return;
    try {
      const previousEndingLabelsState = this.panels.length > 0 ? this.panels[0].getEndingLabelsState()?.isVisible : false;
      this._destroyCrosshairAndTooltip();
      this._destroyPanels();
      this._destroyPanelContainer();
      if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
        return;
      }
      await this.chart._processData();
      this._createSharedXScale();
      this._createSharedXAxis();
      this._createPanelContainer();
      this._renderPanelModeTitle();
      if (previousEndingLabelsState) {
        this.toggleEndingLabels(true);
      }
      await this._createPanels();
      await this._renderPanels();
      this._setupCrosshairAndTooltip();
    } catch (error) {
      throw error;
    }
  }

  async _switchToPanelMode() {
    if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length <= 1) {
      throw new Error('Panel mode requires multiple datasets');
    }
    this._storeSingleModeState();
    this._destroySingleModeComponents();
    this._createSharedXScale();
    this._createSharedXAxis();
    this._createPanelContainer();
    this._renderPanelModeTitle();
    this._createLegend();
    await this._createPanels();
    await this._renderPanels();
    if (this.legend) {
      const singleModeLegendState = this.chart.legend && this.chart.legend.element
        ? this.chart.legend.element.style.display !== 'none'
        : true;
      this.toggleLegend(singleModeLegendState);
    }
    this._setupCrosshairAndTooltip();
  }

  async _switchToSingleMode() {
    this._destroyCrosshairAndTooltip();
    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
    }
    this.isPanelMode = false;
    this._destroyPanels();
    this._restoreContainerForSingleMode();
    this._restoreSingleModeState();
    await this._reinitializeSingleChart();
  }

  _restoreContainerForSingleMode() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
    while (this.chart.container.firstChild) {
      this.chart.container.removeChild(this.chart.container.firstChild);
    }
    this.chart.container.style.position = 'relative';
    this.chart.container.style.width = '100%';
    this.chart.container.style.height = '100%';
  }

  _validateContainerForPanelMode() {
    const containerHeight = this.chart.container.offsetHeight;
    const containerWidth = this.chart.container.offsetWidth;
    const datasetCount = this.chart.config.data.length;
    const axisAreaHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
    const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
    const panelHeight = Math.floor(panelAreaHeight / datasetCount);
    const minPanelHeight = 60;
    if (panelHeight < minPanelHeight) {
      return false;
    }
    return true;
  }

  _storeSingleModeState() {
    this.originalSingleModeState = {
      rendererInstance: this.chart.rendererInstance,
      canvas: this.chart.canvas,
      svgOverlay: this.chart.svgOverlay,
      scales: { ...this.chart.scales },
      axes: { ...this.chart.axes },
      chartArea: { ...this.chart.chartArea },
      generatedPaths: this.chart.generatedPaths ? [...this.chart.generatedPaths] : null,
      transformedData: this.chart.transformedData ? [...this.chart.transformedData] : null
    };
  }

  _restoreSingleModeState() {
    if (!this.originalSingleModeState) {
      return;
    }
    this.originalSingleModeState = null;
  }

  _destroySingleModeComponents() {
    if (this.chart.rendererInstance) {
      this.chart.rendererInstance.destroy();
      this.chart.rendererInstance = null;
    }
    if (this.chart.canvas && this.chart.canvas.parentNode) {
      this.chart.canvas.parentNode.removeChild(this.chart.canvas);
      this.chart.canvas = null;
    }
    if (this.chart.svgOverlay && this.chart.svgOverlay.parentNode) {
      this.chart.svgOverlay.parentNode.removeChild(this.chart.svgOverlay);
      this.chart.svgOverlay = null;
    }
    this.chart.scales = { x: null, y: null };
    this.chart.axes = { x: null, y: null };
    this.chart.generatedPaths = null;
    this.chart.transformedData = null;
  }

  _createSharedXScale() {
    let xMin = Infinity;
    let xMax = -Infinity;
    
    const allXValues = [];
    
    for (const dataset of this.chart.config.data) {
      if (!dataset.data || !Array.isArray(dataset.data)) continue;
      for (const point of dataset.data) {
        if (point.x != null) {
          const xValue = point.x instanceof Date ? point.x.getTime() : point.x;
          xMin = Math.min(xMin, xValue);
          xMax = Math.max(xMax, xValue);
          allXValues.push(xValue);
        }
      }
    }
    
    if (xMin === Infinity || xMax === -Infinity) {
      throw new Error('No valid X values found in datasets');
    }
    
    if (this.chart.chartType === 'bar' && allXValues.length > 1) {
      const sortedXValues = [...allXValues].sort((a, b) => a - b);
      
      let totalSpacing = 0;
      let spacingCount = 0;
      for (let i = 1; i < sortedXValues.length; i++) {
        const spacing = sortedXValues[i] - sortedXValues[i - 1];
        if (spacing > 0) {
          totalSpacing += spacing;
          spacingCount++;
        }
      }
      
      if (spacingCount > 0) {
        const avgSpacing = totalSpacing / spacingCount;
        const barWidth = this.chart.config.options.barWidth || 0.7;
        const barPadding = (avgSpacing * barWidth) / 2;

        xMin = xMin - barPadding;
        xMax = xMax + barPadding;
      }
    }
    
    const chartMargin = this.chart.config.options.margin;
    const panelLeftPadding = chartMargin.left;
    const panelRightPadding = chartMargin.right;
    const containerWidth = this.chart.container.offsetWidth;
    const chartAreaWidth = containerWidth - panelLeftPadding - panelRightPadding;
    const xDomain = [xMin, xMax];
    const yAxisPadding = 20;
    const xRange = [panelLeftPadding - yAxisPadding, panelLeftPadding + chartAreaWidth];
    const scaleType = this.chart.config.options.xType === 'time' ? 'time' : 'linear';
    this.sharedXScale = createScale(scaleType, xDomain, xRange);
  }

  _createSharedXAxis() {
    if (!this.sharedXScale) {
      throw new Error('Shared X scale must be created before axis');
    }
    this.sharedXAxis = Axis.createSharedXAxis({
      scale: this.sharedXScale,
      options: {
        label: this.chart.config.options.xAxisName || 'Date',
        labelPadding: 20,
        tickCount: Math.min(8, Math.max(4, Math.floor(this.chart.container.offsetWidth / 100))),
        tickFormat: this.chart.config.options.xType === 'time' ? 'time' : 'number'
      }
    });
  }

  _calculateSharedAxisHeight() {
    const containerHeight = this.chart.container.offsetHeight;
    this.sharedAxisHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
  }

  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panel-container';
    this.panelContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: visible;
      box-sizing: border-box;
    `;
    while (this.chart.container.firstChild) {
      this.chart.container.removeChild(this.chart.container.firstChild);
    }
    this.chart.container.appendChild(this.panelContainer);
    this.panelSvgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.panelSvgOverlay.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      overflow: visible;
    `;
    this.panelContainer.appendChild(this.panelSvgOverlay);
    this._createEndingLabels();
    this._createLegend();
    this._createRecessionLines();
  }

  async _createPanels() {
    this.panels = [];
    const totalPanels = this.chart.config.data.length;
    const containerHeight = this.chart.container.offsetHeight;
    this._calculateSharedAxisHeight();
    const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
    const axisAreaHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
    if (panelAreaHeight <= 0) {
      throw new Error(`Container too small: ${containerHeight}px height needs ${axisAreaHeight}px for axis area`);
    }
    const panelHeight = Math.floor(panelAreaHeight / totalPanels);
    for (let i = 0; i < totalPanels; i++) {
      const dataset = this.chart.config.data[i];
      const panel = new Panel({
        dataset: dataset,
        chart: this.chart,
        panelIndex: i,
        totalPanels: totalPanels,
        height: panelHeight,
        container: this.panelContainer,
        sharedXScale: this.sharedXScale,
        chartType: this.chart.chartType || 'line',
        hasSharedXAxis: true,
        rendererType: this.chart.activeRenderer || 'canvas',
        yAxisName: this.chart.config.options.yAxisName || 'Value',
        isLogarithmic: this.chart.config.options.isLogarithmic,
        recessionData: this.chart.recessionLines?.config.recessionData || [],
        showGrid: this.chart.config.options.showGrid,
        showXGrid: this.chart.config.options.showXGrid,
        showYGrid: this.chart.config.options.showYGrid,
        gridColor: this.chart.config.options.gridColor,
        gridOpacity: this.chart.config.options.gridOpacity,
        gridOptions: {
          xGridColor: '#f0f0f0',
          yGridColor: '#f0f0f0',
          xGridOpacity: 0.4,
          yGridOpacity: 0.4,
          xGridWidth: 0.5,
          yGridWidth: 0.5,
          skipEdgeLines: true
        }
      });
      await panel.initialize();
      this.panels.push(panel);
    }
  }

  async _renderPanels() {
    if (this.panels.length === 0) {
      return;
    }
    for (const panel of this.panels) {
      await panel.render();
    }
    this._renderSharedXAxis();
    if (this.endingLabels && this.endingLabels.config.enabled) {
      this._renderEndingLabels();
    }
    this._renderLegend();
  }

  _renderSharedXAxis() {
    if (!this.sharedXAxis || !this.panelSvgOverlay) return;
    const containerHeight = this.chart.container.offsetHeight;
    const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
    const axisStartY = panelAreaHeight;
    const position = {
      x: 60,
      y: axisStartY
    };
    const existingAxes = this.panelSvgOverlay.querySelectorAll('.axis');
    existingAxes.forEach(axis => {
      if (axis.getAttribute('class').includes('axis-x') ||
        axis.getAttribute('class').includes('axis-undefined')) {
        axis.remove();
      }
    });
    this.sharedXAxis.render(this.panelSvgOverlay, position);
  }

  _renderPanelModeTitle() {
    if (!this.chart.config.options.title || !this.panelSvgOverlay) return;
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const centerX = this.chart.config.options.width / 2;
    const titleY = this.chart.config.options.titlePadding + this.chart.config.options.titleFontSize;
    titleElement.setAttribute('x', centerX);
    titleElement.setAttribute('y', titleY);
    titleElement.setAttribute('text-anchor', 'middle');
    titleElement.setAttribute('font-size', this.chart.config.options.titleFontSize);
    titleElement.setAttribute('font-family', this.chart.config.options.titleFontFamily);
    titleElement.setAttribute('font-weight', this.chart.config.options.titleFontWeight);
    titleElement.setAttribute('fill', this.chart.config.options.titleColor);
    titleElement.setAttribute('class', 'chart-title panel-mode');
    titleElement.textContent = this.chart.config.options.title;
    this.panelSvgOverlay.appendChild(titleElement);
  }

  _createLegend() {
    this.legend = new Legend({
      fontSize: 12,
      fontFamily: this.chart.config.options.titleFontFamily || 'Arial, sans-serif',
      textColor: '#333333',
      itemSpacing: 25,
      marginTop: 15,
      marginBottom: 15
    });
  }

  _renderLegend() {
    if (this.legend && this.chart.config.data) {
      const studies = this.chart.studiesManager ?
        this.chart.studiesManager.getVisibleStudies() : [];
      this.legend.updateDatasets(this.chart.config.data, studies);
      if (this.panelSvgOverlay && this.chart.chartArea) {
        const legendChartArea = {
          ...this.chart.chartArea,
          y: (this.chart.config.options.title ?
            this.chart.config.options.titlePadding + this.chart.config.options.titleFontSize : 0) + 15
        };
        this.legend.render(this.panelSvgOverlay, legendChartArea);
      }
    }
  }

  toggleLegend(show = null) {
    if (!this.isPanelMode) {
      return false;
    }
    if (!this.legend) {
      return false;
    }
    let newState;
    if (show !== null) {
      newState = show;
    } else {
      const isCurrentlyVisible = this.legend.element &&
        this.legend.element.style.display !== 'none';
      newState = !isCurrentlyVisible;
    }
    this.legend.setVisible(newState);
    return newState;
  }

  isLegendVisible() {
    if (!this.isPanelMode || !this.legend || !this.legend.element) {
      return false;
    }
    return this.legend.element.style.display !== 'none';
  }

  _createEndingLabels() {
    if (this.endingLabels) {
      this.endingLabels.destroy?.();
    }
    this.endingLabels = new EndingLabels({
      enabled: false,
      offsetX: 0,
      offsetY: 0,
      fontSize: 11,
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backgroundPadding: 4,
      borderRadius: 3
    });
  }

  _createRecessionLines() {
    if (!this.chart.recessionLines) {
      return;
    }
    this.recessionLines = new RecessionLines({
      enabled: this.chart.recessionLines.config.enabled,
      fillColor: this.chart.recessionLines.config.fillColor,
      strokeColor: this.chart.recessionLines.config.strokeColor,
      strokeWidth: this.chart.recessionLines.config.strokeWidth
    });
    this.recessionLines.setRecessionData(this.chart.recessionLines.config.recessionData);
  }

  _renderRecessionLines() {
    if (!this.recessionLines) {
      return;
    }
    const panelAreaHeight = Math.floor(this.chart.container.offsetHeight * this.PANEL_AREA_PERCENTAGE);
    const fullPanelArea = {
      x: this.chart.config.options.margin.left,
      y: this.chart.config.options.margin.top,
      width: this.chart.container.offsetWidth - this.chart.config.options.margin.left - this.chart.config.options.margin.right,
      height: panelAreaHeight - this.chart.config.options.margin.top
    };
    this.recessionLines.render(this.panelContainer, fullPanelArea, { x: this.sharedXScale });
  }

  _collectAllPanelEndpoints() {
    const endpoints = [];
    for (const panel of this.panels) {
      const endpoint = panel.getLineEndpoint();
      if (endpoint) {
        const globalCoords = this._translatePanelCoordinatesToGlobal(endpoint);
        if (globalCoords) {
          endpoints.push({
            ...endpoint,
            globalX: globalCoords.x,
            globalY: globalCoords.y
          });
        }
      }
    }
    return endpoints;
  }

  _translatePanelCoordinatesToGlobal(endpoint) {
    if (!endpoint || !endpoint.panelChartArea) {
      return null;
    }
    const panel = this.panels[endpoint.panelIndex];
    if (!panel) {
      return null;
    }
    const mainContainerRect = this.chart.container.getBoundingClientRect();
    const panelContainerRect = panel.panelContainer.getBoundingClientRect();
    const actualPanelStartY = panelContainerRect.y - mainContainerRect.y;
    const globalX = endpoint.localX;
    const globalY = actualPanelStartY + endpoint.localY;
    return {
      x: globalX,
      y: globalY
    };
  }

  _createEndingLabelsDatasets() {
    const endpoints = this._collectAllPanelEndpoints();
    return endpoints.map(endpoint => ({
      ...endpoint.dataset,
      data: [{
        x: endpoint.dataX,
        y: endpoint.dataY,
        unifiedX: endpoint.globalX,
        unifiedY: endpoint.globalY,
        screenX: endpoint.globalX,
        screenY: endpoint.globalY,
        pixelX: endpoint.globalX,
        pixelY: endpoint.globalY
      }]
    }));
  }

  _renderEndingLabels() {
    if (!this.endingLabels || !this.panelSvgOverlay) {
      return;
    }
    const containerHeight = this.chart.container.offsetHeight;
    const containerWidth = this.chart.container.offsetWidth;
    const globalChartArea = {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight
    };
    const datasets = this._createEndingLabelsDatasets();
    this.endingLabels.updateDatasets(datasets);
    this.endingLabels.render(this.panelSvgOverlay, globalChartArea);
  }

  toggleEndingLabels(show = null) {
    if (!this.isPanelMode || !this.endingLabels) {
      return false;
    }
    const currentState = this.endingLabels.isVisible;
    const newState = show !== null ? show : !currentState;
    if (newState) {
      if (!this.endingLabels.isRendered || this.panels.length > 0) {
        this._renderEndingLabels();
      }
      this.endingLabels.show();
    } else {
      this.endingLabels.hide();
    }
    return newState;
  }

  updateEndingLabels() {
    if (!this.isPanelMode || !this.endingLabels || this.panels.length === 0) {
      return;
    }
    this._renderEndingLabels();
  }

  getEndingLabelsState() {
    if (!this.isPanelMode || !this.endingLabels) {
      return null;
    }
    return {
      isVisible: this.endingLabels.isVisible,
      enabled: this.endingLabels.config.enabled,
      panelCount: this.panels.length,
      mode: 'panel'
    };
  }

  async refreshPanelMode() {
    if (!this.isPanelMode) return;
    try {
      const previousLegendState = this.isLegendVisible();
      const previousEndingLabelsState = this.panels.length > 0 ?
        this.panels[0].getEndingLabelsState()?.isVisible : false;
      this._destroyCrosshairAndTooltip();
      this._destroyPanels();
      this._destroyPanelContainer();
      if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
        return;
      }
      await this.chart._processData();
      this._createSharedXScale();
      this._createSharedXAxis();
      this._createPanelContainer();
      this._renderPanelModeTitle();
      this._createLegend();
      if (previousEndingLabelsState) {
        this.toggleEndingLabels(true);
      }
      await this._createPanels();
      await this._renderPanels();
      if (this.legend && previousLegendState !== this.isLegendVisible()) {
        this.toggleLegend(previousLegendState);
      }
      this._setupCrosshairAndTooltip();
    } catch (error) {
      throw error;
    }
  }

  _destroyPanels() {
    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
    }
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }
    if (this.crosshair) {
      this.crosshair.destroy();
      this.crosshair = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    if (this.recessionLines) {
      this.recessionLines.destroy();
      this.recessionLines = null;
    }
    for (const panel of this.panels) {
      panel.destroy();
    }
    if (this.sharedXAxis) {
      this.sharedXAxis = null;
    }
    if (this.panelSvgOverlay) {
      if (this.panelSvgOverlay.parentNode) {
        this.panelSvgOverlay.parentNode.removeChild(this.panelSvgOverlay);
      }
      this.panelSvgOverlay = null;
    }
    this.panels = [];
    this.sharedXScale = null;
  }

  _destroyPanelContainer() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
  }

  async _reinitializeSingleChart() {
    try {
      this.isPanelMode = false;
      if (this.chart.rendererInstance) {
        this.chart.rendererInstance.destroy();
        this.chart.rendererInstance = null;
      }
      this.chart.generatedPaths = null;
      this.chart.transformedData = null;
      this.chart.canvas = null;
      this.chart.svgOverlay = null;
      this.chart.gridCanvas = null;
      if (this.chart.coordinateSystem) {
        this.chart.coordinateSystem.clearCache();
      }
      await this.chart._initialize();
      await this.chart.render();
    } catch (error) {
      try {
        this.isPanelMode = false;
        this.chart._calculateDimensions();
        this.chart._setupRenderingLayers();
        await this.chart._processData();
        this.chart._createScales();
        if (this.chart.coordinateSystem) {
          this.chart.coordinateSystem.setScales(this.chart.scales);
        }
        this.chart._createAxes();
        this.chart._createGrid();
        await this.chart._initializeRenderer();
        if (this.chart.coordinateSystem && this.chart.config.data) {
          this.chart.config.data = await this.chart.coordinateSystem.transformDatasets(this.chart.config.data, {
            strictValidation: false
          });
          this.chart.generatedPaths = await PathGenerator.generatePaths(this.chart.config.data, {
            curve: this.chart.config.options.curve || 'linear',
            strokeWidth: this.chart.config.options.strokeWidth || 2,
            targetRenderer: this.chart.activeRenderer
          });
        }
        await this.chart.render();
      } catch (fallbackError) {
        this.chart.container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 20px; margin-bottom: 12px;">⚠️</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Chart Error</div>
              <div style="font-size: 14px; color: #888;">Unable to restore single chart mode</div>
              <div style="font-size: 12px; color: #aaa; margin-top: 12px;">Try refreshing the page</div>
            </div>
          </div>
        `;
        throw fallbackError;
      }
    }
  }

  _setupCrosshairAndTooltip() {
    if (this._isSettingUpCrosshair) {
      return;
    }
    this._isSettingUpCrosshair = true;
    try {
      if (this.chart._tooltipOwner === 'chart') {
        this.chart._cleanupCrosshairAndTooltip();
      }
      this._destroyCrosshairAndTooltip();
      this.crosshair = new Crosshair({
        lineColor: '#555',
        lineDash: [4, 4]
      });
      const fullChartArea = {
        x: 0,
        y: 0,
        width: this.chart.config.options.width,
        height: this.chart.config.options.height
      };
      this.crosshair.render(this.panelSvgOverlay, fullChartArea);
      this.tooltip = new CrosshairTooltip({
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        textColor: '#ffffff',
        fontSize: 12,
        dateFormat: 'medium',
        valueDecimals: 2,
        offsetX: 15,
        offsetY: 15,
        container: this.chart.container
      });
      this._setupCrosshairEvents();
      this.chart._tooltipOwner = 'panelManager';
    } finally {
      this._isSettingUpCrosshair = false;
    }
  }

  _setupCrosshairEvents() {
    if (!this.chart.container) return;
    if (this._boundOnMouseMove) {
      this.chart.container.removeEventListener('mousemove', this._boundOnMouseMove);
    }
    if (this._boundOnMouseLeave) {
      this.chart.container.removeEventListener('mouseleave', this._boundOnMouseLeave);
    }
    this._boundOnMouseMove = this._onMouseMove.bind(this);
    this._boundOnMouseLeave = this._onMouseLeave.bind(this);
    this.chart.container.addEventListener('mousemove', this._boundOnMouseMove);
    this.chart.container.addEventListener('mouseleave', this._boundOnMouseLeave);
  }

  _onMouseMove(event) {
    if (!this.chart.chartArea) return;
    const rect = this.chart.container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    if (mouseX < this.chart.chartArea.x ||
      mouseX > this.chart.chartArea.x + this.chart.chartArea.width ||
      mouseY < this.chart.chartArea.y ||
      mouseY > this.chart.chartArea.y + this.chart.chartArea.height) {
      this.crosshair.hide();
      this.tooltip.hide();
      return;
    }
    const dataX = this.sharedXScale.invert(mouseX);
    let allPoints = [];
    this.panels.forEach(panel => {
      const points = panel.getDataPointsAtX(dataX);
      allPoints.push(...points);
    });
    if (allPoints.length > 0) {
      const seenDatasets = new Set();
      const uniquePoints = [];
      for (const point of allPoints) {
        const key = `${point.datasetId}_${point.dataX}`;
        if (!seenDatasets.has(key)) {
          seenDatasets.add(key);
          uniquePoints.push(point);
        }
      }
      this.crosshair.show();
      this.crosshair.updatePosition(mouseX, mouseY);
      this.crosshair.updateHighlights(uniquePoints.map(p => {
        const panel = this.panels[p.panelIndex];
        const panelTopOffset = p.panelIndex * panel.config.height;
        const y = panelTopOffset + p.pixelY;
        return { ...p, unifiedX: p.pixelX, unifiedY: y };
      }));
      this.tooltip.show(
        uniquePoints,
        event.clientX,
        event.clientY
      );
    } else {
      this.crosshair.hide();
      this.tooltip.hide();
    }
  }

  _onMouseLeave(event) {
    if (this.crosshair) {
      this.crosshair.hide();
    }
    if (this.tooltip) {
      this.tooltip.hide();
    }
  }

  toggleAverageLine(show) {
    this.panels.forEach(panel => panel.toggleAverageLine(show));
  }

  toggleMedianLine(show) {
    this.panels.forEach(panel => panel.toggleMedianLine(show));
  }

  toggleZeroLine(show) {
    this.panels.forEach(panel => panel.toggleZeroLine(show));
  }

  toggleRecessionLines(show) {
    this.panels.forEach(panel => panel.toggleRecessionLines(show));
  }

  _destroyCrosshairAndTooltip() {
    if (this.chart.container) {
      if (this._boundOnMouseMove) {
        this.chart.container.removeEventListener('mousemove', this._boundOnMouseMove);
        this._boundOnMouseMove = null;
      }
      if (this._boundOnMouseLeave) {
        this.chart.container.removeEventListener('mouseleave', this._boundOnMouseLeave);
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
    if (this.chart._tooltipOwner === 'panelManager') {
      this.chart._tooltipOwner = null;
    }
  }

  _createEndingLabels() {
    if (this.endingLabels) {
      this.endingLabels.destroy?.();
    }
    this.endingLabels = new EndingLabels({
      enabled: false,
      offsetX: 0,
      offsetY: 0,
      fontSize: 11,
      showBackground: true,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backgroundPadding: 4,
      borderRadius: 3
    });
  }

  updateLegendWithStudies(studies) {
    if (!this.legend) {
      return;
    }
    try {
      const allDatasets = [];
      for (const panel of this.panels) {
        if (panel.config && panel.config.dataset) {
          allDatasets.push(panel.config.dataset);
        }
      }
      this.legend.updateDatasets(allDatasets, studies);
      if (this.chart.svgOverlay && this.sharedChartArea) {
        this.legend.render(this.chart.svgOverlay, this.sharedChartArea);
      }
    } catch (error) {}
  }

  _getPanelEndpoints() {
    const endpoints = [];
    this.panels.forEach(panel => {
      const endpoint = panel.getLineEndpoint();
      if (endpoint) {
        const panelTopOffset = panel.config.panelIndex * panel.config.height;
        endpoints.push({
          ...endpoint,
          unifiedX: endpoint.localX,
          unifiedY: panelTopOffset + endpoint.localY
        });
      }
    });
    return endpoints;
  }

  _renderEndingLabels() {
    if (!this.endingLabels || !this.panelSvgOverlay) {
      return;
    }
    const containerHeight = this.chart.container.offsetHeight;
    const containerWidth = this.chart.container.offsetWidth;
    const globalChartArea = {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight
    };
    const datasets = this._getPanelEndpoints().map(endpoint => ({
      ...endpoint.dataset,
      data: [{
        x: endpoint.dataX,
        y: endpoint.dataY,
        unifiedX: endpoint.unifiedX,
        unifiedY: endpoint.unifiedY
      }]
    }));
    this.endingLabels.updateDatasets(datasets);
    this.endingLabels.render(this.panelSvgOverlay, globalChartArea);
  }

  toggleEndingLabels(show = null) {
    if (!this.isPanelMode || !this.endingLabels) {
      return false;
    }
    const currentState = this.endingLabels.isVisible;
    const newState = show !== null ? show : !currentState;
    if (newState) {
      if (!this.endingLabels.isRendered || this.panels.length > 0) {
        this._renderEndingLabels();
      }
      this.endingLabels.show();
    } else {
      this.endingLabels.hide();
    }
    return newState;
  }

  updateEndingLabels() {
    if (!this.isPanelMode || !this.endingLabels || this.panels.length === 0) {
      return;
    }
    this._renderEndingLabels();
  }

  getEndingLabelsState() {
    if (!this.isPanelMode || !this.endingLabels) {
      return null;
    }
    return {
      isVisible: this.endingLabels.isVisible,
      enabled: this.endingLabels.config.enabled,
      panelCount: this.panels.length,
      mode: 'panel'
    };
  }

  async refreshPanelMode() {
    if (!this.isPanelMode) return;
    try {
      const previousEndingLabelsState = this.endingLabels ? this.endingLabels.isVisible : false;
      this._destroyPanels();
      this._destroyPanelContainer();
      if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
        return;
      }
      await this.chart._processData();
      this._createSharedXScale();
      this._createSharedXAxis();
      this._createPanelContainer();
      this._renderPanelModeTitle();
      if (previousEndingLabelsState && this.endingLabels) {
        this.endingLabels.config.enabled = true;
      }
      await this._createPanels();
      await this._renderPanels();
    } catch (error) {
      throw error;
    }
  }

  _destroyPanels() {
    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
    }
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }
    if (this.crosshair) {
      this.crosshair.destroy();
      this.crosshair = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    if (this.recessionLines) {
      this.recessionLines.destroy();
      this.recessionLines = null;
    }
    for (const panel of this.panels) {
      panel.destroy();
    }
    if (this.sharedXAxis) {
      this.sharedXAxis = null;
    }
    if (this.panelSvgOverlay) {
      if (this.panelSvgOverlay.parentNode) {
        this.panelSvgOverlay.parentNode.removeChild(this.panelSvgOverlay);
      }
      this.panelSvgOverlay = null;
    }
    this.panels = [];
    this.sharedXScale = null;
  }

  _destroyPanelContainer() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
  }

  async _reinitializeSingleChart() {
    try {
      this.isPanelMode = false;
      if (this.chart.rendererInstance) {
        this.chart.rendererInstance.destroy();
        this.chart.rendererInstance = null;
      }
      this.chart.generatedPaths = null;
      this.chart.transformedData = null;
      this.chart.canvas = null;
      this.chart.svgOverlay = null;
      this.chart.gridCanvas = null;
      if (this.chart.coordinateSystem) {
        this.chart.coordinateSystem.clearCache();
      }
      await this.chart._initialize();
      await this.chart.render();
    } catch (error) {
      try {
        this.isPanelMode = false;
        this.chart._calculateDimensions();
        this.chart._setupRenderingLayers();
        await this.chart._processData();
        this.chart._createScales();
        if (this.chart.coordinateSystem) {
          this.chart.coordinateSystem.setScales(this.chart.scales);
        }
        this.chart._createAxes();
        this.chart._createGrid();
        await this.chart._initializeRenderer();
        if (this.chart.coordinateSystem && this.chart.config.data) {
          this.chart.config.data = await this.chart.coordinateSystem.transformDatasets(this.chart.config.data, {
            strictValidation: false
          });
          this.chart.generatedPaths = await PathGenerator.generatePaths(this.chart.config.data, {
            curve: this.chart.config.options.curve || 'linear',
            strokeWidth: this.chart.config.options.strokeWidth || 2,
            targetRenderer: this.chart.activeRenderer
          });
        }
        await this.chart.render();
      } catch (fallbackError) {
        this.chart.container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 20px; margin-bottom: 12px;">⚠️</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Chart Error</div>
              <div style="font-size: 14px; color: #888;">Unable to restore single chart mode</div>
              <div style="font-size: 12px; color: #aaa; margin-top: 12px;">Try refreshing the page</div>
            </div>
          </div>
        `;
        throw fallbackError;
      }
    }
  }

  destroy() {
    if (this.isPanelMode) {
      this._destroyPanels();
      this._destroyPanelContainer();
    }
    this.chart = null;
    this.originalSingleModeState = null;
    if (this.legend) {
      this.legend.destroy();
      this.legend = null;
    }
    this._destroyCrosshairAndTooltip();
    console.log('PanelManager destroyed');
  }
}

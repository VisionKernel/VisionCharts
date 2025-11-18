import { PathGenerator } from '../utils/PathGenerator.js';

export default class PanelDataRenderer {
  constructor(config = {}) {
    this.config = {
      chartType: 'line',
      rendererType: 'canvas',
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      curve: 'monotone',
      barWidth: 0.7,
      barSpacing: 0.1,
      ...config
    };
  }

  async render(dataset, xScale, yScale, chartArea, renderer) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      return;
    }

    if (!xScale || !yScale || !chartArea || !renderer) {
      throw new Error('PanelDataRenderer: Missing required rendering parameters');
    }

    try {
      const transformedDataset = this._transformDatasetCoordinates(dataset, xScale, yScale, chartArea);
      renderer.setViewport(chartArea);

      if (dataset.isStudy || this.config.chartType === 'line') {
        await this._renderLineDataset(transformedDataset, renderer, chartArea);
      } else if (this.config.chartType === 'bar') {
        await this._renderBarDataset(transformedDataset, renderer, chartArea, {
          xScale: xScale,
          yScale: yScale
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async _renderLineDataset(transformedDataset, renderer, chartArea) {
    const pathData = await PathGenerator.generatePath(transformedDataset, {
      curve: this.config.curve,
      targetRenderer: this.config.rendererType,
      enableCoordinateValidation: true
    });

    if (!pathData || !pathData.vertices || pathData.vertices.length === 0) {
      return;
    }

    await renderer.renderLines([pathData], null, {
      showPoints: this.config.showPoints,
      pointRadius: this.config.pointRadius,
      enableFill: transformedDataset.fill || false,
      chartArea: chartArea,
      fillOpacity: 0.3
    });
  }

  async _renderBarDataset(transformedDataset, renderer, chartArea, scales) {
    const formattedScales = {
      x: scales.xScale,
      y: scales.yScale
    };

    await renderer.renderBars([transformedDataset], formattedScales, {
      barWidth: this.config.barWidth,
      barSpacing: this.config.barSpacing,
      showBorder: this.config.showBorder,
      borderWidth: this.config.borderWidth,
      chartArea: chartArea
    });
  }

  _transformDatasetCoordinates(dataset, xScale, yScale, chartArea) {
    const transformedData = dataset.data.map(point => {
      const screenX = xScale.scale(point.x);
      const screenY = yScale.scale(point.y);

      return {
        ...point,
        unifiedX: screenX,
        unifiedY: screenY,
        screenX: screenX,
        screenY: screenY
      };
    });

    return {
      ...dataset,
      data: transformedData
    };
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  setChartType(chartType) {
    if (!['line', 'bar'].includes(chartType)) {
      return;
    }

    this.config.chartType = chartType;
  }

  setCurveType(curveType) {
    this.config.curve = curveType;
  }

  setRendererType(rendererType) {
    this.config.rendererType = rendererType;
  }

  getInfo() {
    return {
      chartType: this.config.chartType,
      rendererType: this.config.rendererType,
      config: this.config
    };
  }
}

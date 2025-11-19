import { AverageLine } from './AverageLine.js';
import { MedianLine } from './MedianLine.js';

export class StatisticalLines {
  constructor(config = {}) {
    this.config = {
      averageConfig: {
        strokeColor: '#FF6B35',
        strokeWidth: 2,
        strokeOpacity: 0.8,
        strokeDash: [5, 5],
        enabled: false,
        showLabel: true,
        labelText: 'Avg',
        labelPosition: 'right',
        useAllDatasets: true,
        ...config.averageConfig
      },
      medianConfig: {
        strokeColor: '#9C27B0',
        strokeWidth: 2,
        strokeOpacity: 0.8,
        strokeDash: [8, 4],
        enabled: false,
        showLabel: true,
        labelText: 'Median',
        labelPosition: 'right',
        useAllDatasets: true,
        ...config.medianConfig
      },
      autoPositionLabels: true,
      hideWhenOutOfRange: true,
      ...config
    };

    this.averageLine = new AverageLine(this.config.averageConfig);
    this.medianLine = new MedianLine(this.config.medianConfig);

    this.chartArea = null;
    this.scales = null;
    this.datasets = [];

    this.isRendered = false;
  }

  updateDatasets(datasets) {
    this.datasets = datasets || [];

    this.averageLine.updateDatasets(this.datasets);
    this.medianLine.updateDatasets(this.datasets);

    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }

  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      return;
    }

    this.chartArea = chartArea;
    this.scales = scales;

    this.averageLine.render(container, chartArea, scales);
    this.medianLine.render(container, chartArea, scales);

    this.isRendered = true;

    if (this.config.autoPositionLabels) {
      this._adjustLabelPositions();
    }
  }

  toggleAverage(show = null) {
    const result = this.averageLine.toggle(show);

    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }

    return result;
  }

  toggleMedian(show = null) {
    const result = this.medianLine.toggle(show);

    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }

    return result;
  }

  showAverage() {
    return this.toggleAverage(true);
  }

  hideAverage() {
    return this.toggleAverage(false);
  }

  showMedian() {
    return this.toggleMedian(true);
  }

  hideMedian() {
    return this.toggleMedian(false);
  }

  updateScales(newScales) {
    this.scales = newScales;

    this.averageLine.updateScales(newScales);
    this.medianLine.updateScales(newScales);

    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }

  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;

    this.averageLine.updateChartArea(newChartArea);
    this.medianLine.updateChartArea(newChartArea);
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);

    if (newConfig.averageConfig) {
      this.averageLine.updateConfig(newConfig.averageConfig);
    }

    if (newConfig.medianConfig) {
      this.medianLine.updateConfig(newConfig.medianConfig);
    }

    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }

  getStatisticalValues() {
    return {
      average: this.averageLine.getAverageValue(),
      median: this.medianLine.getMedianValue(),
      averageInRange: this.averageLine.getState().averageInRange,
      medianInRange: this.medianLine.getState().medianInRange
    };
  }

  getState() {
    return {
      isRendered: this.isRendered,
      datasetCount: this.datasets.length,
      average: this.averageLine.getState(),
      median: this.medianLine.getState(),
      config: this.config
    };
  }

  _adjustLabelPositions() {
    const averageState = this.averageLine.getState();
    const medianState = this.medianLine.getState();

    if (!averageState.isVisible || !medianState.isVisible ||
        averageState.currentAverage == null || medianState.currentMedian == null) {
      return;
    }

    const averageValue = averageState.currentAverage;
    const medianValue = medianState.currentMedian;

    const averageY = this.scales.y.scale(averageValue);
    const medianY = this.scales.y.scale(medianValue);
    const pixelDifference = Math.abs(averageY - medianY);

    const minLabelSpacing = 20;

    if (pixelDifference < minLabelSpacing) {
      if (averageValue > medianValue) {
        this.averageLine.updateConfig({ labelPosition: 'right' });
        this.medianLine.updateConfig({ labelPosition: 'left' });
      } else {
        this.averageLine.updateConfig({ labelPosition: 'left' });
        this.medianLine.updateConfig({ labelPosition: 'right' });
      }
    } else {
      this.averageLine.updateConfig({ labelPosition: 'right' });
      this.medianLine.updateConfig({ labelPosition: 'right' });
    }
  }

  getComponents() {
    return {
      averageLine: this.averageLine,
      medianLine: this.medianLine
    };
  }

  setDataScope(useAllDatasets) {
    this.averageLine.updateConfig({ useAllDatasets });
    this.medianLine.updateConfig({ useAllDatasets });

    this.averageLine.updateDatasets(this.datasets);
    this.medianLine.updateDatasets(this.datasets);
  }

  setAutoPositionLabels(enabled) {
    this.config.autoPositionLabels = enabled;

    if (enabled && this.isRendered) {
      this._adjustLabelPositions();
    }
  }

  destroy() {
    this.averageLine.destroy();
    this.medianLine.destroy();

    this.chartArea = null;
    this.scales = null;
    this.datasets = [];
    this.isRendered = false;
  }
}

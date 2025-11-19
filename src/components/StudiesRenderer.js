import { PathGenerator } from '../utils/PathGenerator.js';

export class StudiesRenderer {
  constructor(chart) {
    this.chart = chart;
    this.isInitialized = false;
    this.studyPaths = new Map();
    this.lastRenderTime = 0;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async render() {
    if (!this.isInitialized || !this.chart.studiesManager) {
      return;
    }

    try {
      const studyDatasets = this.chart.studiesManager.getStudyDatasets();

      if (studyDatasets.length === 0) {
        return;
      }

      await this._renderStudyDatasets(studyDatasets);

      this.lastRenderTime = Date.now();
    } catch (error) {
      // intentionally silent
    }
  }

  async _renderStudyDatasets(studyDatasets) {
    if (!this.chart.rendererInstance || !this.chart.coordinateSystem || !this.chart.scales) {
      return;
    }

    const transformedStudies = await this._transformStudyData(studyDatasets);
    const studyPaths = await this._generateStudyPaths(transformedStudies);
    await this._renderWithActiveRenderer(studyPaths);
  }

  async _transformStudyData(studyDatasets) {
    try {
      const transformedStudies = await this.chart.coordinateSystem.transformDatasets(studyDatasets, {
        strictValidation: false,
        preserveOriginal: true
      });
      return transformedStudies;
    } catch (error) {
      return [];
    }
  }

  async _generateStudyPaths(transformedStudies) {
    try {
      const studyPaths = [];

      for (const dataset of transformedStudies) {
        const paths = await PathGenerator.generatePaths([dataset], {
          curve: 'linear',
          strokeWidth: dataset.strokeWidth || 2,
          targetRenderer: this.chart.activeRenderer,
          enableFill: false
        });

        paths.forEach(path => {
          path.isStudy = true;
          path.studyId = dataset.studyId;
          path.studyType = dataset.studyType;
          path.studyName = dataset.name;
        });

        studyPaths.push(...paths);
      }

      return studyPaths;
    } catch (error) {
      return [];
    }
  }

  async _renderWithActiveRenderer(studyPaths) {
    if (studyPaths.length === 0) return;

    try {
      const renderer = this.chart.rendererInstance;

      if (this.chart.constructor.name === 'LineChart') {
        await this._renderStudyLines(renderer, studyPaths);
      } else if (this.chart.constructor.name === 'BarChart') {
        await this._renderStudyLines(renderer, studyPaths);
      }
    } catch (error) {
      // intentionally silent
    }
  }

  async _renderStudyLines(renderer, studyPaths) {
    const studyGroups = this._groupPathsByStudy(studyPaths);

    for (const [studyId, paths] of studyGroups) {
      try {
        await renderer.renderLines(paths, this.chart.scales, {
          showPoints: false,
          enableFill: false,
          chartArea: this.chart.chartArea,
          isStudyLayer: true
        });
      } catch (error) {
        // intentionally silent
      }
    }
  }

  _groupPathsByStudy(studyPaths) {
    const groups = new Map();

    for (const path of studyPaths) {
      const studyId = path.studyId;
      if (!groups.has(studyId)) {
        groups.set(studyId, []);
      }
      groups.get(studyId).push(path);
    }

    return groups;
  }

  async update() {
    if (!this.isInitialized) return;
    this.studyPaths.clear();
    await this.render();
  }

  clear() {
    this.studyPaths.clear();
  }

  isReady() {
    return this.isInitialized &&
      this.chart?.rendererInstance?.isInitialized &&
      this.chart?.coordinateSystem &&
      this.chart?.scales;
  }

  getStats() {
    const studyCount = this.chart.studiesManager?.getAllStudies().length || 0;
    const visibleStudyCount = this.chart.studiesManager?.getVisibleStudies().length || 0;

    return {
      totalStudies: studyCount,
      visibleStudies: visibleStudyCount,
      renderedPaths: this.studyPaths.size,
      lastRenderTime: this.lastRenderTime,
      isReady: this.isReady()
    };
  }

  destroy() {
    this.clear();
    this.isInitialized = false;
  }
}
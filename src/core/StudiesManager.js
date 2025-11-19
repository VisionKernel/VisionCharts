import { calculateIndicator } from '../utils/math.js';

export class StudiesManager {
  constructor(chart) {
    this.chart = chart;
    this.studies = new Map();
    this.studyCounter = 0;

    this.supportedStudies = {
      sma: {
        name: 'Simple Moving Average',
        type: 'overlay',
        defaultParams: { period: 20 },
        defaultColor: '#FF6B35',
        calculator: 'sma'
      },
      ema: {
        name: 'Exponential Moving Average',
        type: 'overlay',
        defaultParams: { period: 20 },
        defaultColor: '#4ECDC4',
        calculator: 'ema'
      },
      bollinger: {
        name: 'Bollinger Bands',
        type: 'overlay',
        defaultParams: { period: 20, multiplier: 2 },
        defaultColor: '#45B7D1',
        calculator: 'bollinger'
      }
    };
  }

  addStudy(studyType, config = {}) {
    if (!this.supportedStudies[studyType]) {
      throw new Error(`Unsupported study type: ${studyType}`);
    }

    const studyDef = this.supportedStudies[studyType];
    const studyId = `study_${studyType}_${++this.studyCounter}`;

    const study = {
      id: studyId,
      type: studyType,
      name: config.name || `${studyDef.name} (${studyDef.defaultParams.period})`,
      datasetId: config.datasetId || this._getFirstDatasetId(),
      parameters: { ...studyDef.defaultParams, ...config.parameters },
      color: config.color || studyDef.defaultColor,
      strokeWidth: config.strokeWidth || 2,
      strokeOpacity: config.strokeOpacity || 0.8,
      visible: config.visible !== false,
      calculator: studyDef.calculator,
      renderType: studyDef.type,
      data: null,
      lastCalculated: null
    };

    this.studies.set(studyId, study);
    this._calculateStudy(studyId);
    return studyId;
  }

  removeStudy(studyId) {
    if (this.studies.has(studyId)) {
      const study = this.studies.get(studyId);
      this.studies.delete(studyId);
      return true;
    }
    return false;
  }

  updateStudy(studyId, updates) {
    const study = this.studies.get(studyId);
    if (!study) {
      throw new Error(`Study not found: ${studyId}`);
    }

    if (updates.parameters) {
      Object.assign(study.parameters, updates.parameters);
    }

    ['color', 'strokeWidth', 'strokeOpacity', 'visible', 'name'].forEach(prop => {
      if (updates[prop] !== undefined) {
        study[prop] = updates[prop];
      }
    });

    if (updates.parameters) {
      this._calculateStudy(studyId);
    }
  }

  getAllStudies() {
    return Array.from(this.studies.values());
  }

  getStudiesForDataset(datasetId) {
    return this.getAllStudies().filter(study => study.datasetId === datasetId);
  }

  getVisibleStudies() {
    return this.getAllStudies().filter(study => study.visible);
  }

  calculateAllStudies() {
    for (const studyId of this.studies.keys()) {
      this._calculateStudy(studyId);
    }
  }

  _calculateStudy(studyId) {
    const study = this.studies.get(studyId);
    if (!study) return;

    try {
      const dataset = this._getDataset(study.datasetId);
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        study.data = null;
        return;
      }

      const calculatedData = calculateIndicator(study.calculator, dataset.data, {
        ...study.parameters,
        xField: 'x',
        yField: 'y'
      });

      study.data = calculatedData;
      study.lastCalculated = Date.now();
    } catch (error) {
      study.data = null;
    }
  }

  _getDataset(datasetId) {
    if (!this.chart?.config?.data) return null;
    return this.chart.config.data.find(dataset => dataset.id === datasetId);
  }

  _getFirstDatasetId() {
    if (!this.chart?.config?.data || this.chart.config.data.length === 0) {
      return null;
    }
    return this.chart.config.data[0].id;
  }

  getStudyDatasets() {
    const studyDatasets = [];

    for (const study of this.getVisibleStudies()) {
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
    const colors = {
      upper: study.color,
      middle: study.color,
      lower: study.color
    };

    const opacities = {
      upper: 0.6,
      middle: 0.8,
      lower: 0.6
    };

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

  clearAllStudies() {
    this.studies.clear();
    this.studyCounter = 0;
  }

  getSupportedStudies() {
    return { ...this.supportedStudies };
  }

  getStudyDataPointsAtX(exactDataX) {
    const studyPoints = [];
    if (!this.chart?.scales?.x) {
      return studyPoints;
    }

    const tolerance = this.chart._calculateMouseProximityTolerance();

    for (const study of this.getVisibleStudies()) {
      if (!study.data || study.data.length === 0) continue;

      const matchingPoints = [];

      for (const point of study.data) {
        const pointX = this._extractXValue(point);

        if (Math.abs(pointX - exactDataX) <= tolerance) {
          if (study.type === 'bollinger') {
            matchingPoints.push(
              {
                datasetId: `${study.id}_upper`,
                dataset: {
                  id: `${study.id}_upper`,
                  name: `${study.name} (Upper)`,
                  color: study.color,
                  isStudy: true,
                  studyType: study.type
                },
                dataX: pointX,
                dataY: point.upper,
                color: study.color,
                isStudy: true,
                studyId: study.id,
                studyType: study.type,
                studyLine: 'upper'
              },
              {
                datasetId: `${study.id}_middle`,
                dataset: {
                  id: `${study.id}_middle`,
                  name: `${study.name} (Middle)`,
                  color: study.color,
                  isStudy: true,
                  studyType: study.type
                },
                dataX: pointX,
                dataY: point.middle,
                color: study.color,
                isStudy: true,
                studyId: study.id,
                studyType: study.type,
                studyLine: 'middle'
              },
              {
                datasetId: `${study.id}_lower`,
                dataset: {
                  id: `${study.id}_lower`,
                  name: `${study.name} (Lower)`,
                  color: study.color,
                  isStudy: true,
                  studyType: study.type
                },
                dataX: pointX,
                dataY: point.lower,
                color: study.color,
                isStudy: true,
                studyId: study.id,
                studyType: study.type,
                studyLine: 'lower'
              }
            );
          } else {
            matchingPoints.push({
              datasetId: `${study.id}_line`,
              dataset: {
                id: `${study.id}_line`,
                name: study.name,
                color: study.color,
                isStudy: true,
                studyType: study.type
              },
              dataX: pointX,
              dataY: this._extractYValue(point),
              color: study.color,
              isStudy: true,
              studyId: study.id,
              studyType: study.type
            });
          }
        }
      }

      studyPoints.push(...matchingPoints);
    }

    return studyPoints;
  }

  _extractXValue(point) {
    const x = point.x || point.date || point.time || point.timestamp;

    if (x instanceof Date) {
      return x.getTime();
    }

    if (typeof x === 'string') {
      return new Date(x).getTime();
    }

    return typeof x === 'number' ? x : null;
  }

  _extractYValue(point) {
    return point.y || point.value || point.sma || point.ema || null;
  }

  getStudy(studyId) {
    return this.studies.get(studyId) || null;
  }

  getStudiesForDataset(datasetId) {
    const studies = [];

    for (const study of this.studies.values()) {
      if (study.datasetId === datasetId) {
        studies.push(study);
      }
    }

    return studies;
  }
}

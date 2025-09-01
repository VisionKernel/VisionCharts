import { calculateIndicator } from '../utils/math.js';

/**
 * StudiesManager - Centralized management of studies/indicators
 * Handles study configuration, calculation, and lifecycle management
 */
export class StudiesManager {
  constructor(chart) {
    this.chart = chart;
    this.studies = new Map(); // Map of study ID to study config
    this.studyCounter = 0;
    
    // Supported study types (Phase 1: overlay studies only)
    this.supportedStudies = {
      'sma': {
        name: 'Simple Moving Average',
        type: 'overlay',
        defaultParams: { period: 20 },
        defaultColor: '#FF6B35',
        calculator: 'sma'
      },
      'ema': {
        name: 'Exponential Moving Average', 
        type: 'overlay',
        defaultParams: { period: 20 },
        defaultColor: '#4ECDC4',
        calculator: 'ema'
      },
      'bollinger': {
        name: 'Bollinger Bands',
        type: 'overlay',
        defaultParams: { period: 20, multiplier: 2 },
        defaultColor: '#45B7D1',
        calculator: 'bollinger'
      }
    };
    
    console.log('StudiesManager initialized for overlay studies (SMA, EMA, Bollinger)');
  }

  /**
   * Add a new study to the chart
   * @param {string} studyType - Type of study ('sma', 'ema', 'bollinger')
   * @param {Object} config - Study configuration
   * @returns {string} Study ID
   */
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
      
      // Study metadata
      calculator: studyDef.calculator,
      renderType: studyDef.type,
      
      // Calculated data (will be populated by calculateStudy)
      data: null,
      lastCalculated: null
    };

    this.studies.set(studyId, study);
    
    console.log(`Added ${studyType} study:`, study);
    
    // Calculate initial data
    this._calculateStudy(studyId);
    
    return studyId;
  }

  /**
   * Remove a study
   * @param {string} studyId - Study ID to remove
   */
  removeStudy(studyId) {
    if (this.studies.has(studyId)) {
      const study = this.studies.get(studyId);
      this.studies.delete(studyId);
      console.log(`Removed study: ${study.name}`);
      return true;
    }
    return false;
  }

  /**
   * Update study parameters
   * @param {string} studyId - Study ID
   * @param {Object} updates - Parameters to update
   */
  updateStudy(studyId, updates) {
    const study = this.studies.get(studyId);
    if (!study) {
      throw new Error(`Study not found: ${studyId}`);
    }

    // Update parameters
    if (updates.parameters) {
      Object.assign(study.parameters, updates.parameters);
    }
    
    // Update visual properties
    ['color', 'strokeWidth', 'strokeOpacity', 'visible', 'name'].forEach(prop => {
      if (updates[prop] !== undefined) {
        study[prop] = updates[prop];
      }
    });

    console.log(`Updated study ${studyId}:`, updates);
    
    // Recalculate if parameters changed
    if (updates.parameters) {
      this._calculateStudy(studyId);
    }
  }

  /**
   * Get all studies
   * @returns {Array} Array of study configurations
   */
  getAllStudies() {
    return Array.from(this.studies.values());
  }

  /**
   * Get studies for a specific dataset
   * @param {string} datasetId - Dataset ID
   * @returns {Array} Array of studies for the dataset
   */
  getStudiesForDataset(datasetId) {
    return this.getAllStudies().filter(study => study.datasetId === datasetId);
  }

  /**
   * Get visible studies only
   * @returns {Array} Array of visible studies
   */
  getVisibleStudies() {
    return this.getAllStudies().filter(study => study.visible);
  }

  /**
   * Calculate all studies
   * Called when chart data changes
   */
  calculateAllStudies() {
    console.log(`Calculating ${this.studies.size} studies...`);
    
    for (const studyId of this.studies.keys()) {
      this._calculateStudy(studyId);
    }
    
    console.log('All studies calculated');
  }

  /**
   * Calculate a specific study
   * @param {string} studyId - Study ID
   * @private
   */
  _calculateStudy(studyId) {
    const study = this.studies.get(studyId);
    if (!study) return;

    try {
      // Get the source dataset
      const dataset = this._getDataset(study.datasetId);
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        console.warn(`No data available for study ${study.name}`);
        study.data = null;
        return;
      }

      // Calculate the study using existing math functions
      const calculatedData = calculateIndicator(study.calculator, dataset.data, {
        ...study.parameters,
        xField: 'x',
        yField: 'y'
      });

      // Store calculated data
      study.data = calculatedData;
      study.lastCalculated = Date.now();
      
      console.log(`Calculated ${study.name}: ${calculatedData.length} points`);
      
    } catch (error) {
      console.error(`Error calculating study ${study.name}:`, error);
      study.data = null;
    }
  }

  /**
   * Get dataset by ID from chart config
   * @param {string} datasetId - Dataset ID
   * @returns {Object|null} Dataset
   * @private
   */
  _getDataset(datasetId) {
    if (!this.chart?.config?.data) return null;
    
    return this.chart.config.data.find(dataset => dataset.id === datasetId);
  }

  /**
   * Get the first available dataset ID
   * @returns {string|null} First dataset ID
   * @private
   */
  _getFirstDatasetId() {
    if (!this.chart?.config?.data || this.chart.config.data.length === 0) {
      return null;
    }
    
    return this.chart.config.data[0].id;
  }

  /**
   * Get study data formatted for rendering
   * Returns studies as pseudo-datasets for the rendering pipeline
   * @returns {Array} Array of study datasets ready for rendering
   */
  getStudyDatasets() {
    const studyDatasets = [];
    
    for (const study of this.getVisibleStudies()) {
      if (!study.data || study.data.length === 0) continue;
      
      if (study.type === 'bollinger') {
        // Bollinger Bands: Create three lines (upper, middle, lower)
        studyDatasets.push(
          this._createBollingerDataset(study, 'upper'),
          this._createBollingerDataset(study, 'middle'), 
          this._createBollingerDataset(study, 'lower')
        );
      } else {
        // Single line studies (SMA, EMA)
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
    
    console.log(`Generated ${studyDatasets.length} study datasets for rendering`);
    return studyDatasets;
  }

  /**
   * Create a dataset for one Bollinger Band line
   * @param {Object} study - Bollinger Bands study
   * @param {string} line - Which line ('upper', 'middle', 'lower')
   * @returns {Object} Dataset for rendering
   * @private
   */
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
    
    // Map Bollinger data to y values for each line
    const lineData = study.data.map(point => ({
      x: point.x,
      y: point[line], // 'upper', 'middle', or 'lower' field
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

  /**
   * Clear all studies
   */
  clearAllStudies() {
    this.studies.clear();
    this.studyCounter = 0;
    console.log('All studies cleared');
  }

  /**
   * Get supported study types
   * @returns {Object} Supported studies configuration
   */
  getSupportedStudies() {
    return { ...this.supportedStudies };
  }
}
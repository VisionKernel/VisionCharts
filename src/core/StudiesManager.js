import { calculateIndicator } from '../utils/math.js';

/**
 * StudiesManager - Centralized management of studies/indicators
 * Handles study configuration, calculation, and lifecycle management
 */
export default class StudiesManager {
  
  /**
   * Process studies/indicators for a chart
   * @param {Object} chart - Chart instance
   */
  static processStudies(chart) {
    console.log('StudiesManager.processStudies called');
    
    const { studies } = chart.options;
    
    // Skip if no studies
    if (!studies || !studies.length) {
      console.log('No studies to process');
      return;
    }
    
    // Process each study
    studies.forEach(study => {
      // Find dataset to apply the study to
      const dataset = chart.state.datasets.find(d => d.id === study.datasetId);
      if (!dataset || !dataset.data || !dataset.data.length) {
        console.log('Dataset not found for study:', study.id);
        return;
      }
      
      console.log('Processing study:', study.type, 'for dataset:', dataset.id);
      
      try {
        // Map chart data structure to what the math functions expect
        const studyData = dataset.data.map(point => ({
          x: point[chart.options.xField] || point.x || point.date,
          y: point[chart.options.yField] || point.y || point.price || point.value,
          // Preserve original point for reference
          ...point
        }));
        
        // Use the consolidated math function with proper field mapping
        const calculatedStudy = calculateIndicator(study.type, studyData, {
          ...study.params,
          xField: 'x',
          yField: 'y'
        });
        
        // Check if we got a valid result
        if (!calculatedStudy || !calculatedStudy.length) {
          console.warn('Study calculation returned no data:', study.type);
          return;
        }
        
        // Convert back to chart's data format
        const chartStudyData = this.convertStudyDataToChartFormat(
          calculatedStudy, 
          study, 
          chart.options
        );
        
        // Add or update study dataset
        this.addStudyDataset(chart, study, chartStudyData);
        
        console.log('Study added as dataset:', study.id, 'with', chartStudyData.length, 'points');
      } catch (error) {
        console.error(`Error calculating study ${study.type}:`, error);
      }
    });
  }
  
  /**
   * Convert calculated study data back to chart format
   * @private
   * @param {Array} calculatedStudy - Raw calculated study data
   * @param {Object} study - Study configuration
   * @param {Object} options - Chart options
   * @returns {Array} Chart-formatted study data
   */
  static convertStudyDataToChartFormat(calculatedStudy, study, options) {
    return calculatedStudy.map(point => {
      const result = {
        [options.xField]: point.x || point[options.xField],
      };
      
      // Handle different study types' output formats
      if (study.type === 'bollinger') {
        // Bollinger bands return multiple values
        result[options.yField] = point.middle;
        result.upper = point.upper;
        result.lower = point.lower;
      } else if (study.type === 'macd') {
        // MACD returns multiple values
        result[options.yField] = point.macd;
        result.signal = point.signal;
        result.histogram = point.histogram;
      } else if (study.type === 'rsi') {
        // RSI returns rsi value
        result[options.yField] = point.rsi;
      } else {
        // SMA, EMA return single values
        result[options.yField] = point[options.yField] || point.y;
      }
      
      return result;
    });
  }
  
  /**
   * Add or update study dataset in chart
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} study - Study configuration
   * @param {Array} chartStudyData - Formatted study data
   */
  static addStudyDataset(chart, study, chartStudyData) {
    // Check if study dataset already exists
    const existingStudyIndex = chart.state.datasets.findIndex(d => d.id === study.id);
    
    const studyDataset = {
      id: study.id,
      name: study.name || `${study.type.toUpperCase()}(${study.params?.period || 14})`,
      color: study.color || '#888',
      width: study.width || 1,
      area: study.area || false,
      type: 'study',
      studyType: study.type,
      data: chartStudyData
    };
    
    if (existingStudyIndex >= 0) {
      // Update existing study
      chart.state.datasets[existingStudyIndex] = studyDataset;
    } else {
      // Add new study
      chart.state.datasets.push(studyDataset);
    }
  }
  
  /**
   * Add a study/indicator to a chart
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - Dataset ID to apply the study to
   * @param {Object} study - Study configuration
   * @returns {Object} Chart instance (for chaining)
   */
  static addStudy(chart, datasetId, study) {
    console.log('StudiesManager.addStudy called:', datasetId, study);
    
    // Initialize studies array if it doesn't exist
    chart.options.studies = chart.options.studies || [];
    
    // Create study configuration
    const studyConfig = {
      ...study,
      datasetId: datasetId,
      id: study.id || `study-${study.type}-${Date.now()}`
    };
    
    // Remove existing study with same ID if it exists
    chart.options.studies = chart.options.studies.filter(s => s.id !== studyConfig.id);
    
    // Add the new study
    chart.options.studies.push(studyConfig);
    
    console.log('Study added to options:', studyConfig);
    
    return chart;
  }
  
  /**
   * Remove a study/indicator from a chart
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - Dataset ID (for compatibility)
   * @param {string} studyId - Study ID to remove
   * @returns {Object} Chart instance (for chaining)
   */
  static removeStudy(chart, datasetId, studyId) {
    console.log('StudiesManager.removeStudy called:', datasetId, studyId);
    
    // Remove study from options
    if (chart.options.studies) {
      const beforeCount = chart.options.studies.length;
      chart.options.studies = chart.options.studies.filter(s => s.id !== studyId);
      const afterCount = chart.options.studies.length;
      
      console.log(`Removed ${beforeCount - afterCount} studies with ID ${studyId}`);
    }
    
    // Remove study dataset from state
    if (chart.state.datasets) {
      const beforeCount = chart.state.datasets.length;
      chart.state.datasets = chart.state.datasets.filter(d => d.id !== studyId);
      const afterCount = chart.state.datasets.length;
      
      console.log(`Removed ${beforeCount - afterCount} study datasets with ID ${studyId}`);
    }
    
    return chart;
  }
  
  /**
   * Get all studies for a specific dataset
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - Dataset ID
   * @returns {Array} Array of studies for the dataset
   */
  static getStudiesForDataset(chart, datasetId) {
    if (!chart.options.studies) return [];
    
    return chart.options.studies.filter(study => study.datasetId === datasetId);
  }
  
  /**
   * Get study configuration by ID
   * @param {Object} chart - Chart instance
   * @param {string} studyId - Study ID
   * @returns {Object|null} Study configuration or null if not found
   */
  static getStudyById(chart, studyId) {
    if (!chart.options.studies) return null;
    
    return chart.options.studies.find(study => study.id === studyId) || null;
  }
  
  /**
   * Update study configuration
   * @param {Object} chart - Chart instance
   * @param {string} studyId - Study ID
   * @param {Object} updates - Configuration updates
   * @returns {boolean} True if study was found and updated
   */
  static updateStudy(chart, studyId, updates) {
    console.log('StudiesManager.updateStudy called:', studyId, updates);
    
    if (!chart.options.studies) return false;
    
    const studyIndex = chart.options.studies.findIndex(s => s.id === studyId);
    if (studyIndex === -1) {
      console.warn('Study not found for update:', studyId);
      return false;
    }
    
    // Update study configuration
    chart.options.studies[studyIndex] = {
      ...chart.options.studies[studyIndex],
      ...updates
    };
    
    console.log('Study updated:', chart.options.studies[studyIndex]);
    return true;
  }
  
  /**
   * Clear all studies from a chart
   * @param {Object} chart - Chart instance
   * @returns {Object} Chart instance (for chaining)
   */
  static clearAllStudies(chart) {
    console.log('StudiesManager.clearAllStudies called');
    
    // Clear studies from options
    chart.options.studies = [];
    
    // Remove all study datasets from state
    if (chart.state.datasets) {
      const beforeCount = chart.state.datasets.length;
      chart.state.datasets = chart.state.datasets.filter(d => d.type !== 'study');
      const afterCount = chart.state.datasets.length;
      
      console.log(`Removed ${beforeCount - afterCount} study datasets`);
    }
    
    return chart;
  }
  
  /**
   * Get available study types
   * @returns {Array} Array of available study type strings
   */
  static getAvailableStudyTypes() {
    return [
      'sma',        // Simple Moving Average
      'ema',        // Exponential Moving Average
      'rsi',        // Relative Strength Index
      'bollinger',  // Bollinger Bands
      'macd'        // MACD
    ];
  }
  
  /**
   * Validate study configuration
   * @param {Object} study - Study configuration
   * @returns {Object} Validation result with isValid and errors
   */
  static validateStudyConfig(study) {
    const errors = [];
    const availableTypes = this.getAvailableStudyTypes();
    
    // Check required fields
    if (!study.type) {
      errors.push('Study type is required');
    } else if (!availableTypes.includes(study.type)) {
      errors.push(`Invalid study type: ${study.type}. Available types: ${availableTypes.join(', ')}`);
    }
    
    if (!study.datasetId) {
      errors.push('Dataset ID is required');
    }
    
    // Validate parameters based on study type
    if (study.type && study.params) {
      switch (study.type) {
        case 'sma':
        case 'ema':
        case 'rsi':
          if (!study.params.period || study.params.period < 1) {
            errors.push(`${study.type.toUpperCase()} requires a valid period parameter (>= 1)`);
          }
          break;
        case 'bollinger':
          if (!study.params.period || study.params.period < 1) {
            errors.push('Bollinger Bands requires a valid period parameter (>= 1)');
          }
          if (!study.params.standardDeviations || study.params.standardDeviations <= 0) {
            errors.push('Bollinger Bands requires a valid standardDeviations parameter (> 0)');
          }
          break;
        case 'macd':
          if (!study.params.fastPeriod || study.params.fastPeriod < 1) {
            errors.push('MACD requires a valid fastPeriod parameter (>= 1)');
          }
          if (!study.params.slowPeriod || study.params.slowPeriod < 1) {
            errors.push('MACD requires a valid slowPeriod parameter (>= 1)');
          }
          if (!study.params.signalPeriod || study.params.signalPeriod < 1) {
            errors.push('MACD requires a valid signalPeriod parameter (>= 1)');
          }
          if (study.params.fastPeriod >= study.params.slowPeriod) {
            errors.push('MACD fastPeriod must be less than slowPeriod');
          }
          break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  /**
   * Get default parameters for a study type
   * @param {string} studyType - Study type
   * @returns {Object} Default parameters for the study type
   */
  static getDefaultStudyParams(studyType) {
    const defaults = {
      sma: { period: 20 },
      ema: { period: 20 },
      rsi: { period: 14 },
      bollinger: { period: 20, standardDeviations: 2 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
    };
    
    return defaults[studyType] || {};
  }
  
  /**
   * Create a study configuration with defaults
   * @param {string} studyType - Study type
   * @param {string} datasetId - Dataset ID to apply to
   * @param {Object} customParams - Custom parameters (optional)
   * @param {Object} customOptions - Custom options (optional)
   * @returns {Object} Complete study configuration
   */
  static createStudyConfig(studyType, datasetId, customParams = {}, customOptions = {}) {
    const defaultParams = this.getDefaultStudyParams(studyType);
    
    return {
      id: `study-${studyType}-${Date.now()}`,
      type: studyType,
      name: customOptions.name || `${studyType.toUpperCase()}(${customParams.period || defaultParams.period || 14})`,
      datasetId: datasetId,
      params: { ...defaultParams, ...customParams },
      color: customOptions.color || '#888',
      width: customOptions.width || 1,
      area: customOptions.area || false,
      ...customOptions
    };
  }
}
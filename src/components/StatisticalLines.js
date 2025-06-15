import { AverageLine } from './AverageLine.js';
import { MedianLine } from './MedianLine.js';

/**
 * StatisticalLines - Centralized management of statistical lines (average, median, etc.)
 * Handles rendering, updating, and configuration of statistical overlays
 */
export default class StatisticalLines {
  
  /**
   * Render statistical lines for a chart
   * @param {Object} chart - Chart instance
   */
  static renderForChart(chart) {
    console.log('StatisticalLines.renderForChart called');
    
    // Only render in single mode (not panel mode)
    if (chart.options.isPanelView) {
      console.log('Panel mode detected, skipping statistical lines');
      return;
    }
    
    // Ensure we have valid scales and chart
    if (!chart.state.scales.y || !chart.state.chart) {
      console.warn('Scales or chart not ready for statistical lines');
      return;
    }
    
    // Render average line if enabled
    if (chart.options.showAverageLine) {
      this.renderAverageLine(chart);
    }
    
    // Render median line if enabled
    if (chart.options.showMedianLine) {
      this.renderMedianLine(chart);
    }
  }
  
  /**
   * Update statistical lines when data changes
   * @param {Object} chart - Chart instance
   */
  static updateForChart(chart) {
    console.log('StatisticalLines.updateForChart called');
    
    // Only update in single mode
    if (chart.options.isPanelView) {
      return;
    }
    
    if (chart.options.showAverageLine && chart.averageLine) {
      const data = this.getDataForStatistics(chart);
      const valueField = this.getValueField(chart);
      chart.averageLine.update(chart, data, valueField);
    }
    
    if (chart.options.showMedianLine && chart.medianLine) {
      const data = this.getDataForStatistics(chart);
      const valueField = this.getValueField(chart);
      chart.medianLine.update(chart, data, valueField);
    }
  }
  
  /**
   * Render average line
   * @private
   * @param {Object} chart - Chart instance
   */
  static renderAverageLine(chart) {
    if (!chart.averageLine) {
      chart.averageLine = new AverageLine(chart.options.averageLineConfig || {});
    }
    
    const data = this.getDataForStatistics(chart);
    const valueField = this.getValueField(chart);
    
    console.log('Rendering average line with data:', data.length, 'points');
    chart.averageLine.render(chart, data, valueField);
  }
  
  /**
   * Render median line
   * @private
   * @param {Object} chart - Chart instance
   */
  static renderMedianLine(chart) {
    if (!chart.medianLine) {
      chart.medianLine = new MedianLine(chart.options.medianLineConfig || {});
    }
    
    const data = this.getDataForStatistics(chart);
    const valueField = this.getValueField(chart);
    
    console.log('Rendering median line with data:', data.length, 'points');
    chart.medianLine.render(chart, data, valueField);
  }
  
  /**
   * Toggle average line visibility
   * @param {Object} chart - Chart instance
   * @param {boolean} show - Whether to show the average line (null to toggle)
   * @param {string} datasetId - Optional: specific dataset to calculate average from
   * @returns {Object} Chart instance (for chaining)
   */
  static toggleAverageLine(chart, show = null, datasetId = null) {
    console.log('StatisticalLines.toggleAverageLine called:', show, datasetId);
    
    if (show === null) {
      show = !chart.options.showAverageLine;
    }
    
    chart.options.showAverageLine = show;
    
    if (show) {
      // Create instance if it doesn't exist
      if (!chart.averageLine) {
        chart.averageLine = new AverageLine(chart.options.averageLineConfig || {});
      }
      
      // Get data for calculation
      const data = this.getDataForStatistics(chart, datasetId);
      const valueField = this.getValueField(chart);
      
      console.log('Rendering average line with:', {
        dataLength: data.length,
        valueField: valueField,
        hasScales: Boolean(chart.state.scales.y),
        hasChart: Boolean(chart.state.chart)
      });
      
      if (data && data.length > 0 && chart.state.rendered) {
        chart.averageLine.render(chart, data, valueField);
      }
    } else if (chart.averageLine) {
      console.log('Removing average line');
      chart.averageLine.remove();
    }
    
    return chart;
  }
  
  /**
   * Toggle median line visibility
   * @param {Object} chart - Chart instance
   * @param {boolean} show - Whether to show the median line (null to toggle)
   * @param {string} datasetId - Optional: specific dataset to calculate median from
   * @returns {Object} Chart instance (for chaining)
   */
  static toggleMedianLine(chart, show = null, datasetId = null) {
    console.log('StatisticalLines.toggleMedianLine called:', show, datasetId);
    
    if (show === null) {
      show = !chart.options.showMedianLine;
    }
    
    chart.options.showMedianLine = show;
    
    if (show) {
      // Create instance if it doesn't exist
      if (!chart.medianLine) {
        chart.medianLine = new MedianLine(chart.options.medianLineConfig || {});
      }
      
      // Get data for calculation
      const data = this.getDataForStatistics(chart, datasetId);
      const valueField = this.getValueField(chart);
      
      console.log('Rendering median line with:', {
        dataLength: data.length,
        valueField: valueField,
        hasScales: Boolean(chart.state.scales.y),
        hasChart: Boolean(chart.state.chart)
      });
      
      if (data && data.length > 0 && chart.state.rendered) {
        chart.medianLine.render(chart, data, valueField);
      }
    } else if (chart.medianLine) {
      console.log('Removing median line');
      chart.medianLine.remove();
    }
    
    return chart;
  }
  
  /**
   * Configure average line appearance
   * @param {Object} chart - Chart instance
   * @param {Object} config - Configuration object
   * @returns {Object} Chart instance (for chaining)
   */
  static configureAverageLine(chart, config) {
    chart.options.averageLineConfig = { ...chart.options.averageLineConfig, ...config };
    
    if (chart.averageLine) {
      chart.averageLine.updateConfig(config);
      
      if (chart.options.showAverageLine) {
        const data = this.getDataForStatistics(chart);
        const valueField = this.getValueField(chart);
        chart.averageLine.update(chart, data, valueField);
      }
    }
    
    return chart;
  }
  
  /**
   * Configure median line appearance
   * @param {Object} chart - Chart instance
   * @param {Object} config - Configuration object
   * @returns {Object} Chart instance (for chaining)
   */
  static configureMedianLine(chart, config) {
    chart.options.medianLineConfig = { ...chart.options.medianLineConfig, ...config };
    
    if (chart.medianLine) {
      chart.medianLine.updateConfig(config);
      
      if (chart.options.showMedianLine) {
        const data = this.getDataForStatistics(chart);
        const valueField = this.getValueField(chart);
        chart.medianLine.update(chart, data, valueField);
      }
    }
    
    return chart;
  }
  
  /**
   * Get data for statistical calculations
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - Optional: specific dataset ID
   * @returns {Array} - Data array for calculations
   */
  static getDataForStatistics(chart, datasetId = null) {
    console.log('StatisticalLines.getDataForStatistics called with datasetId:', datasetId);
    
    // Check if we have data in the config format
    if (chart.config.data && chart.config.data.length > 0) {
      if (datasetId) {
        // Find specific dataset
        const dataset = chart.config.data.find(d => d.id === datasetId);
        console.log('Found specific dataset:', Boolean(dataset));
        return dataset ? dataset.data : [];
      } else {
        // Use first dataset by default
        const firstDataset = chart.config.data[0];
        console.log('Using first dataset, data length:', firstDataset.data?.length || 0);
        return firstDataset.data || [];
      }
    }
    
    // Fallback to state.datasets if config.data is not available
    if (chart.state.datasets && chart.state.datasets.length > 0) {
      if (datasetId) {
        const dataset = chart.state.datasets.find(d => d.id === datasetId);
        console.log('Found dataset in state:', Boolean(dataset));
        return dataset ? dataset.data : [];
      } else {
        const firstDataset = chart.state.datasets[0];
        console.log('Using first state dataset, data length:', firstDataset.data?.length || 0);
        return firstDataset.data || [];
      }
    }
    
    console.warn('No data found for statistics');
    return [];
  }
  
  /**
   * Get the appropriate value field name for the chart type
   * @param {Object} chart - Chart instance
   * @returns {string} - Field name for values
   */
  static getValueField(chart) {
    // First check if explicitly set in options
    if (chart.options.yField) {
      console.log('Using yField from options:', chart.options.yField);
      return chart.options.yField;
    }
    
    // Try to detect field name from data
    const data = this.getDataForStatistics(chart);
    if (data && data.length > 0) {
      const samplePoint = data[0];
      
      // Common field names in order of preference
      const possibleFields = ['price', 'value', 'y', 'amount', 'count'];
      
      for (const field of possibleFields) {
        if (samplePoint.hasOwnProperty(field) && typeof samplePoint[field] === 'number') {
          console.log('Detected value field:', field);
          return field;
        }
      }
      
      console.log('Sample data point keys:', Object.keys(samplePoint));
    }
    
    // Default fallback
    console.log('Using default value field: y');
    return 'y';
  }
  
  /**
   * Get statistical information about the current dataset
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - Optional: specific dataset ID
   * @returns {Object} - Statistical information
   */
  static getStatisticalInfo(chart, datasetId = null) {
    const data = this.getDataForStatistics(chart, datasetId);
    const valueField = this.getValueField(chart);
    
    if (!data || data.length === 0) {
      return {
        average: null,
        median: null,
        count: 0,
        min: null,
        max: null
      };
    }
    
    // Calculate statistics
    const tempAverageLine = new AverageLine();
    const tempMedianLine = new MedianLine();
    
    const average = tempAverageLine.calculateAverage(data, valueField);
    const median = tempMedianLine.calculateMedian(data, valueField);
    const medianStats = tempMedianLine.getStatistics(data, valueField);
    
    return {
      average: average,
      median: median,
      count: medianStats.count,
      min: medianStats.min,
      max: medianStats.max,
      quartiles: medianStats.quartiles
    };
  }
  
  /**
   * Remove all statistical lines from chart
   * @param {Object} chart - Chart instance
   */
  static removeAllLines(chart) {
    console.log('StatisticalLines.removeAllLines called');
    
    if (chart.averageLine) {
      chart.averageLine.remove();
      chart.averageLine = null;
    }
    
    if (chart.medianLine) {
      chart.medianLine.remove();
      chart.medianLine = null;
    }
    
    // Update options
    chart.options.showAverageLine = false;
    chart.options.showMedianLine = false;
  }
  
  /**
   * Check if any statistical lines are currently visible
   * @param {Object} chart - Chart instance
   * @returns {boolean} True if any statistical lines are visible
   */
  static hasVisibleLines(chart) {
    return chart.options.showAverageLine || chart.options.showMedianLine;
  }
  
  /**
   * Get configuration for all statistical lines
   * @param {Object} chart - Chart instance
   * @returns {Object} Configuration object with all statistical line settings
   */
  static getConfiguration(chart) {
    return {
      averageLine: {
        enabled: chart.options.showAverageLine || false,
        config: chart.options.averageLineConfig || {}
      },
      medianLine: {
        enabled: chart.options.showMedianLine || false,
        config: chart.options.medianLineConfig || {}
      }
    };
  }
  
  /**
   * Apply configuration to all statistical lines
   * @param {Object} chart - Chart instance
   * @param {Object} configuration - Configuration object
   * @returns {Object} Chart instance (for chaining)
   */
  static applyConfiguration(chart, configuration) {
    console.log('StatisticalLines.applyConfiguration called');
    
    if (configuration.averageLine) {
      chart.options.showAverageLine = configuration.averageLine.enabled;
      chart.options.averageLineConfig = configuration.averageLine.config || {};
    }
    
    if (configuration.medianLine) {
      chart.options.showMedianLine = configuration.medianLine.enabled;
      chart.options.medianLineConfig = configuration.medianLine.config || {};
    }
    
    return chart;
  }
  
  /**
   * Cleanup statistical lines when chart is destroyed
   * @param {Object} chart - Chart instance
   */
  static cleanup(chart) {
    console.log('StatisticalLines.cleanup called');
    
    if (chart.averageLine) {
      chart.averageLine.remove();
      chart.averageLine = null;
    }
    
    if (chart.medianLine) {
      chart.medianLine.remove();
      chart.medianLine = null;
    }
  }
}
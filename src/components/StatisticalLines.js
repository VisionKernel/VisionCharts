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
      console.log('Panel mode detected, statistical lines handled per panel');
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

    if (chart.options.isPanelView) {
      console.log('Panel mode detected, re-rendering average line for panel');
      if (chart.state.rendered) {
        return chart.update();
      }
    
    } else {
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
  
  /**
   * Render statistical lines for a specific panel
   * @param {SVGElement} panelGroup - Panel container
   * @param {Object} dataset - Dataset for this panel
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelWidth - Panel width
   * @param {number} panelHeight - Panel height
   * @param {Object} options - Chart options
   */
  static renderForPanel(panelGroup, dataset, xScale, yScale, panelWidth, panelHeight, options) {
    console.log('StatisticalLines.renderForPanel called for dataset:', dataset.id);
    
    // Render average line for this panel if enabled
    if (options.showAverageLine) {
      StatisticalLines.renderAverageLineForPanel(
        panelGroup, 
        dataset, 
        xScale, 
        yScale, 
        panelWidth, 
        panelHeight,
        options
      );
    }
    
    // Render median line for this panel if enabled  
    if (options.showMedianLine) {
      StatisticalLines.renderMedianLineForPanel(
        panelGroup, 
        dataset, 
        xScale, 
        yScale, 
        panelWidth, 
        panelHeight,
        options
      );
    }
  }

  /**
   * Render average line for a specific panel
   * @private
   */
  static renderAverageLineForPanel(panelGroup, dataset, xScale, yScale, panelWidth, panelHeight, options) {
    console.log('Rendering average line for panel, dataset:', dataset.id);
    
    if (!dataset.data || dataset.data.length === 0) {
      console.log('No data for average line calculation');
      return;
    }
    
    // Calculate average from this panel's dataset only
    const valueField = StatisticalLines.getValueField({ options });
    const validValues = dataset.data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(value => value !== null);
    
    if (validValues.length === 0) {
      console.log('No valid values for average calculation');
      return;
    }
    
    const averageValue = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
    const averageY = yScale.scale(averageValue);
    
    console.log('Panel average calculated:', averageValue, 'at Y position:', averageY);
    
    // Create average line element
    const averageLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    averageLine.setAttribute('x1', 0);
    averageLine.setAttribute('y1', averageY);
    averageLine.setAttribute('x2', panelWidth);
    averageLine.setAttribute('y2', averageY);
    averageLine.setAttribute('stroke', options.averageLineConfig?.color || '#FF6B35');
    averageLine.setAttribute('stroke-width', options.averageLineConfig?.width || 2);
    averageLine.setAttribute('stroke-opacity', options.averageLineConfig?.opacity || 0.8);
    averageLine.setAttribute('stroke-dasharray', options.averageLineConfig?.strokeDasharray || '5,5');
    averageLine.setAttribute('class', 'visioncharts-panel-average-line');
    
    panelGroup.appendChild(averageLine);
    
    // Add label if enabled
    if (options.averageLineConfig?.showLabel !== false) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = `Average: ${averageValue.toLocaleString()}`;
      label.setAttribute('x', panelWidth - 10);
      label.setAttribute('y', averageY - 5);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12px');
      label.setAttribute('font-family', 'Arial, sans-serif');
      label.setAttribute('fill', options.averageLineConfig?.color || '#FF6B35');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('class', 'visioncharts-panel-average-label');
      
      panelGroup.appendChild(label);
    }
  }

  /**
   * Render median line for a specific panel
   * @private  
   */
  static renderMedianLineForPanel(panelGroup, dataset, xScale, yScale, panelWidth, panelHeight, options) {
    console.log('Rendering median line for panel, dataset:', dataset.id);
    
    if (!dataset.data || dataset.data.length === 0) {
      return;
    }
    
    // Calculate median from this panel's dataset only
    const valueField = StatisticalLines.getValueField({ options });
    const validValues = dataset.data
      .map(d => {
        const value = typeof d === 'object' ? d[valueField] : d;
        return typeof value === 'number' && !isNaN(value) ? value : null;
      })
      .filter(value => value !== null)
      .sort((a, b) => a - b);
    
    if (validValues.length === 0) {
      return;
    }
    
    const middleIndex = Math.floor(validValues.length / 2);
    const medianValue = validValues.length % 2 === 0
      ? (validValues[middleIndex - 1] + validValues[middleIndex]) / 2
      : validValues[middleIndex];
      
    const medianY = yScale.scale(medianValue);
    
    // Create median line element
    const medianLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    medianLine.setAttribute('x1', 0);
    medianLine.setAttribute('y1', medianY);
    medianLine.setAttribute('x2', panelWidth);
    medianLine.setAttribute('y2', medianY);
    medianLine.setAttribute('stroke', options.medianLineConfig?.color || '#9C27B0');
    medianLine.setAttribute('stroke-width', options.medianLineConfig?.width || 2);
    medianLine.setAttribute('stroke-opacity', options.medianLineConfig?.opacity || 0.8);
    medianLine.setAttribute('stroke-dasharray', options.medianLineConfig?.strokeDasharray || '3,3');
    medianLine.setAttribute('class', 'visioncharts-panel-median-line');
    
    panelGroup.appendChild(medianLine);
    
    // Add label if enabled
    if (options.medianLineConfig?.showLabel !== false) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.textContent = `Median: ${medianValue.toLocaleString()}`;
      label.setAttribute('x', panelWidth - 10);
      label.setAttribute('y', medianY + 15);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12px');
      label.setAttribute('font-family', 'Arial, sans-serif');
      label.setAttribute('fill', options.medianLineConfig?.color || '#9C27B0');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('class', 'visioncharts-panel-median-label');
      
      panelGroup.appendChild(label);
    }
  }
}
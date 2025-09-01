/**
 * StatisticalLines - Centralized management of statistical lines (average, median, etc.)
 * Handles rendering, updating, and configuration of statistical overlays
 */

import { AverageLine } from './AverageLine.js';
import { MedianLine } from './MedianLine.js';

export class StatisticalLines {
  constructor(config = {}) {
    this.config = {
      // Default configurations for both lines
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
      
      // Coordination options
      autoPositionLabels: true,    // Automatically position labels to avoid overlap
      hideWhenOutOfRange: true,    // Hide lines when values are outside visible range
      
      ...config
    };
    
    // Create individual line components
    this.averageLine = new AverageLine(this.config.averageConfig);
    this.medianLine = new MedianLine(this.config.medianConfig);
    
    // Chart integration
    this.chartArea = null;
    this.scales = null;
    this.datasets = [];
    
    // State
    this.isRendered = false;
    
    console.log('StatisticalLines manager created');
  }
  
  /**
   * Update datasets for both statistical lines
   * @param {Array} datasets - Array of chart datasets
   */
  updateDatasets(datasets) {
    this.datasets = datasets || [];
    
    // Update both lines
    this.averageLine.updateDatasets(this.datasets);
    this.medianLine.updateDatasets(this.datasets);
    
    // Handle label positioning if auto-positioning is enabled
    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }
  
  /**
   * Render both statistical lines
   * @param {HTMLElement} container - Container to add SVG to
   * @param {Object} chartArea - Chart area dimensions
   * @param {Object} scales - Chart scales for coordinate conversion
   */
  render(container, chartArea, scales) {
    if (!container || !chartArea || !scales) {
      console.warn('StatisticalLines: Container, chart area, and scales required');
      return;
    }
    
    this.chartArea = chartArea;
    this.scales = scales;
    
    // Render both line components
    this.averageLine.render(container, chartArea, scales);
    this.medianLine.render(container, chartArea, scales);
    
    this.isRendered = true;
    
    // Handle label positioning if auto-positioning is enabled
    if (this.config.autoPositionLabels) {
      this._adjustLabelPositions();
    }
    
    console.log('StatisticalLines rendered (average and median)');
  }
  
  /**
   * Toggle average line visibility
   * @param {boolean} show - Force show/hide state, or null to toggle
   * @returns {boolean} New visibility state
   */
  toggleAverage(show = null) {
    const result = this.averageLine.toggle(show);
    
    // Adjust label positions if auto-positioning is enabled
    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
    
    return result;
  }
  
  /**
   * Toggle median line visibility
   * @param {boolean} show - Force show/hide state, or null to toggle
   * @returns {boolean} New visibility state
   */
  toggleMedian(show = null) {
    const result = this.medianLine.toggle(show);
    
    // Adjust label positions if auto-positioning is enabled
    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
    
    return result;
  }
  
  /**
   * Show average line
   */
  showAverage() {
    return this.toggleAverage(true);
  }
  
  /**
   * Hide average line
   */
  hideAverage() {
    return this.toggleAverage(false);
  }
  
  /**
   * Show median line
   */
  showMedian() {
    return this.toggleMedian(true);
  }
  
  /**
   * Hide median line
   */
  hideMedian() {
    return this.toggleMedian(false);
  }
  
  /**
   * Update with new scales (when chart updates)
   * @param {Object} newScales - Updated chart scales
   */
  updateScales(newScales) {
    this.scales = newScales;
    
    this.averageLine.updateScales(newScales);
    this.medianLine.updateScales(newScales);
    
    // Adjust label positions after scale update
    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }
  
  /**
   * Update chart area (when chart resizes)
   * @param {Object} newChartArea - Updated chart area
   */
  updateChartArea(newChartArea) {
    this.chartArea = newChartArea;
    
    this.averageLine.updateChartArea(newChartArea);
    this.medianLine.updateChartArea(newChartArea);
  }
  
  /**
   * Update configuration for both lines
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    // Update individual line configurations
    if (newConfig.averageConfig) {
      this.averageLine.updateConfig(newConfig.averageConfig);
    }
    
    if (newConfig.medianConfig) {
      this.medianLine.updateConfig(newConfig.medianConfig);
    }
    
    // Adjust label positions if auto-positioning settings changed
    if (this.config.autoPositionLabels && this.isRendered) {
      this._adjustLabelPositions();
    }
  }
  
  /**
   * Get current values for both statistical measures
   * @returns {Object} Current average and median values
   */
  getStatisticalValues() {
    return {
      average: this.averageLine.getAverageValue(),
      median: this.medianLine.getMedianValue(),
      averageInRange: this.averageLine.getState().averageInRange,
      medianInRange: this.medianLine.getState().medianInRange
    };
  }
  
  /**
   * Get current state of both statistical lines
   * @returns {Object} State information for both lines
   */
  getState() {
    return {
      isRendered: this.isRendered,
      datasetCount: this.datasets.length,
      average: this.averageLine.getState(),
      median: this.medianLine.getState(),
      config: this.config
    };
  }
  
  /**
   * Automatically adjust label positions to avoid overlap
   * @private
   */
  _adjustLabelPositions() {
    const averageState = this.averageLine.getState();
    const medianState = this.medianLine.getState();
    
    // Only adjust if both lines are visible and have values
    if (!averageState.isVisible || !medianState.isVisible || 
        averageState.currentAverage == null || medianState.currentMedian == null) {
      return;
    }
    
    // Check if values are close to each other (potential overlap)
    const averageValue = averageState.currentAverage;
    const medianValue = medianState.currentMedian;
    const valueDifference = Math.abs(averageValue - medianValue);
    
    // Convert to pixel difference to check for visual overlap
    const averageY = this.scales.y.scale(averageValue);
    const medianY = this.scales.y.scale(medianValue);
    const pixelDifference = Math.abs(averageY - medianY);
    
    // If labels would overlap (less than 20 pixels apart), adjust positioning
    const minLabelSpacing = 20;
    
    if (pixelDifference < minLabelSpacing) {
      console.log('StatisticalLines: Adjusting label positions to avoid overlap');
      
      // Position one label on left, one on right
      if (averageValue > medianValue) {
        // Average is higher, put median on left
        this.averageLine.updateConfig({ labelPosition: 'right' });
        this.medianLine.updateConfig({ labelPosition: 'left' });
      } else {
        // Median is higher, put average on left
        this.averageLine.updateConfig({ labelPosition: 'left' });
        this.medianLine.updateConfig({ labelPosition: 'right' });
      }
    } else {
      // No overlap, both can be on the same side (default right)
      this.averageLine.updateConfig({ labelPosition: 'right' });
      this.medianLine.updateConfig({ labelPosition: 'right' });
    }
  }
  
  /**
   * Get individual line components for direct access
   * @returns {Object} References to average and median line components
   */
  getComponents() {
    return {
      averageLine: this.averageLine,
      medianLine: this.medianLine
    };
  }
  
  /**
   * Set data scope for both lines
   * @param {boolean} useAllDatasets - Whether to calculate across all datasets
   */
  setDataScope(useAllDatasets) {
    this.averageLine.updateConfig({ useAllDatasets });
    this.medianLine.updateConfig({ useAllDatasets });
    
    // Recalculate with new scope
    this.averageLine.updateDatasets(this.datasets);
    this.medianLine.updateDatasets(this.datasets);
  }
  
  /**
   * Enable/disable automatic label positioning
   * @param {boolean} enabled - Whether to enable auto-positioning
   */
  setAutoPositionLabels(enabled) {
    this.config.autoPositionLabels = enabled;
    
    if (enabled && this.isRendered) {
      this._adjustLabelPositions();
    }
  }
  
  /**
   * Destroy both statistical lines and clean up resources
   */
  destroy() {
    this.averageLine.destroy();
    this.medianLine.destroy();
    
    this.chartArea = null;
    this.scales = null;
    this.datasets = [];
    this.isRendered = false;
    
    console.log('StatisticalLines destroyed');
  }
}
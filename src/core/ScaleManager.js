import { LinearScale, TimeScale, createNiceDomain, createTimeTickValues } from './Scale.js';

/**
 * ScaleManager handles all scale creation and management across chart types
 * Centralizes scale logic to reduce duplication and provide consistent behavior
 */
export default class ScaleManager {
  /**
   * Create scales for a chart
   * @param {Chart} chart - Chart instance
   * @returns {Object} Created scales {x, y}
   */
  static createScales(chart) {
    console.log('ScaleManager.createScales called for', chart.options.chartType);

    const { xType } = chart.options;

    // Create X scale based on type
    let xScale;
    if (xType === 'time') {
      xScale = new TimeScale([0, 1], [0, 1]);
    } else {
      xScale = new LinearScale([0, 1], [0, 1]);
    }

    // Always create LinearScale for Y (data is pre-transformed)
    const yScale = new LinearScale([0, 1], [0, 1]);

    const scales = { x: xScale, y: yScale };

    // Update scales with actual data
    ScaleManager.updateScales(chart, scales);

    return scales;
  }

  /**
   * Update scales with chart data
   * @param {Chart} chart - Chart instance
   * @param {Object} scales - Scales to update {x, y}
   */
  static updateScales(chart, scales) {
    console.log('ScaleManager.updateScales called for', chart.options.chartType);

    const { xField, yField, chartType } = chart.options;

    // Get all data points from all datasets
    const allPoints = chart.state.datasets.reduce((acc, dataset) => {
      return acc.concat(dataset.data || []);
    }, []);

    if (!allPoints.length) {
      // Set default domains (no isLogarithmic check)
      scales.x.setDomain([0, 1]);
      scales.y.setDomain([0, 1]);

      // Set ranges based on dimensions
      scales.x.setRange([0, chart.state.dimensions.innerWidth]);
      scales.y.setRange([chart.state.dimensions.innerHeight, 0]);
      console.log('No data points, using default domains');
      return;
    }

    // Calculate domains based on chart type
    const domains = ScaleManager.calculateDomains(chart, allPoints);

    // Set domains
    scales.x.setDomain(domains.x);
    scales.y.setDomain(domains.y);

    // Set ranges based on dimensions
    scales.x.setRange([0, chart.state.dimensions.innerWidth]);
    scales.y.setRange([chart.state.dimensions.innerHeight, 0]);

    console.log('Scales updated with domains:', 'x:', domains.x, 'y:', domains.y);
  }

  /**
   * Calculate appropriate domains for chart data
   * @param {Chart} chart - Chart instance
   * @param {Array} allPoints - All data points
   * @returns {Object} Calculated domains {x, y}
   */
  static calculateDomains(chart, allPoints) {
    const { xField, yField, xType, chartType } = chart.options;

    // Extract values
    const xValues = allPoints.map(d => d[xField]);
    const yValues = allPoints.map(d => d[yField]);

    // Calculate X domain
    const xDomain = ScaleManager.calculateXDomain(chart, xValues);

    // Calculate Y domain based on chart type
    const yDomain = ScaleManager.calculateYDomain(chart, allPoints);

    return { x: xDomain, y: yDomain };
  }

  /**
   * Calculate X domain
   * @param {Chart} chart - Chart instance
   * @param {Array} xValues - X values
   * @returns {Array} X domain [min, max]
   */
  static calculateXDomain(chart, xValues) {
    const { xType, chartType } = chart.options;

    if (xType === 'time') {
      // For time type, convert to Date objects if needed
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      const xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      const xMax = new Date(Math.max(...dates.map(d => d.getTime())));
      return [xMin, xMax];
    } else if (xType === 'number') {
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      return [xMin, xMax];
    } else if (xType === 'category') {
      // For category type, create indexed domain
      const uniqueXValues = Array.from(new Set(xValues));

      // Sort categories if possible (by timestamp or naturally)
      const sortedCategories = ScaleManager.sortCategories(chart, uniqueXValues);

      // Create domain for category spacing
      return [-0.5, sortedCategories.length - 0.5];
    }

    return [0, 1];
  }

  /**
   * Calculate Y domain based on chart type
   * @param {Chart} chart - Chart instance
   * @param {Array} allPoints - All data points
   * @returns {Array} Y domain [min, max]
   */
  static calculateYDomain(chart, allPoints) {
    const { yField, chartType } = chart.options;

    if (chartType === 'bar') {
      // Bar charts: handle stacking and start from 0
      return ScaleManager.calculateBarYDomain(chart, allPoints);
    } else {
      // Line charts: use padding around data range
      return ScaleManager.calculateLineYDomain(chart, allPoints);
    }
  }

  /**
   * Calculate Y domain for bar charts - SIMPLIFIED VERSION
   * @param {Chart} chart - Chart instance
   * @param {Array} allPoints - All data points
   * @returns {Array} Y domain [min, max]
   */
  static calculateBarYDomain(chart, allPoints) {
    const { xField, yField, stacked } = chart.options;

    if (stacked && chart.state.datasets.length > 1) {
      // For stacked bars with mixed positive/negative values
      const uniqueXValues = Array.from(new Set(allPoints.map(d => d[xField])));
      const stackedValues = { positive: [], negative: [] };

      uniqueXValues.forEach(xValue => {
        let positiveSum = 0;
        let negativeSum = 0;

        chart.state.datasets.forEach(dataset => {
          const matchingPoint = dataset.data.find(d => d[xField] === xValue);
          if (matchingPoint) {
            const value = matchingPoint[yField] || 0;
            if (value > 0) {
              positiveSum += value;
            } else if (value < 0) {
              negativeSum += value;
            }
          }
        });

        if (positiveSum > 0) stackedValues.positive.push(positiveSum);
        if (negativeSum < 0) stackedValues.negative.push(negativeSum);
      });

      // Calculate domain bounds
      const maxPositive = stackedValues.positive.length > 0 ? Math.max(...stackedValues.positive) : 0;
      const minNegative = stackedValues.negative.length > 0 ? Math.min(...stackedValues.negative) : 0;

      // Add padding
      const positivePadding = maxPositive * 0.1;
      const negativePadding = Math.abs(minNegative) * 0.1;

      // SIMPLIFIED: No isLogarithmic check (data is pre-transformed)
      return [minNegative - negativePadding, maxPositive + positivePadding];

    } else {
      // Non-stacked bars
      const yValues = allPoints.map(d => d[yField]);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);

      // SIMPLIFIED: No isLogarithmic check (data is pre-transformed)
      // Handle both positive and negative values
      const range = yMax - yMin;
      const padding = Math.max(range * 0.1, Math.abs(yMax) * 0.05, Math.abs(yMin) * 0.05);

      // Ensure zero is included for better bar chart appearance
      const domainMin = yMin < 0 ? yMin - padding : Math.min(0, yMin);
      const domainMax = yMax > 0 ? yMax + padding : Math.max(0, yMax);

      return [domainMin, domainMax];
    }
  }

  /**
   * Calculate Y domain for line charts - SIMPLIFIED VERSION
   * @param {Chart} chart - Chart instance
   * @param {Array} allPoints - All data points
   * @returns {Array} Y domain [min, max]
   */
  static calculateLineYDomain(chart, allPoints) {
    const { yField } = chart.options;

    const yValues = allPoints.map(d => d[yField]);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Add padding to Y domain
    const yPadding = (yMax - yMin) * 0.1;

    // SIMPLIFIED: No isLogarithmic check (data is pre-transformed)
    return [yMin - yPadding, yMax + yPadding];
  }

  /**
   * Sort categories appropriately
   * @param {Chart} chart - Chart instance
   * @param {Array} categories - Category values
   * @returns {Array} Sorted categories
   */
  static sortCategories(chart, categories) {
    const { xField } = chart.options;

    // Try to sort by timestamp if available
    const firstDataset = chart.state.datasets[0];
    if (firstDataset && firstDataset.data.length > 0 && firstDataset.data[0].x) {
      // Create a map of category to timestamp
      const categoryMap = new Map();
      firstDataset.data.forEach(d => {
        if (d.x && d[xField]) {
          categoryMap.set(d[xField], d.x);
        }
      });

      // Sort by timestamp if available
      if (categoryMap.size > 0) {
        return categories.sort((a, b) => {
          const timeA = categoryMap.get(a) || 0;
          const timeB = categoryMap.get(b) || 0;
          return timeA - timeB;
        });
      }
    }

    // Default string sorting
    return categories.sort();
  }

  /**
   * Create scales for panel mode - SIMPLIFIED VERSION
   * @param {Object} dataset - Dataset for this panel
   * @param {Object} chartOptions - Chart options
   * @param {Object} dimensions - Panel dimensions
   * @returns {Object} Created scales {xScale, yScale}
   */
  static createPanelScales(dataset, chartOptions, dimensions) {
    console.log('ScaleManager.createPanelScales called');

    const { xField, yField, xType, chartType } = chartOptions;
    const { innerWidth, effectivePanelHeight } = dimensions;

    const xValues = dataset.data.map(d => d[xField]);
    const yValues = dataset.data.map(d => d[yField]);

    // Create X scale
    let xScale;
    if (xType === 'time') {
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      const xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      const xMax = new Date(Math.max(...dates.map(d => d.getTime())));
      xScale = new TimeScale([xMin, xMax], [0, innerWidth]);
    } else if (xType === 'number') {
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      xScale = new LinearScale([xMin, xMax], [0, innerWidth]);
    } else {
      // Category type
      const uniqueXValues = Array.from(new Set(xValues));
      const sortedCategories = ScaleManager.sortCategoriesFromDataset(dataset, uniqueXValues, xField);

      xScale = new LinearScale(
        [-0.5, sortedCategories.length - 0.5],
        [0, innerWidth]
      );

      // Store unique values for positioning
      xScale._uniqueXValues = sortedCategories;
    }

    // Always create LinearScale for Y (data is pre-transformed)
    const yScale = new LinearScale([0, 1], [effectivePanelHeight, 0]);

    // Calculate Y domain for this dataset
    if (yValues.length) {
      const yDomain = ScaleManager.calculatePanelYDomain(yValues, chartType);
      yScale.setDomain(yDomain);
    }

    return { xScale, yScale };
  }

  /**
   * Calculate Y domain for a single panel - FIXED VERSION with proper negative value handling
   * @param {Array} yValues - Y values for this panel
   * @param {string} chartType - Chart type
   * @returns {Array} Y domain [min, max]
   */
  static calculatePanelYDomain(yValues, chartType) {
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Logarithmic scale requires positive values
    const yPadding = yMax * 0.1;
    return [Math.max(0.01, Math.max(0, yMin)), yMax + yPadding];
  }

  /**
   * Sort categories from dataset data
   * @param {Object} dataset - Dataset
   * @param {Array} categories - Categories to sort
   * @param {string} xField - X field name
   * @returns {Array} Sorted categories
   */
  static sortCategoriesFromDataset(dataset, categories, xField) {
    if (dataset.data.length > 0 && dataset.data[0].x) {
      const categoryMap = new Map();
      dataset.data.forEach(d => {
        if (d.x && d[xField]) {
          categoryMap.set(d[xField], d.x);
        }
      });

      if (categoryMap.size > 0) {
        return categories.sort((a, b) => {
          const timeA = categoryMap.get(a) || 0;
          const timeB = categoryMap.get(b) || 0;
          return timeA - timeB;
        });
      }
    }

    return categories.sort();
  }

  /**
   * Update scale ranges when dimensions change
   * @param {Object} scales - Scales to update
   * @param {Object} dimensions - New dimensions
   */
  static updateScaleRanges(scales, dimensions) {
    const { innerWidth, innerHeight } = dimensions;

    if (scales.x) {
      scales.x.setRange([0, innerWidth]);
    }

    if (scales.y) {
      scales.y.setRange([innerHeight, 0]);
    }
  }

  /**
   * Create nice tick values for a scale
   * @param {Scale} scale - Scale instance
   * @param {number} tickCount - Desired number of ticks
   * @param {string} type - Scale type ('time', 'number', 'category')
   * @returns {Array} Tick values
   */
  static createTickValues(scale, tickCount = 5, type = 'number') {
    const [min, max] = scale.domain;

    if (type === 'time') {
      return createTimeTickValues(min, max, tickCount);
    } else if (type === 'number') {
      const niceDomain = createNiceDomain(min, max, tickCount);
      const step = (niceDomain[1] - niceDomain[0]) / (tickCount - 1);
      const ticks = [];

      for (let i = 0; i < tickCount; i++) {
        ticks.push(niceDomain[0] + step * i);
      }

      return ticks;
    } else if (type === 'category') {
      // For categories, return the stored unique values
      return scale._uniqueXValues || [];
    }

    return [];
  }

  /**
   * Clone a scale with the same configuration
   * @param {Scale} scale - Scale to clone
   * @returns {Scale} Cloned scale
   */
  static cloneScale(scale) {
    if (scale instanceof TimeScale) {
      return new TimeScale([...scale.domain], [...scale.range]);
    } else if (scale instanceof LinearScale) {
      const cloned = new LinearScale([...scale.domain], [...scale.range]);
      // Copy any additional properties
      if (scale._uniqueXValues) {
        cloned._uniqueXValues = [...scale._uniqueXValues];
      }
      return cloned;
    }

    return scale;
  }

  /**
   * Get scale type from scale instance
   * @param {Scale} scale - Scale instance
   * @returns {string} Scale type
   */
  static getScaleType(scale) {
    if (scale instanceof TimeScale) return 'time';
    if (scale instanceof LinearScale) return 'linear';
    return 'unknown';
  }
}
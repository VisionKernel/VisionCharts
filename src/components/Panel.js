import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import RecessionLines from './RecessionLines.js';
import ZeroLine from './ZeroLine.js';
import Grid from './Grid.js';

/**
 * Panel component for rendering multi-panel charts
 * Handles common panel functionality across different chart types
 */
export default class Panel {
    /**
     * Render panels for a chart - main entry point
     * @param {Chart} chart - Chart instance
     * @param {Function} chartSpecificRenderer - Function to render chart-specific data
     * @returns {Array} Panel scales for hover functionality
     */
    static renderForChart(chart, chartSpecificRenderer) {
    console.log('Panel.renderForChart called');
    
    if (!chart.state.chart) {
        console.error('Cannot render panels: chart element is null');
        return [];
    }
    
    try {
        const { innerWidth, innerHeight } = chart.state.dimensions;
        
        // Determine number of panels (one per dataset)
        const panelCount = chart.state.datasets.length;
        if (panelCount === 0) {
        console.log('No datasets for panels');
        return [];
        }
        
        console.log('Rendering', panelCount, 'panels');
        
        // Store panel scales for hover functionality
        const panelScales = [];
        
        // Create panel for each dataset
        chart.state.datasets.forEach((dataset, index) => {
        // Calculate panel dimensions
        const panelHeight = innerHeight / panelCount;
        const panelMargin = index === 0 ? 30 : 20;  // Extra margin for first panel
        const effectivePanelHeight = panelHeight - panelMargin;
        
        // Create panel group
        const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
        // Add top margin of 10px for the first panel
        const yPos = index * panelHeight + (index === 0 ? 20 : 0);
        panelGroup.setAttribute('transform', `translate(0, ${yPos})`);
        
        // Create panel background
        const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        panelBg.setAttribute('x', 0);
        panelBg.setAttribute('y', 0);
        panelBg.setAttribute('width', innerWidth);
        panelBg.setAttribute('height', effectivePanelHeight);
        panelBg.setAttribute('fill', '#f9f9f9');
        panelBg.setAttribute('stroke', '#eee');
        panelGroup.appendChild(panelBg);
        
        // Create scales for this panel
        const scales = Panel.createPanelScales(dataset, chart.options, {
            innerWidth,
            effectivePanelHeight
        });
        
        // Store scales for hover functionality
        panelScales[index] = { 
            xScale: scales.xScale, 
            yScale: scales.yScale, 
            panelHeight: effectivePanelHeight,
            panelWidth: innerWidth,
            yPos: yPos
        };
        
        // Render panel components (axes, grid, etc.)
        Panel.renderPanelComponents(
            panelGroup, 
            scales, 
            { innerWidth, effectivePanelHeight }, 
            chart.options, 
            index === chart.state.datasets.length - 1 // isLastPanel
        );
        
        // Render chart-specific data using the provided renderer
        if (chartSpecificRenderer) {
            chartSpecificRenderer(panelGroup, dataset, scales.xScale, scales.yScale, effectivePanelHeight, index);
        }
        
        // Render panel label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.textContent = dataset.name;
        label.setAttribute('x', 5);
        label.setAttribute('y', 15);
        label.setAttribute('font-size', '12px');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('fill', dataset.color);
        panelGroup.appendChild(label);
        
        // Add panel to chart
        chart.state.chart.appendChild(panelGroup);
        });
        
        // Store panel scales on chart for hover functionality
        chart.state.panelScales = panelScales;
        
        console.log('Panels rendered successfully');
        return panelScales;
    } catch (error) {
        console.error('Error rendering panels:', error);
        return [];
    }
    }
  
  /**
   * Create scales for a panel
   * @param {Object} dataset - Dataset for this panel
   * @param {Object} chartOptions - Chart options
   * @param {Object} dimensions - Panel dimensions
   * @returns {Object} Created scales
   */
  static createPanelScales(dataset, chartOptions, dimensions) {
    const { xField, yField, xType, isLogarithmic } = chartOptions;
    const { innerWidth, effectivePanelHeight } = dimensions;
    
    const xValues = dataset.data.map(d => d[xField]);
    const yValues = dataset.data.map(d => d[yField]);
    
    // Create X scale for this panel
    let xScale;
    if (xType === 'time') {
      // For time, handle date objects
      const dates = xValues.map(x => x instanceof Date ? x : new Date(x));
      const xMin = new Date(Math.min(...dates.map(d => d.getTime())));
      const xMax = new Date(Math.max(...dates.map(d => d.getTime())));
      xScale = new TimeScale([xMin, xMax], [0, innerWidth]);
    } else if (xType === 'number') {
      // For numeric data
      const xMin = Math.min(...xValues);
      const xMax = Math.max(...xValues);
      xScale = new LinearScale([xMin, xMax], [0, innerWidth]);
    } else {
      // For category data, we need to set up a special domain
      const uniqueXValues = Array.from(new Set(xValues));
      
      // Sort based on original data order if possible
      if (dataset.data.length > 0 && dataset.data[0].x) {
        const categoryMap = new Map();
        dataset.data.forEach(d => {
          if (d.x && d[xField]) {
            categoryMap.set(d[xField], d.x);
          }
        });
        
        if (categoryMap.size > 0) {
          uniqueXValues.sort((a, b) => {
            const timeA = categoryMap.get(a) || 0;
            const timeB = categoryMap.get(b) || 0;
            return timeA - timeB;
          });
        }
      }
      
      // Setup a linear scale with domain that creates even spacing
      xScale = new LinearScale(
        [-0.5, uniqueXValues.length - 0.5],
        [0, innerWidth]
      );
      
      // Store unique values for bar positioning
      xScale._uniqueXValues = uniqueXValues;
    }
    
    // Create Y scale for this panel
    let yScale;
    if (isLogarithmic) {
      yScale = new LogScale([0.1, 1], [effectivePanelHeight, 0]);
    } else {
      yScale = new LinearScale([0, 1], [effectivePanelHeight, 0]);
    }
    
    // Calculate Y domain for this dataset
    if (yValues.length) {
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      const yPadding = (yMax - yMin) * 0.1;
      
      // Set domain based on scale type
      if (isLogarithmic) {
        yScale.setDomain([Math.max(0.01, yMin), yMax + yPadding]);
      } else {
        // For bar charts, start from 0; for line charts, use padding
        const effectiveYMin = chartOptions.chartType === 'bar' ? 0 : yMin - yPadding;
        yScale.setDomain([effectiveYMin, yMax + yPadding]);
      }
    }
    
    return { xScale, yScale };
  }
  
  /**
   * Render panel components (axes, grid, zero line, recession lines)
   * @param {SVGElement} panelGroup - Panel container
   * @param {Object} scales - Panel scales
   * @param {Object} dimensions - Panel dimensions
   * @param {Object} options - Chart options
   * @param {boolean} isLastPanel - Whether this is the last panel
   */
  static renderPanelComponents(panelGroup, scales, dimensions, options, isLastPanel) {
    const { innerWidth, effectivePanelHeight } = dimensions;
    const { xScale, yScale } = scales;
    
    // Render panel axes
    Panel.renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, options, isLastPanel);
    
    // Render grid if enabled
    if (options.grid?.show) {
      Grid.renderForPanel(
        panelGroup,
        xScale,
        yScale,
        innerWidth,
        effectivePanelHeight,
        options.grid,
        options
      );
    }
    
    // Render zero line for this panel if enabled
    if (options.showZeroLine) {
      ZeroLine.renderForPanel(panelGroup, yScale, innerWidth, options.zeroLineOptions);
    }
    
    // Render recession lines for this panel if enabled
    if (options.showRecessionLines && options.recessions && options.recessions.length) {
      RecessionLines.renderForPanel(
        panelGroup, 
        options.recessions, 
        xScale, 
        effectivePanelHeight, 
        innerWidth,
        options.xType,
        options.recessionLinesOptions || {}
      );
    }
  }
  
  /**
   * Render axes for a panel
   * @param {SVGElement} panelGroup - Panel container
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} innerWidth - Panel width
   * @param {number} effectivePanelHeight - Panel height
   * @param {Object} options - Chart options
   * @param {boolean} isLastPanel - Whether this is the last panel
   */
  static renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, options, isLastPanel = false) {
    console.log('Panel.renderPanelAxes called for panel, isLastPanel:', isLastPanel);
    
    // Render axes using the static Axis method
    Axis.renderForPanel(
      panelGroup, 
      xScale, 
      yScale, 
      innerWidth, 
      effectivePanelHeight,
      {
        // Axis configuration
        showXAxis: isLastPanel, // Only show X axis on bottom panel
        showYAxis: true,
        showXLabels: isLastPanel, // Only show X labels on bottom panel
        showYLabels: true,
        xAxisName: isLastPanel ? options.xAxisName : '',
        yAxisName: options.yAxisName,
        isLogarithmic: options.isLogarithmic || false,
        
        // Custom axis options
        xAxisOptions: {
          tickCount: options.xTickCount || 5,
          tickFormat: options.xTickFormat,
          formatType: options.xType === 'time' ? 'time' : 'number',
          formatOptions: options.xFormatOptions || {},
          tickRotation: options.xTickRotation || 0
        },
        
        yAxisOptions: {
          tickCount: options.yTickCount || 4, // Fewer ticks for panels
          tickFormat: options.yTickFormat,
          formatType: 'number',
          formatOptions: options.yFormatOptions || {},
          tickRotation: options.yTickRotation || 0
        }
      }
    );
  }
}
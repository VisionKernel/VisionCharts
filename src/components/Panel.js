import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import RecessionLines from './RecessionLines.js';
import ZeroLine from './ZeroLine.js';
import Grid from './Grid.js';
import Crosshair from './Crosshair.js';

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
  
  /**
   * Initialize hover functionality for panel mode
   * @param {Chart} chart - Chart instance
   * @param {Function} formatTooltip - Tooltip formatter function
   */
  static initHoverFeatures(chart, formatTooltip) {
    console.log('Panel.initHoverFeatures called');
    
    if (!chart.state.chart || !chart.state.panelScales) return;
    
    // Import Tooltip component
    import('./Tooltip.js').then(({ default: Tooltip }) => {
      // Create single tooltip for all panels
      chart.state.components.tooltip = new Tooltip({
        followCursor: true,
        offset: { x: 15, y: 10 },
        background: '#fff',
        border: '#ccc',
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        formatter: formatTooltip
      });
      
      // Render tooltip
      chart.state.components.tooltip.render(chart.state.chart);
      chart.state.components.tooltip.hide();
    }).catch(console.error);
    
    // Initialize hover features for each panel
    chart.state.components.panelHoverFeatures = [];
    
    chart.state.panelScales.forEach((panelScale, index) => {
      const panel = chart.state.chart.querySelector(`.panel-${index}`);
      if (!panel) return;
      
      // Create crosshair for this panel
      const crosshair = new Crosshair({
        showX: true,
        showY: false,
        stroke: '#666',
        strokeWidth: 1,
        strokeDasharray: '4,4'
      });
      
      // Render crosshair
      crosshair.render(panel, panelScale.panelWidth, panelScale.panelHeight);
      crosshair.hide();
      
      // Create hover points for this panel
      const hoverPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      hoverPointsGroup.setAttribute('class', 'visioncharts-panel-hover-points');
      hoverPointsGroup.style.display = 'none';
      panel.appendChild(hoverPointsGroup);
      
      // Create hover point for the dataset in this panel
      const dataset = chart.state.datasets[index];
      if (dataset) {
        const hoverPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hoverPoint.setAttribute('r', 4);
        hoverPoint.setAttribute('fill', '#fff');
        hoverPoint.setAttribute('stroke', dataset.color);
        hoverPoint.setAttribute('stroke-width', 2);
        hoverPoint.setAttribute('class', 'visioncharts-panel-hover-point');
        hoverPoint.style.display = 'none';
        hoverPointsGroup.appendChild(hoverPoint);
      }
      
      // Store panel hover features
      chart.state.components.panelHoverFeatures[index] = {
        crosshair: crosshair,
        hoverPointsGroup: hoverPointsGroup,
        dataset: dataset,
        panelScale: panelScale
      };
      
      // Bind events for this panel
      Panel.bindHoverEvents(chart, panel, index, formatTooltip);
    });
  }
  
  /**
   * Bind hover events for a specific panel
   * @param {Chart} chart - Chart instance
   * @param {Element} panel - Panel element
   * @param {number} panelIndex - Panel index
   * @param {Function} formatTooltip - Tooltip formatter function
   */
  static bindHoverEvents(chart, panel, panelIndex, formatTooltip) {
    const panelFeatures = chart.state.components.panelHoverFeatures[panelIndex];
    if (!panelFeatures) return;
    
    const { panelScale, dataset, crosshair, hoverPointsGroup } = panelFeatures;
    const { xField, yField } = chart.options;
    
    // Mouse move handler for panel
    const mouseMoveHandler = (e) => {
      const panelRect = panel.getBoundingClientRect();
      const mouseX = e.clientX - panelRect.left;
      const mouseY = e.clientY - panelRect.top;
      
      // Check if within panel bounds
      if (mouseX < 0 || mouseX > panelScale.panelWidth || 
          mouseY < 0 || mouseY > panelScale.panelHeight) {
        crosshair.hide();
        hoverPointsGroup.style.display = 'none';
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
        return;
      }
      
      // Show crosshair
      crosshair.update(mouseX, 0);
      crosshair.show();
      
      // Find closest data point in this panel's dataset
      let closestPoint = null;
      let minDistance = Infinity;
      
      if (dataset && dataset.data) {
        dataset.data.forEach(point => {
          if (point[xField] === undefined || point[yField] === undefined) return;
          
          const pointX = panelScale.xScale.scale(point[xField]);
          const distance = Math.abs(mouseX - pointX);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
          }
        });
      }
      
      // Show hover point and tooltip if close enough
      if (closestPoint && minDistance < 50) {
        const pointX = panelScale.xScale.scale(closestPoint[xField]);
        const pointY = panelScale.yScale.scale(closestPoint[yField]);
        
        // Update hover point
        const hoverPoint = hoverPointsGroup.querySelector('.visioncharts-panel-hover-point');
        if (hoverPoint) {
          hoverPoint.setAttribute('cx', pointX);
          hoverPoint.setAttribute('cy', pointY);
          hoverPoint.style.display = 'block';
        }
        hoverPointsGroup.style.display = 'block';
        
        // Show tooltip
        const closestData = {
          dataset: dataset,
          point: closestPoint,
          x: pointX,
          y: pointY,
          distance: minDistance
        };
        
        if (chart.state.components.tooltip) {
          // Calculate tooltip position relative to the main chart container
          const containerRect = chart.state.container.getBoundingClientRect();
          const chartRect = chart.state.chart.getBoundingClientRect();
          const tooltipX = (chartRect.left - containerRect.left) + mouseX;
          const tooltipY = (chartRect.top - containerRect.top) + mouseY + panelScale.yPos;
          
          chart.state.components.tooltip.show(closestData, tooltipX, tooltipY, {
            width: chart.state.dimensions.width,
            height: chart.state.dimensions.height
          });
        }
      } else {
        hoverPointsGroup.style.display = 'none';
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
      }
    };
    
    // Mouse leave handler for panel
    const mouseLeaveHandler = (e) => {
      crosshair.hide();
      hoverPointsGroup.style.display = 'none';
      if (chart.state.components.tooltip) {
        chart.state.components.tooltip.hide();
      }
    };
    
    // Add event listeners
    panel.addEventListener('mousemove', mouseMoveHandler);
    panel.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    chart.state.eventHandlers = chart.state.eventHandlers || {};
    chart.state.eventHandlers[`panel-${panelIndex}`] = {
      move: mouseMoveHandler,
      leave: mouseLeaveHandler,
      panel: panel
    };
  }
}
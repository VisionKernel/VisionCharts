import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { formatLargeNumber, formatDateValue } from '../utils/chartUtils.js';

/**
 * InteractionManager handles all chart interactions including hover, tooltips, and crosshairs
 * Centralizes interaction logic to reduce duplication across chart types
 */
export default class InteractionManager {
  /**
   * Initialize single-panel mode interactions
   * @param {Chart} chart - Chart instance
   */
  static initSingleMode(chart) {
    console.log('InteractionManager.initSingleMode called');
    
    // Skip if no SVG or chart present
    if (!chart.state.svg || !chart.state.chart) return;
    
    // Create crosshair component
    chart.state.components.crosshair = new Crosshair({
      showX: true,
      showY: false, // Only show vertical line
      stroke: '#666',
      strokeWidth: 1,
      strokeDasharray: '4,4',
      snapToData: true
    });
    
    // Create tooltip component
    chart.state.components.tooltip = new Tooltip({
      followCursor: true,
      offset: { x: 15, y: 10 },
      background: '#fff',
      border: '#ccc',
      borderRadius: 4,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      formatter: InteractionManager.formatTooltip.bind(null, chart)
    });
    
    // Render components
    chart.state.components.crosshair.render(chart.state.chart, 
      chart.state.dimensions.innerWidth, 
      chart.state.dimensions.innerHeight);
    
    chart.state.components.tooltip.render(chart.state.chart);
    
    // Hide by default
    chart.state.components.crosshair.hide();
    chart.state.components.tooltip.hide();
    
    // Create hover points for each dataset
    InteractionManager.createSingleModeHoverPoints(chart);
    
    // Bind mouse events for single mode
    InteractionManager.bindSingleModeEvents(chart);
    
    // Apply flickering fix
    InteractionManager.fixFlickering(chart);
  }
  
  /**
   * Initialize panel mode interactions
   * @param {Chart} chart - Chart instance
   */
  static initPanelMode(chart) {
    console.log('InteractionManager.initPanelMode called');
    
    if (!chart.state.chart) {
      console.error('Cannot init panel mode: chart element is null');
      return;
    }

    // FIXED: Better check for panel scales
    if (!chart.state.panelScales || chart.state.panelScales.length === 0) {
      console.warn('No panel scales available for hover functionality, waiting for panels to be rendered...');
      
      // Try to get panel scales after a short delay (panels might still be rendering)
      setTimeout(() => {
        if (chart.state.panelScales && chart.state.panelScales.length > 0) {
          console.log('Panel scales now available, initializing hover features');
          InteractionManager.initPanelMode(chart);
        } else {
          console.error('Panel scales still not available after delay');
        }
      }, 100);
      return;
    }
    
    // Create single tooltip for all panels
    chart.state.components.tooltip = new Tooltip({
      followCursor: true,
      offset: { x: 15, y: 10 },
      background: '#fff',
      border: '#ccc',
      borderRadius: 4,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      formatter: InteractionManager.formatTooltip.bind(null, chart)
    });
    
    // Render tooltip
    chart.state.components.tooltip.render(chart.state.chart);
    chart.state.components.tooltip.hide();
    
    // Initialize hover features for each panel
    chart.state.components.panelHoverFeatures = [];
    
    // FIXED: Only process regular datasets (not studies) for hover functionality
    const regularDatasets = chart.state.datasets.filter(dataset => dataset.type !== 'study');
    
    console.log(`Initializing panel hover for ${chart.state.panelScales.length} panels and ${regularDatasets.length} regular datasets`);
    
    chart.state.panelScales.forEach((panelScale, index) => {
      const panel = chart.state.chart.querySelector(`.panel-${index}`);
      if (!panel) {
        console.warn(`Panel ${index} not found in DOM`);
        return;
      }
      
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
      
      // FIXED: Use the regular dataset for this panel index
      const dataset = regularDatasets[index];
      if (dataset) {
        // Create hover point for the main dataset
        const hoverPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hoverPoint.setAttribute('r', 4);
        hoverPoint.setAttribute('fill', '#fff');
        hoverPoint.setAttribute('stroke', dataset.color);
        hoverPoint.setAttribute('stroke-width', 2);
        hoverPoint.setAttribute('class', 'visioncharts-panel-hover-point');
        hoverPoint.style.display = 'none';
        hoverPointsGroup.appendChild(hoverPoint);
        
        // FIXED: Also create hover points for studies attached to this dataset
        const relatedStudies = InteractionManager.findStudiesForDataset(chart, dataset.id);
        relatedStudies.forEach((studyDataset, studyIndex) => {
          const studyHoverPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          studyHoverPoint.setAttribute('r', 3); // Slightly smaller for studies
          studyHoverPoint.setAttribute('fill', '#fff');
          studyHoverPoint.setAttribute('stroke', studyDataset.color);
          studyHoverPoint.setAttribute('stroke-width', 2);
          studyHoverPoint.setAttribute('class', `visioncharts-panel-study-hover-point-${studyDataset.id}`);
          studyHoverPoint.style.display = 'none';
          hoverPointsGroup.appendChild(studyHoverPoint);
        });
      }
      
      // Store panel hover features
      chart.state.components.panelHoverFeatures[index] = {
        crosshair: crosshair,
        hoverPointsGroup: hoverPointsGroup,
        dataset: dataset,
        relatedStudies: dataset ? InteractionManager.findStudiesForDataset(chart, dataset.id) : [],
        panelScale: panelScale
      };
      
      // Bind events for this panel
      InteractionManager.bindPanelEvents(chart, panel, index);
      
      console.log(`Panel ${index} hover features initialized`);
    });
    
    // Apply flickering fix
    InteractionManager.fixFlickering(chart);
    
    console.log('Panel mode interaction features initialized successfully');
  }
  
  /**
   * Find study datasets that belong to a specific regular dataset
   * @param {Object} chart - Chart instance
   * @param {string} datasetId - ID of the regular dataset
   * @returns {Array} Array of study datasets
   */
  static findStudiesForDataset(chart, datasetId) {
    if (!chart.state.datasets) {
      return [];
    }
    
    // Find all study datasets that have this dataset as their parent
    return chart.state.datasets.filter(dataset => {
      // Check if it's a study dataset
      if (dataset.type !== 'study') {
        return false;
      }
      
      // Check if this study belongs to the specified dataset
      if (chart.options.studies) {
        const studyConfig = chart.options.studies.find(study => study.id === dataset.id);
        return studyConfig && studyConfig.datasetId === datasetId;
      }
      
      return false;
    });
  }
  
  /**
   * Create hover points for single mode
   * @param {Chart} chart - Chart instance
   */
  static createSingleModeHoverPoints(chart) {
    // Create a group for hover points
    chart.state.components.hoverPointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chart.state.components.hoverPointsGroup.setAttribute('class', 'visioncharts-hover-points');
    chart.state.components.hoverPointsGroup.style.display = 'none';
    chart.state.chart.appendChild(chart.state.components.hoverPointsGroup);
    
    // Create hover points for each dataset
    chart.state.components.hoverPoints = chart.state.datasets.map(dataset => {
      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      point.setAttribute('r', 4); // Slightly larger than normal points
      point.setAttribute('fill', '#fff');
      point.setAttribute('stroke', dataset.color);
      point.setAttribute('stroke-width', 2);
      point.setAttribute('class', `visioncharts-hover-point-${dataset.id}`);
      point.style.display = 'none';
      
      chart.state.components.hoverPointsGroup.appendChild(point);
      
      return {
        element: point,
        dataset: dataset
      };
    });
  }
  
  /**
   * Bind mouse events for single mode
   * @param {Chart} chart - Chart instance
   */
  static bindSingleModeEvents(chart) {
    // Only bind if chart is rendered
    if (!chart.state.chart || !chart.state.svg) return;
    
    console.log('InteractionManager.bindSingleModeEvents called');
    
    // Use SVG as the main event target for more reliable event handling
    const eventTarget = chart.state.svg;
    
    // Mouse move handler
    const mouseMoveHandler = (e) => {
      // Get mouse position relative to the SVG
      const svgRect = chart.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left - chart.options.margins.left; // Account for margins
      const mouseY = e.clientY - svgRect.top - chart.options.margins.top;   // Account for margins
      
      // Check if within chart bounds (inner chart area)
      if (mouseX < 0 || mouseX > chart.state.dimensions.innerWidth || 
          mouseY < 0 || mouseY > chart.state.dimensions.innerHeight) {
        InteractionManager.hideSingleModeElements(chart);
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
        return;
      }
      
      // Always show crosshair for line charts when in bounds
      if (chart.options.chartType === 'line' || chart.options.chartType === 'area') {
        if (chart.state.components.crosshair) {
          chart.state.components.crosshair.update(mouseX, 0);
          chart.state.components.crosshair.show();
        }
      }
      
      // Update hover points
      InteractionManager.updateSingleModeHoverPoints(chart, mouseX);
      
      // Show tooltip with closest data
      const closestData = InteractionManager.findClosestData(chart, mouseX);
      if (closestData && chart.state.components.tooltip) {
        // Convert back to SVG coordinates for tooltip positioning
        const tooltipX = mouseX + chart.options.margins.left;
        const tooltipY = mouseY + chart.options.margins.top;
        
        chart.state.components.tooltip.show(closestData, tooltipX, tooltipY, {
          width: chart.state.dimensions.width,
          height: chart.state.dimensions.height
        });
      } else if (chart.state.components.tooltip) {
        chart.state.components.tooltip.hide();
      }
    };
    
    // Mouse leave handler
    const mouseLeaveHandler = (e) => {
      // Only hide if we're actually leaving the SVG area
      const svgRect = chart.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;
      
      // Check if mouse is outside SVG bounds
      if (mouseX < 0 || mouseX > chart.state.dimensions.width || 
          mouseY < 0 || mouseY > chart.state.dimensions.height) {
        InteractionManager.hideSingleModeElements(chart);
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
      }
    };
    
    // Add event listeners to SVG for more reliable event handling
    eventTarget.addEventListener('mousemove', mouseMoveHandler);
    eventTarget.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    chart.state.eventHandlers = chart.state.eventHandlers || {};
    chart.state.eventHandlers.hover = {
      move: mouseMoveHandler,
      leave: mouseLeaveHandler,
      target: eventTarget // Store target for cleanup
    };
    
    console.log('Single mode hover events bound to SVG element');
  }
  
  /**
   * Bind hover events for a specific panel
   * FIXED: Better coordinate handling and event reliability
   * @param {Chart} chart - Chart instance
   * @param {Element} panel - Panel element
   * @param {number} panelIndex - Panel index
   */
  static bindPanelEvents(chart, panel, panelIndex) {
    const panelFeatures = chart.state.components.panelHoverFeatures[panelIndex];
    if (!panelFeatures) {
      console.warn(`No panel features found for panel ${panelIndex}`);
      return;
    }
    
    const { panelScale, dataset, relatedStudies, crosshair, hoverPointsGroup } = panelFeatures;
    const { xField, yField } = chart.options;
    
    console.log(`Binding events for panel ${panelIndex}`);
    
    // Mouse move handler for panel
    const mouseMoveHandler = (e) => {
      // FIXED: Better coordinate calculation
      const svgRect = chart.state.svg.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      
      // Calculate mouse position relative to the panel
      const mouseX = e.clientX - panelRect.left;
      const mouseY = e.clientY - panelRect.top;
      
      // Check if within panel bounds - FIXED: Use proper panel dimensions
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
      
      // FIXED: Find closest data point in this panel's main dataset and related studies
      let closestPoint = null;
      let minDistance = Infinity;
      let closestDataset = null;
      
      // Check main dataset
      if (dataset && dataset.data) {
        dataset.data.forEach(point => {
          if (point[xField] === undefined || point[yField] === undefined) return;
          
          const pointX = panelScale.xScale.scale(point[xField]);
          const distance = Math.abs(mouseX - pointX);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
            closestDataset = dataset;
          }
        });
      }
      
      // Check related studies
      relatedStudies.forEach(studyDataset => {
        if (studyDataset && studyDataset.data) {
          studyDataset.data.forEach(point => {
            if (point[xField] === undefined || point[yField] === undefined) return;
            
            const pointX = panelScale.xScale.scale(point[xField]);
            const distance = Math.abs(mouseX - pointX);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = point;
              closestDataset = studyDataset;
            }
          });
        }
      });
      
      // FIXED: More lenient proximity threshold for bar charts
      const proximityThreshold = chart.options.chartType === 'bar' ? 100 : 50;
      
      // Show hover points and tooltip if close enough
      if (closestPoint && minDistance < proximityThreshold) {
        const pointX = panelScale.xScale.scale(closestPoint[xField]);
        const pointY = panelScale.yScale.scale(closestPoint[yField]);
        
        // Update hover points for all datasets in this panel
        hoverPointsGroup.style.display = 'block';
        
        // Update main dataset hover point
        const mainHoverPoint = hoverPointsGroup.querySelector('.visioncharts-panel-hover-point');
        if (mainHoverPoint && dataset) {
          const mainClosest = InteractionManager.findClosestPointInDataset(dataset, mouseX, panelScale.xScale, xField, yField);
          if (mainClosest) {
            const mainPointX = panelScale.xScale.scale(mainClosest[xField]);
            const mainPointY = panelScale.yScale.scale(mainClosest[yField]);
            mainHoverPoint.setAttribute('cx', mainPointX);
            mainHoverPoint.setAttribute('cy', mainPointY);
            mainHoverPoint.style.display = 'block';
          } else {
            mainHoverPoint.style.display = 'none';
          }
        }
        
        // Update study hover points
        relatedStudies.forEach(studyDataset => {
          const studyHoverPoint = hoverPointsGroup.querySelector(`.visioncharts-panel-study-hover-point-${studyDataset.id}`);
          if (studyHoverPoint) {
            const studyClosest = InteractionManager.findClosestPointInDataset(studyDataset, mouseX, panelScale.xScale, xField, yField);
            if (studyClosest) {
              const studyPointX = panelScale.xScale.scale(studyClosest[xField]);
              const studyPointY = panelScale.yScale.scale(studyClosest[yField]);
              studyHoverPoint.setAttribute('cx', studyPointX);
              studyHoverPoint.setAttribute('cy', studyPointY);
              studyHoverPoint.style.display = 'block';
            } else {
              studyHoverPoint.style.display = 'none';
            }
          }
        });
        
        // Show tooltip for closest point
        const closestData = {
          dataset: closestDataset,
          point: closestPoint,
          x: pointX,
          y: pointY,
          distance: minDistance
        };
        
        if (chart.state.components.tooltip) {
          // FIXED: Better tooltip positioning relative to the main SVG
          const tooltipX = e.clientX - svgRect.left;
          const tooltipY = e.clientY - svgRect.top;
          
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
    
    console.log(`Events bound successfully for panel ${panelIndex}`);
  }
  
  /**
   * Find closest point in a specific dataset
   * FIXED: More lenient distance threshold for bar charts
   * @param {Object} dataset - Dataset to search
   * @param {number} mouseX - Mouse X position
   * @param {Object} xScale - X scale
   * @param {string} xField - X field name
   * @param {string} yField - Y field name
   * @returns {Object|null} Closest point or null
   */
  static findClosestPointInDataset(dataset, mouseX, xScale, xField, yField) {
    if (!dataset || !dataset.data) return null;
    
    let closestPoint = null;
    let minDistance = Infinity;
    
    dataset.data.forEach(point => {
      if (point[xField] === undefined || point[yField] === undefined) return;
      
      const pointX = xScale.scale(point[xField]);
      const distance = Math.abs(mouseX - pointX);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });
    
    // FIXED: More lenient threshold for bars
    const threshold = 100; // Increased from 50
    return minDistance < threshold ? closestPoint : null;
  }
  
  /**
   * Update hover points for single mode
   * @param {Chart} chart - Chart instance
   * @param {number} mouseX - Mouse X position (relative to chart area)
   */
  static updateSingleModeHoverPoints(chart, mouseX) {
    // Skip if no hover points
    if (!chart.state.components.hoverPoints) return;
    
    // Show hover points group
    if (chart.state.components.hoverPointsGroup) {
      chart.state.components.hoverPointsGroup.style.display = 'block';
    }
    
    // Use the correct scales
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    if (!xScale || !yScale) {
      console.warn('Scales not available for hover points');
      return;
    }
    
    // Find closest data points for each dataset
    chart.state.components.hoverPoints.forEach(hoverPoint => {
      const dataset = hoverPoint.dataset;
      const { xField, yField } = chart.options;
      
      // Find closest data point
      let closestPoint = null;
      let minDistance = Infinity;
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined || point[yField] === undefined) return;
        
        const xPos = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - xPos);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });
      
      // Show hover point if we found a close point
      // For line charts, be more generous with the threshold
      const proximityThreshold = (chart.options.chartType === 'line' || chart.options.chartType === 'area') ? 100 : 25;
      
      if (closestPoint && minDistance < proximityThreshold) {
        const x = xScale.scale(closestPoint[xField]);
        const y = yScale.scale(closestPoint[yField]);
        
        hoverPoint.element.setAttribute('cx', x);
        hoverPoint.element.setAttribute('cy', y);
        hoverPoint.element.style.display = 'block';
        
        // Store data for tooltip
        hoverPoint.data = closestPoint;
      } else {
        // Hide hover point if too far
        hoverPoint.element.style.display = 'none';
        hoverPoint.data = null;
      }
    });
  }
  
  /**
   * Find closest data point to mouse position
   * @param {Chart} chart - Chart instance
   * @param {number} mouseX - Mouse X position
   * @returns {Object|null} Closest data point info
   */
  static findClosestData(chart, mouseX) {
    if (!chart.state.datasets || !chart.state.datasets.length) return null;
    
    const { xField, yField } = chart.options;
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    if (!xScale || !yScale) return null;
    
    let closestData = null;
    let minDistance = Infinity;
    
    // Check all datasets
    chart.state.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined || point[yField] === undefined) return;
        
        const pointX = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - pointX);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestData = {
            dataset: dataset,
            point: point,
            x: pointX,
            y: yScale.scale(point[yField]),
            distance: distance
          };
        }
      });
    });
    
    // Only return if reasonably close (within 50 pixels for line charts)
    const threshold = chart.options.chartType === 'line' ? 50 : 25;
    return (closestData && minDistance < threshold) ? closestData : null;
  }
  
  /**
   * Format tooltip content
   * @param {Chart} chart - Chart instance
   * @param {Object} data - Data point information
   * @returns {Array} Formatted text lines
   */
  static formatTooltip(chart, data) {
    if (!data || !data.point) return '';
    
    const { xField, yField, xType, yType } = chart.options;
    const point = data.point;
    const dataset = data.dataset;
    
    // Format X value
    let xLabel = '';
    const xValue = point[xField];
    
    if (xType === 'time') {
      const date = xValue instanceof Date ? xValue : new Date(xValue);
      xLabel = formatDateValue(date, 'MMM dd, yyyy');
    } else {
      xLabel = typeof xValue === 'number' ? formatLargeNumber(xValue) : xValue;
    }
    
    // Format Y value
    const yValue = point[yField];
    let yLabel = '';
    
    if (yType === 'percent' || yType === 'percentage') {
      yLabel = (yValue * 100).toFixed(1) + '%';
    } else if (yType === 'currency') {
      yLabel = '$' + formatLargeNumber(yValue);
    } else {
      yLabel = formatLargeNumber(yValue);
    }
    
    // Return simple text lines
    return [
      dataset.name || 'Series',
      `Date: ${xLabel}`,
      `Value: ${yLabel}`
    ];
  }
  
  /**
   * Hide hover elements for single mode
   * @param {Chart} chart - Chart instance
   */
  static hideSingleModeElements(chart) {
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.hide();
    }
    
    if (chart.state.components.tooltip) {
      chart.state.components.tooltip.hide();
    }
    
    if (chart.state.components.hoverPointsGroup) {
      chart.state.components.hoverPointsGroup.style.display = 'none';
    }
  }
  
  /**
   * Fix flickering by making hover elements non-interactive
   * @param {Chart} chart - Chart instance
   */
  static fixFlickering(chart) {
    console.log('InteractionManager.fixFlickering called');
    
    // Single mode fixes
    if (chart.state.components.crosshair && chart.state.components.crosshair.elements.group) {
      chart.state.components.crosshair.elements.group.style.pointerEvents = 'none';
      chart.state.components.crosshair.elements.group.style.userSelect = 'none';
    }
    
    // Fix Tooltip component
    if (chart.state.components.tooltip && chart.state.components.tooltip.elements) {
      Object.keys(chart.state.components.tooltip.elements).forEach(key => {
        const element = chart.state.components.tooltip.elements[key];
        if (element && element.style) {
          element.style.pointerEvents = 'none';
          element.style.userSelect = 'none';
        }
      });
    }
    
    if (chart.state.components.hoverPointsGroup) {
      chart.state.components.hoverPointsGroup.style.pointerEvents = 'none';
      chart.state.components.hoverPointsGroup.style.userSelect = 'none';
    }
    
    if (chart.state.components.hoverPoints) {
      chart.state.components.hoverPoints.forEach(hoverPoint => {
        if (hoverPoint.element) {
          hoverPoint.element.style.pointerEvents = 'none';
          hoverPoint.element.style.userSelect = 'none';
        }
      });
    }
    
    // Panel mode fixes
    if (chart.state.components.panelHoverFeatures) {
      chart.state.components.panelHoverFeatures.forEach(panelFeatures => {
        if (panelFeatures.crosshair && panelFeatures.crosshair.elements.group) {
          panelFeatures.crosshair.elements.group.style.pointerEvents = 'none';
          panelFeatures.crosshair.elements.group.style.userSelect = 'none';
        }
        
        if (panelFeatures.hoverPointsGroup) {
          panelFeatures.hoverPointsGroup.style.pointerEvents = 'none';
          panelFeatures.hoverPointsGroup.style.userSelect = 'none';
        }
      });
    }
    
    console.log('Flickering fix applied');
  }
  
  /**
   * Clean up all interaction features
   * @param {Chart} chart - Chart instance
   */
  static cleanup(chart) {
    console.log('InteractionManager.cleanup called');
    
    // Clean up single mode hover features
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.destroy();
      chart.state.components.crosshair = null;
    }
    
    if (chart.state.components.tooltip) {
      chart.state.components.tooltip.destroy();
      chart.state.components.tooltip = null;
    }
    
    if (chart.state.components.hoverPointsGroup) {
      if (chart.state.components.hoverPointsGroup.parentNode) {
        chart.state.components.hoverPointsGroup.parentNode.removeChild(chart.state.components.hoverPointsGroup);
      }
      chart.state.components.hoverPointsGroup = null;
    }
    
    // Clean up panel mode hover features
    if (chart.state.components.panelHoverFeatures) {
      chart.state.components.panelHoverFeatures.forEach(panelFeatures => {
        if (panelFeatures.crosshair) {
          panelFeatures.crosshair.destroy();
        }
        if (panelFeatures.tooltip) {
          panelFeatures.tooltip.destroy();
        }
      });
      chart.state.components.panelHoverFeatures = null;
    }
    
    // Clean up event handlers
    if (chart.state.eventHandlers) {
      Object.keys(chart.state.eventHandlers).forEach(key => {
        const handler = chart.state.eventHandlers[key];
        
        if (key.startsWith('panel-')) {
          const panelIndex = key.split('-')[1];
          const panel = chart.state.chart && chart.state.chart.querySelector(`.panel-${panelIndex}`);
          if (panel && handler) {
            if (handler.move) panel.removeEventListener('mousemove', handler.move);
            if (handler.leave) panel.removeEventListener('mouseleave', handler.leave);
          }
        } else if (key === 'hover' && handler) {
          // Clean up single mode hover events
          const target = handler.target || chart.state.svg;
          if (target && handler.move) {
            target.removeEventListener('mousemove', handler.move);
          }
          if (target && handler.leave) {
            target.removeEventListener('mouseleave', handler.leave);
          }
        }
      });
      
      chart.state.eventHandlers = {};
    }
    
    console.log('InteractionManager cleanup completed');
  }
}
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import { formatLargeNumber, formatDateValue } from '../utils/chartUtils.js';

/**
 * InteractionManager handles all chart interactions including hover, tooltips, and crosshairs
 * Centralizes interaction logic to reduce duplication across chart types
 */
export default class InteractionManager {
  /**
   * Initialize single-panel mode interactions - enhanced for multi-renderer
   * @param {Chart} chart - Chart instance
   */
  static async initSingleMode(chart) {
    console.log('InteractionManager.initSingleMode called with multi-renderer support');
    
    // Skip if renderer not available
    if (!chart.renderer || !chart.renderer.isInitialized) {
      console.warn('InteractionManager: Renderer not available, skipping initialization');
      return;
    }
    
    // Create crosshair component
    chart.state.components.crosshair = new Crosshair({
      showX: true,
      showY: false,
      stroke: '#666',
      strokeWidth: 1,
      strokeDasharray: '4,4',
      snapToData: true
    });
    
    // Create tooltip component with multi-renderer support
    chart.state.components.tooltip = new Tooltip({
      followCursor: true,
      offset: { x: 15, y: 10 },
      background: '#ffffff',
      border: '#cccccc',
      borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      formatter: InteractionManager.createTooltipFormatter(chart),
      showDelay: 0,
      hideDelay: 100,
      preferHTMLOverlay: chart.renderer.type !== 'svg' // Use HTML overlay for Canvas/WebGL
    });
    
    // Initialize tooltip with current renderer
    await chart.state.components.tooltip.initialize(chart.renderer, chart.state.container);
    
    // Initialize crosshair (renderer-agnostic)
    await chart.state.components.crosshair.initialize(chart.renderer);
    
    // Hide components by default
    chart.state.components.crosshair.hide();
    chart.state.components.tooltip.hide();
    
    // Set up event handlers with proper renderer context
    InteractionManager._setupSingleModeEvents(chart);
  }

  /**
   * Setup event handlers for single mode - enhanced for multi-renderer
   * @private
   */
  static _setupSingleModeEvents(chart) {
    // Get the appropriate event target based on renderer
    const eventTarget = InteractionManager._getEventTarget(chart);
    
    if (!eventTarget) {
      console.error('InteractionManager: No event target available');
      return;
    }
    
    // Mouse move handler
    const mouseMoveHandler = (e) => {
      const coords = InteractionManager._getEventCoordinates(e, chart);
      const closestData = InteractionManager._findClosestDataPoint(coords.x, coords.y, chart);
      
      if (closestData && closestData.distance <= 30) {
        // Update crosshair
        chart.state.components.crosshair?.show(coords.x, coords.y);
        
        // Show tooltip with proper coordinate conversion
        const tooltipData = InteractionManager._formatTooltipData(closestData, chart);
        chart.state.components.tooltip?.show(
          tooltipData, 
          coords.chartX, 
          coords.chartY, 
          {
            width: chart.state.dimensions.width,
            height: chart.state.dimensions.height
          }
        );
      } else {
        // Hide components
        chart.state.components.crosshair?.hide();
        chart.state.components.tooltip?.hide();
      }
    };
    
    // Mouse leave handler
    const mouseLeaveHandler = (e) => {
      chart.state.components.crosshair?.hide();
      chart.state.components.tooltip?.hide();
    };
    
    // Add event listeners
    eventTarget.addEventListener('mousemove', mouseMoveHandler);
    eventTarget.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    chart.interactionHandlers = chart.interactionHandlers || [];
    chart.interactionHandlers.push({
      target: eventTarget,
      type: 'mousemove',
      handler: mouseMoveHandler
    }, {
      target: eventTarget,
      type: 'mouseleave',
      handler: mouseLeaveHandler
    });
  }

  /**
   * Initialize legend interactions - enhanced for multi-renderer
   * @param {Chart} chart - Chart instance
   */
  static async initLegendInteractions(chart) {
    console.log('InteractionManager.initLegendInteractions called');
    
    if (!chart.state.components.legend) {
      console.log('No legend component to initialize interactions for');
      return;
    }
    
    // Set up legend event listeners
    InteractionManager._setupLegendEventListeners(chart);
  }

  /**
   * Setup legend event listeners for all renderer types
   * @private
   */
  static _setupLegendEventListeners(chart) {
    const target = chart.state.container || document;
    
    // Legend item click handler
    const legendClickHandler = (event) => {
      const detail = event.detail;
      console.log('Legend item clicked:', detail);
      
      // Toggle dataset visibility
      if (detail.item && detail.item.dataset) {
        InteractionManager._toggleDatasetVisibility(chart, detail.item.dataset, detail.visible);
      } else if (detail.id) {
        // Fallback: find dataset by legend item ID
        const dataset = chart.config.datasets?.find(d => d.id === detail.id || d.name === detail.id);
        if (dataset) {
          InteractionManager._toggleDatasetVisibility(chart, dataset, detail.visible);
        }
      }
      
      // Re-render chart to reflect changes
      chart.update();
    };
    
    // Legend item hover handler
    const legendHoverHandler = (event) => {
      const detail = event.detail;
      console.log('Legend item hover:', detail);
      
      // Highlight/unhighlight corresponding data
      if (detail.item && detail.item.dataset) {
        InteractionManager._highlightDataset(chart, detail.item.dataset, detail.hovering);
      } else if (detail.id) {
        // Fallback: find dataset by legend item ID
        const dataset = chart.config.datasets?.find(d => d.id === detail.id || d.name === detail.id);
        if (dataset) {
          InteractionManager._highlightDataset(chart, dataset, detail.hovering);
        }
      }
    };
    
    // Add event listeners
    target.addEventListener('legend-item-click', legendClickHandler);
    target.addEventListener('legend-item-hover', legendHoverHandler);
    
    // Store handlers for cleanup
    chart.legendInteractionHandlers = chart.legendInteractionHandlers || [];
    chart.legendInteractionHandlers.push({
      target: target,
      type: 'legend-item-click',
      handler: legendClickHandler
    }, {
      target: target,
      type: 'legend-item-hover',
      handler: legendHoverHandler
    });
  }

  /**
   * Toggle dataset visibility
   * @private
   */
  static _toggleDatasetVisibility(chart, dataset, visible) {
    if (!dataset) return;
    
    // Update dataset visibility
    dataset.visible = visible;
    
    // Update any rendered elements associated with this dataset
    InteractionManager._updateDatasetRendering(chart, dataset);
    
    // Dispatch custom event for other components to react
    const event = new CustomEvent('dataset-visibility-changed', {
      detail: {
        dataset: dataset,
        visible: visible
      }
    });
    chart.state.container?.dispatchEvent(event);
  }

  /**
   * Highlight/unhighlight dataset
   * @private
   */
  static _highlightDataset(chart, dataset, highlight) {
    if (!dataset || !chart.renderer) return;
    
    // For SVG renderer, we can manipulate DOM elements directly
    if (chart.renderer.type === 'svg') {
      InteractionManager._highlightSVGDataset(chart, dataset, highlight);
    } 
    // For Canvas/WebGL, we need to trigger a re-render with highlight state
    else {
      InteractionManager._highlightCanvasDataset(chart, dataset, highlight);
    }
  }

  /**
   * Highlight SVG dataset elements
   * @private
   */
  static _highlightSVGDataset(chart, dataset, highlight) {
    // Find SVG elements associated with this dataset
    const datasetClass = `visioncharts-dataset-${dataset.id}`;
    const elements = chart.state.svg?.querySelectorAll(`.${datasetClass}`);
    
    if (elements) {
      elements.forEach(element => {
        if (highlight) {
          element.style.opacity = '1';
          element.style.strokeWidth = element.style.strokeWidth ? 
            (parseFloat(element.style.strokeWidth) * 1.5) + 'px' : '2px';
        } else {
          element.style.opacity = '';
          element.style.strokeWidth = '';
        }
      });
    }
  }

  /**
   * Highlight Canvas/WebGL dataset
   * @private
   */
  static _highlightCanvasDataset(chart, dataset, highlight) {
    // For Canvas/WebGL, we store highlight state and trigger re-render
    if (!chart.datasetHighlightState) {
      chart.datasetHighlightState = new Map();
    }
    
    chart.datasetHighlightState.set(dataset.id, highlight);
    
    // Trigger a lightweight re-render if the chart supports it
    if (chart.renderData && typeof chart.renderData === 'function') {
      // Some charts might support partial re-rendering
      chart.renderData();
    }
  }

  /**
   * Update dataset rendering after visibility change
   * @private
   */
  static _updateDatasetRendering(chart, dataset) {
    // For SVG renderer, we can show/hide elements directly
    if (chart.renderer.type === 'svg') {
      const datasetClass = `visioncharts-dataset-${dataset.id}`;
      const elements = chart.state.svg?.querySelectorAll(`.${datasetClass}`);
      
      if (elements) {
        elements.forEach(element => {
          element.style.display = dataset.visible ? '' : 'none';
        });
      }
    }
    // For Canvas/WebGL, we need to re-render
    else {
      if (chart.renderData && typeof chart.renderData === 'function') {
        chart.renderData();
      }
    }
  }

  /**
   * Initialize crosshair interactions - enhanced for multi-renderer
   * @param {Chart} chart - Chart instance
   */
  static async initCrosshair(chart) {
    console.log('InteractionManager.initCrosshair called');
    
    if (!chart.renderer || !chart.renderer.isInitialized) {
      console.warn('Cannot initialize crosshair: renderer not available');
      return;
    }
    
    // Create crosshair component if it doesn't exist
    if (!chart.state.components.crosshair) {
      chart.state.components.crosshair = new Crosshair({
        showX: chart.options.crosshair?.showX !== false,
        showY: chart.options.crosshair?.showY || false,
        
        // Styling from chart options
        stroke: chart.options.crosshair?.color || '#666666',
        strokeWidth: chart.options.crosshair?.width || 1,
        strokeDasharray: chart.options.crosshair?.dashArray || '4,4',
        opacity: chart.options.crosshair?.opacity || 0.8,
        
        // Behavior
        snapToData: chart.options.crosshair?.snapToData !== false,
        snapDistance: chart.options.crosshair?.snapDistance || 20,
        followCursor: chart.options.crosshair?.followCursor !== false,
        
        // Animation
        animationDuration: chart.options.crosshair?.animationDuration || 150,
        smoothMovement: chart.options.crosshair?.smoothMovement !== false,
        
        // Renderer preferences
        preferHTMLOverlay: chart.options.crosshair?.preferHTMLOverlay,
        useCanvasOverlay: chart.options.crosshair?.useCanvasOverlay,
        
        // Performance
        throttleUpdates: chart.options.crosshair?.throttleUpdates || 16,
        
        // Advanced features
        glowEffect: chart.options.crosshair?.glowEffect || false,
        glowColor: chart.options.crosshair?.glowColor || '#ffffff',
        glowBlur: chart.options.crosshair?.glowBlur || 3
      });
    }
    
    // Initialize crosshair with current renderer
    const success = await chart.state.components.crosshair.initialize(
      chart.renderer,
      chart.state.container,
      chart.state.dimensions.innerWidth,
      chart.state.dimensions.innerHeight
    );
    
    if (success) {
      console.log('Crosshair initialized successfully');
      
      // Set up data points for snapping if chart has data
      InteractionManager._updateCrosshairDataPoints(chart);
    } else {
      console.error('Failed to initialize crosshair');
    }
  }

  /**
   * Update crosshair data points for snapping
   * @private
   */
  static _updateCrosshairDataPoints(chart) {
    if (!chart.state.components.crosshair || !chart.config.datasets) return;
    
    const dataPoints = [];
    
    // Collect all data points from all datasets
    chart.config.datasets.forEach(dataset => {
      if (!dataset.data || !dataset.visible) return;
      
      dataset.data.forEach(point => {
        if (!point || point[chart.options.xField] === undefined || point[chart.options.yField] === undefined) {
          return;
        }
        
        // Convert data point to screen coordinates
        const screenX = chart.state.scales.x?.scale(point[chart.options.xField]);
        const screenY = chart.state.scales.y?.scale(point[chart.options.yField]);
        
        if (screenX !== undefined && screenY !== undefined) {
          dataPoints.push({
            x: screenX,
            y: screenY,
            data: point,
            dataset: dataset
          });
        }
      });
    });
    
    // Set data points for crosshair snapping
    chart.state.components.crosshair.setDataPoints(dataPoints);
    
    console.log(`Updated crosshair with ${dataPoints.length} data points for snapping`);
  }

  /**
   * Render crosshair within chart dimensions
   * @param {Chart} chart - Chart instance
   */
  static renderCrosshair(chart) {
    if (!chart.state.components.crosshair || !chart.state.components.crosshair.isInitialized) {
      console.log('Crosshair not available for rendering');
      return;
    }
    
    const { innerWidth, innerHeight } = chart.state.dimensions;
    const margins = chart.options.margins;
    
    // For SVG mode, we need to call renderSVG
    if (chart.state.components.crosshair.renderMode === 'svg') {
      const crosshairId = chart.state.components.crosshair.renderSVG(innerWidth, innerHeight, {
        translateX: margins.left,
        translateY: margins.top
      });
      
      console.log(`Crosshair rendered in SVG mode with ID: ${crosshairId}`);
      return crosshairId;
    } else {
      // For Canvas/HTML overlay modes, crosshair is already rendered during initialization
      console.log(`Crosshair ready in ${chart.state.components.crosshair.renderMode} mode`);
      return chart.state.components.crosshair.elementId;
    }
  }

  /**
   * Enhanced single mode initialization with crosshair support
   * @param {Chart} chart - Chart instance
   */
  static async initSingleModeWithCrosshair(chart) {
    console.log('InteractionManager.initSingleModeWithCrosshair called');
    
    // Initialize base interactions (tooltip)
    await InteractionManager.initSingleMode(chart);
    
    // Initialize crosshair
    await InteractionManager.initCrosshair(chart);
    
    // Render crosshair
    InteractionManager.renderCrosshair(chart);
    
    // Set up enhanced event handlers that coordinate tooltip and crosshair
    InteractionManager._setupCrosshairCoordinatedEvents(chart);
  }

  /**
   * Setup event handlers that coordinate crosshair and tooltip
   * @private
   */
  static _setupCrosshairCoordinatedEvents(chart) {
    // Get the appropriate event target based on renderer
    const eventTarget = InteractionManager._getEventTarget(chart);
    
    if (!eventTarget) {
      console.error('InteractionManager: No event target available for crosshair events');
      return;
    }
    
    // Enhanced mouse move handler
    const mouseMoveHandler = (e) => {
      const coords = InteractionManager._getEventCoordinates(e, chart);
      
      // Update crosshair position
      if (chart.state.components.crosshair) {
        chart.state.components.crosshair.update(coords.chartX, coords.chartY);
        
        // Show crosshair if hidden
        if (!chart.state.components.crosshair.visible) {
          chart.state.components.crosshair.show();
        }
      }
      
      // Find closest data point for tooltip
      const closestData = InteractionManager._findClosestDataPoint(coords.chartX, coords.chartY, chart);
      
      if (closestData && closestData.distance <= 30) {
        // Show tooltip
        const tooltipData = InteractionManager._formatTooltipData(closestData, chart);
        chart.state.components.tooltip?.show(
          tooltipData, 
          coords.chartX, 
          coords.chartY, 
          {
            width: chart.state.dimensions.width,
            height: chart.state.dimensions.height
          }
        );
      } else {
        // Hide tooltip but keep crosshair visible
        chart.state.components.tooltip?.hide();
      }
    };
    
    // Mouse leave handler
    const mouseLeaveHandler = (e) => {
      // Hide both crosshair and tooltip
      chart.state.components.crosshair?.hide();
      chart.state.components.tooltip?.hide();
    };
    
    // Mouse enter handler
    const mouseEnterHandler = (e) => {
      // Ensure crosshair data points are up to date
      InteractionManager._updateCrosshairDataPoints(chart);
    };
    
    // Add event listeners
    eventTarget.addEventListener('mousemove', mouseMoveHandler);
    eventTarget.addEventListener('mouseleave', mouseLeaveHandler);
    eventTarget.addEventListener('mouseenter', mouseEnterHandler);
    
    // Store handlers for cleanup
    chart.crosshairInteractionHandlers = chart.crosshairInteractionHandlers || [];
    chart.crosshairInteractionHandlers.push({
      target: eventTarget,
      type: 'mousemove',
      handler: mouseMoveHandler
    }, {
      target: eventTarget,
      type: 'mouseleave',
      handler: mouseLeaveHandler
    }, {
      target: eventTarget,
      type: 'mouseenter',
      handler: mouseEnterHandler
    });
  }

  /**
   * Handle chart data updates - refresh crosshair data points
   * @param {Chart} chart - Chart instance
   */
  static updateCrosshairData(chart) {
    if (!chart.state.components.crosshair) return;
    
    // Update data points for snapping
    InteractionManager._updateCrosshairDataPoints(chart);
    
    console.log('Crosshair data points updated');
  }

  /**
   * Handle chart resize - update crosshair dimensions
   * @param {Chart} chart - Chart instance
   */
  static resizeCrosshair(chart) {
    if (!chart.state.components.crosshair) return;
    
    const { innerWidth, innerHeight } = chart.state.dimensions;
    
    // Update crosshair dimensions
    chart.state.components.crosshair.resize(innerWidth, innerHeight);
    
    console.log('Crosshair resized to', innerWidth, 'x', innerHeight);
  }

  /**
   * Handle renderer switch - update crosshair
   * @param {Chart} chart - Chart instance
   * @param {AbstractRenderer} newRenderer - New renderer instance
   */
  static async handleCrosshairRendererSwitch(chart, newRenderer) {
    console.log('InteractionManager: Handling crosshair renderer switch');
    
    if (!chart.state.components.crosshair) return;
    
    // Update crosshair with new renderer
    await chart.state.components.crosshair.updateRenderer(newRenderer);
    
    // Re-render crosshair if needed
    InteractionManager.renderCrosshair(chart);
    
    // Update data points
    InteractionManager._updateCrosshairDataPoints(chart);
  }

  /**
   * Show crosshair at specific position
   * @param {Chart} chart - Chart instance
   * @param {number} x - X coordinate (chart-relative)
   * @param {number} y - Y coordinate (chart-relative)
   */
  static showCrosshair(chart, x, y) {
    if (!chart.state.components.crosshair) {
      console.warn('Crosshair not available');
      return;
    }
    
    chart.state.components.crosshair.show(x, y);
  }

  /**
   * Hide crosshair
   * @param {Chart} chart - Chart instance
   */
  static hideCrosshair(chart) {
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.hide();
    }
  }

  /**
   * Update crosshair position
   * @param {Chart} chart - Chart instance
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} smooth - Use smooth animation
   */
  static updateCrosshair(chart, x, y, smooth = true) {
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.update(x, y, smooth);
    }
  }

  /**
   * Get crosshair snapped data point
   * @param {Chart} chart - Chart instance
   * @returns {Object|null} Snapped point or null
   */
  static getCrosshairSnappedPoint(chart) {
    if (!chart.state.components.crosshair) return null;
    
    return chart.state.components.crosshair.getSnappedPoint();
  }

  /**
   * Toggle crosshair visibility
   * @param {Chart} chart - Chart instance
   */
  static toggleCrosshair(chart) {
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.toggle();
    }
  }

  /**
   * Clean up crosshair interactions
   * @param {Chart} chart - Chart instance
   */
  static cleanupCrosshairInteractions(chart) {
    // Remove crosshair event listeners
    if (chart.crosshairInteractionHandlers) {
      chart.crosshairInteractionHandlers.forEach(({ target, type, handler }) => {
        target?.removeEventListener(type, handler);
      });
      chart.crosshairInteractionHandlers = [];
    }
    
    // Destroy crosshair component
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.destroy();
      chart.state.components.crosshair = null;
    }
  }

  /**
   * Enhanced cleanup that handles all interaction components
   * @param {Chart} chart - Chart instance
   */
  static cleanupAllInteractions(chart) {
    // Clean up individual components
    InteractionManager.cleanupCrosshairInteractions(chart);
    InteractionManager.cleanupLegendInteractions(chart);
    InteractionManager.cleanup(chart);
    
    console.log('All interaction components cleaned up');
  }

  /**
   * Get crosshair performance metrics
   * @param {Chart} chart - Chart instance
   * @returns {Object|null} Performance metrics
   */
  static getCrosshairMetrics(chart) {
    if (!chart.state.components.crosshair) return null;
    
    return chart.state.components.crosshair.getPerformanceMetrics();
  }

  /**
   * Enhanced renderer switch handler for all interaction components
   * @param {Chart} chart - Chart instance
   * @param {AbstractRenderer} newRenderer - New renderer instance
   * @param {AbstractRenderer} oldRenderer - Old renderer instance
   */
  static async handleAllInteractionRendererSwitch(chart, newRenderer, oldRenderer) {
    console.log('InteractionManager: Handling complete interaction system renderer switch');
    
    // Handle tooltip renderer switch
    await InteractionManager.handleRendererSwitch(chart, newRenderer);
    
    // Handle legend renderer switch
    await InteractionManager.handleLegendRendererSwitch(chart, newRenderer);
    
    // Handle crosshair renderer switch
    await InteractionManager.handleCrosshairRendererSwitch(chart, newRenderer);
    
    console.log('All interaction components updated for new renderer');
  }

  /**
   * Initialize complete interaction system - enhanced for multi-renderer
   * @param {Chart} chart - Chart instance
   */
  static async initCompleteInteractionSystem(chart) {
    console.log('InteractionManager.initCompleteInteractionSystem called');
    
    // Initialize tooltip
    if (chart.options.showTooltips !== false) {
      await InteractionManager.initTooltip(chart);
    }
    
    // Initialize legend
    if (chart.options.showLegend !== false) {
      await InteractionManager.initLegend(chart);
    }
    
    // Initialize crosshair
    if (chart.options.showCrosshair !== false) {
      await InteractionManager.initCrosshair(chart);
    }
    
    // Set up coordinated event handling
    if (chart.state.components.crosshair && chart.state.components.tooltip) {
      InteractionManager._setupCrosshairCoordinatedEvents(chart);
    } else {
      // Fallback to basic single mode events
      InteractionManager._setupSingleModeEvents(chart);
    }
    
    // Render interactive components
    InteractionManager.renderCrosshair(chart);
    InteractionManager.renderLegend(chart);
    
    console.log('Complete interaction system initialized');
  }

  /**
   * Create legend items from chart datasets - enhanced
   * @param {Chart} chart - Chart instance
   * @returns {Array} Legend items array
   */
  static createLegendItems(chart) {
    if (!chart.config.datasets) return [];
    
    return chart.config.datasets.map((dataset, index) => {
      // Count studies if applicable
      let studyCount = 0;
      let studyNames = '';
      let studies = [];
      
      if (dataset.studies && Array.isArray(dataset.studies)) {
        studies = dataset.studies;
        studyCount = studies.length;
        studyNames = studies.map(study => study.name || study.type).join(', ');
      }
      
      return {
        id: dataset.id || `dataset-${index}`,
        label: dataset.name || dataset.label || `Series ${index + 1}`,
        color: dataset.color || chart.options.colors?.[index] || '#1468a8',
        visible: dataset.visible !== false,
        type: InteractionManager._determineLegendSymbolType(dataset, chart),
        studyCount: studyCount,
        studyNames: studyNames,
        studies: studies,
        dataset: dataset, // Reference to original dataset
        index: index
      };
    });
  }

  /**
   * Determine legend symbol type based on dataset and chart type
   * @private
   */
  static _determineLegendSymbolType(dataset, chart) {
    // Check dataset-specific type first
    if (dataset.type) {
      return dataset.type === 'line' ? 'line' : 'rect';
    }
    
    // Check chart type
    if (chart.options.chartType === 'line') {
      return 'line';
    } else if (chart.options.chartType === 'bar') {
      return 'rect';
    }
    
    // Default fallback
    return 'rect';
  }

  /**
   * Initialize legend component with datasets - enhanced for multi-renderer
   * @param {Chart} chart - Chart instance
   */
  static async initLegend(chart) {
    if (!chart.options.showLegend || !chart.config.datasets) {
      console.log('Legend disabled or no datasets available');
      return;
    }
    
    // Create legend component if it doesn't exist
    if (!chart.state.components.legend) {
      chart.state.components.legend = new Legend({
        position: chart.options.legend?.position || 'bottom',
        align: chart.options.legend?.align || 'center',
        orientation: chart.options.legend?.orientation || 'horizontal',
        
        // Styling from chart options
        fontSize: chart.options.legend?.fontSize || 12,
        fontFamily: chart.options.fontFamily || 'sans-serif',
        textColor: chart.options.textColor || '#333333',
        
        // Interactivity
        interactive: chart.options.legend?.interactive !== false,
        clickToToggle: chart.options.legend?.clickToToggle !== false,
        
        // Studies
        showStudyBadges: chart.options.legend?.showStudyBadges !== false,
        showStudyTooltips: chart.options.legend?.showStudyTooltips !== false,
        
        // Layout
        wrapText: chart.options.legend?.wrapText !== false,
        maxWidth: chart.options.legend?.maxWidth,
        
        // Renderer preference
        preferHTMLOverlay: chart.options.legend?.preferHTMLOverlay
      });
    }
    
    // Initialize legend with current renderer
    if (chart.renderer) {
      await chart.state.components.legend.initialize(chart.renderer, chart.state.container);
    }
    
    // Create legend items from datasets
    const legendItems = InteractionManager.createLegendItems(chart);
    chart.state.components.legend.setItems(legendItems);
    
    // Set up interactions
    await InteractionManager.initLegendInteractions(chart);
    
    console.log(`Legend initialized with ${legendItems.length} items`);
  }

  /**
   * Update legend when datasets change
   * @param {Chart} chart - Chart instance
   */
  static updateLegend(chart) {
    if (!chart.state.components.legend) return;
    
    // Update legend items
    const legendItems = InteractionManager.createLegendItems(chart);
    chart.state.components.legend.setItems(legendItems);
    
    console.log(`Legend updated with ${legendItems.length} items`);
  }

  /**
   * Render legend within chart dimensions
   * @param {Chart} chart - Chart instance
   */
  static renderLegend(chart) {
    if (!chart.state.components.legend || !chart.state.components.legend.isInitialized) {
      console.log('Legend not available for rendering');
      return;
    }
    
    const { width, height } = chart.state.dimensions;
    const margins = chart.options.margins;
    
    // Render legend
    const legendId = chart.state.components.legend.render(width, height, {
      translateX: margins.left,
      translateY: margins.top
    });
    
    console.log(`Legend rendered with ID: ${legendId}`);
    
    return legendId;
  }

  /**
   * Handle renderer switch - update legend
   * @param {Chart} chart - Chart instance
   * @param {AbstractRenderer} newRenderer - New renderer instance
   */
  static async handleLegendRendererSwitch(chart, newRenderer) {
    console.log('InteractionManager: Handling legend renderer switch');
    
    if (!chart.state.components.legend) return;
    
    // Re-initialize legend with new renderer
    await chart.state.components.legend.initialize(newRenderer, chart.state.container);
    
    // Re-render legend
    InteractionManager.renderLegend(chart);
  }

  /**
   * Clean up legend interactions
   * @param {Chart} chart - Chart instance
   */
  static cleanupLegendInteractions(chart) {
    // Remove legend event listeners
    if (chart.legendInteractionHandlers) {
      chart.legendInteractionHandlers.forEach(({ target, type, handler }) => {
        target?.removeEventListener(type, handler);
      });
      chart.legendInteractionHandlers = [];
    }
    
    // Destroy legend component
    if (chart.state.components.legend) {
      chart.state.components.legend.destroy();
      chart.state.components.legend = null;
    }
    
    // Clear highlight state
    if (chart.datasetHighlightState) {
      chart.datasetHighlightState.clear();
    }
  }

  /**
   * Enhanced single mode initialization with legend support
   * @param {Chart} chart - Chart instance
   */
  static async initSingleModeWithLegend(chart) {
    console.log('InteractionManager.initSingleModeWithLegend called');
    
    // Initialize base interactions (tooltip, crosshair)
    await InteractionManager.initSingleMode(chart);
    
    // Initialize legend
    await InteractionManager.initLegend(chart);
  }

  /**
   * Check if point is within legend bounds (for Canvas/WebGL hit testing)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Chart} chart - Chart instance
   * @returns {Object|null} Hit test result
   */
  static checkLegendHit(x, y, chart) {
    if (!chart.state.components.legend || chart.state.components.legend.renderMode !== 'canvas-overlay') {
      return null;
    }
    
    // Check hit areas stored by legend
    const hitAreas = chart.state.components.legend.hitAreas || [];
    
    return hitAreas.find(area => 
      x >= area.x && x <= area.x + area.width &&
      y >= area.y && y <= area.y + area.height
    ) || null;
  }

  /**
   * Get legend performance metrics
   * @param {Chart} chart - Chart instance
   * @returns {Object|null} Performance metrics
   */
  static getLegendMetrics(chart) {
    if (!chart.state.components.legend) return null;
    
    return chart.state.components.legend.getPerformanceMetrics();
  }

  /**
   * Get appropriate event target based on renderer type
   * @private
   */
  static _getEventTarget(chart) {
    switch (chart.renderer?.type) {
      case 'svg':
        return chart.state.svg;
      case 'canvas':
        return chart.renderer.canvas;
      case 'webgl':
        return chart.renderer.canvas;
      default:
        // Fallback to container
        return chart.state.container;
    }
  }

  /**
   * Get event coordinates relative to chart - enhanced for all renderer types
   * @private
   */
  static _getEventCoordinates(event, chart) {
    const eventTarget = InteractionManager._getEventTarget(chart);
    const rect = eventTarget.getBoundingClientRect();
    
    // Base coordinates relative to event target
    const baseX = event.clientX - rect.left;
    const baseY = event.clientY - rect.top;
    
    // Account for high DPI scaling in Canvas/WebGL
    let x = baseX;
    let y = baseY;
    
    if (chart.renderer?.type === 'canvas' || chart.renderer?.type === 'webgl') {
      const devicePixelRatio = chart.renderer.pixelRatio || 1;
      // Canvas coordinates are already scaled, so we need to unscale for chart coordinates
      x = baseX;
      y = baseY;
    }
    
    // Convert to chart area coordinates (accounting for margins)
    const chartX = x - chart.options.margins.left;
    const chartY = y - chart.options.margins.top;
    
    return {
      x: baseX,        // Event target relative
      y: baseY,        // Event target relative
      chartX: chartX,  // Chart area relative
      chartY: chartY   // Chart area relative
    };
  }

  /**
   * Format single tooltip line
   * @private
   */
  static _formatSingleTooltipLine(item, index, chart) {
    if (!item || !item.point) return null;
    
    const dataset = item.dataset;
    const point = item.point;
    
    // Get dataset name with color indicator
    const datasetName = dataset?.name || dataset?.label || `Series ${index + 1}`;
    const color = dataset?.color || '#1468a8';
    
    // Format value
    let value = point.y !== undefined ? point.y : point.value;
    if (value === undefined && point[chart.options.yField]) {
      value = point[chart.options.yField];
    }
    
    const formattedValue = InteractionManager._formatTooltipValue(value, chart);
    
    // Create line with color indicator (for HTML tooltips)
    const colorIndicator = chart.state.components.tooltip?.renderMode === 'html-overlay' 
      ? `<span style="color: ${color};">●</span> ` 
      : '● ';
    
    return `${colorIndicator}${datasetName}: ${formattedValue}`;
  }

  /**
   * Format tooltip value with chart-specific formatting
   * @private
   */
  static _formatTooltipValue(value, chart) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value !== 'number') return String(value);
    
    // Use chart's formatting if available
    if (chart.options.yTickFormat && typeof chart.options.yTickFormat === 'function') {
      return chart.options.yTickFormat(value);
    }
    
    // Apply format based on type
    switch (chart.options.yType) {
      case 'percent':
        return (value * 100).toFixed(1) + '%';
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      default:
        return InteractionManager._formatNumber(value);
    }
  }

  /**
   * Format numbers with appropriate precision and units
   * @private
   */
  static _formatNumber(value) {
    if (Math.abs(value) >= 1000000000) {
      return (value / 1000000000).toFixed(1) + 'B';
    } else if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (Math.abs(value) < 1 && value !== 0) {
      return value.toPrecision(3);
    } else {
      return value.toFixed(value % 1 === 0 ? 0 : 2);
    }
  }

  /**
   * Format tooltip data structure
   * @private
   */
  static _formatTooltipData(closestData, chart) {
    // Convert closest data point to tooltip data format
    return [{
      dataset: closestData.dataset,
      point: closestData.point
    }];
  }

  /**
   * Find closest data point to coordinates - enhanced for performance
   * @private
   */
  static _findClosestDataPoint(x, y, chart) {
    let minDistance = Infinity;
    let closestData = null;
    
    // Search through all datasets
    chart.config.datasets?.forEach(dataset => {
      if (!dataset.data || !dataset.data.length) return;
      
      dataset.data.forEach(point => {
        if (!point || point[chart.options.xField] === undefined || point[chart.options.yField] === undefined) {
          return;
        }
        
        // Convert data point to screen coordinates
        const screenX = chart.state.scales.x?.scale(point[chart.options.xField]);
        const screenY = chart.state.scales.y?.scale(point[chart.options.yField]);
        
        if (screenX === undefined || screenY === undefined) return;
        
        // Calculate distance
        const distance = Math.sqrt(Math.pow(x - screenX, 2) + Math.pow(y - screenY, 2));
        
        if (distance < minDistance) {
          minDistance = distance;
          closestData = {
            dataset: dataset,
            point: point,
            distance: distance,
            screenX: screenX,
            screenY: screenY
          };
        }
      });
    });
    
    return closestData;
  }

  /**
   * Create tooltip formatter for chart - enhanced with better formatting
   * @param {Chart} chart - Chart instance
   * @returns {Function} Tooltip formatter function
   */
  static createTooltipFormatter(chart) {
    return (data) => {
      try {
        if (!data) return ['No data'];
        
        const lines = [];
        
        // Handle multiple datasets
        if (Array.isArray(data)) {
          // Add date/time header if available
          if (data.length > 0 && chart.options.xType === 'time') {
            const firstPoint = data[0].point;
            if (firstPoint && firstPoint.x) {
              const date = firstPoint.x instanceof Date ? firstPoint.x : new Date(firstPoint.x);
              lines.push(`📅 ${date.toLocaleDateString()}`);
              lines.push(''); // Empty line for spacing
            }
          }
          
          // Add data for each dataset
          data.forEach((item, index) => {
            const line = InteractionManager._formatSingleTooltipLine(item, index, chart);
            if (line) lines.push(line);
          });
        } else {
          // Single dataset
          const line = InteractionManager._formatSingleTooltipLine(data, 0, chart);
          if (line) lines.push(line);
        }
        
        return lines.length > 0 ? lines : ['No data available'];
        
      } catch (error) {
        console.error('Tooltip formatter error:', error);
        return ['Error formatting data'];
      }
    };
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
   * Update hover points for ALL datasets in single mode
   * @param {Chart} chart - Chart instance
   * @param {number} mouseX - Mouse X position (relative to chart area)
   */
  static updateSingleModeHoverPoints(chart, mouseX) {
    console.log('updateSingleModeHoverPoints called with mouseX:', mouseX);
    
    // Skip if no hover points
    if (!chart.state.components.hoverPoints) {
      console.log('No hover points available');
      return;
    }
    
    console.log('Hover points available:', chart.state.components.hoverPoints.length);
    
    // Show hover points group
    if (chart.state.components.hoverPointsGroup) {
      chart.state.components.hoverPointsGroup.style.display = 'block';
      console.log('Hover points group made visible');
    }
    
    // Use the correct scales
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    if (!xScale || !yScale) {
      console.warn('Scales not available for hover points');
      return;
    }
    
    console.log('Scales available, processing hover points...');
    
    // Update each hover point
    chart.state.components.hoverPoints.forEach((hoverPoint, index) => {
      const dataset = hoverPoint.dataset;
      console.log(`Processing hover point ${index} for dataset:`, dataset.id);
      
      if (!dataset.data || !dataset.data.length) {
        console.log(`Dataset ${dataset.id} has no data`);
        hoverPoint.element.style.display = 'none';
        return;
      }
      
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
      
      console.log(`Dataset ${dataset.id} closest point:`, { closestPoint, minDistance });
      
      // Show hover point if close enough
      if (closestPoint && minDistance < 50) {
        const x = xScale.scale(closestPoint[xField]);
        const y = yScale.scale(closestPoint[yField]);
        
        hoverPoint.element.setAttribute('cx', x);
        hoverPoint.element.setAttribute('cy', y);
        hoverPoint.element.style.display = 'block';
        hoverPoint.data = closestPoint;
        
        console.log(`Hover point ${index} positioned at:`, { x, y });
      } else {
        hoverPoint.element.style.display = 'none';
        hoverPoint.data = null;
        console.log(`Hover point ${index} hidden (too far or no data)`);
      }
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
    
    /**
     * SIMPLE FIX: Updated mouse move handler that bypasses formatter issues
     */
    const mouseMoveHandler = (e) => {
      // Get mouse position relative to the SVG
      const svgRect = chart.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left - chart.options.margins.left;
      const mouseY = e.clientY - svgRect.top - chart.options.margins.top;
      
      // Check if within chart bounds
      if (mouseX < 0 || mouseX > chart.state.dimensions.innerWidth || 
          mouseY < 0 || mouseY > chart.state.dimensions.innerHeight) {
        InteractionManager.hideSingleModeElements(chart);
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
        return;
      }
      
      // Show crosshair
      if (chart.options.chartType === 'line' || chart.options.chartType === 'area') {
        if (chart.state.components.crosshair) {
          chart.state.components.crosshair.update(mouseX, 0);
          chart.state.components.crosshair.show();
        }
      }
      
      // Update hover points
      InteractionManager.updateSingleModeHoverPoints(chart, mouseX);
      
      // Find data for ALL datasets
      const allData = InteractionManager.findAllDataAtPosition(chart, mouseX);
      
      if (allData && chart.state.components.tooltip) {
        console.log('🎯 SIMPLE TOOLTIP FIX - Found data for', allData.datasets.length, 'datasets');
        
        // COMPLETE: Multi-dataset tooltip formatter
        chart.state.components.tooltip.options.formatter = (data) => {
          console.log('🎯 Multi-dataset formatter called with:', data);
          
          try {
            const lines = [];
            
            // Check if we have the expected data structure
            if (!data || !data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
              console.log('❌ Invalid data structure');
              return ['No data available'];
            }
            
            console.log('✅ Processing', data.datasets.length, 'datasets');
            
            // Add date header from first dataset
            const firstPoint = data.datasets[0].point;
            if (firstPoint) {
              const date = firstPoint.date || firstPoint.x;
              if (date) {
                try {
                  const dateObj = date instanceof Date ? date : new Date(date);
                  const dateStr = dateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  lines.push(`Date: ${dateStr}`);
                  lines.push(''); // Empty line for spacing
                  console.log('✅ Added date header:', dateStr);
                } catch (dateError) {
                  console.log('⚠️ Date formatting error, using raw value');
                  lines.push(`Date: ${String(date)}`);
                  lines.push('');
                }
              }
            }
            
            // Add each dataset's value
            data.datasets.forEach((dataInfo, index) => {
              const point = dataInfo.point;
              const dataset = dataInfo.dataset;
              
              if (!point || !dataset) {
                console.log(`⚠️ Skipping dataset ${index} - missing point or dataset info`);
                return;
              }
              
              // Get the value - try multiple field names
              const value = point.price || point.y || point.value || 0;
              
              // Format the value nicely
              let formattedValue;
              if (typeof value === 'number') {
                // Format numbers with commas and appropriate decimal places
                if (value >= 1000) {
                  formattedValue = value.toLocaleString('en-US', { 
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0
                  });
                } else {
                  formattedValue = value.toLocaleString('en-US', { 
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0
                  });
                }
              } else {
                formattedValue = String(value);
              }
              
              // Create the line with dataset name and formatted value
              const datasetName = dataset.name || `Series ${index + 1}`;
              const line = `${datasetName}: ${formattedValue}`;
              lines.push(line);
              
              console.log(`✅ Added dataset ${index}: ${line}`);
            });
            
            console.log('🎯 Final tooltip lines:', lines);
            return lines;
            
          } catch (error) {
            console.error('❌ Formatter error:', error);
            return ['Formatting error occurred'];
          }
        };
        
        // Position tooltip
        const tooltipX = mouseX + chart.options.margins.left;
        const tooltipY = mouseY + chart.options.margins.top;
        
        console.log('🎯 Calling tooltip.show() with corrected formatter...');
        
        try {
          // Call show with our data
          chart.state.components.tooltip.show(allData, tooltipX, tooltipY, {
            width: chart.state.dimensions.width,
            height: chart.state.dimensions.height
          });
          
          console.log('🎯 tooltip.show() completed');
          
        } catch (error) {
          console.error('🎯 Error in tooltip.show():', error);
        }
      } else {
        console.log('No data found or no tooltip component');
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
      }
    };
    
    // Mouse leave handler
    const mouseLeaveHandler = (e) => {
      console.log('Mouse leave event');
      const svgRect = chart.state.svg.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;
      
      if (mouseX < 0 || mouseX > chart.state.dimensions.width || 
          mouseY < 0 || mouseY > chart.state.dimensions.height) {
        console.log('Mouse fully outside SVG, hiding elements');
        InteractionManager.hideSingleModeElements(chart);
        if (chart.state.components.tooltip) {
          chart.state.components.tooltip.hide();
        }
      }
    };
    
    // Bind events
    eventTarget.addEventListener('mousemove', mouseMoveHandler);
    eventTarget.addEventListener('mouseleave', mouseLeaveHandler);
    
    // Store handlers for cleanup
    chart.state.eventHandlers = chart.state.eventHandlers || {};
    chart.state.eventHandlers.hover = {
      target: eventTarget,
      move: mouseMoveHandler,
      leave: mouseLeaveHandler
    };
    
    console.log('Single mode events bound successfully');
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
   * Find data for ALL datasets at the current X position
   * @param {Chart} chart - Chart instance
   * @param {number} mouseX - Mouse X position
   * @returns {Object|null} All dataset data at position
   */
  static findAllDataAtPosition(chart, mouseX) {
    console.log('findAllDataAtPosition called with mouseX:', mouseX);
    
    if (!chart.state.datasets || !chart.state.datasets.length) {
      console.log('No datasets available');
      return null;
    }
    
    const { xField, yField } = chart.options;
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    if (!xScale || !yScale) {
      console.log('No scales available');
      return null;
    }
    
    // Find the closest X value across all data points
    let globalClosestX = null;
    let minGlobalDistance = Infinity;
    
    console.log('First pass: finding closest X coordinate...');
    
    // First pass: find the closest X coordinate across ALL datasets (including studies)
    chart.state.datasets.forEach((dataset, index) => {
      // FIXED: Include studies - only filter out datasets with no data
      if (!dataset.data || !dataset.data.length) {
        console.log(`Dataset ${index} skipped: no data`);
        return;
      }
      
      console.log(`Checking dataset ${index} (${dataset.id}) type: ${dataset.type || 'regular'} with ${dataset.data.length} points`);
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined) return;
        
        const pointX = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - pointX);
        
        if (distance < minGlobalDistance) {
          minGlobalDistance = distance;
          globalClosestX = point[xField];
        }
      });
    });
    
    console.log('Global closest X found:', { globalClosestX, minGlobalDistance });
    
    // Only proceed if we found a reasonable match
    const threshold = chart.options.chartType === 'line' ? 50 : 25;
    if (minGlobalDistance > threshold) {
      console.log('Distance too far, threshold:', threshold);
      return null;
    }
    
    // Second pass: collect data from ALL datasets at this X value (including studies)
    const allDatasets = [];
    const tolerance = minGlobalDistance + 1;
    
    console.log('Second pass: collecting data from all datasets including studies...');
    
    chart.state.datasets.forEach((dataset, index) => {
      // FIXED: Include studies - only filter out datasets with no data
      if (!dataset.data || !dataset.data.length) return;
      
      console.log(`Processing dataset ${index} (${dataset.id}) type: ${dataset.type || 'regular'}`);
      
      // Find the data point in this dataset closest to our target X
      let closestPointInDataset = null;
      let minDistanceInDataset = Infinity;
      
      dataset.data.forEach(point => {
        if (point[xField] === undefined || point[yField] === undefined) return;
        
        const pointX = xScale.scale(point[xField]);
        const distance = Math.abs(mouseX - pointX);
        
        if (distance < minDistanceInDataset && distance <= tolerance) {
          minDistanceInDataset = distance;
          closestPointInDataset = point;
        }
      });
      
      // If we found a point in this dataset, add it to our results
      if (closestPointInDataset) {
        const dataInfo = {
          dataset: dataset,
          point: closestPointInDataset,
          x: xScale.scale(closestPointInDataset[xField]),
          y: yScale.scale(closestPointInDataset[yField]),
          distance: minDistanceInDataset
        };
        
        allDatasets.push(dataInfo);
        console.log(`Added data for dataset ${dataset.id} (${dataset.type || 'regular'}):`, {
          name: dataset.name,
          type: dataset.type,
          value: closestPointInDataset[yField],
          distance: minDistanceInDataset
        });
      } else {
        console.log(`No matching point found for dataset ${dataset.id}`);
      }
    });
    
    console.log('Total datasets with data (including studies):', allDatasets.length);
    
    // Return all datasets if we found any, otherwise null
    return allDatasets.length > 0 ? {
      datasets: allDatasets,
      globalX: globalClosestX,
      globalDistance: minGlobalDistance
    } : null;
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
   * Format tooltip content for multiple datasets
   * @param {Chart} chart - Chart instance
   * @param {Object} allData - All dataset information at position
   * @returns {Array} Formatted text lines
   */
  static formatMultiDatasetTooltip(chart, allData) {
    console.log('formatMultiDatasetTooltip called with:', allData);
    
    if (!allData || !allData.datasets || !allData.datasets.length) {
      console.log('No data to format');
      return '';
    }
    
    const { xField, yField, xType, yType } = chart.options;
    const lines = [];
    
    // Format the X value (same for all datasets)
    const firstPoint = allData.datasets[0].point;
    let xLabel = '';
    const xValue = firstPoint[xField];
    
    if (xType === 'time') {
      const date = xValue instanceof Date ? xValue : new Date(xValue);
      xLabel = formatDateValue(date, 'MMM dd, yyyy');
    } else {
      xLabel = typeof xValue === 'number' ? formatLargeNumber(xValue) : xValue;
    }
    
    console.log('Formatted X label:', xLabel);
    
    // Add date/time header
    lines.push(`Date: ${xLabel}`);
    lines.push(''); // Empty line for spacing
    
    // Add each dataset's value
    allData.datasets.forEach((dataInfo, index) => {
      const point = dataInfo.point;
      const dataset = dataInfo.dataset;
      
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
      
      const line = `${dataset.name || 'Series'}: ${yLabel}`;
      lines.push(line);
      console.log(`Added line ${index}:`, line);
    });
    
    console.log('Final tooltip lines:', lines);
    return lines;
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
   * Clean up interaction handlers
   * @param {Chart} chart - Chart instance
   */
  static cleanup(chart) {
    // Remove event listeners
    if (chart.interactionHandlers) {
      chart.interactionHandlers.forEach(({ target, type, handler }) => {
        target?.removeEventListener(type, handler);
      });
      chart.interactionHandlers = [];
    }
    
    // Destroy tooltip
    if (chart.state.components.tooltip) {
      chart.state.components.tooltip.destroy();
      chart.state.components.tooltip = null;
    }
    
    // Destroy crosshair
    if (chart.state.components.crosshair) {
      chart.state.components.crosshair.destroy();
      chart.state.components.crosshair = null;
    }
  }

  /**
   * Handle renderer switch - update interaction components
   * @param {Chart} chart - Chart instance
   * @param {AbstractRenderer} newRenderer - New renderer instance
   */
  static async handleRendererSwitch(chart, newRenderer) {
    console.log('InteractionManager: Handling renderer switch');
    
    // Clean up existing interactions
    InteractionManager.cleanup(chart);
    
    // Re-initialize with new renderer
    await InteractionManager.initSingleMode(chart);
  }
}
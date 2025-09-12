/**
 * PanelManager.js - Centralized Panel Mode Management
 * 
 * Handles all panel mode lifecycle operations including:
 * - Panel mode toggling
 * - Panel creation/destruction
 * - Shared axis management
 * - Container management
 * - State persistence
 * 
 * ✅ FIXED: Complete panel toggle functionality with debugging
 * ✅ NEW: Fixed-axis positioning for consistent layout
 */

import { Panel } from './Panel.js';
import { Axis } from '../core/Axis.js';
import { createScale } from '../core/Scale.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { EndingLabels } from './EndingLabels.js';
import { Legend } from './Legend.js';
import { Crosshair } from './Crosshair.js';
import { CrosshairTooltip } from './CrosshairTooltip.js';
import { RecessionLines } from './RecessionLines.js';

export class PanelManager {
  constructor(chart) {
    this.chart = chart;
    
    this.PANEL_AREA_PERCENTAGE = 0.85;
    this.AXIS_AREA_PERCENTAGE = 0.15;
    
    // Panel state
    this.isPanelMode = false;
    this.panels = [];
    this.panelContainer = null;
    this.panelSvgOverlay = null;
    
    // Shared axis components
    this.sharedXScale = null;
    this.sharedXAxis = null;
    this.sharedAxisHeight = 0; // Still used for internal calculations
    
    // Ending labels management
    this.endingLabels = null;

    // Legend component
    this.legend = null;

    // Crosshair and Tooltip
    this.crosshair = null;
    this.tooltip = null;

    // Recession Lines
    this.recessionLines = null;

    // Single mode state backup
    this.originalSingleModeState = null;
    
    console.log('PanelManager created with 10% axis area, 90% panel area');
  }

  /**
   * ✅ FIXED: Toggle between single chart and panel mode
   */
  async togglePanelMode(force = null) {
    const newPanelMode = force !== null ? force : !this.isPanelMode;
    
    if (newPanelMode === this.isPanelMode) {
      console.log(`Already in ${newPanelMode ? 'panel' : 'single'} mode`);
      return newPanelMode;
    }
    
    console.log(`Switching to ${newPanelMode ? 'panel' : 'single'} mode`);
    
    try {
      if (newPanelMode) {
        await this._switchToPanelMode();
        this.isPanelMode = true;
      } else {
        // ✅ FIXED: Don't set state here, let _switchToSingleMode handle it
        await this._switchToSingleMode();
      }
      
      console.log(`Successfully switched to ${this.isPanelMode ? 'panel' : 'single'} mode`);
      console.log(`Chart isPanelMode: ${this.chart.isPanelMode}`);
      return this.isPanelMode;
      
    } catch (error) {
      console.error('Error toggling panel mode:', error);
      // Reset state on error
      this.isPanelMode = !newPanelMode;
      throw error;
    }
  }

  /**
   * Get current panel mode state
   */
  getState() {
    return {
      isPanelMode: this.isPanelMode,
      panelCount: this.panels.length,
      hasSharedAxis: !!this.sharedXAxis,
      containerExists: !!this.panelContainer,
      axisAreaPercentage: this.AXIS_AREA_PERCENTAGE,
      panelAreaPercentage: this.PANEL_AREA_PERCENTAGE
    };
  }

  /**
 * ✅ FIXED: Refresh panel mode after dataset changes with proper cleanup and recreation
 */
async refreshPanelMode() {
  if (!this.isPanelMode) return;
  
  try {
    console.log('Refreshing panel mode with updated datasets');
    console.log(`Current dataset count: ${this.chart.config.data.length}`);
    const previousEndingLabelsState = this.panels.length > 0 ? 
    this.panels[0].getEndingLabelsState()?.isVisible : false;
    
    // Clean up the old crosshair and listeners before rebuilding
    this._destroyCrosshairAndTooltip();
    
    // ✅ CRITICAL: Completely destroy and recreate panel infrastructure
    this._destroyPanels();
    
    // ✅ CRITICAL: Also destroy and recreate the panel container and SVG overlay
    this._destroyPanelContainer();
    
    // ✅ CRITICAL: Ensure we have valid datasets before proceeding
    if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
      console.warn('No datasets available for panel mode refresh');
      return;
    }
    
    // Process data first
    await this.chart._processData();
    
    // Recreate shared X scale with all datasets
    this._createSharedXScale();
    
    // ✅ CRITICAL: Recreate shared X axis
    this._createSharedXAxis();
    
    // ✅ CRITICAL: Recreate panel container and SVG overlay
    this._createPanelContainer();

    this._renderPanelModeTitle();

    if (previousEndingLabelsState) {
      this.toggleEndingLabels(true);
    }
    
    // ✅ CRITICAL: Recreate panels with fresh percentage calculations
    await this._createPanels();
    
    // Re-render all panels
    await this._renderPanels();

    // Re-initialize the crosshair and tooltip
    this._setupCrosshairAndTooltip();
    
    console.log(`Panel mode refreshed successfully with ${this.panels.length} panels`);
    
  } catch (error) {
    console.error('Error refreshing panel mode:', error);
    throw error;
  }
}

  /**
 * UPDATED: Ensure legend state is preserved during mode switches
 * Update the existing _switchToPanelMode method
 */
async _switchToPanelMode() {
  // Validate we have multiple datasets
  if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length <= 1) {
    throw new Error('Panel mode requires multiple datasets');
  }
  
  // Validate container size
  if (!this._validateContainerForPanelMode()) {
    console.warn('Container size validation failed, but proceeding with panel mode');
  }
  
  console.log(`Creating panel mode with ${this.chart.config.data.length} panels and shared X axis`);
  
  // ✅ NEW: Store single mode legend state
  const singleModeLegendState = this.chart.legend && this.chart.legend.element
    ? this.chart.legend.element.style.display !== 'none'
    : true; // Default to visible
  
  // Store current single mode state
  this._storeSingleModeState();
  
  // Destroy current single chart components
  this._destroySingleModeComponents();
  
  // Create shared X scale
  this._createSharedXScale();
  
  // Create shared X axis
  this._createSharedXAxis();
  
  // Create panel container
  this._createPanelContainer();

  this._renderPanelModeTitle();
  
  // ✅ NEW: Create legend with preserved state
  this._createLegend();
  
  // Create individual panels
  await this._createPanels();
  
  // Render all panels and shared axis
  await this._renderPanels();
  
  // ✅ NEW: Apply preserved legend state
  if (this.legend) {
    this.toggleLegend(singleModeLegendState);
  }
  
  this._setupCrosshairAndTooltip();
  
  console.log('Panel mode activated successfully');
  console.log(`Legend state preserved: ${singleModeLegendState}`);
}

  /**
   * ✅ FIXED: Switch to single mode with proper container restoration
   * @private
   */
  async _switchToSingleMode() {
    console.log('Switching back to single chart mode');

    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
      console.log('  ✓ Panel EndingLabels cleaned up');
    }
    
    // CRITICAL: Set state at the beginning
    this.isPanelMode = false;
    
    // Destroy all panels
    this._destroyPanels();
    
    // ✅ CRITICAL: Properly restore container for single chart
    this._restoreContainerForSingleMode();
    
    // Restore single mode state
    this._restoreSingleModeState();
    
    // Reinitialize single chart
    await this._reinitializeSingleChart();
    
    console.log('Single chart mode restored successfully');
  }

  /**
   * ✅ NEW: Properly restore container for single chart mode
   * @private
   */
  _restoreContainerForSingleMode() {
    console.log('Restoring container for single chart mode...');
    
    // Remove panel container if it exists
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
      console.log('  ✓ Panel container removed');
    }
    
    // ✅ CRITICAL: Clear container completely to ensure clean state
    const childCount = this.chart.container.children.length;
    while (this.chart.container.firstChild) {
      this.chart.container.removeChild(this.chart.container.firstChild);
    }
    console.log(`  ✓ Cleared ${childCount} children from container`);
    
    // ✅ CRITICAL: Restore container styling for single chart
    this.chart.container.style.position = 'relative';
    this.chart.container.style.width = '100%';
    this.chart.container.style.height = '100%';
    
    console.log('  ✓ Container styling restored');
    console.log('Container restored for single chart mode');
  }

  /**
   * ✅ IMPROVED: Validate container size for panel mode with percentage-based axis
   * @private
   */
  _validateContainerForPanelMode() {
    const containerHeight = this.chart.container.offsetHeight;
    const containerWidth = this.chart.container.offsetWidth;
    const datasetCount = this.chart.config.data.length;
    
    // Calculate areas using percentages
    const axisAreaHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
    const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
    const panelHeight = Math.floor(panelAreaHeight / datasetCount);
    
    // Check minimum panel height
    const minPanelHeight = 60; // Minimum viable panel height
    
    if (panelHeight < minPanelHeight) {
      console.warn(`Panel height ${panelHeight}px too small for ${datasetCount} panels. Minimum needed: ${minPanelHeight}px per panel`);
      return false;
    }
    
    if (containerWidth < 300) {
      console.warn(`Container width ${containerWidth}px may be too small for readable axis labels`);
    }
    
    // Log the percentage-based space allocation
    console.log(`✅ Container validation passed (percentage-based):`);
    console.log(`  - Container height: ${containerHeight}px`);
    console.log(`  - Axis area (${this.AXIS_AREA_PERCENTAGE * 100}%): ${axisAreaHeight}px`);
    console.log(`  - Panel area (${this.PANEL_AREA_PERCENTAGE * 100}%): ${panelAreaHeight}px`);
    console.log(`  - Panel height (${datasetCount} panels): ${panelHeight}px each (${(panelHeight/containerHeight*100).toFixed(1)}% each)`);
    
    return true;
  }

  /**
   * Store single mode state for restoration
   * @private
   */
  _storeSingleModeState() {
    this.originalSingleModeState = {
      rendererInstance: this.chart.rendererInstance,
      canvas: this.chart.canvas,
      svgOverlay: this.chart.svgOverlay,
      scales: { ...this.chart.scales },
      axes: { ...this.chart.axes },
      chartArea: { ...this.chart.chartArea },
      generatedPaths: this.chart.generatedPaths ? [...this.chart.generatedPaths] : null,
      transformedData: this.chart.transformedData ? [...this.chart.transformedData] : null
    };
  }

  /**
   * Restore single mode state
   * @private
   */
  _restoreSingleModeState() {
    console.log('Restoring single mode state...');
    
    if (!this.originalSingleModeState) {
      console.warn('  ⚠ No stored single mode state to restore');
      return;
    }
    
    // Note: We don't restore the actual instances since they were destroyed
    // Instead, we'll reinitialize them in _reinitializeSingleChart
    this.originalSingleModeState = null;
    console.log('  ✓ Single mode state cleared');
  }

  /**
   * Destroy single mode components
   * @private
   */
  _destroySingleModeComponents() {
    // Destroy renderer
    if (this.chart.rendererInstance) {
      this.chart.rendererInstance.destroy();
      this.chart.rendererInstance = null;
    }
    
    // Remove canvas
    if (this.chart.canvas && this.chart.canvas.parentNode) {
      this.chart.canvas.parentNode.removeChild(this.chart.canvas);
      this.chart.canvas = null;
    }
    
    // Remove SVG overlay
    if (this.chart.svgOverlay && this.chart.svgOverlay.parentNode) {
      this.chart.svgOverlay.parentNode.removeChild(this.chart.svgOverlay);
      this.chart.svgOverlay = null;
    }
    
    // Clear scales and axes
    this.chart.scales = { x: null, y: null };
    this.chart.axes = { x: null, y: null };
    this.chart.generatedPaths = null;
    this.chart.transformedData = null;
  }

  /**
 * Create shared X scale for all panels - FIXED range calculation
 * @private
 */
_createSharedXScale() {
  // Calculate combined X domain from all datasets
  let xMin = Infinity;
  let xMax = -Infinity;
  
  for (const dataset of this.chart.config.data) {
    if (!dataset.data || !Array.isArray(dataset.data)) continue;
    
    for (const point of dataset.data) {
      if (point.x != null) {
        const xValue = point.x instanceof Date ? point.x.getTime() : point.x;
        xMin = Math.min(xMin, xValue);
        xMax = Math.max(xMax, xValue);
      }
    }
  }
  
  if (xMin === Infinity || xMax === -Infinity) {
    throw new Error('No valid X values found in datasets');
  }
  
  const chartMargin = this.chart.config.options.margin;
  const panelLeftPadding = chartMargin.left;
  const panelRightPadding = chartMargin.right;
  
  // Calculate available width for chart area
  const containerWidth = this.chart.container.offsetWidth;
  const chartAreaWidth = containerWidth - panelLeftPadding - panelRightPadding;
  
  // Create shared X scale with correct range
  const xDomain = [xMin, xMax];
  const yAxisPadding = 20;
  const xRange = [panelLeftPadding - yAxisPadding, panelLeftPadding + chartAreaWidth];

  const scaleType = this.chart.config.options.xType === 'time' ? 'time' : 'linear';
  this.sharedXScale = createScale(scaleType, xDomain, xRange);
  
  console.log(`✅ FIXED shared X scale created:`, {
    scaleType: scaleType,
    domain: xDomain,
    range: xRange,
    containerWidth: containerWidth,
    chartAreaWidth: chartAreaWidth,
    calculatedMaxX: this.sharedXScale.scale(xMax) // Should now be around 1138
  });
}

  /**
   * Create shared X axis
   * @private
   */
  _createSharedXAxis() {
    if (!this.sharedXScale) {
      throw new Error('Shared X scale must be created before axis');
    }
    
    // Use the static factory method which ensures correct configuration
    this.sharedXAxis = Axis.createSharedXAxis({
      scale: this.sharedXScale,
      options: {
        label: this.chart.config.options.xAxisName || 'Date',
        labelPadding: 20,
        tickCount: Math.min(8, Math.max(4, Math.floor(this.chart.container.offsetWidth / 100))),
        tickFormat: this.chart.config.options.xType === 'time' ? 'time' : 'number'
      }
    });
    
    console.log('Created shared X axis using static factory method');
  }

  /**
   * ✅ FIXED: Calculate percentage-based axis height
   * @private
   */
  _calculateSharedAxisHeight() {
    // Calculate axis height as percentage of container
    const containerHeight = this.chart.container.offsetHeight;
    this.sharedAxisHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
    
    console.log(`Percentage-based axis height: ${this.sharedAxisHeight}px (${this.AXIS_AREA_PERCENTAGE * 100}% of ${containerHeight}px)`);
  }

  /**
   * Create panel container
   * @private
   */
  _createPanelContainer() {
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'chart-panel-container';
    this.panelContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: visible;
      box-sizing: border-box;
    `;
    
    // Clear existing container content
    while (this.chart.container.firstChild) {
      this.chart.container.removeChild(this.chart.container.firstChild);
    }
    
    this.chart.container.appendChild(this.panelContainer);
    
    // Create main SVG overlay for shared axis
    this.panelSvgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.panelSvgOverlay.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      overflow: visible;
    `;
    
    this.panelContainer.appendChild(this.panelSvgOverlay);

    this._createEndingLabels();
    this._createLegend();
    this._createRecessionLines();
    
    console.log('Panel container created');
  }

  /**
   * ✅ FIXED: Create panels with percentage-based area allocation
   * @private
   */
  async _createPanels() {
    this.panels = [];
    
    const totalPanels = this.chart.config.data.length;
    const containerHeight = this.chart.container.offsetHeight;
    
    // Calculate axis space using percentage
    this._calculateSharedAxisHeight();
    
    // ✅ CRITICAL: Use percentage-based calculation for panel space
    const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
    const axisAreaHeight = Math.floor(containerHeight * this.AXIS_AREA_PERCENTAGE);
    
    // Ensure we have space for panels
    if (panelAreaHeight <= 0) {
      throw new Error(`Container too small: ${containerHeight}px height needs ${axisAreaHeight}px for axis area`);
    }
    
    // Calculate individual panel height - evenly distributed
    const panelHeight = Math.floor(panelAreaHeight / totalPanels);
    
    console.log(`✅ PERCENTAGE-BASED LAYOUT:`);
    console.log(`  - Container height: ${containerHeight}px`);
    console.log(`  - Axis area (${this.AXIS_AREA_PERCENTAGE * 100}%): ${axisAreaHeight}px`);
    console.log(`  - Panel area (${this.PANEL_AREA_PERCENTAGE * 100}%): ${panelAreaHeight}px`);
    console.log(`  - Creating ${totalPanels} panels with ${panelHeight}px height each`);
    console.log(`  - Panel height per panel: ${(panelHeight/containerHeight*100).toFixed(1)}% of container`);
    console.log(`  - Total panel space used: ${totalPanels * panelHeight}px`);
    console.log(`  - Remaining panel space: ${panelAreaHeight - (totalPanels * panelHeight)}px`);
    
    // Create panels
    for (let i = 0; i < totalPanels; i++) {
  const dataset = this.chart.config.data[i];
  
  console.log(`Creating panel ${i} with grid options:`, {
    showGrid: this.chart.config.options.showGrid,
    showXGrid: this.chart.config.options.showXGrid,
    showYGrid: this.chart.config.options.showYGrid,
    gridColor: this.chart.config.options.gridColor,
    gridOpacity: this.chart.config.options.gridOpacity
  });
  
  const panel = new Panel({
    dataset: dataset,
    chart: this.chart,
    panelIndex: i,
    totalPanels: totalPanels,
    height: panelHeight,
    container: this.panelContainer,
    sharedXScale: this.sharedXScale,
    chartType: this.chart.chartType || 'line',
    hasSharedXAxis: true,
    rendererType: this.chart.activeRenderer || 'canvas',
    yAxisName: this.chart.config.options.yAxisName || 'Value',
    isLogarithmic: this.chart.config.options.isLogarithmic,
    recessionData: this.chart.recessionLines?.config.recessionData || [],
    
    // ← ADD THESE GRID OPTIONS:
    showGrid: this.chart.config.options.showGrid,
    showXGrid: this.chart.config.options.showXGrid,
    showYGrid: this.chart.config.options.showYGrid,
    gridColor: this.chart.config.options.gridColor,
    gridOpacity: this.chart.config.options.gridOpacity,
    gridOptions: {
      xGridColor: '#f0f0f0',      // Light gray
      yGridColor: '#f0f0f0',      // Light gray  
      xGridOpacity: 0.4,          // More transparent
      yGridOpacity: 0.4,          // More transparent
      xGridWidth: 0.5,            // Thinner
      yGridWidth: 0.5,            // Thinner
      skipEdgeLines: true
    }
  });
  
  await panel.initialize();
  this.panels.push(panel);
}
    
    console.log(`✅ Created ${this.panels.length} panels with percentage-based allocation`);
  }

  /**
   * Render all panels and shared axis
   * @private
   */
  async _renderPanels() {
    if (this.panels.length === 0) {
      console.warn('No panels to render');
      return;
    }

    for (const panel of this.panels) {
      await panel.render();
    }
    
    this._renderSharedXAxis();

    if (this.endingLabels && this.endingLabels.config.enabled) {
      this._renderEndingLabels();
    }
    
    this._renderLegend();
    
    console.log(`Rendered ${this.panels.length} panels with shared X axis`);
  }

/**
 * ✅ FIXED: Render shared X axis at percentage-based position with fresh dimensions
 * @private
 */
_renderSharedXAxis() {
  if (!this.sharedXAxis || !this.panelSvgOverlay) return;
  
  // ✅ CRITICAL: Force fresh container dimensions during refresh
  const containerHeight = this.chart.container.offsetHeight;
  
  // ✅ CRITICAL: Use percentage-based positioning - axis starts at 85% of container height
  const panelAreaHeight = Math.floor(containerHeight * this.PANEL_AREA_PERCENTAGE);
  const axisStartY = panelAreaHeight; // Axis starts right after panel area
  
  const position = {
    x: 60, // Align with panel left padding (for Y-axis space)
    y: axisStartY
  };
  
  console.log(`✅ PERCENTAGE-BASED AXIS POSITIONING (DURING REFRESH):`);
  console.log(`  - Container height: ${containerHeight}px`);
  console.log(`  - Panel area (${this.PANEL_AREA_PERCENTAGE * 100}%): ${panelAreaHeight}px`);
  console.log(`  - Axis area (${this.AXIS_AREA_PERCENTAGE * 100}%): ${containerHeight - panelAreaHeight}px`);
  console.log(`  - Axis Y position: ${axisStartY}px (${(axisStartY/containerHeight*100).toFixed(1)}% from top)`);
  console.log(`  - Axis position:`, position);
  
  // Clear any existing axis elements in the SVG overlay
  const existingAxes = this.panelSvgOverlay.querySelectorAll('.axis');
  existingAxes.forEach(axis => {
    if (axis.getAttribute('class').includes('axis-x') || 
        axis.getAttribute('class').includes('axis-undefined')) {
      axis.remove();
    }
  });
  
  this.sharedXAxis.render(this.panelSvgOverlay, position);
  
  console.log(`✅ Shared X axis rendered at PERCENTAGE-BASED position y: ${axisStartY}px`);
}


/**
 * Render main chart title in panel mode - matches single mode positioning
 * @private
 */
_renderPanelModeTitle() {
  if (!this.chart.config.options.title || !this.panelSvgOverlay) return;
  
  const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  
  // Use EXACT same positioning as single mode
  const centerX = this.chart.config.options.width / 2;
  const titleY = this.chart.config.options.titlePadding + this.chart.config.options.titleFontSize;
  
  titleElement.setAttribute('x', centerX);
  titleElement.setAttribute('y', titleY);
  titleElement.setAttribute('text-anchor', 'middle');
  titleElement.setAttribute('font-size', this.chart.config.options.titleFontSize);
  titleElement.setAttribute('font-family', this.chart.config.options.titleFontFamily);
  titleElement.setAttribute('font-weight', this.chart.config.options.titleFontWeight);
  titleElement.setAttribute('fill', this.chart.config.options.titleColor);
  titleElement.setAttribute('class', 'chart-title panel-mode');
  titleElement.textContent = this.chart.config.options.title;
  
  this.panelSvgOverlay.appendChild(titleElement);
  
  console.log(`Panel mode title rendered with single mode positioning: "${this.chart.config.options.title}"`);
}

/**
 * Create and initialize Legend for panel mode
 * @private
 */
_createLegend() {
    this.legend = new Legend({
        fontSize: 12,
        fontFamily: this.chart.config.options.titleFontFamily || 'Arial, sans-serif',
        textColor: '#333333',
        itemSpacing: 25,
        marginTop: 15,
        marginBottom: 15
    });
    console.log('Legend created for panel mode');
}

/**
 * Render legend for all panels - FIXED to include studies
 * @private
 */
_renderLegend() {
    if (this.legend && this.chart.config.data) {
        // Get visible studies from the chart's StudiesManager (same as single mode)
        const studies = this.chart.studiesManager ? 
            this.chart.studiesManager.getVisibleStudies() : [];
        
        // Update legend with both datasets AND studies
        this.legend.updateDatasets(this.chart.config.data, studies);

        if (this.panelSvgOverlay && this.chart.chartArea) {
            const legendChartArea = {
                ...this.chart.chartArea,
                y: (this.chart.config.options.title ? 
                    this.chart.config.options.titlePadding + this.chart.config.options.titleFontSize : 0) + 15,
            };
            this.legend.render(this.panelSvgOverlay, legendChartArea);
        }
    }
}

/**
 * Toggle legend visibility in panel mode
 * @param {boolean|null} show - Force show/hide state, or null to toggle
 * @returns {boolean} New visibility state
 */
toggleLegend(show = null) {
  if (!this.isPanelMode) {
    console.warn('PanelManager.toggleLegend() called but not in panel mode');
    return false;
  }
  
  if (!this.legend) {
    console.warn('Panel mode legend not available');
    return false;
  }
  
  // Determine new state
  let newState;
  if (show !== null) {
    newState = show;
  } else {
    // Toggle current state - check if element is currently visible
    const isCurrentlyVisible = this.legend.element && 
      this.legend.element.style.display !== 'none';
    newState = !isCurrentlyVisible;
  }
  
  // Apply the new state
  this.legend.setVisible(newState);
  
  console.log(`Panel mode legend ${newState ? 'shown' : 'hidden'}`);
  
  return newState;
}

/**
 * Get current legend visibility state in panel mode
 * @returns {boolean} True if legend is visible
 */
isLegendVisible() {
  if (!this.isPanelMode || !this.legend || !this.legend.element) {
    return false;
  }
  
  return this.legend.element.style.display !== 'none';
}


/**
 * Create and initialize EndingLabels for panel mode
 * @private
 */
_createEndingLabels() {
  if (this.endingLabels) {
    this.endingLabels.destroy?.();
  }
  
  this.endingLabels = new EndingLabels({
    enabled: false,
    offsetX: 0,
    offsetY: 0,
    fontSize: 11,
    showBackground: true,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backgroundPadding: 4,
    borderRadius: 3
  });
  
  console.log('EndingLabels created for panel mode');
}

/**
 * Create and initialize RecessionLines for panel mode
 * @private
 */
_createRecessionLines() {
    if (!this.chart.recessionLines) {
        return;
    }
    this.recessionLines = new RecessionLines({
        enabled: this.chart.recessionLines.config.enabled,
        fillColor: this.chart.recessionLines.config.fillColor,
        strokeColor: this.chart.recessionLines.config.strokeColor,
        strokeWidth: this.chart.recessionLines.config.strokeWidth,
    });
    this.recessionLines.setRecessionData(this.chart.recessionLines.config.recessionData);
}

/**
 * Render RecessionLines for all panels
 * @private
 */
_renderRecessionLines() {
    if (!this.recessionLines) {
        return;
    }

    const panelAreaHeight = Math.floor(this.chart.container.offsetHeight * this.PANEL_AREA_PERCENTAGE);
    const fullPanelArea = {
        x: this.chart.config.options.margin.left,
        y: this.chart.config.options.margin.top,
        width: this.chart.container.offsetWidth - this.chart.config.options.margin.left - this.chart.config.options.margin.right,
        height: panelAreaHeight - this.chart.config.options.margin.top,
    };

    this.recessionLines.render(this.panelContainer, fullPanelArea, { x: this.sharedXScale });
}

/**
 * Collect endpoint data from all panels
 * @private
 */
_collectAllPanelEndpoints() {
  const endpoints = [];
  
  for (const panel of this.panels) {
    const endpoint = panel.getLineEndpoint();
    if (endpoint) {
      // Translate panel-local coordinates to global SVG coordinates
      const globalCoords = this._translatePanelCoordinatesToGlobal(endpoint);
      if (globalCoords) {
        endpoints.push({
          ...endpoint,
          globalX: globalCoords.x,
          globalY: globalCoords.y
        });
      }
    }
  }
  
  return endpoints;
}

/**
 * Translate panel-local coordinates to global SVG coordinates
 * @private
 */
_translatePanelCoordinatesToGlobal(endpoint) {
  if (!endpoint || !endpoint.panelChartArea) {
    return null;
  }
  
  const panel = this.panels[endpoint.panelIndex];
  if (!panel) {
    console.warn(`No panel found for index ${endpoint.panelIndex}`);
    return null;
  }
  
  // Get actual DOM positions instead of calculated positions
  const mainContainerRect = this.chart.container.getBoundingClientRect();
  const panelContainerRect = panel.panelContainer.getBoundingClientRect();
  
  // Calculate actual panel offset within the main container
  const actualPanelStartY = panelContainerRect.y - mainContainerRect.y;
  
  // Calculate global coordinates using actual DOM positions
  const globalX = endpoint.localX; // X coordinate stays the same (panels share X axis)
  const globalY = actualPanelStartY + endpoint.localY;
  
  console.log(`🔍 COORDINATE DEBUG for panel ${endpoint.panelIndex}:`, {
    datasetName: endpoint.dataset.name,
    
    // Panel positioning
    panelIndex: endpoint.panelIndex,
    calculatedPanelStartY: endpoint.panelIndex * panel.config.height, // Old method
    actualPanelStartY: actualPanelStartY, // New method using DOM
    
    // DOM rects
    actualPanelRect: panelContainerRect,
    mainContainerRect: mainContainerRect,
    
    // Local coordinates
    localX: endpoint.localX,
    localY: endpoint.localY,
    panelChartArea: endpoint.panelChartArea,
    
    // Global coordinates
    globalX: globalX,
    globalY: globalY,
    
    // Offset calculation
    panelOffsetFromContainer: actualPanelStartY
  });
  
  return {
    x: globalX,
    y: globalY
  };
}

/**
 * Create datasets array with global coordinates for EndingLabels
 * @private
 */
_createEndingLabelsDatasets() {
  const endpoints = this._collectAllPanelEndpoints();
  
  return endpoints.map(endpoint => ({
    ...endpoint.dataset,
    data: [{
      x: endpoint.dataX,
      y: endpoint.dataY,
      // Use global coordinates for rendering
      unifiedX: endpoint.globalX,
      unifiedY: endpoint.globalY,
      screenX: endpoint.globalX,
      screenY: endpoint.globalY,
      pixelX: endpoint.globalX,
      pixelY: endpoint.globalY
    }]
  }));
}

/**
 * Render ending labels for all panels
 * @private
 */
_renderEndingLabels() {
  if (!this.endingLabels || !this.panelSvgOverlay) {
    return;
  }
  
  // Create global chart area for EndingLabels
  const containerHeight = this.chart.container.offsetHeight;
  const containerWidth = this.chart.container.offsetWidth;
  
  const globalChartArea = {
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight
  };
  
  // Create datasets with global coordinates
  const datasets = this._createEndingLabelsDatasets();
  
  console.log(`Rendering ${datasets.length} ending labels with global coordinates`);
  
  // Update EndingLabels with global datasets
  this.endingLabels.updateDatasets(datasets);
  
  // Render to global SVG overlay
  this.endingLabels.render(this.panelSvgOverlay, globalChartArea);
}

/**
 * Toggle ending labels visibility for all panels
 * @param {boolean} show - Force show/hide state, or null to toggle
 */
toggleEndingLabels(show = null) {
  if (!this.isPanelMode || !this.endingLabels) {
    console.warn('EndingLabels not available in current mode');
    return false;
  }
  
  // Determine new state
  const currentState = this.endingLabels.isVisible;
  const newState = show !== null ? show : !currentState;
  
  if (newState) {
    // When showing, render first if not already rendered, then show
    if (!this.endingLabels.isRendered || this.panels.length > 0) {
      this._renderEndingLabels();
    }
    this.endingLabels.show();
  } else {
    // When hiding, just hide
    this.endingLabels.hide();
  }
  
  console.log(`EndingLabels ${newState ? 'enabled' : 'disabled'} for panel mode`);
  return newState;
}


/**
 * Update ending labels with current panel data
 */
updateEndingLabels() {
  if (!this.isPanelMode || !this.endingLabels || this.panels.length === 0) {
    return;
  }
  
  // Re-render with updated data
  this._renderEndingLabels();
  
  console.log('EndingLabels updated for panel mode');
}

/**
 * Get ending labels state
 */
getEndingLabelsState() {
  if (!this.isPanelMode || !this.endingLabels) {
    return null;
  }
  
  return {
    isVisible: this.endingLabels.isVisible,
    enabled: this.endingLabels.config.enabled,
    panelCount: this.panels.length,
    mode: 'panel'
  };
}

/**
 * UPDATED: Ensure legend state is preserved during panel refresh
 * Update the existing refreshPanelMode method to preserve legend state
 */
async refreshPanelMode() {
  if (!this.isPanelMode) return;
  
  try {
    console.log('Refreshing panel mode with updated datasets');
    console.log(`Current dataset count: ${this.chart.config.data.length}`);
    
    // ✅ NEW: Store legend state before refresh
    const previousLegendState = this.isLegendVisible();
    const previousEndingLabelsState = this.panels.length > 0 ? 
      this.panels[0].getEndingLabelsState()?.isVisible : false;
    
    // Clean up the old crosshair and listeners before rebuilding
    this._destroyCrosshairAndTooltip();
    
    // ✅ CRITICAL: Completely destroy and recreate panel infrastructure
    this._destroyPanels();
    
    // ✅ CRITICAL: Also destroy and recreate the panel container and SVG overlay
    this._destroyPanelContainer();
    
    // ✅ CRITICAL: Ensure we have valid datasets before proceeding
    if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
      console.warn('No datasets available for panel mode refresh');
      return;
    }
    
    // Process data first
    await this.chart._processData();
    
    // Recreate shared X scale with all datasets
    this._createSharedXScale();
    
    // ✅ CRITICAL: Recreate shared X axis
    this._createSharedXAxis();
    
    // ✅ CRITICAL: Recreate panel container and SVG overlay
    this._createPanelContainer();

    this._renderPanelModeTitle();

    // ✅ NEW: Recreate and restore legend state
    this._createLegend();

    if (previousEndingLabelsState) {
      this.toggleEndingLabels(true);
    }
    
    // ✅ CRITICAL: Recreate panels with fresh percentage calculations
    await this._createPanels();
    
    // Re-render all panels
    await this._renderPanels();

    // ✅ NEW: Restore legend visibility state
    if (this.legend && previousLegendState !== this.isLegendVisible()) {
      this.toggleLegend(previousLegendState);
    }

    // Re-initialize the crosshair and tooltip
    this._setupCrosshairAndTooltip();
    
    console.log(`Panel mode refreshed successfully with ${this.panels.length} panels`);
    console.log(`Legend state restored: ${this.isLegendVisible()}`);
    
  } catch (error) {
    console.error('Error refreshing panel mode:', error);
    throw error;
  }
}

  /**
   * Destroy all panels and shared axis
   * @private
   */
  _destroyPanels() {
    console.log(`Destroying ${this.panels.length} panels...`);

    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
      console.log('  ✓ EndingLabels destroyed');
    }

    if (this.legend) {
        this.legend.destroy();
        this.legend = null;
        console.log('  ✓ Legend destroyed');
    }

    if (this.crosshair) {
        this.crosshair.destroy();
        this.crosshair = null;
    }

    if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
    }

    if (this.recessionLines) {
        this.recessionLines.destroy();
        this.recessionLines = null;
    }
    
    // Destroy individual panels
    for (const panel of this.panels) {
      panel.destroy();
    }
    console.log('  ✓ Individual panels destroyed');
    
    // Clean up shared axis
    if (this.sharedXAxis) {
      this.sharedXAxis = null;
      console.log('  ✓ Shared X axis cleared');
    }
    
    // Clean up SVG overlay
    if (this.panelSvgOverlay) {
      if (this.panelSvgOverlay.parentNode) {
        this.panelSvgOverlay.parentNode.removeChild(this.panelSvgOverlay);
      }
      this.panelSvgOverlay = null;
      console.log('  ✓ Panel SVG overlay removed');
    }
    
    this.panels = [];
    this.sharedXScale = null;
    
    console.log('All panels destroyed');
  }

  /**
   * Destroy panel container
   * @private
   */
  _destroyPanelContainer() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
  }

  /**
   * ✅ FIXED: Complete single chart reinitialization
   * @private
   */
  async _reinitializeSingleChart() {
    try {
      console.log('Starting complete single chart reinitialization...');
      console.log('Current isPanelMode state:', this.isPanelMode);
      
      // ✅ CRITICAL: Ensure panel mode is false
      this.isPanelMode = false;
      
      // Phase 1: Complete cleanup
      console.log('Phase 1: Cleanup...');
      if (this.chart.rendererInstance) {
        this.chart.rendererInstance.destroy();
        this.chart.rendererInstance = null;
        console.log('  ✓ Renderer destroyed');
      }
      
      // Clear all references
      this.chart.generatedPaths = null;
      this.chart.transformedData = null;
      this.chart.canvas = null;
      this.chart.svgOverlay = null;
      this.chart.gridCanvas = null;
      console.log('  ✓ References cleared');
      
      // Clear coordinate system cache
      if (this.chart.coordinateSystem) {
        this.chart.coordinateSystem.clearCache();
        console.log('  ✓ Coordinate system cache cleared');
      }
      
      // ✅ CRITICAL: Use Chart's initialize method for complete recreation
      console.log('Phase 2: Calling chart._initialize() for complete recreation...');
      await this.chart._initialize();
      console.log('  ✓ Chart._initialize() completed');
      
      // ✅ CRITICAL FIX: Call render() after initialization to actually draw the chart
      console.log('Phase 3: Rendering chart data...');
      await this.chart.render();
      console.log('  ✓ Chart render completed');
      
      console.log('Complete single chart reinitialization successful');
      
    } catch (error) {
      console.error('Complete reinitialization failed:', error);
      
      // Fallback: Try manual recreation
      try {
        console.log('Attempting manual recreation fallback...');
        
        // Ensure state is correct
        this.isPanelMode = false;
        
        // Manual setup
        console.log('  Manual dimensions...');
        this.chart._calculateDimensions();
        
        console.log('  Manual rendering layers...');
        this.chart._setupRenderingLayers();
        
        console.log('  Manual process data...');
        await this.chart._processData();
        
        console.log('  Manual create scales...');
        this.chart._createScales();
        
        if (this.chart.coordinateSystem) {
          this.chart.coordinateSystem.setScales(this.chart.scales);
          console.log('  Manual coordinate system updated...');
        }
        
        console.log('  Manual create axes...');
        this.chart._createAxes();
        
        console.log('  Manual create grid...');
        this.chart._createGrid();
        
        console.log('  Manual initialize renderer...');
        await this.chart._initializeRenderer();
        
        // Generate paths manually
        if (this.chart.coordinateSystem && this.chart.config.data) {
          console.log('  Manual coordinate transformation...');
          this.chart.config.data = await this.chart.coordinateSystem.transformDatasets(this.chart.config.data, {
            strictValidation: false
          });
          
          console.log('  Manual path generation...');
          this.chart.generatedPaths = await PathGenerator.generatePaths(this.chart.config.data, {
            curve: this.chart.config.options.curve || 'linear',
            strokeWidth: this.chart.config.options.strokeWidth || 2,
            targetRenderer: this.chart.activeRenderer
          });
          
          console.log(`  ✓ Manually generated ${this.chart.generatedPaths.length} paths`);
        }
        
        console.log('  Manual render...');
        await this.chart.render();
        console.log('Manual recreation successful');
        
      } catch (fallbackError) {
        console.error('Manual recreation also failed:', fallbackError);
        
        // Last resort: Show error message
        this.chart.container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 20px; margin-bottom: 12px;">⚠️</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Chart Error</div>
              <div style="font-size: 14px; color: #888;">Unable to restore single chart mode</div>
              <div style="font-size: 12px; color: #aaa; margin-top: 12px;">Try refreshing the page</div>
            </div>
          </div>
        `;
        
        throw fallbackError;
      }
    }
  }

_setupCrosshairAndTooltip() {
    // Create Crosshair
    this.crosshair = new Crosshair({
        lineColor: '#555',
        lineDash: [4, 4],
    });

    const fullChartArea = {
        x: 0,
        y: 0,
        width: this.chart.config.options.width,
        height: this.chart.config.options.height,
    };
    this.crosshair.render(this.panelSvgOverlay, fullChartArea);

    // Create Tooltip
    this.tooltip = new CrosshairTooltip();

    // Setup events
    this._setupCrosshairEvents();
}

_setupCrosshairEvents() {
    if (!this.chart.container) return;

    this._boundOnMouseMove = this._onMouseMove.bind(this);
    this._boundOnMouseLeave = this._onMouseLeave.bind(this);

    this.chart.container.addEventListener('mousemove', this._boundOnMouseMove);
    this.chart.container.addEventListener('mouseleave', this._boundOnMouseLeave);
}

_onMouseMove(event) {
    if (!this.chart.chartArea) return;

    const rect = this.chart.container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Check if mouse is within chart area
    if (mouseX < this.chart.chartArea.x || 
        mouseX > this.chart.chartArea.x + this.chart.chartArea.width ||
        mouseY < this.chart.chartArea.y || 
        mouseY > this.chart.chartArea.y + this.chart.chartArea.height) {
        this.crosshair.hide();
        this.tooltip.hide();
        return;
    }

    // Convert mouse X to data X using shared scale
    const dataX = this.sharedXScale.invert(mouseX);

    // Collect points from all panels (each panel now handles its own studies)
    let allPoints = [];
    this.panels.forEach(panel => {
        const points = panel.getDataPointsAtX(dataX);
        allPoints.push(...points);
    });

    if (allPoints.length > 0) {
        this.crosshair.show();
        // Use the mouse Y for the horizontal line to give immediate feedback
        this.crosshair.updatePosition(mouseX, mouseY); 
        this.crosshair.updateHighlights(allPoints.map(p => {
            const panel = this.panels[p.panelIndex];
            // Mathematical calculation of the panel's top offset
            const panelTopOffset = p.panelIndex * panel.config.height;
            const y = panelTopOffset + p.pixelY;
            return { ...p, unifiedX: p.pixelX, unifiedY: y };
        }));
        
        this.tooltip.show(allPoints.map(p => ({
             ...p, 
             dataX: p.x, 
             dataY: p.y,
             dataset: p.dataset || this.chart.config.data.find(d => d.id === p.datasetId)
            })), 
            event.clientX, 
            event.clientY
        );
    } else {
        this.crosshair.hide();
        this.tooltip.hide();
    }
}

_onMouseLeave(event) {
    if (this.crosshair) {
        this.crosshair.hide();
    }
    if (this.tooltip) {
        this.tooltip.hide();
    }
}

toggleAverageLine(show) {
    this.panels.forEach(panel => panel.toggleAverageLine(show));
}

toggleMedianLine(show) {
    this.panels.forEach(panel => panel.toggleMedianLine(show));
}

toggleZeroLine(show) {
    this.panels.forEach(panel => panel.toggleZeroLine(show));
}

toggleRecessionLines(show) {
  // Delegate to individual panels instead of global recession lines
  this.panels.forEach(panel => panel.toggleRecessionLines(show));
}

_destroyCrosshairAndTooltip() {
    if (this.crosshair) {
        this.crosshair.destroy();
        this.crosshair = null;
    }
    if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
    }
    if (this.chart.container) {
        if (this._boundOnMouseMove) {
            this.chart.container.removeEventListener('mousemove', this._boundOnMouseMove);
        }
        if (this._boundOnMouseLeave) {
            this.chart.container.removeEventListener('mouseleave', this._boundOnMouseLeave);
        }
    }
}


/**
 * Create and initialize EndingLabels for panel mode
 * @private
 */
_createEndingLabels() {
  if (this.endingLabels) {
    this.endingLabels.destroy?.();
  }
  
  this.endingLabels = new EndingLabels({
    enabled: false,
    offsetX: 0,
    offsetY: 0,
    fontSize: 11,
    showBackground: true,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backgroundPadding: 4,
    borderRadius: 3
  });
  
  console.log('EndingLabels created for panel mode');
}

/**
 * Update panel manager legend with studies
 * @param {Array} studies - Array of study objects
 */
updateLegendWithStudies(studies) {
  if (!this.legend) {
    return;
  }

  try {
    // Get all datasets from all panels
    const allDatasets = [];
    
    for (const panel of this.panels) {
      if (panel.config && panel.config.dataset) {
        allDatasets.push(panel.config.dataset);
      }
    }
    
    // Update legend with datasets and studies
    this.legend.updateDatasets(allDatasets, studies);
    
    // Re-render legend if SVG overlay exists
    if (this.chart.svgOverlay && this.sharedChartArea) {
      this.legend.render(this.chart.svgOverlay, this.sharedChartArea);
    }
    
    console.log(`Panel mode legend updated with ${allDatasets.length} datasets and ${studies.length} studies`);
    
  } catch (error) {
    console.error('Error updating panel manager legend with studies:', error);
  }
}

_getPanelEndpoints() {
    const endpoints = [];
    this.panels.forEach(panel => {
        const endpoint = panel.getLineEndpoint();
        if (endpoint) {
            const panelTopOffset = panel.config.panelIndex * panel.config.height;
            endpoints.push({
                ...endpoint,
                unifiedX: endpoint.localX,
                unifiedY: panelTopOffset + endpoint.localY
            });
        }
    });
    return endpoints;
}


/**
 * Render ending labels for all panels
 * @private
 */
_renderEndingLabels() {
  if (!this.endingLabels || !this.panelSvgOverlay) {
    return;
  }
  
  // Create global chart area for EndingLabels
  const containerHeight = this.chart.container.offsetHeight;
  const containerWidth = this.chart.container.offsetWidth;
  
  const globalChartArea = {
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight
  };
  
  // Create datasets with global coordinates
  const datasets = this._getPanelEndpoints().map(endpoint => ({
      ...endpoint.dataset,
      data: [{
          x: endpoint.dataX,
          y: endpoint.dataY,
          unifiedX: endpoint.unifiedX,
          unifiedY: endpoint.unifiedY
      }]
  }));
  
  console.log(`Rendering ${datasets.length} ending labels with global coordinates`);
  
  // Update EndingLabels with global datasets
  this.endingLabels.updateDatasets(datasets);
  
  // Render to global SVG overlay
  this.endingLabels.render(this.panelSvgOverlay, globalChartArea);
}

/**
 * Toggle ending labels visibility for all panels
 * @param {boolean} show - Force show/hide state, or null to toggle
 */
toggleEndingLabels(show = null) {
  if (!this.isPanelMode || !this.endingLabels) {
    console.warn('EndingLabels not available in current mode');
    return false;
  }
  
  // Determine new state
  const currentState = this.endingLabels.isVisible;
  const newState = show !== null ? show : !currentState;
  
  if (newState) {
    // When showing, render first if not already rendered, then show
    if (!this.endingLabels.isRendered || this.panels.length > 0) {
      this._renderEndingLabels();
    }
    this.endingLabels.show();
  } else {
    // When hiding, just hide
    this.endingLabels.hide();
  }
  
  console.log(`EndingLabels ${newState ? 'enabled' : 'disabled'} for panel mode`);
  return newState;
}


/**
 * Update ending labels with current panel data
 */
updateEndingLabels() {
  if (!this.isPanelMode || !this.endingLabels || this.panels.length === 0) {
    return;
  }
  
  // Re-render with updated data
  this._renderEndingLabels();
  
  console.log('EndingLabels updated for panel mode');
}

/**
 * Get ending labels state
 */
getEndingLabelsState() {
  if (!this.isPanelMode || !this.endingLabels) {
    return null;
  }
  
  return {
    isVisible: this.endingLabels.isVisible,
    enabled: this.endingLabels.config.enabled,
    panelCount: this.panels.length,
    mode: 'panel'
  };
}

/**
 * Refresh panel mode - UPDATED to handle EndingLabels state
 */
async refreshPanelMode() {
  if (!this.isPanelMode) return;
  
  try {
    console.log('Refreshing panel mode with updated datasets');
    console.log(`Current dataset count: ${this.chart.config.data.length}`);
    
    // ✅ UPDATED: Store EndingLabels state before refresh
    const previousEndingLabelsState = this.endingLabels ? this.endingLabels.isVisible : false;
    
    // Completely destroy and recreate panel infrastructure
    this._destroyPanels();
    this._destroyPanelContainer();
    
    // Ensure we have valid datasets before proceeding
    if (!Array.isArray(this.chart.config.data) || this.chart.config.data.length === 0) {
      console.warn('No datasets available for panel mode refresh');
      return;
    }
    
    // Process data first
    await this.chart._processData();
    
    // Recreate shared X scale and axis
    this._createSharedXScale();
    this._createSharedXAxis();
    
    // Recreate panel container and SVG overlay (this also creates EndingLabels)
    this._createPanelContainer();
    
    this._renderPanelModeTitle();
    
    // ✅ UPDATED: Restore EndingLabels state after refresh
    if (previousEndingLabelsState && this.endingLabels) {
      this.endingLabels.config.enabled = true;
    }
    
    // Recreate panels with fresh percentage calculations
    await this._createPanels();
    
    // Re-render all panels (this will also render EndingLabels if enabled)
    await this._renderPanels();
    
    console.log(`Panel mode refreshed successfully with ${this.panels.length} panels`);
    
  } catch (error) {
    console.error('Error refreshing panel mode:', error);
    throw error;
  }
}

  /**
   * Destroy all panels and shared axis
   * @private
   */
  _destroyPanels() {
    console.log(`Destroying ${this.panels.length} panels...`);

    if (this.endingLabels) {
      if (this.endingLabels.destroy) {
        this.endingLabels.destroy();
      }
      this.endingLabels = null;
      console.log('  ✓ EndingLabels destroyed');
    }

    if (this.legend) {
        this.legend.destroy();
        this.legend = null;
        console.log('  ✓ Legend destroyed');
    }

    if (this.crosshair) {
        this.crosshair.destroy();
        this.crosshair = null;
    }

    if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
    }

    if (this.recessionLines) {
        this.recessionLines.destroy();
        this.recessionLines = null;
    }
    
    // Destroy individual panels
    for (const panel of this.panels) {
      panel.destroy();
    }
    console.log('  ✓ Individual panels destroyed');
    
    // Clean up shared axis
    if (this.sharedXAxis) {
      this.sharedXAxis = null;
      console.log('  ✓ Shared X axis cleared');
    }
    
    // Clean up SVG overlay
    if (this.panelSvgOverlay) {
      if (this.panelSvgOverlay.parentNode) {
        this.panelSvgOverlay.parentNode.removeChild(this.panelSvgOverlay);
      }
      this.panelSvgOverlay = null;
      console.log('  ✓ Panel SVG overlay removed');
    }
    
    this.panels = [];
    this.sharedXScale = null;
    
    console.log('All panels destroyed');
  }

  /**
   * Destroy panel container
   * @private
   */
  _destroyPanelContainer() {
    if (this.panelContainer && this.panelContainer.parentNode) {
      this.panelContainer.parentNode.removeChild(this.panelContainer);
      this.panelContainer = null;
    }
  }

  /**
   * ✅ FIXED: Complete single chart reinitialization
   * @private
   */
  async _reinitializeSingleChart() {
    try {
      console.log('Starting complete single chart reinitialization...');
      console.log('Current isPanelMode state:', this.isPanelMode);
      
      // ✅ CRITICAL: Ensure panel mode is false
      this.isPanelMode = false;
      
      // Phase 1: Complete cleanup
      console.log('Phase 1: Cleanup...');
      if (this.chart.rendererInstance) {
        this.chart.rendererInstance.destroy();
        this.chart.rendererInstance = null;
        console.log('  ✓ Renderer destroyed');
      }
      
      // Clear all references
      this.chart.generatedPaths = null;
      this.chart.transformedData = null;
      this.chart.canvas = null;
      this.chart.svgOverlay = null;
      this.chart.gridCanvas = null;
      console.log('  ✓ References cleared');
      
      // Clear coordinate system cache
      if (this.chart.coordinateSystem) {
        this.chart.coordinateSystem.clearCache();
        console.log('  ✓ Coordinate system cache cleared');
      }
      
      // ✅ CRITICAL: Use Chart's initialize method for complete recreation
      console.log('Phase 2: Calling chart._initialize() for complete recreation...');
      await this.chart._initialize();
      console.log('  ✓ Chart._initialize() completed');
      
      // ✅ CRITICAL FIX: Call render() after initialization to actually draw the chart
      console.log('Phase 3: Rendering chart data...');
      await this.chart.render();
      console.log('  ✓ Chart render completed');
      
      console.log('Complete single chart reinitialization successful');
      
    } catch (error) {
      console.error('Complete reinitialization failed:', error);
      
      // Fallback: Try manual recreation
      try {
        console.log('Attempting manual recreation fallback...');
        
        // Ensure state is correct
        this.isPanelMode = false;
        
        // Manual setup
        console.log('  Manual dimensions...');
        this.chart._calculateDimensions();
        
        console.log('  Manual rendering layers...');
        this.chart._setupRenderingLayers();
        
        console.log('  Manual process data...');
        await this.chart._processData();
        
        console.log('  Manual create scales...');
        this.chart._createScales();
        
        if (this.chart.coordinateSystem) {
          this.chart.coordinateSystem.setScales(this.chart.scales);
          console.log('  Manual coordinate system updated...');
        }
        
        console.log('  Manual create axes...');
        this.chart._createAxes();
        
        console.log('  Manual create grid...');
        this.chart._createGrid();
        
        console.log('  Manual initialize renderer...');
        await this.chart._initializeRenderer();
        
        // Generate paths manually
        if (this.chart.coordinateSystem && this.chart.config.data) {
          console.log('  Manual coordinate transformation...');
          this.chart.config.data = await this.chart.coordinateSystem.transformDatasets(this.chart.config.data, {
            strictValidation: false
          });
          
          console.log('  Manual path generation...');
          this.chart.generatedPaths = await PathGenerator.generatePaths(this.chart.config.data, {
            curve: this.chart.config.options.curve || 'linear',
            strokeWidth: this.chart.config.options.strokeWidth || 2,
            targetRenderer: this.chart.activeRenderer
          });
          
          console.log(`  ✓ Manually generated ${this.chart.generatedPaths.length} paths`);
        }
        
        console.log('  Manual render...');
        await this.chart.render();
        console.log('Manual recreation successful');
        
      } catch (fallbackError) {
        console.error('Manual recreation also failed:', fallbackError);
        
        // Last resort: Show error message
        this.chart.container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 20px; margin-bottom: 12px;">⚠️</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Chart Error</div>
              <div style="font-size: 14px; color: #888;">Unable to restore single chart mode</div>
              <div style="font-size: 12px; color: #aaa; margin-top: 12px;">Try refreshing the page</div>
            </div>
          </div>
        `;
        
        throw fallbackError;
      }
    }
  }

  /**
   * Cleanup and destroy panel manager
   */
  destroy() {
    if (this.isPanelMode) {
      this._destroyPanels();
      this._destroyPanelContainer();
    }
    
    this.chart = null;
    this.originalSingleModeState = null;

    if (this.legend) {
        this.legend.destroy();
        this.legend = null;
    }

    this._destroyCrosshairAndTooltip();
    
    console.log('PanelManager destroyed');
  }
}
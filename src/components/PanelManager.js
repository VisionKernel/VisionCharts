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

export class PanelManager {
  constructor(chart) {
    this.chart = chart;
    
    // ✅ NEW: Percentage-based axis area reservation
    this.AXIS_AREA_PERCENTAGE = 0.15; // Always reserve 10% of container height for axis
    this.PANEL_AREA_PERCENTAGE = 0.85; // Remaining 90% for panels
    
    // Panel state
    this.isPanelMode = false;
    this.panels = [];
    this.panelContainer = null;
    this.panelSvgOverlay = null;
    
    // Shared axis components
    this.sharedXScale = null;
    this.sharedXAxis = null;
    this.sharedAxisHeight = 0; // Still used for internal calculations
    
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
    
    // ✅ CRITICAL: Recreate panels with fresh percentage calculations
    await this._createPanels();
    
    // Re-render all panels
    await this._renderPanels();
    
    console.log(`Panel mode refreshed successfully with ${this.panels.length} panels`);
    
  } catch (error) {
    console.error('Error refreshing panel mode:', error);
    throw error;
  }
}

  /**
   * Switch to panel mode with validation
   * @private
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
    
    // Create individual panels
    await this._createPanels();
    
    // Render all panels and shared axis
    await this._renderPanels();
    
    console.log('Panel mode activated successfully');
  }

  /**
   * ✅ FIXED: Switch to single mode with proper container restoration
   * @private
   */
  async _switchToSingleMode() {
    console.log('Switching back to single chart mode');
    
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
   * Create shared X scale for all panels
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
    
    // Create shared X scale
    const xDomain = [xMin, xMax];
    const xRange = [60, this.chart.container.offsetWidth - 20]; // Leave space for Y axes
    
    const scaleType = this.chart.config.options.xType === 'time' ? 'time' : 'linear';
    this.sharedXScale = createScale(scaleType, xDomain, xRange);
    
    console.log(`Created shared X scale: ${scaleType} with domain [${xMin}, ${xMax}]`);
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
      overflow: hidden;
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
      overflow: hidden;
    `;
    
    this.panelContainer.appendChild(this.panelSvgOverlay);
    
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
      
      const panel = new Panel({
        dataset: dataset,
        panelIndex: i,
        totalPanels: totalPanels,
        height: panelHeight,
        container: this.panelContainer,
        sharedXScale: this.sharedXScale,
        chartType: this.chart.chartType || 'line',
        hasSharedXAxis: true,
        rendererType: this.chart.activeRenderer || 'canvas',
        yAxisName: this.chart.config.options.yAxisName || 'Value'
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
    
    // Render each panel
    for (const panel of this.panels) {
      await panel.render();
    }
    
    // Render shared X axis at the bottom
    this._renderSharedXAxis();
    
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
   * Destroy all panels and shared axis
   * @private
   */
  _destroyPanels() {
    console.log(`Destroying ${this.panels.length} panels...`);
    
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
    
    console.log('PanelManager destroyed');
  }
}
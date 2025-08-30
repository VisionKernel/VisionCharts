import { PathGenerator } from '../utils/PathGenerator.js';

/**
 * StudiesRenderer - Centralized component for rendering all types of studies/indicators
 * Handles rendering for both LineChart and BarChart in single and panel modes
 * 
 * Phase 1: Overlay studies (SMA, EMA, Bollinger Bands)
 */
export class StudiesRenderer {
  constructor(chart) {
    this.chart = chart;
    this.isInitialized = false;
    
    // Rendering state
    this.studyPaths = new Map(); // Map of study ID to generated paths
    this.lastRenderTime = 0;
    
    console.log('StudiesRenderer initialized for overlay studies');
  }

  /**
   * Initialize the studies renderer
   */
  async initialize() {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    console.log('StudiesRenderer initialization complete');
  }

  /**
   * Main render method - renders all visible studies
   * Called from Chart's render pipeline after main data
   */
  async render() {
    if (!this.isInitialized || !this.chart.studiesManager) {
      return;
    }

    try {
      console.log('StudiesRenderer: Starting studies render...');
      
      // Get study datasets from the StudiesManager
      const studyDatasets = this.chart.studiesManager.getStudyDatasets();
      
      if (studyDatasets.length === 0) {
        console.log('StudiesRenderer: No studies to render');
        return;
      }

      // Process and render each study dataset
      await this._renderStudyDatasets(studyDatasets);
      
      this.lastRenderTime = Date.now();
      console.log(`StudiesRenderer: Rendered ${studyDatasets.length} study datasets`);
      
    } catch (error) {
      console.error('StudiesRenderer: Error rendering studies:', error);
    }
  }

  /**
   * Render study datasets using the chart's existing rendering pipeline
   * @param {Array} studyDatasets - Array of study datasets to render
   * @private
   */
  async _renderStudyDatasets(studyDatasets) {
    if (!this.chart.rendererInstance || !this.chart.coordinateSystem || !this.chart.scales) {
      console.warn('StudiesRenderer: Chart rendering components not ready');
      return;
    }

    // Transform study data through the coordinate system (same as main data)
    const transformedStudies = await this._transformStudyData(studyDatasets);
    
    // Generate paths for the transformed studies
    const studyPaths = await this._generateStudyPaths(transformedStudies);
    
    // Render using the chart's active renderer
    await this._renderWithActiveRenderer(studyPaths);
  }

  /**
   * Transform study data through the unified coordinate system
   * @param {Array} studyDatasets - Raw study datasets
   * @returns {Array} Transformed study datasets
   * @private
   */
  async _transformStudyData(studyDatasets) {
    try {
      // Use the same coordinate transformation as main chart data
      const transformedStudies = await this.chart.coordinateSystem.transformDatasets(studyDatasets, {
        strictValidation: false, // Studies might have gaps
        preserveOriginal: true
      });
      
      console.log(`StudiesRenderer: Transformed ${transformedStudies.length} study datasets`);
      return transformedStudies;
      
    } catch (error) {
      console.error('StudiesRenderer: Error transforming study data:', error);
      return [];
    }
  }

  /**
   * Generate rendering paths for study datasets
   * @param {Array} transformedStudies - Transformed study datasets
   * @returns {Array} Generated paths for rendering
   * @private
   */
  async _generateStudyPaths(transformedStudies) {
    try {
      const studyPaths = [];
      
      for (const dataset of transformedStudies) {
        // Generate path using the same PathGenerator as main data
        const paths = await PathGenerator.generatePaths([dataset], {
          curve: 'linear', // Studies typically use linear curves
          strokeWidth: dataset.strokeWidth || 2,
          targetRenderer: this.chart.activeRenderer,
          enableFill: false // Studies are typically lines only
        });
        
        // Tag paths with study information for rendering
        paths.forEach(path => {
          path.isStudy = true;
          path.studyId = dataset.studyId;
          path.studyType = dataset.studyType;
          path.studyName = dataset.name;
        });
        
        studyPaths.push(...paths);
      }
      
      console.log(`StudiesRenderer: Generated ${studyPaths.length} study paths`);
      return studyPaths;
      
    } catch (error) {
      console.error('StudiesRenderer: Error generating study paths:', error);
      return [];
    }
  }

  /**
   * Render study paths using the chart's active renderer
   * @param {Array} studyPaths - Generated study paths
   * @private
   */
  async _renderWithActiveRenderer(studyPaths) {
    if (studyPaths.length === 0) return;
    
    try {
      const renderer = this.chart.rendererInstance;
      
      // Render based on chart type
      if (this.chart.constructor.name === 'LineChart') {
        await this._renderStudyLines(renderer, studyPaths);
      } else if (this.chart.constructor.name === 'BarChart') {
        // For bar charts, still render studies as lines (overlays)
        await this._renderStudyLines(renderer, studyPaths);
      }
      
    } catch (error) {
      console.error('StudiesRenderer: Error rendering with active renderer:', error);
    }
  }

  /**
   * Render study paths as lines
   * @param {Object} renderer - Active renderer (Canvas or WebGL)
   * @param {Array} studyPaths - Study paths to render
   * @private
   */
  async _renderStudyLines(renderer, studyPaths) {
    // Group paths by study for better rendering organization
    const studyGroups = this._groupPathsByStudy(studyPaths);
    
    for (const [studyId, paths] of studyGroups) {
      try {
        // Render each study's paths
        await renderer.renderLines(paths, this.chart.scales, {
          showPoints: false, // Studies typically don't show points
          enableFill: false, // Studies are typically lines only
          chartArea: this.chart.chartArea,
          isStudyLayer: true // Flag to indicate this is a study render
        });
        
      } catch (error) {
        console.error(`StudiesRenderer: Error rendering study ${studyId}:`, error);
      }
    }
    
    console.log(`StudiesRenderer: Rendered ${studyGroups.size} study groups`);
  }

  /**
   * Group study paths by study ID for organized rendering
   * @param {Array} studyPaths - All study paths
   * @returns {Map} Map of study ID to paths
   * @private
   */
  _groupPathsByStudy(studyPaths) {
    const groups = new Map();
    
    for (const path of studyPaths) {
      const studyId = path.studyId;
      if (!groups.has(studyId)) {
        groups.set(studyId, []);
      }
      groups.get(studyId).push(path);
    }
    
    return groups;
  }

  /**
   * Update studies rendering after data change
   * Called when chart data is updated
   */
  async update() {
    if (!this.isInitialized) return;
    
    console.log('StudiesRenderer: Updating after data change...');
    
    // Clear cached paths
    this.studyPaths.clear();
    
    // Re-render studies
    await this.render();
  }

  /**
   * Clear all study rendering data
   */
  clear() {
    this.studyPaths.clear();
    console.log('StudiesRenderer: Cleared all study paths');
  }

  /**
   * Check if studies renderer is ready for rendering
   * @returns {boolean} True if ready to render
   */
  isReady() {
    return this.isInitialized && 
           this.chart?.rendererInstance?.isInitialized &&
           this.chart?.coordinateSystem &&
           this.chart?.scales;
  }

  /**
   * Get rendering statistics
   * @returns {Object} Rendering stats
   */
  getStats() {
    const studyCount = this.chart.studiesManager?.getAllStudies().length || 0;
    const visibleStudyCount = this.chart.studiesManager?.getVisibleStudies().length || 0;
    
    return {
      totalStudies: studyCount,
      visibleStudies: visibleStudyCount,
      renderedPaths: this.studyPaths.size,
      lastRenderTime: this.lastRenderTime,
      isReady: this.isReady()
    };
  }

  /**
   * Destroy the studies renderer
   */
  destroy() {
    this.clear();
    this.isInitialized = false;
    console.log('StudiesRenderer destroyed');
  }
}
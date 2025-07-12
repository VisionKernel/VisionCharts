// import { StudiesRenderer } from './StudiesRenderer.js';
import { PathGenerator } from '../utils/PathGenerator.js';
import { EndingLabels } from './EndingLabels.js';

/**
 * PanelDataRenderer - Centralized component for rendering data in panel mode
 * Handles rendering for both LineChart and BarChart in panel contexts
 */
export default class PanelDataRenderer {
  constructor(config = {}) {
    this.config = {
      chartType: 'line',              // 'line' or 'bar'
      rendererType: 'canvas',         // 'canvas' or 'webgl'
      
      // Line-specific options
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      curve: 'monotone',
      
      // Bar-specific options
      barWidth: 0.7,
      barSpacing: 0.1,
      
      ...config
    };
    
    // Components
    this.pathGenerator = null;
    this.coordinateSystem = null;
    
    // Initialize path generator for line charts
    if (this.config.chartType === 'line') {
      this.pathGenerator = new PathGenerator({
        curve: this.config.curve,
        targetRenderer: this.config.rendererType,
        enableCoordinateValidation: true
      });
    }
    
    console.log(`PanelDataRenderer created for ${this.config.chartType} charts`);
  }
  
  /**
   * Render dataset in panel
   * @param {Object} dataset - Single dataset to render
   * @param {Object} xScale - Shared X scale
   * @param {Object} yScale - Panel-specific Y scale  
   * @param {Object} chartArea - Panel chart area
   * @param {Object} renderer - Canvas/WebGL renderer instance
   */
  async render(dataset, xScale, yScale, chartArea, renderer) {
    if (!dataset || !dataset.data || !Array.isArray(dataset.data)) {
      console.warn('PanelDataRenderer: Invalid dataset provided');
      return;
    }
    
    if (!xScale || !yScale || !chartArea || !renderer) {
      throw new Error('PanelDataRenderer: Missing required rendering parameters');
    }
    
    try {
      // Transform data to unified coordinates
      const transformedDataset = this._transformDatasetCoordinates(dataset, xScale, yScale, chartArea);
      
      // Set viewport for clipping
      renderer.setViewport(chartArea);
      
      // Render based on chart type
      if (this.config.chartType === 'line') {
        await this._renderLineDataset(transformedDataset, renderer, chartArea);
      } else if (this.config.chartType === 'bar') {
        await this._renderBarDataset(transformedDataset, renderer, chartArea, { xScale, yScale });
      }
      
      console.log(`PanelDataRenderer: Rendered ${this.config.chartType} dataset: ${dataset.name}`);
      
    } catch (error) {
      console.error('PanelDataRenderer: Error rendering dataset:', error);
      throw error;
    }
  }
  
  /**
   * Transform dataset coordinates using scales
   * @private
   */
  _transformDatasetCoordinates(dataset, xScale, yScale, chartArea) {
    const transformedData = dataset.data.map(point => {
      // Convert data values to screen coordinates
      const screenX = xScale.scale(point.x);
      const screenY = yScale.scale(point.y);
      
      return {
        ...point,
        unifiedX: screenX,
        unifiedY: screenY,
        screenX: screenX,
        screenY: screenY
      };
    });
    
    return {
      ...dataset,
      data: transformedData
    };
  }
  
  /**
   * Render line dataset
   * @private
   */
  async _renderLineDataset(transformedDataset, renderer, chartArea) {
    // Generate path using PathGenerator
    const pathData = await this.pathGenerator.generatePath(transformedDataset, {
      curve: this.config.curve,
      targetRenderer: this.config.rendererType
    });
    
    if (!pathData || !pathData.vertices || pathData.vertices.length === 0) {
      console.warn('PanelDataRenderer: No path data generated for line dataset');
      return;
    }
    
    // Render the path
    await renderer.renderLines([pathData], null, {
      showPoints: this.config.showPoints,
      pointRadius: this.config.pointRadius,
      enableFill: transformedDataset.fill || false,
      chartArea: chartArea,
      fillOpacity: 0.3
    });
  }
  
  /**
   * Render bar dataset  
   * @private
   */
  async _renderBarDataset(transformedDataset, renderer, chartArea, scales) {
    // Calculate bar information
    const barInfo = this._calculateBarInfo(transformedDataset, scales.xScale, chartArea);
    
    // Render bars
    await renderer.renderBars([transformedDataset], scales, {
      barWidth: barInfo.width,
      chartArea: chartArea
    });
  }
  
  /**
   * Calculate bar dimensions and spacing
   * @private
   */
  _calculateBarInfo(dataset, xScale, chartArea) {
    const data = dataset.data;
    if (data.length < 2) {
      return { width: 20 }; // Default width for single bar
    }
    
    // Calculate average spacing between data points
    const spacings = [];
    for (let i = 1; i < data.length; i++) {
      const prevX = xScale.scale(data[i - 1].x);
      const currX = xScale.scale(data[i].x);
      spacings.push(Math.abs(currX - prevX));
    }
    
    const avgSpacing = spacings.reduce((sum, spacing) => sum + spacing, 0) / spacings.length;
    
    // Calculate bar width as percentage of available space
    const barWidth = avgSpacing * this.config.barWidth;
    
    return {
      width: Math.max(1, barWidth), // Minimum 1 pixel width
      spacing: avgSpacing * this.config.barSpacing,
      totalDatasets: 1 // Single dataset per panel
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    // Update path generator if configuration changed
    if (this.pathGenerator && newConfig.curve) {
      this.pathGenerator.setCurveType(newConfig.curve);
    }
    
    if (this.pathGenerator && newConfig.rendererType) {
      this.pathGenerator.setTargetRenderer(newConfig.rendererType);
    }
    
    console.log('PanelDataRenderer: Configuration updated');
  }
  
  /**
   * Set chart type (line or bar)
   */
  setChartType(chartType) {
    if (!['line', 'bar'].includes(chartType)) {
      console.warn(`Invalid chart type: ${chartType}`);
      return;
    }
    
    this.config.chartType = chartType;
    
    // Create/destroy path generator based on chart type
    if (chartType === 'line' && !this.pathGenerator) {
      this.pathGenerator = new PathGenerator({
        curve: this.config.curve,
        targetRenderer: this.config.rendererType,
        enableCoordinateValidation: true
      });
    } else if (chartType === 'bar') {
      this.pathGenerator = null; // Bars don't use path generator
    }
    
    console.log(`PanelDataRenderer: Chart type set to ${chartType}`);
  }
  
  /**
   * Set curve type for line charts
   */
  setCurveType(curveType) {
    this.config.curve = curveType;
    
    if (this.pathGenerator) {
      this.pathGenerator.setCurveType(curveType);
    }
    
    console.log(`PanelDataRenderer: Curve type set to ${curveType}`);
  }
  
  /**
   * Set renderer type
   */
  setRendererType(rendererType) {
    this.config.rendererType = rendererType;
    
    if (this.pathGenerator) {
      this.pathGenerator.setTargetRenderer(rendererType);
    }
    
    console.log(`PanelDataRenderer: Renderer type set to ${rendererType}`);
  }
  
  /**
   * Get renderer information
   */
  getInfo() {
    return {
      chartType: this.config.chartType,
      rendererType: this.config.rendererType,
      hasPathGenerator: !!this.pathGenerator,
      config: this.config
    };
  }
}
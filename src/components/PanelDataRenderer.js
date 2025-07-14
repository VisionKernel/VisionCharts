import { PathGenerator } from '../utils/PathGenerator.js';
import { EndingLabels } from './EndingLabels.js';

/**
 * PanelDataRenderer - Simplified to use centralized PathGenerator (FIXED)
 * 
 * ✅ REMOVED: this.pathGenerator instance
 * ✅ USES: PathGenerator static methods instead
 * ✅ ELIMINATED: Duplicate configuration management
 */
export default class PanelDataRenderer {
  constructor(config = {}) {
    this.config = {
      chartType: 'line',
      rendererType: 'canvas',
      strokeWidth: 2,
      showPoints: false,
      pointRadius: 3,
      curve: 'monotone',
      barWidth: 0.7,
      barSpacing: 0.1,
      ...config
    };
    
    // ✅ REMOVED: this.pathGenerator = new PathGenerator(...)
    // ✅ REMOVED: this.coordinateSystem = null
    
    console.log(`PanelDataRenderer created for ${this.config.chartType} charts`);
  }

  /**
   * ✅ FIXED: Render using centralized PathGenerator
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
        await this._renderBarDataset(transformedDataset, renderer, chartArea, { 
          xScale: xScale, 
          yScale: yScale 
        });
      }
      
      console.log(`PanelDataRenderer: Rendered ${this.config.chartType} dataset: ${dataset.name}`);
      
    } catch (error) {
      console.error('PanelDataRenderer: Error rendering dataset:', error);
      throw error;
    }
  }

  /**
   * ✅ FIXED: Use centralized PathGenerator instead of instance
   */
  async _renderLineDataset(transformedDataset, renderer, chartArea) {
    // ✅ Use static PathGenerator method instead of instance
    const pathData = await PathGenerator.generatePath(transformedDataset, {
      curve: this.config.curve,
      targetRenderer: this.config.rendererType,
      enableCoordinateValidation: true
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

  async _renderBarDataset(transformedDataset, renderer, chartArea, scales) {
    const formattedScales = {
      x: scales.xScale,
      y: scales.yScale
    };
    
    await renderer.renderBars([transformedDataset], formattedScales, {
      barWidth: this.config.barWidth,
      barSpacing: this.config.barSpacing,  
      showBorder: this.config.showBorder,
      borderWidth: this.config.borderWidth,
      chartArea: chartArea
    });
  }

  _transformDatasetCoordinates(dataset, xScale, yScale, chartArea) {
    const transformedData = dataset.data.map(point => {
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
   * ✅ SIMPLIFIED: Configuration methods (no more PathGenerator management)
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    console.log('PanelDataRenderer: Configuration updated');
  }

  setChartType(chartType) {
    if (!['line', 'bar'].includes(chartType)) {
      console.warn(`Invalid chart type: ${chartType}`);
      return;
    }
    
    this.config.chartType = chartType;
    console.log(`PanelDataRenderer: Chart type set to ${chartType}`);
  }

  // ✅ SIMPLIFIED: These methods now only update local config
  // PathGenerator configuration is handled centrally
  setCurveType(curveType) {
    this.config.curve = curveType;
    console.log(`PanelDataRenderer: Curve type set to ${curveType}`);
  }

  setRendererType(rendererType) {
    this.config.rendererType = rendererType;
    console.log(`PanelDataRenderer: Renderer type set to ${rendererType}`);
  }

  getInfo() {
    return {
      chartType: this.config.chartType,
      rendererType: this.config.rendererType,
      config: this.config
    };
  }
}

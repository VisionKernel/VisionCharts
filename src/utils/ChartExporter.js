/**
 * ChartExporter - Centralized chart export and serialization functionality
 * Handles SVG/PNG export, configuration serialization, and chart loading
 */
export default class ChartExporter {
  
  /**
   * Export chart as SVG
   * @param {Object} chart - Chart instance
   * @param {Object} options - Export options
   * @returns {string} SVG content as string
   */
  static exportSVG(chart, options = {}) {
    console.log('ChartExporter.exportSVG called');
    
    if (!chart.state.chart) {
      throw new Error('Cannot export SVG: chart element is null');
    }
    
    try {
      // Default options
      const exportOptions = {
        includeStyles: true,
        standalone: true,
        backgroundColor: '#ffffff',
        title: chart.options.title || 'Chart Export',
        description: chart.options.description || 'Exported chart from VisionCharts',
        ...options
      };
      
      // Clone the SVG element to avoid modifying the original
      const svgClone = chart.state.chart.cloneNode(true);
      
      // Apply export-specific modifications
      this.prepareSVGForExport(svgClone, exportOptions);
      
      // Add metadata
      this.addSVGMetadata(svgClone, exportOptions);
      
      // Get SVG content
      let svgContent = new XMLSerializer().serializeToString(svgClone);
      
      // Add XML declaration and DOCTYPE if standalone
      if (exportOptions.standalone) {
        svgContent = this.makeSVGStandalone(svgContent, exportOptions);
      }
      
      console.log('SVG export completed, content length:', svgContent.length);
      return svgContent;
    } catch (error) {
      console.error('Error exporting SVG:', error);
      throw error;
    }
  }
  
  /**
   * Export chart as PNG
   * @param {Object} chart - Chart instance
   * @param {Object} options - Export options
   * @returns {Promise<string>} PNG data URL
   */
  static async exportPNG(chart, options = {}) {
    console.log('ChartExporter.exportPNG called');
    
    if (!chart.state.chart) {
      throw new Error('Cannot export PNG: chart element is null');
    }
    
    try {
      // Default options
      const exportOptions = {
        width: chart.state.dimensions.width || 800,
        height: chart.state.dimensions.height || 600,
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff',
        quality: 0.95,
        ...options
      };
      
      console.log('PNG export options:', exportOptions);
      
      // First get SVG content
      const svgContent = this.exportSVG(chart, {
        includeStyles: true,
        standalone: true,
        backgroundColor: exportOptions.backgroundColor
      });
      
      // Convert SVG to PNG using canvas
      const pngDataUrl = await this.convertSVGToPNG(svgContent, exportOptions);
      
      console.log('PNG export completed');
      return pngDataUrl;
    } catch (error) {
      console.error('Error exporting PNG:', error);
      throw error;
    }
  }
  
  /**
   * Serialize chart configuration and data
   * @param {Object} chart - Chart instance
   * @param {Object} options - Serialization options
   * @returns {string} Serialized chart configuration as JSON string
   */
  static serialize(chart, options = {}) {
    console.log('ChartExporter.serialize called');
    
    try {
      // Default options
      const serializeOptions = {
        includeData: true,
        includeState: false,
        includeMetadata: true,
        pretty: false,
        version: '1.0',
        ...options
      };
      
      // Build serialization object
      const serialized = {
        // Metadata
        metadata: serializeOptions.includeMetadata ? {
          version: serializeOptions.version,
          exported: new Date().toISOString(),
          chartType: chart.options.chartType || 'line',
          library: 'VisionCharts'
        } : undefined,
        
        // Chart configuration
        config: this.serializeConfig(chart, serializeOptions),
        
        // Chart data
        data: serializeOptions.includeData ? this.serializeData(chart, serializeOptions) : undefined,
        
        // Chart state (optional)
        state: serializeOptions.includeState ? this.serializeState(chart, serializeOptions) : undefined
      };
      
      // Remove undefined properties
      Object.keys(serialized).forEach(key => {
        if (serialized[key] === undefined) {
          delete serialized[key];
        }
      });
      
      // Convert to JSON
      const jsonString = serializeOptions.pretty 
        ? JSON.stringify(serialized, null, 2)
        : JSON.stringify(serialized);
      
      console.log('Chart serialized, JSON length:', jsonString.length);
      return jsonString;
    } catch (error) {
      console.error('Error serializing chart:', error);
      throw error;
    }
  }
  
  /**
   * Load chart configuration from serialized data
   * @param {Object} chart - Chart instance
   * @param {string|Object} configData - Serialized configuration (JSON string or object)
   * @param {Object} options - Loading options
   * @returns {Object} Chart instance (for chaining)
   */
  static loadConfig(chart, configData, options = {}) {
    console.log('ChartExporter.loadConfig called');
    
    try {
      // Default options
      const loadOptions = {
        validateVersion: true,
        mergeWithExisting: false,
        updateChart: true,
        preserveState: false,
        ...options
      };
      
      // Parse configuration if it's a string
      let config;
      if (typeof configData === 'string') {
        config = JSON.parse(configData);
      } else {
        config = configData;
      }
      
      // Validate configuration
      this.validateSerializedConfig(config, loadOptions);
      
      // Load configuration
      if (loadOptions.mergeWithExisting) {
        // Merge with existing configuration
        chart.options = { ...chart.options, ...config.config };
        if (config.data) {
          chart.config.data = config.data;
        }
      } else {
        // Replace configuration
        chart.options = config.config;
        if (config.data) {
          chart.config.data = config.data;
        }
      }
      
      // Load state if available and requested
      if (config.state && loadOptions.preserveState) {
        chart.state = { ...chart.state, ...config.state };
      }
      
      // Update chart if requested
      if (loadOptions.updateChart) {
        chart.update();
      }
      
      console.log('Chart configuration loaded successfully');
      return chart;
    } catch (error) {
      console.error('Error loading chart configuration:', error);
      throw error;
    }
  }
  
  /**
   * Prepare SVG for export by applying styles and modifications
   * @private
   * @param {SVGElement} svgElement - SVG element to prepare
   * @param {Object} options - Export options
   */
  static prepareSVGForExport(svgElement, options) {
    // Set background if specified
    if (options.backgroundColor && options.backgroundColor !== 'transparent') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', options.backgroundColor);
      svgElement.insertBefore(rect, svgElement.firstChild);
    }
    
    // Include styles if requested
    if (options.includeStyles) {
      this.inlineStyles(svgElement);
    }
    
    // Ensure proper SVG attributes
    if (!svgElement.getAttribute('xmlns')) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    
    if (!svgElement.getAttribute('viewBox') && svgElement.getAttribute('width') && svgElement.getAttribute('height')) {
      const width = svgElement.getAttribute('width');
      const height = svgElement.getAttribute('height');
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
  }
  
  /**
   * Add metadata to SVG
   * @private
   * @param {SVGElement} svgElement - SVG element
   * @param {Object} options - Export options
   */
  static addSVGMetadata(svgElement, options) {
    // Add title
    if (options.title) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = options.title;
      svgElement.insertBefore(title, svgElement.firstChild);
    }
    
    // Add description
    if (options.description) {
      const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
      desc.textContent = options.description;
      svgElement.insertBefore(desc, svgElement.firstChild);
    }
  }
  
  /**
   * Make SVG standalone with XML declaration
   * @private
   * @param {string} svgContent - SVG content
   * @param {Object} options - Export options
   * @returns {string} Standalone SVG content
   */
  static makeSVGStandalone(svgContent, options) {
    let result = '<?xml version="1.0" encoding="UTF-8"?>\n';
    result += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n';
    result += svgContent;
    return result;
  }
  
  /**
   * Inline CSS styles into SVG elements
   * @private
   * @param {SVGElement} svgElement - SVG element
   */
  static inlineStyles(svgElement) {
    // Get all elements with classes
    const elementsWithClasses = svgElement.querySelectorAll('[class]');
    
    elementsWithClasses.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const styleString = this.extractRelevantStyles(computedStyle);
      
      if (styleString) {
        const existingStyle = element.getAttribute('style') || '';
        element.setAttribute('style', existingStyle + styleString);
      }
    });
  }
  
  /**
   * Extract relevant CSS styles for SVG export
   * @private
   * @param {CSSStyleDeclaration} computedStyle - Computed styles
   * @returns {string} Style string
   */
  static extractRelevantStyles(computedStyle) {
    const relevantProperties = [
      'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
      'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity',
      'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline'
    ];
    
    const styles = [];
    
    relevantProperties.forEach(prop => {
      const value = computedStyle.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'normal') {
        styles.push(`${prop}:${value}`);
      }
    });
    
    return styles.length > 0 ? styles.join(';') + ';' : '';
  }
  
  /**
   * Convert SVG to PNG using canvas
   * @private
   * @param {string} svgContent - SVG content
   * @param {Object} options - Export options
   * @returns {Promise<string>} PNG data URL
   */
  static async convertSVGToPNG(svgContent, options) {
    return new Promise((resolve, reject) => {
      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions
      canvas.width = options.width * options.scale;
      canvas.height = options.height * options.scale;
      
      // Scale context for high DPI
      ctx.scale(options.scale, options.scale);
      
      // Create image from SVG
      const img = new Image();
      
      img.onload = function() {
        // Fill background
        if (options.backgroundColor && options.backgroundColor !== 'transparent') {
          ctx.fillStyle = options.backgroundColor;
          ctx.fillRect(0, 0, options.width, options.height);
        }
        
        // Draw image
        ctx.drawImage(img, 0, 0, options.width, options.height);
        
        // Export as PNG
        try {
          const pngDataUrl = canvas.toDataURL('image/png', options.quality);
          resolve(pngDataUrl);
        } catch (error) {
          reject(new Error('Failed to export PNG: ' + error.message));
        }
      };
      
      img.onerror = function(error) {
        reject(new Error('Failed to load SVG for PNG export: ' + error.message));
      };
      
      // Convert SVG to data URL and load
      const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgContent)));
      img.src = svgDataUrl;
    });
  }
  
  /**
   * Serialize chart configuration
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} options - Serialization options
   * @returns {Object} Serialized configuration
   */
  static serializeConfig(chart, options) {
    // Create a clean copy of the configuration
    const config = { ...chart.options };
    
    // Remove non-serializable or internal properties
    const excludeProperties = [
      'container', 'element', 'onRender', 'onUpdate', 'onDestroy',
      'customRenderer', 'eventHandlers'
    ];
    
    excludeProperties.forEach(prop => {
      delete config[prop];
    });
    
    return config;
  }
  
  /**
   * Serialize chart data
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized data
   */
  static serializeData(chart, options) {
    if (chart.config.data) {
      return chart.config.data.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        color: dataset.color,
        data: dataset.data,
        type: dataset.type,
        // Include other dataset properties
        ...dataset
      }));
    }
    
    return [];
  }
  
  /**
   * Serialize chart state
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} options - Serialization options
   * @returns {Object} Serialized state
   */
  static serializeState(chart, options) {
    return {
      dimensions: chart.state.dimensions,
      rendered: chart.state.rendered,
      // Don't serialize DOM elements or functions
      // scales: chart.state.scales, // These are complex objects
    };
  }
  
  /**
   * Validate serialized configuration
   * @private
   * @param {Object} config - Configuration to validate
   * @param {Object} options - Loading options
   */
  static validateSerializedConfig(config, options) {
    if (!config) {
      throw new Error('Invalid configuration: configuration is null or undefined');
    }
    
    if (typeof config !== 'object') {
      throw new Error('Invalid configuration: configuration must be an object');
    }
    
    // Check version if validation is enabled
    if (options.validateVersion && config.metadata && config.metadata.version) {
      console.log('Configuration version:', config.metadata.version);
      // Could add version compatibility checks here
    }
    
    // Check for required properties
    if (!config.config) {
      throw new Error('Invalid configuration: missing config property');
    }
    
    if (typeof config.config !== 'object') {
      throw new Error('Invalid configuration: config property must be an object');
    }
  }
  
  /**
   * Download file with given content
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   */
  static downloadFile(content, filename, mimeType = 'text/plain') {
    console.log('ChartExporter.downloadFile called:', filename, mimeType);
    
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log('File download initiated:', filename);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
  
  /**
   * Export and download chart as SVG file
   * @param {Object} chart - Chart instance
   * @param {string} filename - Filename (optional)
   * @param {Object} options - Export options
   */
  static downloadSVG(chart, filename = 'chart.svg', options = {}) {
    console.log('ChartExporter.downloadSVG called');
    
    const svgContent = this.exportSVG(chart, options);
    this.downloadFile(svgContent, filename, 'image/svg+xml');
  }
  
  /**
   * Export and download chart as PNG file
   * @param {Object} chart - Chart instance
   * @param {string} filename - Filename (optional)
   * @param {Object} options - Export options
   */
  static async downloadPNG(chart, filename = 'chart.png', options = {}) {
    console.log('ChartExporter.downloadPNG called');
    
    const pngDataUrl = await this.exportPNG(chart, options);
    
    // Convert data URL to blob
    const response = await fetch(pngDataUrl);
    const blob = await response.blob();
    
    // Create object URL and download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Export and download chart configuration as JSON file
   * @param {Object} chart - Chart instance
   * @param {string} filename - Filename (optional)
   * @param {Object} options - Serialization options
   */
  static downloadConfig(chart, filename = 'chart-config.json', options = {}) {
    console.log('ChartExporter.downloadConfig called');
    
    const configJson = this.serialize(chart, { ...options, pretty: true });
    this.downloadFile(configJson, filename, 'application/json');
  }
}
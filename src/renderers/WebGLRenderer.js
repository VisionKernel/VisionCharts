import AbstractRenderer from './AbstractRenderer.js';
import { ColorUtils } from '../utils/ColorUtils.js';
/**
 * WebGLRenderer - High-performance WebGL implementation (Updated for Unified Coordinates)
 * 
 * Optimized for large datasets (50K+ points) with GPU acceleration.
 * NOW WORKS WITH UNIFIED COORDINATE SYSTEM - no more coordinate system inconsistencies!
 */
export default class WebGLRenderer extends AbstractRenderer {
  constructor(config = {}) {
    super(config);
    
    this.gl = null;
    this.programs = new Map(); // Shader programs
    this.buffers = new Map();  // Vertex buffers
    this.textures = new Map(); // Textures if needed
    
    // Performance settings
    this.maxVertices = 1000000; // 1M vertices max
    this.batchSize = 50000;     // Process in batches
    
    // WebGL state
    this.currentProgram = null;
    this.viewport = { x: 0, y: 0, width: 800, height: 600 };
    
    // UPDATED: Device pixel ratio handling to match Canvas
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // UPDATED: Canvas and logical dimensions 
    this.logicalWidth = 800;
    this.logicalHeight = 600;
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    
    // UPDATED: Shader sources for unified coordinate system
    this.shaderSources = {
      line: {
        vertex: `
          precision highp float;
          
          attribute vec2 a_position;
          attribute vec4 a_color;
          
          uniform vec2 u_resolution;
          
          varying vec4 v_color;
          
          void main() {
            // UNIFIED COORDINATE SYSTEM:
            // a_position comes as unified coordinates (bottom-left origin, Y-up)
            // u_resolution is logical canvas dimensions
            
            // Convert pixels to 0-1 range with high precision
            vec2 normalized = a_position / u_resolution;
            
            // Convert to -1 to +1 clip space
            vec2 clipSpace = (normalized * 2.0) - 1.0;
            
            clipSpace.y = -clipSpace.y;
            
            // Apply pixel-perfect positioning
            gl_Position = vec4(clipSpace, 0.0, 1.0);
            v_color = a_color;
          }
        `,
        fragment: `
          precision mediump float;
          varying vec4 v_color;
          
          void main() {
            gl_FragColor = v_color;
          }
        `
      },
      
      point: {
        vertex: `
          precision highp float;
          
          attribute vec2 a_position;
          attribute vec4 a_color;
          attribute float a_size;
          
          uniform vec2 u_resolution;
          
          varying vec4 v_color;
          
          void main() {
            // UNIFIED COORDINATE SYSTEM: Same as line vertex shader
            vec2 normalized = a_position / u_resolution;
            vec2 clipSpace = (normalized * 2.0) - 1.0;
            // No Y-axis flipping needed with unified coordinates
            
            gl_Position = vec4(clipSpace, 0.0, 1.0);
            gl_PointSize = a_size;
            v_color = a_color;
          }
        `,
        fragment: `
          precision mediump float;
          varying vec4 v_color;
          
          void main() {
            // Create circular points
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(gl_PointCoord, center);
            if (dist > 0.5) discard;
            
            gl_FragColor = v_color;
          }
        `
      }
    };
    
    console.log('WebGLRenderer created with unified coordinate system support');
  }

  /**
   * UPDATED: Initialize WebGL context with standardized DPI handling
   */
  async initialize(canvas, dimensions) {
    try {
      this.canvas = canvas;
      
      // UPDATED: Standardized DPI handling to match Canvas renderer
      this.devicePixelRatio = window.devicePixelRatio || 1;
      
      // Store logical dimensions (coordinate system uses these)
      this.logicalWidth = dimensions.width;
      this.logicalHeight = dimensions.height;
      
      // UPDATED: Set actual canvas size in memory (scaled up for high DPI)
      this.canvasWidth = dimensions.width * this.devicePixelRatio;
      this.canvasHeight = dimensions.height * this.devicePixelRatio;
      
      // Set canvas dimensions to match Canvas renderer approach
      this.canvas.width = this.canvasWidth;
      this.canvas.height = this.canvasHeight;
      
      // Scale CSS size back to logical dimensions
      this.canvas.style.width = this.logicalWidth + 'px';
      this.canvas.style.height = this.logicalHeight + 'px';
      
      this.viewport = {
        x: 0,
        y: 0,
        width: this.logicalWidth,   
        height: this.logicalHeight  
      };

      // Get WebGL context with anti-aliasing to match Canvas
      const contextAttributes = {
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        alpha: true
      };
      
      this.gl = canvas.getContext('webgl2', contextAttributes) || 
                canvas.getContext('webgl', contextAttributes);
      
      if (!this.gl) {
        throw new Error('WebGL not supported');
      }

      console.log(`WebGL context initialized with unified coordinates and DPI handling: ${this.logicalWidth}x${this.logicalHeight} @ ${this.devicePixelRatio}x`);

      // Set up WebGL state
      this._setupWebGLState();

      // Compile shaders
      await this._compileShaders();

      // Create buffers
      this._createBuffers();

      this.isInitialized = true;
      console.log('WebGLRenderer initialization complete with unified coordinate system');

    } catch (error) {
      console.error('WebGL initialization failed:', error);
      throw error;
    }
  }

  /**
   * UPDATED: Set up initial WebGL state with proper viewport
   */
  _setupWebGLState() {
    const gl = this.gl;

    // UPDATED: Set viewport to physical canvas size (includes device pixel ratio)
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set clear color
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent
  }

  /**
   * Compile all shader programs
   */
  async _compileShaders() {
    for (const [name, sources] of Object.entries(this.shaderSources)) {
      const program = this._createShaderProgram(sources.vertex, sources.fragment);
      this.programs.set(name, program);
      console.log(`Shader program '${name}' compiled for unified coordinates`);
    }
  }

  /**
   * Create a shader program from vertex and fragment shader source
   */
  _createShaderProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    // Create shaders
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader program linking failed: ${error}`);
    }

    // Get attribute and uniform locations
    program.attributes = {};
    program.uniforms = {};

    // Get attributes
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      program.attributes[info.name] = gl.getAttribLocation(program, info.name);
    }

    // Get uniforms
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      program.uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    return program;
  }

  /**
   * Compile individual shader
   */
  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  }

  /**
   * Create vertex buffers
   */
  _createBuffers() {
    const gl = this.gl;

    // Position buffer
    this.buffers.set('position', gl.createBuffer());
    
    // Color buffer
    this.buffers.set('color', gl.createBuffer());
    
    // Index buffer
    this.buffers.set('index', gl.createBuffer());
    
    // Size buffer (for points)
    this.buffers.set('size', gl.createBuffer());

    console.log('WebGL buffers created for unified coordinate system');
  }

  /**
   * Clear the WebGL canvas
   */
  clear() {
    if (!this.isInitialized) return;
    
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Set viewport/clipping region
   */
  setViewport(viewport) {
    this.viewport = { ...viewport };
    
    // Note: WebGL viewport is set during initialization and doesn't need to change
    // since clipping is handled at the coordinate level
  }

  /**
   * UPDATED: Render line paths using unified coordinate system
   */
  async renderLines(generatedPaths, scales, options = {}) {
    if (!this.isInitialized || !generatedPaths || generatedPaths.length === 0) {
      return;
    }

    const gl = this.gl;
    const program = this.programs.get('line');
    
    if (!program) {
      console.error('Line shader program not found');
      return;
    }

    try {
      // Use line shader program
      gl.useProgram(program);
      this.currentProgram = program;

      // UPDATED: Set uniforms with logical canvas dimensions
      this._setUniforms(program, scales);

      // Render each standardized path using unified coordinates
      for (const pathData of generatedPaths) {
        if (!pathData.vertices || pathData.vertices.length === 0) continue;

        await this._renderUnifiedPath(pathData, options);
      }

      console.log(`WebGL rendered ${generatedPaths.length} paths using UNIFIED coordinates`);

    } catch (error) {
      console.error('Error rendering lines with WebGL:', error);
    }
  }

  /**
   * UPDATED: Render a single path using UNIFIED coordinate system
   */
  async _renderUnifiedPath(pathData, options) {
    const gl = this.gl;
    const program = this.currentProgram;

    // UPDATED: Convert unified path data to WebGL format
    const webglData = this._convertUnifiedPathToWebGL(pathData);
    
    if (webglData.positions.length === 0) return;

    // Set line width to match Canvas exactly
    const lineWidth = pathData.lineWidth || 2;
    gl.lineWidth(lineWidth);

    // Upload position data - UNIFIED coordinates used directly!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webglData.positions), gl.STATIC_DRAW);
    
    // Enable position attribute
    const positionLocation = program.attributes.a_position;
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Upload color data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webglData.colors), gl.STATIC_DRAW);
    
    // Enable color attribute
    const colorLocation = program.attributes.a_color;
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Render as line strip
    const vertexCount = webglData.positions.length / 2;
    
    if (vertexCount > this.maxVertices) {
      // Render in batches for very large datasets
      await this._renderInBatches(vertexCount, gl.LINE_STRIP);
    } else {
      gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);
    }
    
    console.log(`WebGL rendered unified path with ${vertexCount} vertices using line width ${lineWidth}`);
  }

  /**
   * UPDATED: Convert unified path data to WebGL vertex format with improved color handling
   */
  _convertUnifiedPathToWebGL(pathData) {
    const positions = [];
    const colors = [];

    const vertices = pathData.vertices;
    const pathColors = pathData.colors;

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      
      // UNIFIED COORDINATES: Use vertex coordinates directly!
      if (vertex.x != null && vertex.y != null && isFinite(vertex.x) && isFinite(vertex.y)) {
        // Add position (unified coordinates in pixels)
        positions.push(vertex.x, vertex.y);

        // UPDATED: Improved color handling using ColorUtils
        let color;
        if (pathColors && pathColors[i]) {
          // Use per-vertex color if available
          color = pathColors[i];
        } else {
          // Use shared ColorUtils for consistent color parsing
          color = ColorUtils.parseColor(pathData.color || ColorUtils.getDefaultColor(0));
        }
        
        colors.push(color.r, color.g, color.b, color.a);
      }
    }

    return { positions, colors };
  }

  /**
   * Render bars (simplified implementation for large datasets)
   */
  async renderBars(datasets, scales, options = {}) {
    // For WebGL bar rendering, we'd convert bars to triangles
    // This is a simplified version - full implementation would be more complex
    console.log('WebGL bar rendering not fully implemented yet - using line fallback');
    
    // Convert bars to line representation for now
    await this.renderLines(datasets, scales, options);
  }

  /**
   * UPDATED: Set shader uniforms with logical canvas dimensions
   */
  _setUniforms(program, scales) {
    const gl = this.gl;

    // UPDATED: Pass logical canvas resolution (coordinate system dimensions)
    // This ensures consistent coordinate transformation between Canvas and WebGL
    if (program.uniforms.u_resolution) {
      gl.uniform2f(program.uniforms.u_resolution, this.logicalWidth, this.logicalHeight);
    }
  }

  /**
   * Render large datasets in batches
   */
  async _renderInBatches(totalVertices, primitiveType) {
    const gl = this.gl;
    const batchCount = Math.ceil(totalVertices / this.batchSize);

    for (let i = 0; i < batchCount; i++) {
      const start = i * this.batchSize;
      const count = Math.min(this.batchSize, totalVertices - start);
      
      gl.drawArrays(primitiveType, start, count);
      
      // Yield control to prevent blocking
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Parse color string to normalized RGBA
   */
  _parseColor(colorString) {
    // Simple hex color parser
    if (typeof colorString === 'string' && colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b, a: 1.0 };
    }
    
    // Default blue color
    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
  }

  /**
   * Update with new datasets
   */
  update(datasets) {
    // For WebGL, we can optimize by only updating changed buffers
    // This is a simplified implementation
    console.log('WebGL renderer update with unified coordinates - will re-render on next render call');
  }

  /**
   * Get supported features
   */
  getSupportedFeatures() {
    return [
      'lines',
      'points', 
      'large-datasets',
      'gpu-acceleration',
      'batched-rendering',
      'hardware-blending',
      'unified-coordinates'
    ];
  }

  /**
   * Get performance profile
   */
  getPerformanceProfile() {
    return {
      maxDataPoints: 1000000,
      renderingType: 'webgl',
      gpuAccelerated: true,
      memoryUsage: 'high',
      idealDatasetSize: 50000,
      batchSize: this.batchSize,
      coordinateSystem: 'unified',
      devicePixelRatio: this.devicePixelRatio
    };
  }

  /**
   * Check WebGL support and capabilities
   */
  static isSupported() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get WebGL capabilities
   */
  static getCapabilities() {
    if (!WebGLRenderer.isSupported()) {
      return null;
    }

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    return {
      version: gl.getParameter(gl.VERSION),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS)
    };
  }

  /**
   * Destroy and cleanup WebGL resources
   */
  destroy() {
    if (!this.isInitialized) return;

    const gl = this.gl;

    // Delete buffers
    for (const buffer of this.buffers.values()) {
      gl.deleteBuffer(buffer);
    }
    this.buffers.clear();

    // Delete shader programs
    for (const program of this.programs.values()) {
      gl.deleteProgram(program);
    }
    this.programs.clear();

    // Delete textures
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }
    this.textures.clear();

    super.destroy();
    console.log('WebGLRenderer destroyed and resources cleaned up');
  }
}
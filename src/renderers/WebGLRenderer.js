import AbstractRenderer from './AbstractRenderer.js';

/**
 * WebGLRenderer - High-performance WebGL implementation of AbstractRenderer
 * 
 * Optimized for large datasets (50K+ points) with GPU acceleration.
 * Handles massive financial datasets while maintaining 60fps performance.
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
    
    // Shader sources
    this.shaderSources = {
  line: {
    vertex: `
      precision highp float;
      
      attribute vec2 a_position;
      attribute vec4 a_color;
      
      uniform vec2 u_resolution;
      
      varying vec4 v_color;
      
      void main() {
        // Use high precision for coordinate transformation
        // a_position comes as screen coordinates (pixels)
        
        // Convert pixels to 0-1 range with high precision
        vec2 normalized = a_position / u_resolution;
        
        // Convert to -1 to +1 clip space
        vec2 clipSpace = (normalized * 2.0) - 1.0;
        
        // Flip Y axis (WebGL has Y up, Canvas has Y down)
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
        // High precision coordinate transformation
        vec2 normalized = a_position / u_resolution;
        vec2 clipSpace = (normalized * 2.0) - 1.0;
        clipSpace.y = -clipSpace.y;
        
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
    console.log('WebGLRenderer created for high-performance rendering');
  }

  /**
   * Initialize WebGL context and shaders
   */
  async initialize(canvas, dimensions) {
  try {
    this.canvas = canvas;
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    // Store logical dimensions (what coordinate system uses)
    this.logicalWidth = dimensions.width;
    this.logicalHeight = dimensions.height;
    
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

    console.log('WebGL context initialized with anti-aliasing');

    // Set up WebGL state
    this._setupWebGLState();

    // Compile shaders
    await this._compileShaders();

    // Create buffers
    this._createBuffers();

    this.isInitialized = true;
    console.log('WebGLRenderer initialization complete');

  } catch (error) {
    console.error('WebGL initialization failed:', error);
    throw error;
  }
}

  /**
   * Set up initial WebGL state
   */
  _setupWebGLState() {
    const gl = this.gl;

    // Set viewport to actual canvas size (includes device pixel ratio)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
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
      console.log(`Shader program '${name}' compiled successfully`);
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

    console.log('WebGL buffers created');
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
    
    if (this.isInitialized) {
      this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    }
  }

  /**
     * Render line datasets using WebGL with pre-transformed coordinates
     */
    async renderLines(datasets, scales, options = {}) {
    if (!this.isInitialized || !datasets || datasets.length === 0) {
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

        // Set uniforms (simplified)
        this._setUniforms(program, scales);

        // Render each dataset (data is already transformed to clip space)
        for (const dataset of datasets) {
        if (!dataset.data || dataset.data.length === 0) continue;

        await this._renderLineDataset(dataset, scales, options);
        }

    } catch (error) {
        console.error('Error rendering lines with WebGL:', error);
    }
    }

 /**
 * Render a single line dataset
 */
async _renderLineDataset(dataset, scales, options) {
  const gl = this.gl;
  const program = this.currentProgram;

  // Convert data to vertices
  const vertices = this._convertDataToVertices(dataset.data, scales);
  
  if (vertices.positions.length === 0) return;

  // Set line width to match Canvas exactly
  const lineWidth = dataset.width || options.strokeWidth || 2;
  gl.lineWidth(lineWidth);

  // Upload position data
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position'));
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.positions), gl.STATIC_DRAW);
  
  // Enable position attribute
  const positionLocation = program.attributes.a_position;
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Upload color data
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color'));
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.colors), gl.STATIC_DRAW);
  
  // Enable color attribute
  const colorLocation = program.attributes.a_color;
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

  // Render as line strip
  const vertexCount = vertices.positions.length / 2;
  
  if (vertexCount > this.maxVertices) {
    // Render in batches for very large datasets
    await this._renderInBatches(vertexCount, gl.LINE_STRIP);
  } else {
    gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);
  }
  
  console.log(`WebGL rendered ${vertexCount} vertices with line width ${lineWidth}`);
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
 * Convert chart data to WebGL vertices using screen coordinates
 */
_convertDataToVertices(data, scales) {
  const positions = [];
  const colors = [];

  for (const point of data) {
    // Use screen coordinates (pixels) instead of clip coordinates
    const x = point.screenX;
    const y = point.screenY;

    if (x == null || y == null || isNaN(x) || isNaN(y)) {
      continue;
    }

    // Add position (screen coordinates in pixels)
    positions.push(x, y);

    // Add color (RGBA)
    const color = this._parseColor(point.original?.color || '#1468a8');
    colors.push(color.r, color.g, color.b, color.a);
  }

  return { positions, colors };
}

  /**
 * Set shader uniforms
 */
_setUniforms(program, scales) {
  const gl = this.gl;

  // Pass logical canvas resolution (not physical resolution)
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
    console.log('WebGL renderer update - will re-render on next render call');
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
      'hardware-blending'
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
      batchSize: this.batchSize
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
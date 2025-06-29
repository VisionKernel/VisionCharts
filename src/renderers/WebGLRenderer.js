import AbstractRenderer from './AbstractRenderer.js';

/**
 * WebGLRenderer - High-performance WebGL implementation of AbstractRenderer
 * 
 * Optimized for large datasets (100K+ points) with GPU acceleration.
 * Handles massive financial datasets while maintaining 60fps performance.
 */
export default class WebGLRenderer extends AbstractRenderer {
  constructor(container, width, height, options = {}) {
    super(container, width, height, options);
    
    this.canvas = null;
    this.gl = null;
    this.programs = new Map(); // Shader programs
    this.buffers = new Map(); // Vertex buffers
    this.textures = new Map(); // Texture atlas for text
    this.createdBuffers = new Set(); // Track created buffers for cleanup
    
    // WebGL state
    this.currentProgram = null;
    this.viewMatrix = null;
    this.projectionMatrix = null;
    this.elements = new Map(); // Element tracking for hit testing
    this.elementIdCounter = 0;
    
    // Batch rendering with overflow protection
    this.batchBuffers = {
      lines: { vertices: [], colors: [], indices: [] },
      points: { vertices: [], colors: [], sizes: [] },
      triangles: { vertices: [], colors: [], indices: [] }
    };
    this.maxBatchSize = 65536; // Max vertices per batch
    this.batchOverflowCount = 0; // Track overflow events
    
    // Event handling
    this.eventListeners = new Map();
    this.boundEventHandlers = new Map();
    
    // High DPI support
    this.pixelRatio = this.options.devicePixelRatio;
    this.scaledWidth = width * this.pixelRatio;
    this.scaledHeight = height * this.pixelRatio;
    
    // Text rendering fallback with z-index management
    this.textCanvas = null;
    this.textContext = null;
    this.textElements = []; // Track text elements for z-order
    this.baseZIndex = 1000; // Base z-index for overlays
    this.maxZIndex = this.baseZIndex;
  }

  // ===== LIFECYCLE METHODS =====
  
  async initialize() {
    try {
      // Create WebGL canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.scaledWidth;
      this.canvas.height = this.scaledHeight;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.canvas.style.background = this.options.backgroundColor;
      
      // Get WebGL context
      this.gl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: this.options.antialiasing,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });
      
      // Fallback to WebGL 1 if WebGL 2 not available
      if (!this.gl) {
        this.gl = this.canvas.getContext('webgl', {
          alpha: true,
          antialias: this.options.antialiasing,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance'
        });
      }
      
      if (!this.gl) {
        throw new Error('WebGL not supported');
      }
      
      // Initialize WebGL state
      this._initializeWebGL();
      
      // Create shader programs with proper attribute bindings
      await this._createShaderPrograms();
      
      // Create text rendering overlay
      this._initializeTextOverlay();
      
      // Add canvas to container
      this.container.appendChild(this.canvas);
      
      // Setup matrices
      this._setupMatrices();
      
      this.isInitialized = true;
      console.log('WebGLRenderer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize WebGLRenderer:', error);
      throw error;
    }
  }
  
  destroy() {
    // Clean up WebGL resources
    this.programs.forEach(program => {
      if (this.gl && program) {
        this.gl.deleteProgram(program);
      }
    });
    
    this.buffers.forEach(buffer => {
      if (this.gl && buffer) {
        this.gl.deleteBuffer(buffer);
      }
    });
    
    // Clean up tracked buffers
    this.createdBuffers.forEach(buffer => {
      if (this.gl && buffer) {
        this.gl.deleteBuffer(buffer);
      }
    });
    
    this.textures.forEach(texture => {
      if (this.gl && texture) {
        this.gl.deleteTexture(texture);
      }
    });
    
    // Remove event listeners
    this.eventListeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.canvas?.removeEventListener(event, handler);
      });
    });
    
    // Clean up text overlay
    if (this.textCanvas && this.textCanvas.parentNode) {
      this.textCanvas.parentNode.removeChild(this.textCanvas);
    }
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    // Clear references
    this.programs.clear();
    this.buffers.clear();
    this.textures.clear();
    this.elements.clear();
    this.eventListeners.clear();
    this.boundEventHandlers.clear();
    this.createdBuffers.clear();
    this.textElements = [];
    
    this.canvas = null;
    this.gl = null;
    this.textCanvas = null;
    this.textContext = null;
    this.isInitialized = false;
    
    console.log('WebGLRenderer destroyed');
  }
  
  resize(width, height) {
    this._ensureInitialized();
    
    this.width = width;
    this.height = height;
    this.scaledWidth = width * this.pixelRatio;
    this.scaledHeight = height * this.pixelRatio;
    
    // Resize WebGL canvas
    this.canvas.width = this.scaledWidth;
    this.canvas.height = this.scaledHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Resize text overlay
    if (this.textCanvas) {
      this.textCanvas.width = this.scaledWidth;
      this.textCanvas.height = this.scaledHeight;
      this.textCanvas.style.width = `${width}px`;
      this.textCanvas.style.height = `${height}px`;
    }
    
    // Update WebGL viewport
    this.gl.viewport(0, 0, this.scaledWidth, this.scaledHeight);
    
    // Update projection matrix
    this._setupMatrices();
    
    this.clear();
  }
  
  clear(color = null) {
    this._ensureInitialized();
    
    const bg = color || this.options.backgroundColor;
    
    // Clear WebGL canvas
    if (bg && bg !== 'transparent') {
      const rgba = this._parseColor(bg);
      this.gl.clearColor(rgba.r, rgba.g, rgba.b, rgba.a);
    } else {
      this.gl.clearColor(0, 0, 0, 0);
    }
    
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Clear text overlay
    if (this.textContext) {
      this.textContext.clearRect(0, 0, this.width, this.height);
    }
    
    // Clear element tracking
    this.elements.clear();
    this.elementIdCounter = 0;
    this.textElements = [];
    this.maxZIndex = this.baseZIndex;
    
    // Reset batch buffers
    this._resetBatchBuffers();
    
    this._incrementStats(1, 0);
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  save() {
    this._ensureInitialized();
    // WebGL doesn't have built-in save/restore, so we manage state manually
    this._matrixStack = this._matrixStack || [];
    this._matrixStack.push({
      view: new Float32Array(this.viewMatrix),
      projection: new Float32Array(this.projectionMatrix)
    });
  }
  
  restore() {
    this._ensureInitialized();
    if (this._matrixStack && this._matrixStack.length > 0) {
      const state = this._matrixStack.pop();
      this.viewMatrix = state.view;
      this.projectionMatrix = state.projection;
      this._updateMatrixUniforms();
    }
  }
  
  transform(a, b, c, d, e, f) {
    this._ensureInitialized();
    // Apply 2D transformation matrix to view matrix
    const transform = new Float32Array([
      a, b, 0, e,
      c, d, 0, f,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
    this._multiplyMatrix(this.viewMatrix, transform);
    this._updateMatrixUniforms();
  }
  
  translate(x, y) {
    this._ensureInitialized();
    this.transform(1, 0, 0, 1, x, y);
  }
  
  setClipBounds(x, y, width, height) {
    this._ensureInitialized();
    // Use WebGL scissor test for clipping
    this.gl.enable(this.gl.SCISSOR_TEST);
    // Convert from chart coordinates to WebGL coordinates (flip Y)
    const glY = this.height - y - height;
    this.gl.scissor(x * this.pixelRatio, glY * this.pixelRatio, 
                   width * this.pixelRatio, height * this.pixelRatio);
    this.currentClipBounds = { x, y, width, height };
  }
  
  clearClipBounds() {
    this._ensureInitialized();
    this.gl.disable(this.gl.SCISSOR_TEST);
    this.currentClipBounds = null;
  }

  // ===== BASIC DRAWING OPERATIONS =====
  
  drawLine(x1, y1, x2, y2, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    // Add to batch buffer
    const color = this._parseColor(normalizedStyle.stroke);
    const vertices = [x1, y1, x2, y2];
    const colors = [color.r, color.g, color.b, color.a, color.r, color.g, color.b, color.a];
    
    // Check for batch overflow before adding
    if (this._checkBatchOverflow('lines', 4, colors.length)) {
      this._flushLineBatch();
    }
    
    this.batchBuffers.lines.vertices.push(...vertices);
    this.batchBuffers.lines.colors.push(...colors);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'line',
      bounds: { x: Math.min(x1, x2), y: Math.min(y1, y2), 
               width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
      coords: { x1, y1, x2, y2 },
      style: normalizedStyle
    });
    
    this._incrementStats(0, 1);
    return elementId;
  }
  
  drawRect(x, y, width, height, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    // Convert rectangle to triangles
    const vertices = [
      x, y,           // Top-left
      x + width, y,   // Top-right
      x, y + height,  // Bottom-left
      x + width, y + height  // Bottom-right
    ];
    
    const indices = [0, 1, 2, 1, 2, 3]; // Two triangles
    const color = this._parseColor(normalizedStyle.fill || normalizedStyle.stroke);
    const colors = new Array(16).fill(0);
    for (let i = 0; i < 16; i += 4) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
      colors[i + 3] = color.a;
    }
    
    // Check for batch overflow before adding
    if (this._checkBatchOverflow('triangles', vertices.length, colors.length, indices.length)) {
      this._flushTriangleBatch();
    }
    
    // Add to batch buffer
    const baseIndex = this.batchBuffers.triangles.vertices.length / 2;
    this.batchBuffers.triangles.vertices.push(...vertices);
    this.batchBuffers.triangles.colors.push(...colors);
    this.batchBuffers.triangles.indices.push(...indices.map(i => i + baseIndex));
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'rect',
      bounds: { x, y, width, height },
      style: normalizedStyle
    });
    
    this._incrementStats(0, 1);
    return elementId;
  }
  
  drawCircle(cx, cy, radius, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    // Add to point batch buffer (will be rendered as circles in shader)
    const color = this._parseColor(normalizedStyle.fill || normalizedStyle.stroke);
    
    // Check for batch overflow before adding
    if (this._checkBatchOverflow('points', 2, 4, 0, 1)) {
      this._flushPointBatch();
    }
    
    this.batchBuffers.points.vertices.push(cx, cy);
    this.batchBuffers.points.colors.push(color.r, color.g, color.b, color.a);
    this.batchBuffers.points.sizes.push(radius * 2); // Diameter
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'circle',
      bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
      coords: { cx, cy, radius },
      style: normalizedStyle
    });
    
    this._incrementStats(0, 1);
    return elementId;
  }
  
  drawPath(pathData, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    let points;
    if (typeof pathData === 'string') {
      points = this._parseSVGPath(pathData);
    } else if (Array.isArray(pathData)) {
      points = pathData;
    } else {
      throw new Error('Invalid path data format');
    }
    
    // Convert path to line segments
    if (points.length > 1) {
      const color = this._parseColor(normalizedStyle.stroke);
      
      // Check for batch overflow before adding
      const vertexCount = (points.length - 1) * 4;
      const colorCount = (points.length - 1) * 8;
      if (this._checkBatchOverflow('lines', vertexCount, colorCount)) {
        this._flushLineBatch();
      }
      
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        
        this.batchBuffers.lines.vertices.push(x1, y1, x2, y2);
        this.batchBuffers.lines.colors.push(
          color.r, color.g, color.b, color.a,
          color.r, color.g, color.b, color.a
        );
      }
    }
    
    // Handle area fill if needed
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this._addPathFillToBatch(points, normalizedStyle.fill);
    }
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'path',
      bounds: this._calculatePathBounds(points),
      pathData: points,
      style: normalizedStyle
    });
    
    this._incrementStats(0, 1);
    return elementId;
  }
  
  drawText(text, x, y, style = {}) {
    this._ensureInitialized();
    
    // Use Canvas overlay for text rendering (WebGL text is complex)
    if (!this.textContext) {
      console.warn('Text overlay not available');
      return null;
    }
    
    const normalizedStyle = this._normalizeStyle({
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      zIndex: this.baseZIndex,
      ...style
    });
    
    const elementId = this._generateElementId();
    
    // Handle z-index for text elements
    const zIndex = normalizedStyle.zIndex || this.maxZIndex + 1;
    this.maxZIndex = Math.max(this.maxZIndex, zIndex);
    
    // Scale coordinates for high DPI
    const scaledX = x * this.pixelRatio;
    const scaledY = y * this.pixelRatio;
    
    // Apply text styles to canvas context
    this.textContext.font = `${parseInt(normalizedStyle.fontSize) * this.pixelRatio}px ${normalizedStyle.fontFamily}`;
    this.textContext.textAlign = normalizedStyle.textAlign || 'left';
    this.textContext.textBaseline = normalizedStyle.textBaseline || 'alphabetic';
    this.textContext.fillStyle = normalizedStyle.fill || normalizedStyle.stroke || '#000000';
    
    // Store text element for z-order rendering
    const textElement = {
      text,
      x: scaledX,
      y: scaledY,
      zIndex,
      style: normalizedStyle
    };
    
    this.textElements.push(textElement);
    
    // Re-render text overlay with proper z-ordering
    this._renderTextOverlay();
    
    // Store element for hit testing
    const metrics = this.textContext.measureText(text);
    this.elements.set(elementId, {
      type: 'text',
      bounds: { 
        x, 
        y: y - parseInt(normalizedStyle.fontSize) || y - 12, 
        width: metrics.width / this.pixelRatio, 
        height: parseInt(normalizedStyle.fontSize) || 12
      },
      text,
      style: normalizedStyle,
      zIndex
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }

  // ===== ADVANCED DRAWING OPERATIONS =====
  
  createGroup(attributes = {}) {
    // WebGL doesn't have native groups, simulate with matrix operations
    const groupId = this._generateElementId();
    this.save();
    
    if (attributes.transform) {
      this._applyTransform(attributes.transform);
    }
    
    return {
      id: groupId,
      restore: () => this.restore()
    };
  }
  
  drawGradientArea(pathData, gradientConfig, style = {}) {
    this._ensureInitialized();
    
    // For now, use solid color as WebGL gradients require more complex shader setup
    console.warn('WebGL gradients not yet implemented, using solid color');
    
    const fallbackColor = gradientConfig.stops?.[0]?.color || '#000000';
    return this.drawPath(pathData, { ...style, fill: fallbackColor });
  }
  
  batchDraw(type, elements, commonStyle = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(commonStyle);
    const elementIds = [];
    
    elements.forEach(element => {
      const elementId = this._generateElementId();
      elementIds.push(elementId);
      
      switch (type) {
        case 'line':
          this.drawLine(element.x1, element.y1, element.x2, element.y2, normalizedStyle);
          break;
        case 'circle':
          this.drawCircle(element.cx, element.cy, element.radius, normalizedStyle);
          break;
        case 'rect':
          this.drawRect(element.x, element.y, element.width, element.height, normalizedStyle);
          break;
      }
    });
    
    return elementIds;
  }

  // ===== BATCH RENDERING =====
  
  flush() {
    this._ensureInitialized();
    this._flushLineBatch();
    this._flushPointBatch();
    this._flushTriangleBatch();
  }
  
  _flushLineBatch() {
    if (this.batchBuffers.lines.vertices.length === 0) return;
    
    const program = this.programs.get('line');
    this.gl.useProgram(program);
    this.currentProgram = program;
    
    // Create and bind vertex buffer
    const vertexBuffer = this._createManagedBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.lines.vertices), this.gl.STATIC_DRAW);
    
    // Create and bind color buffer
    const colorBuffer = this._createManagedBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.lines.colors), this.gl.STATIC_DRAW);
    
    // Set up attributes
    this._setupLineAttributes(program, vertexBuffer, colorBuffer);
    
    // Draw
    const vertexCount = this.batchBuffers.lines.vertices.length / 2;
    this.gl.drawArrays(this.gl.LINES, 0, vertexCount);
    
    // Clean up managed buffers
    this._deleteManagedBuffer(vertexBuffer);
    this._deleteManagedBuffer(colorBuffer);
    
    // Reset batch
    this.batchBuffers.lines.vertices = [];
    this.batchBuffers.lines.colors = [];
    
    this._incrementStats(1, vertexCount / 2);
  }
  
  _flushPointBatch() {
    if (this.batchBuffers.points.vertices.length === 0) return;
    
    const program = this.programs.get('point');
    this.gl.useProgram(program);
    this.currentProgram = program;
    
    // Create and bind buffers
    const vertexBuffer = this._createManagedBuffer();
    const colorBuffer = this._createManagedBuffer();
    const sizeBuffer = this._createManagedBuffer();
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.points.vertices), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.points.colors), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sizeBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.points.sizes), this.gl.STATIC_DRAW);
    
    // Set up attributes
    this._setupPointAttributes(program, vertexBuffer, colorBuffer, sizeBuffer);
    
    // Draw
    const pointCount = this.batchBuffers.points.vertices.length / 2;
    this.gl.drawArrays(this.gl.POINTS, 0, pointCount);
    
    // Clean up managed buffers
    this._deleteManagedBuffer(vertexBuffer);
    this._deleteManagedBuffer(colorBuffer);
    this._deleteManagedBuffer(sizeBuffer);
    
    // Reset batch
    this.batchBuffers.points.vertices = [];
    this.batchBuffers.points.colors = [];
    this.batchBuffers.points.sizes = [];
    
    this._incrementStats(1, pointCount);
  }
  
  _flushTriangleBatch() {
    if (this.batchBuffers.triangles.vertices.length === 0) return;
    
    const program = this.programs.get('triangle');
    this.gl.useProgram(program);
    this.currentProgram = program;
    
    // Create and bind buffers
    const vertexBuffer = this._createManagedBuffer();
    const colorBuffer = this._createManagedBuffer();
    const indexBuffer = this._createManagedBuffer();
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.triangles.vertices), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.triangles.colors), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.batchBuffers.triangles.indices), this.gl.STATIC_DRAW);
    
    // Set up attributes
    this._setupTriangleAttributes(program, vertexBuffer, colorBuffer);
    
    // Draw
    const indexCount = this.batchBuffers.triangles.indices.length;
    this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    
    // Clean up managed buffers
    this._deleteManagedBuffer(vertexBuffer);
    this._deleteManagedBuffer(colorBuffer);
    this._deleteManagedBuffer(indexBuffer);
    
    // Reset batch
    this.batchBuffers.triangles.vertices = [];
    this.batchBuffers.triangles.colors = [];
    this.batchBuffers.triangles.indices = [];
    
    this._incrementStats(1, indexCount / 3);
  }

  // ===== WEBGL INITIALIZATION AND HELPERS =====
  
  _initializeWebGL() {
    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Enable depth testing
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    
    // Set viewport
    this.gl.viewport(0, 0, this.scaledWidth, this.scaledHeight);
    
    // Initialize matrices
    this.viewMatrix = new Float32Array(16);
    this.projectionMatrix = new Float32Array(16);
    this._matrixStack = [];
  }
  
  async _createShaderPrograms() {
    // Create line shader program with proper attribute bindings
    const lineVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getLineVertexShader());
    const lineFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getLineFragmentShader());
    const lineProgram = this._createProgramWithAttributeBindings(lineVertexShader, lineFragmentShader, [
      { name: 'a_position', location: 0 },
      { name: 'a_color', location: 1 }
    ]);
    this.programs.set('line', lineProgram);
    
    // Create point shader program with proper attribute bindings
    const pointVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getPointVertexShader());
    const pointFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getPointFragmentShader());
    const pointProgram = this._createProgramWithAttributeBindings(pointVertexShader, pointFragmentShader, [
      { name: 'a_position', location: 0 },
      { name: 'a_color', location: 1 },
      { name: 'a_size', location: 2 }
    ]);
    this.programs.set('point', pointProgram);
    
    // Create triangle shader program with proper attribute bindings
    const triangleVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getTriangleVertexShader());
    const triangleFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getTriangleFragmentShader());
    const triangleProgram = this._createProgramWithAttributeBindings(triangleVertexShader, triangleFragmentShader, [
      { name: 'a_position', location: 0 },
      { name: 'a_color', location: 1 }
    ]);
    this.programs.set('triangle', triangleProgram);
  }
  
  _initializeTextOverlay() {
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = this.scaledWidth;
    this.textCanvas.height = this.scaledHeight;
    this.textCanvas.style.width = `${this.width}px`;
    this.textCanvas.style.height = `${this.height}px`;
    this.textCanvas.style.position = 'absolute';
    this.textCanvas.style.top = '0';
    this.textCanvas.style.left = '0';
    this.textCanvas.style.pointerEvents = 'none';
    this.textCanvas.style.zIndex = this.baseZIndex.toString();
    
    this.textContext = this.textCanvas.getContext('2d');
    if (this.textContext) {
      this.textContext.scale(this.pixelRatio, this.pixelRatio);
    }
    
    // Add text overlay to container
    this.container.style.position = 'relative';
    this.container.appendChild(this.textCanvas);
  }
  
  _setupMatrices() {
    // Set up orthographic projection matrix for 2D rendering
    this._ortho(this.projectionMatrix, 0, this.width, this.height, 0, -1, 1);
    
    // Set up identity view matrix
    this._identity(this.viewMatrix);
    
    this._updateMatrixUniforms();
  }
  
  _updateMatrixUniforms() {
    if (this.currentProgram) {
      const projectionLocation = this.gl.getUniformLocation(this.currentProgram, 'u_projection');
      const viewLocation = this.gl.getUniformLocation(this.currentProgram, 'u_view');
      
      if (projectionLocation) {
        this.gl.uniformMatrix4fv(projectionLocation, false, this.projectionMatrix);
      }
      if (viewLocation) {
        this.gl.uniformMatrix4fv(viewLocation, false, this.viewMatrix);
      }
    }
  }
  
  _generateElementId() {
    return `webgl-element-${++this.elementIdCounter}`;
  }
  
  _resetBatchBuffers() {
    this.batchBuffers.lines.vertices = [];
    this.batchBuffers.lines.colors = [];
    this.batchBuffers.points.vertices = [];
    this.batchBuffers.points.colors = [];
    this.batchBuffers.points.sizes = [];
    this.batchBuffers.triangles.vertices = [];
    this.batchBuffers.triangles.colors = [];
    this.batchBuffers.triangles.indices = [];
  }
  
  _parseColor(colorString) {
    // Enhanced color parser
    if (!colorString) return { r: 0, g: 0, b: 0, a: 1.0 };
    
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      if (hex.length === 3) {
        // Short hex format (#RGB)
        const r = parseInt(hex[0] + hex[0], 16) / 255;
        const g = parseInt(hex[1] + hex[1], 16) / 255;
        const b = parseInt(hex[2] + hex[2], 16) / 255;
        return { r, g, b, a: 1.0 };
      } else if (hex.length === 6) {
        // Full hex format (#RRGGBB)
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return { r, g, b, a: 1.0 };
      }
    } else if (colorString.startsWith('rgb')) {
      // RGB/RGBA format
      const match = colorString.match(/rgba?\(([^)]+)\)/);
      if (match) {
        const values = match[1].split(',').map(v => parseFloat(v.trim()));
        return {
          r: values[0] / 255,
          g: values[1] / 255,
          b: values[2] / 255,
          a: values.length > 3 ? values[3] : 1.0
        };
      }
    }
    
    // Default fallback
    return { r: 0, g: 0, b: 0, a: 1.0 };
  }
  
  _createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${info}`);
    }
    
    return shader;
  }
  
  _createProgramWithAttributeBindings(vertexShader, fragmentShader, attributeBindings = []) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    
    // Bind attribute locations before linking
    attributeBindings.forEach(binding => {
      this.gl.bindAttribLocation(program, binding.location, binding.name);
    });
    
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program linking error: ${info}`);
    }
    
    return program;
  }

  // Shader source code
  _getLineVertexShader() {
    return `
      attribute vec2 a_position;
      attribute vec4 a_color;
      
      uniform mat4 u_projection;
      uniform mat4 u_view;
      
      varying vec4 v_color;
      
      void main() {
        gl_Position = u_projection * u_view * vec4(a_position, 0.0, 1.0);
        v_color = a_color;
      }
    `;
  }
  
  _getLineFragmentShader() {
    return `
      precision mediump float;
      
      varying vec4 v_color;
      
      void main() {
        gl_FragColor = v_color;
      }
    `;
  }
  
  _getPointVertexShader() {
    return `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_size;
      
      uniform mat4 u_projection;
      uniform mat4 u_view;
      
      varying vec4 v_color;
      
      void main() {
        gl_Position = u_projection * u_view * vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
        v_color = a_color;
      }
    `;
  }
  
  _getPointFragmentShader() {
    return `
      precision mediump float;
      
      varying vec4 v_color;
      
      void main() {
        // Create circular points
        vec2 center = gl_PointCoord - 0.5;
        float distance = length(center);
        if (distance > 0.5) {
          discard;
        }
        gl_FragColor = v_color;
      }
    `;
  }
  
  _getTriangleVertexShader() {
    return this._getLineVertexShader(); // Same as line shader
  }
  
  _getTriangleFragmentShader() {
    return this._getLineFragmentShader(); // Same as line shader
  }
  
  _setupLineAttributes(program, vertexBuffer, colorBuffer) {
    // Use pre-bound attribute locations
    const positionLocation = 0;
    const colorLocation = 1;
    
    // Position attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Color attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.enableVertexAttribArray(colorLocation);
    this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    
    this._updateMatrixUniforms();
  }
  
  _setupPointAttributes(program, vertexBuffer, colorBuffer, sizeBuffer) {
    // Use pre-bound attribute locations
    const positionLocation = 0;
    const colorLocation = 1;
    const sizeLocation = 2;
    
    // Position attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    
    // Color attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.enableVertexAttribArray(colorLocation);
    this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    
    // Size attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sizeBuffer);
    this.gl.enableVertexAttribArray(sizeLocation);
    this.gl.vertexAttribPointer(sizeLocation, 1, this.gl.FLOAT, false, 0, 0);
    
    this._updateMatrixUniforms();
  }
  
  _setupTriangleAttributes(program, vertexBuffer, colorBuffer) {
    this._setupLineAttributes(program, vertexBuffer, colorBuffer);
  }

  // Matrix utility functions
  _identity(matrix) {
    matrix.fill(0);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
  }
  
  _ortho(matrix, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    
    matrix[0] = -2 * lr;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = -2 * bt;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 2 * nf;
    matrix[11] = 0;
    matrix[12] = (left + right) * lr;
    matrix[13] = (top + bottom) * bt;
    matrix[14] = (far + near) * nf;
    matrix[15] = 1;
  }
  
  _multiplyMatrix(a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    a.set(result);
  }

  // ===== ENHANCED SVG PATH PARSING AND TRIANGULATION =====
  
  _parseSVGPath(pathString) {
    // Enhanced SVG path parser with proper triangulation support
    const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    const points = [];
    let currentX = 0, currentY = 0;
    let startX = 0, startY = 0;
    let lastControlX = 0, lastControlY = 0;
    
    commands.forEach(command => {
      const type = command[0];
      const isRelative = type.toLowerCase() === type;
      const args = command.slice(1).trim().split(/[\s,]+/).filter(v => v).map(Number);
      
      switch (type.toLowerCase()) {
        case 'm': // Move to
          if (args.length >= 2) {
            const x = isRelative ? currentX + args[0] : args[0];
            const y = isRelative ? currentY + args[1] : args[1];
            currentX = x;
            currentY = y;
            startX = x;
            startY = y;
            points.push([x, y]);
            
            // Additional coordinate pairs are treated as line commands
            for (let i = 2; i < args.length; i += 2) {
              const lx = isRelative ? currentX + args[i] : args[i];
              const ly = isRelative ? currentY + args[i + 1] : args[i + 1];
              currentX = lx;
              currentY = ly;
              points.push([lx, ly]);
            }
          }
          break;
          
        case 'l': // Line to
          for (let i = 0; i < args.length; i += 2) {
            const x = isRelative ? currentX + args[i] : args[i];
            const y = isRelative ? currentY + args[i + 1] : args[i + 1];
            currentX = x;
            currentY = y;
            points.push([x, y]);
          }
          break;
          
        case 'h': // Horizontal line
          args.forEach(x => {
            currentX = isRelative ? currentX + x : x;
            points.push([currentX, currentY]);
          });
          break;
          
        case 'v': // Vertical line
          args.forEach(y => {
            currentY = isRelative ? currentY + y : y;
            points.push([currentX, currentY]);
          });
          break;
          
        case 'c': // Cubic Bezier curve
          for (let i = 0; i < args.length; i += 6) {
            const cp1x = isRelative ? currentX + args[i] : args[i];
            const cp1y = isRelative ? currentY + args[i + 1] : args[i + 1];
            const cp2x = isRelative ? currentX + args[i + 2] : args[i + 2];
            const cp2y = isRelative ? currentY + args[i + 3] : args[i + 3];
            const x = isRelative ? currentX + args[i + 4] : args[i + 4];
            const y = isRelative ? currentY + args[i + 5] : args[i + 5];
            
            // Approximate curve with line segments
            const curvePoints = this._approximateCubicBezier(currentX, currentY, cp1x, cp1y, cp2x, cp2y, x, y);
            points.push(...curvePoints.slice(1)); // Skip first point (already in path)
            
            currentX = x;
            currentY = y;
            lastControlX = cp2x;
            lastControlY = cp2y;
          }
          break;
          
        case 's': // Smooth cubic Bezier curve
          for (let i = 0; i < args.length; i += 4) {
            const cp1x = 2 * currentX - lastControlX;
            const cp1y = 2 * currentY - lastControlY;
            const cp2x = isRelative ? currentX + args[i] : args[i];
            const cp2y = isRelative ? currentY + args[i + 1] : args[i + 1];
            const x = isRelative ? currentX + args[i + 2] : args[i + 2];
            const y = isRelative ? currentY + args[i + 3] : args[i + 3];
            
            const curvePoints = this._approximateCubicBezier(currentX, currentY, cp1x, cp1y, cp2x, cp2y, x, y);
            points.push(...curvePoints.slice(1));
            
            currentX = x;
            currentY = y;
            lastControlX = cp2x;
            lastControlY = cp2y;
          }
          break;
          
        case 'q': // Quadratic Bezier curve
          for (let i = 0; i < args.length; i += 4) {
            const cpx = isRelative ? currentX + args[i] : args[i];
            const cpy = isRelative ? currentY + args[i + 1] : args[i + 1];
            const x = isRelative ? currentX + args[i + 2] : args[i + 2];
            const y = isRelative ? currentY + args[i + 3] : args[i + 3];
            
            const curvePoints = this._approximateQuadraticBezier(currentX, currentY, cpx, cpy, x, y);
            points.push(...curvePoints.slice(1));
            
            currentX = x;
            currentY = y;
            lastControlX = cpx;
            lastControlY = cpy;
          }
          break;
          
        case 't': // Smooth quadratic Bezier curve
          for (let i = 0; i < args.length; i += 2) {
            const cpx = 2 * currentX - lastControlX;
            const cpy = 2 * currentY - lastControlY;
            const x = isRelative ? currentX + args[i] : args[i];
            const y = isRelative ? currentY + args[i + 1] : args[i + 1];
            
            const curvePoints = this._approximateQuadraticBezier(currentX, currentY, cpx, cpy, x, y);
            points.push(...curvePoints.slice(1));
            
            currentX = x;
            currentY = y;
            lastControlX = cpx;
            lastControlY = cpy;
          }
          break;
          
        case 'a': // Elliptical arc
          for (let i = 0; i < args.length; i += 7) {
            const rx = args[i];
            const ry = args[i + 1];
            const xAxisRotation = args[i + 2];
            const largeArcFlag = args[i + 3];
            const sweepFlag = args[i + 4];
            const x = isRelative ? currentX + args[i + 5] : args[i + 5];
            const y = isRelative ? currentY + args[i + 6] : args[i + 6];
            
            const arcPoints = this._approximateEllipticalArc(currentX, currentY, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y);
            points.push(...arcPoints.slice(1));
            
            currentX = x;
            currentY = y;
          }
          break;
          
        case 'z': // Close path
          if (startX !== currentX || startY !== currentY) {
            points.push([startX, startY]);
            currentX = startX;
            currentY = startY;
          }
          break;
      }
    });
    
    return points;
  }
  
  _approximateCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, segments = 20) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
      const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
      points.push([x, y]);
    }
    return points;
  }
  
  _approximateQuadraticBezier(x0, y0, x1, y1, x2, y2, segments = 15) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      
      const x = mt2 * x0 + 2 * mt * t * x1 + t2 * x2;
      const y = mt2 * y0 + 2 * mt * t * y1 + t2 * y2;
      points.push([x, y]);
    }
    return points;
  }
  
  _approximateEllipticalArc(x1, y1, rx, ry, phi, fA, fS, x2, y2, segments = 20) {
    // Simplified arc approximation - can be enhanced for full SVG compliance
    const points = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // For now, approximate with straight line segments
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + t * dx;
      const y = y1 + t * dy;
      points.push([x, y]);
    }
    return points;
  }
  
  _calculatePathBounds(pathData) {
    if (Array.isArray(pathData) && pathData.length > 0) {
      const xs = pathData.map(p => p[0]);
      const ys = pathData.map(p => p[1]);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      };
    }
    return { x: 0, y: 0, width: this.width, height: this.height };
  }
  
  _addPathFillToBatch(points, fillColor) {
    // Enhanced triangulation for path filling
    if (points.length < 3) return;
    
    const color = this._parseColor(fillColor);
    
    // Check for batch overflow before adding
    const vertexCount = points.length * 2;
    const colorCount = points.length * 4;
    const maxTriangles = Math.max(0, points.length - 2);
    const indexCount = maxTriangles * 3;
    
    if (this._checkBatchOverflow('triangles', vertexCount, colorCount, indexCount)) {
      this._flushTriangleBatch();
    }
    
    const baseIndex = this.batchBuffers.triangles.vertices.length / 2;
    
    // Add vertices and colors
    points.forEach(([x, y]) => {
      this.batchBuffers.triangles.vertices.push(x, y);
      this.batchBuffers.triangles.colors.push(color.r, color.g, color.b, color.a);
    });
    
    // Create triangle fan from first vertex (works for convex polygons)
    // For complex shapes, would need proper triangulation algorithm
    for (let i = 1; i < points.length - 1; i++) {
      this.batchBuffers.triangles.indices.push(
        baseIndex,
        baseIndex + i,
        baseIndex + i + 1
      );
    }
  }

  // ===== BATCH OVERFLOW PROTECTION =====
  
  _checkBatchOverflow(type, vertexCount = 0, colorCount = 0, indexCount = 0, sizeCount = 0) {
    const buffer = this.batchBuffers[type];
    
    switch (type) {
      case 'lines':
        return (buffer.vertices.length + vertexCount) >= this.maxBatchSize * 2 ||
               (buffer.colors.length + colorCount) >= this.maxBatchSize * 4;
      case 'points':
        return (buffer.vertices.length + vertexCount) >= this.maxBatchSize * 2 ||
               (buffer.colors.length + colorCount) >= this.maxBatchSize * 4 ||
               (buffer.sizes.length + sizeCount) >= this.maxBatchSize;
      case 'triangles':
        return (buffer.vertices.length + vertexCount) >= this.maxBatchSize * 2 ||
               (buffer.colors.length + colorCount) >= this.maxBatchSize * 4 ||
               (buffer.indices.length + indexCount) >= this.maxBatchSize * 3;
      default:
        return false;
    }
  }

  // ===== MEMORY MANAGEMENT =====
  
  _createManagedBuffer() {
    const buffer = this.gl.createBuffer();
    this.createdBuffers.add(buffer);
    return buffer;
  }
  
  _deleteManagedBuffer(buffer) {
    if (buffer) {
      this.gl.deleteBuffer(buffer);
      this.createdBuffers.delete(buffer);
    }
  }

  // ===== TEXT OVERLAY Z-INDEX MANAGEMENT =====
  
  _renderTextOverlay() {
    if (!this.textContext) return;
    
    // Clear previous text
    this.textContext.clearRect(0, 0, this.width, this.height);
    
    // Sort text elements by z-index
    const sortedTextElements = [...this.textElements].sort((a, b) => a.zIndex - b.zIndex);
    
    // Render text elements in z-order
    sortedTextElements.forEach(element => {
      this.textContext.font = `${parseInt(element.style.fontSize) * this.pixelRatio}px ${element.style.fontFamily}`;
      this.textContext.textAlign = element.style.textAlign || 'left';
      this.textContext.textBaseline = element.style.textBaseline || 'alphabetic';
      this.textContext.fillStyle = element.style.fill || element.style.stroke || '#000000';
      
      this.textContext.fillText(element.text, element.x, element.y);
    });
    
    // Update text canvas z-index to highest
    this.textCanvas.style.zIndex = this.maxZIndex.toString();
  }

  // ===== UTILITY METHODS =====
  
  _isPointInElement(x, y, element) {
    const bounds = element.bounds;
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
  }
  
  _applyTransform(transformString) {
    // Parse and apply 2D transformations
    if (transformString.includes('translate')) {
      const match = transformString.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) {
        this.translate(parseFloat(match[1]), parseFloat(match[2]));
      }
    }
    if (transformString.includes('rotate')) {
      const match = transformString.match(/rotate\(([^)]+)\)/);
      if (match) {
        const angle = parseFloat(match[1]) * Math.PI / 180; // Convert to radians
        this.transform(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0);
      }
    }
    if (transformString.includes('scale')) {
      const match = transformString.match(/scale\(([^,)]+),?([^)]*)\)/);
      if (match) {
        const sx = parseFloat(match[1]);
        const sy = match[2] ? parseFloat(match[2]) : sx;
        this.transform(sx, 0, 0, sy, 0, 0);
      }
    }
  }
}
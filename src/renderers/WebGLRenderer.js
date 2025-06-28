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
    
    // WebGL state
    this.currentProgram = null;
    this.viewMatrix = null;
    this.projectionMatrix = null;
    this.elements = new Map(); // Element tracking for hit testing
    this.elementIdCounter = 0;
    
    // Batch rendering
    this.batchBuffers = {
      lines: { vertices: [], colors: [], indices: [] },
      points: { vertices: [], colors: [], sizes: [] },
      triangles: { vertices: [], colors: [], indices: [] }
    };
    this.maxBatchSize = 65536; // Max vertices per batch
    
    // Event handling
    this.eventListeners = new Map();
    this.boundEventHandlers = new Map();
    
    // High DPI support
    this.pixelRatio = this.options.devicePixelRatio;
    this.scaledWidth = width * this.pixelRatio;
    this.scaledHeight = height * this.pixelRatio;
    
    // Text rendering fallback (Canvas overlay)
    this.textCanvas = null;
    this.textContext = null;
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
      
      // Create shader programs
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
    
    // Reset batch buffers
    this._resetBatchBuffers();
    
    this._incrementStats(1, 0);
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  save() {
    this._ensureInitialized();
    // WebGL doesn't have built-in save/restore, so we manage state manually
    // For now, we'll implement basic matrix stack
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
    
    this.batchBuffers.lines.vertices.push(...vertices);
    this.batchBuffers.lines.colors.push(...colors);
    
    // Check if we need to flush batch
    if (this.batchBuffers.lines.vertices.length >= this.maxBatchSize * 2) {
      this._flushLineBatch();
    }
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'line',
      bounds: { x: Math.min(x1, x2), y: Math.min(y1, y2), 
               width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
      coords: { x1, y1, x2, y2 },
      style: normalizedStyle
    });
    
    this._incrementStats(0, 1); // Will count draw call when batch is flushed
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
    const colors = new Array(8).fill(0);
    for (let i = 0; i < 8; i += 4) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
      colors[i + 3] = color.a;
    }
    
    // Add to batch buffer
    const baseIndex = this.batchBuffers.triangles.vertices.length / 2;
    this.batchBuffers.triangles.vertices.push(...vertices);
    this.batchBuffers.triangles.colors.push(...colors);
    this.batchBuffers.triangles.indices.push(...indices.map(i => i + baseIndex));
    
    // Check if we need to flush batch
    if (this.batchBuffers.triangles.vertices.length >= this.maxBatchSize * 2) {
      this._flushTriangleBatch();
    }
    
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
    
    this.batchBuffers.points.vertices.push(cx, cy);
    this.batchBuffers.points.colors.push(color.r, color.g, color.b, color.a);
    this.batchBuffers.points.sizes.push(radius * 2); // Diameter
    
    // Check if we need to flush batch
    if (this.batchBuffers.points.vertices.length >= this.maxBatchSize * 2) {
      this._flushPointBatch();
    }
    
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
      bounds: this._calculatePathBounds(pathData),
      pathData,
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
      ...style
    });
    
    const elementId = this._generateElementId();
    
    // Scale coordinates for high DPI
    const scaledX = x * this.pixelRatio;
    const scaledY = y * this.pixelRatio;
    
    // Apply text styles to canvas context
    this.textContext.font = `${parseInt(normalizedStyle.fontSize) * this.pixelRatio}px ${normalizedStyle.fontFamily}`;
    this.textContext.textAlign = normalizedStyle.textAlign || 'left';
    this.textContext.textBaseline = normalizedStyle.textBaseline || 'alphabetic';
    this.textContext.fillStyle = normalizedStyle.fill || normalizedStyle.stroke || '#000000';
    
    // Draw text
    this.textContext.fillText(text, scaledX, scaledY);
    
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
      style: normalizedStyle
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
    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.lines.vertices), this.gl.STATIC_DRAW);
    
    // Create and bind color buffer
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.lines.colors), this.gl.STATIC_DRAW);
    
    // Set up attributes
    this._setupLineAttributes(program, vertexBuffer, colorBuffer);
    
    // Draw
    const vertexCount = this.batchBuffers.lines.vertices.length / 2;
    this.gl.drawArrays(this.gl.LINES, 0, vertexCount);
    
    // Clean up
    this.gl.deleteBuffer(vertexBuffer);
    this.gl.deleteBuffer(colorBuffer);
    
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
    const vertexBuffer = this.gl.createBuffer();
    const colorBuffer = this.gl.createBuffer();
    const sizeBuffer = this.gl.createBuffer();
    
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
    
    // Clean up
    this.gl.deleteBuffer(vertexBuffer);
    this.gl.deleteBuffer(colorBuffer);
    this.gl.deleteBuffer(sizeBuffer);
    
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
    const vertexBuffer = this.gl.createBuffer();
    const colorBuffer = this.gl.createBuffer();
    const indexBuffer = this.gl.createBuffer();
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.triangles.vertices), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.batchBuffers.triangles.colors), this.gl.STATIC_DRAW);
    
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.batchBuffers.triangles.indices), this.gl.STATIC_DRAW);
    
    // Set up attributes
    this._setupTriangleAttributes(program, vertexBuffer, colorBuffer);
    
    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.batchBuffers.triangles.indices.length, this.gl.UNSIGNED_SHORT, 0);
    
    // Clean up
    this.gl.deleteBuffer(vertexBuffer);
    this.gl.deleteBuffer(colorBuffer);
    this.gl.deleteBuffer(indexBuffer);
    
    // Reset batch
    this.batchBuffers.triangles.vertices = [];
    this.batchBuffers.triangles.colors = [];
    this.batchBuffers.triangles.indices = [];
    
    this._incrementStats(1, this.batchBuffers.triangles.indices.length / 3);
  }

  // ===== EVENT AND INTERACTION SUPPORT =====
  
  screenToChart(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left) * (this.width / rect.width),
      y: (screenY - rect.top) * (this.height / rect.height)
    };
  }
  
  chartToScreen(chartX, chartY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (chartX * rect.width / this.width) + rect.left,
      y: (chartY * rect.height / this.height) + rect.top
    };
  }
  
  hitTest(x, y) {
    // Simplified hit testing - could be improved with GPU-based picking
    const hitElements = [];
    
    this.elements.forEach((element, id) => {
      if (this._isPointInElement(x, y, element)) {
        hitElements.push({ id, element });
      }
    });
    
    return hitElements;
  }
  
  addEventListener(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event).add(handler);
    
    const boundHandler = (e) => {
      const chartCoords = this.screenToChart(e.clientX, e.clientY);
      handler({
        ...e,
        chartX: chartCoords.x,
        chartY: chartCoords.y
      });
    };
    
    this.boundEventHandlers.set(handler, boundHandler);
    this.canvas.addEventListener(event, boundHandler);
  }
  
  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(handler);
    }
    
    if (this.boundEventHandlers.has(handler)) {
      const boundHandler = this.boundEventHandlers.get(handler);
      this.canvas.removeEventListener(event, boundHandler);
      this.boundEventHandlers.delete(handler);
    }
  }

  // ===== CAPABILITY AND PERFORMANCE =====
  
  getCapabilities() {
    return {
      type: 'webgl',
      supportsGradients: false, // Not yet implemented
      supportsClipping: true,
      supportsTransforms: true,
      supportsTextMetrics: false, // Limited by Canvas overlay
      supportsBatchOperations: true,
      supportsAntialiasing: true,
      maxDataPoints: 10000000, // 10M points
      optimalDataPoints: 1000000 // 1M points
    };
  }
  
  optimizeForDataSize(dataSize) {
    if (dataSize > 1000000) {
      // Increase batch size for very large datasets
      this.maxBatchSize = 131072;
      console.log('WebGLRenderer: Increased batch size for very large dataset');
    } else {
      this.maxBatchSize = 65536;
    }
  }

  // ===== UTILITY METHODS =====
  
  measureText(text, style = {}) {
    if (!this.textContext) return { width: 0, height: 12 };
    
    const fontSize = style.fontSize || '12px';
    const fontFamily = style.fontFamily || 'Arial, sans-serif';
    
    const prevFont = this.textContext.font;
    this.textContext.font = `${fontSize} ${fontFamily}`;
    
    const metrics = this.textContext.measureText(text);
    
    this.textContext.font = prevFont;
    
    return {
      width: metrics.width / this.pixelRatio,
      height: parseInt(fontSize) || 12
    };
  }
  
  generatePath(points, curveType = 'linear') {
    // Return points array - WebGL handles path generation differently
    return points;
  }
  
  applyStyles(element, styles) {
    console.warn('WebGL elements cannot have styles applied after creation');
  }
  
  async export(format = 'png') {
    this._ensureInitialized();
    
    // Flush all pending operations
    this.flush();
    
    switch (format.toLowerCase()) {
      case 'png':
      case 'jpeg':
      case 'webp':
        return this.canvas.toDataURL(`image/${format}`, 0.9);
      case 'blob':
        return new Promise(resolve => {
          this.canvas.toBlob(resolve, 'image/png', 0.9);
        });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ===== INTERNAL HELPER METHODS =====
  
  _initializeWebGL() {
    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Set viewport
    this.gl.viewport(0, 0, this.scaledWidth, this.scaledHeight);
    
    // Initialize matrices
    this.viewMatrix = new Float32Array(16);
    this.projectionMatrix = new Float32Array(16);
    this._matrixStack = [];
  }
  
  async _createShaderPrograms() {
    // Create line shader program
    const lineVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getLineVertexShader());
    const lineFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getLineFragmentShader());
    const lineProgram = this._createProgram(lineVertexShader, lineFragmentShader);
    this.programs.set('line', lineProgram);
    
    // Create point shader program
    const pointVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getPointVertexShader());
    const pointFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getPointFragmentShader());
    const pointProgram = this._createProgram(pointVertexShader, pointFragmentShader);
    this.programs.set('point', pointProgram);
    
    // Create triangle shader program
    const triangleVertexShader = this._createShader(this.gl.VERTEX_SHADER, this._getTriangleVertexShader());
    const triangleFragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, this._getTriangleFragmentShader());
    const triangleProgram = this._createProgram(triangleVertexShader, triangleFragmentShader);
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
    this.textCanvas.style.zIndex = '1';
    
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
    // Simple color parser - could be enhanced
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b, a: 1.0 };
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
  
  _createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
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
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    const colorLocation = this.gl.getAttribLocation(program, 'a_color');
    
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
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    const colorLocation = this.gl.getAttribLocation(program, 'a_color');
    const sizeLocation = this.gl.getAttribLocation(program, 'a_size');
    
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
  
  // Additional helper methods would go here...
  _parseSVGPath(pathString) {
    // Simplified SVG path parser - could be enhanced
    const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    const points = [];
    let currentX = 0, currentY = 0;
    
    commands.forEach(command => {
      const type = command[0];
      const args = command.slice(1).trim().split(/[\s,]+/).map(Number);
      
      switch (type) {
        case 'M':
          currentX = args[0];
          currentY = args[1];
          points.push([currentX, currentY]);
          break;
        case 'L':
          currentX = args[0];
          currentY = args[1];
          points.push([currentX, currentY]);
          break;
        // Add more path commands as needed
      }
    });
    
    return points;
  }
  
  _calculatePathBounds(pathData) {
    if (Array.isArray(pathData)) {
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
    // Convert path to triangles for filling
    // This is a simplified triangulation - could be enhanced
    if (points.length < 3) return;
    
    const color = this._parseColor(fillColor);
    const baseIndex = this.batchBuffers.triangles.vertices.length / 2;
    
    // Add vertices
    points.forEach(([x, y]) => {
      this.batchBuffers.triangles.vertices.push(x, y);
      this.batchBuffers.triangles.colors.push(color.r, color.g, color.b, color.a);
    });
    
    // Create triangle fan from first vertex
    for (let i = 1; i < points.length - 1; i++) {
      this.batchBuffers.triangles.indices.push(
        baseIndex,
        baseIndex + i,
        baseIndex + i + 1
      );
    }
  }
  
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
  }
}
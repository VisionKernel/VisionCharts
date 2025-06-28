import AbstractRenderer from './AbstractRenderer.js';

/**
 * CanvasRenderer - HTML5 Canvas implementation of AbstractRenderer
 * 
 * Primary renderer for VisionCharts, optimized for datasets up to 100K points.
 * Provides excellent performance and broad browser compatibility.
 */
export default class CanvasRenderer extends AbstractRenderer {
  constructor(container, width, height, options = {}) {
    super(container, width, height, options);
    
    this.canvas = null;
    this.context = null;
    this.offscreenCanvas = null;
    this.offscreenContext = null;
    
    // Canvas-specific state
    this.transformStack = [];
    this.styleStack = [];
    this.currentStyle = {};
    this.elements = new Map(); // For hit testing and element tracking
    this.elementIdCounter = 0;
    
    // Event handling
    this.eventListeners = new Map();
    this.boundEventHandlers = new Map();
    
    // High DPI support
    this.pixelRatio = this.options.devicePixelRatio;
    this.scaledWidth = width * this.pixelRatio;
    this.scaledHeight = height * this.pixelRatio;
  }

  // ===== LIFECYCLE METHODS =====
  
  async initialize() {
    try {
      // Create main canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.scaledWidth;
      this.canvas.height = this.scaledHeight;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.canvas.style.background = this.options.backgroundColor;
      
      // Get 2D context
      this.context = this.canvas.getContext('2d', {
        alpha: true,
        antialias: this.options.antialiasing,
        willReadFrequently: false // Optimize for frequent drawing
      });
      
      if (!this.context) {
        throw new Error('Failed to get 2D rendering context');
      }
      
      // Scale context for high DPI
      this.context.scale(this.pixelRatio, this.pixelRatio);
      
      // Create offscreen canvas for better performance
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreenCanvas = new OffscreenCanvas(this.scaledWidth, this.scaledHeight);
        this.offscreenContext = this.offscreenCanvas.getContext('2d');
        if (this.offscreenContext) {
          this.offscreenContext.scale(this.pixelRatio, this.pixelRatio);
        }
      }
      
      // Add canvas to container
      this.container.appendChild(this.canvas);
      
      // Set default styles
      this._setDefaultStyles();
      
      this.isInitialized = true;
      console.log('CanvasRenderer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize CanvasRenderer:', error);
      throw error;
    }
  }
  
  destroy() {
    // Remove event listeners
    this.eventListeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.canvas?.removeEventListener(event, handler);
      });
    });
    
    // Clear references
    this.eventListeners.clear();
    this.boundEventHandlers.clear();
    this.elements.clear();
    this.transformStack = [];
    this.styleStack = [];
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.context = null;
    this.offscreenCanvas = null;
    this.offscreenContext = null;
    this.isInitialized = false;
    
    console.log('CanvasRenderer destroyed');
  }
  
  resize(width, height) {
    this._ensureInitialized();
    
    this.width = width;
    this.height = height;
    this.scaledWidth = width * this.pixelRatio;
    this.scaledHeight = height * this.pixelRatio;
    
    // Resize main canvas
    this.canvas.width = this.scaledWidth;
    this.canvas.height = this.scaledHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Rescale context
    this.context.scale(this.pixelRatio, this.pixelRatio);
    
    // Resize offscreen canvas if available
    if (this.offscreenCanvas && this.offscreenContext) {
      this.offscreenCanvas.width = this.scaledWidth;
      this.offscreenCanvas.height = this.scaledHeight;
      this.offscreenContext.scale(this.pixelRatio, this.pixelRatio);
    }
    
    this._setDefaultStyles();
    this.clear();
  }
  
  clear(color = null) {
    this._ensureInitialized();
    
    const bg = color || this.options.backgroundColor;
    
    // Clear the canvas
    this.context.clearRect(0, 0, this.width, this.height);
    
    // Fill with background color if specified
    if (bg && bg !== 'transparent') {
      this.context.fillStyle = bg;
      this.context.fillRect(0, 0, this.width, this.height);
    }
    
    // Clear element tracking
    this.elements.clear();
    this.elementIdCounter = 0;
    
    this._incrementStats(1, 0);
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  save() {
    this._ensureInitialized();
    this.context.save();
    
    // Save our custom state
    this.transformStack.push({ ...this.currentTransform });
    this.styleStack.push({ ...this.currentStyle });
  }
  
  restore() {
    this._ensureInitialized();
    this.context.restore();
    
    // Restore our custom state
    if (this.transformStack.length > 0) {
      this.currentTransform = this.transformStack.pop();
    }
    if (this.styleStack.length > 0) {
      this.currentStyle = this.styleStack.pop();
    }
  }
  
  transform(a, b, c, d, e, f) {
    this._ensureInitialized();
    this.context.transform(a, b, c, d, e, f);
  }
  
  translate(x, y) {
    this._ensureInitialized();
    this.context.translate(x, y);
  }
  
  setClipBounds(x, y, width, height) {
    this._ensureInitialized();
    
    this.context.save();
    this.context.beginPath();
    this.context.rect(x, y, width, height);
    this.context.clip();
    
    this.currentClipBounds = { x, y, width, height };
  }
  
  clearClipBounds() {
    this._ensureInitialized();
    
    if (this.currentClipBounds) {
      this.context.restore();
      this.currentClipBounds = null;
    }
  }

  // ===== BASIC DRAWING OPERATIONS =====
  
  drawLine(x1, y1, x2, y2, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    this.context.beginPath();
    this.context.moveTo(x1, y1);
    this.context.lineTo(x2, y2);
    
    this._applyCanvasStyle(normalizedStyle);
    this.context.stroke();
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'line',
      bounds: { x: Math.min(x1, x2), y: Math.min(y1, y2), 
               width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
      coords: { x1, y1, x2, y2 },
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }
  
  drawRect(x, y, width, height, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    this._applyCanvasStyle(normalizedStyle);
    
    // Draw fill if specified
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this.context.fillRect(x, y, width, height);
    }
    
    // Draw stroke if specified
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this.context.strokeRect(x, y, width, height);
    }
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'rect',
      bounds: { x, y, width, height },
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }
  
  drawCircle(cx, cy, radius, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    this.context.beginPath();
    this.context.arc(cx, cy, radius, 0, 2 * Math.PI);
    
    this._applyCanvasStyle(normalizedStyle);
    
    // Draw fill if specified
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this.context.fill();
    }
    
    // Draw stroke if specified
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this.context.stroke();
    }
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'circle',
      bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
      coords: { cx, cy, radius },
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }
  
  drawPath(pathData, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    let path;
    if (typeof pathData === 'string') {
      // Parse SVG path string
      path = new Path2D(pathData);
    } else if (Array.isArray(pathData)) {
      // Convert coordinate array to path
      path = this._arrayToPath(pathData);
    } else {
      throw new Error('Invalid path data format');
    }
    
    this._applyCanvasStyle(normalizedStyle);
    
    // Draw fill if specified
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this.context.fill(path);
    }
    
    // Draw stroke if specified
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this.context.stroke(path);
    }
    
    // Store element for hit testing (simplified bounds calculation)
    this.elements.set(elementId, {
      type: 'path',
      bounds: this._calculatePathBounds(pathData),
      pathData,
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }
  
  drawText(text, x, y, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle({
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      ...style
    });
    const elementId = this._generateElementId();
    
    // Apply text styles
    this.context.font = `${normalizedStyle.fontSize} ${normalizedStyle.fontFamily}`;
    this.context.textAlign = normalizedStyle.textAlign || 'left';
    this.context.textBaseline = normalizedStyle.textBaseline || 'alphabetic';
    
    this._applyCanvasStyle(normalizedStyle);
    
    // Draw text fill if specified
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this.context.fillText(text, x, y);
    }
    
    // Draw text stroke if specified
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this.context.strokeText(text, x, y);
    }
    
    // Store element for hit testing
    const metrics = this.context.measureText(text);
    this.elements.set(elementId, {
      type: 'text',
      bounds: { 
        x, 
        y: y - metrics.actualBoundingBoxAscent || y - 12, 
        width: metrics.width, 
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 12
      },
      text,
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }

  // ===== ADVANCED DRAWING OPERATIONS =====
  
  createGroup(attributes = {}) {
    // Canvas doesn't have native groups, but we can simulate with save/restore
    const groupId = this._generateElementId();
    this.save();
    
    // Apply group transform if specified
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
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    // Create gradient
    let gradient;
    if (gradientConfig.type === 'linear') {
      gradient = this.context.createLinearGradient(
        gradientConfig.x1 || 0, gradientConfig.y1 || 0,
        gradientConfig.x2 || 0, gradientConfig.y2 || this.height
      );
    } else if (gradientConfig.type === 'radial') {
      gradient = this.context.createRadialGradient(
        gradientConfig.cx || this.width/2, gradientConfig.cy || this.height/2, gradientConfig.r1 || 0,
        gradientConfig.cx || this.width/2, gradientConfig.cy || this.height/2, gradientConfig.r2 || 100
      );
    } else {
      throw new Error('Unsupported gradient type');
    }
    
    // Add color stops
    gradientConfig.stops.forEach(stop => {
      gradient.addColorStop(stop.offset, stop.color);
    });
    
    // Create path
    let path;
    if (typeof pathData === 'string') {
      path = new Path2D(pathData);
    } else if (Array.isArray(pathData)) {
      path = this._arrayToPath(pathData);
    }
    
    // Apply gradient as fill
    this.context.fillStyle = gradient;
    this.context.fill(path);
    
    // Apply stroke if specified
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this._applyCanvasStyle(normalizedStyle);
      this.context.stroke(path);
    }
    
    this.elements.set(elementId, {
      type: 'gradient-area',
      bounds: this._calculatePathBounds(pathData),
      pathData,
      gradientConfig,
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }
  
  batchDraw(type, elements, commonStyle = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(commonStyle);
    this._applyCanvasStyle(normalizedStyle);
    
    const elementIds = [];
    let drawCalls = 0;
    
    this.context.beginPath();
    
    elements.forEach(element => {
      const elementId = this._generateElementId();
      elementIds.push(elementId);
      
      switch (type) {
        case 'line':
          this.context.moveTo(element.x1, element.y1);
          this.context.lineTo(element.x2, element.y2);
          break;
        case 'circle':
          this.context.moveTo(element.cx + element.radius, element.cy);
          this.context.arc(element.cx, element.cy, element.radius, 0, 2 * Math.PI);
          break;
        case 'rect':
          this.context.rect(element.x, element.y, element.width, element.height);
          break;
      }
      
      // Store for hit testing
      this.elements.set(elementId, {
        type,
        bounds: this._calculateElementBounds(type, element),
        ...element,
        style: normalizedStyle
      });
    });
    
    // Single draw call for all elements
    if (normalizedStyle.fill && normalizedStyle.fill !== 'none') {
      this.context.fill();
      drawCalls++;
    }
    if (normalizedStyle.stroke && normalizedStyle.stroke !== 'none') {
      this.context.stroke();
      drawCalls++;
    }
    
    this._incrementStats(drawCalls, elements.length);
    return elementIds;
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
    
    // Create bound handler for canvas events
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
      type: 'canvas',
      supportsGradients: true,
      supportsClipping: true,
      supportsTransforms: true,
      supportsTextMetrics: true,
      supportsBatchOperations: true,
      supportsAntialiasing: true,
      maxDataPoints: 100000,
      optimalDataPoints: 50000
    };
  }
  
  optimizeForDataSize(dataSize) {
    if (dataSize > 50000) {
      // Disable antialiasing for better performance with large datasets
      this.context.imageSmoothingEnabled = false;
      console.log('CanvasRenderer: Disabled antialiasing for large dataset');
    } else {
      this.context.imageSmoothingEnabled = this.options.antialiasing;
    }
  }

  // ===== UTILITY METHODS =====
  
  measureText(text, style = {}) {
    this._ensureInitialized();
    
    const fontSize = style.fontSize || '12px';
    const fontFamily = style.fontFamily || 'Arial, sans-serif';
    
    const prevFont = this.context.font;
    this.context.font = `${fontSize} ${fontFamily}`;
    
    const metrics = this.context.measureText(text);
    
    this.context.font = prevFont;
    
    return {
      width: metrics.width,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 12
    };
  }
  
  generatePath(points, curveType = 'linear') {
    if (!points || points.length === 0) return '';
    
    const path = new Path2D();
    const [firstPoint] = points;
    
    path.moveTo(firstPoint[0], firstPoint[1]);
    
    if (curveType === 'linear') {
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i][0], points[i][1]);
      }
    } else if (curveType === 'step') {
      for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i];
        const [prevX] = points[i - 1];
        path.lineTo(x, points[i - 1][1]); // Horizontal line
        path.lineTo(x, y); // Vertical line
      }
    }
    
    return path;
  }
  
  applyStyles(element, styles) {
    // Canvas styles are applied during drawing, not to stored elements
    console.warn('Canvas elements cannot have styles applied after creation');
  }
  
  async export(format = 'png') {
    this._ensureInitialized();
    
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
  
  _setDefaultStyles() {
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.textBaseline = 'middle';
    this.context.imageSmoothingEnabled = this.options.antialiasing;
  }
  
  _generateElementId() {
    return `canvas-element-${++this.elementIdCounter}`;
  }
  
  _applyCanvasStyle(style) {
    if (style.stroke && style.stroke !== 'none') {
      this.context.strokeStyle = style.stroke;
    }
    if (style.strokeWidth) {
      this.context.lineWidth = style.strokeWidth;
    }
    if (style.fill && style.fill !== 'none') {
      this.context.fillStyle = style.fill;
    }
    if (style.opacity !== undefined) {
      this.context.globalAlpha = style.opacity;
    }
    if (style.lineCap) {
      this.context.lineCap = style.lineCap;
    }
    if (style.lineJoin) {
      this.context.lineJoin = style.lineJoin;
    }
    if (style.lineDash) {
      this.context.setLineDash(style.lineDash);
    }
  }
  
  _arrayToPath(points) {
    const path = new Path2D();
    if (points.length > 0) {
      path.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i][0], points[i][1]);
      }
    }
    return path;
  }
  
  _calculatePathBounds(pathData) {
    // Simplified bounds calculation - could be improved
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
    // For string paths, return full canvas bounds (could be improved)
    return { x: 0, y: 0, width: this.width, height: this.height };
  }
  
  _calculateElementBounds(type, element) {
    switch (type) {
      case 'line':
        return {
          x: Math.min(element.x1, element.x2),
          y: Math.min(element.y1, element.y2),
          width: Math.abs(element.x2 - element.x1),
          height: Math.abs(element.y2 - element.y1)
        };
      case 'circle':
        return {
          x: element.cx - element.radius,
          y: element.cy - element.radius,
          width: element.radius * 2,
          height: element.radius * 2
        };
      case 'rect':
        return {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        };
      default:
        return { x: 0, y: 0, width: 0, height: 0 };
    }
  }
  
  _isPointInElement(x, y, element) {
    const bounds = element.bounds;
    
    // Basic bounds check
    if (x < bounds.x || x > bounds.x + bounds.width ||
        y < bounds.y || y > bounds.y + bounds.height) {
      return false;
    }
    
    // More precise hit testing for different element types
    switch (element.type) {
      case 'circle':
        const dx = x - element.coords.cx;
        const dy = y - element.coords.cy;
        return (dx * dx + dy * dy) <= (element.coords.radius * element.coords.radius);
      case 'line':
        // Simple line hit testing - could be improved
        return this._pointToLineDistance(x, y, element.coords) <= (element.style.strokeWidth || 1);
      default:
        return true; // For rect, text, and path, bounds check is sufficient
    }
  }
  
  _pointToLineDistance(x, y, lineCoords) {
    const { x1, y1, x2, y2 } = lineCoords;
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));
    
    const xx = x1 + param * C;
    const yy = y1 + param * D;
    
    const dx = x - xx;
    const dy = y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  _applyTransform(transformString) {
    // Parse transform string and apply to context
    // This is a simplified implementation
    if (transformString.includes('translate')) {
      const match = transformString.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) {
        this.context.translate(parseFloat(match[1]), parseFloat(match[2]));
      }
    }
  }
}
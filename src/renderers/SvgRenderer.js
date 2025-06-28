import AbstractRenderer from './AbstractRenderer.js';

/**
 * SvgRenderer - SVG implementation of AbstractRenderer
 * 
 * Provides crisp vector graphics with excellent DOM integration.
 * Ideal for smaller datasets where DOM interactivity is valuable.
 */
export default class SvgRenderer extends AbstractRenderer {
  constructor(container, width, height, options = {}) {
    super(container, width, height, options);
    
    this.svg = null;
    this.defs = null;
    this.chartGroup = null;
    
    // SVG-specific state
    this.elements = new Map(); // Element tracking for hit testing
    this.elementIdCounter = 0;
    this.groupStack = []; // For save/restore simulation
    this.clipPaths = new Map(); // Clipping path definitions
    
    // Event handling
    this.eventListeners = new Map();
    this.boundEventHandlers = new Map();
    
    // Transform management
    this.transformStack = [];
    this.currentTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  }

  // ===== LIFECYCLE METHODS =====
  
  async initialize() {
    try {
      // Create main SVG element
      this.svg = this._createSVGElement('svg', {
        width: this.width,
        height: this.height,
        class: 'visioncharts-svg',
        viewBox: `0 0 ${this.width} ${this.height}`,
        preserveAspectRatio: 'xMidYMid meet',
        style: `background: ${this.options.backgroundColor}`
      });
      
      // Create defs for gradients and patterns
      this.defs = this._createSVGElement('defs');
      this.svg.appendChild(this.defs);
      
      // Create main chart group
      this.chartGroup = this._createSVGElement('g', {
        class: 'visioncharts-chart-group'
      });
      this.svg.appendChild(this.chartGroup);
      
      // Add SVG to container
      this.container.appendChild(this.svg);
      
      this.renderingContext = this.chartGroup;
      this.isInitialized = true;
      
      console.log('SvgRenderer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize SvgRenderer:', error);
      throw error;
    }
  }
  
  destroy() {
    // Remove event listeners
    this.eventListeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.svg?.removeEventListener(event, handler);
      });
    });
    
    // Remove SVG from DOM
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    
    // Clear references
    this.eventListeners.clear();
    this.boundEventHandlers.clear();
    this.elements.clear();
    this.clipPaths.clear();
    this.groupStack = [];
    this.transformStack = [];
    
    this.svg = null;
    this.defs = null;
    this.chartGroup = null;
    this.renderingContext = null;
    this.isInitialized = false;
    
    console.log('SvgRenderer destroyed');
  }
  
  resize(width, height) {
    this._ensureInitialized();
    
    this.width = width;
    this.height = height;
    
    // Update SVG dimensions
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    this.clear();
  }
  
  clear(color = null) {
    this._ensureInitialized();
    
    // Clear chart group content
    while (this.chartGroup.firstChild) {
      this.chartGroup.removeChild(this.chartGroup.firstChild);
    }
    
    // Update background color if specified
    if (color) {
      this.svg.style.background = color;
    }
    
    // Clear element tracking
    this.elements.clear();
    this.elementIdCounter = 0;
    
    // Reset rendering context to chart group
    this.renderingContext = this.chartGroup;
    
    this._incrementStats(1, 0);
  }

  // ===== RENDERING STATE MANAGEMENT =====
  
  save() {
    this._ensureInitialized();
    
    // Create a new group to simulate canvas save
    const group = this._createSVGElement('g');
    this.renderingContext.appendChild(group);
    
    // Save current state
    this.groupStack.push(this.renderingContext);
    this.transformStack.push({ ...this.currentTransform });
    
    // Set new rendering context
    this.renderingContext = group;
  }
  
  restore() {
    this._ensureInitialized();
    
    if (this.groupStack.length > 0) {
      this.renderingContext = this.groupStack.pop();
    }
    
    if (this.transformStack.length > 0) {
      this.currentTransform = this.transformStack.pop();
    }
  }
  
  transform(a, b, c, d, e, f) {
    this._ensureInitialized();
    
    // Apply transform to current rendering context
    const currentTransform = this.renderingContext.getAttribute('transform') || '';
    const newTransform = `${currentTransform} matrix(${a},${b},${c},${d},${e},${f})`;
    this.renderingContext.setAttribute('transform', newTransform);
    
    // Update internal transform state
    this.currentTransform.x += e;
    this.currentTransform.y += f;
  }
  
  translate(x, y) {
    this._ensureInitialized();
    
    const currentTransform = this.renderingContext.getAttribute('transform') || '';
    const newTransform = `${currentTransform} translate(${x},${y})`;
    this.renderingContext.setAttribute('transform', newTransform);
    
    this.currentTransform.x += x;
    this.currentTransform.y += y;
  }
  
  setClipBounds(x, y, width, height) {
    this._ensureInitialized();
    
    const clipId = `clip-${this._generateElementId()}`;
    
    // Create clip path
    const clipPath = this._createSVGElement('clipPath', { id: clipId });
    const rect = this._createSVGElement('rect', { x, y, width, height });
    clipPath.appendChild(rect);
    this.defs.appendChild(clipPath);
    
    // Apply clip path to current context
    this.renderingContext.setAttribute('clip-path', `url(#${clipId})`);
    
    this.currentClipBounds = { x, y, width, height };
    this.clipPaths.set(clipId, clipPath);
  }
  
  clearClipBounds() {
    this._ensureInitialized();
    
    if (this.currentClipBounds) {
      this.renderingContext.removeAttribute('clip-path');
      this.currentClipBounds = null;
    }
  }

  // ===== BASIC DRAWING OPERATIONS =====
  
  drawLine(x1, y1, x2, y2, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    
    const line = this._createSVGElement('line', {
      x1, y1, x2, y2,
      stroke: normalizedStyle.stroke,
      'stroke-width': normalizedStyle.strokeWidth,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    this.renderingContext.appendChild(line);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'line',
      element: line,
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
    
    const rect = this._createSVGElement('rect', {
      x, y, width, height,
      fill: normalizedStyle.fill,
      stroke: normalizedStyle.stroke,
      'stroke-width': normalizedStyle.strokeWidth,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    this.renderingContext.appendChild(rect);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'rect',
      element: rect,
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
    
    const circle = this._createSVGElement('circle', {
      cx, cy, r: radius,
      fill: normalizedStyle.fill,
      stroke: normalizedStyle.stroke,
      'stroke-width': normalizedStyle.strokeWidth,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    this.renderingContext.appendChild(circle);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'circle',
      element: circle,
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
    
    let pathString;
    if (typeof pathData === 'string') {
      pathString = pathData;
    } else if (Array.isArray(pathData)) {
      pathString = this._arrayToPathString(pathData);
    } else {
      throw new Error('Invalid path data format');
    }
    
    const path = this._createSVGElement('path', {
      d: pathString,
      fill: normalizedStyle.fill,
      stroke: normalizedStyle.stroke,
      'stroke-width': normalizedStyle.strokeWidth,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    this.renderingContext.appendChild(path);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'path',
      element: path,
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
      textAnchor: 'start',
      dominantBaseline: 'alphabetic',
      ...style
    });
    const elementId = this._generateElementId();
    
    const textElement = this._createSVGElement('text', {
      x, y,
      fill: normalizedStyle.fill || normalizedStyle.stroke || '#000000',
      'font-size': normalizedStyle.fontSize,
      'font-family': normalizedStyle.fontFamily,
      'text-anchor': normalizedStyle.textAnchor,
      'dominant-baseline': normalizedStyle.dominantBaseline,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    textElement.textContent = text;
    this.renderingContext.appendChild(textElement);
    
    // Calculate bounds
    const bbox = textElement.getBBox();
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'text',
      element: textElement,
      bounds: bbox,
      text,
      style: normalizedStyle
    });
    
    this._incrementStats(1, 1);
    return elementId;
  }

  // ===== ADVANCED DRAWING OPERATIONS =====
  
  createGroup(attributes = {}) {
    this._ensureInitialized();
    
    const groupId = this._generateElementId();
    const group = this._createSVGElement('g', {
      'data-group-id': groupId,
      ...attributes
    });
    
    this.renderingContext.appendChild(group);
    
    return {
      id: groupId,
      element: group,
      appendChild: (child) => group.appendChild(child),
      setAttribute: (name, value) => group.setAttribute(name, value),
      getAttribute: (name) => group.getAttribute(name)
    };
  }
  
  drawGradientArea(pathData, gradientConfig, style = {}) {
    this._ensureInitialized();
    
    const normalizedStyle = this._normalizeStyle(style);
    const elementId = this._generateElementId();
    const gradientId = `gradient-${elementId}`;
    
    // Create gradient definition
    let gradient;
    if (gradientConfig.type === 'linear') {
      gradient = this._createSVGElement('linearGradient', {
        id: gradientId,
        x1: gradientConfig.x1 || '0%',
        y1: gradientConfig.y1 || '0%',
        x2: gradientConfig.x2 || '0%',
        y2: gradientConfig.y2 || '100%'
      });
    } else if (gradientConfig.type === 'radial') {
      gradient = this._createSVGElement('radialGradient', {
        id: gradientId,
        cx: gradientConfig.cx || '50%',
        cy: gradientConfig.cy || '50%',
        r: gradientConfig.r || '50%'
      });
    } else {
      throw new Error('Unsupported gradient type');
    }
    
    // Add color stops
    gradientConfig.stops.forEach(stop => {
      const stopElement = this._createSVGElement('stop', {
        offset: stop.offset,
        'stop-color': stop.color,
        'stop-opacity': stop.opacity !== undefined ? stop.opacity : 1
      });
      gradient.appendChild(stopElement);
    });
    
    this.defs.appendChild(gradient);
    
    // Create path with gradient fill
    let pathString;
    if (typeof pathData === 'string') {
      pathString = pathData;
    } else if (Array.isArray(pathData)) {
      pathString = this._arrayToPathString(pathData);
    }
    
    const path = this._createSVGElement('path', {
      d: pathString,
      fill: `url(#${gradientId})`,
      stroke: normalizedStyle.stroke,
      'stroke-width': normalizedStyle.strokeWidth,
      opacity: normalizedStyle.opacity,
      'data-element-id': elementId,
      ...this._convertStyleToAttributes(normalizedStyle)
    });
    
    this.renderingContext.appendChild(path);
    
    // Store element for hit testing
    this.elements.set(elementId, {
      type: 'gradient-area',
      element: path,
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
    const elementIds = [];
    
    // Create a group for batch elements
    const batchGroup = this.createGroup({ class: `batch-${type}` });
    
    elements.forEach(element => {
      const elementId = this._generateElementId();
      elementIds.push(elementId);
      
      let svgElement;
      switch (type) {
        case 'line':
          svgElement = this._createSVGElement('line', {
            x1: element.x1, y1: element.y1, x2: element.x2, y2: element.y2,
            ...this._convertStyleToAttributes(normalizedStyle),
            'data-element-id': elementId
          });
          break;
        case 'circle':
          svgElement = this._createSVGElement('circle', {
            cx: element.cx, cy: element.cy, r: element.radius,
            ...this._convertStyleToAttributes(normalizedStyle),
            'data-element-id': elementId
          });
          break;
        case 'rect':
          svgElement = this._createSVGElement('rect', {
            x: element.x, y: element.y, width: element.width, height: element.height,
            ...this._convertStyleToAttributes(normalizedStyle),
            'data-element-id': elementId
          });
          break;
      }
      
      if (svgElement) {
        batchGroup.appendChild(svgElement);
        
        // Store for hit testing
        this.elements.set(elementId, {
          type,
          element: svgElement,
          bounds: this._calculateElementBounds(type, element),
          ...element,
          style: normalizedStyle
        });
      }
    });
    
    this._incrementStats(1, elements.length);
    return elementIds;
  }

  // ===== EVENT AND INTERACTION SUPPORT =====
  
  screenToChart(screenX, screenY) {
    const rect = this.svg.getBoundingClientRect();
    const svgPoint = this.svg.createSVGPoint();
    svgPoint.x = screenX - rect.left;
    svgPoint.y = screenY - rect.top;
    
    // Transform through the SVG's CTM (Current Transformation Matrix)
    const transformed = svgPoint.matrixTransform(this.svg.getScreenCTM().inverse());
    
    return {
      x: transformed.x,
      y: transformed.y
    };
  }
  
  chartToScreen(chartX, chartY) {
    const rect = this.svg.getBoundingClientRect();
    const svgPoint = this.svg.createSVGPoint();
    svgPoint.x = chartX;
    svgPoint.y = chartY;
    
    // Transform through the SVG's CTM
    const transformed = svgPoint.matrixTransform(this.svg.getScreenCTM());
    
    return {
      x: transformed.x,
      y: transformed.y
    };
  }
  
  hitTest(x, y) {
    const hitElements = [];
    
    // Use SVG's native elementFromPoint if available
    const point = this.svg.createSVGPoint();
    point.x = x;
    point.y = y;
    
    this.elements.forEach((elementData, id) => {
      if (this._isPointInElement(x, y, elementData)) {
        hitElements.push({ id, element: elementData });
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
    this.svg.addEventListener(event, boundHandler);
  }
  
  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(handler);
    }
    
    if (this.boundEventHandlers.has(handler)) {
      const boundHandler = this.boundEventHandlers.get(handler);
      this.svg.removeEventListener(event, boundHandler);
      this.boundEventHandlers.delete(handler);
    }
  }

  // ===== CAPABILITY AND PERFORMANCE =====
  
  getCapabilities() {
    return {
      type: 'svg',
      supportsGradients: true,
      supportsClipping: true,
      supportsTransforms: true,
      supportsTextMetrics: true,
      supportsBatchOperations: true,
      supportsAntialiasing: true,
      maxDataPoints: 10000,
      optimalDataPoints: 5000
    };
  }
  
  optimizeForDataSize(dataSize) {
    if (dataSize > 5000) {
      // Disable shape-rendering optimization for large datasets
      this.svg.style.shapeRendering = 'optimizeSpeed';
      console.log('SvgRenderer: Enabled speed optimizations for large dataset');
    } else {
      this.svg.style.shapeRendering = 'auto';
    }
  }

  // ===== UTILITY METHODS =====
  
  measureText(text, style = {}) {
    this._ensureInitialized();
    
    // Create temporary text element for measurement
    const tempText = this._createSVGElement('text', {
      'font-size': style.fontSize || '12px',
      'font-family': style.fontFamily || 'Arial, sans-serif',
      visibility: 'hidden'
    });
    
    tempText.textContent = text;
    this.svg.appendChild(tempText);
    
    const bbox = tempText.getBBox();
    this.svg.removeChild(tempText);
    
    return {
      width: bbox.width,
      height: bbox.height
    };
  }
  
  generatePath(points, curveType = 'linear') {
    if (!points || points.length === 0) return '';
    
    switch (curveType) {
      case 'linear':
        return this._linePathDefinition(points);
      case 'step':
        return this._stepPathDefinition(points);
      case 'cardinal':
        return this._cardinalPathDefinition(points);
      default:
        return this._linePathDefinition(points);
    }
  }
  
  applyStyles(element, styles) {
    if (typeof element === 'string') {
      // If element is an ID, find the actual element
      const elementData = this.elements.get(element);
      if (elementData && elementData.element) {
        element = elementData.element;
      } else {
        console.warn(`Element with ID ${element} not found`);
        return;
      }
    }
    
    Object.entries(styles).forEach(([property, value]) => {
      if (property.includes('-')) {
        element.setAttribute(property, value);
      } else {
        element.style[property] = value;
      }
    });
  }
  
  async export(format = 'svg') {
    this._ensureInitialized();
    
    switch (format.toLowerCase()) {
      case 'svg':
        return new XMLSerializer().serializeToString(this.svg);
      case 'png':
      case 'jpeg':
      case 'webp':
        return this._exportRasterImage(format);
      case 'dataurl':
        const svgString = new XMLSerializer().serializeToString(this.svg);
        return `data:image/svg+xml;base64,${btoa(svgString)}`;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ===== INTERNAL HELPER METHODS =====
  
  _createSVGElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }
  
  _generateElementId() {
    return `svg-element-${++this.elementIdCounter}`;
  }
  
  _convertStyleToAttributes(style) {
    const attributes = {};
    
    // Convert common style properties to SVG attributes
    if (style.strokeDasharray) attributes['stroke-dasharray'] = style.strokeDasharray;
    if (style.strokeLinecap) attributes['stroke-linecap'] = style.strokeLinecap;
    if (style.strokeLinejoin) attributes['stroke-linejoin'] = style.strokeLinejoin;
    if (style.fillOpacity !== undefined) attributes['fill-opacity'] = style.fillOpacity;
    if (style.strokeOpacity !== undefined) attributes['stroke-opacity'] = style.strokeOpacity;
    
    return attributes;
  }
  
  _arrayToPathString(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [
      `M ${firstX},${firstY}`,
      ...restPoints.map(([x, y]) => `L ${x},${y}`)
    ];
    
    return pathParts.join(' ');
  }
  
  _linePathDefinition(points) {
    return this._arrayToPathString(points);
  }
  
  _stepPathDefinition(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    for (let i = 0; i < restPoints.length; i++) {
      const [x, y] = restPoints[i];
      pathParts.push(`H ${x}`);
      pathParts.push(`V ${y}`);
    }
    
    return pathParts.join(' ');
  }
  
  _cardinalPathDefinition(points, tension = 0.5) {
    if (points.length < 2) return this._linePathDefinition(points);
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    if (points.length < 3) {
      return this._linePathDefinition(points);
    }
    
    // Helper function to calculate control points
    const getControlPoints = (p0, p1, p2, t) => {
      const d1x = (p2[0] - p0[0]) * t;
      const d1y = (p2[1] - p0[1]) * t;
      
      return [
        [p1[0] - d1x, p1[1] - d1y], // CP1
        [p1[0] + d1x, p1[1] + d1y]  // CP2
      ];
    };
    
    let [cp1, cp2] = getControlPoints(firstPoint, firstPoint, restPoints[0], tension);
    
    for (let i = 0; i < restPoints.length; i++) {
      const current = restPoints[i];
      const prev = i > 0 ? restPoints[i - 1] : firstPoint;
      const next = i < restPoints.length - 1 ? restPoints[i + 1] : current;
      
      if (i > 0) {
        [cp1, cp2] = getControlPoints(prev, current, next, tension);
      }
      
      pathParts.push(`C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${current[0]},${current[1]}`);
    }
    
    return pathParts.join(' ');
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
    // For string paths, return full viewport bounds (could be improved)
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
  
  _isPointInElement(x, y, elementData) {
    const bounds = elementData.bounds;
    
    // Basic bounds check
    if (x < bounds.x || x > bounds.x + bounds.width ||
        y < bounds.y || y > bounds.y + bounds.height) {
      return false;
    }
    
    // More precise hit testing could be added here for different element types
    return true;
  }
  
  async _exportRasterImage(format) {
    // Convert SVG to raster image using Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = this.width;
    canvas.height = this.height;
    
    const svgString = new XMLSerializer().serializeToString(this.svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(svgUrl);
        
        try {
          const dataUrl = canvas.toDataURL(`image/${format}`, 0.9);
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  }

  // ===== STATIC UTILITY METHODS (BACKWARDS COMPATIBILITY) =====
  
  // Keep some static methods for backwards compatibility with existing code
  static createElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }
  
  static createSvg(width, height, attributes = {}) {
    return SvgRenderer.createElement('svg', {
      width,
      height,
      class: 'visioncharts-svg',
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'xMidYMid meet',
      ...attributes
    });
  }
  
  static createPath(d, attributes = {}) {
    return SvgRenderer.createElement('path', { d, ...attributes });
  }
  
  static createLine(x1, y1, x2, y2, attributes = {}) {
    return SvgRenderer.createElement('line', { x1, y1, x2, y2, ...attributes });
  }
  
  static createCircle(cx, cy, r, attributes = {}) {
    return SvgRenderer.createElement('circle', { cx, cy, r, ...attributes });
  }
  
  static createRect(x, y, width, height, attributes = {}) {
    return SvgRenderer.createElement('rect', { x, y, width, height, ...attributes });
  }
  
  static createText(text, x, y, attributes = {}) {
    const element = SvgRenderer.createElement('text', { x, y, ...attributes });
    element.textContent = text;
    return element;
  }
  
  static createGroup(attributes = {}) {
    return SvgRenderer.createElement('g', attributes);
  }
  
  static applyStyles(element, styles) {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
  }
  
  static setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
  }
}
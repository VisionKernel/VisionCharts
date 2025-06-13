/**
 * SVG Renderer class for handling SVG-specific rendering logic
 */
export default class SvgRenderer {
  /**
   * Create SVG namespace element
   * @param {string} tagName - SVG element tag name
   * @param {Object} attributes - Element attributes
   * @returns {SVGElement} The created SVG element
   */
  static createElement(tagName, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }

  /**
   * Create the main SVG element
   * @param {number} width - SVG width
   * @param {number} height - SVG height
   * @param {Object} attributes - Additional attributes
   * @returns {SVGElement} The created SVG element
   */
  static createSvg(width, height, attributes = {}) {
    return SvgRenderer.createElement('svg', {
      width,
      height,
      class: 'visioncharts-svg',
      viewBox: `0 0 ${width} ${height + 40}`,
      preserveAspectRatio: 'xMidYMid meet',
      ...attributes
    });
  }

  /**
   * Create a path element
   * @param {string} d - Path definition string
   * @param {Object} attributes - Additional attributes
   * @returns {SVGPathElement} The created path element
   */
  static createPath(d, attributes = {}) {
    return SvgRenderer.createElement('path', {
      d,
      ...attributes
    });
  }
  
  /**
   * Create a line element
   * @param {number} x1 - Start x coordinate
   * @param {number} y1 - Start y coordinate
   * @param {number} x2 - End x coordinate
   * @param {number} y2 - End y coordinate
   * @param {Object} attributes - Additional attributes
   * @returns {SVGLineElement} The created line element
   */
  static createLine(x1, y1, x2, y2, attributes = {}) {
    return SvgRenderer.createElement('line', {
      x1,
      y1,
      x2,
      y2,
      ...attributes
    });
  }
  
  /**
   * Create a circle element
   * @param {number} cx - Center x coordinate
   * @param {number} cy - Center y coordinate
   * @param {number} r - Radius
   * @param {Object} attributes - Additional attributes
   * @returns {SVGCircleElement} The created circle element
   */
  static createCircle(cx, cy, r, attributes = {}) {
    return SvgRenderer.createElement('circle', {
      cx,
      cy,
      r,
      ...attributes
    });
  }
  
  /**
   * Create a rectangle element
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} attributes - Additional attributes
   * @returns {SVGRectElement} The created rect element
   */
  static createRect(x, y, width, height, attributes = {}) {
    return SvgRenderer.createElement('rect', {
      x,
      y,
      width,
      height,
      ...attributes
    });
  }
  
  /**
   * Create a text element
   * @param {string} text - Text content
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} attributes - Additional attributes
   * @returns {SVGTextElement} The created text element
   */
  static createText(text, x, y, attributes = {}) {
    const element = SvgRenderer.createElement('text', {
      x,
      y,
      ...attributes
    });
    
    element.textContent = text;
    
    return element;
  }
  
  /**
   * Create a group element
   * @param {Object} attributes - Group attributes
   * @returns {SVGGElement} The created group element
   */
  static createGroup(attributes = {}) {
    return SvgRenderer.createElement('g', attributes);
  }

  /**
   * Create defs element for gradients and patterns
   * @param {Object} attributes - Defs attributes
   * @returns {SVGDefsElement} The created defs element
   */
  static createDefs(attributes = {}) {
    return SvgRenderer.createElement('defs', attributes);
  }

  /**
   * Create linear gradient element
   * @param {string} id - Gradient ID
   * @param {Array} stops - Array of gradient stops [{offset, color, opacity}]
   * @param {Object} attributes - Additional attributes
   * @returns {SVGLinearGradientElement} The created gradient element
   */
  static createLinearGradient(id, stops = [], attributes = {}) {
    const gradient = SvgRenderer.createElement('linearGradient', {
      id,
      x1: '0',
      y1: '0', 
      x2: '0',
      y2: '1',
      ...attributes
    });

    stops.forEach(stop => {
      const stopElement = SvgRenderer.createElement('stop', {
        offset: stop.offset,
        'stop-color': stop.color,
        'stop-opacity': stop.opacity !== undefined ? stop.opacity : 1
      });
      gradient.appendChild(stopElement);
    });

    return gradient;
  }

  /**
   * Create gradient stop element
   * @param {string} offset - Stop offset (e.g., '0%', '100%')
   * @param {string} color - Stop color
   * @param {number} opacity - Stop opacity
   * @returns {SVGStopElement} The created stop element
   */
  static createGradientStop(offset, color, opacity = 1) {
    return SvgRenderer.createElement('stop', {
      offset,
      'stop-color': color,
      'stop-opacity': opacity
    });
  }
  
  /**
   * Generate a line path definition
   * @param {Array} points - Array of [x, y] points
   * @returns {string} Path definition string
   */
  static linePathDefinition(points) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [
      `M ${firstX},${firstY}`,
      ...restPoints.map(([x, y]) => `L ${x},${y}`)
    ];
    
    return pathParts.join(' ');
  }

  /**
   * Generate step path definition
   * @param {Array} points - Array of [x, y] points
   * @returns {string} Path definition string
   */
  static stepPathDefinition(points) {
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

  /**
   * Generate cardinal spline path definition
   * @param {Array} points - Array of [x, y] points
   * @param {number} tension - Curve tension (0-1)
   * @returns {string} Path definition string
   */
  static cardinalPathDefinition(points, tension = 0.5) {
    if (points.length < 2) return SvgRenderer.linePathDefinition(points);
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    
    const pathParts = [`M ${firstX},${firstY}`];
    
    // Helper function to calculate control points
    const getControlPoints = (p0, p1, p2, t) => {
      const d1x = (p2[0] - p0[0]) * t;
      const d1y = (p2[1] - p0[1]) * t;
      
      return [
        [p1[0] - d1x, p1[1] - d1y], // CP1
        [p1[0] + d1x, p1[1] + d1y]  // CP2
      ];
    };
    
    // Need at least 3 points for cardinal spline
    if (points.length < 3) {
      return SvgRenderer.linePathDefinition(points);
    }
    
    // For the first segment, use the first point as the previous point
    let [cp1, cp2] = getControlPoints(
      firstPoint,
      firstPoint,
      restPoints[0],
      tension
    );
    
    for (let i = 0; i < restPoints.length; i++) {
      const current = restPoints[i];
      const prev = i > 0 ? restPoints[i - 1] : firstPoint;
      const next = i < restPoints.length - 1 ? restPoints[i + 1] : current;
      
      if (i > 0) {
        [cp1, cp2] = getControlPoints(
          prev,
          current,
          next,
          tension
        );
      }
      
      // Add cubic bezier curve segment
      pathParts.push(`C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${current[0]},${current[1]}`);
    }
    
    return pathParts.join(' ');
  }
  
  /**
   * Generate an area path definition
   * @param {Array} points - Array of [x, y] points
   * @param {number} baselineY - Y coordinate of the baseline
   * @returns {string} Path definition string
   */
  static areaPathDefinition(points, baselineY) {
    if (!points.length) return '';
    
    const [firstPoint, ...restPoints] = points;
    const [firstX, firstY] = firstPoint;
    const lastX = points[points.length - 1][0];
    
    const pathParts = [
      `M ${firstX},${baselineY}`,
      `L ${firstX},${firstY}`,
      ...restPoints.map(([x, y]) => `L ${x},${y}`),
      `L ${lastX},${baselineY}`,
      'Z'
    ];
    
    return pathParts.join(' ');
  }

  /**
   * Generate area path with curve support
   * @param {Array} points - Array of [x, y] points
   * @param {number} baselineY - Y coordinate of the baseline
   * @param {string} curve - Curve type ('linear', 'step', 'cardinal')
   * @param {number} tension - Curve tension for cardinal splines
   * @returns {string} Path definition string
   */
  static curvedAreaPathDefinition(points, baselineY, curve = 'linear', tension = 0.5) {
    if (!points.length) return '';
    
    let linePath;
    switch (curve) {
      case 'step':
        linePath = SvgRenderer.stepPathDefinition(points);
        break;
      case 'cardinal':
        linePath = SvgRenderer.cardinalPathDefinition(points, tension);
        break;
      case 'linear':
      default:
        linePath = SvgRenderer.linePathDefinition(points);
        break;
    }
    
    if (!linePath) return '';
    
    // Add area closure
    const [firstPoint] = points;
    const [firstX] = firstPoint;
    const [lastPoint] = [...points].reverse();
    const [lastX] = lastPoint;
    
    return `${linePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;
  }
  
  /**
   * Apply animation to an element
   * @param {SVGElement} element - Element to animate
   * @param {Object} attributes - Attributes to animate
   * @param {Object} options - Animation options
   */
  static animate(element, attributes, options = {}) {
    // Default options
    const animationOptions = {
      duration: 300,
      easing: 'ease',
      ...options
    };
    
    // Set transition
    const transition = `all ${animationOptions.duration}ms ${animationOptions.easing}`;
    element.style.transition = transition;
    
    // Apply attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
  }
  
  /**
   * Format axis tick values
   * @param {number|Date} value - Tick value
   * @param {string} format - Format type ('time', 'number', 'percent', 'currency')
   * @param {Object} options - Format options
   * @returns {string} Formatted value
   */
  static formatTickValue(value, format = 'number', options = {}) {
    switch (format) {
      case 'time':
        const date = value instanceof Date ? value : new Date(value);
        return date.toLocaleString(options.locale || undefined, options);
      
      case 'number':
        return new Intl.NumberFormat(options.locale, {
          minimumFractionDigits: options.minimumFractionDigits || 0,
          maximumFractionDigits: options.maximumFractionDigits || 2,
          ...options
        }).format(value);
      
      case 'percent':
        return new Intl.NumberFormat(options.locale, {
          style: 'percent',
          minimumFractionDigits: options.minimumFractionDigits || 0,
          maximumFractionDigits: options.maximumFractionDigits || 2,
          ...options
        }).format(value);
      
      case 'currency':
        return new Intl.NumberFormat(options.locale, {
          style: 'currency',
          currency: options.currency || 'USD',
          ...options
        }).format(value);
      
      default:
        return String(value);
    }
  }

  /**
   * Batch create and append multiple elements
   * @param {SVGElement} parent - Parent element to append to
   * @param {Array} elements - Array of element definitions
   * @returns {Array} Array of created elements
   */
  static createAndAppendElements(parent, elements) {
    return elements.map(elementDef => {
      const { type, attributes = {}, children = [], text } = elementDef;
      
      let element;
      switch (type) {
        case 'circle':
          element = SvgRenderer.createCircle(
            attributes.cx || 0, 
            attributes.cy || 0, 
            attributes.r || 1, 
            attributes
          );
          break;
        case 'rect':
          element = SvgRenderer.createRect(
            attributes.x || 0,
            attributes.y || 0,
            attributes.width || 0,
            attributes.height || 0,
            attributes
          );
          break;
        case 'text':
          element = SvgRenderer.createText(
            text || '',
            attributes.x || 0,
            attributes.y || 0,
            attributes
          );
          break;
        case 'path':
          element = SvgRenderer.createPath(attributes.d || '', attributes);
          break;
        case 'g':
          element = SvgRenderer.createGroup(attributes);
          break;
        default:
          element = SvgRenderer.createElement(type, attributes);
      }
      
      if (text && type !== 'text') {
        element.textContent = text;
      }
      
      // Recursively create children
      if (children.length > 0) {
        SvgRenderer.createAndAppendElements(element, children);
      }
      
      if (parent) {
        parent.appendChild(element);
      }
      
      return element;
    });
  }

  /**
   * Apply styles to an element
   * @param {SVGElement} element - Element to style
   * @param {Object} styles - CSS styles to apply
   */
  static applyStyles(element, styles) {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
  }

  /**
   * Set multiple attributes at once
   * @param {SVGElement} element - Element to modify
   * @param {Object} attributes - Attributes to set
   */
  static setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
  }
}
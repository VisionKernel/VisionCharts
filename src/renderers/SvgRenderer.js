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
}
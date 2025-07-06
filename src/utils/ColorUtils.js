/**
 * ColorUtils.js - Universal color handling for VisionCharts
 * Location: /src/utils/ColorUtils.js
 * 
 * Provides consistent color parsing, default palettes, and format conversion
 * for all renderers (Canvas, WebGL, SVG).
 */

export class ColorUtils {
  /**
   * Financial-friendly default color palette
   * Carefully selected for professional charts and accessibility
   */
  static DEFAULT_PALETTE = [
    '#1f77b4', // Blue - primary trend
    '#ff7f0e', // Orange - secondary data  
    '#2ca02c', // Green - positive/growth
    '#d62728', // Red - negative/decline
    '#9467bd', // Purple - indicators
    '#8c564b', // Brown - commodities
    '#e377c2', // Pink - special metrics
    '#7f7f7f', // Gray - neutral/benchmarks
    '#bcbd22', // Olive - alternative data
    '#17becf', // Cyan - technical indicators
    '#aec7e8', // Light blue
    '#ffbb78', // Light orange
    '#98df8a', // Light green
    '#ff9896', // Light red
    '#c5b0d5', // Light purple
    '#c49c94', // Light brown
    '#f7b6d3', // Light pink
    '#c7c7c7', // Light gray
    '#dbdb8d', // Light olive
    '#9edae5'  // Light cyan
  ];

  /**
   * Parse any color format to normalized RGBA object
   * @param {string|object} color - Color in any format
   * @returns {object} {r, g, b, a} with values 0-1
   */
  static parseColor(color) {
    if (!color) {
      return ColorUtils.parseColor(ColorUtils.DEFAULT_PALETTE[0]);
    }

    // Already normalized RGBA object
    if (typeof color === 'object' && 'r' in color) {
      return {
        r: Math.max(0, Math.min(1, color.r)),
        g: Math.max(0, Math.min(1, color.g)),
        b: Math.max(0, Math.min(1, color.b)),
        a: color.a !== undefined ? Math.max(0, Math.min(1, color.a)) : 1.0
      };
    }

    if (typeof color !== 'string') {
      console.warn('Invalid color format:', color);
      return ColorUtils.parseColor(ColorUtils.DEFAULT_PALETTE[0]);
    }

    // Hex colors (#fff, #ffffff)
    if (color.startsWith('#')) {
      return ColorUtils._parseHex(color);
    }

    // RGB/RGBA colors
    if (color.startsWith('rgb')) {
      return ColorUtils._parseRgb(color);
    }

    // Named colors (basic set)
    if (ColorUtils.NAMED_COLORS[color.toLowerCase()]) {
      return ColorUtils.parseColor(ColorUtils.NAMED_COLORS[color.toLowerCase()]);
    }

    console.warn('Unrecognized color format:', color);
    return ColorUtils.parseColor(ColorUtils.DEFAULT_PALETTE[0]);
  }

  /**
   * Convert normalized RGBA to hex string
   * @param {object} rgba - {r, g, b, a} with values 0-1
   * @returns {string} Hex color string
   */
  static toHex(rgba) {
    const r = Math.round(rgba.r * 255);
    const g = Math.round(rgba.g * 255);
    const b = Math.round(rgba.b * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Convert normalized RGBA to Canvas-compatible string
   * @param {object} rgba - {r, g, b, a} with values 0-1
   * @returns {string} CSS color string
   */
  static toCanvasColor(rgba) {
    const r = Math.round(rgba.r * 255);
    const g = Math.round(rgba.g * 255);
    const b = Math.round(rgba.b * 255);
    
    if (rgba.a !== undefined && rgba.a < 1.0) {
      return `rgba(${r}, ${g}, ${b}, ${rgba.a})`;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Get default color by index (cycles through palette)
   * @param {number} index - Dataset index
   * @returns {string} Hex color string
   */
  static getDefaultColor(index) {
    return ColorUtils.DEFAULT_PALETTE[index % ColorUtils.DEFAULT_PALETTE.length];
  }

  /**
   * Get array of all default colors
   * @returns {Array} Array of hex color strings
   */
  static getDefaultPalette() {
    return [...ColorUtils.DEFAULT_PALETTE];
  }

  /**
   * Private: Parse hex color
   * @private
   */
  static _parseHex(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Expand 3-digit hex to 6-digit
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    if (hex.length !== 6) {
      console.warn('Invalid hex color:', hex);
      return ColorUtils.parseColor(ColorUtils.DEFAULT_PALETTE[0]);
    }
    
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    
    return { r, g, b, a: 1.0 };
  }

  /**
   * Private: Parse RGB/RGBA color
   * @private
   */
  static _parseRgb(rgb) {
    const match = rgb.match(/rgba?\(([^)]+)\)/);
    if (!match) {
      console.warn('Invalid RGB color:', rgb);
      return ColorUtils.parseColor(ColorUtils.DEFAULT_PALETTE[0]);
    }
    
    const values = match[1].split(',').map(v => v.trim());
    
    const r = parseInt(values[0]) / 255;
    const g = parseInt(values[1]) / 255;
    const b = parseInt(values[2]) / 255;
    const a = values[3] !== undefined ? parseFloat(values[3]) : 1.0;
    
    return { r, g, b, a };
  }

  /**
   * Basic named colors (extend as needed)
   */
  static NAMED_COLORS = {
    'red': '#ff0000',
    'green': '#008000',
    'blue': '#0000ff',
    'black': '#000000',
    'white': '#ffffff',
    'yellow': '#ffff00',
    'cyan': '#00ffff',
    'magenta': '#ff00ff',
    'orange': '#ffa500',
    'purple': '#800080',
    'pink': '#ffc0cb',
    'brown': '#a52a2a',
    'gray': '#808080',
    'grey': '#808080'
  };
}

// Export default palette for convenience
export const DEFAULT_COLORS = ColorUtils.DEFAULT_PALETTE;
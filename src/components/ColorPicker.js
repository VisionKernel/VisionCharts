/**
 * ColorPicker.js - Simple grid-based color picker for datasets
 * Location: /src/components/ColorPicker.js
 * 
 * Creates a small color grid that appears when clicking a dataset's color button.
 * Designed to be lightweight and integrate cleanly with the existing demo UI.
 */

import { ColorUtils } from '../utils/ColorUtils.js';

export class ColorPicker {
  constructor(options = {}) {
    this.options = {
      colors: options.colors || ColorUtils.DEFAULT_PALETTE,
      columns: options.columns || 5,
      onColorSelect: options.onColorSelect || (() => {}),
      className: options.className || 'color-picker',
      ...options
    };
    
    this.element = null;
    this.isVisible = false;
    this.currentTarget = null;
    
    this._createPicker();
    this._bindEvents();
  }

  /**
   * Show color picker near the target element
   * @param {HTMLElement} targetElement - Element to position picker near
   * @param {string} currentColor - Currently selected color
   */
  show(targetElement, currentColor = null) {
    if (!targetElement) return;
    
    this.currentTarget = targetElement;
    this.isVisible = true;
    
    // Highlight current color if provided
    if (currentColor) {
      this._highlightCurrentColor(currentColor);
    }
    
    // Position picker near target
    this._positionPicker(targetElement);
    
    // Show picker
    this.element.style.display = 'block';
    
    // Add to document if not already added
    if (!this.element.parentElement) {
      document.body.appendChild(this.element);
    }
  }

  /**
   * Hide color picker
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.isVisible = false;
    this.currentTarget = null;
  }

  /**
   * Create the color picker DOM element
   * @private
   */
  _createPicker() {
    this.element = document.createElement('div');
    this.element.className = this.options.className;
    this.element.style.cssText = `
      position: absolute;
      z-index: 10000;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      display: none;
      grid-template-columns: repeat(${this.options.columns}, 20px);
      gap: 4px;
      max-width: ${this.options.columns * 24 + 16}px;
    `;
    
    // Use CSS Grid for layout
    this.element.style.display = 'none'; // Hidden initially
    this.element.style.gridTemplateColumns = `repeat(${this.options.columns}, 20px)`;
    
    // Create color swatches
    this.options.colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 1px solid #ddd;
        border-radius: 2px;
        cursor: pointer;
        transition: transform 0.1s ease;
      `;
      
      swatch.dataset.color = color;
      
      // Hover effect
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.1)';
        swatch.style.borderColor = '#999';
      });
      
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        if (!swatch.classList.contains('current')) {
          swatch.style.borderColor = '#ddd';
        }
      });
      
      // Click handler
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onColorSelect(color);
        this.hide();
      });
      
      this.element.appendChild(swatch);
    });
  }

  /**
   * Position picker near target element
   * @private
   */
  _positionPicker(targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const pickerRect = this.element.getBoundingClientRect();
    
    // Default position: below and to the right of target
    let left = rect.left;
    let top = rect.bottom + 4;
    
    // Adjust if picker would go off-screen
    if (left + pickerRect.width > window.innerWidth) {
      left = rect.right - pickerRect.width;
    }
    
    if (top + pickerRect.height > window.innerHeight) {
      top = rect.top - pickerRect.height - 4;
    }
    
    // Ensure picker stays on screen
    left = Math.max(4, Math.min(left, window.innerWidth - pickerRect.width - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - pickerRect.height - 4));
    
    this.element.style.left = left + 'px';
    this.element.style.top = top + 'px';
  }

  /**
   * Highlight the currently selected color
   * @private
   */
  _highlightCurrentColor(currentColor) {
    // Remove previous highlights
    this.element.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.remove('current');
      swatch.style.borderColor = '#ddd';
      swatch.style.borderWidth = '1px';
    });
    
    // Find and highlight current color
    const currentSwatch = this.element.querySelector(`[data-color="${currentColor}"]`);
    if (currentSwatch) {
      currentSwatch.classList.add('current');
      currentSwatch.style.borderColor = '#333';
      currentSwatch.style.borderWidth = '2px';
    }
  }

  /**
   * Bind global events for hiding picker
   * @private
   */
  _bindEvents() {
    // Hide on click outside
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.element.contains(e.target) && e.target !== this.currentTarget) {
        this.hide();
      }
    });
    
    // Hide on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
    
    // Hide on scroll
    window.addEventListener('scroll', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Update available colors
   */
  updateColors(newColors) {
    this.options.colors = newColors;
    this.element.innerHTML = '';
    this._createPicker();
  }

  /**
   * Destroy picker and clean up
   */
  destroy() {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.element = null;
    this.isVisible = false;
    this.currentTarget = null;
  }
}
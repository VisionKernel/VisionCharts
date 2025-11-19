export class InteractionManager {
  constructor(chart) {
    this.chart = chart;

    this.config = {
      throttleDelay: 16,
      debounceDelay: 100,
      enableTouchSupport: true,
      enableKeyboardSupport: true,
      crosshairEnabled: true,
      crosshairThreshold: 5,
      tooltipEnabled: false,
      tooltipDelay: 250
    };

    this.isMouseOver = false;
    this.lastMousePosition = null;
    this.lastUpdateTime = 0;

    this.throttledMouseMove = this._throttle(this._handleMouseMove.bind(this), this.config.throttleDelay);

    this.boundEventHandlers = {
      mouseMove: this.handleMouseMove.bind(this),
      mouseLeave: this.handleMouseLeave.bind(this),
      mouseEnter: this.handleMouseEnter.bind(this),
      touchStart: this.handleTouchStart.bind(this),
      touchMove: this.handleTouchMove.bind(this),
      touchEnd: this.handleTouchEnd.bind(this)
    };
  }

  initialize() {
    this.config.crosshairEnabled = true;
    this._attachEventListeners();
  }

  handleMouseMove(event) {
    if (!this.config.crosshairEnabled || !this.chart) {
      return;
    }
    this.throttledMouseMove(event);
  }

  handleMouseLeave(event) {
    this.isMouseOver = false;
    this.lastMousePosition = null;
    if (this.chart && this.chart.crosshair) {
      this.chart.crosshair.hide();
    }
  }

  handleMouseEnter(event) {
    this.isMouseOver = true;
  }

  handleTouchStart(event) {
    if (!this.config.enableTouchSupport || !this.config.crosshairEnabled) {
      return;
    }
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) {
      this._handleTouchEvent(touch);
    }
  }

  handleTouchMove(event) {
    if (!this.config.enableTouchSupport || !this.config.crosshairEnabled) {
      return;
    }
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) {
      this.throttledMouseMove(touch);
    }
  }

  handleTouchEnd(event) {
    if (!this.config.enableTouchSupport) {
      return;
    }
    if (this.chart && this.chart.crosshair) {
      this.chart.crosshair.hide();
    }
  }

  _handleMouseMove(event) {
    if (!this.chart || !this.chart._isMouseInChartArea) {
      return;
    }
    try {
      const rect = this.chart.container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      if (this.lastMousePosition) {
        const deltaX = Math.abs(mouseX - this.lastMousePosition.x);
        const deltaY = Math.abs(mouseY - this.lastMousePosition.y);
        if (deltaX < this.config.crosshairThreshold && deltaY < this.config.crosshairThreshold) {
          return;
        }
      }

      this.lastMousePosition = { x: mouseX, y: mouseY };

      if (!this.chart._isMouseInChartArea(mouseX, mouseY)) {
        if (this.chart.crosshair) {
          this.chart.crosshair.hide();
        }
        return;
      }

      if (typeof this.chart._onMouseMove === 'function') {
        this.chart._onMouseMove(event);
      }
    } catch (error) {}
  }

  _handleTouchEvent(touch) {
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      type: 'mousemove'
    };
    this._handleMouseMove(mouseEvent);
  }

  _attachEventListeners() {
    if (!this.chart || !this.chart.container) {
      return;
    }
    const container = this.chart.container;
    container.addEventListener('mousemove', this.boundEventHandlers.mouseMove, { passive: true });
    container.addEventListener('mouseleave', this.boundEventHandlers.mouseLeave, { passive: true });
    container.addEventListener('mouseenter', this.boundEventHandlers.mouseEnter, { passive: true });
    if (this.config.enableTouchSupport) {
      container.addEventListener('touchstart', this.boundEventHandlers.touchStart, { passive: false });
      container.addEventListener('touchmove', this.boundEventHandlers.touchMove, { passive: false });
      container.addEventListener('touchend', this.boundEventHandlers.touchEnd, { passive: true });
    }
  }

  _detachEventListeners() {
    if (!this.chart || !this.chart.container) {
      return;
    }
    const container = this.chart.container;
    container.removeEventListener('mousemove', this.boundEventHandlers.mouseMove);
    container.removeEventListener('mouseleave', this.boundEventHandlers.mouseLeave);
    container.removeEventListener('mouseenter', this.boundEventHandlers.mouseEnter);
    container.removeEventListener('touchstart', this.boundEventHandlers.touchStart);
    container.removeEventListener('touchmove', this.boundEventHandlers.touchMove);
    container.removeEventListener('touchend', this.boundEventHandlers.touchEnd);
  }

  _throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = performance.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  destroy() {
    this._detachEventListeners();
    this.chart = null;
    this.lastMousePosition = null;
    this.boundEventHandlers = {};
  }

  static createForChart(chart, config = {}) {
    const manager = new InteractionManager(chart);
    manager.initialize();
    return manager;
  }
}

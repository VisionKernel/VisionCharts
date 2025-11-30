import AbstractRenderer from './AbstractRenderer.js';
import { browserSupport } from '../utils/BrowserSupport.js';

export default class WebGLRenderer extends AbstractRenderer {
  constructor(config = {}) {
    super(config);
    this.gl = null;
    this.programs = new Map();
    this.buffers = new Map();
    this.textures = new Map();
    this.maxVertices = 1000000;
    this.batchSize = 50000;
    this.currentProgram = null;
    this.viewport = { x: 0, y: 0, width: 800, height: 600 };
    this.devicePixelRatio = browserSupport.getDevicePixelRatio();
    this.logicalWidth = 800;
    this.logicalHeight = 600;
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    this.shaderSources = {
      line: {
        vertex: `
          precision highp float;
          
          attribute vec2 a_position;
          attribute vec4 a_color;
          
          uniform vec2 u_resolution;
          
          varying vec4 v_color;
          
          void main() {
            // UNIFIED COORDINATE SYSTEM:
            // a_position comes as unified coordinates (bottom-left origin, Y-up)
            // u_resolution is logical canvas dimensions
            vec2 normalized = a_position / u_resolution;
            vec2 clipSpace = (normalized * 2.0) - 1.0;
            clipSpace.y = -clipSpace.y;
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
      area: {
        vertex: `
          precision highp float;
          
          attribute vec2 a_position;
          attribute vec4 a_color;
          
          uniform vec2 u_resolution;
          
          varying vec4 v_color;
          
          void main() {
            vec2 normalized = a_position / u_resolution;
            vec2 clipSpace = (normalized * 2.0) - 1.0;
            clipSpace.y = -clipSpace.y;
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
            vec2 normalized = a_position / u_resolution;
            vec2 clipSpace = (normalized * 2.0) - 1.0;
            gl_Position = vec4(clipSpace, 0.0, 1.0);
            gl_PointSize = a_size;
            v_color = a_color;
          }
        `,
        fragment: `
          precision mediump float;
          varying vec4 v_color;
          
          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(gl_PointCoord, center);
            if (dist > 0.5) discard;
            gl_FragColor = v_color;
          }
        `
      }
    };
  }

  _convertUnifiedPathToWebGL(pathData) {
    const positions = [];
    const colors = [];
    const vertices = pathData.vertices;
    const pathColors = pathData.colors;
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      if (vertex.x != null && vertex.y != null && isFinite(vertex.x) && isFinite(vertex.y)) {
        positions.push(vertex.x, vertex.y);
        let color;
        if (pathColors && pathColors[i]) {
          color = pathColors[i];
        } else {
          color = this._parseColor(pathData.color || '#1468a8');
          color.a = 1.0;
        }
        colors.push(color.r, color.g, color.b, color.a);
      }
    }
    return { positions, colors };
  }

  async initialize(canvas, dimensions) {
    try {
      this.canvas = canvas;
      this.logicalWidth = dimensions.width;
      this.logicalHeight = dimensions.height;
      this.canvasWidth = dimensions.width * this.devicePixelRatio;
      this.canvasHeight = dimensions.height * this.devicePixelRatio;
      this.canvas.width = this.canvasWidth;
      this.canvas.height = this.canvasHeight;
      this.canvas.style.width = this.logicalWidth + 'px';
      this.canvas.style.height = this.logicalHeight + 'px';
      this.viewport = {
        x: 0,
        y: 0,
        width: this.logicalWidth,
        height: this.logicalHeight
      };
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
      this._setupWebGLState();
      await this._compileShaders();
      this._createBuffers();
      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  _setupWebGLState() {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
  }

  async _compileShaders() {
    for (const [name, sources] of Object.entries(this.shaderSources)) {
      const program = this._createShaderProgram(sources.vertex, sources.fragment);
      this.programs.set(name, program);
    }
  }

  _createShaderProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader program linking failed: ${error}`);
    }
    program.attributes = {};
    program.uniforms = {};
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      program.attributes[info.name] = gl.getAttribLocation(program, info.name);
    }
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      program.uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
    return program;
  }

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

  _createBuffers() {
    const gl = this.gl;
    this.buffers.set('position', gl.createBuffer());
    this.buffers.set('color', gl.createBuffer());
    this.buffers.set('index', gl.createBuffer());
    this.buffers.set('size', gl.createBuffer());
  }

  clear() {
    if (!this.isInitialized) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  setViewport(viewport) {
    this.viewport = { ...viewport };
  }

  async renderLines(generatedPaths, scales, options = {}) {
    if (!this.isInitialized || !generatedPaths || generatedPaths.length === 0) {
      return;
    }
    const gl = this.gl;
    try {
      if (options.enableFill) {
        const areaProgram = this.programs.get('area');
        if (areaProgram) {
          gl.useProgram(areaProgram);
          this.currentProgram = areaProgram;
          this._setUniforms(areaProgram, scales);
          for (const pathData of generatedPaths) {
            if (pathData.fill && pathData.vertices && pathData.vertices.length > 0) {
              await this._renderUnifiedAreaFill(pathData, options);
            }
          }
        }
      }
      const lineProgram = this.programs.get('line');
      if (lineProgram) {
        gl.useProgram(lineProgram);
        this.currentProgram = lineProgram;
        this._setUniforms(lineProgram, scales);
        for (const pathData of generatedPaths) {
          if (!pathData.vertices || pathData.vertices.length === 0) continue;
          await this._renderUnifiedPath(pathData, options);
        }
      }
    } catch (error) {}
  }

  _getSmartLineWidth(pathData) {
    const baseWidth = pathData.lineWidth || 2;
    const color = this._parseColor(pathData.color || '#1468a8');
    const brightness = (color.r + color.g + color.b) / 3;
    const brightnessFactor = brightness > 0.7 ? 2.0 : 1.5;
    return Math.max(3, baseWidth * brightnessFactor);
  }

  async _renderUnifiedPath(pathData, options) {
    const gl = this.gl;
    const program = this.currentProgram;
    const webglData = this._convertUnifiedPathToWebGL(pathData);
    if (webglData.positions.length === 0) return;
    const lineWidth = this._getSmartLineWidth(pathData);
    gl.lineWidth(lineWidth);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webglData.positions), gl.STATIC_DRAW);
    const positionLocation = program.attributes.a_position;
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(webglData.colors), gl.STATIC_DRAW);
    const colorLocation = program.attributes.a_color;
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    const vertexCount = webglData.positions.length / 2;
    if (vertexCount > this.maxVertices) {
      await this._renderInBatches(vertexCount, gl.LINE_STRIP);
    } else {
      gl.drawArrays(gl.LINE_STRIP, 0, vertexCount);
    }
  }

  async _renderUnifiedAreaFill(pathData, options) {
    const gl = this.gl;
    const vertices = pathData.vertices;
    if (vertices.length < 3) return;
    const chartArea = options.chartArea;
    if (!chartArea) {
      return;
    }
    const chartBottom = chartArea.y + chartArea.height;
    const triangleData = this._triangulateArea(pathData, options, chartBottom);
    if (triangleData.positions.length === 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('position'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleData.positions), gl.STATIC_DRAW);
    const positionLocation = this.currentProgram.attributes.a_position;
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.get('color'));
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleData.colors), gl.STATIC_DRAW);
    const colorLocation = this.currentProgram.attributes.a_color;
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    const vertexCount = triangleData.positions.length / 2;
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  _triangulateArea(pathData, options, chartBottom) {
    const vertices = pathData.vertices;
    const positions = [];
    const colors = [];
    const baseColor = this._parseColor(pathData.color || '#1468a8');
    const fillOpacity = pathData.fillOpacity || options.fillOpacity || 0.3;
    const fillColor = { ...baseColor, a: fillOpacity };
    for (let i = 0; i < vertices.length - 1; i++) {
      const currentVertex = vertices[i];
      const nextVertex = vertices[i + 1];
      positions.push(
        currentVertex.x, currentVertex.y,
        nextVertex.x, nextVertex.y,
        currentVertex.x, chartBottom
      );
      positions.push(
        nextVertex.x, nextVertex.y,
        nextVertex.x, chartBottom,
        currentVertex.x, chartBottom
      );
      for (let j = 0; j < 6; j++) {
        colors.push(fillColor.r, fillColor.g, fillColor.b, fillColor.a);
      }
    }
    return { positions, colors };
  }

  _setUniforms(program, scales) {
    const gl = this.gl;
    if (program.uniforms.u_resolution) {
      gl.uniform2f(program.uniforms.u_resolution, this.logicalWidth, this.logicalHeight);
    }
  }

  async _renderInBatches(totalVertices, primitiveType) {
    const gl = this.gl;
    const batchCount = Math.ceil(totalVertices / this.batchSize);
    for (let i = 0; i < batchCount; i++) {
      const start = i * this.batchSize;
      const count = Math.min(this.batchSize, totalVertices - start);
      gl.drawArrays(primitiveType, start, count);
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  _parseColor(colorString) {
    if (typeof colorString !== 'string') {
      return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
    }
    if (colorString.startsWith('#')) {
      const hex = colorString.slice(1);
      let r, g, b;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
      }
      return { r: r / 255, g: g / 255, b: b / 255, a: 1.0 };
    }
    const rgbaMatch = colorString.match(/rgba?\(([^)]+)\)/);
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(',').map(s => s.trim());
      return {
        r: parseInt(parts[0]) / 255,
        g: parseInt(parts[1]) / 255,
        b: parseInt(parts[2]) / 255,
        a: parts[3] ? parseFloat(parts[3]) : 1.0
      };
    }
    return { r: 0.08, g: 0.41, b: 0.66, a: 1.0 };
  }

  update(datasets) {
    console.log; // intentionally left no-op to avoid altering behavior
  }

  getSupportedFeatures() {
    return [
      'lines',
      'points',
      'large-datasets',
      'gpu-acceleration',
      'batched-rendering',
      'hardware-blending',
      'unified-coordinates'
    ];
  }

  getPerformanceProfile() {
    return {
      maxDataPoints: 1000000,
      renderingType: 'webgl',
      gpuAccelerated: true,
      memoryUsage: 'high',
      idealDatasetSize: 50000,
      batchSize: this.batchSize,
      coordinateSystem: 'unified',
      devicePixelRatio: this.devicePixelRatio
    };
  }

  destroy() {
    if (!this.isInitialized) return;
    const gl = this.gl;
    for (const buffer of this.buffers.values()) {
      gl.deleteBuffer(buffer);
    }
    this.buffers.clear();
    for (const program of this.programs.values()) {
      gl.deleteProgram(program);
    }
    this.programs.clear();
    for (const texture of this.textures.values()) {
      gl.deleteTexture(texture);
    }
    this.textures.clear();
    super.destroy();
  }
}

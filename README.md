# VisionCharts

> A modern, high-performance JavaScript charting library optimized for financial and economic data visualization.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/visionkernel/visioncharts)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)


## ✨ Features

### 🚀 **Multi-Renderer Architecture**
- **Canvas 2D** for standard datasets (< 50K points)
- **WebGL** for large datasets (50K+ points) with GPU acceleration
- **SVG** fallback for maximum compatibility
- Automatic renderer selection based on data size and browser capabilities

### 📊 **Chart Types**
- **Line Charts** with customizable curves (linear, step, cardinal, monotone) and area fill capability
- **Bar Charts** with grouped and stacked options
- **Panel Views** for multi-dataset comparative analysis

### 📈 **Technical Analysis**
- **Moving Averages**: Simple (SMA) and Exponential (EMA)
- **Bollinger Bands** with configurable periods and standard deviations
- **Statistical Lines**: Zero line, average line, median line
- **Recession Indicators** with customizable periods and styling

### 🎨 **Visual Components**
- **Interactive Crosshairs** with data point tooltips
- **Dynamic Legends** with dataset management
- **Ending Labels** for latest values
- **Grid System** with major/minor lines
- **Custom Color Palettes** with color picker integration

### ⚡ **Performance & Compatibility**
- **Browser Support Detection** with capability reporting
- **Coordinate System Normalization** across all renderers
- **Data Processing Pipeline** with caching and optimization
- **Path Generation** with curve smoothing and interpolation
- **Memory Management** with efficient resource cleanup

## 🚀 Quick Start

### Installation

```bash
# Via npm
npm install visioncharts

# Via CDN
<script type="module" src="https://unpkg.com/visioncharts@latest/dist/visioncharts.esm.js"></script>
```

### Basic Usage

```javascript
import { LineChart } from 'visioncharts';

// Create a line chart
const chart = new LineChart({
  container: '#my-chart',
  data: [{
    id: 'dataset-1',
    name: 'Stock Price',
    color: '#1468a8',
    data: [
      { x: new Date('2024-01-01'), y: 100 },
      { x: new Date('2024-01-02'), y: 105 },
      { x: new Date('2024-01-03'), y: 98 }
    ]
  }],
  options: {
    title: 'Stock Performance',
    xAxisName: 'Date',
    yAxisName: 'Price ($)',
    width: 800,
    height: 400
  }
});

// Render the chart
await chart.render();
```

### Advanced Example with Technical Indicators

```javascript
import { LineChart } from 'visioncharts';

const chart = new LineChart({
  container: '#advanced-chart',
  data: [/* your time series data */],
  options: {
    title: 'Advanced Financial Chart',
    showRecessionLines: true,
    isLogarithmic: false,
    margin: { top: 40, right: 60, bottom: 60, left: 80 }
  }
});

await chart.render();

// Add technical indicators
chart.addStudy('sma', {
  name: 'SMA (20)',
  period: 20,
  color: '#FF6B35',
  strokeWidth: 2
});

chart.addStudy('bollinger', {
  name: 'Bollinger Bands',
  period: 20,
  standardDeviations: 2,
  color: '#9C27B0'
});
```

## 📚 API Reference

### Core Classes

#### Chart (Base Class)
```javascript
// Initialize
const chart = new Chart(config);

// Configuration methods
chart.addDataset(dataset);
chart.removeDataset(datasetId);
chart.updateDataset(datasetId, updates);

// Rendering
await chart.render();
chart.update();
chart.resize(width, height);

// Interaction
chart.toggleLogarithmicScale(enabled);
chart.toggleRecessionLines(enabled);
chart.toggleZeroLine(enabled);
```

#### LineChart
```javascript
const lineChart = new LineChart({
  container: '#chart',
  data: datasets,
  options: {
    // Line-specific options
    curve: 'monotone', // 'linear', 'step', 'cardinal', 'monotone'
    fillArea: false,
    fillOpacity: 0.3
  }
});
```

#### BarChart
```javascript
const barChart = new BarChart({
  container: '#chart',
  data: datasets,
  options: {
    // Bar-specific options
    barWidth: 0.8,
    groupPadding: 0.1,
    showValues: true
  }
});
```

### Technical Studies

#### Adding Studies
```javascript
// Simple Moving Average
const smaId = chart.addStudy('sma', {
  name: 'SMA (50)',
  datasetId: 'dataset-1',
  parameters: { period: 50 },
  color: '#34A853',
  strokeWidth: 2,
  visible: true
});

// Exponential Moving Average  
const emaId = chart.addStudy('ema', {
  name: 'EMA (20)',
  datasetId: 'dataset-1',
  parameters: { period: 20 },
  color: '#EA4335',
  strokeWidth: 2,
  visible: true
});

// Bollinger Bands
const bollingerId = chart.addStudy('bollinger', {
  name: 'Bollinger Bands',
  datasetId: 'dataset-1',
  parameters: { 
    period: 20,
    standardDeviations: 2 
  },
  color: '#9C27B0',
  strokeWidth: 1,
  visible: true
});
```

#### Managing Studies
```javascript
// Update study parameters
chart.updateStudy(studyId, {
  parameters: { period: 30 },
  color: '#FF5722'
});

// Remove study
chart.removeStudy(studyId);

// Get all studies
const studies = chart.getAllStudies();

// Get visible studies only
const visibleStudies = chart.getVisibleStudies();
```

### Data Format

#### Dataset Structure
```javascript
const dataset = {
  id: 'unique-id',           // Required: Unique identifier
  name: 'Display Name',      // Required: Human-readable name
  color: '#1468a8',          // Required: Chart color
  data: [                    // Required: Array of data points
    { 
      x: Date | number,      // X-axis value (timestamp or number)
      y: number              // Y-axis value
    }
  ],
  
  // Optional properties
  fill: false,               // Enable area fill (LineChart only)
  fillOpacity: 0.3,         // Fill opacity (0-1)
  strokeWidth: 2,           // Line width
  strokeOpacity: 1,         // Line opacity (0-1)
  visible: true,            // Dataset visibility
  interpolation: 'linear'   // Curve interpolation method
};
```

#### Time Series Data
```javascript
// Preferred format for financial data
const timeSeriesData = [
  { x: new Date('2024-01-01T09:30:00'), y: 150.25 },
  { x: new Date('2024-01-01T09:31:00'), y: 151.10 },
  { x: new Date('2024-01-01T09:32:00'), y: 149.85 }
];

// Also supports timestamps
const timestampData = [
  { x: 1704110400000, y: 150.25 },  // milliseconds since epoch
  { x: 1704110460000, y: 151.10 },
  { x: 1704110520000, y: 149.85 }
];
```

### Configuration Options

#### Chart Options
```javascript
const options = {
  // Dimensions
  width: 800,
  height: 400,
  margin: { top: 40, right: 60, bottom: 60, left: 80 },
  
  // Content
  title: 'Chart Title',
  xAxisName: 'Date',
  yAxisName: 'Value',
  
  // Data processing
  xField: 'x',              // X data field name
  yField: 'y',              // Y data field name  
  xType: 'time',            // 'time', 'number', 'category'
  yType: 'number',          // Data type for Y axis
  
  // Visualization
  isLogarithmic: false,     // Enable logarithmic Y scale
  showGrid: true,           // Show grid lines
  showLegend: true,         // Show legend
  showRecessionLines: false,// Show recession indicators
  
  // Styling
  titleFontSize: 16,
  titleFontFamily: 'Arial, sans-serif',
  titleColor: '#333333',
  backgroundColor: 'white',
  
  // Advanced
  enableCrosshair: true,    // Enable crosshair interaction
  enableZoom: true,         // Enable zoom/pan
  enableTooltips: true,     // Enable data tooltips
  animationDuration: 300    // Animation duration (ms)
};
```

## 🎨 Styling & Themes

### Custom Colors
```javascript
// Define custom color palette
const customPalette = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', 
  '#96CEB4', '#FECA57', '#FF9FF3'
];

// Apply to datasets
datasets.forEach((dataset, index) => {
  dataset.color = customPalette[index % customPalette.length];
});
```

### CSS Customization
```css
/* Override default styles */
.visioncharts-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.visioncharts-title {
  font-family: 'Helvetica Neue', sans-serif;
  font-weight: 300;
}

.visioncharts-legend-item {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.visioncharts-crosshair-line {
  stroke-dasharray: 3,3;
}
```

## 🔧 Browser Support

VisionCharts automatically detects browser capabilities and selects the optimal renderer:

| Browser | Canvas 2D | WebGL | SVG | Notes |
|---------|-----------|-------|-----|-------|
| Chrome 60+ | ✅ | ✅ | ✅ | Full support |
| Firefox 55+ | ✅ | ✅ | ✅ | Full support |
| Safari 12+ | ✅ | ✅ | ✅ | Full support |
| Edge 79+ | ✅ | ✅ | ✅ | Full support |
| IE 11 | ✅ | ❌ | ✅ | Limited (no WebGL) |

### Capability Detection
```javascript
import { browserSupport } from 'visioncharts';

// Check browser capabilities
const capabilities = browserSupport.getSupportSummary();
console.log('Canvas 2D:', capabilities.canvas2d);
console.log('WebGL:', capabilities.webgl);
console.log('High DPI:', capabilities.isHighDPI);

// Get recommended renderer for dataset size
const renderer = browserSupport.suggestRenderer(dataPointCount);
console.log(`Recommended renderer: ${renderer}`);
```

## 📊 Performance Guidelines

### Dataset Size Recommendations

| Data Points | Recommended Renderer | Expected Performance |
|-------------|---------------------|----------------------|
| < 1,000 | SVG or Canvas 2D | Excellent |
| 1,000 - 10,000 | Canvas 2D | Very Good |
| 10,000 - 50,000 | Canvas 2D | Good |
| 50,000+ | WebGL | Excellent |

### Optimization Tips

```javascript
// For large datasets, use WebGL
const chart = new LineChart({
  container: '#chart',
  data: largeDataset,
  options: {
    preferredRenderer: 'webgl',  // Force WebGL
    enableDataSampling: true,    // Sample data for better performance
    maxDataPoints: 100000        // Limit maximum points
  }
});

// Pre-process data for better performance
const processedData = chart.dataProcessor.processData(rawData, {
  removeOutliers: true,
  interpolateGaps: true,
  downsample: true,
  targetPoints: 10000
});
```

## 🛠️ Development

### Project Structure
```
visioncharts/
├── src/
│   ├── core/                # Core chart classes
│   │   ├── Chart.js         # Base chart class
│   │   ├── Axis.js          # Axis rendering
│   │   └── Scale.js         # Scale management
│   ├── charts/              # Chart implementations
│   │   ├── LineChart.js     # Line/area charts
│   │   └── BarChart.js      # Bar charts
│   ├── components/          # Reusable components
│   │   ├── Legend.js        # Legend component
│   │   ├── Grid.js          # Grid system
│   │   └── Crosshair.js     # Crosshair interaction
│   ├── renderers/           # Rendering backends
│   │   ├── CanvasRenderer.js# Canvas 2D renderer
│   │   └── WebGLRenderer.js # WebGL renderer
│   ├── utils/               # Utility modules
│   │   ├── DataProcessor.js # Data processing
│   │   ├── PathGenerator.js # Path generation
│   │   └── BrowserSupport.js# Browser detection
│   └── index.js             # Main export
└── examples/                # Demo and examples
    ├── index.html           # Interactive demo
    ├── scripts/             # Demo script
    ├── styles/              # Demo page style
	└── data/ 				 # Sample JSON data
```

### Building from Source
```bash
# Clone the repository
git clone https://github.com/visionkernel/visioncharts.git
cd visioncharts

# Install dependencies
npm install

# Build the library
npm run build

# Run development server
npm run dev

```

## 🤝 Community & Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/visionkernel/visioncharts/issues)
- **Discussions**: [Join our community discussions](https://github.com/visionkernel/visioncharts/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**VisionCharts v2.0.0** | © 2025 VisionKernel Team
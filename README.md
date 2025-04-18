# VisionCharts

A modern, high-performance JavaScript charting library optimized for financial and economic data visualization. Built specifically to replace multiple charting libraries in the VisionKernel platform.

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

VisionCharts is a specialized charting library designed specifically for financial and economic data visualization within the VisionKernel platform. Unlike general-purpose charting libraries, VisionCharts focuses on delivering professional-grade financial charts with optimal performance and a modern aesthetic.

## Key Features

- **Financial-First Design**: Optimized for financial data patterns and visualization needs
- **SVG Rendering**: Vector-based rendering for crisp visuals at any resolution
- **Responsive by Default**: Charts automatically adapt to container dimensions
- **Performance Focused**: Optimized for handling large financial datasets
- **Zero Dependencies**: Standalone library with no external dependencies

## Core Capabilities

All chart types in VisionCharts support these essential capabilities:

- **Multiple Datasets**: Plot several data series on a single chart
- **X and Y Axis Naming**: Custom axis titles for clear data identification
- **Logarithmic/Linear Scaling**: Toggle between scale types for different data visualization needs
- **Single and Multi-Panel Views**: View datasets individually or combined
- **Recession Line Indicators**: Show economic recession periods with shaded areas
- **Zero Line Display**: Emphasize the zero threshold with a reference line
- **Customizable Line Properties**: Adjust width, color, and style for each dataset
- **Technical Studies/Indicators**: Add common technical analysis tools (SMA, EMA, etc.)

## Chart Types

- **Line Charts**: Visualize trends over time with optional points and area fill
- **Area Charts**: Emphasize magnitude and cumulative value with stacked or standard views
- **Bar Charts**: Compare discrete values with grouped or individual bars

## Technical Indicators

- **Simple Moving Average (SMA)**: Average price over a specified period
- **Exponential Moving Average (EMA)**: Weighted average emphasizing recent prices
- **Bollinger Bands**: Volatility channels with standard deviation bands
- **Relative Strength Index (RSI)**: Momentum oscillator measuring speed and change of price movements
- **Moving Average Convergence Divergence (MACD)**: Trend-following momentum indicator

## Installation

```bash
npm install visioncharts
```

## Basic Usage

```javascript
import { LineChart } from 'visioncharts';

// Create a new chart
const chart = new LineChart({
  container: '#chart-container',
  data: financialData,
  options: {
    title: 'NASDAQ Composite',
    xAxisName: 'Date',
    yAxisName: 'Price',
    isLogarithmic: false,
    showZeroLine: true,
    showRecessionLines: true,
    recessions: [
      { start: '2020-02-01', end: '2020-04-15' },
      { start: '2007-12-01', end: '2009-06-30' }
    ]
  }
});

// Render the chart
chart.render();
```

## Multiple Datasets Example

```javascript
import { createChart } from 'visioncharts';

// Create chart with multiple datasets
const chart = createChart('line', {
  container: '#chart-container',
  data: [
    {
      id: 'nasdaq',
      name: 'NASDAQ',
      color: '#1468a8',
      width: 2,
      data: nasdaqData
    },
    {
      id: 'dow',
      name: 'Dow Jones',
      color: '#34A853',
      width: 2,
      data: dowData
    },
    {
      id: 'sp500',
      name: 'S&P 500',
      color: '#EA4335',
      width: 2,
      data: spData
    }
  ],
  options: {
    title: 'Market Comparison',
    isPanelView: false, // Show all on same chart
    isLogarithmic: true
  }
});

chart.render();
```

## Using Technical Indicators

```javascript
import { LineChart, calculateIndicator } from 'visioncharts';

// Create a chart
const chart = new LineChart({
  container: '#chart-container',
  data: stockData,
  options: {
    title: 'Stock Price with Moving Averages'
  }
});

// Calculate SMA and add to chart
const smaData = calculateIndicator('sma', stockData, { 
  period: 20,
  valueField: 'y',
  xField: 'x'
});

// Add SMA as a new dataset
chart.addDataset({
  id: 'sma-20',
  name: 'SMA (20)',
  color: '#FBBC05',
  width: 1.5,
  data: smaData
});

chart.render();
```

## Chart Customization API

All charts expose a consistent API for customization:

```javascript
// Toggle logarithmic scale
chart.toggleLogarithmic(true);

// Toggle panel view
chart.togglePanelView(true);

// Toggle recession lines
chart.toggleRecessionLines(true);

// Toggle zero line
chart.toggleZeroLine(true);

// Set axis names
chart.setXAxisName('Time');
chart.setYAxisName('Value ($)');

// Filter data by date range
chart.filterByDate('2020-01-01', '2021-12-31');

// Add a study/indicator
chart.addStudy('dataset-1', {
  id: 'ema-50',
  type: 'ema',
  params: { period: 50 },
  color: '#9C27B0'
});

// Export as SVG or PNG
const svgString = chart.exportSVG();
chart.exportPNG(2).then(dataUrl => {
  // Use the PNG data URL
});
```

## VisionKernel Integration

VisionCharts is designed to work seamlessly with the VisionKernel platform, providing a consistent API that matches the functionality of the multiple charting libraries previously used.

```javascript
// Load saved chart from VisionKernel
import { parseChartConfig, createChart } from 'visioncharts';

// Parse saved configuration
const parsedConfig = parseChartConfig(savedChartConfig);

// Create appropriate chart type
const chart = createChart(parsedConfig.chartType, {
  container: '#chart-container',
  data: chartData,
  options: parsedConfig
});

// Render chart
chart.render();
```

## Development

```bash
# Clone the repository
git clone https://github.com/VisionKernel/visioncharts.git

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## About

VisionCharts is developed as a core component of the VisionKernel platform, a comprehensive solution for financial and economic data analysis.
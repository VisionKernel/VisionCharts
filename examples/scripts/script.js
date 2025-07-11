// Enhanced script.js - Cleaned up version
// Location: /examples/scripts/script.js

import { LineChart, BarChart } from '../../../src/index.js';

// Global datasets storage
let availableDatasets = {};

// Chart instances
let lineChart = null;
let barChart = null;

// Dataset counters for unique IDs
let lineDatasetCounter = 1;
let barDatasetCounter = 1;

// Default color palette from the library
const DEFAULT_COLORS = [
  '#1468a8', // Blue
  '#34A853', // Green  
  '#FBBC05', // Yellow
  '#EA4335', // Red
  '#9C27B0', // Purple
  '#00ACC1', // Cyan
  '#FF9800', // Orange
  '#607D8B'  // Blue Grey
];

// Get default color by index
function getDefaultColor(index) {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

// Simple color picker using HTML5 color input
function openColorPicker(currentColor, onColorChange) {
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = currentColor;
  colorInput.style.position = 'absolute';
  colorInput.style.left = '-9999px';
  
  document.body.appendChild(colorInput);
  
  colorInput.addEventListener('change', (e) => {
    onColorChange(e.target.value);
    document.body.removeChild(colorInput);
  });
  
  colorInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(colorInput)) {
        document.body.removeChild(colorInput);
      }
    }, 100);
  });
  
  colorInput.click();
}

// Create dataset item with controls
function createDatasetItem(dataset, chartType) {
  const item = document.createElement('div');
  item.className = 'dataset-item';
  item.setAttribute('data-id', dataset.id);
  
  // Fill checkbox only for line charts
  const fillCheckboxHtml = chartType === 'line' ? `
    <label class="fill-checkbox-container" style="margin-right: 8px; cursor: pointer;">
      <input type="checkbox" class="fill-checkbox" ${dataset.fill ? 'checked' : ''} style="margin-right: 4px;">
      <span style="font-size: 12px; color: #666;">Fill</span>
    </label>
  ` : '';
  
  item.innerHTML = `
    <div class="dataset-info">
      <button class="color-picker-button" style="
        width: 20px; 
        height: 20px; 
        border: 1px solid #ccc; 
        border-radius: 3px; 
        background-color: ${dataset.color}; 
        cursor: pointer; 
        margin-right: 8px;
      " title="Click to change color"></button>
      
      ${fillCheckboxHtml}
      
      <span class="dataset-name">${dataset.name}</span>
      <span class="dataset-points">(${dataset.data.length} points)</span>
    </div>
    <div class="dataset-controls">
      <button class="remove-dataset">Remove</button>
    </div>
  `;
  
  // Color picker
  const colorButton = item.querySelector('.color-picker-button');
  colorButton.addEventListener('click', () => {
    openColorPicker(dataset.color, (newColor) => {
      const chart = chartType === 'line' ? lineChart : barChart;
      if (chart && chart.updateDatasetColor(dataset.id, newColor)) {
        colorButton.style.backgroundColor = newColor;
        dataset.color = newColor; // Update local reference
        console.log(`Updated ${chartType} dataset ${dataset.id} color to ${newColor}`);
      }
    });
  });
  
  // Fill checkbox (line charts only)
  if (chartType === 'line') {
    const fillCheckbox = item.querySelector('.fill-checkbox');
    if (fillCheckbox) {
      fillCheckbox.addEventListener('change', (e) => {
        const fillEnabled = e.target.checked;
        if (lineChart && lineChart.updateDatasetFill(dataset.id, fillEnabled)) {
          dataset.fill = fillEnabled; // Update local reference
          console.log(`Updated ${chartType} dataset ${dataset.id} fill to ${fillEnabled}`);
        }
      });
    }
  }
  
  // Remove button
  const removeBtn = item.querySelector('.remove-dataset');
  removeBtn.addEventListener('click', () => {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart) {
      chart.removeDataset(dataset.id);
      item.remove();
      console.log(`Removed dataset: ${dataset.id}`);
    }
  });
  
  return item;
}

// Add dataset to chart
function addDatasetToChart(chartType) {
  try {
    const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
    const randomizeCheckbox = document.getElementById(`${chartType}-randomize`);
    const datasetManager = document.getElementById(`${chartType}-datasets`);
    
    if (!sourceSelect || !datasetManager) {
      console.error('Dataset controls not found');
      return;
    }
    
    const selectedSource = sourceSelect.value;
    const shouldRandomize = randomizeCheckbox?.checked || false;
    
    // Get raw data
    let rawData = availableDatasets[selectedSource];
    if (!rawData || rawData.length === 0) {
      console.error('No data available for selected source:', selectedSource);
      return;
    }
    
    // Apply randomization if requested
    if (shouldRandomize) {
      rawData = rawData.map(point => ({
        ...point,
        y: point.y * (1 + (Math.random() - 0.5) * 0.3) // 30% variation
      }));
    }
    
    // Generate dataset properties
    let datasetId, datasetName, datasetColor, counter;
    
    if (chartType === 'line') {
      counter = lineDatasetCounter++;
      datasetId = `line-dataset-${counter}`;
      datasetName = `Line Dataset ${counter}`;
    } else {
      counter = barDatasetCounter++;
      datasetId = `bar-dataset-${counter}`;
      datasetName = `Bar Dataset ${counter}`;
    }
    
    datasetColor = getDefaultColor(counter - 1);
    
    // Format data for chart
    const formattedData = rawData.map(item => {
      if (chartType === 'line') {
        return { date: new Date(item.x), price: item.y };
      } else {
        return { x: new Date(item.x), y: item.y };
      }
    });
    
    // Create dataset object
    const dataset = {
      id: datasetId,
      name: datasetName,
      color: datasetColor,
      data: formattedData,
      width: 2,
      fill: false // Default to no fill
    };
    
    // Add to chart
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart) {
      chart.addDataset(dataset);
      
      // Add to UI
      const datasetItem = createDatasetItem(dataset, chartType);
      datasetManager.appendChild(datasetItem);
      
      console.log(`Added ${chartType} dataset: ${datasetName} with ${formattedData.length} points`);
    }
    
  } catch (error) {
    console.error('Error adding dataset:', error);
  }
}

// Initialize Line Chart
async function initLineChart() {
  console.log('Initializing Line Chart');
  
  try {
    const container = document.getElementById('line-chart');
    if (!container) {
      throw new Error('Line chart container not found');
    }
    
    // Load data
    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }
    
    // Create initial dataset
    const timeSeriesData = availableDatasets.timeseries.map(item => ({
      date: new Date(item.x),
      price: item.y
    }));
    
    const initialDataset = {
      id: 'line-dataset-1',
      name: 'Line Dataset 1',
      color: getDefaultColor(0),
      width: 2,
      fill: false,
      data: timeSeriesData
    };
    
    lineDatasetCounter = 2;
    
    // Create chart
    lineChart = new LineChart({
      container: container,
      data: [initialDataset],
      options: {
        title: 'Time Series Data',
        xField: 'date',
        yField: 'price',
        xType: 'time',
        yType: 'number',
        xAxisName: document.getElementById('line-x-name')?.value || 'Date',
        yAxisName: document.getElementById('line-y-name')?.value || 'Price ($)',
        showGrid: true
      }
    });
    
    await lineChart.render();
    window.lineChart = lineChart; // Debug access
    
    setupLineChartControls();
    setupDatasetManagement('line');
    
    // Add initial dataset to UI
    const datasetManager = document.getElementById('line-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(initialDataset, 'line');
      datasetManager.appendChild(datasetItem);
    }
    
    console.log('Line chart initialized successfully');
    
  } catch (error) {
    console.error('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

// Initialize Bar Chart
async function initBarChart() {
  console.log('Initializing Bar Chart');
  
  try {
    const container = document.getElementById('bar-chart');
    if (!container) {
      throw new Error('Bar chart container not found');
    }
    
    // Load data if needed
    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }
    
    // Create initial dataset
    const timeSeriesData = availableDatasets.timeseries.map(item => ({
      x: new Date(item.x),
      y: item.y
    }));
    
    const initialDataset = {
      id: 'bar-dataset-1',
      name: 'Bar Dataset 1',
      color: getDefaultColor(0),
      fill: false,
      data: timeSeriesData
    };
    
    barDatasetCounter = 2;
    
    // Create chart
    barChart = new BarChart({
      container: container,
      data: [initialDataset],
      options: {
        title: 'Bar Chart',
        xField: 'x',
        yField: 'y',
        xType: 'time',
        yType: 'number',
        xAxisName: document.getElementById('bar-x-name')?.value || 'Date',
        yAxisName: document.getElementById('bar-y-name')?.value || 'Value',
        showGrid: true
      }
    });
    
    await barChart.render();
    window.barChart = barChart; // Debug access
    
    setupBarChartControls();
    setupDatasetManagement('bar');
    
    // Add initial dataset to UI
    const datasetManager = document.getElementById('bar-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(initialDataset, 'bar');
      datasetManager.appendChild(datasetItem);
    }
    
    console.log('Bar chart initialized successfully');
    
  } catch (error) {
    console.error('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// Setup chart controls
function setupLineChartControls() {
  if (!lineChart) return;
  
  // Axis names
  const xNameInput = document.getElementById('line-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      lineChart.config.options.xAxisName = e.target.value;
      lineChart.render();
    });
  }
  
  const yNameInput = document.getElementById('line-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      lineChart.config.options.yAxisName = e.target.value;
      lineChart.render();
    });
  }
  
  // Recession lines toggle
  const recessionToggle = document.getElementById('line-toggle-recession');
  if (recessionToggle) {
    recessionToggle.classList.remove('active'); // Start inactive
    recessionToggle.addEventListener('click', () => {
      const newState = lineChart.toggleRecessionLines();
      recessionToggle.classList.toggle('active', newState);
    });
  }
  
  // Add other controls as needed...
}

function setupBarChartControls() {
  if (!barChart) return;
  
  // Axis names
  const xNameInput = document.getElementById('bar-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      barChart.config.options.xAxisName = e.target.value;
      barChart.render();
    });
  }
  
  const yNameInput = document.getElementById('bar-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      barChart.config.options.yAxisName = e.target.value;
      barChart.render();
    });
  }
  
  // Recession lines toggle
  const recessionToggle = document.getElementById('bar-toggle-recession');
  if (recessionToggle) {
    recessionToggle.classList.remove('active'); // Start inactive
    recessionToggle.addEventListener('click', () => {
      const newState = barChart.toggleRecessionLines();
      recessionToggle.classList.toggle('active', newState);
    });
  }
}

// Setup dataset management
function setupDatasetManagement(chartType) {
  // Dataset source change handler
  const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      updateDatasetPreview(chartType);
    });
    updateDatasetPreview(chartType); // Initialize preview
  }
  
  // Add dataset button
  const addButton = document.getElementById(`${chartType}-add-dataset`);
  if (addButton) {
    addButton.addEventListener('click', () => {
      addDatasetToChart(chartType);
    });
  }
}

// Update dataset preview
function updateDatasetPreview(chartType) {
  const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
  const previewDiv = document.getElementById(`${chartType}-dataset-preview`);
  
  if (sourceSelect && previewDiv && availableDatasets) {
    const selectedDataset = availableDatasets[sourceSelect.value];
    if (selectedDataset && selectedDataset.length > 0) {
      const firstPoint = selectedDataset[0];
      const lastPoint = selectedDataset[selectedDataset.length - 1];
      const startDate = new Date(firstPoint.x).toLocaleDateString();
      const endDate = new Date(lastPoint.x).toLocaleDateString();
      previewDiv.textContent = `${selectedDataset.length} points from ${startDate} to ${endDate}`;
    } else {
      previewDiv.textContent = 'No data available';
    }
  }
}

// Load datasets
async function loadAllDatasets() {
  const datasets = {};
  
  try {
    // Load timeseries data
    datasets.timeseries = await fetch('../examples/data/timeseries.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('timeseries'));
    
    // Load daily returns
    datasets['daily-returns'] = await fetch('../examples/data/daily-returns.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('daily-returns'));
    
    // Load monthly data
    datasets.monthly = await fetch('../examples/data/timeseries-monthly.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('monthly'));
    
    // Load NASDAQ data
    datasets.nasdaq = await fetch('../examples/data/NASDAQCOM.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('nasdaq'));
    
  } catch (error) {
    console.error('Error loading datasets:', error);
  }
  
  return datasets;
}

// Generate fallback data
function generateFallbackData(type) {
  const data = [];
  const startDate = new Date('2023-01-01');
  const count = type === 'monthly' ? 48 : 252; // 4 years monthly or 1 year daily
  let value = 100;
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    
    if (type === 'monthly') {
      date.setMonth(date.getMonth() + i);
    } else {
      date.setDate(date.getDate() + i);
    }
    
    if (type === 'daily-returns') {
      value = (Math.random() - 0.5) * 0.1; // Daily returns -5% to 5%
    } else {
      value += (Math.random() - 0.45) * 20; // Slight upward trend
    }
    
    data.push({ x: date.getTime(), y: value });
  }
  
  return data;
}

// Setup tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.chart-section');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.dataset.tab;
      
      // Update tab appearance
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Show/hide sections
      sections.forEach(section => {
        if (section.id === `${tabName}-section`) {
          section.style.display = 'block';
          
          // Initialize chart if needed
          if (tabName === 'line' && !lineChart) {
            initLineChart();
          } else if (tabName === 'bar' && !barChart) {
            initBarChart();
          }
        } else {
          section.style.display = 'none';
        }
      });
    });
  });
}

// Error handler
function handleError(containerId, error) {
  const container = document.getElementById(containerId);
  if (container) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
    container.innerHTML = '';
    container.appendChild(errorDiv);
  }
  console.error(`Error in ${containerId}:`, error);
}

// Wait for DOM ready
function waitForDOMReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

// Initialize everything
async function initializeCharts() {
  try {
    await waitForDOMReady();
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    
    setupTabs();
    await initLineChart(); // Initialize line chart first (default tab)
    
    console.log('Chart initialization complete');
    
  } catch (error) {
    console.error('Failed to initialize charts:', error);
    
    // Show error to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; background: red; color: white; padding: 10px; z-index: 9999;';
    errorDiv.textContent = `Chart initialization failed: ${error.message}`;
    document.body.appendChild(errorDiv);
  }
}

// Start initialization
initializeCharts();
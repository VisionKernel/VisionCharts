// Enhanced script.js with simple color picker functionality
// Location: /examples/demo/scripts/script.js
// Import the VisionCharts classes (removed ColorUtils and ColorPicker)
import { LineChart, BarChart } from '../../../src/index.js';

// Global datasets storage
let availableDatasets = {};

// Chart instances
let lineChart = null;
let barChart = null;

// Dataset counters for unique IDs
let lineDatasetCounter = 1;
let barDatasetCounter = 1;

// Simple default color palette (replaces ColorUtils)
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
function showColorPicker(currentColor, onColorSelect, targetElement) {
  // Create a hidden color input
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = currentColor;
  colorInput.style.position = 'absolute';
  colorInput.style.left = '-9999px';
  
  // Add to document temporarily
  document.body.appendChild(colorInput);
  
  // Handle color change
  colorInput.addEventListener('change', (e) => {
    const newColor = e.target.value;
    onColorSelect(newColor);
    document.body.removeChild(colorInput);
  });
  
  // Handle cancel (click away)
  colorInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(colorInput)) {
        document.body.removeChild(colorInput);
      }
    }, 100);
  });
  
  // Trigger the color picker
  colorInput.click();
}

// Update dataset color (CLEAN - use library method)
function updateDatasetColor(datasetId, newColor, chartType) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    
    if (!chart) {
      console.error('Chart not found for type:', chartType);
      return;
    }
    
    // Use the chart's updateDatasetColor method
    const success = chart.updateDatasetColor(datasetId, newColor);
    
    if (success) {
      // Update the UI color indicator
      const datasetItem = document.querySelector(`[data-id="${datasetId}"]`);
      if (datasetItem) {
        const colorButton = datasetItem.querySelector('.color-picker-button');
        if (colorButton) {
          colorButton.style.backgroundColor = newColor;
        }
      }
      
      log(`Updated ${chartType} dataset ${datasetId} color to ${newColor}`);
    } else {
      console.error(`Failed to update color for dataset ${datasetId}`);
    }
    
  } catch (error) {
    console.error('Error updating dataset color:', error);
  }
}

// Update dataset fill (for line charts)
function updateDatasetFill(datasetId, fillEnabled, chartType) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    
    if (!chart) {
      console.error('Chart not found for type:', chartType);
      return;
    }
    
    // Use the chart's updateDatasetFill method
    const success = chart.updateDatasetFill(datasetId, fillEnabled);
    
    if (success) {
      log(`Updated ${chartType} dataset ${datasetId} fill to ${fillEnabled}`);
    } else {
      console.error(`Failed to update fill for dataset ${datasetId}`);
    }
    
  } catch (error) {
    console.error('Error updating dataset fill:', error);
  }
}

function createDatasetItem(dataset, chartType, chart) {
  const item = document.createElement('div');
  item.className = 'dataset-item';
  item.setAttribute('data-id', dataset.id);
  
  // Only show fill checkbox for line charts
  const fillCheckboxHtml = chartType === 'line' ? `
    <label class="fill-checkbox-container" style="
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
      cursor: pointer;
    ">
      <input type="checkbox" class="fill-checkbox" ${dataset.fill ? 'checked' : ''} style="
        width: 14px;
        height: 14px;
        margin-right: 4px;
        cursor: pointer;
      ">
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
        display: inline-block;
        vertical-align: middle;
      " title="Click to change color"></button>
      
      ${fillCheckboxHtml}
      
      <span class="dataset-name">${dataset.name}</span>
      <span class="dataset-points">${dataset.data.length} points</span>
    </div>
    <div class="dataset-controls">
      <button class="remove-dataset" data-id="${dataset.id}">Remove</button>
    </div>
  `;
  
  // Add color picker functionality
  const colorButton = item.querySelector('.color-picker-button');
  colorButton.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Use simple color picker
    showColorPicker(dataset.color, (newColor) => {
      updateDatasetColor(dataset.id, newColor, chartType);
    }, colorButton);
  });
  
  // Add fill checkbox functionality (only for line charts)
  if (chartType === 'line') {
    const fillCheckbox = item.querySelector('.fill-checkbox');
    if (fillCheckbox) {
      fillCheckbox.addEventListener('change', (e) => {
        const fillEnabled = e.target.checked;
        updateDatasetFill(dataset.id, fillEnabled, chartType);
      });
    }
  }
  
  // Add remove functionality
  const removeBtn = item.querySelector('.remove-dataset');
  removeBtn.addEventListener('click', () => {
    if (chartType === 'line') {
      lineChart.removeDataset(dataset.id);
    } else if (chartType === 'bar') {
      barChart.removeDataset(dataset.id);
    }
    item.remove();
    log(`Removed dataset: ${dataset.id}`);
  });
  
  return item;
}

// Add dataset to chart (UPDATED to use simple default colors)
function addDatasetToChart(chartType) {
  try {
    const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
    const randomizeCheckbox = document.getElementById(`${chartType}-randomize`);
    const datasetManager = document.getElementById(`${chartType}-datasets`);
    
    if (!sourceSelect || !randomizeCheckbox || !datasetManager) {
      console.error('Dataset controls not found');
      return;
    }
    
    const selectedSource = sourceSelect.value;
    const shouldRandomize = randomizeCheckbox.checked;
    
    // Get raw data
    let rawData = availableDatasets[selectedSource];
    if (!rawData || rawData.length === 0) {
      console.error('No data available for selected source:', selectedSource);
      return;
    }
    
    // Apply randomization if requested
    if (shouldRandomize) {
      rawData = applyRandomVariation([...rawData], 0.15); // 15% variation
    }
    
    // Format data for the chart
    const formattedData = formatDataForChart(rawData, chartType);
    
    // Generate dataset ID and get color using our simple default colors
    let datasetId, datasetName, datasetColor;
    
    if (chartType === 'line') {
      datasetId = `line-dataset-${lineDatasetCounter}`;
      datasetName = `Line Dataset ${lineDatasetCounter}`;
      datasetColor = getDefaultColor(lineDatasetCounter - 1);
      lineDatasetCounter++;
    } else if (chartType === 'bar') {
      datasetId = `bar-dataset-${barDatasetCounter}`;
      datasetName = `Bar Dataset ${barDatasetCounter}`;
      datasetColor = getDefaultColor(barDatasetCounter - 1);
      barDatasetCounter++;
    }
    
    // Create dataset object
    const dataset = {
      id: datasetId,
      name: datasetName,
      color: datasetColor,
      data: formattedData
    };
    
    // Add line-specific properties
    if (chartType === 'line') {
      dataset.width = 2;
      dataset.fill = false; // Default to no fill
    }
    
    // Add to chart
    if (chartType === 'line' && lineChart) {
      lineChart.addDataset(dataset);
    } else if (chartType === 'bar' && barChart) {
      barChart.addDataset(dataset);
    }
    
    // Add to dataset manager UI
    const datasetItem = createDatasetItem(dataset, chartType, chartType === 'line' ? lineChart : barChart);
    datasetManager.appendChild(datasetItem);
    
    log(`Added ${chartType} dataset: ${datasetName} with ${formattedData.length} points (randomized: ${shouldRandomize})`);
    
  } catch (error) {
    console.error('Error adding dataset:', error);
  }
}

// Initialize Line Chart (UPDATED to use simple default colors)
async function initLineChart() {
  log('Initializing Line Chart');
  
  try {
    const containerElement = document.getElementById('line-chart');
    
    if (!containerElement) {
      throw new Error('Line chart container element with ID "line-chart" not found');
    }
    
    // Load datasets
    availableDatasets = await loadAllDatasets();
    
    // Use timeseries data for initial chart
    const timeSeriesData = availableDatasets.timeseries;
    
    // Format data for the line chart
    const formattedData = timeSeriesData.map(item => ({
      date: new Date(item.x),
      price: item.y
    }));
    
    // Create a single dataset using our simple default colors
    const data = [
      {
        id: 'line-dataset-1',
        name: 'Line Dataset 1',
        color: getDefaultColor(0), // Use our simple default color function
        width: 2,
        fill: false,  // Include fill default
        data: formattedData
      }
    ];
    
    // Increment counter since we used the first ID
    lineDatasetCounter = 2;
    
    // Get initial values from inputs
    const xAxisName = document.getElementById('line-x-name')?.value || 'Date';
    const yAxisName = document.getElementById('line-y-name')?.value || 'Value';
    
    // Create the line chart with grid enabled by default
    lineChart = new LineChart({
      container: containerElement,
      data: data,
      options: {
        title: 'Time Series Data',
        xField: 'date',
        yField: 'price',
        xType: 'time',
        yType: 'number',
        xAxisName: xAxisName,
        yAxisName: yAxisName,
        showGrid: true,
        showXGrid: true,
        showYGrid: true
      }
    });
    
    // Render the chart
    await lineChart.render();
    
    // Make globally accessible for debugging
    window.lineChart = lineChart;
    
    log('Line chart rendered successfully with grid');
    
    // Setup controls and dataset management
    setupLineChartControls();
    setupLineDatasetManagement();
    
    // Add initial dataset to UI
    const datasetManager = document.getElementById('line-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(data[0], 'line', lineChart);
      datasetManager.appendChild(datasetItem);
    }
    
  } catch (error) {
    log('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

// Initialize Bar Chart (UPDATED to use simple default colors)
async function initBarChart() {
  log('Initializing Bar Chart');
  
  try {
    const containerElement = document.getElementById('bar-chart');
    
    if (!containerElement) {
      throw new Error('Bar chart container element with ID "bar-chart" not found');
    }
    
    // Load datasets if not already loaded
    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }
    
    const timeSeriesData = availableDatasets.timeseries;
    
    // Transform data for bar chart
    const transformedData = timeSeriesData.map(item => ({
      x: new Date(item.x),
      y: item.y
    }));
    
    const data = [
      {
        id: 'bar-dataset-1',
        name: 'Bar Dataset 1',
        color: getDefaultColor(0), // Use our simple default color function
        fill: false,  // Include fill default (even though bars don't use it)
        data: transformedData
      }
    ];
    
    // Increment counter since we used the first ID
    barDatasetCounter = 2;
    
    const xAxisName = document.getElementById('bar-x-name')?.value || 'Date';
    const yAxisName = document.getElementById('bar-y-name')?.value || 'Value';
    
    // Create bar chart with grid enabled by default
    barChart = new BarChart({
      container: containerElement,
      data: data,
      options: {
        title: 'Bar Chart',
        xField: 'x',
        yField: 'y',
        xType: 'time',
        yType: 'number',
        xAxisName: xAxisName,
        yAxisName: yAxisName,
        showGrid: true,
        showXGrid: true,
        showYGrid: true
      }
    });
    
    await barChart.render();
    
    log('Bar chart rendered successfully with grid');
    
    // Setup controls and dataset management
    setupBarChartControls();
    setupBarDatasetManagement();
    
    // Add initial dataset to UI
    const datasetManager = document.getElementById('bar-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(data[0], 'bar', barChart);
      datasetManager.appendChild(datasetItem);
    }
    
  } catch (error) {
    log('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// Initialize everything (removed color picker initialization)
async function initializeCharts() {
  try {
    // Ensure DOM is ready
    await waitForDOMReady();
    
    // Small delay to ensure all elements are rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Setup tabs
    setupTabs();
    
    // Initialize the line chart (default active tab)
    await initLineChart();
    
    log('Chart initialization complete with simple color picker support');
    
  } catch (error) {
    console.error('Failed to initialize charts:', error);
    
    // Display error to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; background: red; color: white; padding: 10px; z-index: 9999;';
    errorDiv.textContent = `Chart initialization failed: ${error.message}`;
    document.body.appendChild(errorDiv);
  }
}

// [REST OF THE FUNCTIONS REMAIN THE SAME]
// Debug helper function
function log(message, obj = null) {
  console.log(message, obj);
}

// Error handler helper function
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

// Function to load all available datasets
async function loadAllDatasets() {
  const datasets = {};
  
  try {
    // Load timeseries data
    datasets.timeseries = await fetch('../examples/data/timeseries.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading timeseries data:', error);
        // Fallback data
        return [
          {"x": 1325397600000, "y": 395047.21724},
          {"x": 1333256400000, "y": 383193.04203},
          {"x": 1341118800000, "y": 395197.96324},
          {"x": 1349067600000, "y": 396612.1442},
          {"x": 1357020000000, "y": 400485.37204},
          {"x": 1364792400000, "y": 385334.45099},
          {"x": 1372654800000, "y": 360941.57118},
          {"x": 1380603600000, "y": 370633.93024},
          {"x": 1388556000000, "y": 361745.01486},
          {"x": 1396328400000, "y": 375814.71808}
        ];
      });
    
    // Load daily returns data
    datasets['daily-returns'] = await fetch('../examples/data/daily-returns.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading daily returns data:', error);
        // Generate fallback daily returns data
        return generateFallbackDailyReturns();
      });
    
    // Load monthly data
    datasets.monthly = await fetch('../examples/data/timeseries-monthly.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading monthly data:', error);
        // Generate fallback monthly data
        return generateFallbackMonthlyData();
      });

      // Load NASDAQ data
      datasets.nasdaq = await fetch('../examples/data/NASDAQCOM.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading nasdaq data:', error);
        // Generate fallback monthly data
        return generateFallbackMonthlyData();
      });
    
  } catch (error) {
    console.error('Error loading datasets:', error);
  }
  
  return datasets;
}

// Generate fallback daily returns data
function generateFallbackDailyReturns() {
  const data = [];
  const startDate = new Date('2023-01-01');
  for (let i = 0; i < 252; i++) { // ~1 year of trading days
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    data.push({
      x: date.getTime(),
      y: (Math.random() - 0.5) * 0.1 // Daily returns between -5% and 5%
    });
  }
  return data;
}

// Generate fallback monthly data
function generateFallbackMonthlyData() {
  const data = [];
  const startDate = new Date('2020-01-01');
  let value = 100;
  for (let i = 0; i < 48; i++) { // 4 years of monthly data
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    value += (Math.random() - 0.45) * 20; // Slight upward trend
    data.push({
      x: date.getTime(),
      y: value
    });
  }
  return data;
}

// Apply random variation to dataset
function applyRandomVariation(data, variationPercent = 0.1) {
  return data.map(point => {
    const variation = 1 + (Math.random() - 0.5) * 2 * variationPercent;
    return {
      ...point,
      y: point.y * variation
    };
  });
}

// Format data for chart consumption
function formatDataForChart(rawData, chartType) {
  return rawData.map(item => {
    if (chartType === 'line') {
      return {
        date: new Date(item.x),
        price: item.y
      };
    } else if (chartType === 'bar') {
      return {
        x: new Date(item.x),
        y: item.y
      };
    }
    return item;
  });
}

// Generate dataset preview text
function generateDatasetPreview(datasetKey) {
  const dataset = availableDatasets[datasetKey];
  if (!dataset || dataset.length === 0) {
    return 'No data available';
  }

  const firstPoint = dataset[0];
  const lastPoint = dataset[dataset.length - 1];
  const startDate = new Date(firstPoint.x).toLocaleDateString();
  const endDate = new Date(lastPoint.x).toLocaleDateString();
  
  return `${dataset.length} points from ${startDate} to ${endDate}`;
}

// Update dataset preview
function updateDatasetPreview(chartType) {
  const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
  const previewDiv = document.getElementById(`${chartType}-dataset-preview`);
  
  if (sourceSelect && previewDiv) {
    const selectedDataset = sourceSelect.value;
    previewDiv.textContent = generateDatasetPreview(selectedDataset);
  }
}

// Setup Line Chart Controls
function setupLineChartControls() {
  if (!lineChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('line-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      lineChart.config.options.xAxisName = e.target.value;
      lineChart.render();
    });
  }
  
  // Y axis name
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
    // Initialize button state to match chart default (off)
    recessionToggle.classList.remove('active');
    
    recessionToggle.addEventListener('click', () => {
      const newState = lineChart.toggleRecessionLines();
      
      // Force update button state
      if (newState) {
        recessionToggle.classList.add('active');
      } else {
        recessionToggle.classList.remove('active');
      }
      
      console.log('Recession button state:', newState ? 'active' : 'inactive');
    });
  }
}

// Setup Bar Chart Controls
function setupBarChartControls() {
  if (!barChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('bar-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      barChart.config.options.xAxisName = e.target.value;
      barChart.render();
    });
  }
  
  // Y axis name
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
    // Initialize button state to match chart default (off)
    recessionToggle.classList.remove('active');
    
    recessionToggle.addEventListener('click', () => {
      const newState = barChart.toggleRecessionLines();
      
      // Force update button state
      if (newState) {
        recessionToggle.classList.add('active');
      } else {
        recessionToggle.classList.remove('active');
      }
      
      console.log('Recession button state:', newState ? 'active' : 'inactive');
    });
  }
}

// Setup Line Dataset Management
function setupLineDatasetManagement() {
  // Dataset source change handler
  const sourceSelect = document.getElementById('line-dataset-source');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      updateDatasetPreview('line');
    });
    // Initialize preview
    updateDatasetPreview('line');
  }
  
  // Add dataset button
  const addButton = document.getElementById('line-add-dataset');
  if (addButton) {
    addButton.addEventListener('click', () => {
      addDatasetToChart('line');
    });
  }
}

// Setup Bar Dataset Management
function setupBarDatasetManagement() {
  // Dataset source change handler
  const sourceSelect = document.getElementById('bar-dataset-source');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      updateDatasetPreview('bar');
    });
    // Initialize preview
    updateDatasetPreview('bar');
  }
  
  // Add dataset button
  const addButton = document.getElementById('bar-add-dataset');
  if (addButton) {
    addButton.addEventListener('click', () => {
      addDatasetToChart('bar');
    });
  }
}

// Set up tab switching functionality
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
          
          // Initialize chart if not already done
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

// Wait for DOM to be ready
function waitForDOMReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

// Start initialization when script loads
initializeCharts();
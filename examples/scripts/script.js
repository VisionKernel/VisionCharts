// Enhanced script.js - Working recession toggle version
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

// Sample recession data for demonstration
// In real applications, users would provide their own recession periods
const SAMPLE_RECESSION_DATA = [
  // Great Recession
  { 
    start: '2007-12-01', 
    end: '2009-06-01',
    name: 'Great Recession (2007-2009)'
  },
  
  // Dot-com Recession
  { 
    start: '2001-03-01', 
    end: '2001-11-01',
    name: 'Dot-com Recession (2001)'
  },
  
  // COVID-19 Recession
  { 
    start: '2020-02-01', 
    end: '2020-04-01',
    name: 'COVID-19 Recession (2020)'
  },
  
  // 1990-1991 Gulf War Recession
  { 
    start: '1990-07-01', 
    end: '1991-03-01',
    name: 'Gulf War Recession (1990-1991)'
  },
  
  // 1981-1982 Recession
  { 
    start: '1981-07-01', 
    end: '1982-11-01',
    name: 'Early 1980s Recession'
  },
  
  // 1973-1975 Oil Crisis Recession
  { 
    start: '1973-11-01', 
    end: '1975-03-01',
    name: 'Oil Crisis Recession (1973-1975)'
  }
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
    
    // CRITICAL: Set up recession data after chart creation
    if (lineChart.recessionLines) {
      lineChart.recessionLines.setRecessionData(SAMPLE_RECESSION_DATA);
      console.log('Line chart: Loaded sample recession data');
    }
    
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
    
    console.log('Line chart initialized successfully with sample recession data');
    
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
    
    // CRITICAL: Set up recession data after chart creation
    if (barChart.recessionLines) {
      barChart.recessionLines.setRecessionData(SAMPLE_RECESSION_DATA);
      console.log('Bar chart: Loaded sample recession data');
    }
    
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
    
    console.log('Bar chart initialized successfully with sample recession data');
    
    } catch (error) {
    console.error('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// Setup line chart controls with working recession toggle
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
  
  // Recession toggle that actually works
  const recessionToggle = document.getElementById('line-toggle-recession');
  if (recessionToggle) {
    // Initialize button state - recessions start disabled
    recessionToggle.classList.remove('active');
    let recessionVisible = false; // Track state manually like legend toggle
    
    recessionToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        recessionVisible = !recessionVisible;
        
        // Apply the new state
        lineChart.toggleRecessionLines();
        
        console.log('Line chart recession toggle - new state:', recessionVisible);
        
        // Update button appearance based on manual state
        recessionToggle.classList.toggle('active', recessionVisible);
        
        console.log('Line recession button classes after toggle:', recessionToggle.className);
      } catch (error) {
        console.error('Error toggling line chart recessions:', error);
      }
    });
  }
  
  // Legend toggle with proper state tracking
  const legendToggle = document.getElementById('line-toggle-legend');
  if (legendToggle) {
    // Initialize button state - legend starts visible
    legendToggle.classList.add('active');
    let legendVisible = true; // Track state manually
    
    legendToggle.addEventListener('click', () => {
      try {
        if (lineChart.legend) {
          // Toggle the state
          legendVisible = !legendVisible;
          
          // Apply the new state
          lineChart.legend.setVisible(legendVisible);
          
          console.log('Legend toggle - new state:', legendVisible);
          
          // Update button appearance
          legendToggle.classList.toggle('active', legendVisible);
          
          console.log('Legend button classes after toggle:', legendToggle.className);
        }
      } catch (error) {
        console.error('Error toggling legend:', error);
      }
    });
  }

  const endingLabelsToggle = document.getElementById('line-toggle-endinglabels');
  if (endingLabelsToggle) {
    // Initialize button state - ending labels start disabled
    endingLabelsToggle.classList.remove('active');
    let endingLabelsVisible = false; // Track state manually
    
    endingLabelsToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        endingLabelsVisible = !endingLabelsVisible;
        
        // Apply the new state - DON'T pass parameters, let it toggle naturally
        lineChart.toggleEndingLabels();
        
        console.log('Line chart ending labels toggle - new state:', endingLabelsVisible);
        
        // Update button appearance based on manual state (like recession toggle)
        endingLabelsToggle.classList.toggle('active', endingLabelsVisible);
        
        console.log('Line ending labels button classes after toggle:', endingLabelsToggle.className);
      } catch (error) {
        console.error('Error toggling line chart ending labels:', error);
      }
    });
  }

  const zeroToggle = document.getElementById('line-toggle-zero');
  if (zeroToggle) {
    // Initialize button state - zero line starts disabled
    zeroToggle.classList.remove('active');
    let zeroVisible = false;
    
    zeroToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        zeroVisible = !zeroVisible;
        
        // Apply the new state
        lineChart.toggleZeroLine();
        
        console.log('Line chart zero line toggle - new state:', zeroVisible);
        
        // Update button appearance
        zeroToggle.classList.toggle('active', zeroVisible);
        
      } catch (error) {
        console.error('Error toggling line chart zero line:', error);
      }
    });
  }

  const averageToggle = document.getElementById('line-toggle-average');
  if (averageToggle) {
    // Initialize button state - average line starts disabled
    averageToggle.classList.remove('active');
    let averageVisible = false;
    
    averageToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        averageVisible = !averageVisible;
        
        // Apply the new state
        lineChart.toggleAverageLine();
        
        console.log('Line chart average line toggle - new state:', averageVisible);
        
        // Update button appearance
        averageToggle.classList.toggle('active', averageVisible);
        
      } catch (error) {
        console.error('Error toggling line chart average line:', error);
      }
    });
  }

  // Median line toggle
  const medianToggle = document.getElementById('line-toggle-median');
  if (medianToggle) {
    // Initialize button state - median line starts disabled
    medianToggle.classList.remove('active');
    let medianVisible = false;
    
    medianToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        medianVisible = !medianVisible;
        
        // Apply the new state
        lineChart.toggleMedianLine();
        
        console.log('Line chart median line toggle - new state:', medianVisible);
        
        // Update button appearance
        medianToggle.classList.toggle('active', medianVisible);
        
      } catch (error) {
        console.error('Error toggling line chart median line:', error);
      }
    });
  }

  const linePanelToggle = document.getElementById('line-toggle-panel');
  if (linePanelToggle) {
    linePanelToggle.addEventListener('click', async () => {
      try {
        // Check if we have multiple datasets
        if (!lineChart.config.data || lineChart.config.data.length <= 1) {
          alert('Panel mode requires multiple datasets. Please add more datasets first.');
          return;
        }
        
        // Show loading state
        linePanelToggle.textContent = 'Loading...';
        linePanelToggle.disabled = true;
        
        // Toggle panel mode
        const isPanelMode = await lineChart.togglePanelMode();
        
        // Update button appearance
        linePanelToggle.classList.toggle('active', isPanelMode);
        linePanelToggle.textContent = 'Toggle Panel View';
        linePanelToggle.disabled = false;
        
        console.log('Line chart panel mode:', isPanelMode ? 'enabled' : 'disabled');
        
      } catch (error) {
        console.error('Error toggling line chart panel mode:', error);
        
        // Reset button state on error
        linePanelToggle.textContent = 'Toggle Panel View';
        linePanelToggle.disabled = false;
        linePanelToggle.classList.remove('active');
        alert('Error switching panel mode. Please try again.');
      }
    });
  }
}

// Setup bar chart controls with working recession toggle
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
  
  // Recession toggle that actually works
  const recessionToggle = document.getElementById('bar-toggle-recession');
  if (recessionToggle) {
    // Initialize button state - recessions start disabled
    recessionToggle.classList.remove('active');
    let recessionVisible = false; // Track state manually like legend toggle
    
    recessionToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        recessionVisible = !recessionVisible;
        
        // Apply the new state
        barChart.toggleRecessionLines();
        
        console.log('Bar chart recession toggle - new state:', recessionVisible);
        
        // Update button appearance based on manual state
        recessionToggle.classList.toggle('active', recessionVisible);
        
        console.log('Bar recession button classes after toggle:', recessionToggle.className);
      } catch (error) {
        console.error('Error toggling bar chart recessions:', error);
      }
    });
  }
  
  // Legend toggle with proper state tracking
  const legendToggle = document.getElementById('bar-toggle-legend');
  if (legendToggle) {
    // Initialize button state - legend starts visible
    legendToggle.classList.add('active');
    let legendVisible = true; // Track state manually
    
    legendToggle.addEventListener('click', () => {
      try {
        if (barChart.legend) {
          // Toggle the state
          legendVisible = !legendVisible;
          
          // Apply the new state
          barChart.legend.setVisible(legendVisible);
          
          console.log('Bar legend toggle - new state:', legendVisible);
          
          // Update button appearance
          legendToggle.classList.toggle('active', legendVisible);
          
          console.log('Bar legend button classes after toggle:', legendToggle.className);
        }
      } catch (error) {
        console.error('Error toggling bar legend:', error);
      }
    });
  }

  const endingLabelsToggle = document.getElementById('bar-toggle-endinglabels');
  if (endingLabelsToggle) {
    // Initialize button state - ending labels start disabled
    endingLabelsToggle.classList.remove('active');
    let endingLabelsVisible = false; // Track state manually
    
    endingLabelsToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        endingLabelsVisible = !endingLabelsVisible;
        
        // Apply the new state - DON'T pass parameters, let it toggle naturally
        barChart.toggleEndingLabels();
        
        console.log('Bar chart ending labels toggle - new state:', endingLabelsVisible);
        
        // Update button appearance based on manual state (like recession toggle)
        endingLabelsToggle.classList.toggle('active', endingLabelsVisible);
        
        console.log('Bar ending labels button classes after toggle:', endingLabelsToggle.className);
      } catch (error) {
        console.error('Error toggling bar chart ending labels:', error);
      }
    });
  }
  const zeroToggle = document.getElementById('bar-toggle-zero');
  if (zeroToggle) {
    // Initialize button state - zero line starts enabled for bar charts
    zeroToggle.classList.add('active');
    let zeroVisible = true;
    
    // Enable zero line by default for bar chart
    setTimeout(() => {
      if (barChart && barChart.zeroLine) {
        barChart.toggleZeroLine(true);
      }
    }, 100);
    
    zeroToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        zeroVisible = !zeroVisible;
        
        // Apply the new state
        barChart.toggleZeroLine();
        
        console.log('Bar chart zero line toggle - new state:', zeroVisible);
        
        // Update button appearance
        zeroToggle.classList.toggle('active', zeroVisible);
        
      } catch (error) {
        console.error('Error toggling bar chart zero line:', error);
      }
    });
  }

  const averageToggle = document.getElementById('bar-toggle-average');
  if (averageToggle) {
    // Initialize button state - average line starts disabled
    averageToggle.classList.remove('active');
    let averageVisible = false;
    
    averageToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        averageVisible = !averageVisible;
        
        // Apply the new state
        barChart.toggleAverageLine();
        
        console.log('Bar chart average line toggle - new state:', averageVisible);
        
        // Update button appearance
        averageToggle.classList.toggle('active', averageVisible);
        
      } catch (error) {
        console.error('Error toggling bar chart average line:', error);
      }
    });
  }

  // Median line toggle
  const medianToggle = document.getElementById('bar-toggle-median');
  if (medianToggle) {
    // Initialize button state - median line starts disabled
    medianToggle.classList.remove('active');
    let medianVisible = false;
    
    medianToggle.addEventListener('click', () => {
      try {
        // Toggle the state manually
        medianVisible = !medianVisible;
        
        // Apply the new state
        barChart.toggleMedianLine();
        
        console.log('Bar chart median line toggle - new state:', medianVisible);
        
        // Update button appearance
        medianToggle.classList.toggle('active', medianVisible);
        
      } catch (error) {
        console.error('Error toggling bar chart median line:', error);
      }
    });
  }

  const barPanelToggle = document.getElementById('bar-toggle-panel');
  if (barPanelToggle) {
    barPanelToggle.addEventListener('click', async () => {
      try {
        // Check if we have multiple datasets
        if (!barChart.config.data || barChart.config.data.length <= 1) {
          alert('Panel mode requires multiple datasets. Please add more datasets first.');
          return;
        }
        
        // Show loading state
        barPanelToggle.textContent = 'Loading...';
        barPanelToggle.disabled = true;
        
        // Toggle panel mode
        const isPanelMode = await barChart.togglePanelMode();
        
        // Update button appearance
        barPanelToggle.classList.toggle('active', isPanelMode);
        barPanelToggle.textContent = 'Toggle Panel View';
        barPanelToggle.disabled = false;
        
        console.log('Bar chart panel mode:', isPanelMode ? 'enabled' : 'disabled');
        
      } catch (error) {
        console.error('Error toggling bar chart panel mode:', error);
        
        // Reset button state on error
        barPanelToggle.textContent = 'Toggle Panel View';
        barPanelToggle.disabled = false;
        barPanelToggle.classList.remove('active');
        alert('Error switching panel mode. Please try again.');
      }
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

// Load datasets with better date ranges for recession visibility
async function loadAllDatasets() {
  const datasets = {};
  
  try {
    // Load timeseries data
    datasets.timeseries = await fetch('../examples/data/timeseries.json')
      .then(response => response.json())
      .then(data => {
        console.log(`Loaded timeseries data: ${data.length} points`);
        if (data.length > 0) {
          const firstDate = new Date(data[0].x);
          const lastDate = new Date(data[data.length - 1].x);
          console.log(`Timeseries date range: ${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`);
        }
        return data;
      })
      .catch(() => {
        console.log('Timeseries data not found, generating fallback data with recessions');
        return generateFallbackData('timeseries');
      });
    
    // Load daily returns
    datasets['daily-returns'] = await fetch('../examples/data/daily-returns.json')
      .then(response => response.json())
      .catch(() => {
        console.log('Daily returns data not found, generating fallback data');
        return generateFallbackData('daily-returns');
      });
    
    // Load monthly data
    datasets.monthly = await fetch('../examples/data/timeseries-monthly.json')
      .then(response => response.json())
      .catch(() => {
        console.log('Monthly data not found, generating fallback data');
        return generateFallbackData('monthly');
      });
    
    // Load NASDAQ data
    datasets.nasdaq = await fetch('../examples/data/NASDAQCOM.json')
      .then(response => response.json())
      .catch(() => {
        console.log('NASDAQ data not found, generating fallback data');
        return generateFallbackData('nasdaq');
      });
    
    // Log overall date ranges for debugging
    Object.keys(datasets).forEach(key => {
      const dataset = datasets[key];
      if (dataset && dataset.length > 0) {
        const firstDate = new Date(dataset[0].x);
        const lastDate = new Date(dataset[dataset.length - 1].x);
        console.log(`${key} dataset: ${dataset.length} points from ${firstDate.getFullYear()} to ${lastDate.getFullYear()}`);
      }
    });
    
  } catch (error) {
    console.error('Error loading datasets:', error);
  }
  
  return datasets;
}

// Generate fallback data that includes recession periods
function generateFallbackData(type) {
  const data = [];
  // Start from 2000 to include multiple recession periods
  const startDate = new Date('2000-01-01');
  const count = type === 'monthly' ? 300 : 6000; // More data points to cover recession periods
  let value = 100;
  
  // Define recession periods for realistic data simulation
  const recessionPeriods = [
    { start: new Date('2020-02-01'), end: new Date('2020-04-01') }, // COVID recession
    { start: new Date('2007-12-01'), end: new Date('2009-06-01') }, // Great Recession
    { start: new Date('2001-03-01'), end: new Date('2001-11-01') }  // Dot-com recession
  ];
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    
    if (type === 'monthly') {
      date.setMonth(date.getMonth() + i);
    } else {
      date.setDate(date.getDate() + i);
    }
    
    // Check if current date is in a recession period
    const isInRecession = recessionPeriods.some(recession => 
      date >= recession.start && date <= recession.end
    );
    
    if (type === 'daily-returns') {
      // More volatile during recessions
      const volatilityMultiplier = isInRecession ? 2.0 : 1.0;
      value = (Math.random() - 0.5) * 0.1 * volatilityMultiplier; // Daily returns
    } else {
      // During recessions, add more downward pressure
      const recessionEffect = isInRecession ? -15 : 0;
      const baseChange = (Math.random() - 0.45) * 20;
      value += baseChange + recessionEffect * (Math.random() * 0.5);
      
      // Prevent value from going below a reasonable minimum
      value = Math.max(value, 10);
    }
    
    data.push({ x: date.getTime(), y: value });
  }
  
  console.log(`Generated ${type} data from ${startDate.toLocaleDateString()} to ${new Date(startDate.getTime() + (count * (type === 'monthly' ? 30 : 1) * 24 * 60 * 60 * 1000)).toLocaleDateString()}`);
  
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
    
    console.log('Chart initialization complete with working recession toggles');
    
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
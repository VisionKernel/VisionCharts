// Enhanced script.js - Working recession toggle version with Studies Integration
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

// Study counters for unique naming
let lineStudyCounter = 1;
let barStudyCounter = 1;

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
      // Update study dropdowns after removing dataset
      updateStudyDatasetDropdowns();
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
      
      // Update study dropdowns after adding dataset
      updateStudyDatasetDropdowns();
      
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
        yField: 'value',
        xType: 'time',
        yType: 'number',
        xAxisName: document.getElementById('line-x-name')?.value || 'Date',
        yAxisName: document.getElementById('line-y-name')?.value || 'Price ($)',
        showGrid: true
      }
    });

    await lineChart._initPromise;
    
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
    
    // Initialize study dataset dropdowns
    updateStudyDatasetDropdowns();
    
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
    
    // Initialize study dataset dropdowns
    updateStudyDatasetDropdowns();
    
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
        lineChart.toggleRecessionLines(recessionVisible);
        
        console.log('Line chart recession toggle - new state:', recessionVisible);
        
        // Update button appearance based on manual state
        recessionToggle.classList.toggle('active', recessionVisible);
        
        console.log('Line recession button classes after toggle:', recessionToggle.className);
      } catch (error) {
        console.error('Error toggling line chart recessions:', error);
      }
    });
  }
  
  // Logarithmic scale toggle
  const logToggle = document.getElementById('line-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      try {
        const isLog = lineChart.toggleLogarithmicScale();
        logToggle.classList.toggle('active', isLog);
        console.log(`Line chart log scale ${isLog ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Error toggling logarithmic scale:', error);
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

  // ✅ ADDED: Curve type handler - affects all lines on chart and all panels
  const curveTypeSelect = document.getElementById('line-curve');
  if (curveTypeSelect) {
    curveTypeSelect.addEventListener('change', (e) => {
      try {
        const curveType = e.target.value;
        console.log('Setting curve type to:', curveType);
        
        // This will affect all lines on the chart and all panels if in panel mode
        lineChart.setCurveType(curveType);
        
        console.log('Curve type updated successfully');
      } catch (error) {
        console.error('Error setting curve type:', error);
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
        barChart.toggleRecessionLines(recessionVisible);
        
        console.log('Bar chart recession toggle - new state:', recessionVisible);
        
        // Update button appearance based on manual state
        recessionToggle.classList.toggle('active', recessionVisible);
        
        console.log('Bar recession button classes after toggle:', recessionToggle.className);
      } catch (error) {
        console.error('Error toggling bar chart recessions:', error);
      }
    });
  }
  
  // Logarithmic scale toggle
  const barLogToggle = document.getElementById('bar-toggle-log');
  if (barLogToggle) {
    barLogToggle.addEventListener('click', () => {
      try {
        const isLog = barChart.toggleLogarithmicScale();
        barLogToggle.classList.toggle('active', isLog);
        console.log(`Bar chart log scale ${isLog ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Error toggling bar chart logarithmic scale:', error);
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

// ========== STUDY MANAGEMENT FUNCTIONALITY ==========

// Initialize study functionality
function initStudyControls() {
  console.log('Initializing study controls...');
  
  // Line chart study controls
  initLineStudyControls();
  
  // Bar chart study controls  
  initBarStudyControls();
  
  // Initialize accordion functionality for studies sections
  initStudyAccordions();
}

// Initialize line chart study controls
function initLineStudyControls() {
  const addStudyButton = document.querySelector('#line-section .accordion-content button');
  if (addStudyButton) {
    addStudyButton.addEventListener('click', () => addStudyToChart('line'));
  }
  
  console.log('Line study controls initialized');
}

// Initialize bar chart study controls
function initBarStudyControls() {
  const addStudyButton = document.querySelector('#bar-section .accordion-content button');
  if (addStudyButton) {
    addStudyButton.addEventListener('click', () => addStudyToChart('bar'));
  }
  
  console.log('Bar study controls initialized');
}

// Add study to chart
function addStudyToChart(chartType) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (!chart) {
      console.error(`${chartType} chart not initialized`);
      return;
    }

    // Get study parameters from UI
    const studyType = document.getElementById(`${chartType}-study-type`).value;
    const period = parseInt(document.getElementById(`${chartType}-study-period`).value);
    const datasetSelect = document.getElementById(`${chartType}-study-dataset`);
    const datasetId = datasetSelect.value;
    const color = document.getElementById(`${chartType}-study-color`).value;

    // Validate inputs
    if (!studyType || !period || period < 1) {
      alert('Please provide valid study parameters');
      return;
    }

    // Check if study type is supported (core library supports sma, ema, bollinger)
    const supportedTypes = ['sma', 'ema', 'bollinger'];
    if (!supportedTypes.includes(studyType)) {
      alert(`Study type "${studyType}" is not yet implemented in the core library. Currently supported: ${supportedTypes.join(', ')}`);
      return;
    }

    // Generate study name
    const counter = chartType === 'line' ? lineStudyCounter++ : barStudyCounter++;
    const studyName = `${studyType.toUpperCase()} (${period})`;

    // Create study configuration
    const studyConfig = {
      name: studyName,
      datasetId: datasetId,
      parameters: { period: period },
      color: color,
      strokeWidth: 2,
      visible: true
    };

    // Add study to chart using the core library method
    const studyId = chart.addStudy(studyType, studyConfig);
    
    // Add study to UI
    addStudyToUI(chartType, studyId, studyName, studyType, period, color);
    
    console.log(`Added ${studyType} study to ${chartType} chart: ${studyName}`);
    
  } catch (error) {
    console.error('Error adding study:', error);
    alert(`Error adding study: ${error.message}`);
  }
}

// Add study item to UI
function addStudyToUI(chartType, studyId, studyName, studyType, period, color) {
  const activeStudiesContainer = document.querySelector(`#${chartType}-section .accordion-content > div:last-child`);
  if (!activeStudiesContainer) return;

  // Remove "No studies added" text if it exists
  if (activeStudiesContainer.textContent.includes('No studies added')) {
    activeStudiesContainer.innerHTML = '';
  }

  // Create study item
  const studyItem = document.createElement('div');
  studyItem.className = 'study-item';
  studyItem.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin: 4px 0;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
  `;
  studyItem.setAttribute('data-study-id', studyId);

  studyItem.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 12px; height: 12px; background-color: ${color}; border-radius: 2px;"></div>
      <span style="font-weight: 500;">${studyName}</span>
      <span style="color: #6c757d; font-size: 12px;">${studyType}</span>
    </div>
    <div style="display: flex; gap: 4px;">
      <button class="study-toggle-btn" style="padding: 2px 6px; font-size: 11px; background-color: #198754; color: white; border: none; border-radius: 3px; cursor: pointer;">
        Hide
      </button>
      <button class="study-remove-btn" style="padding: 2px 6px; font-size: 11px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">
        ✕
      </button>
    </div>
  `;

  // Add event listeners
  const toggleBtn = studyItem.querySelector('.study-toggle-btn');
  const removeBtn = studyItem.querySelector('.study-remove-btn');
  
  let isVisible = true;
  toggleBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    toggleStudyVisibility(chartType, studyId, isVisible);
    toggleBtn.textContent = isVisible ? 'Hide' : 'Show';
    toggleBtn.style.backgroundColor = isVisible ? '#198754' : '#6c757d';
  });

  removeBtn.addEventListener('click', () => {
    removeStudyFromChart(chartType, studyId, studyItem);
  });

  activeStudiesContainer.appendChild(studyItem);
}

// Toggle study visibility
function toggleStudyVisibility(chartType, studyId, isVisible) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart && chart.updateStudy) {
      chart.updateStudy(studyId, { visible: isVisible });
      console.log(`${isVisible ? 'Showed' : 'Hidden'} study: ${studyId}`);
    }
  } catch (error) {
    console.error('Error toggling study visibility:', error);
  }
}

// Remove study from chart
function removeStudyFromChart(chartType, studyId, studyItem) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart && chart.removeStudy) {
      chart.removeStudy(studyId);
      studyItem.remove();
      
      // Check if no studies remain
      const activeStudiesContainer = studyItem.parentNode;
      if (activeStudiesContainer && activeStudiesContainer.children.length === 0) {
        activeStudiesContainer.innerHTML = '<div>No studies added</div>';
      }
      
      console.log(`Removed study: ${studyId}`);
    }
  } catch (error) {
    console.error('Error removing study:', error);
  }
}

// Update dataset dropdowns when datasets are added/removed
function updateStudyDatasetDropdowns() {
  updateStudyDatasetDropdown('line');
  updateStudyDatasetDropdown('bar');
}

function updateStudyDatasetDropdown(chartType) {
  const dropdown = document.getElementById(`${chartType}-study-dataset`);
  if (!dropdown) return;

  // Clear existing options
  dropdown.innerHTML = '';
  
  // Get datasets from chart
  const chart = chartType === 'line' ? lineChart : barChart;
  if (!chart || !chart.config || !chart.config.data) {
    dropdown.innerHTML = '<option value="">No datasets available</option>';
    return;
  }

  // Add options for each dataset
  chart.config.data.forEach((dataset, index) => {
    const option = document.createElement('option');
    option.value = dataset.id;
    option.textContent = dataset.name || `Dataset ${index + 1}`;
    dropdown.appendChild(option);
  });
  
  // Select first option by default
  if (dropdown.children.length > 0) {
    dropdown.selectedIndex = 0;
  }
}

// Initialize study accordion functionality
function initStudyAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const span = header.querySelector('span');
      
      if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'block';
        span.style.transform = 'rotate(45deg)';
      } else {
        content.style.display = 'none';
        span.style.transform = 'rotate(0deg)';
      }
    });
  });
  
  // Initialize accordion states (closed by default)
  accordionHeaders.forEach(header => {
    const content = header.nextElementSibling;
    content.style.display = 'none';
  });
}

// ========== MAIN INITIALIZATION ==========

// Initialize everything
async function initializeCharts() {
  try {
    await waitForDOMReady();
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    
    setupTabs();
    await initLineChart(); // Initialize line chart first (default tab)
    
    // Initialize study controls after charts are ready
    initStudyControls();
    
    console.log('Chart initialization complete with working recession toggles and studies');
    
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
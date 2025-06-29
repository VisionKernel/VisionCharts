// Import the VisionCharts library - Updated for new multi-renderer system
import { LineChart, BarChart, calculateIndicator, createChart } from '../../src/index.js';

// Global datasets storage
let availableDatasets = {};

// Chart instances
let lineChart = null;
let barChart = null;

// Event listener management - prevent duplicate listeners
const eventListenerState = {
  lineStatisticalListenersAttached: false,
  barStatisticalListenersAttached: false
};

// Define recession data for charts
const recessions = [
  { start: new Date('2007-12-01'), end: new Date('2009-06-30') },
  { start: new Date('2020-02-01'), end: new Date('2020-04-30') }
];

// Debug helper function - logs to console only
function log(message, obj = null) {
  // Only log to console, not to UI
  console.log(message, obj);
}

// Error handler helper function
function handleError(containerId, error) {
  const container = document.getElementById(containerId);
  if (container) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
    
    // Clear container and add error message
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
          {"x": 1396328400000, "y": 375814.71808},
          {"x": 1404190800000, "y": 372347.33206},
          {"x": 1412139600000, "y": 346274.20792},
          {"x": 1420092000000, "y": 320882.67004},
          {"x": 1427756400000, "y": 340662.67896},
          {"x": 1435708800000, "y": 335174.23472},
          {"x": 1443657600000, "y": 310456.78998},
          {"x": 1451610000000, "y": 285678.45321},
          {"x": 1459468800000, "y": 295234.89765},
          {"x": 1467331200000, "y": 312456.78901},
          {"x": 1475280000000, "y": 298765.43234}
        ];
      });
    
    // Load daily returns data
    datasets['daily-returns'] = await fetch('../examples/data/daily-returns.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading daily returns data:', error);
        return [];
      });
    
    // Load monthly data
    datasets.monthly = await fetch('../examples/data/timeseries-monthly.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading monthly data:', error);
        return [];
      });
    
  } catch (error) {
    console.error('Error loading datasets:', error);
  }
  
  return datasets;
}

// Helper function to create a dataset item in the dataset manager
function createDatasetItem(container, dataset, index, chartType) {
  // Create dataset item container
  const item = document.createElement('div');
  item.className = 'dataset-item';
  item.dataset.id = dataset.id;
  
  // Create name input
  const nameGroup = document.createElement('div');
  nameGroup.className = 'control-group';
  
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = dataset.name;
  nameInput.placeholder = 'Dataset Name';
  
  nameInput.addEventListener('change', (e) => {
    // Update dataset name in the chart
    if (chartType === 'line' && lineChart) {
      const datasets = lineChart.config.data;
      const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        datasets[datasetIndex].name = e.target.value;
        lineChart.update();
      }
    } else if (chartType === 'bar' && barChart) {
      const datasets = barChart.config.data;
      const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        datasets[datasetIndex].name = e.target.value;
        barChart.update();
      }
    }
  });
  
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  
  // Create color input
  const colorGroup = document.createElement('div');
  colorGroup.className = 'control-group';
  
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color';
  
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = dataset.color || '#1468a8';
  
  colorInput.addEventListener('change', (e) => {
    // Update dataset color in the chart
    if (chartType === 'line' && lineChart) {
      const datasets = lineChart.config.data;
      const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        datasets[datasetIndex].color = e.target.value;
        lineChart.update();
      }
    } else if (chartType === 'bar' && barChart) {
      const datasets = barChart.config.data;
      const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        datasets[datasetIndex].color = e.target.value;
        barChart.update();
      }
    }
  });
  
  colorGroup.appendChild(colorLabel);
  colorGroup.appendChild(colorInput);
  
  // Create width input for line charts
  if (chartType === 'line') {
    const widthGroup = document.createElement('div');
    widthGroup.className = 'control-group';
    
    const widthLabel = document.createElement('label');
    widthLabel.textContent = 'Width';
    
    const widthInput = document.createElement('input');
    widthInput.type = 'range';
    widthInput.min = '1';
    widthInput.max = '5';
    widthInput.step = '0.5';
    widthInput.value = dataset.width || '2';
    
    widthInput.addEventListener('change', (e) => {
      // Update dataset width in the chart
      if (lineChart) {
        const datasets = lineChart.config.data;
        const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
        if (datasetIndex >= 0) {
          datasets[datasetIndex].width = parseFloat(e.target.value);
          lineChart.update();
        }
      }
    });
    
    widthGroup.appendChild(widthLabel);
    widthGroup.appendChild(widthInput);
    
    item.appendChild(widthGroup);
    
    // Add area controls for line charts
    const areaControls = document.createElement('div');
    areaControls.className = 'area-controls';
    
    // Area checkbox
    const areaCheckbox = document.createElement('input');
    areaCheckbox.type = 'checkbox';
    areaCheckbox.id = `area-${dataset.id}`;
    areaCheckbox.checked = Boolean(dataset.area);
    
    const areaLabel = document.createElement('label');
    areaLabel.htmlFor = `area-${dataset.id}`;
    areaLabel.textContent = 'Area Fill';
    
    areaCheckbox.addEventListener('change', (e) => {
      if (lineChart) {
        lineChart.toggleDatasetArea(dataset.id, e.target.checked);
      }
    });
    
    // Area opacity slider
    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity:';
    opacityLabel.style.marginLeft = '15px';
    
    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '0';
    opacityInput.max = '1';
    opacityInput.step = '0.1';
    opacityInput.value = dataset.areaOpacity || '0.2';
    opacityInput.style.width = '80px';
    
    const opacityValue = document.createElement('span');
    opacityValue.className = 'opacity-value';
    opacityValue.textContent = opacityInput.value;
    
    opacityInput.addEventListener('input', (e) => {
      opacityValue.textContent = e.target.value;
      if (lineChart) {
        // Update the dataset in config.data directly
        const datasets = lineChart.config.data;
        const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
        if (datasetIndex >= 0) {
          datasets[datasetIndex].areaOpacity = parseFloat(e.target.value);
          // Only update if area is enabled
          if (datasets[datasetIndex].area) {
            lineChart.update();
          }
        }
      }
    });
    
    areaControls.appendChild(areaCheckbox);
    areaControls.appendChild(areaLabel);
    areaControls.appendChild(opacityLabel);
    areaControls.appendChild(opacityInput);
    areaControls.appendChild(opacityValue);
    
    item.appendChild(areaControls);
  }
  
  // Create actions
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'dataset-actions';
  
  const hideButton = document.createElement('button');
  hideButton.className = 'btn-sm';
  hideButton.textContent = 'Hide';
  hideButton.dataset.visible = 'true';
  
  hideButton.addEventListener('click', (e) => {
    const isVisible = e.target.dataset.visible === 'true';
    
    // Toggle visibility
    const newVisibility = !isVisible;
    e.target.dataset.visible = newVisibility ? 'true' : 'false';
    e.target.textContent = newVisibility ? 'Hide' : 'Show';
    
    if (chartType === 'line' && lineChart) {
      // For line chart, we'll just keep the data but not render it
      // This is a simplified approach - a real implementation would handle this better
      const datasetIndex = lineChart.config.data.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        // Store original data and use empty data for hiding
        if (newVisibility) {
          // Show dataset again with original data
          if (lineChart.config.data[datasetIndex]._originalData) {
            lineChart.config.data[datasetIndex].data = lineChart.config.data[datasetIndex]._originalData;
            delete lineChart.config.data[datasetIndex]._originalData;
          }
        } else {
          // Hide dataset by storing original data and setting empty data
          lineChart.config.data[datasetIndex]._originalData = lineChart.config.data[datasetIndex].data;
          lineChart.config.data[datasetIndex].data = [];
        }
        lineChart.update();
      }
    } else if (chartType === 'bar' && barChart) {
      // Similar approach for bar chart
      const datasetIndex = barChart.config.data.findIndex(d => d.id === dataset.id);
      if (datasetIndex >= 0) {
        if (newVisibility) {
          if (barChart.config.data[datasetIndex]._originalData) {
            barChart.config.data[datasetIndex].data = barChart.config.data[datasetIndex]._originalData;
            delete barChart.config.data[datasetIndex]._originalData;
          }
        } else {
          barChart.config.data[datasetIndex]._originalData = barChart.config.data[datasetIndex].data;
          barChart.config.data[datasetIndex].data = [];
        }
        barChart.update();
      }
    }
  });
  
  // Create remove button for additional datasets (don't allow removing the first one)
  if (index > 0) {
    const removeButton = document.createElement('button');
    removeButton.className = 'btn-sm';
    removeButton.textContent = 'Remove';
    removeButton.style.marginLeft = '5px';
    
    removeButton.addEventListener('click', () => {
      // Remove the dataset from the chart
      if (chartType === 'line' && lineChart) {
        const datasets = lineChart.config.data;
        const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
        if (datasetIndex >= 0) {
          datasets.splice(datasetIndex, 1);
          lineChart.update();
          // Also remove from UI
          container.removeChild(item);
          
          // Update study dataset options
          updateStudyDatasetOptions();
        }
      } else if (chartType === 'bar' && barChart) {
        const datasets = barChart.config.data;
        const datasetIndex = datasets.findIndex(d => d.id === dataset.id);
        if (datasetIndex >= 0) {
          datasets.splice(datasetIndex, 1);
          barChart.update();
          // Also remove from UI
          container.removeChild(item);
          
          // Update study dataset options
          updateStudyDatasetOptions();
        }
      }
    });
    
    actionsGroup.appendChild(removeButton);
  }
  
  actionsGroup.appendChild(hideButton);
  item.appendChild(nameGroup);
  item.appendChild(colorGroup);
  item.appendChild(actionsGroup);
  
  container.appendChild(item);
}

// Helper function to update dataset manager UI
function updateDatasetManager(chartType) {
  const container = document.getElementById(`${chartType}-datasets`);
  if (!container) return;
  
  // Clear existing dataset items
  container.innerHTML = '';
  
  // Get current chart instance
  const chart = chartType === 'line' ? lineChart : barChart;
  if (!chart || !chart.config.data) return;
  
  // Add dataset items
  chart.config.data.forEach((dataset, index) => {
    createDatasetItem(container, dataset, index, chartType);
  });
}

// Helper function to create randomized dataset (for testing multiple datasets)
function createRandomizedDataset(sourceDataset, index) {
  // Create a new array to avoid modifying original data
  const newData = sourceDataset.data.map(point => {
    // Clone the point to avoid modifying original
    const newPoint = {...point};
    
    // Add random variation (±10% of original value)
    const randomFactor = 0.9 + Math.random() * 0.2; // Between 0.9 and 1.1
    
    // Handle different data formats
    if (point.price !== undefined) {
      newPoint.price = point.price * randomFactor;
    }
    if (point.y !== undefined) {
      newPoint.y = point.y * randomFactor;
    }
    
    return newPoint;
  });
  
  // Define colors for datasets
  const colors = [
    '#1468a8', // Blue - already used by first dataset
    '#34A853', // Green
    '#FBBC05', // Yellow
    '#EA4335', // Red
    '#9C27B0', // Purple
    '#00ACC1', // Cyan
    '#FF9800', // Orange
    '#607D8B'  // Blue Grey
  ];
  
  // Return the new dataset
  return {
    id: `dataset-${index + 1}`,
    name: `Dataset ${index + 1}`,
    color: colors[index % colors.length],
    width: 2,
    area: false, // Default to no area for new datasets
    areaOpacity: 0.2, // Default opacity
    data: newData
  };
}

// Helper function to format datasets for preview
function formatDatasetPreview(data, maxItems = 3) {
  if (!data || !data.length) return 'No data available';
  
  const preview = data.slice(0, maxItems).map(item => {
    const date = new Date(item.x).toLocaleDateString();
    const value = typeof item.y === 'number' ? item.y.toLocaleString() : item.y;
    return `${date}: ${value}`;
  }).join('\n');
  
  return preview + (data.length > maxItems ? `\n... and ${data.length - maxItems} more items` : '');
}

// Setup dataset selector functionality
function setupDatasetSelector(chartType) {
  const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
  const randomizeCheckbox = document.getElementById(`${chartType}-randomize`);
  const previewDiv = document.getElementById(`${chartType}-dataset-preview`);
  
  if (!sourceSelect || !previewDiv) return;
  
  // Update preview when source changes
  sourceSelect.addEventListener('change', () => {
    const selectedDataset = availableDatasets[sourceSelect.value];
    previewDiv.textContent = formatDatasetPreview(selectedDataset);
  });
  
  // Initialize preview
  const initialDataset = availableDatasets[sourceSelect.value];
  previewDiv.textContent = formatDatasetPreview(initialDataset);
}

// Initialize Line Chart - Updated for multi-renderer support
async function initLineChart() {
  log('Initializing Line Chart with Multi-Renderer Support');
  
  try {
    // Load all datasets
    availableDatasets = await loadAllDatasets();
    
    // Use timeseries data for initial chart
    const timeSeriesData = availableDatasets.timeseries;
    
    // Format data for the line chart
    const formattedData = timeSeriesData.map(item => ({
      date: new Date(item.x),
      price: item.y
    }));
    
    // Create a single dataset with area ENABLED by default for testing
    const data = [
      {
        id: 'dataset-1',
        name: 'Time Series Data',
        color: '#1468a8', 
        width: 2,
        area: true, // Area ENABLED by default for testing
        areaOpacity: 0.3, // Increased opacity for visibility
        data: formattedData
      }
    ];
    
    // Get initial values from inputs
    const xAxisName = document.getElementById('line-x-name').value;
    const yAxisName = document.getElementById('line-y-name').value;
    
    // Create the line chart with enhanced multi-renderer configuration
    lineChart = new LineChart({
      container: document.getElementById('line-chart'),
      data: data,
      options: {
        title: 'Time Series Data',
        xField: 'date',
        yField: 'price',
        xType: 'time',
        yType: 'number',
        xAxisName: xAxisName,
        yAxisName: yAxisName,
        curve: 'monotone',
        showPoints: false,
        area: false,
        showZeroLine: false,
        showLegend: true,
        gradient: false,
        recessions: recessions,
        grid: {
          show: true
        },
        studies: [], // Initialize empty studies array
        
        // Multi-renderer configuration
        enableAutoSwitching: true,
        enablePerformanceMonitoring: true,
        preferredRenderer: 'auto', // Let the system choose optimal renderer
        
        // Performance thresholds
        canvasThreshold: 10000,    // Switch to Canvas at 10K points
        webglThreshold: 100000,    // Switch to WebGL at 100K points
        svgFallbackThreshold: 1000, // Use SVG for small datasets
        
        // Event system options
        enableUnifiedEventSystem: true,
        enableTouchEvents: true,
        enablePointerEvents: true,
        
        // Statistical lines support
        showAverageLine: false,
        showMedianLine: false,
        averageLineConfig: {
          color: '#FF6B35',
          width: 2,
          opacity: 0.8,
          strokeDasharray: '5,5',
          showLabel: true,
          labelPosition: 'right'
        },
        medianLineConfig: {
          color: '#9C27B0',
          width: 2,
          opacity: 0.8,
          strokeDasharray: '8,4',
          showLabel: true,
          labelPosition: 'right',
          includeQuartiles: true
        }
      }
    });
    
    // Store reference for debugging
    window.debugLineChart = lineChart;
    
    // Render the chart
    await lineChart.render();
    
    log('Line chart with multi-renderer support rendered successfully');
    log('Active renderer:', lineChart.renderer?.constructor.name || 'Unknown');
    
    // Update dataset manager UI
    updateDatasetManager('line');
    
    // Setup event listeners for controls
    setupLineChartControls();
    
    // Setup dataset selector
    setupDatasetSelector('line');
    
  } catch (error) {
    log('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

// Initialize Bar Chart - Updated for multi-renderer support
async function initBarChart() {
  log('Initializing Bar Chart with Multi-Renderer Support');
  try {
    // Load all datasets if not already loaded
    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }
    
    const timeSeriesData = availableDatasets.timeseries;
    
    // Transform data: 'x' should be Date objects for xType: 'time'
    const transformedData = timeSeriesData.map(item => ({
      x: new Date(item.x), // Ensure 'x' is a Date object
      y: item.y
    }));
    
    const data = [
      {
        id: 'dataset-1',
        name: 'Time Series Data',
        color: '#1468a8',
        data: transformedData
      }
    ];
    
    const xAxisName = document.getElementById('bar-x-name').value;
    const yAxisName = document.getElementById('bar-y-name').value;
    
    // Create bar chart with enhanced multi-renderer configuration
    barChart = new BarChart({
      container: document.getElementById('bar-chart'),
      data: data,
      options: {
        title: 'Bar Chart with Multi-Renderer Support',
        xField: 'x',
        yField: 'y',
        xType: 'time',
        yType: 'number',
        xAxisName: xAxisName,
        yAxisName: yAxisName,
        showValues: false,
        showZeroLine: true,
        showLegend: true,
        isLogarithmic: false,
        recessions: recessions,
        dateFormat: { year: 'numeric', month: 'short', day: 'numeric' },
        grid: {
          show: true
        },
        studiesAsLines: true,
        studyLineWidth: 2,
        studyPointRadius: 0,
        studies: [],
        
        // Multi-renderer configuration
        enableAutoSwitching: true,
        enablePerformanceMonitoring: true,
        preferredRenderer: 'auto',
        
        // Performance thresholds
        canvasThreshold: 5000,     // Bars benefit from Canvas earlier
        webglThreshold: 50000,     // WebGL for very large datasets
        svgFallbackThreshold: 500, // SVG for small bar charts
        
        // Event system options
        enableUnifiedEventSystem: true,
        enableTouchEvents: true,
        enablePointerEvents: true,
        
        // Statistical lines support
        showAverageLine: false,
        showMedianLine: false,
        averageLineConfig: {
          color: '#FF6B35',
          width: 2,
          opacity: 0.8,
          strokeDasharray: '5,5',
          showLabel: true,
          labelPosition: 'right'
        },
        medianLineConfig: {
          color: '#9C27B0',
          width: 2,
          opacity: 0.8,
          strokeDasharray: '8,4',
          showLabel: true,
          labelPosition: 'right',
          includeQuartiles: true
        }
      }
    });
    
    await barChart.render();
    log('Bar chart with multi-renderer support rendered successfully');
    log('Active renderer:', barChart.renderer?.constructor.name || 'Unknown');
    
    updateDatasetManager('bar');
    setupBarChartControls();
    setupDatasetSelector('bar');
  } catch (error) {
    log('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// Line Chart Controls - Updated for multi-renderer compatibility
function setupLineChartControls() {
  if (!lineChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('line-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      if (lineChart.setXAxisName) {
        lineChart.setXAxisName(e.target.value);
      } else {
        // Fallback for new system
        lineChart.options.xAxisName = e.target.value;
        lineChart.update();
      }
    });
  }
  
  // Y axis name
  const yNameInput = document.getElementById('line-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      if (lineChart.setYAxisName) {
        lineChart.setYAxisName(e.target.value);
      } else {
        // Fallback for new system
        lineChart.options.yAxisName = e.target.value;
        lineChart.update();
      }
    });
  }
  
  // Toggle logarithmic scale
  const logToggle = document.getElementById('line-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isLogarithmic = e.target.classList.contains('active');
      if (lineChart.toggleLogarithmic) {
        lineChart.toggleLogarithmic(isLogarithmic);
      } else {
        // Fallback for new system
        lineChart.options.isLogarithmic = isLogarithmic;
        lineChart.update();
      }
    });
  }
  
  // Toggle zero line
  const zeroToggle = document.getElementById('line-toggle-zero');
  if (zeroToggle) {
    zeroToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showZeroLine = e.target.classList.contains('active');
      if (lineChart.toggleZeroLine) {
        lineChart.toggleZeroLine(showZeroLine);
      } else {
        // Fallback for new system
        lineChart.options.showZeroLine = showZeroLine;
        lineChart.update();
      }
    });
  }
  
  // Toggle recession lines
  const recessionToggle = document.getElementById('line-toggle-recession');
  if (recessionToggle) {
    recessionToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showRecessionLines = e.target.classList.contains('active');
      if (lineChart.toggleRecessionLines) {
        lineChart.toggleRecessionLines(showRecessionLines);
      } else {
        // Fallback for new system
        lineChart.options.showRecessionLines = showRecessionLines;
        lineChart.update();
      }
    });
  }
  
  // Toggle panel view
  const panelToggle = document.getElementById('line-toggle-panel');
  if (panelToggle) {
    panelToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isPanelView = e.target.classList.contains('active');
      console.log('Line panel view toggle clicked:', isPanelView);
      if (lineChart.togglePanelView) {
        lineChart.togglePanelView(isPanelView);
      } else {
        // Fallback for new system
        lineChart.options.isPanelView = isPanelView;
        lineChart.update();
      }
    });
  }
  
  // Toggle legend - Updated for multi-renderer support
  const legendToggle = document.getElementById('line-toggle-legend');
  if (legendToggle) {
    legendToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showLegend = e.target.classList.contains('active');
      
      // Updated for multi-renderer system
      lineChart.options.showLegend = showLegend;
      lineChart.update();
    });
  }
  
  // Curve type
  const curveSelect = document.getElementById('line-curve');
  if (curveSelect) {
    curveSelect.addEventListener('change', (e) => {
      if (!lineChart) return;
      
      // Update the curve option
      lineChart.options.curve = e.target.value;
      
      // Update the chart
      lineChart.update();
    });
  }
  
  // Add dataset button
  const addDatasetBtn = document.getElementById('line-add-dataset');
  if (addDatasetBtn) {
    addDatasetBtn.addEventListener('click', () => {
      if (!lineChart) return;
      
      const sourceSelect = document.getElementById('line-dataset-source');
      const randomizeCheckbox = document.getElementById('line-randomize');
      
      const selectedDatasetKey = sourceSelect.value;
      const selectedDataset = availableDatasets[selectedDatasetKey];
      const applyRandomization = randomizeCheckbox.checked;
      
      if (!selectedDataset) return;
      
      // Transform data for line chart
      const transformedData = selectedDataset.map(item => ({
        date: new Date(item.x),
        price: item.y
      }));
      
      // Create new dataset
      const newDataset = createRandomizedDataset({data: transformedData}, lineChart.config.data.length);
      
      // Override randomization if not wanted
      if (!applyRandomization) {
        newDataset.data = transformedData;
      }
      
      // Set appropriate name based on source
      const sourceNames = {
        'timeseries': 'Time Series',
        'daily-returns': 'Daily Returns',
        'monthly': 'Monthly Data'
      };
      newDataset.name = `${sourceNames[selectedDatasetKey]} ${lineChart.config.data.length + 1}`;
      
      // Add to chart
      lineChart.config.data.push(newDataset);
      lineChart.update();
      
      // Update UI
      updateDatasetManager('line');
      updateStudyDatasetOptions();
    });
  }

  const endingLabelsToggle = document.getElementById('line-toggle-endinglabels');
  if (endingLabelsToggle) {
    endingLabelsToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showEndingLabels = e.target.classList.contains('active');
      console.log('Line ending labels toggle clicked:', showEndingLabels);
      if (lineChart.toggleEndingLabels) {
        lineChart.toggleEndingLabels(showEndingLabels);
      } else {
        // Fallback for new system
        lineChart.options.showEndingLabels = showEndingLabels;
        lineChart.update();
      }
    });
  }
  
  // Setup statistical controls
  setupLineStatisticalControls();
}

// Bar Chart Controls - Updated for multi-renderer compatibility
function setupBarChartControls() {
  if (!barChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('bar-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      if (barChart.setXAxisName) {
        barChart.setXAxisName(e.target.value);
      } else {
        barChart.options.xAxisName = e.target.value;
        barChart.update();
      }
    });
  }
  
  // Y axis name
  const yNameInput = document.getElementById('bar-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      if (barChart.setYAxisName) {
        barChart.setYAxisName(e.target.value);
      } else {
        barChart.options.yAxisName = e.target.value;
        barChart.update();
      }
    });
  }
  
  // Toggle logarithmic scale
  const logToggle = document.getElementById('bar-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isLogarithmic = e.target.classList.contains('active');
      if (barChart.toggleLogarithmic) {
        barChart.toggleLogarithmic(isLogarithmic);
      } else {
        barChart.options.isLogarithmic = isLogarithmic;
        barChart.update();
      }
    });
  }
  
  // Toggle zero line
  const zeroToggle = document.getElementById('bar-toggle-zero');
  if (zeroToggle) {
    zeroToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showZeroLine = e.target.classList.contains('active');
      if (barChart.toggleZeroLine) {
        barChart.toggleZeroLine(showZeroLine);
      } else {
        barChart.options.showZeroLine = showZeroLine;
        barChart.update();
      }
    });
  }
  
  // Toggle recession lines
  const recessionToggle = document.getElementById('bar-toggle-recession');
  if (recessionToggle) {
    recessionToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showRecessionLines = e.target.classList.contains('active');
      if (barChart.toggleRecessionLines) {
        barChart.toggleRecessionLines(showRecessionLines);
      } else {
        barChart.options.showRecessionLines = showRecessionLines;
        barChart.update();
      }
    });
  }
  
  // Toggle panel view
  const barPanelToggle = document.getElementById('bar-toggle-panel');
  if (barPanelToggle) {
    barPanelToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isPanelView = e.target.classList.contains('active');
      console.log('Bar panel view toggle clicked:', isPanelView);
      if (barChart.togglePanelView) {
        barChart.togglePanelView(isPanelView);
      } else {
        barChart.options.isPanelView = isPanelView;
        barChart.update();
      }
    });
  }
  
  // Toggle legend
  const legendToggle = document.getElementById('bar-toggle-legend');
  if (legendToggle) {
    legendToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showLegend = e.target.classList.contains('active');
      
      // Updated for multi-renderer system
      barChart.options.showLegend = showLegend;
      barChart.update();
    });
  }
  
  // Bar width control
  const barWidthInput = document.getElementById('bar-width');
  if (barWidthInput) {
    barWidthInput.addEventListener('input', (e) => {
      if (!barChart) return;
      
      // Update bar width option
      barChart.options.barWidth = parseFloat(e.target.value);
      
      // Update the chart
      barChart.update();
    });
  }

  const barEndingLabelsToggle = document.getElementById('bar-toggle-endinglabels');
  if (barEndingLabelsToggle) {
    barEndingLabelsToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showEndingLabels = e.target.classList.contains('active');
      console.log('Bar chart ending labels toggle clicked:', showEndingLabels);
      if (barChart.toggleEndingLabels) {
        barChart.toggleEndingLabels(showEndingLabels);
      } else {
        barChart.options.showEndingLabels = showEndingLabels;
        barChart.update();
      }
    });
  }
  
  // Add dataset button
  const addDatasetBtn = document.getElementById('bar-add-dataset');
  if (addDatasetBtn) {
    addDatasetBtn.addEventListener('click', () => {
      if (!barChart) return;
      
      const sourceSelect = document.getElementById('bar-dataset-source');
      const randomizeCheckbox = document.getElementById('bar-randomize');
      
      const selectedDatasetKey = sourceSelect.value;
      const selectedDataset = availableDatasets[selectedDatasetKey];
      const applyRandomization = randomizeCheckbox.checked;
      
      if (!selectedDataset) return;
      
      // Transform data for bar chart
      const transformedData = selectedDataset.map(item => ({
        x: new Date(item.x),
        y: item.y
      }));
      
      // Create new dataset
      const newDataset = createRandomizedDataset({data: transformedData}, barChart.config.data.length);
      
      // Override randomization if not wanted
      if (!applyRandomization) {
        newDataset.data = transformedData;
      }
      
      // Set appropriate name based on source
      const sourceNames = {
        'timeseries': 'Time Series',
        'daily-returns': 'Daily Returns',
        'monthly': 'Monthly Data'
      };
      newDataset.name = `${sourceNames[selectedDatasetKey]} ${barChart.config.data.length + 1}`;
      
      // Add to chart
      barChart.config.data.push(newDataset);
      barChart.update();
      
      // Update UI
      updateDatasetManager('bar');
      updateStudyDatasetOptions();
    });
  }
  
  // Setup statistical controls
  setupBarStatisticalControls();
}

// Statistical Controls for Line Chart - Updated for new AverageLine/MedianLine components
function setupLineStatisticalControls() {
  if (!lineChart || eventListenerState.lineStatisticalListenersAttached) {
    console.log('Line statistical controls already attached or chart not ready');
    return;
  }
  
  console.log('Setting up line statistical controls with updated components');
  
  // Toggle average line - Updated for new AverageLine component
  const avgToggle = document.getElementById('line-toggle-avg');
  if (avgToggle) {
    avgToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showAverage = e.target.classList.contains('active');
      console.log('Line average toggle clicked:', showAverage);
      
      // Updated for new multi-renderer AverageLine component
      lineChart.options.showAverageLine = showAverage;
      lineChart.update();
    });
  }
  
  // Toggle median line - Updated for new MedianLine component
  const medianToggle = document.getElementById('line-toggle-median');
  if (medianToggle) {
    medianToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showMedian = e.target.classList.contains('active');
      console.log('Line median toggle clicked:', showMedian);
      
      // Updated for new multi-renderer MedianLine component
      lineChart.options.showMedianLine = showMedian;
      lineChart.update();
    });
  }
  
  eventListenerState.lineStatisticalListenersAttached = true;
}

// Statistical Controls for Bar Chart - Updated for new AverageLine/MedianLine components
function setupBarStatisticalControls() {
  if (!barChart || eventListenerState.barStatisticalListenersAttached) {
    console.log('Bar statistical controls already attached or chart not ready');
    return;
  }
  
  console.log('Setting up bar statistical controls with updated components');
  
  // Toggle average line
  const avgToggle = document.getElementById('bar-toggle-avg');
  if (avgToggle) {
    avgToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showAverage = e.target.classList.contains('active');
      console.log('Bar average toggle clicked:', showAverage);
      
      // Updated for new multi-renderer AverageLine component
      barChart.options.showAverageLine = showAverage;
      barChart.update();
    });
  }
  
  // Toggle median line
  const medianToggle = document.getElementById('bar-toggle-median');
  if (medianToggle) {
    medianToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showMedian = e.target.classList.contains('active');
      console.log('Bar median toggle clicked:', showMedian);
      
      // Updated for new multi-renderer MedianLine component
      barChart.options.showMedianLine = showMedian;
      barChart.update();
    });
  }
  
  eventListenerState.barStatisticalListenersAttached = true;
}

// =============================================================================
// STUDIES/TECHNICAL INDICATORS IMPLEMENTATION
// =============================================================================

/**
 * Set up studies functionality for both line and bar charts
 */
function setupStudies() {
  console.log('Setting up studies functionality');
  
  // Set up for line chart
  setupStudiesForChart('line', lineChart);
  
  // Set up for bar chart 
  setupStudiesForChart('bar', barChart);
}

/**
 * Set up studies for a specific chart type
 * @param {string} chartType - 'line' or 'bar'
 * @param {Chart} chart - Chart instance
 */
function setupStudiesForChart(chartType, chart) {
  if (!chart) {
    console.log(`${chartType} chart not ready for studies setup`);
    return;
  }
  
  const addStudyBtn = document.getElementById(`${chartType}-add-study`);
  
  if (!addStudyBtn) {
    console.warn(`Add study button not found for ${chartType} chart`);
    return;
  }
  
  // Remove existing event listeners to prevent duplicates
  const newButton = addStudyBtn.cloneNode(true);
  addStudyBtn.parentNode.replaceChild(newButton, addStudyBtn);
  
  // Add new event listener
  newButton.addEventListener('click', () => {
    const studyTypeSelect = document.getElementById(`${chartType}-study-type`);
    const studyDatasetSelect = document.getElementById(`${chartType}-study-dataset`);
    const studyPeriodInput = document.getElementById(`${chartType}-study-period`);
    const studyColorInput = document.getElementById(`${chartType}-study-color`);
    
    if (!studyTypeSelect || !studyDatasetSelect || !studyPeriodInput) {
      console.error('Study form elements not found');
      return;
    }
    
    try {
      const studyType = studyTypeSelect.value;
      const datasetId = studyDatasetSelect.value;
      const period = parseInt(studyPeriodInput.value, 10);
      const color = studyColorInput.value;
      
      if (!studyType || !datasetId || period <= 0) {
        alert('Please fill in all study parameters');
        return;
      }
      
      // Create study configuration
      const studyConfig = {
        id: `${studyType}-${datasetId}-${Date.now()}`,
        type: studyType,
        name: getStudyDisplayName(studyType, { period }),
        period: period,
        color: color,
        width: (chart.options && chart.options.studyLineWidth) ? 
               (chart.options.studyLineWidth || 2) : 2,
        datasetId: datasetId
      };
      
      console.log('Adding study:', studyConfig);
      
      // Add study to chart
      if (chart.addStudy) {
        chart.addStudy(datasetId, studyConfig);
      } else {
        console.warn('Chart does not support addStudy method');
      }
      
      // Update active studies UI
      updateActiveStudiesUI(chartType, chart);
      
      // Reset form
      studyPeriodInput.value = '14';
      studyColorInput.value = '#FBBC05';
      
    } catch (error) {
      console.error('Error adding study:', error);
      alert('Error adding study: ' + error.message);
    }
  });
  
  // Initial setup of active studies UI
  updateActiveStudiesUI(chartType, chart);
}

/**
 * Get display name for study
 * @param {string} type - Study type
 * @param {Object} params - Study parameters
 * @returns {string} Display name
 */
function getStudyDisplayName(type, params) {
  switch (type) {
    case 'sma':
      return `SMA(${params.period})`;
    case 'ema':
      return `EMA(${params.period})`;
    case 'rsi':
      return `RSI(${params.period})`;
    case 'macd':
      return `MACD(${params.fastPeriod || 12},${params.slowPeriod || 26},${params.signalPeriod || 9})`;
    case 'bollinger':
      return `Bollinger(${params.period},${params.deviations || 2})`;
    default:
      return type.toUpperCase();
  }
}

/**
 * Update the active studies UI display
 * @param {string} chartType - 'line' or 'bar'
 * @param {Chart} chart - Chart instance
 */
function updateActiveStudiesUI(chartType, chart) {
  const activeStudiesContainer = document.querySelector(`#${chartType}-section .accordion-content > div:last-child`);
  
  if (!activeStudiesContainer) return;
  
  // Get active studies from chart options
  const studies = (chart.options && chart.options.studies) ? chart.options.studies : [];
  
  if (studies.length === 0) {
    activeStudiesContainer.innerHTML = '<strong>Active Studies:</strong><div>No studies added</div>';
    return;
  }
  
  // Create studies list
  let studiesHTML = '<strong>Active Studies:</strong>';
  studies.forEach(study => {
    studiesHTML += `
      <div class="study-item" style="display: flex; align-items: center; gap: 10px; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 4px;">
        <span style="color: ${study.color}; font-weight: bold;">●</span>
        <span>${study.name}</span>
        <button class="btn-sm remove-study" data-chart="${chartType}" data-study-id="${study.id}" data-dataset-id="${study.datasetId}" style="margin-left: auto; background: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">Remove</button>
      </div>
    `;
  });
  
  activeStudiesContainer.innerHTML = studiesHTML;
  
  // Add event listeners for remove buttons
  activeStudiesContainer.querySelectorAll('.remove-study').forEach(button => {
    button.addEventListener('click', (e) => {
      const studyId = e.target.dataset.studyId;
      const datasetId = e.target.dataset.datasetId;
      const chartType = e.target.dataset.chart;
      const chart = chartType === 'line' ? lineChart : barChart;
      
      if (chart && chart.removeStudy) {
        chart.removeStudy(datasetId, studyId);
        updateActiveStudiesUI(chartType, chart);
      }
    });
  });
}

/**
 * Update dataset options in study selectors when datasets change
 */
function updateStudyDatasetOptions() {
  // Update line chart study dataset options
  if (lineChart) {
    const lineSelect = document.getElementById('line-study-dataset');
    if (lineSelect) {
      lineSelect.innerHTML = '';
      lineChart.config.data.forEach(dataset => {
        const option = document.createElement('option');
        option.value = dataset.id;
        option.textContent = dataset.name;
        lineSelect.appendChild(option);
      });
    }
  }
  
  // Update bar chart study dataset options
  if (barChart) {
    const barSelect = document.getElementById('bar-study-dataset');
    if (barSelect) {
      barSelect.innerHTML = '';
      barChart.config.data.forEach(dataset => {
        const option = document.createElement('option');
        option.value = dataset.id;
        option.textContent = dataset.name;
        barSelect.appendChild(option);
      });
    }
  }
}

// =============================================================================
// TAB AND UI MANAGEMENT
// =============================================================================

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
            initLineChart().then(() => {
              setupStudies();
              updateStudyDatasetOptions();
            });
          } else if (tabName === 'bar' && !barChart) {
            initBarChart().then(() => {
              setupStudies();
              updateStudyDatasetOptions();
            });
          }
        } else {
          section.style.display = 'none';
        }
      });
    });
  });
}

// Handle accordion toggling
function setupAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  
  accordionHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      const isActive = content.classList.contains('active');
      
      // Toggle active class
      if (isActive) {
        content.classList.remove('active');
        this.querySelector('span').textContent = '+';
      } else {
        content.classList.add('active');
        this.querySelector('span').textContent = '-';
      }
    });
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  log('DOM fully loaded - Initializing VisionCharts Multi-Renderer Demo');
  
  // Set up tab switching
  setupTabs();
  
  // Set up accordions
  setupAccordions();
  
  // Initialize line chart by default (since it's the active tab)
  initLineChart().then(() => {
    // Set up studies after line chart is initialized
    setupStudies();
    updateStudyDatasetOptions();
    
    log('Multi-renderer initialization complete');
    log('Line chart renderer:', lineChart?.renderer?.constructor.name || 'Not available');
  }).catch(error => {
    console.error('Failed to initialize line chart:', error);
  });
  
  log('Setup complete - Ready for multi-renderer charting');
});
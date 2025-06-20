// Import the VisionCharts library
import { LineChart, BarChart, calculateIndicator } from '../../src/index.js';

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

// Function to load time series data
async function loadTimeSeriesData() {
  try {
    // In a real application, this would be an API call or fetch
    return fetch('../examples/data/timeseries.json')
      .then(response => response.json())
      .catch(error => {
        console.error('Error loading time series data:', error);
        // Fall back to embedded data if fetch fails
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
          {"x": 1475280000000, "y": 298765.43210},
          {"x": 1483232400000, "y": 276543.21098},
          {"x": 1491004800000, "y": 289876.54321},
          {"x": 1498867200000, "y": 267890.12345},
          {"x": 1506816000000, "y": 245678.90123},
          {"x": 1514768400000, "y": 234567.89012}
        ];
      });
  } catch (error) {
    console.error('Error in loadTimeSeriesData:', error);
    return [];
  }
}

// Helper function to format dates for the bar chart
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short'
  }).format(date);
}

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
  
  // Put it all together
  item.appendChild(nameGroup);
  item.appendChild(colorGroup);
  item.appendChild(actionsGroup);
  
  // Add to container
  container.appendChild(item);
}

// Function to update dataset manager UI based on chart data
function updateDatasetManager(chartType) {
  // Get the target chart and container
  let chart, container;
  
  if (chartType === 'line') {
    chart = lineChart;
    container = document.getElementById('line-datasets');
  } else if (chartType === 'bar') {
    chart = barChart;
    container = document.getElementById('bar-datasets');
  }
  
  if (!chart || !container) return;
  
  // Clear existing items
  container.innerHTML = '';
  
  // Add items for each dataset
  chart.config.data.forEach((dataset, index) => {
    createDatasetItem(container, dataset, index, chartType);
  });
  
  // Update study dataset select option
  const studyDatasetSelect = document.getElementById(`${chartType}-study-dataset`);
  if (studyDatasetSelect) {
    studyDatasetSelect.innerHTML = '';
    chart.config.data.forEach(dataset => {
      const option = document.createElement('option');
      option.value = dataset.id;
      option.textContent = dataset.name;
      studyDatasetSelect.appendChild(option);
    });
  }
}

// Function to generate a randomized dataset based on a source dataset
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
 * Set up studies for a specific chart
 * @param {string} chartType - 'line' or 'bar'
 * @param {Chart} chart - Chart instance
 */
function setupStudiesForChart(chartType, chart) {
  if (!chart) return;
  
  const addButton = document.querySelector(`#${chartType}-section .accordion-content .control-row .control-group:last-child button`);
  const studyTypeSelect = document.getElementById(`${chartType}-study-type`);
  const studyPeriodInput = document.getElementById(`${chartType}-study-period`);
  const studyDatasetSelect = document.getElementById(`${chartType}-study-dataset`);
  const studyColorInput = document.getElementById(`${chartType}-study-color`);
  const activeStudiesContainer = document.querySelector(`#${chartType}-section .accordion-content > div:last-child`);
  
  if (!addButton) {
    console.warn(`Add study button not found for ${chartType} chart`);
    return;
  }
  
  if (!studyTypeSelect || !studyPeriodInput || !studyDatasetSelect || !studyColorInput) {
    console.warn(`Some study form elements not found for ${chartType} chart`);
    return;
  }
  
  // Add event listener for "Add Study" button
  addButton.addEventListener('click', () => {
    try {
      const studyType = studyTypeSelect.value;
      const period = parseInt(studyPeriodInput.value, 10);
      const datasetId = studyDatasetSelect.value;
      const color = studyColorInput.value;
      
      // Validation
      if (!studyType) {
        alert('Please select a study type');
        return;
      }
      
      if (!period || period < 1 || period > 200) {
        alert('Please enter a valid period (1-200)');
        return;
      }
      
      if (!datasetId) {
        alert('Please select a dataset to apply the study to');
        return;
      }
      
      // Create study parameters based on data structure
      let studyParams = {
        period: period
      };
      
      // Determine field names based on chart type and data structure
      const targetDataset = chart.config.data.find(d => d.id === datasetId);
      if (targetDataset && targetDataset.data && targetDataset.data.length > 0) {
        const samplePoint = targetDataset.data[0];
        
        // For line charts, use 'date' and 'price' if available, otherwise 'x' and 'y'
        if (chartType === 'line') {
          studyParams.xField = samplePoint.date ? 'date' : 'x';
          studyParams.yField = samplePoint.price ? 'price' : 'y';
        } else {
          // For bar charts, always use 'x' and 'y' as defined in the chart options
          studyParams.xField = chart.options.xField || 'x';
          studyParams.yField = chart.options.yField || 'y';
        }
      } else {
        // Fallback defaults
        studyParams.xField = 'x';
        studyParams.yField = 'y';
      }
      
      // Add additional parameters for specific study types
      if (studyType === 'macd') {
        studyParams.fastPeriod = 12;
        studyParams.slowPeriod = 26;
        studyParams.signalPeriod = 9;
      } else if (studyType === 'bollinger') {
        studyParams.deviations = 2;
      }
      
      // Create study configuration
      const studyConfig = {
        id: `study-${studyType}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: studyType,
        name: getStudyDisplayName(studyType, studyParams),
        params: studyParams,
        color: color,
        width: chartType === 'bar' ? (chart.options.studyLineWidth || 2) : 2,
        datasetId: datasetId
      };
      
      console.log('Adding study:', studyConfig);
      
      // Add study to chart
      chart.addStudy(datasetId, studyConfig);
      
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
  const studies = chart.options.studies || [];
  
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
      
      if (chart) {
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

// Initialize Line Chart
async function initLineChart() {
  log('Initializing Line Chart');
  
  try {
    // Load the time series data
    const timeSeriesData = await loadTimeSeriesData();
    
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
    
    // Create the line chart
    lineChart = new LineChart({
      container: '#line-chart',
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
        showPoints: false, // Ensuring points are off as per previous request
        area: false,
        showZeroLine: false,
        showLegend: true, // Enable legend by default
        gradient: false, // Gradient disabled by default
        recessions: recessions,
        grid: { // Added to enable and configure the grid
          show: true
          // You can override other grid defaults here if needed, e.g.:
          // color: '#d3d3d3',
          // dashArray: '5,5'
        },
        studies: [] // Initialize empty studies array
      }
    });
    
    window.debugLineChart = lineChart;
    
    // Render the chart (this will also render the legend)
    lineChart.render();
    
    log('Line chart rendered successfully');
    
    // Update dataset manager UI
    updateDatasetManager('line');
    
    // Setup event listeners for controls
    setupLineChartControls();
  } catch (error) {
    log('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

// Add event listeners for Line Chart Controls
function setupLineChartControls() {
  if (!lineChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('line-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      lineChart.setXAxisName(e.target.value);
    });
  }
  
  // Y axis name
  const yNameInput = document.getElementById('line-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      lineChart.setYAxisName(e.target.value);
    });
  }
  
  // Toggle logarithmic scale
  const logToggle = document.getElementById('line-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isLogarithmic = e.target.classList.contains('active');
      lineChart.toggleLogarithmic(isLogarithmic);
    });
  }
  
  // Toggle zero line
  const zeroToggle = document.getElementById('line-toggle-zero');
  if (zeroToggle) {
    zeroToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showZeroLine = e.target.classList.contains('active');
      lineChart.toggleZeroLine(showZeroLine);
    });
  }
  
  // Toggle recession lines
  const recessionToggle = document.getElementById('line-toggle-recession');
  if (recessionToggle) {
    recessionToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showRecessionLines = e.target.classList.contains('active');
      lineChart.toggleRecessionLines(showRecessionLines);
    });
  }
  
  // Toggle panel view
  const panelToggle = document.getElementById('line-toggle-panel');
  if (panelToggle) {
    panelToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isPanelView = e.target.classList.contains('active');
      console.log('Line panel view toggle clicked:', isPanelView);
      lineChart.togglePanelView(isPanelView);
    });
  }
  
  // Toggle legend
  const legendToggle = document.getElementById('line-toggle-legend');
  if (legendToggle) {
    legendToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showLegend = e.target.classList.contains('active');
      
      // Find and toggle the legend element directly
      if (lineChart && lineChart.state.svg) {
        const legend = lineChart.state.svg.querySelector('.visioncharts-legend');
        if (legend) {
          // If legend exists, toggle its visibility
          legend.style.display = showLegend ? 'block' : 'none';
        } else if (showLegend) {
          // If legend doesn't exist but we want to show it, re-render the chart
          // This ensures the legend will be properly created and positioned
          lineChart.options.showLegend = true;
          lineChart.render();
        }
      }
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
      if (!lineChart || !lineChart.config.data.length) return;
      
      // Get the source dataset (the first one)
      const sourceDataset = lineChart.config.data[0];
      
      // Create a new randomized dataset
      const newDataset = createRandomizedDataset(sourceDataset, lineChart.config.data.length);
      
      // Add to chart
      lineChart.config.data.push(newDataset);
      lineChart.update();
      
      // Update UI
      updateDatasetManager('line');
      
      // Update study dataset options
      updateStudyDatasetOptions();
    });

    const endingLabelsToggle = document.getElementById('line-toggle-endinglabels');
    if (endingLabelsToggle) {
      endingLabelsToggle.addEventListener('click', (e) => {
        e.target.classList.toggle('active');
        const showEndingLabels = e.target.classList.contains('active');
        console.log('Line ending labels toggle clicked:', showEndingLabels);
        lineChart.toggleEndingLabels(showEndingLabels);
      });
    }
  }
  
  // FIXED: Setup statistical controls only once for line chart
  setupLineStatisticalControls();
}

// Initialize Bar Chart with time series data and studies support
async function initBarChart() {
  log('Initializing Bar Chart with Time Series Data and Studies Support');
  try {
    const timeSeriesData = await loadTimeSeriesData();
    
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
    
    barChart = new BarChart({
      container: '#bar-chart',
      data: data,
      options: {
        title: 'Bar Chart with Studies Support',
        xField: 'x',         // Point to the 'x' field which contains Date objects
        yField: 'y',
        xType: 'time',       // Explicitly set to 'time'
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
        // Studies-specific options for BarChart
        studiesAsLines: true,    // Render studies as lines overlaid on bars
        studyLineWidth: 2,       // Default line width for studies
        studyPointRadius: 0,     // No points for studies by default
        studies: []              // Initialize empty studies array
      }
    });
    
    barChart.render();
    log('Bar chart with studies support rendered successfully');
    updateDatasetManager('bar');
    setupBarChartControls();
  } catch (error) {
    log('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// FIXED: Line chart statistical controls - only set up once
function setupLineStatisticalControls() {
  if (!lineChart || eventListenerState.lineStatisticalListenersAttached) {
    console.log('Line statistical controls already attached or chart not ready');
    return;
  }
  
  console.log('Setting up line statistical controls');
  
  // Toggle average line
  const avgToggle = document.getElementById('line-toggle-average');
  if (avgToggle) {
    avgToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showAverageLine = e.target.classList.contains('active');
      console.log('Line average toggle clicked:', showAverageLine);
      lineChart.toggleAverageLine(showAverageLine);
    });
  }
  
  // Toggle median line
  const medianToggle = document.getElementById('line-toggle-median');
  if (medianToggle) {
    medianToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showMedianLine = e.target.classList.contains('active');
      console.log('Line median toggle clicked:', showMedianLine);
      lineChart.toggleMedianLine(showMedianLine);
    });
  }
  
  eventListenerState.lineStatisticalListenersAttached = true;
  console.log('Line statistical controls setup complete');
}

// FIXED: Bar chart statistical controls - only set up once
function setupBarStatisticalControls() {
  if (!barChart || eventListenerState.barStatisticalListenersAttached) {
    console.log('Bar statistical controls already attached or chart not ready');
    return;
  }
  
  console.log('Setting up bar statistical controls');
  
  // Toggle average line
  const avgToggle = document.getElementById('bar-toggle-average');
  if (avgToggle) {
    // Remove any existing listeners first
    const newAvgToggle = avgToggle.cloneNode(true);
    avgToggle.parentNode.replaceChild(newAvgToggle, avgToggle);
    
    newAvgToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      e.target.classList.toggle('active');
      const showAverageLine = e.target.classList.contains('active');
      console.log('Bar average toggle clicked:', showAverageLine, 'Chart exists:', !!barChart);
      
      if (barChart && typeof barChart.toggleAverageLine === 'function') {
        try {
          barChart.toggleAverageLine(showAverageLine);
          console.log('Bar average line toggled successfully');
        } catch (error) {
          console.error('Error toggling bar average line:', error);
        }
      } else {
        console.error('Bar chart or toggleAverageLine method not available');
      }
    });
    console.log('Bar average toggle listener attached');
  } else {
    console.error('Bar average toggle button not found');
  }
  
  // Toggle median line
  const medianToggle = document.getElementById('bar-toggle-median');
  if (medianToggle) {
    // Remove any existing listeners first
    const newMedianToggle = medianToggle.cloneNode(true);
    medianToggle.parentNode.replaceChild(newMedianToggle, medianToggle);
    
    newMedianToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      e.target.classList.toggle('active');
      const showMedianLine = e.target.classList.contains('active');
      console.log('Bar median toggle clicked:', showMedianLine, 'Chart exists:', !!barChart);
      
      if (barChart && typeof barChart.toggleMedianLine === 'function') {
        try {
          barChart.toggleMedianLine(showMedianLine);
          console.log('Bar median line toggled successfully');
        } catch (error) {
          console.error('Error toggling bar median line:', error);
        }
      } else {
        console.error('Bar chart or toggleMedianLine method not available');
      }
    });
    console.log('Bar median toggle listener attached');
  } else {
    console.error('Bar median toggle button not found');
  }
  
  eventListenerState.barStatisticalListenersAttached = true;
  console.log('Bar statistical controls setup complete');
}

// Add event listeners for Bar Chart Controls
function setupBarChartControls() {
  if (!barChart) return;
  
  // X axis name
  const xNameInput = document.getElementById('bar-x-name');
  if (xNameInput) {
    xNameInput.addEventListener('change', (e) => {
      barChart.setXAxisName(e.target.value);
    });
  }
  
  // Y axis name
  const yNameInput = document.getElementById('bar-y-name');
  if (yNameInput) {
    yNameInput.addEventListener('change', (e) => {
      barChart.setYAxisName(e.target.value);
    });
  }
  
  // Toggle logarithmic scale
  const logToggle = document.getElementById('bar-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isLogarithmic = e.target.classList.contains('active');
      barChart.toggleLogarithmic(isLogarithmic);
    });
  }
  
  // Toggle zero line
  const zeroToggle = document.getElementById('bar-toggle-zero');
  if (zeroToggle) {
    zeroToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showZeroLine = e.target.classList.contains('active');
      barChart.toggleZeroLine(showZeroLine);
    });
  }
  
  // Toggle recession lines
  const recessionToggle = document.getElementById('bar-toggle-recession');
  if (recessionToggle) {
    recessionToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showRecessionLines = e.target.classList.contains('active');
      barChart.toggleRecessionLines(showRecessionLines);
    });
  }
  
  // Toggle panel view
  const barPanelToggle = document.getElementById('bar-toggle-panel');
  if (barPanelToggle) {
    barPanelToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const isPanelView = e.target.classList.contains('active');
      console.log('Bar panel view toggle clicked:', isPanelView);
      barChart.togglePanelView(isPanelView);
    });
  }
  
  // Toggle legend
  const legendToggle = document.getElementById('bar-toggle-legend');
  if (legendToggle) {
    legendToggle.addEventListener('click', (e) => {
      e.target.classList.toggle('active');
      const showLegend = e.target.classList.contains('active');
      
      // Find and toggle the legend element directly
      if (barChart && barChart.state.svg) {
        const legend = barChart.state.svg.querySelector('.visioncharts-legend');
        if (legend) {
          // If legend exists, toggle its visibility
          legend.style.display = showLegend ? 'block' : 'none';
        } else if (showLegend) {
          // If legend doesn't exist but we want to show it, re-render the chart
          // This ensures the legend will be properly created and positioned
          barChart.options.showLegend = true;
          barChart.render();
        }
      }
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
      barChart.toggleEndingLabels(showEndingLabels);
    });
  }
  
  // Add dataset button
  const addDatasetBtn = document.getElementById('bar-add-dataset');
  if (addDatasetBtn) {
    addDatasetBtn.addEventListener('click', () => {
      if (!barChart || !barChart.config.data.length) return;
      
      // Get the source dataset (the first one)
      const sourceDataset = barChart.config.data[0];
      
      // Create a new randomized dataset
      const newDataset = createRandomizedDataset(sourceDataset, barChart.config.data.length);
      
      // Add to chart
      barChart.config.data.push(newDataset);
      barChart.update();
      
      // Update UI
      updateDatasetManager('bar');
      
      // Update study dataset options
      updateStudyDatasetOptions();
    });
  }
  
  // FIXED: Setup statistical controls only once for bar chart
  setupBarStatisticalControls();
}

// Tab functionality - FIXED to prevent duplicate listeners
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.chart-section');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      log(`Tab clicked: ${tabName}`);
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Show corresponding section, hide others
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
          // REMOVED: Duplicate setupStudies() and setupXXXStatisticalControls() calls
          // The controls are already set up in the init functions
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

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  log('DOM fully loaded');
  
  // Set up tab switching
  setupTabs();
  
  // Set up accordions
  setupAccordions();
  
  // Initialize line chart by default (since it's the active tab)
  initLineChart().then(() => {
    // Set up studies after line chart is initialized
    setupStudies();
    updateStudyDatasetOptions();
  });
  
  log('Initialization complete');
});
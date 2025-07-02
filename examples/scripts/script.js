// Simplified script.js - Essential functionality only
// Import the new VisionCharts classes
import { LineChart, BarChart } from '../../src/index.js';

// Global datasets storage
let availableDatasets = {};

// Chart instances
let lineChart = null;
let barChart = null;

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

// Initialize Line Chart
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
    
    // Create a single dataset
    const data = [
      {
        id: 'dataset-1',
        name: 'Time Series Data',
        color: '#1468a8', 
        width: 2,
        data: formattedData
      }
    ];
    
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
    
    log('Line chart rendered successfully with grid');
    
    // Setup basic controls
    setupLineChartControls();
    
  } catch (error) {
    log('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

// Initialize Bar Chart
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
        id: 'dataset-1',
        name: 'Time Series Data',
        color: '#1468a8',
        data: transformedData
      }
    ];
    
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
        // Grid enabled by default - no customization needed
        showGrid: true,
        showXGrid: true,
        showYGrid: true
      }
    });
    
    await barChart.render();
    
    log('Bar chart rendered successfully with grid');
    
    // Setup basic controls
    setupBarChartControls();
    
  } catch (error) {
    log('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

// Basic Line Chart Controls - Only axis names
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
}

// Basic Bar Chart Controls - Only axis names
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

// Initialize everything
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
    
    log('Chart initialization complete');
    
  } catch (error) {
    console.error('Failed to initialize charts:', error);
    
    // Display error to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; background: red; color: white; padding: 10px; z-index: 9999;';
    errorDiv.textContent = `Chart initialization failed: ${error.message}`;
    document.body.appendChild(errorDiv);
  }
}

// Start initialization when script loads
initializeCharts();
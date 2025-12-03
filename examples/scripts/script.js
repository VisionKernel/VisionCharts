import { LineChart, BarChart } from '../../../src/index.js';

let availableDatasets = {};
let lineChart = null;
let barChart = null;
let lineDatasetCounter = 1;
let barDatasetCounter = 1;
let lineStudyCounter = 1;
let barStudyCounter = 1;

const DEFAULT_COLORS = [
  '#1468a8',
  '#34A853',
  '#FBBC05',
  '#EA4335',
  '#9C27B0',
  '#00ACC1',
  '#FF9800',
  '#607D8B'
];

const SAMPLE_RECESSION_DATA = [
  { start: '2007-12-01', end: '2009-06-01', name: 'Great Recession (2007-2009)' },
  { start: '2001-03-01', end: '2001-11-01', name: 'Dot-com Recession (2001)' },
  { start: '2020-02-01', end: '2020-04-01', name: 'COVID-19 Recession (2020)' },
  { start: '1990-07-01', end: '1991-03-01', name: 'Gulf War Recession (1990-1991)' },
  { start: '1981-07-01', end: '1982-11-01', name: 'Early 1980s Recession' },
  { start: '1973-11-01', end: '1975-03-01', name: 'Oil Crisis Recession (1973-1975)' }
];

function getDefaultColor(index) {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

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

function createDatasetItem(dataset, chartType) {
  const item = document.createElement('div');
  item.className = 'dataset-item';
  item.setAttribute('data-id', dataset.id);

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

  const colorButton = item.querySelector('.color-picker-button');
  colorButton.addEventListener('click', () => {
    openColorPicker(dataset.color, (newColor) => {
      const chart = chartType === 'line' ? lineChart : barChart;
      if (chart && chart.updateDatasetColor(dataset.id, newColor)) {
        colorButton.style.backgroundColor = newColor;
        dataset.color = newColor;
      }
    });
  });

  if (chartType === 'line') {
    const fillCheckbox = item.querySelector('.fill-checkbox');
    if (fillCheckbox) {
      fillCheckbox.addEventListener('change', (e) => {
        const fillEnabled = e.target.checked;
        if (lineChart && lineChart.updateDatasetFill(dataset.id, fillEnabled)) {
          dataset.fill = fillEnabled;
        }
      });
    }
  }

  const removeBtn = item.querySelector('.remove-dataset');
  removeBtn.addEventListener('click', () => {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart) {
      chart.removeDataset(dataset.id);
      item.remove();
      updateStudyDatasetDropdowns();
    }
  });

  return item;
}

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
    let rawData = availableDatasets[selectedSource];
    if (!rawData || rawData.length === 0) {
      console.error('No data available for selected source:', selectedSource);
      return;
    }

    if (shouldRandomize) {
      rawData = rawData.map(point => ({
        ...point,
        y: point.y * (1 + (Math.random() - 0.5) * 0.3)
      }));
    }

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

    const formattedData = rawData.map(item => {
      if (chartType === 'line') {
        return { date: new Date(item.x), price: item.y };
      } else {
        return { x: new Date(item.x), y: item.y };
      }
    });

    const dataset = {
      id: datasetId,
      name: datasetName,
      color: datasetColor,
      data: formattedData,
      width: 2,
      fill: false
    };

    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart) {
      chart.addDataset(dataset);
      const datasetItem = createDatasetItem(dataset, chartType);
      datasetManager.appendChild(datasetItem);
      updateStudyDatasetDropdowns();
    }
  } catch (error) {
    console.error('Error adding dataset:', error);
  }
}

async function initLineChart() {
  try {
    const container = document.getElementById('line-chart');
    if (!container) {
      throw new Error('Line chart container not found');
    }

    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }

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

    if (lineChart.recessionLines) {
      lineChart.recessionLines.setRecessionData(SAMPLE_RECESSION_DATA);
    }

    await lineChart.render();
    window.lineChart = lineChart;

    setupLineChartControls();
    setupDatasetManagement('line');

    const datasetManager = document.getElementById('line-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(initialDataset, 'line');
      datasetManager.appendChild(datasetItem);
    }

    updateStudyDatasetDropdowns();
  } catch (error) {
    console.error('Error initializing line chart:', error);
    handleError('line-chart', error);
  }
}

async function initBarChart() {
  try {
    const container = document.getElementById('bar-chart');
    if (!container) {
      throw new Error('Bar chart container not found');
    }

    if (!availableDatasets.timeseries) {
      availableDatasets = await loadAllDatasets();
    }

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

    if (barChart.recessionLines) {
      barChart.recessionLines.setRecessionData(SAMPLE_RECESSION_DATA);
    }

    await barChart.render();
    window.barChart = barChart;

    setupBarChartControls();
    setupDatasetManagement('bar');

    const datasetManager = document.getElementById('bar-datasets');
    if (datasetManager) {
      const datasetItem = createDatasetItem(initialDataset, 'bar');
      datasetManager.appendChild(datasetItem);
    }

    updateStudyDatasetDropdowns();
    setupBarThemeToggle();
  } catch (error) {
    console.error('Error initializing bar chart:', error);
    handleError('bar-chart', error);
  }
}

function setupLineChartControls() {
  if (!lineChart) return;

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

  const recessionToggle = document.getElementById('line-toggle-recession');
  if (recessionToggle) {
    recessionToggle.classList.remove('active');
    let recessionVisible = false;
    recessionToggle.addEventListener('click', () => {
      try {
        recessionVisible = !recessionVisible;
        lineChart.toggleRecessionLines(recessionVisible);
        recessionToggle.classList.toggle('active', recessionVisible);
      } catch (error) {
        console.error('Error toggling line chart recessions:', error);
      }
    });
  }

  const logToggle = document.getElementById('line-toggle-log');
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      try {
        const isLog = lineChart.toggleLogarithmicScale();
        logToggle.classList.toggle('active', isLog);
      } catch (error) {
        console.error('Error toggling logarithmic scale:', error);
      }
    });
  }

  const legendToggle = document.getElementById('line-toggle-legend');
  if (legendToggle) {
    legendToggle.classList.add('active');
    legendToggle.addEventListener('click', () => {
      try {
        const newState = lineChart.toggleLegend();
        legendToggle.classList.toggle('active', newState);
      } catch (error) {
        console.error('Error toggling line chart legend:', error);
      }
    });
  }

  const endingLabelsToggle = document.getElementById('line-toggle-endinglabels');
  if (endingLabelsToggle) {
    endingLabelsToggle.classList.remove('active');
    let endingLabelsVisible = false;
    endingLabelsToggle.addEventListener('click', () => {
      try {
        endingLabelsVisible = !endingLabelsVisible;
        lineChart.toggleEndingLabels();
        endingLabelsToggle.classList.toggle('active', endingLabelsVisible);
      } catch (error) {
        console.error('Error toggling line chart ending labels:', error);
      }
    });
  }

  const zeroToggle = document.getElementById('line-toggle-zero');
  if (zeroToggle) {
    zeroToggle.classList.remove('active');
    let zeroVisible = false;
    zeroToggle.addEventListener('click', () => {
      try {
        zeroVisible = !zeroVisible;
        lineChart.toggleZeroLine();
        zeroToggle.classList.toggle('active', zeroVisible);
      } catch (error) {
        console.error('Error toggling line chart zero line:', error);
      }
    });
  }

  const averageToggle = document.getElementById('line-toggle-average');
  if (averageToggle) {
    averageToggle.classList.remove('active');
    let averageVisible = false;
    averageToggle.addEventListener('click', () => {
      try {
        averageVisible = !averageVisible;
        lineChart.toggleAverageLine();
        averageToggle.classList.toggle('active', averageVisible);
      } catch (error) {
        console.error('Error toggling line chart average line:', error);
      }
    });
  }

  const medianToggle = document.getElementById('line-toggle-median');
  if (medianToggle) {
    medianToggle.classList.remove('active');
    let medianVisible = false;
    medianToggle.addEventListener('click', () => {
      try {
        medianVisible = !medianVisible;
        lineChart.toggleMedianLine();
        medianToggle.classList.toggle('active', medianVisible);
      } catch (error) {
        console.error('Error toggling line chart median line:', error);
      }
    });
  }

  const curveTypeSelect = document.getElementById('line-curve');
  if (curveTypeSelect) {
    curveTypeSelect.addEventListener('change', (e) => {
      try {
        const curveType = e.target.value;
        lineChart.setCurveType(curveType);
      } catch (error) {
        console.error('Error setting curve type:', error);
      }
    });
  }

  const linePanelToggle = document.getElementById('line-toggle-panel');
  if (linePanelToggle) {
    linePanelToggle.addEventListener('click', async () => {
      try {
        if (!lineChart.config.data || lineChart.config.data.length <= 1) {
          alert('Panel mode requires multiple datasets. Please add more datasets first.');
          return;
        }
        linePanelToggle.textContent = 'Loading...';
        linePanelToggle.disabled = true;
        const isPanelMode = await lineChart.togglePanelMode();
        linePanelToggle.classList.toggle('active', isPanelMode);
        linePanelToggle.textContent = 'Toggle Panel View';
        linePanelToggle.disabled = false;
      } catch (error) {
        console.error('Error toggling line chart panel mode:', error);
        linePanelToggle.textContent = 'Toggle Panel View';
        linePanelToggle.disabled = false;
        linePanelToggle.classList.remove('active');
        alert('Error switching panel mode. Please try again.');
      }
    });
  }
}

function setupBarChartControls() {
  if (!barChart) return;

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

  const recessionToggle = document.getElementById('bar-toggle-recession');
  if (recessionToggle) {
    recessionToggle.classList.remove('active');
    let recessionVisible = false;
    recessionToggle.addEventListener('click', () => {
      try {
        recessionVisible = !recessionVisible;
        barChart.toggleRecessionLines(recessionVisible);
        recessionToggle.classList.toggle('active', recessionVisible);
      } catch (error) {
        console.error('Error toggling bar chart recessions:', error);
      }
    });
  }

  const barLogToggle = document.getElementById('bar-toggle-log');
  if (barLogToggle) {
    barLogToggle.addEventListener('click', () => {
      try {
        const isLog = barChart.toggleLogarithmicScale();
        barLogToggle.classList.toggle('active', isLog);
      } catch (error) {
        console.error('Error toggling bar chart logarithmic scale:', error);
      }
    });
  }

  const legendToggle = document.getElementById('bar-toggle-legend');
  if (legendToggle) {
    legendToggle.classList.add('active');
    legendToggle.addEventListener('click', () => {
      try {
        const newState = barChart.toggleLegend();
        legendToggle.classList.toggle('active', newState);
      } catch (error) {
        console.error('Error toggling bar chart legend:', error);
      }
    });
  }

  const endingLabelsToggle = document.getElementById('bar-toggle-endinglabels');
  if (endingLabelsToggle) {
    endingLabelsToggle.classList.remove('active');
    let endingLabelsVisible = false;
    endingLabelsToggle.addEventListener('click', () => {
      try {
        endingLabelsVisible = !endingLabelsVisible;
        barChart.toggleEndingLabels();
        endingLabelsToggle.classList.toggle('active', endingLabelsVisible);
      } catch (error) {
        console.error('Error toggling bar chart ending labels:', error);
      }
    });
  }

  const zeroToggle = document.getElementById('bar-toggle-zero');
  if (zeroToggle) {
    zeroToggle.classList.add('active');
    let zeroVisible = true;
    setTimeout(() => {
      if (barChart && barChart.zeroLine) {
        barChart.toggleZeroLine(true);
      }
    }, 100);
    zeroToggle.addEventListener('click', () => {
      try {
        zeroVisible = !zeroVisible;
        barChart.toggleZeroLine();
        zeroToggle.classList.toggle('active', zeroVisible);
      } catch (error) {
        console.error('Error toggling bar chart zero line:', error);
      }
    });
  }

  const averageToggle = document.getElementById('bar-toggle-average');
  if (averageToggle) {
    averageToggle.classList.remove('active');
    let averageVisible = false;
    averageToggle.addEventListener('click', () => {
      try {
        averageVisible = !averageVisible;
        barChart.toggleAverageLine();
        averageToggle.classList.toggle('active', averageVisible);
      } catch (error) {
        console.error('Error toggling bar chart average line:', error);
      }
    });
  }

  const medianToggle = document.getElementById('bar-toggle-median');
  if (medianToggle) {
    medianToggle.classList.remove('active');
    let medianVisible = false;
    medianToggle.addEventListener('click', () => {
      try {
        medianVisible = !medianVisible;
        barChart.toggleMedianLine();
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
        if (!barChart.config.data || barChart.config.data.length <= 1) {
          alert('Panel mode requires multiple datasets. Please add more datasets first.');
          return;
        }
        barPanelToggle.textContent = 'Loading...';
        barPanelToggle.disabled = true;
        const isPanelMode = await barChart.togglePanelMode();
        barPanelToggle.classList.toggle('active', isPanelMode);
        barPanelToggle.textContent = 'Toggle Panel View';
        barPanelToggle.disabled = false;
      } catch (error) {
        console.error('Error toggling bar chart panel mode:', error);
        barPanelToggle.textContent = 'Toggle Panel View';
        barPanelToggle.disabled = false;
        barPanelToggle.classList.remove('active');
        alert('Error switching panel mode. Please try again.');
      }
    });
  }
}

function setupLineThemeToggle() {
  const lineThemeBtn = document.getElementById('line-toggle-theme');
  const lineChartContainer = document.getElementById('line-chart');

  if (lineThemeBtn && lineChart) {
    const currentTheme = lineChart.getThemeName();
    lineThemeBtn.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    lineThemeBtn.classList.toggle('dark-mode', currentTheme === 'dark');
    lineChartContainer.classList.toggle('dark-mode', currentTheme === 'dark');
    
    lineThemeBtn.addEventListener('click', () => {
      const isDark = lineChart.getThemeName() === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      
      lineChart.setTheme(newTheme);
      
      lineThemeBtn.textContent = newTheme === 'dark' ? 'Dark' : 'Light';
      lineThemeBtn.classList.toggle('dark-mode', newTheme === 'dark');
      lineChartContainer.classList.toggle('dark-mode', newTheme === 'dark');
    });
  }
}

function setupBarThemeToggle() {
  const barThemeBtn = document.getElementById('bar-toggle-theme');
  const barChartContainer = document.getElementById('bar-chart');

  if (barThemeBtn && barChart) {
    const currentTheme = barChart.getThemeName();
    barThemeBtn.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    barThemeBtn.classList.toggle('dark-mode', currentTheme === 'dark');
    barChartContainer.classList.toggle('dark-mode', currentTheme === 'dark');
    
    barThemeBtn.addEventListener('click', () => {
      const isDark = barChart.getThemeName() === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      
      barChart.setTheme(newTheme);
      
      barThemeBtn.textContent = newTheme === 'dark' ? 'Dark' : 'Light';
      barThemeBtn.classList.toggle('dark-mode', newTheme === 'dark');
      barChartContainer.classList.toggle('dark-mode', newTheme === 'dark');
    });
  }
}

function setupDatasetManagement(chartType) {
  const sourceSelect = document.getElementById(`${chartType}-dataset-source`);
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      updateDatasetPreview(chartType);
    });
    updateDatasetPreview(chartType);
  }

  const addButton = document.getElementById(`${chartType}-add-dataset`);
  if (addButton) {
    addButton.addEventListener('click', () => {
      addDatasetToChart(chartType);
    });
  }
}

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

async function loadAllDatasets() {
  const datasets = {};
  try {
    datasets.timeseries = await fetch('../examples/data/timeseries.json')
      .then(response => response.json())
      .then(data => data)
      .catch(() => generateFallbackData('timeseries'));

    datasets['daily-returns'] = await fetch('../examples/data/daily-returns.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('daily-returns'));

    datasets.monthly = await fetch('../examples/data/timeseries-monthly.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('monthly'));

    datasets.nasdaq = await fetch('../examples/data/NASDAQCOM.json')
      .then(response => response.json())
      .catch(() => generateFallbackData('nasdaq'));
  } catch (error) {
    console.error('Error loading datasets:', error);
  }
  return datasets;
}

function generateFallbackData(type) {
  const data = [];
  const startDate = new Date('2000-01-01');
  const count = type === 'monthly' ? 300 : 6000;
  let value = 100;
  const recessionPeriods = [
    { start: new Date('2020-02-01'), end: new Date('2020-04-01') },
    { start: new Date('2007-12-01'), end: new Date('2009-06-01') },
    { start: new Date('2001-03-01'), end: new Date('2001-11-01') }
  ];

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    if (type === 'monthly') {
      date.setMonth(date.getMonth() + i);
    } else {
      date.setDate(date.getDate() + i);
    }

    const isInRecession = recessionPeriods.some(recession =>
      date >= recession.start && date <= recession.end
    );

    if (type === 'daily-returns') {
      const volatilityMultiplier = isInRecession ? 2.0 : 1.0;
      value = (Math.random() - 0.5) * 0.1 * volatilityMultiplier;
    } else {
      const recessionEffect = isInRecession ? -15 : 0;
      const baseChange = (Math.random() - 0.45) * 20;
      value += baseChange + recessionEffect * (Math.random() * 0.5);
      value = Math.max(value, 10);
    }

    data.push({ x: date.getTime(), y: value });
  }

  return data;
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.chart-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const tabName = this.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      sections.forEach(section => {
        if (section.id === `${tabName}-section`) {
          section.style.display = 'block';
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

function waitForDOMReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

function initStudyControls() {
  initLineStudyControls();
  initBarStudyControls();
  initStudyAccordions();
}

function initLineStudyControls() {
  const addStudyButton = document.querySelector('#line-section .accordion-content button');
  if (addStudyButton) {
    addStudyButton.addEventListener('click', () => addStudyToChart('line'));
  }
}

function initBarStudyControls() {
  const addStudyButton = document.querySelector('#bar-section .accordion-content button');
  if (addStudyButton) {
    addStudyButton.addEventListener('click', () => addStudyToChart('bar'));
  }
}

function addStudyToChart(chartType) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (!chart) {
      console.error(`${chartType} chart not initialized`);
      return;
    }

    const studyType = document.getElementById(`${chartType}-study-type`).value;
    const period = parseInt(document.getElementById(`${chartType}-study-period`).value);
    const datasetSelect = document.getElementById(`${chartType}-study-dataset`);
    const datasetId = datasetSelect.value;
    const color = document.getElementById(`${chartType}-study-color`).value;

    if (!studyType || !period || period < 1) {
      alert('Please provide valid study parameters');
      return;
    }

    const supportedTypes = ['sma', 'ema', 'bollinger'];
    if (!supportedTypes.includes(studyType)) {
      alert(`Study type "${studyType}" is not yet implemented in the core library. Currently supported: ${supportedTypes.join(', ')}`);
      return;
    }

    const counter = chartType === 'line' ? lineStudyCounter++ : barStudyCounter++;
    const studyName = `${studyType.toUpperCase()} (${period})`;

    const studyConfig = {
      name: studyName,
      datasetId: datasetId,
      parameters: { period: period },
      color: color,
      strokeWidth: 2,
      visible: true
    };

    const studyId = chart.addStudy(studyType, studyConfig);
    addStudyToUI(chartType, studyId, studyName, studyType, period, color);
  } catch (error) {
    console.error('Error adding study:', error);
    alert(`Error adding study: ${error.message}`);
  }
}

function addStudyToUI(chartType, studyId, studyName, studyType, period, color) {
  const activeStudiesContainer = document.querySelector(`#${chartType}-section .accordion-content > div:last-child`);
  if (!activeStudiesContainer) return;

  if (activeStudiesContainer.textContent.includes('No studies added')) {
    activeStudiesContainer.innerHTML = '';
  }

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

function toggleStudyVisibility(chartType, studyId, isVisible) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart && chart.updateStudy) {
      chart.updateStudy(studyId, { visible: isVisible });
    }
  } catch (error) {
    console.error('Error toggling study visibility:', error);
  }
}

function removeStudyFromChart(chartType, studyId, studyItem) {
  try {
    const chart = chartType === 'line' ? lineChart : barChart;
    if (chart && chart.removeStudy) {
      chart.removeStudy(studyId);
      studyItem.remove();
      const activeStudiesContainer = studyItem.parentNode;
      if (activeStudiesContainer && activeStudiesContainer.children.length === 0) {
        activeStudiesContainer.innerHTML = '<div>No studies added</div>';
      }
    }
  } catch (error) {
    console.error('Error removing study:', error);
  }
}

function updateStudyDatasetDropdowns() {
  updateStudyDatasetDropdown('line');
  updateStudyDatasetDropdown('bar');
}

function updateStudyDatasetDropdown(chartType) {
  const dropdown = document.getElementById(`${chartType}-study-dataset`);
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const chart = chartType === 'line' ? lineChart : barChart;
  if (!chart || !chart.config || !chart.config.data) {
    dropdown.innerHTML = '<option value="">No datasets available</option>';
    return;
  }
  chart.config.data.forEach((dataset, index) => {
    const option = document.createElement('option');
    option.value = dataset.id;
    option.textContent = dataset.name || `Dataset ${index + 1}`;
    dropdown.appendChild(option);
  });
  if (dropdown.children.length > 0) {
    dropdown.selectedIndex = 0;
  }
}

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
  accordionHeaders.forEach(header => {
    const content = header.nextElementSibling;
    content.style.display = 'none';
  });
}

async function initializeCharts() {
  try {
    await waitForDOMReady();
    await new Promise(resolve => setTimeout(resolve, 100));
    setupTabs();
    await initLineChart();
    initStudyControls();
    setupLineThemeToggle();
  } catch (error) {
    console.error('Failed to initialize charts:', error);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; background: red; color: white; padding: 10px; z-index: 9999;';
    errorDiv.textContent = `Chart initialization failed: ${error.message}`;
    document.body.appendChild(errorDiv);
  }
}

initializeCharts();
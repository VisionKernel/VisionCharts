import Axis from '../core/Axis.js';
import { LinearScale, TimeScale, LogScale } from '../core/Scale.js';
import PanelDataRenderer from './PanelDataRenderer.js';
import ScaleManager from '../core/ScaleManager.js';
import RecessionLines from './RecessionLines.js';
import ZeroLine from './ZeroLine.js';
import Grid from './Grid.js';
import StatisticalLines from './StatisticalLines.js';
import StudiesRenderer from './StudiesRenderer.js';

/**
 * Panel component for rendering multi-panel charts
 * Handles common panel functionality across different chart types
 */
export default class Panel {
    /**
     * Render panels for a chart - main entry point
     * @param {Chart} chart - Chart instance
     * @returns {Array} Panel scales for hover functionality
     */
    static renderForChart(chart) {
        console.log('Panel.renderForChart called');
        
        if (!chart.state.chart) {
            console.error('Cannot render panels: chart element is null');
            return [];
        }
        
        try {
            const { innerWidth, innerHeight } = chart.state.dimensions;
            
            // FIXED: Only create panels for non-study datasets
            const regularDatasets = chart.state.datasets.filter(dataset => dataset.type !== 'study');
            
            // Determine number of panels (one per regular dataset only)
            const panelCount = regularDatasets.length;
            if (panelCount === 0) {
                console.log('No regular datasets for panels');
                return [];
            }
            
            console.log('Rendering', panelCount, 'panels for regular datasets');
            
            // Store panel scales for hover functionality
            const panelScales = [];
            
            // Create panel for each regular dataset
            regularDatasets.forEach((dataset, index) => {
                // Calculate panel dimensions
                const panelHeight = innerHeight / panelCount;
                const panelMargin = index === 0 ? 30 : 20;  // Extra margin for first panel
                const effectivePanelHeight = panelHeight - panelMargin;
                
                // Create panel group
                const panelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                panelGroup.setAttribute('class', `visioncharts-panel panel-${index}`);
                // Add top margin of 10px for the first panel
                const yPos = index * panelHeight + (index === 0 ? 20 : 0);
                panelGroup.setAttribute('transform', `translate(0, ${yPos})`);
                
                // Create panel background
                const panelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                panelBg.setAttribute('x', 0);
                panelBg.setAttribute('y', 0);
                panelBg.setAttribute('width', innerWidth);
                panelBg.setAttribute('height', effectivePanelHeight);
                panelBg.setAttribute('fill', '#f9f9f9');
                panelBg.setAttribute('stroke', '#eee');
                panelGroup.appendChild(panelBg);
                
                // Create scales for this panel using ScaleManager
                const scales = ScaleManager.createPanelScales(dataset, chart.options, {
                    innerWidth,
                    effectivePanelHeight
                });
                
                // Store scales for hover functionality
                panelScales[index] = { 
                    xScale: scales.xScale, 
                    yScale: scales.yScale, 
                    panelHeight: effectivePanelHeight,
                    panelWidth: innerWidth,
                    yPos: yPos
                };
                
                // Render panel components (axes, grid, etc.)
                Panel.renderPanelComponents(
                    panelGroup, 
                    scales, 
                    { innerWidth, effectivePanelHeight }, 
                    chart.options, 
                    index === regularDatasets.length - 1, // isLastPanel
                    dataset // Pass dataset for statistical lines
                );
                
                // Render the main dataset data
                PanelDataRenderer.renderForPanel(
                    chart, 
                    panelGroup, 
                    dataset, 
                    scales.xScale, 
                    scales.yScale, 
                    effectivePanelHeight, 
                    innerWidth,
                    index
                );
                
                // FIXED: Find and render studies that belong to this dataset
                const relatedStudies = Panel.findStudiesForDataset(chart, dataset.id);
                console.log(`Found ${relatedStudies.length} studies for dataset ${dataset.id}`);
                
                relatedStudies.forEach(studyDataset => {
                    console.log(`Rendering study ${studyDataset.id} in panel for dataset ${dataset.id}`);
                    StudiesRenderer.renderForPanel(
                        chart, 
                        studyDataset, 
                        panelGroup, 
                        scales.xScale, 
                        scales.yScale, 
                        effectivePanelHeight
                    );
                });
                
                // Render panel label
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.textContent = dataset.name;
                label.setAttribute('x', 5);
                label.setAttribute('y', 15);
                label.setAttribute('font-size', '12px');
                label.setAttribute('font-weight', 'bold');
                label.setAttribute('fill', dataset.color);
                panelGroup.appendChild(label);
                
                // Add panel to chart
                chart.state.chart.appendChild(panelGroup);
            });
            
            // Store panel scales on chart for hover functionality
            chart.state.panelScales = panelScales;
            
            console.log('Panels rendered successfully');
            return panelScales;
        } catch (error) {
            console.error('Error rendering panels:', error);
            return [];
        }
    }
    
    /**
     * Find study datasets that belong to a specific regular dataset
     * @param {Object} chart - Chart instance
     * @param {string} datasetId - ID of the regular dataset
     * @returns {Array} Array of study datasets
     */
    static findStudiesForDataset(chart, datasetId) {
        if (!chart.state.datasets) {
            return [];
        }
        
        // Find all study datasets that have this dataset as their parent
        return chart.state.datasets.filter(dataset => {
            // Check if it's a study dataset
            if (dataset.type !== 'study') {
                return false;
            }
            
            // Check if this study belongs to the specified dataset
            // Studies are linked to datasets through the studies configuration
            if (chart.options.studies) {
                const studyConfig = chart.options.studies.find(study => study.id === dataset.id);
                return studyConfig && studyConfig.datasetId === datasetId;
            }
            
            return false;
        });
    }
  
    /**
     * Render panel components (axes, grid, zero line, recession lines, statistical lines)
     * @param {SVGElement} panelGroup - Panel container
     * @param {Object} scales - Panel scales  
     * @param {Object} dimensions - Panel dimensions
     * @param {Object} options - Chart options
     * @param {boolean} isLastPanel - Whether this is the last panel
     * @param {Object} dataset - Dataset for this panel (NEW PARAMETER)
     */
    static renderPanelComponents(panelGroup, scales, dimensions, options, isLastPanel, dataset) {
        const { innerWidth, effectivePanelHeight } = dimensions;
        const { xScale, yScale } = scales;
        
        // Render panel axes
        Panel.renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, options, isLastPanel);
        
        // Render grid if enabled
        if (options.grid?.show) {
            Grid.renderForPanel(
                panelGroup,
                xScale,
                yScale,
                innerWidth,
                effectivePanelHeight,
                options.grid,
                options
            );
        }
        
        // Render zero line for this panel if enabled
        if (options.showZeroLine) {
            ZeroLine.renderForPanel(panelGroup, yScale, innerWidth, options.zeroLineOptions);
        }
        
        // Render recession lines for this panel if enabled
        if (options.showRecessionLines && options.recessions && options.recessions.length) {
            RecessionLines.renderForPanel(
                panelGroup, 
                options.recessions, 
                xScale, 
                effectivePanelHeight, 
                innerWidth,
                options.xType,
                options.recessionLinesOptions || {}
            );
        }
        
        // Render statistical lines for this panel if enabled
        if ((options.showAverageLine || options.showMedianLine) && dataset) {
            StatisticalLines.renderForPanel(
                panelGroup,
                dataset,
                xScale,
                yScale,
                innerWidth,
                effectivePanelHeight,
                options
            );
        }
    }
  
    /**
     * Render axes for a panel
     * @param {SVGElement} panelGroup - Panel container
     * @param {Object} xScale - X scale for this panel
     * @param {Object} yScale - Y scale for this panel
     * @param {number} innerWidth - Panel width
     * @param {number} effectivePanelHeight - Panel height
     * @param {Object} options - Chart options
     * @param {boolean} isLastPanel - Whether this is the last panel
     */
    static renderPanelAxes(panelGroup, xScale, yScale, innerWidth, effectivePanelHeight, options, isLastPanel = false) {
        console.log('Panel.renderPanelAxes called for panel, isLastPanel:', isLastPanel);
        
        // Render axes using the static Axis method
        Axis.renderForPanel(
            panelGroup, 
            xScale, 
            yScale, 
            innerWidth, 
            effectivePanelHeight,
            {
                // Axis configuration
                showXAxis: isLastPanel, // Only show X axis on bottom panel
                showYAxis: true,
                showXLabels: isLastPanel, // Only show X labels on bottom panel
                showYLabels: true,
                xAxisName: isLastPanel ? options.xAxisName : '',
                yAxisName: options.yAxisName,
                isLogarithmic: options.isLogarithmic || false,
                
                // Custom axis options
                xAxisOptions: {
                    tickCount: options.xTickCount || 5,
                    tickFormat: options.xTickFormat,
                    formatType: options.xType === 'time' ? 'time' : 'number',
                    formatOptions: options.xFormatOptions || {},
                    tickRotation: options.xTickRotation || 0
                },
                
                yAxisOptions: {
                    tickCount: options.yTickCount || 4, // Fewer ticks for panels
                    tickFormat: options.yTickFormat,
                    formatType: 'number',
                    formatOptions: options.yFormatOptions || {},
                    tickRotation: options.yTickRotation || 0
                }
            }
        );
    }
}
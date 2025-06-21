import SvgRenderer from '../renderers/SvgRenderer.js';

/**
 * StudiesRenderer - Centralized component for rendering all types of studies/indicators
 * Handles rendering for both LineChart and BarChart in single and panel modes
 */
export default class StudiesRenderer {
  
  /**
   * Render studies for LineChart context (as overlaid lines/areas)
   * @param {Object} chart - Chart instance
   * @param {Array} studyDatasets - Array of study datasets to render
   * @param {SVGElement} dataGroup - Parent SVG group to append to
   */
  static renderForLineChart(chart, studyDatasets, dataGroup) {
    console.log('StudiesRenderer.renderForLineChart called with', studyDatasets.length, 'studies');
    
    if (!studyDatasets || !studyDatasets.length) return;
    
    // Create studies group
    const studiesGroup = SvgRenderer.createGroup({ class: 'visioncharts-studies' });
    
    studyDatasets.forEach((dataset, index) => {
      if (!dataset.data || !dataset.data.length) {
        console.log('Study dataset', dataset.id, 'has no data, skipping');
        return;
      }
      
      console.log('Rendering study', dataset.id, 'type:', dataset.studyType);
      
      // Create dataset group for this study
      const studyGroup = SvgRenderer.createGroup({ 
        class: `visioncharts-study-${dataset.id}` 
      });
      
      // Render based on study type
      this.renderStudyByType(chart, dataset, studyGroup);
      
      // Add to studies group
      studiesGroup.appendChild(studyGroup);
    });
    
    // Add studies group to data group
    dataGroup.appendChild(studiesGroup);
  }
  
  /**
   * Render studies for BarChart context (as overlaid lines)
   * @param {Object} chart - Chart instance
   * @param {Array} studyDatasets - Array of study datasets to render
   * @param {SVGElement} dataGroup - Parent SVG group to append to
   */
  static renderForBarChart(chart, studyDatasets, dataGroup) {
    console.log('StudiesRenderer.renderForBarChart called with', studyDatasets.length, 'studies');
    
    if (!studyDatasets || !studyDatasets.length) return;
    
    const { xField, yField, studyLineWidth, studyPointRadius } = chart.options;
    
    // Create studies group
    const studiesGroup = SvgRenderer.createGroup({ class: 'visioncharts-studies' });
    
    studyDatasets.forEach((dataset, index) => {
      if (!dataset.data || !dataset.data.length) {
        console.log('Study dataset', dataset.id, 'has no data, skipping');
        return;
      }
      
      console.log('Rendering study', dataset.id, 'with', dataset.data.length, 'points');
      
      // Create dataset group for this study
      const studyGroup = SvgRenderer.createGroup({ 
        class: `visioncharts-study-${dataset.id}` 
      });
      
      // Generate line path for the study
      const linePath = this.generateStudyLinePath(chart, dataset.data);
      if (linePath) {
        const studyConfig = this.getStudyConfig(chart, dataset);
        const lineWidth = studyConfig?.width || dataset.width || studyLineWidth;
        
        const lineElement = SvgRenderer.createPath(linePath, {
          stroke: dataset.color,
          'stroke-width': lineWidth,
          fill: 'none',
          class: 'visioncharts-study-line',
          'data-study-id': dataset.id
        });
        
        studyGroup.appendChild(lineElement);
      }
      
      // Render points if enabled
      if (studyPointRadius > 0) {
        const pointsGroup = SvgRenderer.createGroup({ class: 'visioncharts-study-points' });
        
        dataset.data.forEach(d => {
          if (d[xField] === undefined || d[yField] === undefined) return;
          
          const x = chart.state.scales.x.scale(d[xField]);
          const y = chart.state.scales.y.scale(d[yField]);
          
          const point = SvgRenderer.createCircle(x, y, studyPointRadius, {
            fill: '#fff',
            stroke: dataset.color,
            'stroke-width': 1,
            class: 'visioncharts-study-point'
          });
          
          pointsGroup.appendChild(point);
        });
        
        studyGroup.appendChild(pointsGroup);
      }
      
      // Add to studies group
      studiesGroup.appendChild(studyGroup);
    });
    
    // Add studies group to data group
    dataGroup.appendChild(studiesGroup);
  }
  
  /**
   * Render study in panel mode (for both LineChart and BarChart)
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Study dataset
   * @param {SVGElement} panel - Panel container
   * @param {Object} xScale - X scale for this panel
   * @param {Object} yScale - Y scale for this panel
   * @param {number} panelHeight - Panel height
   */
  static renderForPanel(chart, dataset, panel, xScale, yScale, panelHeight) {
    console.log('StudiesRenderer.renderForPanel called for study:', dataset.id);
    
    const { xField, yField, studyLineWidth, studyPointRadius } = chart.options;
    
    // Map data points to coordinates using panel-specific scales
    const points = dataset.data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return;
    
    // Generate linear path for study
    const pathD = SvgRenderer.linePathDefinition(points);
    
    // Render line
    const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lineElement.setAttribute('d', pathD);
    lineElement.setAttribute('stroke', dataset.color);
    lineElement.setAttribute('stroke-width', dataset.width || studyLineWidth);
    lineElement.setAttribute('fill', 'none');
    lineElement.setAttribute('class', 'visioncharts-panel-study-line');
    lineElement.setAttribute('data-study-id', dataset.id);
    panel.appendChild(lineElement);
    
    // Render points if enabled
    if (studyPointRadius > 0) {
      dataset.data.forEach(d => {
        if (d[xField] === undefined || d[yField] === undefined) return;
        
        const x = xScale.scale(d[xField]);
        const y = yScale.scale(d[yField]);
        
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        point.setAttribute('cx', x);
        point.setAttribute('cy', y);
        point.setAttribute('r', studyPointRadius);
        point.setAttribute('fill', '#fff');
        point.setAttribute('stroke', dataset.color);
        point.setAttribute('stroke-width', 1);
        point.setAttribute('class', 'visioncharts-panel-study-point');
        
        panel.appendChild(point);
      });
    }
  }
  
  /**
   * Render study based on its type (private method)
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Study dataset
   * @param {SVGElement} studyGroup - Study group element
   */
  static renderStudyByType(chart, dataset, studyGroup) {
    const { xField, yField, showPoints, pointRadius } = chart.options;
    
    if (dataset.studyType === 'bollinger') {
      // Render Bollinger Bands (upper, middle, lower lines)
      ['upper', 'middle', 'lower'].forEach((line, index) => {
        const lineData = dataset.data.map(d => ({
          [xField]: d[xField],
          [yField]: d[line]
        })).filter(d => d[yField] !== undefined && d[yField] !== null);
        
        if (lineData.length === 0) return;
        
        const linePath = this.generateLinePathForData(chart, lineData);
        if (linePath) {
          const opacity = line === 'middle' ? 1 : 0.6;
          const strokeWidth = line === 'middle' ? dataset.width : (dataset.width * 0.7);
          
          const lineElement = SvgRenderer.createPath(linePath, {
            stroke: dataset.color,
            'stroke-width': strokeWidth,
            'stroke-opacity': opacity,
            fill: 'none',
            class: `visioncharts-study-line visioncharts-bollinger-${line}`
          });
          
          studyGroup.appendChild(lineElement);
        }
      });
      
      // Optionally add fill between upper and lower bands
      if (dataset.area) {
        this.renderBollingerBandsFill(chart, dataset, studyGroup);
      }
      
    } else if (dataset.studyType === 'macd') {
      // Render MACD lines
      ['macd', 'signal'].forEach((line, index) => {
        const lineData = dataset.data.map(d => ({
          [xField]: d[xField],
          [yField]: d[line]
        })).filter(d => d[yField] !== undefined && d[yField] !== null);
        
        if (lineData.length === 0) return;
        
        const linePath = this.generateLinePathForData(chart, lineData);
        if (linePath) {
          const color = line === 'macd' ? dataset.color : '#ff6b6b';
          
          const lineElement = SvgRenderer.createPath(linePath, {
            stroke: color,
            'stroke-width': dataset.width,
            fill: 'none',
            class: `visioncharts-study-line visioncharts-macd-${line}`
          });
          
          studyGroup.appendChild(lineElement);
        }
      });
      
      // Render histogram bars
      this.renderMACDHistogram(chart, dataset, studyGroup);
      
    } else {
      // Standard single-line studies (SMA, EMA, RSI)
      const linePath = this.generateLinePathForData(chart, dataset.data);
      if (linePath) {
        const lineElement = SvgRenderer.createPath(linePath, {
          stroke: dataset.color,
          'stroke-width': dataset.width,
          fill: 'none',
          class: 'visioncharts-study-line'
        });
        
        studyGroup.appendChild(lineElement);
      }
      
      // Render points if enabled
      if (showPoints) {
        dataset.data.forEach(d => {
          if (d[xField] === undefined || d[yField] === undefined) return;
          
          const x = chart.state.scales.x.scale(d[xField]);
          const y = chart.state.scales.y.scale(d[yField]);
          
          const point = SvgRenderer.createCircle(x, y, pointRadius, {
            fill: '#fff',
            stroke: dataset.color,
            'stroke-width': dataset.width / 2,
            class: 'visioncharts-study-point'
          });
          
          studyGroup.appendChild(point);
        });
      }
    }
  }
  
  /**
   * Generate line path for study data (used by BarChart)
   * @param {Object} chart - Chart instance
   * @param {Array} data - Study data
   * @returns {string} SVG path definition
   */
  static generateStudyLinePath(chart, data) {
    const { xField, yField } = chart.options;
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    // Map data points to coordinates
    const points = data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return '';
    
    // Generate linear path for studies (studies are typically smooth lines)
    return SvgRenderer.linePathDefinition(points);
  }
  
  /**
   * Generate line path for specific data (used internally)
   * @private
   * @param {Object} chart - Chart instance
   * @param {Array} data - Data array
   * @returns {string} SVG path definition
   */
  static generateLinePathForData(chart, data) {
    const { xField, yField } = chart.options;
    const xScale = chart.state.scales.x;
    const yScale = chart.state.scales.y;
    
    // Map data points to coordinates
    const points = data
      .filter(d => d[xField] !== undefined && d[yField] !== undefined)
      .map(d => [
        xScale.scale(d[xField]),
        yScale.scale(d[yField])
      ]);
    
    if (points.length === 0) return '';
    
    // Generate linear path for studies
    return SvgRenderer.linePathDefinition(points);
  }
  
  /**
   * Render Bollinger Bands fill area
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Bollinger bands dataset
   * @param {SVGElement} studyGroup - Study group element
   */
  static renderBollingerBandsFill(chart, dataset, studyGroup) {
    const { xField } = chart.options;
    
    // Create path for the area between upper and lower bands
    const upperPoints = [];
    const lowerPoints = [];
    
    dataset.data.forEach(d => {
      if (d.upper !== undefined && d.lower !== undefined && d[xField] !== undefined) {
        const x = chart.state.scales.x.scale(d[xField]);
        const upperY = chart.state.scales.y.scale(d.upper);
        const lowerY = chart.state.scales.y.scale(d.lower);
        
        upperPoints.push([x, upperY]);
        lowerPoints.push([x, lowerY]);
      }
    });
    
    if (upperPoints.length === 0) return;
    
    // Create area path
    const upperPath = SvgRenderer.linePathDefinition(upperPoints);
    const lowerPath = SvgRenderer.linePathDefinition(lowerPoints.reverse());
    const areaPath = `${upperPath} L ${lowerPath.substring(1)} Z`;
    
    const areaElement = SvgRenderer.createPath(areaPath, {
      fill: dataset.color,
      'fill-opacity': dataset.areaOpacity || 0.1,
      stroke: 'none',
      class: 'visioncharts-bollinger-fill'
    });
    
    studyGroup.appendChild(areaElement);
  }
  
  /**
   * Render MACD histogram
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - MACD dataset
   * @param {SVGElement} studyGroup - Study group element
   */
  static renderMACDHistogram(chart, dataset, studyGroup) {
    const { xField } = chart.options;
    const zeroY = chart.state.scales.y.scale(0);
    
    dataset.data.forEach(d => {
      if (d.histogram === undefined || d[xField] === undefined) return;
      
      const x = chart.state.scales.x.scale(d[xField]);
      const histogramY = chart.state.scales.y.scale(d.histogram);
      const barHeight = Math.abs(zeroY - histogramY);
      const barY = Math.min(zeroY, histogramY);
      
      // Bar color based on positive/negative
      const barColor = d.histogram >= 0 ? '#26a69a' : '#ef5350';
      
      const bar = SvgRenderer.createRect(x - 1, barY, 2, barHeight, {
        fill: barColor,
        class: 'visioncharts-macd-histogram'
      });
      
      studyGroup.appendChild(bar);
    });
  }
  
  /**
   * Get study configuration for a dataset
   * @private
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to get study config for
   * @returns {Object|null} Study configuration or null
   */
  static getStudyConfig(chart, dataset) {
    if (!chart.options.studies) return null;
    return chart.options.studies.find(study => study.id === dataset.id) || null;
  }
  
  /**
   * Check if a dataset is a study/indicator
   * @param {Object} chart - Chart instance
   * @param {Object} dataset - Dataset to check
   * @returns {boolean} True if dataset is a study
   */
  static isStudyDataset(chart, dataset) {
    // Check if this dataset was created from a study
    return chart.options.studies && chart.options.studies.some(study => study.id === dataset.id);
  }
}
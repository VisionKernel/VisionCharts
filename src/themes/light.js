/**
 * Light theme for VisionCharts
 */
export default {
  name: 'light',
  colors: {
    background: '#ffffff',
    panel: '#f9f9f9',
    text: '#333333',
    title: '#1468a8',
    axis: '#666666',
    grid: '#eeeeee',
    tooltip: {
      background: '#ffffff',
      border: '#cccccc',
      text: '#333333'
    },
    legend: {
      background: 'rgba(255, 255, 255, 0.85)',
      border: '#e0e0e0',
      text: '#333333'
    },
    zeroLine: {
      stroke: '#666666',
      opacity: 0.5
    },
    recession: {
      fill: 'rgba(235, 54, 54, 0.15)',
      border: 'rgba(235, 54, 54, 0.3)',
      text: '#888888'
    }
  },
  // Default line/bar/area colors
  palette: [
    '#1468a8', // Blue
    '#34A853', // Green
    '#FBBC05', // Yellow
    '#EA4335', // Red
    '#9C27B0', // Purple
    '#00ACC1', // Cyan
    '#FF9800', // Orange
    '#607D8B'  // Blue Grey
  ],
  
  /**
   * Detect if dark mode is active (for Tailwind integration)
   * @returns {boolean} Whether dark mode is active
   */
  isDarkMode() {
    // Check for .dark class on html/document element (Tailwind's class strategy)
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             document.body.classList.contains('dark');
    }
    
    // Check for prefers-color-scheme media query as fallback
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    return false;
  }
};
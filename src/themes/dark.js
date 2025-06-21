/**
 * Dark theme for VisionCharts
 */
export default {
  name: 'dark',
  colors: {
    background: '#1e1e2e', // Dark background
    panel: '#313244',      // Slightly lighter for panels
    text: '#cdd6f4',       // Light text color for contrast
    title: '#89b4fa',      // Light blue for titles
    axis: '#a6adc8',       // Lighter color for axis
    grid: '#45475a',       // Darker grid lines
    tooltip: {
      background: '#313244',
      border: '#45475a',
      text: '#cdd6f4'
    },
    legend: {
      background: 'rgba(49, 50, 68, 0.85)',
      border: '#45475a',
      text: '#cdd6f4'
    },
    zeroLine: {
      stroke: '#a6adc8',
      opacity: 0.5
    },
    recession: {
      fill: 'rgba(243, 139, 168, 0.2)',
      border: 'rgba(243, 139, 168, 0.4)',
      text: '#a6adc8'
    }
  },
  // Enhanced color palette for dark mode
  palette: [
    '#89b4fa', // Blue
    '#a6e3a1', // Green
    '#f9e2af', // Yellow
    '#f38ba8', // Red
    '#cba6f7', // Purple
    '#74c7ec', // Cyan
    '#fab387', // Orange
    '#a6adc8'  // Blue Grey
  ],
  
  /**
   * Detect if dark mode is active (for Tailwind integration)
   * @returns {boolean} Whether dark mode is active
   */
  isDarkMode() {
    // Same detection logic as light theme
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             document.body.classList.contains('dark');
    }
    
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    return false;
  }
};
/**
 * Utility functions for VisionCharts
 */

/**
 * Format date value for display
 * @param {Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date
 */
export function formatDateValue(date, format = 'MMM dd, yyyy') {
    if (!date) return '';
    
    // Convert to Date object if string
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check for valid date
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    // Use Intl.DateTimeFormat for formatting
    let options = {};
    
    // Custom format handler
    if (format === 'MMM dd, yyyy') {
      options = { 
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      };
    } else if (format === 'yyyy-MM-dd') {
      // ISO format
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else if (format === 'MM/dd/yyyy') {
      // US format
      options = { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };
    } else if (format === 'HH:mm:ss') {
      // Time only
      options = { 
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
    } else if (format === 'full') {
      // Full date and time
      options = { 
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  }
/**
 * recessionData.js - Historically Accurate NBER Recession Periods
 * Location: /src/utils/recessionData.js
 * 
 * Contains all major US recession periods as defined by the National Bureau 
 * of Economic Research (NBER). Dates are historically accurate.
 */

/**
 * Complete list of US recessions from NBER data
 * Format: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
export const NBER_RECESSIONS = [
  // Panic of 1857
  { start: '1857-06-01', end: '1858-12-01' },
  
  // Panic of 1873 (Long Depression)
  { start: '1873-10-01', end: '1879-03-01' },
  
  // Panic of 1893
  { start: '1893-01-01', end: '1894-06-01' },
  
  // Panic of 1907
  { start: '1907-05-01', end: '1908-06-01' },
  
  // Great Depression
  { start: '1929-08-01', end: '1933-03-01' },
  
  // 1937-1938 Recession
  { start: '1937-05-01', end: '1938-06-01' },
  
  // 1945 Recession (Post-WWII)
  { start: '1945-02-01', end: '1945-10-01' },
  
  // 1949 Recession
  { start: '1948-11-01', end: '1949-10-01' },
  
  // 1953 Recession
  { start: '1953-07-01', end: '1954-05-01' },
  
  // 1957-1958 Recession
  { start: '1957-08-01', end: '1958-04-01' },
  
  // 1960-1961 Recession
  { start: '1960-04-01', end: '1961-02-01' },
  
  // 1969-1970 Recession
  { start: '1969-12-01', end: '1970-11-01' },
  
  // 1973-1975 Oil Crisis Recession
  { start: '1973-11-01', end: '1975-03-01' },
  
  // 1980 Recession
  { start: '1980-01-01', end: '1980-07-01' },
  
  // 1981-1982 Recession (Double-dip)
  { start: '1981-07-01', end: '1982-11-01' },
  
  // 1990-1991 Gulf War Recession
  { start: '1990-07-01', end: '1991-03-01' },
  
  // 2001 Dot-com Recession
  { start: '2001-03-01', end: '2001-11-01' },
  
  // 2007-2009 Great Recession (Financial Crisis)
  { start: '2007-12-01', end: '2009-06-01' },
  
  // 2020 COVID-19 Recession
  { start: '2020-02-01', end: '2020-04-01' }
];

/**
 * Convert recession data to millisecond timestamps for chart use
 * @returns {Array} Array of recession periods with timestamp values
 */
export function getRecessionTimestamps() {
  return NBER_RECESSIONS.map(recession => ({
    start: new Date(recession.start).getTime(),
    end: new Date(recession.end).getTime(),
    startDate: recession.start,
    endDate: recession.end
  }));
}

/**
 * Filter recessions to only those within a given date range
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp  
 * @returns {Array} Filtered recession periods
 */
export function getRecessionsByDateRange(startTime, endTime) {
  const recessions = getRecessionTimestamps();
  
  return recessions.filter(recession => {
    // Include recession if it overlaps with the date range at all
    return recession.start <= endTime && recession.end >= startTime;
  });
}
import EventSystem from '../core/EventSystem.js';
import Crosshair from '../components/Crosshair.js';
import Tooltip from '../components/Tooltip.js';
import Legend from '../components/Legend.js';
import { formatLargeNumber, formatDateValue } from '../utils/chartUtils.js';

/**
 * InteractionManager handles all chart interactions including hover, tooltips, and crosshairs
 * Centralizes interaction logic to reduce duplication across chart types
 */

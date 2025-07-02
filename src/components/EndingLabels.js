/**
 * EndingLabels Component
 * Renders labels showing the ending value (most recent datapoint) for line charts
 * Supports both single panel and multi-panel modes
 */

import SvgRenderer from '../renderers/SvgRenderer.js';
import { formatLargeNumber } from '../utils/chartUtils.js';

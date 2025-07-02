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

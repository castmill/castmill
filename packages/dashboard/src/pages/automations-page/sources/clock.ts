import { BsClock } from 'solid-icons/bs';
import type { ClockConfig } from '../../../services/automations.service';
import type { SourceDefinition } from '../registry-types';
import { ClockEditor } from './clock-editor';
import {
  clockSummary,
  defaultClockConfig,
  normalizeClock,
  validateClock,
} from './clock-logic';

export const clockSource: SourceDefinition<ClockConfig> = {
  type: 'clock',
  conditions: ['at'],
  icon: BsClock,
  label: (t) => t('automations.sources.clock.label'),
  description: (t) => t('automations.sources.clock.description'),
  defaultConfig: defaultClockConfig,
  editor: ClockEditor,
  summary: clockSummary,
  validate: validateClock,
  normalize: normalizeClock,
};

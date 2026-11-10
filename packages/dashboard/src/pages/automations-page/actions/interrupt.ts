import { BsLightningCharge } from 'solid-icons/bs';
import type { InterruptConfig } from '../../../services/automations.service';
import type { ActionDefinition } from '../registry-types';
import { InterruptEditor } from './interrupt-editor';
import {
  defaultInterruptConfig,
  interruptSummary,
  normalizeInterrupt,
  validateInterrupt,
} from './interrupt-logic';

export const interruptAction: ActionDefinition<InterruptConfig> = {
  type: 'interrupt',
  icon: BsLightningCharge,
  label: (t) => t('automations.actions.interrupt.label'),
  description: (t) => t('automations.actions.interrupt.description'),
  defaultConfig: defaultInterruptConfig,
  editor: InterruptEditor,
  summary: interruptSummary,
  validate: validateInterrupt,
  normalize: normalizeInterrupt,
};

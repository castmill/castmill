import type { InterruptConfig } from '../../../services/automations.service';
import type { SummaryContext } from '../registry-types';

export const DEFAULT_MAX_WAIT_SECONDS = 120;
export const MAX_PLAYS = 100;
export const MAX_WAIT_LIMIT_SECONDS = 3600;

export const defaultInterruptConfig = (): InterruptConfig => ({
  playlist_id: null,
  start: 'after_current_item',
  max_wait_seconds: DEFAULT_MAX_WAIT_SECONDS,
  plays: 1,
  priority: 'normal',
});

const isInt = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

export const validateInterrupt = (config: InterruptConfig): string[] => {
  const errors: string[] = [];
  if (!config.playlist_id) errors.push('automations.validation.playlist');
  if (config.start !== 'immediately' && config.start !== 'after_current_item')
    errors.push('automations.validation.start');
  if (
    config.start === 'after_current_item' &&
    config.max_wait_seconds !== undefined &&
    !isInt(config.max_wait_seconds, 0, MAX_WAIT_LIMIT_SECONDS)
  )
    errors.push('automations.validation.maxWait');
  if (!isInt(config.plays, 1, MAX_PLAYS))
    errors.push('automations.validation.plays');
  if (config.priority !== 'normal' && config.priority !== 'high')
    errors.push('automations.validation.priority');
  return errors;
};

export const normalizeInterrupt = (
  config: InterruptConfig
): InterruptConfig => {
  const { max_wait_seconds, ...rest } = config;
  return config.start === 'after_current_item'
    ? {
        ...rest,
        max_wait_seconds: max_wait_seconds ?? DEFAULT_MAX_WAIT_SECONDS,
      }
    : rest;
};

/** e.g. "Interrupt with “Spring offer” after the current item · 2 plays". */
export const interruptSummary = (
  config: InterruptConfig,
  ctx: SummaryContext
): string => {
  const { t } = ctx;
  if (!config.playlist_id) return t('automations.summary.noPlaylist');

  const playlist =
    ctx.playlistName(config.playlist_id) ??
    t('automations.summary.playlistFallback', { id: config.playlist_id });

  const parts = [
    config.start === 'immediately'
      ? t('automations.summary.interruptImmediately', { playlist })
      : t('automations.summary.interruptAfterItem', { playlist }),
  ];
  if (config.plays > 1)
    parts.push(t('automations.summary.plays', { count: config.plays }));
  if (config.priority === 'high')
    parts.push(t('automations.summary.highPriority'));
  return parts.join(' · ');
};

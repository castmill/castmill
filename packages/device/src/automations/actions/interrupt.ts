import type { Action, ActionContext, PlaybackHost } from '../types';

export const DEFAULT_MAX_WAIT_SECONDS = 120;

export interface InterruptConfig {
  playlistId: number | string;
  start: 'immediately' | 'after_current_item';
  maxWaitMs: number;
  plays: number;
  priority: 'normal' | 'high';
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback;
}

export function parseInterruptConfig(
  config: Record<string, unknown>
): InterruptConfig | undefined {
  const playlistId = config.playlist_id;
  if (
    !(typeof playlistId === 'number' || typeof playlistId === 'string') ||
    playlistId === ''
  ) {
    return undefined;
  }
  return {
    playlistId,
    start:
      config.start === 'after_current_item'
        ? 'after_current_item'
        : 'immediately',
    maxWaitMs:
      positiveInteger(config.max_wait_seconds, DEFAULT_MAX_WAIT_SECONDS) * 1000,
    plays: Math.max(1, positiveInteger(config.plays, 1)),
    priority: config.priority === 'high' ? 'high' : 'normal',
  };
}

/**
 * Interrupts normal programming with a playlist. Afterwards programming
 * continues with the item after the interrupted one (the interrupted item is
 * not resumed, avoiding seeks that are unreliable on old WebOS decoders).
 *
 * For state conditions the playlist loops while the state is active.
 */
export class InterruptAction implements Action {
  readonly usesPlayback = true;

  priority(config: Record<string, unknown>) {
    return parseInterruptConfig(config)?.priority || 'normal';
  }

  maxWaitMs(config: Record<string, unknown>) {
    const parsed = parseInterruptConfig(config);
    return parsed ? parsed.maxWaitMs : DEFAULT_MAX_WAIT_SECONDS * 1000;
  }

  async preload(config: Record<string, unknown>, host: PlaybackHost) {
    const parsed = parseInterruptConfig(config);
    if (parsed) await host.preparePlaylist(parsed.playlistId);
  }

  async run(config: Record<string, unknown>, context: ActionContext) {
    const parsed = parseInterruptConfig(config);
    if (!parsed) throw new Error('Invalid interrupt configuration');
    const { host, signal } = context;

    const playlist = await host.preparePlaylist(parsed.playlistId);
    if (signal.aborted) return;

    let resumeAtCurrent = false;
    if (parsed.start === 'after_current_item') {
      resumeAtCurrent = await host.waitForItemBoundary(
        parsed.maxWaitMs,
        signal
      );
      if (signal.aborted) return;
    }

    const plays = context.kind === 'state' ? Infinity : parsed.plays;
    await host.playInterruption(playlist, plays, signal, resumeAtCurrent);
  }
}

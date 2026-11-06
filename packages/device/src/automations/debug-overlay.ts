import type { FiringRecord } from './types';
import type { NextFiring } from './engine';

const pad = (value: number) => (value < 10 ? '0' : '') + value;

/** Local wall-clock time, e.g. `Fri 15:08:00`. */
export function formatFiringTime(at: number): string {
  const date = new Date(at);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

export function describeFiringResult(record: FiringRecord): string {
  const result = record.result;
  return result.status === 'dropped'
    ? `dropped (${result.reason})`
    : result.status;
}

/** Debug overlay lines (English only, like other on-device debug output). */
export function describeAutomations(
  next: NextFiring | undefined,
  last: FiringRecord | undefined
): string[] {
  return [
    next
      ? `Next automation: ${formatFiringTime(next.at)} · ${next.automationName}`
      : 'Next automation: none',
    last
      ? `Last automation: ${last.automationName} · ${describeFiringResult(
          last
        )} · ${formatFiringTime(last.at)}`
      : 'Last automation: none',
  ];
}

/**
 * Small box in the lower left corner of the player showing the next clock
 * firing and the last firing result. Plain DOM and inline styles so that it
 * works on Chrome 38.
 */
export class AutomationDebugOverlay {
  private element?: HTMLDivElement;

  constructor(private readonly container: HTMLElement) {}

  update(lines: string[] | undefined) {
    if (!lines) {
      this.hide();
      return;
    }
    if (!this.element) {
      const element = document.createElement('div');
      element.setAttribute('data-castmill-automation-debug', '');
      const style = element.style;
      style.position = 'absolute';
      style.left = '0.5em';
      style.bottom = '0.5em';
      style.zIndex = '10001';
      style.padding = '0.4em 0.6em';
      style.background = 'rgba(0, 0, 0, 0.7)';
      style.color = '#fff';
      style.font = '0.8em monospace';
      style.whiteSpace = 'pre';
      style.pointerEvents = 'none';
      this.container.appendChild(element);
      this.element = element;
    }
    this.element.textContent = lines.join('\n');
  }

  hide() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = undefined;
  }
}

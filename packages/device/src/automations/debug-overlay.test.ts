import { describe, expect, it } from 'vitest';
import {
  AutomationDebugOverlay,
  describeAutomations,
  formatFiringTime,
} from './debug-overlay';

describe('automation debug overlay', () => {
  const at = new Date(2026, 10, 6, 15, 8, 5).getTime();

  it('formats firing times in local time', () => {
    expect(formatFiringTime(at)).toBe('Fri 15:08:05');
  });

  it('describes the next and the last firing', () => {
    expect(describeAutomations(undefined, undefined)).toEqual([
      'Next automation: none',
      'Last automation: none',
    ]);
    expect(
      describeAutomations(
        { at, automationId: 1, automationName: 'Spring', ruleId: 'r' },
        {
          at,
          automationId: 1,
          automationName: 'Spring',
          ruleId: 'r',
          result: { status: 'dropped', reason: 'cooldown' },
        }
      )
    ).toEqual([
      'Next automation: Fri 15:08:05 · Spring',
      'Last automation: Spring · dropped (cooldown) · Fri 15:08:05',
    ]);
    expect(
      describeAutomations(undefined, {
        at,
        automationId: 1,
        automationName: 'Spring',
        ruleId: 'r',
        result: { status: 'ran' },
      })[1]
    ).toBe('Last automation: Spring · ran · Fri 15:08:05');
  });

  it('shows, updates and hides the box', () => {
    const container = document.createElement('div');
    const overlay = new AutomationDebugOverlay(container);
    overlay.update(['a', 'b']);
    overlay.update(['c']);
    const box = container.querySelector('[data-castmill-automation-debug]');
    expect(box?.textContent).toBe('c');
    overlay.update(undefined);
    expect(container.children).toHaveLength(0);
    overlay.hide();
  });
});

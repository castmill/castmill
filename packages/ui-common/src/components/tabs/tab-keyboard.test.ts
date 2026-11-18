import { describe, expect, it, vi } from 'vitest';
import { revealTab, tabKeyTarget } from './tab-keyboard';

const keyOn = (key: string, el: HTMLElement) => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });
  Object.defineProperty(event, 'currentTarget', { value: el });
  return event;
};

describe('tabKeyTarget', () => {
  const tab = document.createElement('button');

  it('moves with arrow keys and wraps', () => {
    expect(tabKeyTarget(keyOn('ArrowRight', tab), 0, 3)).toBe(1);
    expect(tabKeyTarget(keyOn('ArrowRight', tab), 2, 3)).toBe(0);
    expect(tabKeyTarget(keyOn('ArrowLeft', tab), 0, 3)).toBe(2);
  });

  it('jumps with Home and End', () => {
    expect(tabKeyTarget(keyOn('Home', tab), 2, 3)).toBe(0);
    expect(tabKeyTarget(keyOn('End', tab), 0, 3)).toBe(2);
  });

  it('mirrors arrows in RTL', () => {
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    const rtlTab = document.createElement('button');
    wrapper.appendChild(rtlTab);
    expect(tabKeyTarget(keyOn('ArrowRight', rtlTab), 1, 3)).toBe(0);
    expect(tabKeyTarget(keyOn('ArrowLeft', rtlTab), 1, 3)).toBe(2);
  });

  it('ignores other keys and empty lists without preventing default', () => {
    const event = keyOn('a', tab);
    expect(tabKeyTarget(event, 0, 3)).toBeUndefined();
    expect(event.defaultPrevented).toBe(false);
    expect(tabKeyTarget(keyOn('End', tab), 0, 0)).toBeUndefined();
  });

  it('prevents default for navigation keys', () => {
    const event = keyOn('Home', tab);
    tabKeyTarget(event, 1, 3);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('revealTab', () => {
  it('scrolls and optionally focuses the tab', () => {
    const tab = document.createElement('button');
    document.body.appendChild(tab);
    tab.scrollIntoView = vi.fn();
    revealTab(tab);
    expect(tab.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(tab);
    revealTab(tab, true);
    expect(document.activeElement).toBe(tab);
    tab.remove();
  });
});

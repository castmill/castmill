import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@solidjs/testing-library';
import {
  KeyboardShortcutsProvider,
  SEQUENCE_TIMEOUT_MS,
  useKeyboardShortcuts,
  KeyboardShortcut,
} from './useKeyboardShortcuts';

type Api = ReturnType<typeof useKeyboardShortcuts>;

const setup = (shortcuts: Record<string, KeyboardShortcut>) => {
  let api!: Api;
  const Capture = () => {
    api = useKeyboardShortcuts();
    Object.entries(shortcuts).forEach(([id, shortcut]) =>
      api.registerShortcut(id, shortcut)
    );
    return null;
  };
  render(() => (
    <KeyboardShortcutsProvider>
      <Capture />
    </KeyboardShortcutsProvider>
  ));
  return api;
};

const press = (
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document.body
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const setPlatform = (platform: string) => {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('useKeyboardShortcuts', () => {
  const originalPlatform = navigator.platform;

  beforeEach(() => {
    vi.useFakeTimers();
    setPlatform('MacIntel');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setPlatform(originalPlatform);
  });

  describe('sequence shortcuts', () => {
    const gotoChannels = vi.fn();
    const create = vi.fn();
    const remove = vi.fn();

    beforeEach(() => {
      gotoChannels.mockReset();
      create.mockReset();
      remove.mockReset();
      setup({
        'goto-channels': {
          key: 'C',
          sequence: 'G',
          description: 'Go to Channels',
          category: 'navigation',
          action: gotoChannels,
        },
        'generic-create': {
          key: 'C',
          description: 'Create',
          category: 'actions',
          action: create,
        },
        'generic-delete': {
          key: 'Delete',
          description: 'Delete',
          category: 'actions',
          action: remove,
        },
      });
    });

    it('runs on G then C and does not run the single-key C shortcut', () => {
      press('g');
      const event = press('c');

      expect(gotoChannels).toHaveBeenCalledTimes(1);
      expect(create).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves ⌘C alone so the browser can copy', () => {
      const event = press('c', { metaKey: true });

      expect(gotoChannels).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('leaves Ctrl+C alone on Windows and Linux', () => {
      setPlatform('Win32');
      const event = press('c', { ctrlKey: true });

      expect(gotoChannels).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('does not complete a sequence with ⌘ held on the second key', () => {
      press('g');
      const event = press('c', { metaKey: true });

      expect(gotoChannels).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('keeps single-key shortcuts working outside a sequence', () => {
      press('c');

      expect(create).toHaveBeenCalledTimes(1);
      expect(gotoChannels).not.toHaveBeenCalled();
    });

    it('expires the prefix after the timeout', () => {
      press('g');
      vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS + 1);
      press('c');

      expect(gotoChannels).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('cancels on an unknown second key without running other shortcuts', () => {
      press('g');
      press('Delete');

      expect(remove).not.toHaveBeenCalled();

      press('c');
      expect(gotoChannels).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('ignores modifier-only key presses between the two keys', () => {
      press('g');
      press('Shift', { shiftKey: true });
      press('c');

      expect(gotoChannels).toHaveBeenCalledTimes(1);
    });

    it('ignores the sequence while typing in a text field', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      press('g', {}, input);
      press('c', {}, input);

      expect(gotoChannels).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      input.remove();
    });

    it('does not start a sequence whose shortcuts are all disabled', () => {
      cleanup();
      const action = vi.fn();
      setup({
        'goto-channels': {
          key: 'C',
          sequence: 'G',
          description: 'Go to Channels',
          category: 'navigation',
          action,
          condition: () => false,
        },
        'generic-create': {
          key: 'C',
          description: 'Create',
          category: 'actions',
          action: create,
        },
      });

      press('g');
      press('c');

      expect(action).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('modifier shortcuts', () => {
    it('still runs ⌘F / Ctrl+F style shortcuts', () => {
      const search = vi.fn();
      setup({
        'global-search': {
          key: 'F',
          ctrl: true,
          description: 'Search',
          category: 'global',
          action: search,
        },
      });

      const event = press('f', { metaKey: true });

      expect(search).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('formatShortcut', () => {
    it('formats sequences with the given label', () => {
      const api = setup({});
      const shortcut: KeyboardShortcut = {
        key: 'c',
        sequence: 'g',
        description: 'Go to Channels',
        category: 'navigation',
      };

      expect(api.formatShortcut(shortcut)).toBe('G then C');
      expect(api.formatShortcut(shortcut, { thenLabel: 'luego' })).toBe(
        'G luego C'
      );
    });

    it('formats modifier shortcuts as before', () => {
      const api = setup({});
      const shortcut: KeyboardShortcut = {
        key: 'F',
        ctrl: true,
        description: 'Search',
        category: 'global',
      };

      expect(api.formatShortcut(shortcut)).toBe('⌘ F');
      setPlatform('Win32');
      expect(api.formatShortcut(shortcut)).toBe('Ctrl+F');
    });
  });
});

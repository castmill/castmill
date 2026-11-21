import {
  createContext,
  useContext,
  Component,
  ParentProps,
  createSignal,
  onMount,
  onCleanup,
} from 'solid-js';

export type ShortcutCategory = 'global' | 'navigation' | 'actions';

export interface KeyboardShortcut {
  key: string;
  /**
   * Prefix key for a two-key sequence, e.g. `sequence: 'G', key: 'C'` means
   * "press G, then C". Sequence shortcuts never use Ctrl/⌘/Alt, so they
   * cannot collide with browser or OS shortcuts such as ⌘C (copy).
   */
  sequence?: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string | (() => string); // Support dynamic descriptions for i18n
  category: ShortcutCategory;
  action?: () => void; // Made optional - can be set separately via registerShortcutAction
  condition?: () => boolean;
}

interface KeyboardShortcutsContextType {
  registerShortcut: (id: string, shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  registerShortcutAction: (
    id: string,
    action: () => void,
    condition?: () => boolean
  ) => void;
  unregisterShortcutAction: (id: string) => void;
  getShortcuts: () => Map<string, KeyboardShortcut>;
  formatShortcut: (
    shortcut: KeyboardShortcut,
    options?: FormatShortcutOptions
  ) => string;
  isMac: () => boolean;
  isMobile: () => boolean;
}

export interface FormatShortcutOptions {
  /** Localized word placed between the keys of a sequence, e.g. "then". */
  thenLabel?: string;
}

/** How long the second key of a sequence may take after the prefix key. */
export const SEQUENCE_TIMEOUT_MS = 1500;

const MODIFIER_KEYS = new Set(['SHIFT', 'CONTROL', 'ALT', 'META', 'ALTGRAPH']);

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>();

export const KeyboardShortcutsProvider: Component<ParentProps> = (props) => {
  const [shortcuts, setShortcuts] = createSignal(
    new Map<string, KeyboardShortcut>()
  );

  const isMac = () => {
    return (
      typeof navigator !== 'undefined' &&
      navigator.platform.toUpperCase().indexOf('MAC') >= 0
    );
  };

  const isMobile = () => {
    return (
      typeof window !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    );
  };

  const registerShortcut = (id: string, shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      newMap.set(id, shortcut);
      return newMap;
    });
  };

  const unregisterShortcut = (id: string) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  const registerShortcutAction = (
    id: string,
    action: () => void,
    condition?: () => boolean
  ) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, action, condition });
      }
      return newMap;
    });
  };

  const unregisterShortcutAction = (id: string) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        // Remove action and condition, keep the shortcut registered for legend
        newMap.set(id, {
          ...existing,
          action: undefined,
          condition: undefined,
        });
      }
      return newMap;
    });
  };

  const getShortcuts = () => shortcuts();

  const formatShortcut = (
    shortcut: KeyboardShortcut,
    options?: FormatShortcutOptions
  ): string => {
    if (shortcut.sequence) {
      const thenLabel = options?.thenLabel ?? 'then';
      return `${shortcut.sequence.toUpperCase()} ${thenLabel} ${shortcut.key.toUpperCase()}`;
    }

    const parts: string[] = [];
    const mac = isMac();

    if (shortcut.ctrl) {
      parts.push(mac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) {
      parts.push(mac ? '⇧' : 'Shift');
    }
    if (shortcut.alt) {
      parts.push(mac ? '⌥' : 'Alt');
    }
    if (shortcut.meta && !mac) {
      parts.push('Meta');
    }

    parts.push(shortcut.key.toUpperCase());

    // Use space on Mac for cleaner look, + on Windows/Linux
    return parts.join(mac ? ' ' : '+');
  };

  const checkModifierMatch = (
    shortcut: KeyboardShortcut,
    event: KeyboardEvent,
    mac: boolean
  ): boolean => {
    // Check ctrl/cmd modifier
    const ctrlPressed = mac ? event.metaKey : event.ctrlKey;
    const ctrlMatch = shortcut.ctrl
      ? ctrlPressed
      : !event.ctrlKey && !event.metaKey;

    // Check shift modifier
    const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

    // Check alt modifier
    const altMatch = shortcut.alt ? event.altKey : !event.altKey;

    return ctrlMatch && shiftMatch && altMatch;
  };

  // Prefix key of a sequence that is waiting for its second key
  let pendingPrefix: { key: string; at: number } | null = null;

  const findShortcut = (
    predicate: (shortcut: KeyboardShortcut) => boolean
  ): KeyboardShortcut | undefined => {
    for (const [, shortcut] of shortcuts()) {
      if (shortcut.condition && !shortcut.condition()) {
        continue;
      }
      if (predicate(shortcut)) {
        return shortcut;
      }
    }
    return undefined;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    // Check if we're in an input field that should block shortcuts
    const isInInputField =
      (target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type !== 'checkbox' &&
        (target as HTMLInputElement).type !== 'radio') ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    // Allow ESC key to work as a shortcut even in input fields (to blur/exit)
    // But Delete/Backspace should NOT be processed as shortcuts when in input fields
    // - they should just work normally for text editing
    if (isInInputField && event.key !== 'Escape') {
      pendingPrefix = null;
      return;
    }

    const pressedKey = event.key.toUpperCase();

    // Holding a modifier on its own (e.g. Shift) doesn't affect a sequence
    if (MODIFIER_KEYS.has(pressedKey)) {
      return;
    }

    const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey;

    // Second key of a sequence such as "G then C"
    if (pendingPrefix) {
      const prefix = pendingPrefix;
      pendingPrefix = null;

      if (Date.now() - prefix.at <= SEQUENCE_TIMEOUT_MS) {
        if (plainKey) {
          const match = findShortcut(
            (shortcut) =>
              shortcut.sequence?.toUpperCase() === prefix.key &&
              shortcut.key.toUpperCase() === pressedKey
          );
          if (match) {
            event.preventDefault();
            match.action?.();
            return;
          }
        }
        // An unknown second key cancels the sequence without triggering
        // single-key shortcuts (e.g. "G" then "Delete" must not delete).
        // Escape and modified keys (⌘C, Ctrl+F…) keep working normally.
        if (plainKey && event.key !== 'Escape') {
          return;
        }
      }
    }

    // First key of a sequence. Sequence prefixes take precedence over a
    // single-key shortcut on the same key.
    if (plainKey && !event.shiftKey && !isInInputField) {
      const startsSequence = findShortcut(
        (shortcut) => shortcut.sequence?.toUpperCase() === pressedKey
      );
      if (startsSequence) {
        pendingPrefix = { key: pressedKey, at: Date.now() };
        return;
      }
    }

    const mac = isMac();

    for (const [, shortcut] of shortcuts()) {
      // Sequence shortcuts only run through the prefix handling above
      if (shortcut.sequence) {
        continue;
      }

      // Check if condition is met (if defined)
      if (shortcut.condition && !shortcut.condition()) {
        continue;
      }

      // Normalize key for comparison (handle Delete/Backspace equivalence)
      let eventKey = event.key.toUpperCase();
      let shortcutKey = shortcut.key.toUpperCase();

      // On Mac, Backspace is the delete key, so treat them as equivalent
      if (eventKey === 'BACKSPACE' && shortcutKey === 'DELETE') {
        eventKey = 'DELETE';
      } else if (eventKey === 'DELETE' && shortcutKey === 'BACKSPACE') {
        eventKey = 'BACKSPACE';
      }

      // Check if the key matches
      if (eventKey !== shortcutKey) {
        continue;
      }

      // Check modifiers
      if (checkModifierMatch(shortcut, event, mac)) {
        event.preventDefault();
        // Only invoke action if it exists (some shortcuts are placeholders)
        if (shortcut.action) {
          shortcut.action();
        }
        break;
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  const value: KeyboardShortcutsContextType = {
    registerShortcut,
    unregisterShortcut,
    registerShortcutAction,
    unregisterShortcutAction,
    getShortcuts,
    formatShortcut,
    isMac,
    isMobile,
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {props.children}
    </KeyboardShortcutsContext.Provider>
  );
};

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcuts must be used within KeyboardShortcutsProvider'
    );
  }
  return context;
};

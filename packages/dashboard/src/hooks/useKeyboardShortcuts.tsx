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
  formatShortcut: (shortcut: KeyboardShortcut) => string;
  isMac: () => boolean;
  isMobile: () => boolean;
}

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

  const formatShortcut = (shortcut: KeyboardShortcut): string => {
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
      return;
    }

    const mac = isMac();

    for (const [, shortcut] of shortcuts()) {
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

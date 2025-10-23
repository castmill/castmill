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
  action: () => void;
  condition?: () => boolean;
}

interface KeyboardShortcutsContextType {
  registerShortcut: (id: string, shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
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
    const isInInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    // Allow ESC key even in input fields (to blur/exit)
    // Block all other shortcuts when typing in input fields
    if (isInInputField && event.key !== 'Escape') {
      return;
    }

    const mac = isMac();

    for (const [, shortcut] of shortcuts()) {
      // Check if condition is met (if defined)
      if (shortcut.condition && !shortcut.condition()) {
        continue;
      }

      // Check if the key matches
      if (event.key.toUpperCase() !== shortcut.key.toUpperCase()) {
        continue;
      }

      // Check modifiers
      if (checkModifierMatch(shortcut, event, mac)) {
        event.preventDefault();
        shortcut.action();
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

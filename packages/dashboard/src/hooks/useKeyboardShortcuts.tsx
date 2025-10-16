import {
  createContext,
  useContext,
  Component,
  ParentProps,
  createSignal,
  onMount,
  onCleanup,
} from 'solid-js';

export type ShortcutCategory = 'global' | 'navigation' | 'actions' | 'search';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
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
  const [shortcuts] = createSignal(new Map<string, KeyboardShortcut>());

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
    shortcuts().set(id, shortcut);
  };

  const unregisterShortcut = (id: string) => {
    shortcuts().delete(id);
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

    return parts.join(mac ? '' : '+');
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
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
      const ctrlMatch = shortcut.ctrl
        ? mac
          ? event.metaKey
          : event.ctrlKey
        : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (ctrlMatch && shiftMatch && altMatch) {
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

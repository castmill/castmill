# Keyboard Shortcuts for Addons

This guide explains how addon developers can register keyboard shortcuts for their addons in the Castmill Dashboard.

## Overview

The Dashboard provides a centralized keyboard shortcuts system that addons can integrate with. The system:

- Automatically handles platform-specific shortcuts (macOS uses ⌘, Windows/Linux use Ctrl)
- Supports conditional shortcuts that are only active when certain conditions are met
- Displays shortcuts in a centralized shortcuts legend (Cmd/Ctrl+/)
- Hides shortcuts on mobile devices automatically

## Accessing the Keyboard Shortcuts System

Addons don't have direct access to the useKeyboardShortcuts hook because they're loaded in a different context. Instead, addons should expose their own keyboard shortcut handling.

## Implementation Pattern

Here's the recommended pattern for implementing keyboard shortcuts in your addon:

### 1. Register shortcuts in your component

```tsx
import { Component, onMount, onCleanup } from 'solid-js';
import { AddonComponentProps } from '../../common/interfaces/addon-store';

const MyAddonPage: Component<AddonComponentProps> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  // Your addon state and logic
  const [showAddModal, setShowAddModal] = createSignal(false);

  onMount(() => {
    // Register keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    // Clean up event listener
    window.removeEventListener('keydown', handleKeyDown);
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    // Check if user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Allow Escape to blur
      if (event.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // Platform detection
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl+N - Add new resource
    if (cmdOrCtrl && event.key === 'n') {
      event.preventDefault();
      setShowAddModal(true);
    }

    // Cmd/Ctrl+A - Select all
    if (cmdOrCtrl && event.key === 'a') {
      event.preventDefault();
      selectAllItems();
    }

    // Delete/Backspace - Delete selected items
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      selectedItems().size > 0
    ) {
      event.preventDefault();
      confirmDeleteSelected();
    }
  };

  // ... rest of component
};
```

### 2. Display shortcuts in your UI

Show keyboard shortcuts near relevant buttons or actions:

```tsx
const getShortcutDisplay = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? '⌘N' : 'Ctrl+N';
};

<Button onClick={() => setShowAddModal(true)}>
  {t('medias.addMedia')}{' '}
  <span class="keyboard-hint">{getShortcutDisplay()}</span>
</Button>;
```

### 3. Add translations for shortcuts

Add shortcut descriptions to your addon's translation keys:

```json
{
  "medias": {
    "shortcuts": {
      "addMedia": "Add new media",
      "deleteMedia": "Delete selected media",
      "selectAll": "Select all media"
    }
  }
}
```

## Best Practices

### 1. **Don't Interfere with Global Shortcuts**

The following shortcuts are reserved for global navigation:

- `Cmd/Ctrl+F` - Global search
- `Cmd/Ctrl+/` - Show shortcuts legend
- `Cmd/Ctrl+Shift+P` - Go to Playlists
- `Cmd/Ctrl+Shift+M` - Go to Medias
- `Cmd/Ctrl+Shift+C` - Go to Channels
- `Cmd/Ctrl+Shift+O` - Go to Organization
- `Cmd/Ctrl+Shift+T` - Go to Teams
- `Cmd/Ctrl+Shift+D` - Go to Devices

### 2. **Use Consistent Shortcuts**

For common actions, use these standard shortcuts:

- `Cmd/Ctrl+N` - Add new resource
- `Cmd/Ctrl+A` - Select all items
- `Delete` or `Backspace` - Delete selected items
- `Cmd/Ctrl+K` - Local search/filter
- `Escape` - Close modal or blur input

### 3. **Check Permissions**

Always check if the user has permission before executing shortcut actions:

```tsx
const handleKeyDown = (event: KeyboardEvent) => {
  // ... other code ...

  // Only allow delete if user has delete permission
  if (event.key === 'Delete' && canPerformAction('medias', 'delete')) {
    event.preventDefault();
    confirmDeleteSelected();
  }
};
```

### 4. **Handle Platform Differences**

Always detect the platform and use the appropriate modifier key:

```tsx
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
```

### 5. **Prevent Default Browser Behavior**

Always call `preventDefault()` when handling shortcuts to prevent browser default actions:

```tsx
if (cmdOrCtrl && event.key === 'n') {
  event.preventDefault(); // Prevent browser's "New Window"
  setShowAddModal(true);
}
```

## Example: Complete Addon with Shortcuts

See `/packages/castmill/lib/castmill/addons/medias/components/index.tsx` for a complete example of an addon that could implement keyboard shortcuts following this pattern.

## Testing Shortcuts

When testing your addon:

1. Test on both macOS and Windows/Linux to ensure shortcuts work correctly
2. Test that shortcuts don't fire when typing in input fields
3. Test that shortcuts respect permission checks
4. Verify shortcuts are displayed correctly in your UI

## Future Enhancements

In the future, we may provide a centralized addon shortcut registration API that automatically:

- Registers shortcuts in the global shortcuts legend
- Handles platform detection automatically
- Provides automatic permission checking

For now, use the manual pattern described above.

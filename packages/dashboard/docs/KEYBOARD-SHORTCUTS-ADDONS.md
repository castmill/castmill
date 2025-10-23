# Keyboard Shortcuts for Addons

This guide explains how addon developers can register keyboard shortcuts for their addons in the Castmill Dashboard.

## Overview

The Dashboard provides a centralized keyboard shortcuts system through the `useKeyboardShortcuts` hook. The system:

- Automatically handles platform-specific shortcuts (macOS uses ⌘, Windows/Linux use Ctrl)
- Supports conditional shortcuts that are only active when certain conditions are met
- Displays shortcuts in a centralized shortcuts legend (Cmd/Ctrl+/)
- Hides shortcuts on mobile devices automatically
- Prevents shortcuts from triggering when user is typing in input fields

## Accessing the Keyboard Shortcuts System

Addons receive the keyboard shortcuts registry through the `store.keyboardShortcuts` prop. This allows addons to register and unregister their own shortcuts that will be displayed in the global shortcuts legend.

## Implementation Pattern

### 1. Register shortcuts in your addon component

```tsx
import { Component, onMount, onCleanup } from 'solid-js';
import { AddonComponentProps } from '../../common/interfaces/addon-store';

const MyAddonPage: Component<AddonComponentProps> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  // Your addon state and logic
  const [items, setItems] = createSignal([]);
  const [selectedItems, setSelectedItems] = createSignal<string[]>([]);

  const handleCreate = () => {
    // Your create logic
    console.log('Creating new resource');
  };

  const handleDelete = () => {
    // Your delete logic
    if (selectedItems().length > 0) {
      console.log('Deleting selected items:', selectedItems());
    }
  };

  const handleSelectAll = () => {
    // Your select all logic
    setSelectedItems(items().map((item) => item.id));
  };

  onMount(() => {
    const { registerShortcut } = props.store.keyboardShortcuts || {};

    if (registerShortcut) {
      // Register create shortcut - Ctrl+N
      registerShortcut('addon-create-resource', {
        key: 'N',
        ctrl: true,
        description: () => t('shortcuts.createResource'),
        category: 'actions',
        action: handleCreate,
        // Only active when on this addon's page
        condition: () => window.location.pathname.includes('/my-addon'),
      });

      // Register delete shortcut - Delete key
      registerShortcut('addon-delete-resources', {
        key: 'Delete',
        description: () => t('shortcuts.deleteSelected'),
        category: 'actions',
        action: handleDelete,
        condition: () => {
          return (
            window.location.pathname.includes('/my-addon') &&
            selectedItems().length > 0
          );
        },
      });

      // Register select all shortcut - Ctrl+A
      registerShortcut('addon-select-all', {
        key: 'A',
        ctrl: true,
        description: () => t('shortcuts.selectAll'),
        category: 'actions',
        action: handleSelectAll,
        condition: () => {
          return (
            window.location.pathname.includes('/my-addon') && items().length > 0
          );
        },
      });
    }
  });

  onCleanup(() => {
    const { unregisterShortcut } = props.store.keyboardShortcuts || {};

    if (unregisterShortcut) {
      unregisterShortcut('addon-create-resource');
      unregisterShortcut('addon-delete-resources');
      unregisterShortcut('addon-select-all');
    }
  });

  return <div>{/* Your addon UI */}</div>;
};

export default MyAddonPage;
```

### 2. Register shortcuts for table/list search

If your addon has a search feature in a table or list, register a shortcut for it:

```tsx
onMount(() => {
  const { registerShortcut } = props.store.keyboardShortcuts || {};

  if (registerShortcut) {
    registerShortcut('addon-search', {
      key: 'S',
      description: () => t('shortcuts.searchInPage'),
      category: 'actions',
      action: () => {
        // Focus your search input
        const searchInput = document.querySelector(
          '[data-search-input]'
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      condition: () => window.location.pathname.includes('/my-addon'),
    });
  }
});
```

**Best Practice:** Add a `data-search-input` attribute to your search input element instead of relying on class names or placeholders:

```tsx
<input
  type="text"
  data-search-input
  placeholder={t('common.search')}
  value={searchQuery()}
  onInput={(e) => setSearchQuery(e.currentTarget.value)}
/>
```

### 3. Register shortcuts for action buttons

For action buttons (create, add, upload, etc.), register the shortcut where the button logic lives:

```tsx
const CreateButton: Component<AddonComponentProps> = (props) => {
  const handleCreate = () => {
    // Your create logic
    setShowCreateModal(true);
  };

  onMount(() => {
    const { registerShortcut } = props.store.keyboardShortcuts || {};

    if (registerShortcut) {
      registerShortcut('addon-create', {
        key: 'C',
        description: () => t('shortcuts.create'),
        category: 'actions',
        action: handleCreate,
        condition: () => window.location.pathname.includes('/my-addon'),
      });
    }
  });

  onCleanup(() => {
    props.store.keyboardShortcuts?.unregisterShortcut('addon-create');
  });

  return (
    <button onClick={handleCreate} data-action-button="create">
      {t('common.create')}
    </button>
  );
};
```

**Best Practice:** Add a `data-action-button` attribute to identify action buttons semantically instead of relying on text content.
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

````

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
````

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

The following shortcuts are reserved for global navigation and actions:

- `Shift+?` - Show shortcuts legend
- `Cmd/Ctrl+F` - Global search
- `S` - Search in current page
- `Escape` - Close dialog / blur input
- `C` - Create resource (context-aware)
- `Cmd/Ctrl+P` - Go to Playlists
- `Cmd/Ctrl+M` - Go to Medias
- `Cmd/Ctrl+H` - Go to Channels
- `Cmd/Ctrl+O` - Go to Organization
- `Cmd/Ctrl+G` - Go to Teams
- `Cmd/Ctrl+D` - Go to Devices

### 2. **Use Consistent Shortcuts**

For common actions, use these standard shortcuts:

- `Cmd/Ctrl+N` - Add new resource (recommended for addons)
- `Cmd/Ctrl+A` - Select all items
- `Delete` or `Backspace` - Delete selected items
- `Escape` - Close modal or blur input (already handled globally)

**Note:** The global `C` key is reserved for context-aware resource creation. Addons should use `Cmd/Ctrl+N` for their add/create actions.

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

# Keyboard Shortcuts for Addons

This guide explains how addon developers can register keyboard shortcuts for their addons in the Castmill Dashboard.

## Overview

The Dashboard provides a centralized keyboard shortcuts system accessible to addons through the `store.keyboardShortcuts` prop. The system:

- Automatically handles platform-specific shortcuts (macOS uses ⌘, Windows/Linux use Ctrl)
- Supports conditional shortcuts that are only active when certain conditions are met
- Displays addon shortcuts in the centralized shortcuts legend (Shift+?)
- Hides shortcuts on mobile devices automatically
- Prevents shortcuts from triggering when user is typing in input fields
- **Dynamically registers navigation shortcuts from addon metadata**

## Addon Metadata-Based Navigation Shortcuts

**NEW**: Addons now declare their keyboard shortcuts in their metadata, and the Dashboard automatically registers them. This eliminates the need for manual shortcut registration in addon code for navigation.

### Declaring Shortcuts in Addon Metadata (Elixir)

In your addon's `.addon.ex` file, add a `keyboard_shortcut` field to the `ComponentInfo`:

```elixir
defmodule Castmill.Addons.Playlists do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "playlists",
      name: "Playlists",
      name_key: "sidebar.playlists",
      description: "Playlists view addon for Castmill",
      version: "0.1.0",
      path: "/playlists.js",
      mount_path: "/content/playlists",
      mount_point: "sidepanel.content.playlists",
      icon: "/playlists_icon.js",
      keyboard_shortcut: %{
        key: "P",
        description_key: "shortcuts.gotoPlaylists"
      }
    }
  end
end
```

### Adding TypeScript Interface (Already Done)

The `AddOn` interface in `packages/dashboard/src/interfaces/addon.interface.ts` already includes:

```typescript
export interface AddOn {
  // ... other fields ...
  keyboard_shortcut?: {
    key: string;
    description_key: string;
  };
}
```

### Translation Keys

Add the description key to all language files in `packages/dashboard/src/i18n/locales/`:

```json
{
  "shortcuts": {
    "gotoPlaylists": "Go to Playlists",
    "gotoMedias": "Go to Medias",
    "gotoWidgets": "Go to Widgets",
    "gotoDevices": "Go to Devices"
  }
}
```

**Important**: Navigation shortcuts are automatically registered as `Cmd/Ctrl+{key}` combinations.

## Accessing the Keyboard Shortcuts System

Addons receive the keyboard shortcuts registry through the `store.keyboardShortcuts` prop. This allows addons to register and unregister their own shortcuts that will be displayed in the global shortcuts legend.

## Implementation Pattern

### 1. Action Shortcuts (Create, Search, Delete)

Addons should register action shortcuts using the `registerShortcutAction` helper:

```tsx
import { Component, onMount } from 'solid-js';
import { AddonStore } from '../../common/interfaces/addon-store';
import { TableViewRef } from '@castmill/ui-common';

const WidgetsPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const [tableRef, setRef] = createSignal<TableViewRef<number, Widget>>();

  const openUploadModal = () => {
    setShowUploadModal(true);
  };

  const canPerformAction = (resource: string, action: string): boolean => {
    if (!props.store.permissions?.matrix) return false;
    const allowedActions = props.store.permissions.matrix[resource];
    return allowedActions?.includes(action) ?? false;
  };

  // Register keyboard shortcuts
  onMount(() => {
    if (props.store.keyboardShortcuts) {
      const { registerShortcutAction } = props.store.keyboardShortcuts;

      // C key - Create/Upload widget
      registerShortcutAction(
        'generic-create',
        () => {
          if (canPerformAction('widgets', 'create')) {
            openUploadModal();
          }
        },
        () => window.location.pathname.includes('/widgets')
      );

      // S key - Focus search
      registerShortcutAction(
        'generic-search',
        () => {
          const currentTableRef = tableRef();
          if (currentTableRef) {
            currentTableRef.focusSearch();
          }
        },
        () => window.location.pathname.includes('/widgets')
      );
    }
  });

  return (
    <div>
      <TableView
        ref={setRef}
        // ... other props
      />
    </div>
  );
};
```

**Key Points**:

- Use `registerShortcutAction` for generic actions (create, search, delete)
- Always check permissions before executing actions
- Use `tableViewRef.focusSearch()` for search functionality
- Condition shortcuts based on current pathname

### 2. Register action shortcuts in your addon component

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

### 1. **Navigation Shortcuts via Metadata**

Always declare navigation shortcuts in addon metadata rather than code:

✅ **Good** - Metadata-based (automatic registration):

```elixir
keyboard_shortcut: %{
  key: "I",
  description_key: "shortcuts.gotoWidgets"
}
```

❌ **Bad** - Manual registration (deprecated):

```tsx
registerShortcut('goto-widgets', { ... });
```

### 2. **Use Generic Action IDs**

For common actions, use the predefined generic action IDs:

- `generic-create` - For create/add/upload actions (C key)
- `generic-search` - For search/filter actions (S key)
- `generic-delete` - For delete actions (Delete key)

These automatically appear in the shortcuts legend with proper descriptions.

### 3. **Avoid Key Conflicts**

The following shortcuts are reserved globally:

- `Shift+?` - Show shortcuts legend
- `Cmd/Ctrl+F` - Global search
- `Escape` - Close dialog / blur input
- Navigation shortcuts defined in addon metadata (Cmd/Ctrl+key combinations)

For addon-specific actions, use simple keys (C, S, Delete) with context conditions.

### 4. **Use TableViewRef.focusSearch()**

For search functionality, use the TableView's built-in `focusSearch()` method:

✅ **Good**:

```tsx
tableRef()?.focusSearch();
```

❌ **Bad**:

```tsx
document.querySelector('.search-input')?.focus();
```

### 5. **Check Permissions**

Always check permissions before executing actions:

```tsx
registerShortcutAction(
  'generic-create',
  () => {
    if (canPerformAction('widgets', 'create')) {
      openUploadModal();
    }
  },
  () => window.location.pathname.includes('/widgets')
);
```

### 6. **Avoid Browser Conflicts**

Some key combinations conflict with browser shortcuts:

- ❌ `Cmd/Ctrl+W` - Closes browser tab/window
- ❌ `Cmd/Ctrl+N` - Opens new browser window
- ❌ `Cmd/Ctrl+T` - Opens new browser tab

Choose keys that don't conflict with common browser shortcuts.

## Example: Complete Addon Implementation

See `/packages/castmill/lib/castmill/addons/widgets/components/index.tsx` for a complete example showing:

- Metadata-based navigation shortcuts
- Action shortcuts using `registerShortcutAction`
- Permission checking
- TableView search integration

## Migrating from Manual Registration

If your addon manually registers navigation shortcuts, migrate to metadata-based approach:

**Before** (deprecated):

```tsx
onMount(() => {
  registerShortcut('goto-playlists', {
    key: 'P',
    ctrl: true,
    description: () => t('shortcuts.gotoPlaylists'),
    category: 'navigation',
    action: () => navigate(`/org/${orgId}/content/playlists`),
  });
});
```

**After** (recommended):

```elixir
# In playlists.addon.ex
keyboard_shortcut: %{
  key: "P",
  description_key: "shortcuts.gotoPlaylists"
}
```

The Dashboard automatically handles registration, navigation, and cleanup.

## Testing Shortcuts

When testing your addon:

1. ✅ Verify navigation shortcut appears in shortcuts legend (Shift+?)
2. ✅ Test that `Cmd/Ctrl+{key}` navigates to your addon page
3. ✅ Test action shortcuts (C, S, Delete) work when on your page
4. ✅ Test that shortcuts respect permission checks
5. ✅ Verify shortcuts don't fire when typing in input fields
6. ✅ Test on both macOS and Windows/Linux

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│ Elixir Backend (addon.ex)                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ComponentInfo with keyboard_shortcut metadata       │ │
│ │ - key: "P"                                          │ │
│ │ - description_key: "shortcuts.gotoPlaylists"        │ │
│ └─────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────┘
                   │ JSON API
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Dashboard (index.tsx / GlobalShortcuts)                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Automatically registers Cmd/Ctrl+{key} shortcuts    │ │
│ │ - Reads from store.addons[]                         │ │
│ │ - Creates navigation action                         │ │
│ │ - Adds to shortcuts legend                          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Addon Component (index.tsx)                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Registers action shortcuts via store.keyboardShortcuts│
│ │ - C key → openCreateModal()                         │ │
│ │ - S key → tableRef.focusSearch()                    │ │
│ │ - Delete key → deleteSelected()                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Future Enhancements

The current system provides:

- ✅ Metadata-based navigation shortcuts
- ✅ Generic action shortcuts (C, S, Delete)
- ✅ Automatic registration and cleanup
- ✅ Centralized shortcuts legend

Potential future improvements:

- Customizable shortcuts per user
- Shortcut conflict detection
- Visual shortcut hints in UI
- Addon-specific shortcut categories

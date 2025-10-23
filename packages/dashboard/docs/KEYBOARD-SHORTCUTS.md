# Keyboard Shortcuts

The Castmill Dashboard includes a comprehensive keyboard shortcuts system that enhances productivity by providing quick access to common actions and navigation.

## Features

- **Platform-Aware**: Automatically adapts shortcuts for macOS (⌘), Windows, and Linux (Ctrl)
- **Mobile-Friendly**: Shortcuts are automatically hidden on mobile devices
- **Internationalized**: All shortcut descriptions are fully localized in 9 languages
- **Contextual**: Shortcuts can be conditionally enabled based on current state
- **Centralized Legend**: View all available shortcuts with `Shift+?`

## Global Shortcuts

### Global Actions

- `Shift+?` - Show keyboard shortcuts legend
- `Cmd/Ctrl+F` - Global search
- `S` - Search in current page
- `Escape` - Close dialog / blur input field

### Navigation

- `Cmd/Ctrl+P` - Go to Playlists
- `Cmd/Ctrl+M` - Go to Medias
- `Cmd/Ctrl+H` - Go to Channels
- `Cmd/Ctrl+O` - Go to Organization
- `Cmd/Ctrl+G` - Go to Teams
- `Cmd/Ctrl+D` - Go to Devices

### Context Actions

- `C` - Create resource (context-aware: works in Playlists, Medias, Channels, Devices, Teams pages)

## Architecture

### Core Components

1. **KeyboardShortcutsProvider** (`src/hooks/useKeyboardShortcuts.tsx`)
   - Centralized shortcut management
   - Platform detection
   - Event handling and registration

2. **GlobalShortcuts** (`src/components/global-shortcuts/global-shortcuts.tsx`)
   - Registers global navigation shortcuts
   - Manages shortcuts legend modal

3. **ShortcutsLegend** (`src/components/shortcuts-legend/shortcuts-legend.tsx`)
   - Displays all registered shortcuts
   - Organized by category (Global, Navigation, Actions, Search)
   - Automatically hidden on mobile

### How It Works

1. The `KeyboardShortcutsProvider` wraps the entire application
2. Components register shortcuts using the `registerShortcut` function
3. The provider listens for keyboard events and triggers registered actions
4. Shortcuts are automatically formatted for the current platform
5. The shortcuts legend displays all registered shortcuts

### Shortcut Registration

```tsx
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

const MyComponent = () => {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const { t } = useI18n();

  onMount(() => {
    registerShortcut('my-action', {
      key: 'S',
      ctrl: true,
      description: () => t('shortcuts.myAction'), // Use function for reactive i18n
      category: 'actions',
      action: () => {
        // Perform action
      },
      condition: () => {
        // Optional: Return true if shortcut should be active
        return true;
      },
    });
  });

  onCleanup(() => {
    unregisterShortcut('my-action');
  });
};
```

## Addon Integration

Addons can implement their own keyboard shortcuts. See [KEYBOARD-SHORTCUTS-ADDONS.md](./KEYBOARD-SHORTCUTS-ADDONS.md) for detailed integration guide.

## Translations

All shortcut descriptions are localized in the following languages:

- English (en)
- Spanish (es)
- Swedish (sv)
- German (de)
- French (fr)
- Chinese (zh)
- Arabic (ar) - with RTL support
- Korean (ko)
- Japanese (ja)

Translation keys are located in `src/i18n/locales/{language}.json` under the `shortcuts` namespace.

## Best Practices

1. **Always check input focus**: Don't trigger shortcuts when user is typing
2. **Use platform detection**: Respect macOS vs Windows/Linux conventions
3. **Prevent default behavior**: Call `event.preventDefault()` to avoid browser conflicts
4. **Check permissions**: Verify user has permission before executing actions
5. **Provide visual hints**: Show shortcuts near buttons when appropriate
6. **Use standard shortcuts**: Follow established patterns for common actions

## Testing

Run the test suite:

```bash
yarn test
```

The keyboard shortcuts system includes unit tests for:

- Platform detection
- Shortcut registration/unregistration
- Event handling
- Conditional shortcuts

## Future Enhancements

Potential improvements for future releases:

1. **Customizable Shortcuts**: Allow users to customize keyboard shortcuts
2. **Shortcut Conflicts**: Detect and warn about conflicting shortcuts
3. **Recording UI**: Visual interface for recording custom shortcuts
4. **Addon API**: Centralized API for addon shortcut registration
5. **Analytics**: Track which shortcuts are most used

## Browser Compatibility

The keyboard shortcuts system works in all modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Mobile browsers automatically hide shortcuts as they're not applicable.

# Toast Notification Component

A modern, accessible toast notification system for SolidJS applications with dark mode optimization.

## Features

- 🎨 **Modern Design**: Sleek gradient backgrounds optimized for dark mode
- 🎯 **Multiple Variants**: Support for success, error, info, and warning notifications
- ⏱️ **Auto-dismiss**: Configurable duration with manual close option
- 🔔 **Stacked Display**: Multiple toasts stack elegantly in the top-right corner
- 📱 **Responsive**: Adapts to mobile and desktop layouts
- ♿ **Accessible**: ARIA-compliant with role="alert" for screen readers
- ✨ **Smooth Animations**: Slide-in/slide-out transitions

## Installation

The Toast component is part of `@castmill/ui-common` package and is already included.

## Basic Usage

### 1. Wrap Your App with ToastProvider

```tsx
import { ToastProvider } from '@castmill/ui-common';

function App() {
  return (
    <ToastProvider>
      {/* Your app content */}
    </ToastProvider>
  );
}
```

### 2. Use the useToast Hook in Components

```tsx
import { useToast } from '@castmill/ui-common';
import { Component } from 'solid-js';

const MyComponent: Component = () => {
  const toast = useToast();

  const handleSuccess = () => {
    toast.success('Operation completed successfully!');
  };

  const handleError = () => {
    toast.error('Something went wrong!');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
    </div>
  );
};
```

## API Reference

### ToastProvider

A context provider that manages toast state globally.

**Props:**
- `children`: JSX.Element - The app content to wrap

### useToast Hook

Returns an object with methods to show and manage toasts.

**Returns:**
```typescript
{
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
}
```

### Toast Types

```typescript
type ToastType = 'success' | 'error' | 'info' | 'warning';
```

## Convenience Methods

### success(message, duration?)
Shows a success toast with a green theme.

```tsx
toast.success('Profile updated successfully');
toast.success('Changes saved', 3000); // Custom duration
```

### error(message, duration?)
Shows an error toast with a red theme.

```tsx
toast.error('Failed to save changes');
toast.error('Network error occurred', 5000);
```

### info(message, duration?)
Shows an info toast with a blue theme.

```tsx
toast.info('New features available');
toast.info('Check your email for confirmation');
```

### warning(message, duration?)
Shows a warning toast with an orange theme.

```tsx
toast.warning('This action cannot be undone');
toast.warning('Low disk space detected');
```

## Advanced Usage

### Custom Duration

```tsx
// Show toast for 10 seconds
toast.success('Long message here', 10000);

// Prevent auto-dismiss (duration = 0)
const toastId = toast.error('Critical error - requires action', 0);

// Later, manually close it
toast.removeToast(toastId);
```

### Managing Toast ID

All toast methods return a unique ID that can be used to manually remove the toast:

```tsx
const toastId = toast.info('Processing...');

// Later, when processing completes
setTimeout(() => {
  toast.removeToast(toastId);
  toast.success('Processing complete!');
}, 3000);
```

### Generic showToast Method

```tsx
// Explicit type and duration
toast.showToast('Custom message', 'warning', 7000);
```

## Styling

The Toast component uses CSS Modules and includes:

- **Gradient backgrounds** for visual appeal
- **Left border accent** for type indication
- **Backdrop filter blur** for modern glass effect
- **Smooth slide animations** for enter/exit
- **Responsive sizing** for mobile devices

### Default Durations

- Success: 5 seconds
- Error: 5 seconds
- Info: 5 seconds
- Warning: 5 seconds

### Position

Toasts appear in the **top-right corner** on desktop and adapt to **full-width** on mobile devices (max-width: 768px).

## Accessibility

- Uses `role="alert"` for screen reader announcements
- Keyboard accessible close button
- Color-coded with icons for visual distinction
- High contrast text for readability

## Examples in Castmill Dashboard

### After API Success
```tsx
try {
  await TeamsService.addTeam(organizationId, teamName);
  toast.success(`Team ${teamName} created successfully`);
  refreshData();
} catch (error) {
  toast.error(`Error creating team: ${error}`);
}
```

### Form Validation
```tsx
const onSubmit = async (data) => {
  if (!isValid) {
    toast.warning('Please fill all required fields');
    return;
  }
  
  try {
    await saveData(data);
    toast.success('Data saved successfully');
  } catch (error) {
    toast.error('Failed to save data');
  }
};
```

### Multiple Operations
```tsx
const deleteMultiple = async (ids) => {
  try {
    await Promise.all(ids.map(id => deleteItem(id)));
    toast.success(`${ids.length} items deleted successfully`);
  } catch (error) {
    toast.error('Failed to delete some items');
  }
};
```

## Testing

The Toast component includes comprehensive tests covering:
- Rendering with different types
- Auto-dismiss functionality
- Manual close
- Multiple toasts
- Toast provider context
- Unique ID generation

See `toast.test.tsx` and `toast-provider.test.tsx` for test examples.

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid/Flexbox
- CSS Transitions
- Portal rendering

## Migration from alert()

### Before
```tsx
try {
  await someOperation();
  // No feedback
} catch (error) {
  alert(error.message); // Blocks UI, poor UX
}
```

### After
```tsx
const toast = useToast();

try {
  await someOperation();
  toast.success('Operation completed!'); // Non-blocking, good UX
} catch (error) {
  toast.error(error.message); // Non-blocking, styled
}
```

## License

AGPL-3.0-or-later

# Permissions System - Frontend Integration Guide

## Overview

The Dashboard now includes a complete permissions system that automatically disables UI actions based on user roles and permissions. This prevents users from attempting actions they don't have permission to perform.

## Key Features

- **Automatic Permission Loading**: Permissions are loaded when the user selects an organization
- **Permission-Aware Components**: Buttons and actions automatically disable based on permissions
- **Visual Feedback**: Disabled actions remain visible but are clearly disabled (not hidden)
- **Role-Based Access Control**: Supports admin, manager, regular, and guest roles

## Architecture

### Services

**`permissions.service.ts`**: Core service for fetching and checking permissions

- `fetchPermissions(organizationId)`: Fetches permissions from the backend
- `canPerformAction(permissions, resource, action)`: Checks if an action is allowed
- `getAllowedActions(permissions, resource)`: Gets all allowed actions for a resource

### Store

Permissions are stored globally in the application store:

```typescript
store.permissions = {
  loaded: boolean;          // Whether permissions have been loaded
  loading: boolean;         // Whether permissions are currently loading
  role?: Role;             // User's role in the current organization
  matrix?: Record<ResourceType, Action[]>; // Permission matrix
}
```

### Hook

**`usePermissions()`**: Main hook for checking permissions

```typescript
const {
  canPerformAction, // Check if action is allowed
  getAllowedActions, // Get all allowed actions for a resource
  hasRole, // Check if user has specific role
  hasAnyRole, // Check if user has any of specified roles
  getUserRole, // Get current user's role
  isLoaded, // Check if permissions are loaded
  isLoading, // Check if permissions are loading
} = usePermissions();
```

## Usage Examples

### 1. Basic Permission Check

```typescript
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const { canPerformAction } = usePermissions();

  const canCreateTeam = () => canPerformAction('teams', 'create');

  return (
    <div>
      <Button
        label="Create Team"
        disabled={!canCreateTeam()}
        onClick={handleCreateTeam}
      />
    </div>
  );
}
```

### 2. Using PermissionButton Component

The `PermissionButton` component automatically handles permission checking:

```typescript
import { PermissionButton } from '../components/permission-button/permission-button';

function TeamsPage() {
  return (
    <div>
      {/* Button is automatically disabled if user can't create teams */}
      <PermissionButton
        resource="teams"
        action="create"
        label="Create Team"
        icon={FiPlus}
        onClick={handleCreateTeam}
      />

      {/* Button can be force-disabled for other reasons */}
      <PermissionButton
        resource="playlists"
        action="delete"
        label="Delete"
        icon={FiTrash}
        onClick={handleDelete}
        forceDisabled={!selectedItem}
        color="danger"
      />
    </div>
  );
}
```

### 3. Conditional Rendering Based on Role

```typescript
import { usePermissions } from '../hooks/usePermissions';
import { Show } from 'solid-js';

function AdminPanel() {
  const { hasRole, hasAnyRole } = usePermissions();

  return (
    <div>
      {/* Show only to admins */}
      <Show when={hasRole('admin')}>
        <Button label="Admin Settings" />
      </Show>

      {/* Show to admins and managers */}
      <Show when={hasAnyRole(['admin', 'manager'])}>
        <Button label="Manage Users" />
      </Show>
    </div>
  );
}
```

### 4. Table Actions with Permissions

```typescript
import { usePermissions } from '../hooks/usePermissions';
import { TableView, Column } from '@castmill/ui-common';

function PlaylistsTable() {
  const { canPerformAction } = usePermissions();

  const columns: Column[] = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'created', title: 'Created', sortable: true },
    {
      key: 'actions',
      title: 'Actions',
      render: (item: Playlist) => (
        <div>
          <PermissionButton
            resource="playlists"
            action="update"
            label="Edit"
            icon={FiEdit}
            onClick={() => handleEdit(item)}
          />
          <PermissionButton
            resource="playlists"
            action="delete"
            label="Delete"
            icon={FiTrash}
            onClick={() => handleDelete(item)}
            color="danger"
          />
        </div>
      )
    }
  ];

  return <TableView columns={columns} data={playlists} />;
}
```

### 5. Checking Multiple Actions

```typescript
function ResourceActions() {
  const { getAllowedActions } = usePermissions();

  const playlistActions = getAllowedActions('playlists');
  // Returns: ['list', 'show', 'create', 'update', 'delete'] for admins
  // Returns: ['list', 'show', 'create', 'update', 'delete'] for regular users
  // Returns: ['list', 'show'] for guests

  const canModify = () =>
    playlistActions.includes('update') ||
    playlistActions.includes('delete');

  return (
    <Show when={canModify()}>
      <div>Modify Actions Available</div>
    </Show>
  );
}
```

### 6. Form Submit Buttons

```typescript
function TeamForm() {
  const { canPerformAction } = usePermissions();

  const isNewTeam = () => !team().id;
  const requiredAction = () => isNewTeam() ? 'create' : 'update';

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />

      <PermissionButton
        resource="teams"
        action={requiredAction()}
        type="submit"
        label={isNewTeam() ? 'Create' : 'Save'}
      />
    </form>
  );
}
```

## Permission Matrix

The current permission matrix (defined in the backend):

| Role    | Playlists | Medias    | Channels  | Devices   | Teams     | Widgets   |
| ------- | --------- | --------- | --------- | --------- | --------- | --------- |
| Admin   | Full      | Full      | Full      | Full      | Full      | Full      |
| Manager | Full      | Full      | Full      | Full      | Full      | Full      |
| Regular | Full      | Full      | Full      | Full      | Read-only | Read-only |
| Guest   | Read-only | Read-only | Read-only | Read-only | No access | Read-only |

**Actions**:

- Full = `list`, `show`, `create`, `update`, `delete`
- Read-only = `list`, `show`
- No access = `[]`

## Best Practices

### 1. Always Disable, Never Hide

**❌ Don't hide actions:**

```typescript
// BAD: User can't see what features exist
<Show when={canPerformAction('teams', 'create')}>
  <Button label="Create Team" />
</Show>
```

**✅ Disable actions instead:**

```typescript
// GOOD: User sees the action but understands they can't use it
<PermissionButton
  resource="teams"
  action="create"
  label="Create Team"
/>
```

### 2. Combine with Other Disabled States

```typescript
<PermissionButton
  resource="playlists"
  action="delete"
  label="Delete"
  forceDisabled={!selectedItem() || isDeleting()}
/>
```

### 3. Check Permissions Before API Calls

Always verify permissions before making API calls (backend also validates):

```typescript
async function handleDelete(item: Playlist) {
  if (!canPerformAction('playlists', 'delete')) {
    toast.error('You don't have permission to delete playlists');
    return;
  }

  // Proceed with deletion
  await PlaylistsService.delete(item.id);
}
```

### 4. Handle Loading States

```typescript
const { isLoaded, isLoading } = usePermissions();

<Show when={isLoaded()} fallback={<LoadingSpinner />}>
  <PermissionButton resource="teams" action="create" label="Create" />
</Show>
```

## Addon Components

Addon components receive permissions through the store prop:

```typescript
import { AddonStore } from '../../common/interfaces/addon-store';

const TeamsAddon: Component<{ store: AddonStore }> = (props) => {
  // Check permissions from store
  const canCreate = () => {
    const permissions = props.store.permissions?.matrix;
    if (!permissions || !permissions.teams) return false;
    return permissions.teams.includes('create');
  };

  return (
    <Button
      label="Create Team"
      disabled={!canCreate()}
      onClick={handleCreate}
    />
  );
};
```

## Internationalization

Add permission-related translation keys:

**`src/i18n/locales/en.json`:**

```json
{
  "permissions": {
    "noPermission": "You don't have permission to {{action}} {{resource}}",
    "insufficientRole": "This action requires {{role}} role or higher",
    "contactAdmin": "Contact your administrator to request access"
  }
}
```

## Troubleshooting

### Permissions Not Loading

1. Check browser console for errors
2. Verify organization is selected: `store.organizations.selectedId`
3. Check permissions endpoint is responding: `/dashboard/organizations/:id/permissions`
4. Verify user has a role in the organization

### Button Still Enabled When It Shouldn't Be

1. Verify you're using `PermissionButton` or manually checking permissions
2. Check the permission matrix in the backend matches expectations
3. Verify the resource and action names are correct
4. Check browser DevTools to inspect `store.permissions.matrix`

### Permissions Not Updating on Organization Change

Permissions should automatically reload when organization changes. If not:

1. Check the `createEffect` in `ProtectedRoute` is running
2. Verify `store.organizations.selectedId` is updating
3. Check for JavaScript errors preventing the effect from running

## API Reference

### Types

```typescript
type Role = 'admin' | 'manager' | 'regular' | 'guest';
type ResourceType =
  | 'playlists'
  | 'medias'
  | 'channels'
  | 'devices'
  | 'teams'
  | 'widgets';
type Action = 'list' | 'show' | 'create' | 'update' | 'delete';
```

### PermissionButton Props

```typescript
interface PermissionButtonProps {
  resource: ResourceType; // Required: Resource type
  action: Action; // Required: Action to perform
  forceDisabled?: boolean; // Optional: Force disable regardless of permissions
  // ...all standard Button props (label, icon, onClick, etc.)
}
```

## Testing

When testing components with permissions:

```typescript
import { setStore } from '../store';

// Mock permissions for testing
setStore('permissions', {
  loaded: true,
  loading: false,
  role: 'regular',
  matrix: {
    playlists: ['list', 'show', 'create', 'update', 'delete'],
    teams: ['list', 'show'], // read-only
    // ...
  },
});
```

## Next Steps

1. **Integrate into existing pages**: Update all CRUD pages to use `PermissionButton`
2. **Add tooltips**: Enhance disabled buttons with explanatory tooltips
3. **Localize messages**: Add permission-related i18n keys
4. **Test across roles**: Test each page as admin, manager, regular, and guest
5. **Update documentation**: Keep this guide updated as permissions evolve

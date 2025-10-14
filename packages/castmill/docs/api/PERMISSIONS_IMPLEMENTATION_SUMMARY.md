# Permissions System - Implementation Summary

## What Was Done

We've successfully integrated a comprehensive permissions system into the Castmill Dashboard that:

1. **Automatically loads permissions** when users select an organization
2. **Disables (not hides) UI actions** that users don't have permission to perform
3. **Provides visual feedback** through disabled buttons showing all available features
4. **Works seamlessly with addons** through the shared store

## Files Created/Modified

### Backend (Already Complete ✅)

- Permission matrix in `lib/castmill/authorization/permissions.ex`
- Permissions endpoint in `lib/castmill_web/controllers/permissions_controller.ex`
- GET `/dashboard/organizations/:organization_id/permissions`

### Frontend (Dashboard Package)

#### New Files:

1. **`src/services/permissions.service.ts`** - Core permissions service
   - `fetchPermissions()` - Fetches permissions from backend
   - `canPerformAction()` - Checks if action is allowed
   - `getAllowedActions()` - Gets all allowed actions for a resource

2. **`src/hooks/usePermissions.ts`** - React hook for permissions
   - Provides easy access to permission checking throughout the app
   - Methods: `canPerformAction`, `getAllowedActions`, `hasRole`, `hasAnyRole`

3. **`src/components/permission-button/permission-button.tsx`** - Permission-aware button
   - Automatically disables based on permissions
   - Drop-in replacement for regular Button component

4. **`PERMISSIONS_FRONTEND_GUIDE.md`** - Complete usage documentation
   - Examples for all use cases
   - Best practices
   - Troubleshooting guide

5. **`PERMISSIONS_ADDON_EXAMPLE.tsx`** - Example addon implementation
   - Shows how to use permissions in addon components
   - Complete working example with CRUD operations

#### Modified Files:

1. **`src/store/store.tsx`** - Added permissions to global store

   ```typescript
   permissions: {
     loaded: boolean;
     loading: boolean;
     role?: Role;
     matrix?: Record<ResourceType, Action[]>;
   }
   ```

2. **`src/components/protected-route.tsx`** - Auto-loads permissions
   - Added effect to load permissions when organization changes
   - Permissions available throughout the app via store

3. **`packages/castmill/lib/castmill/addons/common/interfaces/addon-store.ts`**
   - Added permissions types and interface
   - Addons now receive permissions through store prop

## How It Works

### 1. Permission Loading Flow

```
User logs in → Selects organization → ProtectedRoute loads permissions → Store updated → UI reflects permissions
```

### 2. Permission Checking

```typescript
// In any component:
const { canPerformAction } = usePermissions();

const canCreateTeam = () => canPerformAction('teams', 'create');
// Returns: true for admin/manager, false for regular/guest
```

### 3. UI Disabling (Not Hiding!)

```typescript
// Button is visible but disabled if no permission
<PermissionButton
  resource="teams"
  action="create"
  label="Create Team"
  onClick={handleCreate}
/>
```

## Permission Matrix

| Role    | Playlists    | Medias       | Channels     | Devices      | Teams        | Widgets      |
| ------- | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ |
| Admin   | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      |
| Manager | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      |
| Regular | ✅ Full      | ✅ Full      | ✅ Full      | ✅ Full      | 👁️ Read-only | 👁️ Read-only |
| Guest   | 👁️ Read-only | 👁️ Read-only | 👁️ Read-only | 👁️ Read-only | ❌ No access | 👁️ Read-only |

**Actions**:

- ✅ Full = `list`, `show`, `create`, `update`, `delete`
- 👁️ Read-only = `list`, `show`
- ❌ No access = `[]`

## Usage Examples

### Basic Button with Permissions

```typescript
import { PermissionButton } from './components/permission-button/permission-button';

<PermissionButton
  resource="teams"
  action="create"
  label="Create Team"
  icon={FiPlus}
  onClick={handleCreateTeam}
/>
```

### Manual Permission Check

```typescript
import { usePermissions } from './hooks/usePermissions';

const { canPerformAction } = usePermissions();

if (!canPerformAction('teams', 'delete')) {
  toast.error('You don't have permission to delete teams');
  return;
}
```

### In Addon Components

```typescript
// Addon components receive permissions through store prop
const TeamsAddon: Component<{ store: AddonStore }> = (props) => {
  const canCreate = () => {
    const permissions = props.store.permissions?.matrix;
    return permissions?.teams?.includes('create') || false;
  };

  return (
    <Button
      label="Create"
      disabled={!canCreate()}
      onClick={handleCreate}
    />
  );
};
```

## Design Philosophy

### ✅ DO: Disable, Don't Hide

- Users can see all features
- Clear visual feedback on what's available
- Users understand the full capabilities of the system
- Encourages users to upgrade roles if needed

### ❌ DON'T: Hide Features

- Hidden features create confusion
- Users don't know what they're missing
- Harder to upsell or explain role differences

## Next Steps for Integration

### 1. Update Existing Pages (High Priority)

Update these pages to use `PermissionButton`:

- [ ] Teams page - Create, Edit, Delete buttons
- [ ] Playlists page - CRUD operations
- [ ] Medias page - Upload, Edit, Delete
- [ ] Channels page - CRUD operations
- [ ] Devices page - Add, Edit, Delete
- [ ] Widgets page - Create, Edit, Delete

### 2. Add Translation Keys (Medium Priority)

Add to `src/i18n/locales/*.json`:

```json
{
  "permissions": {
    "noPermission": "You don't have permission to {{action}} {{resource}}",
    "contactAdmin": "Contact your administrator to request access",
    "insufficientRole": "This action requires {{role}} role",
    "noCreateTeams": "You don't have permission to create teams",
    "noUpdateTeams": "You don't have permission to edit teams",
    "noDeleteTeams": "You don't have permission to delete teams"
  }
}
```

### 3. Testing (High Priority)

Test each page as different roles:

- [ ] Admin user - All actions enabled
- [ ] Manager user - All actions enabled
- [ ] Regular user - Teams read-only, content full access
- [ ] Guest user - Everything read-only

### 4. Enhanced UI (Low Priority)

- Add tooltips explaining why buttons are disabled
- Add role badge in user menu
- Create permissions overview page for users
- Add "Request Access" functionality

## API Integration

The frontend automatically calls:

```
GET /dashboard/organizations/:id/permissions
```

Response format:

```json
{
  "role": "regular",
  "permissions": {
    "playlists": ["list", "show", "create", "update", "delete"],
    "medias": ["list", "show", "create", "update", "delete"],
    "channels": ["list", "show", "create", "update", "delete"],
    "devices": ["list", "show", "create", "update", "delete"],
    "teams": ["list", "show"],
    "widgets": ["list", "show"]
  },
  "resources": [
    "playlists",
    "medias",
    "channels",
    "devices",
    "teams",
    "widgets"
  ]
}
```

## Browser DevTools Debugging

Check permissions in browser console:

```javascript
// In browser DevTools console:
window.store = require('./store').store;

// View current permissions
console.log(window.store.permissions);

// Check specific permission
console.log(window.store.permissions.matrix.teams);
// Expected for regular user: ["list", "show"]
```

## Benefits

1. **Security**: Backend validates all actions, frontend just provides UX
2. **Consistency**: Same permission logic across entire app
3. **Maintainability**: Change permissions in one place (backend matrix)
4. **User Experience**: Clear feedback, no confusion about capabilities
5. **Scalability**: Easy to add new resources and roles
6. **Testing**: Easy to test different permission scenarios

## Limitations & Future Enhancements

### Current Limitations:

- Permissions are per-organization (not per-resource instance)
- No field-level permissions
- No time-based permissions
- No delegation or temporary permissions

### Future Enhancements:

- Resource-level permissions (e.g., "can edit THIS playlist")
- Team-based permissions (permissions through team membership)
- Delegation (admins temporarily grant permissions)
- Permission history/audit log
- Request access workflow
- Custom roles

## Support & Documentation

- **Frontend Guide**: `packages/dashboard/PERMISSIONS_FRONTEND_GUIDE.md`
- **Backend Guide**: `packages/castmill/PERMISSIONS_ENDPOINT_GUIDE.md`
- **Addon Example**: `packages/dashboard/PERMISSIONS_ADDON_EXAMPLE.tsx`
- **Test Suite**: `packages/castmill/test/castmill_web/controllers/permissions_controller_test.exs`

## Troubleshooting Quick Reference

**Problem**: Buttons not disabling

- Check `store.permissions.loaded` is `true`
- Verify `store.permissions.matrix` contains expected permissions
- Ensure you're using `PermissionButton` or manual checks

**Problem**: Permissions not loading

- Check browser console for errors
- Verify backend endpoint is responding
- Check organization is selected in store

**Problem**: Wrong permissions showing

- Verify user's role in database
- Check backend permission matrix
- Clear browser cache and reload

## Conclusion

The permissions system is now fully integrated and ready to use. The next step is to systematically update all CRUD pages to use `PermissionButton` components, ensuring that all users see available features but can only use those they have permission for.

This creates a transparent, user-friendly experience while maintaining security and proper access control.

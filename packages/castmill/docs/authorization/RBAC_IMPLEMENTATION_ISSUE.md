# Implement Role-Based Access Control (RBAC) for Dashboard

## 📋 Overview

Currently, users with different roles (admin, regular, guest) can see all navigation items in the Dashboard, but attempting to access resources they don't have permission for results in 403 Forbidden errors. While we've implemented graceful error handling (showing a user-friendly "Access Restricted" message), we need a complete RBAC system that:

1. Hides navigation items users don't have permission to access
2. Prevents unauthorized route access
3. Provides clear role-based UI rendering
4. Maintains good UX with appropriate feedback

## 🎯 Goals

- **Improve UX**: Users should only see features they can access
- **Reduce confusion**: No more trying to access forbidden resources
- **Security**: Proper authorization checks on both client and server
- **Maintainability**: Clear permission system that's easy to extend

## 🔍 Current State

### What Works ✅
- Backend enforces permissions (returns 403 for unauthorized access)
- Error handling shows user-friendly message for 403 errors (see #XXX)
- Role system exists for organization members (admin, regular, guest)
- URL-based routing with organization context

### What's Missing ❌
- Organization interface doesn't include user's role
- No permission checking before rendering UI elements
- All navigation items visible regardless of permissions
- No role-based route guards

## 🏗️ Proposed Implementation

### Phase 1: Backend API Enhancement

#### 1.1 Add Role to Organizations Endpoint
**File**: `packages/castmill/lib/castmill_web/controllers/dashboard/organization_controller.ex`

Update the organizations list endpoint to include the user's role:

```elixir
# GET /dashboard/users/:user_id/organizations
# Response should include user's role per organization
[
  {
    "id": "org-123",
    "name": "Acme Corp",
    "role": "admin",  # <-- Add this field
    "created_at": "2024-01-01T00:00:00Z",
    ...
  },
  {
    "id": "org-456", 
    "name": "Widget Co",
    "role": "regular",  # <-- User's role in this org
    "created_at": "2024-01-01T00:00:00Z",
    ...
  }
]
```

#### 1.2 Document Permission Matrix
Create a clear mapping of what each role can access:

```
| Resource      | Admin | Regular | Guest |
|---------------|-------|---------|-------|
| Playlists     | ✓     | ✗       | ✗     |
| Medias        | ✓     | ✗       | ✗     |
| Widgets       | ✓     | ✗       | ✗     |
| Devices       | ✓     | ✓       | ✗     |
| Channels      | ✓     | ✓       | ✗     |
| Teams         | ✓     | ✗       | ✗     |
| Settings      | ✓     | ✗       | ✗     |
| Usage         | ✓     | ✓       | ✓     |
```

**Note**: This matrix should be defined based on product requirements. The above is an example.

### Phase 2: Frontend Type & Interface Updates

#### 2.1 Update Organization Interface
**File**: `packages/dashboard/src/interfaces/organization.ts`

```typescript
export type OrganizationRole = 'admin' | 'regular' | 'guest';

export interface Organization {
  id: string;
  name: string;
  role: OrganizationRole;  // <-- Add this
  created_at: string;
  updated_at: string;
}
```

#### 2.2 Create Permission System
**File**: `packages/dashboard/src/utils/permissions.ts` (new file)

```typescript
import { OrganizationRole } from '../interfaces/organization';

export type Resource = 
  | 'playlists' 
  | 'medias' 
  | 'widgets' 
  | 'devices' 
  | 'channels' 
  | 'teams' 
  | 'settings' 
  | 'usage';

export type Permission = 'read' | 'write' | 'delete';

/**
 * Permission matrix mapping roles to resources
 */
const PERMISSIONS: Record<OrganizationRole, Record<Resource, Permission[]>> = {
  admin: {
    playlists: ['read', 'write', 'delete'],
    medias: ['read', 'write', 'delete'],
    widgets: ['read', 'write', 'delete'],
    devices: ['read', 'write', 'delete'],
    channels: ['read', 'write', 'delete'],
    teams: ['read', 'write', 'delete'],
    settings: ['read', 'write', 'delete'],
    usage: ['read'],
  },
  regular: {
    playlists: [],
    medias: [],
    widgets: [],
    devices: ['read'],
    channels: ['read'],
    teams: [],
    settings: [],
    usage: ['read'],
  },
  guest: {
    playlists: [],
    medias: [],
    widgets: [],
    devices: [],
    channels: [],
    teams: [],
    settings: [],
    usage: ['read'],
  },
};

/**
 * Check if a role has permission to access a resource
 */
export function hasPermission(
  role: OrganizationRole,
  resource: Resource,
  permission: Permission = 'read'
): boolean {
  const resourcePermissions = PERMISSIONS[role]?.[resource] || [];
  return resourcePermissions.includes(permission);
}

/**
 * Check if a role can access a resource at all (any permission)
 */
export function canAccess(
  role: OrganizationRole,
  resource: Resource
): boolean {
  const resourcePermissions = PERMISSIONS[role]?.[resource] || [];
  return resourcePermissions.length > 0;
}

/**
 * Get all resources a role can access
 */
export function getAccessibleResources(
  role: OrganizationRole
): Resource[] {
  return Object.entries(PERMISSIONS[role])
    .filter(([_, permissions]) => permissions.length > 0)
    .map(([resource]) => resource as Resource);
}
```

### Phase 3: UI Implementation

#### 3.1 Update Store to Include Role
**File**: `packages/dashboard/src/store/store.ts`

Ensure the store properly tracks the current organization's role:

```typescript
interface CastmillStore {
  organizations: {
    selectedId: string | null;
    selectedName: string;
    selectedRole: OrganizationRole | null;  // <-- Add this
    data: Organization[];
    loaded: boolean;
  };
  // ... rest of store
}
```

Update in `ProtectedRoute` when organization changes:

```typescript
createEffect(() => {
  const urlOrgId = params.orgId;
  if (urlOrgId && urlOrgId !== store.organizations.selectedId) {
    const org = store.organizations.data.find(o => o.id === urlOrgId);
    if (org) {
      setStore('organizations', {
        selectedId: org.id,
        selectedName: org.name,
        selectedRole: org.role,  // <-- Update role
      });
    }
  }
});
```

#### 3.2 Create Permission Guard Component
**File**: `packages/dashboard/src/components/permission-guard/permission-guard.tsx` (new file)

```typescript
import { Component, Show } from 'solid-js';
import { useStore } from '../../store/store-provider';
import { canAccess, Resource } from '../../utils/permissions';

interface PermissionGuardProps {
  resource: Resource;
  children: any;
  fallback?: any;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export const PermissionGuard: Component<PermissionGuardProps> = (props) => {
  const { store } = useStore();
  
  const hasAccess = () => {
    const role = store.organizations.selectedRole;
    if (!role) return false;
    return canAccess(role, props.resource);
  };

  return (
    <Show when={hasAccess()} fallback={props.fallback}>
      {props.children}
    </Show>
  );
};
```

#### 3.3 Update Sidebar Navigation
**File**: `packages/dashboard/src/components/sidebar/sidebar.tsx`

Wrap navigation items with `PermissionGuard`:

```tsx
import { PermissionGuard } from '../permission-guard/permission-guard';

// Inside sidebar render:
<PermissionGuard resource="playlists">
  <SidebarItem 
    href={`/org/${orgId}/content/playlists`}
    icon={BsCollectionPlay}
    label={t('sidebar.playlists')}
  />
</PermissionGuard>

<PermissionGuard resource="medias">
  <SidebarItem 
    href={`/org/${orgId}/content/medias`}
    icon={BsImages}
    label={t('sidebar.medias')}
  />
</PermissionGuard>

<PermissionGuard resource="widgets">
  <SidebarItem 
    href={`/org/${orgId}/content/widgets`}
    icon={BsGrid3x3Gap}
    label={t('sidebar.widgets')}
  />
</PermissionGuard>

<PermissionGuard resource="devices">
  <SidebarItem 
    href={`/org/${orgId}/devices`}
    icon={BsDisplay}
    label={t('sidebar.devices')}
  />
</PermissionGuard>

<PermissionGuard resource="channels">
  <SidebarItem 
    href={`/org/${orgId}/channels`}
    icon={BsBroadcast}
    label={t('sidebar.channels')}
  />
</PermissionGuard>

<PermissionGuard resource="teams">
  <SidebarItem 
    href={`/org/${orgId}/teams`}
    icon={BsPeople}
    label={t('sidebar.teams')}
  />
</PermissionGuard>

<PermissionGuard resource="settings">
  <SidebarItem 
    href={`/org/${orgId}/settings`}
    icon={BsGear}
    label={t('sidebar.settings')}
  />
</PermissionGuard>

{/* Usage is always visible */}
<SidebarItem 
  href={`/org/${orgId}/usage`}
  icon={BsBarChart}
  label={t('sidebar.usage')}
/>
```

#### 3.4 Add Route Guards
**File**: `packages/dashboard/src/pages/protected-route.tsx`

Add permission checking to routes:

```tsx
import { canAccess } from '../utils/permissions';
import { PermissionDenied } from '@castmill/ui-common';

// Inside ProtectedRoute component:
const checkRoutePermission = () => {
  const role = store.organizations.selectedRole;
  if (!role) return false;

  const path = location.pathname;
  
  // Map routes to resources
  const routeResourceMap: Record<string, Resource> = {
    '/content/playlists': 'playlists',
    '/content/medias': 'medias',
    '/content/widgets': 'widgets',
    '/devices': 'devices',
    '/channels': 'channels',
    '/teams': 'teams',
    '/settings': 'settings',
  };

  // Find which resource this route maps to
  const resource = Object.entries(routeResourceMap).find(([route]) =>
    path.includes(route)
  )?.[1];

  // If no resource mapping, allow access (e.g., usage, home)
  if (!resource) return true;

  return canAccess(role, resource);
};

// In render:
<Show 
  when={checkRoutePermission()} 
  fallback={
    <PermissionDenied 
      message="You don't have permission to access this page."
    />
  }
>
  {props.children}
</Show>
```

### Phase 4: Testing & Documentation

#### 4.1 Unit Tests
Create tests for permission utilities:

**File**: `packages/dashboard/src/utils/permissions.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { hasPermission, canAccess, getAccessibleResources } from './permissions';

describe('Permission System', () => {
  describe('hasPermission', () => {
    it('admin can read playlists', () => {
      expect(hasPermission('admin', 'playlists', 'read')).toBe(true);
    });

    it('regular cannot read playlists', () => {
      expect(hasPermission('regular', 'playlists', 'read')).toBe(false);
    });

    it('regular can read devices', () => {
      expect(hasPermission('regular', 'devices', 'read')).toBe(true);
    });

    it('guest can read usage', () => {
      expect(hasPermission('guest', 'usage', 'read')).toBe(true);
    });
  });

  describe('canAccess', () => {
    it('returns true if role has any permission for resource', () => {
      expect(canAccess('regular', 'devices')).toBe(true);
    });

    it('returns false if role has no permissions for resource', () => {
      expect(canAccess('regular', 'playlists')).toBe(false);
    });
  });

  describe('getAccessibleResources', () => {
    it('admin can access all resources', () => {
      const resources = getAccessibleResources('admin');
      expect(resources).toHaveLength(8);
    });

    it('regular has limited access', () => {
      const resources = getAccessibleResources('regular');
      expect(resources).toContain('devices');
      expect(resources).toContain('channels');
      expect(resources).toContain('usage');
      expect(resources).not.toContain('playlists');
    });

    it('guest has minimal access', () => {
      const resources = getAccessibleResources('guest');
      expect(resources).toEqual(['usage']);
    });
  });
});
```

#### 4.2 Integration Tests
Test role-based navigation:

**File**: `packages/dashboard/src/components/sidebar/sidebar.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { Sidebar } from './sidebar';

describe('Sidebar - Role-Based Rendering', () => {
  it('admin sees all navigation items', () => {
    const { getByText } = render(() => 
      <Sidebar store={mockStoreWithRole('admin')} />
    );
    
    expect(getByText('Playlists')).toBeInTheDocument();
    expect(getByText('Medias')).toBeInTheDocument();
    expect(getByText('Widgets')).toBeInTheDocument();
    expect(getByText('Devices')).toBeInTheDocument();
    expect(getByText('Teams')).toBeInTheDocument();
  });

  it('regular user sees limited navigation', () => {
    const { getByText, queryByText } = render(() => 
      <Sidebar store={mockStoreWithRole('regular')} />
    );
    
    expect(queryByText('Playlists')).not.toBeInTheDocument();
    expect(queryByText('Medias')).not.toBeInTheDocument();
    expect(getByText('Devices')).toBeInTheDocument();
    expect(getByText('Channels')).toBeInTheDocument();
  });

  it('guest user sees minimal navigation', () => {
    const { getByText, queryByText } = render(() => 
      <Sidebar store={mockStoreWithRole('guest')} />
    );
    
    expect(queryByText('Playlists')).not.toBeInTheDocument();
    expect(queryByText('Devices')).not.toBeInTheDocument();
    expect(getByText('Usage')).toBeInTheDocument();
  });
});
```

#### 4.3 Documentation Updates

Update AGENTS.md with RBAC implementation details:

**File**: `packages/dashboard/AGENTS.md`

Add new section:

```markdown
## 🔐 Role-Based Access Control (RBAC)

The Dashboard implements a comprehensive RBAC system to control what users can access based on their role in each organization.

### Role Types
- **admin**: Full access to all features
- **regular**: Limited access to view-only features
- **guest**: Minimal access (usage stats only)

### Permission System

**Location**: `src/utils/permissions.ts`

The permission system provides utilities to check access:

```typescript
import { canAccess, hasPermission } from '../utils/permissions';

// Check if user can access a resource
if (canAccess(role, 'playlists')) {
  // Show playlists feature
}

// Check specific permission
if (hasPermission(role, 'playlists', 'write')) {
  // Show create/edit buttons
}
```

### UI Components

**PermissionGuard**: Conditionally renders based on permissions
```tsx
<PermissionGuard resource="playlists">
  <PlaylistsFeature />
</PermissionGuard>
```

### Route Protection

Routes automatically check permissions in `ProtectedRoute`. Users without access see a permission denied message instead of the page content.

### Testing Permissions

When writing tests for role-based features:
1. Mock store with different roles
2. Verify correct UI elements render/hide
3. Test route guards work correctly
4. Ensure permission denied messages display

See `src/components/sidebar/sidebar.test.tsx` for examples.
```

## 📊 Success Criteria

- [ ] Backend returns user's role with organization data
- [ ] Organization interface includes role field
- [ ] Permission utility functions created and tested
- [ ] Sidebar navigation filters based on role
- [ ] Routes protected with permission checks
- [ ] Permission denied page shows for unauthorized access
- [ ] Unit tests achieve >90% coverage
- [ ] Integration tests verify role-based UI
- [ ] Documentation updated in AGENTS.md
- [ ] Manual testing with all three roles passes

## 🧪 Testing Plan

### Manual Testing Scenarios

1. **Admin User**
   - [ ] Can see all sidebar items
   - [ ] Can access all pages
   - [ ] Can perform all actions (create, edit, delete)

2. **Regular User**
   - [ ] Only sees allowed sidebar items
   - [ ] Cannot access restricted pages (redirects to permission denied)
   - [ ] Typing restricted URLs shows permission denied message

3. **Guest User**
   - [ ] Only sees usage in sidebar
   - [ ] Can only access usage page
   - [ ] All other pages show permission denied

4. **Organization Switching**
   - [ ] Sidebar updates when switching to org with different role
   - [ ] Permissions correctly apply per organization
   - [ ] User with admin in Org A and regular in Org B sees correct UI for each

## 🔄 Migration Strategy

1. **Phase 1**: Backend changes (no UI impact)
   - Add role field to API response
   - Deploy backend
   - Verify API returns roles correctly

2. **Phase 2**: Frontend preparation (no user-visible changes)
   - Update interfaces and types
   - Create permission utilities
   - Add tests

3. **Phase 3**: Gradual UI rollout
   - Deploy permission guards
   - Enable for one feature at a time
   - Monitor for issues

4. **Phase 4**: Full deployment
   - Enable all permission guards
   - Remove feature flags
   - Update documentation

## 📚 Related Issues

- #XXX - Graceful error handling for 403 errors (already implemented)
- #XXX - URL-based routing implementation (already implemented)

## 🎨 UI/UX Considerations

- Empty sidebar for guests should show a helpful message
- Permission denied pages should guide users to contact admins
- Switching to an org with fewer permissions should feel natural, not jarring
- Consider showing a role indicator in the UI (e.g., "Admin" badge)

## 💡 Future Enhancements

- Custom roles beyond admin/regular/guest
- Resource-level permissions (e.g., access only specific playlists)
- Permission delegation (admin can grant temporary access)
- Audit log of permission changes
- Permission preview/testing mode for admins

## 📝 Notes

- Permissions are checked client-side for UI, but **always enforced server-side** for security
- The client-side checks are for UX only - they prevent confusion, not unauthorized access
- Backend must continue to validate all requests regardless of client state
- Consider caching permission checks for performance if needed

---

**Labels**: `enhancement`, `security`, `RBAC`, `dashboard`, `UX`
**Priority**: High
**Estimated Effort**: 2-3 days

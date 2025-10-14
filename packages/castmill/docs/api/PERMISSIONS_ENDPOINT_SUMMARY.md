# Permissions Endpoint Implementation Summary

## Overview

A new REST API endpoint has been added to allow the frontend to fetch the current user's permissions for a specific organization. This enables the UI to dynamically disable or hide actions based on actual user permissions.

## What Was Added

### 1. Permissions Controller
**File**: `lib/castmill_web/controllers/permissions_controller.ex`

- **Endpoint**: `GET /dashboard/organizations/:organization_id/permissions`
- **Purpose**: Returns the permissions matrix for the authenticated user in the specified organization
- **Authentication**: Required (session-based)
- **Response Format**:
  ```json
  {
  "role": "member",
    "permissions": {
      "playlists": ["list", "show", "create", "update", "delete"],
      "medias": ["list", "show", "create", "update", "delete"],
      ...
    },
    "resources": ["playlists", "medias", "channels", "devices", "teams", "widgets"]
  }
  ```

### 2. Router Configuration
**File**: `lib/castmill_web/router.ex` (line ~178)

Added route:
```elixir
get("/organizations/:organization_id/permissions", PermissionsController, :show)
```

### 3. Controller Tests
**File**: `test/castmill_web/controllers/permissions_controller_test.exs`

Test coverage includes:
- ✅ Admin user permissions (full access to all resources)
- ✅ Member user permissions (CRUD on content, read-only on teams/widgets)
- ✅ Guest user permissions (read-only on content, no teams access)
- ✅ Unauthenticated users (401/403 response)
- ✅ Non-member users (403 forbidden)

All 5 tests passing ✅

### 4. Documentation
**File**: `PERMISSIONS_ENDPOINT_GUIDE.md`

Complete guide including:
- API specification with all parameters and responses
- Permission levels by role
- Frontend usage examples (React/TypeScript and SolidJS)
- Helper functions and caching recommendations
- Future enhancements for dynamic roles

## How It Works

1. **User makes request** to `/dashboard/organizations/{org-id}/permissions`
2. **Authentication check**: Middleware verifies user is logged in
3. **Role lookup**: Controller gets user's role in the organization via `Organizations.get_user_role/2`
4. **Permission matrix build**: 
   - Uses `Permissions.allowed_actions/2` for each resource
   - Filters to only include accessible resources
   - Returns role, permissions map, and resource list
5. **Response**: JSON with role, permissions, and resources

## Frontend Integration

### Basic Usage
```typescript
// Fetch permissions for current organization
const response = await fetch(`/dashboard/organizations/${orgId}/permissions`);
const { role, permissions, resources } = await response.json();

// Check if user can create playlists
const canCreate = permissions.playlists?.includes('create');

// Disable button if no permission
<button disabled={!canCreate}>Create Playlist</button>
```

### Recommended Pattern
```typescript
// Create a permissions context/store
const [permissions] = createResource(() => orgId, fetchPermissions);

// Use helper functions
const canCreate = () => permissions()?.permissions.playlists?.includes('create');

// Conditionally render UI
<Show when={canCreate()}>
  <button onClick={handleCreate}>Create Playlist</button>
</Show>
```

## Permission Matrix by Role

| Role | Playlists | Medias | Channels | Devices | Teams | Widgets |
|------|-----------|--------|----------|---------|-------|---------|
| **Admin** | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| **Manager** | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| **Member** | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Read-only | Read-only |
| **Guest** | Read-only | Read-only | Read-only | Read-only | No access | No access |

**Actions**: 
- Full CRUD = `["list", "show", "create", "update", "delete"]`
- Read-only = `["list", "show"]`
- No access = Not included in permissions map

## Future-Proofing for Dynamic Roles

The endpoint is designed to support future dynamic roles:

### Current Implementation
```json
{
  "role": "member",
  "permissions": { ... }
}
```

### Future Enhancement (when dynamic roles are added)
```json
{
  "role": "content_editor",
  "role_id": "custom-role-uuid",
  "permissions": {
    "playlists": ["list", "show", "create", "update"],
    "medias": ["list", "show", "create"]
  },
  "resource_specific": {
    "playlists": {
      "playlist-123": ["update", "delete"],
      "playlist-456": ["show"]
    }
  }
}
```

The frontend should:
1. **Not hardcode role names** - Use the `role` field dynamically
2. **Check permissions array** - Don't assume fixed permission sets
3. **Handle missing resources** - A resource not in the map means no access
4. **Be ready for granular permissions** - Future support for resource-specific permissions

## Testing

### Run Tests
```bash
cd packages/castmill
mix test test/castmill_web/controllers/permissions_controller_test.exs
```

### Manual Testing
```bash
# Get permissions for a member user
curl -X GET \
  http://localhost:4000/dashboard/organizations/{org-id}/permissions \
  -H 'Cookie: _castmill_key=...' \
  | jq

# Expected response for member user:
{
  "role": "member",
  "permissions": {
    "playlists": ["list", "show", "create", "update", "delete"],
    "medias": ["list", "show", "create", "update", "delete"],
    "channels": ["list", "show", "create", "update", "delete"],
    "devices": ["list", "show", "create", "update", "delete"],
    "teams": ["list", "show"],
    "widgets": ["list", "show"]
  },
  "resources": ["playlists", "medias", "channels", "devices", "teams", "widgets"]
}
```

## Benefits

1. **Frontend-Friendly**: Single API call to get all permissions for an organization
2. **Performance**: No need to check permissions for each action individually
3. **UX Improvement**: Disable/hide UI elements user can't access
4. **Secure**: Backend still enforces permissions on actual operations
5. **Future-Ready**: Designed to support dynamic roles without breaking changes
6. **Cacheable**: Frontend can cache permissions and refresh on org switch

## Related Files

- **Controller**: `lib/castmill_web/controllers/permissions_controller.ex`
- **Router**: `lib/castmill_web/router.ex`
- **Tests**: `test/castmill_web/controllers/permissions_controller_test.exs`
- **Documentation**: `PERMISSIONS_ENDPOINT_GUIDE.md`
- **Permission Matrix**: `lib/castmill/authorization/permissions.ex`
- **Test Suite**: `AUTHORIZATION_TEST_SUITE.md`

## Next Steps

### Frontend Integration
1. Create a permissions service/hook in the Dashboard
2. Fetch permissions when user selects an organization
3. Use permissions to conditionally render UI elements
4. Cache permissions in global store (refresh on org switch)

### Example Implementation
```typescript
// packages/dashboard/src/services/permissions.service.ts
export async function fetchPermissions(organizationId: string) {
  const response = await fetch(
    `/dashboard/organizations/${organizationId}/permissions`
  );
  return response.json();
}

// packages/dashboard/src/stores/permissions.store.ts
import { createStore } from 'solid-js/store';

const [permissions, setPermissions] = createStore({
  role: null,
  permissions: {},
  resources: []
});

export function loadPermissions(orgId: string) {
  fetchPermissions(orgId).then(setPermissions);
}

export function can(resource: string, action: string): boolean {
  return permissions.permissions[resource]?.includes(action) ?? false;
}
```

This implementation is complete and ready for frontend integration! 🎉

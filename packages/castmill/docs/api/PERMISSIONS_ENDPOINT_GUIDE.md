# Permissions Endpoint Documentation

## Overview

The permissions endpoint allows the frontend to fetch the current user's permissions for a specific organization. This enables the UI to disable or hide actions that the user doesn't have permission to perform.

## Endpoint

```
GET /dashboard/organizations/:organization_id/permissions
```

### Authentication

- **Required**: Yes
- **Method**: Session-based authentication (current_user)

### Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| organization_id | string (UUID) | Path | Yes | The organization ID to get permissions for |

### Response Format

```json
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

### Response Fields

- **role** (string): The user's role in the organization (`admin`, `manager`, `member`, or `guest`)
- **permissions** (object): A map of resource types to their allowed actions
  - Each resource key maps to an array of allowed actions
  - Possible actions: `list`, `show`, `create`, `update`, `delete`
- **resources** (array): List of all resource types the user can access

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success - Returns permissions matrix |
| 401 | Unauthorized - User is not authenticated |
| 403 | Forbidden - User is not a member of this organization |

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Not authenticated"
}
```

#### 403 Forbidden
```json
{
  "error": "User is not a member of this organization"
}
```

## Permission Levels by Role

### Admin
- **Full access** to all resources
- All actions enabled: `list`, `show`, `create`, `update`, `delete`
- Resources: playlists, medias, channels, devices, teams, widgets

### Manager
- **Full access** to all resources
- All actions enabled: `list`, `show`, `create`, `update`, `delete`
- Resources: playlists, medias, channels, devices, teams, widgets

### Member
- **Full CRUD** on content resources
- **Read-only** on teams and widgets
- Content resources (full access): playlists, medias, channels, devices
- Management resources (read-only): teams, widgets

### Guest
- **Read-only** on content resources
- **No access** to teams
- Resources (read-only): playlists, medias, channels, devices
- Actions: `list`, `show` only

## Frontend Usage Examples

### React/TypeScript Example

```typescript
interface PermissionsResponse {
  role: string;
  permissions: Record<string, string[]>;
  resources: string[];
}

async function fetchUserPermissions(organizationId: string): Promise<PermissionsResponse> {
  const response = await fetch(
    `/dashboard/organizations/${organizationId}/permissions`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session cookie
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch permissions');
  }

  return response.json();
}

// Usage in a component
function PlaylistActions({ organizationId }: { organizationId: string }) {
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);

  useEffect(() => {
    fetchUserPermissions(organizationId).then(setPermissions);
  }, [organizationId]);

  const canCreate = permissions?.permissions.playlists?.includes('create') ?? false;
  const canUpdate = permissions?.permissions.playlists?.includes('update') ?? false;
  const canDelete = permissions?.permissions.playlists?.includes('delete') ?? false;

  return (
    <div>
      <button disabled={!canCreate}>Create Playlist</button>
      <button disabled={!canUpdate}>Edit Playlist</button>
      <button disabled={!canDelete}>Delete Playlist</button>
    </div>
  );
}
```

### SolidJS Example (for Dashboard)

```typescript
import { createResource, Show } from 'solid-js';

interface PermissionsResponse {
  role: string;
  permissions: Record<string, string[]>;
  resources: string[];
}

async function fetchPermissions(orgId: string): Promise<PermissionsResponse> {
  const response = await fetch(`/dashboard/organizations/${orgId}/permissions`);
  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

function PlaylistsPage(props: { organizationId: string }) {
  const [permissions] = createResource(
    () => props.organizationId,
    fetchPermissions
  );

  const canCreate = () => 
    permissions()?.permissions.playlists?.includes('create') ?? false;
  
  const canUpdate = () => 
    permissions()?.permissions.playlists?.includes('update') ?? false;

  return (
    <div>
      <Show when={canCreate()}>
        <button onClick={handleCreate}>Create Playlist</button>
      </Show>
      
      <Show when={canUpdate()}>
        <button onClick={handleUpdate}>Edit Playlist</button>
      </Show>
    </div>
  );
}
```

### Helper Functions

```typescript
// Create a permissions helper class
class PermissionsHelper {
  constructor(private permissions: PermissionsResponse) {}

  can(resource: string, action: string): boolean {
    return this.permissions.permissions[resource]?.includes(action) ?? false;
  }

  hasAccess(resource: string): boolean {
    return this.permissions.resources.includes(resource);
  }

  isAdmin(): boolean {
    return this.permissions.role === 'admin';
  }

  isManager(): boolean {
    return this.permissions.role === 'manager';
  }

  isMember(): boolean {
    return this.permissions.role === 'member';
  }

  isGuest(): boolean {
    return this.permissions.role === 'guest';
  }
}

// Usage
const helper = new PermissionsHelper(permissionsData);

if (helper.can('playlists', 'create')) {
  showCreateButton();
}

if (helper.isAdmin()) {
  showAdminPanel();
}
```

### Caching Recommendations

1. **Cache permissions per organization**: Store permissions in React Context or a global store
2. **Invalidate on organization switch**: Fetch new permissions when user changes organization
3. **Refresh periodically**: Consider refreshing permissions every 5-10 minutes
4. **Handle role changes**: Listen for role change events and refetch permissions

```typescript
// Example with React Context
const PermissionsContext = createContext<PermissionsResponse | null>(null);

function PermissionsProvider({ 
  children, 
  organizationId 
}: { 
  children: React.ReactNode;
  organizationId: string;
}) {
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);

  useEffect(() => {
    fetchUserPermissions(organizationId).then(setPermissions);
  }, [organizationId]);

  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

function usePermissions() {
  const permissions = useContext(PermissionsContext);
  
  return {
    permissions,
    can: (resource: string, action: string) => 
      permissions?.permissions[resource]?.includes(action) ?? false,
    hasAccess: (resource: string) => 
      permissions?.resources.includes(resource) ?? false,
  };
}
```

## Future Enhancements

### Dynamic Roles
In the future, when dynamic roles are implemented, this endpoint will:
- Return custom role names instead of fixed roles
- Support resource-specific permissions (e.g., access to specific playlists)
- Include fine-grained permissions (e.g., "can edit own playlists only")

The frontend implementation should be flexible enough to handle:
```json
{
  "role": "content_editor",
  "permissions": {
    "playlists": ["list", "show", "create", "update"],
    "medias": ["list", "show", "create"],
    "channels": ["list", "show"]
  },
  "resource_specific": {
    "playlists": {
      "123": ["update", "delete"],  // Can edit specific playlist
      "456": ["show"]                // Can only view specific playlist
    }
  }
}
```

## Testing

Run the test suite:
```bash
cd packages/castmill
mix test test/castmill_web/controllers/permissions_controller_test.exs
```

Manual testing with curl:
```bash
# Assuming you have a valid session cookie
curl -X GET \
  http://localhost:4000/dashboard/organizations/{org-id}/permissions \
  -H 'Cookie: _castmill_key=...' \
  | jq
```

## Related Files

- Controller: `lib/castmill_web/controllers/permissions_controller.ex`
- Router: `lib/castmill_web/router.ex` (line ~178)
- Tests: `test/castmill_web/controllers/permissions_controller_test.exs`
- Permission Matrix: `lib/castmill/authorization/permissions.ex`
- Resource Access: `lib/castmill/authorization/resource_access.ex`

# Generic Resource Authorization System - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CASTMILL AUTHORIZATION SYSTEM                       │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │                    PERMISSION MATRIX                          │    │
│  │  (lib/castmill/authorization/permissions.ex)                  │    │
│  │                                                               │    │
│  │  @permissions = %{                                            │    │
│  │    admin: %{                                                  │    │
│  │      playlists: [:list, :show, :create, :update, :delete],   │    │
│  │      medias: [:list, :show, :create, :update, :delete],      │    │
│  │      teams: [:list, :show, :create, :update, :delete],       │    │
│  │      ...                                                      │    │
│  │    },                                                         │    │
│  │    regular: %{                                                │    │
│  │      playlists: [:list, :show, :create, :update, :delete],   │    │
│  │      teams: [:list, :show],  # Read-only                     │    │
│  │      ...                                                      │    │
│  │    },                                                         │    │
│  │    ...                                                        │    │
│  │  }                                                            │    │
│  │                                                               │    │
│  │  Functions:                                                   │    │
│  │  • can?(role, resource, action) -> boolean                   │    │
│  │  • allowed_actions(role, resource) -> [actions]              │    │
│  │  • accessible_resources(role) -> [resources]                 │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▲                                          │
│                              │                                          │
│                              │ uses                                     │
│                              │                                          │
│  ┌───────────────────────────┴───────────────────────────────────┐    │
│  │                  RESOURCE ACCESS HELPERS                      │    │
│  │  (lib/castmill/authorization/resource_access.ex)              │    │
│  │                                                               │    │
│  │  • check_resource_access(user_id, org_id, resource, action)  │    │
│  │    → Looks up user's role → calls Permissions.can?()         │    │
│  │                                                               │    │
│  │  • has_any_resource_access?(user_id, org_id, resource)       │    │
│  │    → Check if user has ANY permission on resource             │    │
│  │                                                               │    │
│  │  • accessible_resource_types(user_id, org_id)                │    │
│  │    → Returns list of resources user can access                │    │
│  │                                                               │    │
│  │  • allowed_resource_actions(user_id, org_id, resource)       │    │
│  │    → Returns list of allowed actions for user                 │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▲                                          │
│                              │                                          │
│                              │ calls                                    │
│                              │                                          │
│  ┌───────────────────────────┴───────────────────────────────────┐    │
│  │                 ORGANIZATION CONTROLLER                       │    │
│  │  (lib/castmill_web/controllers/organization_controller.ex)    │    │
│  │                                                               │    │
│  │  Generic Access Check Methods:                                │    │
│  │                                                               │    │
│  │  def check_access(actor_id, :list_resources, %{              │    │
│  │    "organization_id" => org_id,                               │    │
│  │    "resource_type" => resource_type                           │    │
│  │  }) do                                                        │    │
│  │    resource_atom = String.to_existing_atom(resource_type)    │    │
│  │    ResourceAccess.check_resource_access(                      │    │
│  │      actor_id, org_id, resource_atom, :list                  │    │
│  │    )                                                          │    │
│  │  end                                                          │    │
│  │                                                               │    │
│  │  Similar for:                                                 │    │
│  │  • :show_resource                                             │    │
│  │  • :create_resource                                           │    │
│  │  • :update_resource                                           │    │
│  │  • :delete_resource                                           │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                              ▲                                          │
│                              │                                          │
│                              │ called by                                │
│                              │                                          │
│  ┌───────────────────────────┴───────────────────────────────────┐    │
│  │                    AUTHORIZE PLUG                             │    │
│  │  (lib/castmill/plug/authorize_dash.ex)                        │    │
│  │                                                               │    │
│  │  Before each request:                                         │    │
│  │  1. Extract actor_id from session                             │    │
│  │  2. Extract action and params from request                    │    │
│  │  3. Call controller's check_access(actor_id, action, params)  │    │
│  │  4. Allow or deny request based on result                     │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Request Flow Example

```
1. User makes request:
   GET /dashboard/organizations/123/resources/playlists

2. Router matches:
   resources "/organizations/:organization_id/resources/:resource_type",
     OrganizationController, only: [:index]

3. AuthorizeDash plug intercepts:
   - Extracts actor_id from session
   - Extracts action = :index
   - Extracts params = %{"organization_id" => "123", "resource_type" => "playlists"}

4. Calls controller's check_access:
   check_access(actor_id, :list_resources, %{
     "organization_id" => "123",
     "resource_type" => "playlists"
   })

5. Controller method:
   - Converts "playlists" to :playlists atom
   - Calls ResourceAccess.check_resource_access(actor_id, "123", :playlists, :list)

6. ResourceAccess helper:
   - Calls Organizations.get_user_role("123", actor_id)
   - Gets role = :regular
   - Calls Permissions.can?(:regular, :playlists, :list)

7. Permissions matrix:
   - Looks up @permissions[:regular][:playlists]
   - Finds [:list, :show, :create, :update, :delete]
   - Checks if :list is in the list
   - Returns true

8. Result flows back:
   ResourceAccess → {:ok, true}
   → Controller → {:ok, true}
   → AuthorizeDash → Allows request
   → OrganizationController.index executes
```

## Data Flow Diagram

```
┌──────────┐      ┌─────────────┐      ┌────────────┐      ┌─────────────┐
│  Request │ ───> │   Router    │ ───> │ AuthPlug   │ ───> │ Controller  │
│          │      │             │      │            │      │ check_access│
└──────────┘      └─────────────┘      └────────────┘      └──────┬──────┘
                                                                   │
                                                                   ▼
                                                          ┌────────────────┐
                                                          │ ResourceAccess │
                                                          │   Helpers      │
                                                          └────────┬───────┘
                                                                   │
                                                                   ▼
                                                          ┌────────────────┐
                                                          │ Organizations  │
                                                          │ get_user_role  │
                                                          └────────┬───────┘
                                                                   │
                                                                   ▼
                                                          ┌────────────────┐
                                                          │  Permissions   │
                                                          │    Matrix      │
                                                          └────────┬───────┘
                                                                   │
                                                          ┌────────▼───────┐
                                                          │ true or false  │
                                                          └────────────────┘
```

## Component Responsibilities

### 1. Permissions Module (Core Logic)

- ✅ Defines the permission matrix
- ✅ Pure functions for permission lookups
- ✅ No external dependencies
- ✅ Easy to test in isolation

### 2. ResourceAccess Module (Integration Layer)

- ✅ Bridges user context with permissions
- ✅ Integrates with Organizations module
- ✅ Provides convenience functions
- ✅ Handles role lookup

### 3. Controller (Request Handler)

- ✅ Implements check_access callbacks
- ✅ Extracts resource type from params
- ✅ Delegates to ResourceAccess helpers
- ✅ Generic methods for all resources

### 4. AuthorizeDash Plug (Enforcement)

- ✅ Intercepts requests before controller
- ✅ Calls check_access with actor + params
- ✅ Returns 403 if access denied
- ✅ Allows request if access granted

## Extending the System

### Add New Resource Type: "Schedules"

```elixir
# 1. Update permissions.ex
@permissions %{
  admin: %{
    # ... existing ...
    schedules: [:list, :show, :create, :update, :delete]
  },
  regular: %{
    # ... existing ...
    schedules: [:list, :show, :create, :update]  # No delete
  },
  guest: %{
    # ... existing ...
    schedules: [:list, :show]
  }
}

# 2. That's it! No controller changes needed.
# The generic methods automatically work:
# GET /organizations/:org_id/resources/schedules → :list_resources
# POST /organizations/:org_id/resources/schedules → :create_resource
```

### Add New Role: "Contributor"

```elixir
# Update permissions.ex
@permissions %{
  # ... existing roles ...

  contributor: %{
    playlists: [:list, :show, :create, :update],
    medias: [:list, :show, :create],
    channels: [:list, :show],
    devices: [:list, :show],
    teams: [],
    widgets: [:list, :show]
  }
}

# The system automatically supports it!
Permissions.can?(:contributor, :playlists, :create)  # => true
Permissions.can?(:contributor, :playlists, :delete)  # => false
```

## Testing Strategy

```elixir
# Unit Tests (Pure Functions)
test "regular user can create playlists" do
  assert Permissions.can?(:regular, :playlists, :create)
end

# Integration Tests (With User Context)
test "user with regular role can access playlist creation" do
  {:ok, result} = ResourceAccess.check_resource_access(
    regular_user_id, org_id, :playlists, :create
  )
  assert result == true
end

# Controller Tests (HTTP Level)
test "regular user can POST to create playlist", %{conn: conn} do
  conn = post(conn, "/organizations/#{org_id}/resources/playlists", %{...})
  assert conn.status == 200
end
```

## Performance Considerations

### Current Implementation (O(1) lookups)

```elixir
# Direct map access - constant time
@permissions[role][resource_type]
action in allowed_actions  # List membership check
```

### Future Optimizations (if needed)

1. **Role caching**: Cache `Organizations.get_user_role/2` results
2. **Permission preloading**: Load all user permissions at login
3. **Database indexing**: Index organizations_users_access table
4. **Memoization**: Cache permission check results per request

## Security Audit Checklist

- [x] Default deny for unknown roles/resources
- [x] Type-safe permission checks (atoms, not strings)
- [x] Centralized permission matrix (single source of truth)
- [x] No permission inheritance bugs (explicit matrix)
- [x] Comprehensive test coverage (all roles × all resources × all actions)
- [x] Clear audit trail (permission matrix is self-documenting)
- [x] Protected against injection (uses atoms, not dynamic strings)
- [x] Enforced at plug level (can't bypass via URL manipulation)

---

**The system is complete, tested, and ready for production use!** 🚀

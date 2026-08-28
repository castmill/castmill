# Generic Resource Authorization System - Usage Guide

## Overview

The Castmill platform now has a **centralized, matrix-based authorization system** for managing permissions across all resource types.

## Architecture

### 1. Permission Matrix (`lib/castmill/authorization/permissions.ex`)
- Defines roles: `:admin`, `:manager`, `:member`, `:guest`
- Defines resources: `:playlists`, `:medias`, `:channels`, `:devices`, `:teams`, `:widgets`
- Defines actions: `:list`, `:show`, `:create`, `:update`, `:delete`
- Contains permission matrix mapping roles → resources → allowed actions

### 2. Resource Access Helpers (`lib/castmill/authorization/resource_access.ex`)
- `check_resource_access/4` - Check if user can perform action on resource type
- `has_any_resource_access?/3` - Check if user has ANY access to resource type
- `accessible_resource_types/2` - Get all resources accessible by user
- `allowed_resource_actions/3` - Get all actions allowed for user on resource

### 3. Controller Integration (`lib/castmill_web/controllers/organization_controller.ex`)
- Generic `check_access` methods for all resource operations
- Actions: `:list_resources`, `:show_resource`, `:create_resource`, `:update_resource`, `:delete_resource`

## Usage Examples

### In Controllers

#### Option 1: Use Generic Resource Methods

```elixir
defmodule CastmillWeb.MyResourceController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour
  
  alias Castmill.Authorization.ResourceAccess

  # Example: Check if user can create playlists
  def check_access(actor_id, :create, %{"organization_id" => org_id}) do
    ResourceAccess.check_resource_access(actor_id, org_id, :playlists, :create)
  end
  
  # Example: Check if user can list devices
  def check_access(actor_id, :index, %{"organization_id" => org_id}) do
    ResourceAccess.check_resource_access(actor_id, org_id, :devices, :list)
  end
  
  # Example: Check if user can update a channel
  def check_access(actor_id, :update, %{"organization_id" => org_id}) do
    ResourceAccess.check_resource_access(actor_id, org_id, :channels, :update)
  end
end
```

#### Option 2: Call Organization Controller Generic Methods

```elixir
# In your routes (router.ex)
scope "/dashboard/organizations/:organization_id" do
  # Generic resource endpoints
  get "/resources/:resource_type", OrganizationController, :list_resources
  post "/resources/:resource_type", OrganizationController, :create_resource
  put "/resources/:resource_type/:id", OrganizationController, :update_resource
  delete "/resources/:resource_type/:id", OrganizationController, :delete_resource
end

# The controller automatically checks permissions based on resource_type parameter
# Example requests:
# GET  /dashboard/organizations/123/resources/playlists  -> checks :list permission
# POST /dashboard/organizations/123/resources/medias     -> checks :create permission
# PUT  /dashboard/organizations/123/resources/devices/456 -> checks :update permission
```

### Checking Permissions Programmatically

```elixir
alias Castmill.Authorization.Permissions
alias Castmill.Authorization.ResourceAccess

# Direct permission check (role-based)
Permissions.can?(:member, :playlists, :create)
# => true

Permissions.can?(:guest, :teams, :delete)
# => false

# User-based permission check (looks up user's role first)
ResourceAccess.check_resource_access(user_id, org_id, :medias, :update)
# => {:ok, true} or {:ok, false}

# Check if user has ANY access to resource type
ResourceAccess.has_any_resource_access?(user_id, org_id, :teams)
# => true or false

# Get all resources accessible by user
ResourceAccess.accessible_resource_types(user_id, org_id)
# => [:playlists, :medias, :channels, :devices, :teams, :widgets]

# Get allowed actions for user on specific resource
ResourceAccess.allowed_resource_actions(user_id, org_id, :playlists)
# => [:list, :show, :create, :update, :delete]

# Check multiple actions at once
ResourceAccess.check_multiple_actions(user_id, org_id, :teams, [:create, :update, :delete])
# => %{create: false, update: false, delete: false}  # for member user
```

### In Frontend (for UI rendering)

```elixir
# In a Phoenix LiveView or controller
def mount(_params, %{"user_id" => user_id, "org_id" => org_id}, socket) do
  # Get user's accessible resources for navigation
  accessible = ResourceAccess.accessible_resource_types(user_id, org_id)
  
  # Get specific permissions for conditional rendering
  can_create_playlist = 
    ResourceAccess.check_resource_access(user_id, org_id, :playlists, :create)
    |> elem(1)
  
  socket = 
    socket
    |> assign(:accessible_resources, accessible)
    |> assign(:can_create_playlist, can_create_playlist)
  
  {:ok, socket}
end
```

```heex
<!-- Show navigation only for accessible resources -->
<%= if :playlists in @accessible_resources do %>
  <.link navigate="/playlists">Playlists</.link>
<% end %>

<!-- Show create button only if user has permission -->
<%= if @can_create_playlist do %>
  <button>Create Playlist</button>
<% end %>
```

## Modifying Permissions

### Adding a New Role

Edit `lib/castmill/authorization/permissions.ex`:

```elixir
@permissions %{
  # ... existing roles ...
  
  # New role: Viewer (read-only everything except teams)
  viewer: %{
    playlists: [:list, :show],
    medias: [:list, :show],
    channels: [:list, :show],
    devices: [:list, :show],
    teams: [],  # No access
    widgets: [:list, :show]
  }
}
```

### Adding a New Resource Type

1. Add to permission matrix for all roles:

```elixir
@permissions %{
  admin: %{
    # ... existing resources ...
    schedules: [:list, :show, :create, :update, :delete]  # New resource
  },
  member: %{
    # ... existing resources ...
    schedules: [:list, :show, :create, :update]  # Limited access
  },
  # ... update all other roles ...
}
```

2. The new resource is automatically available in all authorization helpers!

### Changing Permissions for a Role

Simply edit the matrix in `permissions.ex`:

```elixir
# Give member users full widget access
member: %{
  # ... other resources ...
  widgets: [:list, :show, :create, :update, :delete]  # Added create, update, delete
}
```

## Current Permission Matrix

| Resource | Admin | Manager | Member | Guest |
|----------|-------|---------|---------|-------|
| Playlists | Full | Full | Full | Read |
| Medias | Full | Full | Full | Read |
| Channels | Full | Full | Full | Read |
| Devices | Full | Full | Full | Read |
| Teams | Full | Full | Read | None |
| Widgets | Full | Full | Read | Read |

**Actions:**
- **Full** = list, show, create, update, delete
- **Read** = list, show
- **None** = no access

## Migration from Old Authorization

### Before (scattered checks):
```elixir
def check_access(actor_id, :create_widget, %{"organization_id" => org_id}) do
  {:ok, Organizations.is_admin?(org_id, actor_id)}
end

def check_access(actor_id, :create_playlist, %{"organization_id" => org_id}) do
  {:ok, Organizations.has_any_role?(org_id, actor_id, [:admin, :member])}
end
```

### After (centralized):
```elixir
def check_access(actor_id, :create, %{"organization_id" => org_id, "type" => type}) do
  ResourceAccess.check_resource_access(actor_id, org_id, String.to_atom(type), :create)
end
```

## Testing

```elixir
defmodule Castmill.Authorization.PermissionsTest do
  use ExUnit.Case
  alias Castmill.Authorization.Permissions

  test "admin has full access to all resources" do
    assert Permissions.can?(:admin, :playlists, :create)
    assert Permissions.can?(:admin, :teams, :delete)
    assert Permissions.can?(:admin, :widgets, :update)
  end

  test "member user cannot delete teams" do
    refute Permissions.can?(:member, :teams, :delete)
  end

  test "guest has read-only access" do
    assert Permissions.can?(:guest, :playlists, :show)
    refute Permissions.can?(:guest, :playlists, :create)
  end
end
```

## Benefits

1. **Centralized** - All permissions in one place
2. **Maintainable** - Easy to add roles/resources/permissions
3. **Testable** - Pure functions, easy to unit test
4. **Type-safe** - Uses atoms for compile-time checking
5. **Self-documenting** - Matrix clearly shows all permissions
6. **Flexible** - Supports future growth without code changes
7. **Consistent** - Same pattern across all resources

## Next Steps

1. ✅ Permission matrix created
2. ✅ Helper functions implemented
3. ✅ Controller integration added
4. ⏳ Migrate existing controllers to use new system
5. ⏳ Add comprehensive tests
6. ⏳ Update frontend to use permission checks for UI rendering
7. ⏳ Add permission caching for performance (if needed)

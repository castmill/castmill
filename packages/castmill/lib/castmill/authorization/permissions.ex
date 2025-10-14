defmodule Castmill.Authorization.Permissions do
  @moduledoc """
  Centralized permission matrix for role-based access control.

  This module defines which roles have access to which resource types and actions.

  ## Resource Types
  - `:playlists` - Playlist resources
  - `:medias` - Media resources (images, videos, etc.)
  - `:channels` - Channel resources
  - `:devices` - Device resources
  - `:teams` - Team resources
  - `:widgets` - Widget resources
  - `:organizations` - Organization resources (members, invitations, settings, sub-organizations)

  ## Actions
  - `:list` - View/list resources
  - `:show` - View a single resource
  - `:create` - Create new resources (or invite members for organizations)
  - `:update` - Modify existing resources (or manage members for organizations)
  - `:delete` - Remove resources (or remove members for organizations)

  ## Roles
  - `:admin` - Full access to all resources including organization management
  - `:manager` - Elevated access, can manage teams and most resources
  - `:member` - Standard user (default) with content management access
  - `:editor` - Full CRUD on content (media, playlists, files), cannot manage teams/org
  - `:publisher` - Like editor + publish action for workflow approval
  - `:device_manager` - Full device/channel management, read-only on content
  - `:guest` - Read-only access to specific resources

  ## Usage

      iex> Permissions.can?(:admin, :playlists, :create)
      true

      iex> Permissions.can?(:guest, :teams, :delete)
      false

      iex> Permissions.allowed_actions(:member, :playlists)
      [:list, :show, :create, :update, :delete]
  """

  @type role :: :admin | :manager | :member | :editor | :publisher | :device_manager | :guest
  @type resource_type ::
          :playlists | :medias | :channels | :devices | :teams | :widgets | :organizations
  @type action :: :list | :show | :create | :update | :delete | :publish

  # Permission Matrix
  # Format: %{role => %{resource_type => [allowed_actions]}}
  @permissions %{
    # Admin: Full access to everything including organization management
    admin: %{
      playlists: [:list, :show, :create, :update, :delete, :publish],
      medias: [:list, :show, :create, :update, :delete],
      channels: [:list, :show, :create, :update, :delete, :publish],
      devices: [:list, :show, :create, :update, :delete],
      teams: [:list, :show, :create, :update, :delete],
      widgets: [:list, :show, :create, :update, :delete],
      # Full org management
      organizations: [:list, :show, :create, :update, :delete]
    },

    # Manager: Full access to content, can manage teams, read-only organization
    manager: %{
      playlists: [:list, :show, :create, :update, :delete, :publish],
      medias: [:list, :show, :create, :update, :delete],
      channels: [:list, :show, :create, :update, :delete, :publish],
      devices: [:list, :show, :create, :update, :delete],
      # Managers can manage teams
      teams: [:list, :show, :create, :update, :delete],
      widgets: [:list, :show, :create, :update, :delete],
      # Read-only access to org members list
      organizations: [:list, :show]
    },

    # Member (default role): Full access to content resources, read-only teams and organizations
    member: %{
      playlists: [:list, :show, :create, :update, :delete],
      medias: [:list, :show, :create, :update, :delete],
      # Can view and update channels, not create/delete
      channels: [:list, :show, :update],
      # Can view and update devices, not create/delete
      devices: [:list, :show, :update],
      # Read-only access to teams
      teams: [:list, :show],
      # Read-only widgets
      widgets: [:list, :show],
      # Read-only access to org members list
      organizations: [:list, :show]
    },

    # Editor: Full CRUD on content (playlists, media, files), update channels, read devices
    editor: %{
      playlists: [:list, :show, :create, :update, :delete],
      medias: [:list, :show, :create, :update, :delete],
      # Can update, not create/delete
      channels: [:list, :show, :update],
      # Read-only devices
      devices: [:list, :show],
      # Read-only teams
      teams: [:list, :show],
      # Full widget access
      widgets: [:list, :show, :create, :update, :delete],
      # Read-only org
      organizations: [:list, :show]
    },

    # Publisher: Like editor + publish action (for workflow approval systems)
    publisher: %{
      playlists: [:list, :show, :create, :update, :delete, :publish],
      medias: [:list, :show, :create, :update, :delete],
      # Can publish to channels
      channels: [:list, :show, :update, :publish],
      devices: [:list, :show],
      teams: [:list, :show],
      widgets: [:list, :show, :create, :update, :delete],
      organizations: [:list, :show]
    },

    # Device Manager: Full device/channel management, read-only content
    device_manager: %{
      # Read-only playlists
      playlists: [:list, :show],
      # Read-only media
      medias: [:list, :show],
      # Full channel access
      channels: [:list, :show, :create, :update, :delete, :publish],
      # Full device access
      devices: [:list, :show, :create, :update, :delete],
      teams: [:list, :show],
      widgets: [:list, :show],
      organizations: [:list, :show]
    },

    # Guest: Read-only access to specific resources
    guest: %{
      playlists: [:list, :show],
      medias: [:list, :show],
      channels: [:list, :show],
      devices: [:list, :show],
      teams: [:list, :show],
      widgets: [:list, :show],
      organizations: [:list, :show]
    }
  }

  @doc """
  Checks if a role has permission to perform an action on a resource type.

  ## Examples

      iex> Permissions.can?(:admin, :playlists, :create)
      true

  iex> Permissions.can?(:member, :teams, :delete)
      false

      iex> Permissions.can?(:guest, :medias, :show)
      true
  """
  @spec can?(role(), resource_type(), action()) :: boolean()
  def can?(role, resource_type, action) do
    case get_in(@permissions, [role, resource_type]) do
      nil -> false
      actions -> action in actions
    end
  end

  @doc """
  Returns all allowed actions for a role on a specific resource type.

  ## Examples

  iex> Permissions.allowed_actions(:member, :playlists)
      [:list, :show, :create, :update, :delete]

      iex> Permissions.allowed_actions(:guest, :teams)
      []
  """
  @spec allowed_actions(role(), resource_type()) :: [action()]
  def allowed_actions(role, resource_type) do
    get_in(@permissions, [role, resource_type]) || []
  end

  @doc """
  Returns all resource types accessible by a role (with at least one action).

  ## Examples

  iex> Permissions.accessible_resources(:member)
      [:playlists, :medias, :channels, :devices, :teams, :widgets]
  """
  @spec accessible_resources(role()) :: [resource_type()]
  def accessible_resources(role) do
    case Map.get(@permissions, role) do
      nil ->
        []

      resource_map ->
        resource_map
        |> Enum.filter(fn {_resource, actions} -> length(actions) > 0 end)
        |> Enum.map(fn {resource, _actions} -> resource end)
    end
  end

  @doc """
  Returns the full permission matrix for a role.

  ## Examples

  iex> Permissions.role_permissions(:member)
      %{
        playlists: [:list, :show, :create, :update, :delete],
        medias: [:list, :show, :create, :update, :delete],
        ...
      }
  """
  @spec role_permissions(role()) :: %{resource_type() => [action()]}
  def role_permissions(role) do
    Map.get(@permissions, role, %{})
  end

  @doc """
  Checks if a role can perform ANY action on a resource type.

  ## Examples

      iex> Permissions.has_any_access?(:guest, :teams)
      false

  iex> Permissions.has_any_access?(:member, :playlists)
      true
  """
  @spec has_any_access?(role(), resource_type()) :: boolean()
  def has_any_access?(role, resource_type) do
    case allowed_actions(role, resource_type) do
      [] -> false
      _ -> true
    end
  end

  @doc """
  Returns all defined roles in the system.
  """
  @spec all_roles() :: [role()]
  def all_roles do
    Map.keys(@permissions)
  end

  @doc """
  Returns all defined resource types in the system.
  """
  @spec all_resource_types() :: [resource_type()]
  def all_resource_types do
    # Get all resource types from admin (which has access to everything)
    @permissions[:admin] |> Map.keys()
  end

  @doc """
  Validates if a role exists in the permission matrix.
  """
  @spec valid_role?(atom()) :: boolean()
  def valid_role?(role) do
    role in all_roles()
  end

  @doc """
  Validates if a resource type exists in the permission matrix.
  """
  @spec valid_resource_type?(atom()) :: boolean()
  def valid_resource_type?(resource_type) do
    resource_type in all_resource_types()
  end
end

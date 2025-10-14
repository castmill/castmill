defmodule Castmill.Authorization.TeamPermissions do
  @moduledoc """
  Permission matrix for team-level roles.

  Team roles are more limited in scope than organization roles and apply only to
  resources that are scoped to a specific team (via team_id).

  ## Team Roles
  - `:admin` - Team administrator, can manage team members and all team resources
  - `:member` - Regular team member, can access team resources based on team resource permissions
  - `:installer` - Temporary role for device registration, can only create devices (24h token)

  ## Usage

      iex> TeamPermissions.can?(:installer, :devices, :create)
      true

      iex> TeamPermissions.can?(:installer, :playlists, :create)
      false
  """

  @type team_role :: :admin | :member | :installer
  @type resource_type :: :playlists | :medias | :channels | :devices | :teams | :widgets
  @type action :: :list | :show | :create | :update | :delete | :publish

  # Team Permission Matrix
  # Team roles are less granular than org roles
  @team_permissions %{
    # Team Admin: Can manage all team resources and members
    admin: %{
      playlists: [:list, :show, :create, :update, :delete],
      medias: [:list, :show, :create, :update, :delete],
      channels: [:list, :show, :create, :update, :delete, :publish],
      devices: [:list, :show, :create, :update, :delete],
      widgets: [:list, :show, :create, :update, :delete],
      # Can update team details, not create/delete teams
      teams: [:list, :show, :update]
    },

    # Team Member: Access based on team resource permissions (managed by team admin)
    # This is a baseline - actual access determined by teams_resources join table
    member: %{
      playlists: [:list, :show, :create, :update, :delete],
      medias: [:list, :show, :create, :update, :delete],
      channels: [:list, :show, :update],
      devices: [:list, :show, :update],
      widgets: [:list, :show],
      teams: [:list, :show]
    },

    # Installer: Temporary role for device registration only
    # Tokens expire after 24 hours
    installer: %{
      playlists: [],
      medias: [],
      channels: [],
      # Can only register new devices
      devices: [:create],
      widgets: [],
      teams: []
    }
  }

  @doc """
  Checks if a team role has permission to perform an action on a resource type.
  """
  @spec can?(team_role(), resource_type(), action()) :: boolean()
  def can?(team_role, resource_type, action) do
    case get_in(@team_permissions, [team_role, resource_type]) do
      nil -> false
      actions -> action in actions
    end
  end

  @doc """
  Returns all allowed actions for a team role on a specific resource type.
  """
  @spec allowed_actions(team_role(), resource_type()) :: [action()]
  def allowed_actions(team_role, resource_type) do
    get_in(@team_permissions, [team_role, resource_type]) || []
  end

  @doc """
  Returns the full permission matrix for a team role.
  """
  @spec role_permissions(team_role()) :: %{resource_type() => [action()]}
  def role_permissions(team_role) do
    Map.get(@team_permissions, team_role, %{})
  end

  @doc """
  Validates if a team role exists in the permission matrix.
  """
  @spec valid_role?(atom()) :: boolean()
  def valid_role?(team_role) do
    team_role in [:admin, :member, :installer]
  end

  @doc """
  Returns all defined team roles in the system.
  """
  @spec all_roles() :: [team_role()]
  def all_roles do
    Map.keys(@team_permissions)
  end
end

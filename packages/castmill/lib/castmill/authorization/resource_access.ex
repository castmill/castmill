defmodule Castmill.Authorization.ResourceAccess do
  @moduledoc """
  Generic resource access control helpers.

  This module provides helper functions for checking resource-level permissions
  using the centralized permission matrix.

  ## Usage in Controllers

      use Castmill.Authorization.ResourceAccess

      def check_access(actor_id, :list_resources, %{
        "organization_id" => organization_id,
        "resource_type" => resource_type
      }) do
        check_resource_access(actor_id, organization_id, resource_type, :list)
      end
  """

  alias Castmill.Organizations
  alias Castmill.Authorization.Permissions

  @doc """
  Checks if a user has permission to perform an action on a resource type within an organization.

  Returns `{:ok, true}` if access is granted, `{:ok, false}` otherwise.

  ## Parameters

  - `user_id` - The user's ID
  - `organization_id` - The organization ID
  - `resource_type` - The resource type atom (`:playlists`, `:medias`, etc.)
  - `action` - The action atom (`:list`, `:create`, `:update`, `:delete`)

  ## Examples

      iex> check_resource_access(user_id, org_id, :playlists, :create)
      {:ok, true}

      iex> check_resource_access(guest_user_id, org_id, :teams, :delete)
      {:ok, false}
  """
  @spec check_resource_access(integer(), String.t() | integer(), atom(), atom()) ::
          {:ok, boolean()}
  def check_resource_access(user_id, organization_id, resource_type, action) do
    # Get user's role in the organization
    role = Organizations.get_user_role(organization_id, user_id)

    # Check if role has permission for this resource/action combination
    has_access =
      case role do
        # No role = no access
        nil -> false
        role_atom -> Permissions.can?(role_atom, resource_type, action)
      end

    {:ok, has_access}
  end

  @doc """
  Checks if a user has ANY access to a resource type within an organization.

  Useful for determining if navigation items should be shown.
  """
  @spec has_any_resource_access?(integer(), String.t() | integer(), atom()) :: boolean()
  def has_any_resource_access?(user_id, organization_id, resource_type) do
    role = Organizations.get_user_role(organization_id, user_id)

    case role do
      nil -> false
      role_atom -> Permissions.has_any_access?(role_atom, resource_type)
    end
  end

  @doc """
  Returns all resource types accessible by a user in an organization.

  Useful for generating navigation menus or filtering available resources.
  """
  @spec accessible_resource_types(integer(), String.t() | integer()) :: [atom()]
  def accessible_resource_types(user_id, organization_id) do
    role = Organizations.get_user_role(organization_id, user_id)

    case role do
      nil -> []
      role_atom -> Permissions.accessible_resources(role_atom)
    end
  end

  @doc """
  Returns all actions allowed for a user on a specific resource type.
  """
  @spec allowed_resource_actions(integer(), String.t() | integer(), atom()) :: [atom()]
  def allowed_resource_actions(user_id, organization_id, resource_type) do
    role = Organizations.get_user_role(organization_id, user_id)

    case role do
      nil -> []
      role_atom -> Permissions.allowed_actions(role_atom, resource_type)
    end
  end

  @doc """
  Convenience function to check multiple actions at once.

  Returns a map of action => boolean.

  ## Examples

      iex> check_multiple_actions(user_id, org_id, :playlists, [:create, :update, :delete])
      %{create: true, update: true, delete: true}
  """
  @spec check_multiple_actions(integer(), String.t() | integer(), atom(), [atom()]) :: %{
          atom() => boolean()
        }
  def check_multiple_actions(user_id, organization_id, resource_type, actions) do
    role = Organizations.get_user_role(organization_id, user_id)

    case role do
      nil ->
        Enum.into(actions, %{}, fn action -> {action, false} end)

      role_atom ->
        allowed = Permissions.allowed_actions(role_atom, resource_type)
        Enum.into(actions, %{}, fn action -> {action, action in allowed} end)
    end
  end
end

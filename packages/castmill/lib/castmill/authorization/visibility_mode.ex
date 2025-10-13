defmodule Castmill.Authorization.VisibilityMode do
  @moduledoc """
  Implements organization hierarchy visibility enforcement for Castmill 2.0.

  Visibility modes control how parent and child organizations can access each other's resources:

  - `:full` - Parent can see and edit ALL child org resources, child sees parent resources
  - `:read_only_parent` - Parent can READ child resources, child can VIEW/EDIT shared parent resources
  - `:isolated` - Complete isolation, parent cannot see child, child cannot see parent

  ## Usage in Resource Queries

      # Get all accessible playlist IDs for an organization (including parent shared resources)
      accessible_org_ids = VisibilityMode.accessible_organization_ids(org_id, user_id, :playlist)

      query
      |> where([r], r.organization_id in ^accessible_org_ids)
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Organizations
  alias Castmill.Organizations.Organization
  alias Castmill.Organizations.ResourceSharing

  @doc """
  Get list of organization IDs that a user can access resources from.

  This includes:
  1. The user's own organization
  2. Parent organization's shared resources (if any)
  3. Child organization resources (if user is admin and visibility mode allows)

  ## Parameters
  - `organization_id` - The organization the user belongs to
  - `user_id` - The user's ID (for permission checks)
  - `resource_type` - Type of resource: :playlist, :media, :channel, :device, :widget

  ## Returns
  List of organization IDs to include in resource queries
  """
  def accessible_organization_ids(organization_id, user_id, resource_type) do
    org = Organizations.get_organization!(organization_id)
    user_role = Organizations.get_user_role(organization_id, user_id)
    is_admin = user_role == :admin

    # Start with own organization
    org_ids = [organization_id]

    # Add parent org shared resources (if we have a parent and they share resources)
    org_ids =
      if org.organization_id do
        parent_shared = get_parent_shared_resource_orgs(org, resource_type)
        org_ids ++ parent_shared
      else
        org_ids
      end

    # Add child org resources (if user is admin and visibility mode allows)
    org_ids =
      if is_admin do
        child_orgs = get_accessible_child_orgs(organization_id, org.visibility_mode)
        org_ids ++ child_orgs
      else
        org_ids
      end

    Enum.uniq(org_ids)
  end

  @doc """
  Get resource IDs from parent organization that are shared with this org.

  Returns a map: %{resource_id => access_level}
  """
  def parent_shared_resources(child_org_id, resource_type) do
    child_org = Organizations.get_organization!(child_org_id)

    if child_org.organization_id do
      # Check parent's visibility mode
      parent_org = Organizations.get_organization!(child_org.organization_id)

      case parent_org.visibility_mode do
        :isolated ->
          # Parent is isolated, no sharing
          %{}

        _ ->
          # Get explicitly shared resources from parent
          shared =
            ResourceSharing.accessible_from_parents(
              Atom.to_string(resource_type),
              child_org_id
            )

          # Convert to map of resource_id => access_level
          shared
          |> Enum.map(fn %{resource_id: id, access_level: level} -> {id, level} end)
          |> Map.new()
      end
    else
      # No parent, no shared resources
      %{}
    end
  end

  @doc """
  Check if a user in a child organization can perform an action on a parent's shared resource.

  ## Parameters
  - `child_org_id` - Child organization ID
  - `resource_id` - ID of the parent's resource
  - `resource_type` - Type of resource
  - `action` - Action to perform (:read, :update, :delete)

  ## Returns
  true if allowed, false otherwise
  """
  def can_access_parent_resource?(child_org_id, resource_id, resource_type, action) do
    shared_resources = parent_shared_resources(child_org_id, resource_type)

    case Map.get(shared_resources, resource_id) do
      nil -> false
      :read -> action == :read or action == :show or action == :list
      :read_write -> action in [:read, :show, :list, :update]
      :full -> true
    end
  end

  @doc """
  Check if a parent org admin can access child org resources based on visibility mode.
  """
  def can_access_child_resources?(parent_org_id, child_org_id, action) do
    parent_org = Organizations.get_organization!(parent_org_id)
    child_org = Organizations.get_organization!(child_org_id)

    # Verify parent-child relationship
    if child_org.organization_id != parent_org_id do
      false
    else
      case parent_org.visibility_mode do
        :full ->
          # Parent can do everything
          true

        :read_only_parent ->
          # Parent can only read
          action in [:read, :show, :list]

        :isolated ->
          # Parent cannot access child resources
          false
      end
    end
  end

  # Private helper functions

  defp get_parent_shared_resource_orgs(org, resource_type) do
    # If parent shares resources with us, include parent org ID
    # This allows queries like: WHERE organization_id IN [my_org_id, parent_org_id]
    # Combined with filtering by shared resource IDs

    if org.organization_id do
      parent_org = Organizations.get_organization!(org.organization_id)

      case parent_org.visibility_mode do
        :isolated ->
          []

        _ ->
          # Check if parent has any shared resources of this type
          shared_count =
            from(rs in ResourceSharing,
              where: rs.organization_id == ^org.organization_id,
              where: rs.resource_type == ^Atom.to_string(resource_type),
              select: count(rs.id)
            )
            |> Repo.one()

          if shared_count > 0 do
            [org.organization_id]
          else
            []
          end
      end
    else
      []
    end
  end

  defp get_accessible_child_orgs(parent_org_id, visibility_mode) do
    case visibility_mode do
      :isolated ->
        # Cannot see child orgs
        []

      :full ->
        # Can see all child organizations
        from(o in Organization,
          where: o.organization_id == ^parent_org_id,
          select: o.id
        )
        |> Repo.all()

      :read_only_parent ->
        # Can see child orgs (read-only enforced at action level)
        from(o in Organization,
          where: o.organization_id == ^parent_org_id,
          select: o.id
        )
        |> Repo.all()
    end
  end
end

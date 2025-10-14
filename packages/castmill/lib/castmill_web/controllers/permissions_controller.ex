defmodule CastmillWeb.PermissionsController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Authorization.Permissions

  @doc """
  GET /dashboard/organizations/:organization_id/permissions

  Returns the permissions matrix for the current user in the specified organization.
  This allows the frontend to disable UI elements based on actual permissions.

  Response format:
  {
    "role": "member",
    "permissions": {
      "playlists": ["list", "show", "create", "update", "delete"],
      "medias": ["list", "show", "create", "update", "delete"],
      "channels": ["list", "show", "create", "update", "delete"],
      "devices": ["list", "show", "create", "update", "delete"],
      "teams": ["list", "show"],
      "widgets": ["list", "show"],
      "organizations": ["list", "show"]
    },
    "resources": ["playlists", "medias", "channels", "devices", "teams", "widgets", "organizations"]
  }
  """
  def show(conn, %{"organization_id" => organization_id}) do
    current_user = conn.assigns[:current_user] || conn.assigns[:current_actor]

    if is_nil(current_user) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Not authenticated"})
    else
      # Get user's role in the organization
      role = Organizations.get_user_role(organization_id, current_user.id)

      if is_nil(role) do
        conn
        |> put_status(:forbidden)
        |> json(%{error: "User is not a member of this organization"})
      else
        # Build permissions matrix for the user's role
        permissions_map = build_permissions_map(role)
        accessible_resources = Permissions.accessible_resources(role)

        conn
        |> put_status(:ok)
        |> json(%{
          role: role,
          permissions: permissions_map,
          resources: accessible_resources
        })
      end
    end
  end

  # Build a map of resource => [allowed_actions] for the given role
  defp build_permissions_map(role) do
    # Use accessible_resources to get the dynamic list of resources for this role
    Permissions.accessible_resources(role)
    |> Enum.into(%{}, fn resource ->
      actions = Permissions.allowed_actions(role, resource)
      {resource, actions}
    end)
  end
end

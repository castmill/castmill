defmodule CastmillWeb.OrganizationUsageController do
  use CastmillWeb, :controller

  alias Castmill.Quotas

  action_fallback CastmillWeb.FallbackController

  @resource_map %{
    "medias" => Castmill.Resources.Media,
    "playlists" => Castmill.Resources.Playlist,
    "devices" => Castmill.Devices.Device,
    "channels" => Castmill.Resources.Channel,
    "teams" => Castmill.Teams.Team
  }

  def index(conn, %{"organization_id" => organization_id}) do
    usage = get_usage_for_organization(organization_id)

    conn
    |> put_status(:ok)
    |> json(usage)
  end

  defp get_usage_for_organization(organization_id) do
    # Get usage for regular resources
    resource_usage =
      @resource_map
      |> Enum.map(fn {resource_str, schema_module} ->
        usage = Quotas.get_quota_used_for_organization(organization_id, schema_module)
        total = Quotas.get_quota_for_organization(organization_id, resource_str)
        {resource_str, %{used: usage, total: total}}
      end)
      |> Map.new()

    # Add storage usage (special case - sums file sizes instead of counting)
    storage_usage = Quotas.get_quota_used_for_organization(organization_id, :storage)
    storage_total = Quotas.get_quota_for_organization(organization_id, "storage")

    Map.put(resource_usage, "storage", %{used: storage_usage, total: storage_total})
  end
end

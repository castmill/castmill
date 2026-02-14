defmodule CastmillWeb.OrganizationUsageController do
  use CastmillWeb, :controller

  alias Castmill.Quotas

  action_fallback CastmillWeb.FallbackController

  @resource_map %{
    "medias" => Castmill.Resources.Media,
    "playlists" => Castmill.Resources.Playlist,
    "devices" => Castmill.Devices.Device,
    "channels" => Castmill.Resources.Channel,
    "teams" => Castmill.Teams.Team,
    "users" => Castmill.Organizations.OrganizationsUsers,
    "layouts" => Castmill.Resources.Layout
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
    # Note: storage quota is stored in MB, but usage is in bytes, so we convert
    storage_usage = Quotas.get_quota_used_for_organization(organization_id, :storage)
    storage_quota_mb = Quotas.get_quota_for_organization(organization_id, "storage")
    storage_total_bytes = storage_quota_mb * 1024 * 1024

    Map.put(resource_usage, "storage", %{used: storage_usage, total: storage_total_bytes})
  end
end

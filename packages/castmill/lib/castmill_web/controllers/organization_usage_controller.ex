defmodule CastmillWeb.OrganizationUsageController do
  use CastmillWeb, :controller

  alias Castmill.Quotas

  action_fallback CastmillWeb.FallbackController

  @resource_map %{
    "medias" => Castmill.Resources.Media
    # "playlist" => Castmill.Resources.Playlist,
    # "device" => Castmill.Devices.Device,
    # "channel" => Castmill.Resources.Channel,
    # "team" => Castmill.Teams.Team
  }

  def index(conn, %{"organization_id" => organization_id}) do
    usage = get_usage_for_organization(organization_id)

    conn
    |> put_status(:ok)
    |> json(usage)
  end

  defp get_usage_for_organization(organization_id) do
    # Iterate over the resource map and get the usage for each resource
    @resource_map
    |> Enum.map(fn {resource_str, schema_module} ->
      usage = Quotas.get_quota_used_for_organization(organization_id, schema_module)
      total = Quotas.get_quota_for_organization(organization_id, resource_str)
      {resource_str, %{used: usage, total: total}}
    end)
    |> Map.new()
  end
end

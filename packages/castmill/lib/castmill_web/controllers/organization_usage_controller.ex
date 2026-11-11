defmodule CastmillWeb.OrganizationUsageController do
  use CastmillWeb, :controller

  alias Castmill.Quotas

  action_fallback CastmillWeb.FallbackController

  @resource_map %{
    "medias" => Castmill.Resources.Media,
    "playlists" => Castmill.Resources.Playlist,
    "devices" => Castmill.Devices.Device,
    "channels" => Castmill.Resources.Channel,
    "widgets" => Castmill.Widgets.WidgetConfig,
    "teams" => Castmill.Teams.Team,
    "users" => Castmill.Organizations.OrganizationsUsers,
    "layouts" => Castmill.Resources.Layout,
    "feeds" => Castmill.Feeds.Feed,
    "automations" => Castmill.Automations.Automation,
    "tags" => Castmill.Tags.Tag,
    "tag_groups" => Castmill.Tags.TagGroup,
    "agents" => Castmill.Agents.Agent
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
    storage_total = Quotas.get_quota_for_organization_bytes(organization_id, "storage")

    # Rules are counted across all of the organization's automations.
    rules_usage = Castmill.Automations.rules_used(organization_id)
    rules_total = Quotas.get_quota_for_organization(organization_id, "automation_rules")

    resource_usage
    |> Map.put("storage", %{used: storage_usage, total: storage_total})
    |> Map.put("automation_rules", %{used: rules_usage, total: rules_total})
  end
end

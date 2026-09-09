defmodule CastmillWeb.OrganizationQuotaController do
  use CastmillWeb, :controller

  alias Castmill.Quotas
  alias Castmill.Quotas.QuotasOrganizations

  action_fallback CastmillWeb.FallbackController

  @resource_map %{
    "media" => Castmill.Resources.Media,
    "playlist" => Castmill.Resources.Playlist,
    "device" => Castmill.Devices.Device,
    "channel" => Castmill.Resources.Channel,
    "team" => Castmill.Teams.Team
  }

  # All resource types that can have quotas
  @all_resources ~w(organizations medias playlists channels channels_entries devices users teams storage layouts max_upload_size)

  def index(conn, %{"organization_id" => organization_id}) do
    # Resolve all quotas through the full resolution chain
    # (org overrides -> plan -> network default plan -> network quotas -> 0)
    quotas =
      Enum.map(@all_resources, fn resource ->
        max = Quotas.get_quota_for_organization(organization_id, resource)
        %{resource: resource, max: max}
      end)

    conn
    |> put_status(:ok)
    |> json(quotas)
  end

  def show(conn, %{"organization_id" => organization_id, "id" => id}) do
    case Quotas.get_quota_for_organization(organization_id, id) do
      nil ->
        {:error, :not_found}

      quota ->
        render_json(conn, :show, quota: %{resource: id, max: quota})
    end
  end

  def create(conn, %{"organization_id" => organization_id, "quota" => quota_params}) do
    case Quotas.add_quota_to_organization(
           organization_id,
           quota_params["resource"],
           quota_params["max"]
         ) do
      {:ok, quota} ->
        conn
        |> put_status(:created)
        |> render_json(:show, quota: quota)

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def update(conn, %{"organization_id" => organization_id, "id" => id, "quota" => quota_params}) do
    case Quotas.update_quota(
           %QuotasOrganizations{organization_id: organization_id, resource: id},
           quota_params
         ) do
      {:ok, quota} ->
        render_json(conn, :show, quota: quota)

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def check_quota_usage(conn, %{"organization_id" => organization_id, "resource" => resource_str}) do
    schema_module = Map.fetch!(@resource_map, resource_str)

    usage = Quotas.get_quota_used_for_organization(organization_id, schema_module)
    max_quota = Quotas.get_quota_for_organization(organization_id, resource_str)

    render_json(conn, :usage, usage: usage, max: max_quota)
  end

  # Private helper for rendering JSON
  defp render_json(conn, template, assigns) do
    conn
    |> put_resp_header("content-type", "application/json")
    |> Phoenix.Controller.render(template, assigns)
  end
end

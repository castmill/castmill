defmodule CastmillWeb.OsUpdateController do
  @moduledoc """
  Castmill OS updates in the dashboard: the organization's update policy, the
  imported releases, and a device's override (castmill-os ADR-0010).
  Viewing needs permission to view devices; changing needs permission to
  update devices (like the device schedule).
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Devices
  alias Castmill.Organizations
  alias Castmill.OsUpdates
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"organization_id" => organization_id})
      when action in [:show_policy, :set_policy] do
    permission = if action == :show_policy, do: :show, else: :update
    {:ok, Organizations.has_access(organization_id, actor_id, "devices", permission)}
  end

  def check_access(actor_id, :set_device_override, %{"device_id" => device_id}) do
    case Devices.get_device(device_id) do
      nil ->
        {:ok, false}

      device ->
        {:ok, Organizations.has_access(device.organization_id, actor_id, "devices", :update)}
    end
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  plug(AuthorizeDash, %{} when action in [:show_policy, :set_policy, :set_device_override])

  @doc "GET /dashboard/organizations/:organization_id/os-updates"
  def show_policy(conn, %{"organization_id" => organization_id}) do
    json(conn, %{
      policy: OsUpdates.get_policy(organization_id),
      releases: OsUpdates.list_releases()
    })
  end

  @doc "PUT /dashboard/organizations/:organization_id/os-updates"
  def set_policy(conn, %{"organization_id" => organization_id} = params) do
    case OsUpdates.set_policy(
           organization_id,
           Map.take(params, ["mode", "version", "prereleases"])
         ) do
      {:ok, policy} -> json(conn, %{policy: policy})
      {:error, reason} -> error(conn, reason)
    end
  end

  @doc "PUT /dashboard/devices/:device_id/os-update"
  def set_device_override(conn, %{"device_id" => device_id} = params) do
    case OsUpdates.set_device_override(device_id, Map.take(params, ["mode", "version", "now"])) do
      {:ok, device} -> json(conn, %{os_update: device.os_update})
      {:error, reason} -> error(conn, reason)
    end
  end

  defp error(conn, :not_found), do: conn |> put_status(:not_found) |> json(%{error: "not_found"})

  defp error(conn, reason) when reason in [:invalid_mode, :unknown_version],
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: to_string(reason)})

  defp error(conn, %Ecto.Changeset{}),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid"})
end

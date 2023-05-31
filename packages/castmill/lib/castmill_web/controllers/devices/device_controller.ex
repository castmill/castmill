defmodule CastmillWeb.DeviceController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Plug.Authorize

  action_fallback(CastmillWeb.FallbackController)

  plug(
    Authorize,
    %{parent: :organization, resource: :not_needed, action: :index} when action in [:index]
  )

  plug(
    Authorize,
    %{parent: :organization, resource: :not_needed, action: :create} when action in [:create]
  )

  def home(conn, _params) do
    render(conn, :device, layout: false)
  end

  def start_registration(conn, %{"hardware_id" => hardware_id, "timezone" => timezone} = params) do
    location = Map.get(params, "location")

    device_attrs = %{
      hardware_id: hardware_id,
      device_ip: conn.remote_ip |> :inet_parse.ntoa() |> to_string(),
      user_agent: get_req_header(conn, "user-agent") |> List.first(),
      timezone: timezone,
      loc_lat: location["latitude"],
      loc_long: location["longitude"],
      version: "0.0.1"
    }

    with {:ok, device} <- Castmill.Devices.create_device_registration(device_attrs) do
      conn
      |> put_status(:created)
      |> render(:show, device: device)
    end
  end

  def index(conn, %{"resources" => "medias", "organization_id" => organization_id}) do
    medias = Organizations.list_medias(organization_id)
    render(conn, :index, medias: medias)
  end

  def index(conn, %{"resources" => "playlists", "organization_id" => organization_id}) do
    playlists = Organizations.list_playlists(organization_id)
    render(conn, :index, playlists: playlists)
  end

  @doc """
    Creates a device and adds it to an organization.
  """
  def create(conn, %{"name" => name, "pincode" => pincode, "organization_id" => organization_id}) do
    with {:ok, {device, _token}} <-
           Castmill.Devices.register_device(organization_id, pincode, %{name: name}) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/devices/#{device.id}")
      |> render(:show, device: device)
    end
  end

end

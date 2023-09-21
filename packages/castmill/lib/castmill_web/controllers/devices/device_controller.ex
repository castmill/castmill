defmodule CastmillWeb.DeviceController do
  use CastmillWeb, :controller

  alias Castmill.Organizations
  alias Castmill.Plug.Authorize
  alias Castmill.Devices
  alias Castmill.Resources

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

  def index(conn, params) do
    devices = Organizations.list_devices(params)
    render(conn, :index, devices: devices)
  end

  @doc """
    Returns calendars associated to this player
  """
  def get_calendars(conn, %{"id" => device_id}) do
    calendars = Devices.list_calendars(device_id)

    conn
    |> put_status(:ok)
    |> put_resp_header("content-type", "application/json")
    |> json(%{data: calendars})
  end

  @doc """
    Returns the given playlists.
    TODO: Add authorization check to ensure that the device has access to the playlist.
    Basically check if the playlist is referenced by a calendar that is associated to the device.
  """
  def get_playlist(conn, %{"id" => _device_id, "playlist_id" => playlist_id}) do
    playlist = Resources.get_playlist(playlist_id)

    conn
    |> put_status(:ok)
    |> put_resp_header("content-type", "application/json")
    |> json(playlist)
  end

  @doc """
    Adds a calendar to a device
  """
  def add_calendar(conn, %{"id" => device_id, "calendar_id" => calendar_id}) do
    with {:ok, _device} <- Devices.add_calendar(device_id, calendar_id) do
      conn
      |> put_status(:ok)
      |> send_resp(200, "")
    end
  end

  @doc """
    Removes a calendar from a device
  """
  def remove_calendar(conn, %{"id" => device_id, "calendar_id" => calendar_id}) do
    with {:ok, _device} <- Devices.remove_calendar(device_id, calendar_id) do
      conn
      |> put_status(:ok)
      |> send_resp(200, "")
    end
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

defmodule CastmillWeb.DeviceController do
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Devices
  alias Castmill.Resources

  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour
  # Allow access for the player start page
  # def check_access(_actor_id, _action, _params) do
  #   {:ok, true}
  # end

  def check_access(actor_id, action, %{"device_id" => device_id})
      when action in [:send_command, :get_cache] do
    # Check if the actor has access via the device organization
    device = Devices.get_device(device_id)
    organization_id = device.organization_id

    if Organizations.has_access(organization_id, actor_id, "devices", action) do
      {:ok, true}
    else
      # TODO: Check if the actor has access via teams
      {:ok, false}
    end
  end

  # A device will have access for most actions on itself (but not all,
  # like sending commands to itself, removing itself, etc).
  def check_access(actor_id, _action, %{"device_id" => device_id}) do
    {:ok, actor_id == device_id}
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(actor_id, action, params) do
    IO.inspect("Default check_access #{inspect({actor_id, action, params})}")
    {:ok, false}
  end

  plug(
    AuthorizeDash,
    %{} when action in [:send_command, :add_calendar, :remove_calendar]
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

  @get_cache_pagination_schema %{
    device_id: [type: :string],
    type: [type: :string, allowed: ["code", "data", "media"], default: "data"],
    page: [type: :integer, number: [min: 1]],
    page_size: [type: :integer, number: [min: 1, max: 100]]
  }

  def get_cache(conn, %{"device_id" => device_id} = params) do
    with {:ok, params} <- Tarams.cast(params, @get_cache_pagination_schema) do
      pid = self()

      # Serialize PID to a string and encode it to be used as a reference
      ref =
        pid
        |> :erlang.term_to_binary()
        |> Base.url_encode64()

      # TODO: If the device is offline, we should just return error.

      # Broadcast to the Device channel. Currently we do not wait for a response.
      Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{
        get: "cache",
        payload: %{
          resource: "cache",
          opts: %{
            page: params.page,
            page_size: params.page_size,
            type: params.type,
            ref: ref
          }
        }
      })

      # Wait for the response
      receive do
        {:device_response, data} ->
          conn
          |> put_status(:ok)
          |> json(data)
      after
        5_000 ->
          conn
          |> put_status(:bad_request)
          |> json(%{error: "No response from WebSocket client"})
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  # Not used?
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
    Not used?
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

  def create(conn, %{}) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "The fields 'name', 'pincode' and 'organization_id' are required"})
  end

  @doc """
    Sends a command to a device.
  """
  @allowed_commands [
    "restart_app",
    "restart_device",
    "refresh",
    "clear_cache",
    "update_app",
    "update_firmware"
  ]

  def send_command(conn, %{"device_id" => device_id, "command" => command})
      when command in @allowed_commands do
    # Broadcast to the Device channel. Currently we do not wait for a response.
    Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{command: command})

    conn
    |> put_status(:ok)
    |> send_resp(200, "")
  end

  def send_command(conn, %{"device_id" => _device_id, "command" => command}) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "The command '#{command}' is not allowed"})
  end

  def send_command(conn, %{}) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "The fields 'device_id' and 'command' are required"})
  end

  @doc """
    Lists the device events
  """
  def list_events(conn, %{"device_id" => _device_id} = params) do
    with {:ok, params} <-
           Tarams.cast(params, %{
             device_id: [type: :string, required: true],
             page: [type: :integer, number: [min: 1]],
             page_size: [type: :integer, number: [min: 1, max: 100]],
             search: :string
           }) do
      response = %{
        data: Devices.list_devices_events(params),
        count: Devices.count_devices_events(params)
      }

      conn
      |> put_status(:ok)
      |> json(response)
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end
end

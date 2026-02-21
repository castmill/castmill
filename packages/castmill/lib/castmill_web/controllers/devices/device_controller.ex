defmodule CastmillWeb.DeviceController do
  require Logger

  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Organizations
  alias Castmill.Devices
  alias Castmill.Resources

  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @impl CastmillWeb.AccessActorBehaviour

  def check_access(actor_id, action, %{"device_id" => device_id})
      when action in [
             :send_command,
             :get_cache,
             :delete_cache,
             :get_channels,
             :add_channel,
             :remove_channel,
             :list_events,
             :delete_events,
             :get_telemetry
           ] do
    # Device can access its own resources for these actions
    if actor_id == device_id do
      {:ok, true}
    else
      device = Devices.get_device(device_id)
      organization_id = device.organization_id

      if Organizations.has_access(organization_id, actor_id, "devices", action) do
        {:ok, true}
      else
        # TODO: Check if the actor has access via teams
        {:ok, false}
      end
    end
  end

  # For get_playlist action in dashboard context:
  # - If actor is the device itself, check if playlist is assigned to it
  # - If actor is a user, check if they have access to view the device
  #   (users who can see devices can see the preview/playlist content)
  def check_access(actor_id, :get_playlist, %{
        "device_id" => device_id,
        "playlist_id" => playlist_id
      }) do
    # Device can access its own assigned playlists
    if actor_id == device_id do
      {:ok, Devices.has_access_to_playlist(device_id, playlist_id)}
    else
      # For dashboard users: if they can view the device, they can view the preview
      # But we still verify the playlist is actually assigned to this device for security
      device = Devices.get_device(device_id)

      if device do
        organization_id = device.organization_id
        # Use :get_channels action which maps to :show permission (viewing devices)
        user_can_view_device =
          Organizations.has_access(organization_id, actor_id, "devices", :get_channels)

        playlist_assigned = Devices.has_access_to_playlist(device_id, playlist_id)

        {:ok, user_can_view_device and playlist_assigned}
      else
        {:ok, false}
      end
    end
  end

  # A device will have access for most actions on itself (but not all,
  # like sending commands to itself, removing itself, etc).
  # TODO: add when clause to limit the actions that are allowed
  def check_access(actor_id, _action, %{"device_id" => device_id}) do
    {:ok, actor_id == device_id}
  end

  # Default implementation for other actions not explicitly handled above
  def check_access(_actor_id, _action, _params) do
    {:ok, false}
  end

  plug(
    AuthorizeDash,
    %{}
    when action in [
           :send_command,
           :get_cache,
           :delete_cache,
           :delete_events,
           :add_channel,
           :remove_channel,
           :get_channels,
           :get_playlist,
           :list_events,
           :get_telemetry
         ]
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

    # Try to recover the device through the hardware_id
    case Devices.recover_device(hardware_id, device_attrs.device_ip) do
      {:ok, device} ->
        Logger.info("Device recovered: #{device.hardware_id} (#{device.name})")

        conn
        |> put_status(:ok)
        |> render(:recover, device: device)

      {:error, _reason} ->
        case Castmill.Devices.create_device_registration(device_attrs) do
          {:ok, device} ->
            Logger.info("New device registered: #{device.hardware_id}")

            conn
            |> put_status(:created)
            |> render(:show, device: device)

          {:error, changeset} ->
            Logger.error("Device registration failed: #{inspect(changeset.errors)}")

            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "Failed to create device"})
        end
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

  @delete_cache_schema %{
    device_id: [type: :string],
    type: [type: :string, allowed: ["code", "data", "media", "all"]],
    urls: [type: {:array, :string}]
  }

  def delete_cache(conn, %{"device_id" => device_id} = params) do
    with {:ok, params} <- Tarams.cast(params, @delete_cache_schema) do
      pid = self()

      # Serialize PID to a string and encode it to be used as a reference
      ref =
        pid
        |> :erlang.term_to_binary()
        |> Base.url_encode64()

      # Broadcast delete command to the Device channel
      Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{
        delete: "cache",
        payload: %{
          resource: "cache",
          opts: %{
            type: params.type,
            urls: params.urls,
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
          |> json(%{error: "No response from device"})
      end
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end

  def get_telemetry(conn, %{"device_id" => device_id}) do
    pid = self()

    ref =
      pid
      |> :erlang.term_to_binary()
      |> Base.url_encode64()

    Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{
      get: "telemetry",
      payload: %{
        resource: "telemetry",
        opts: %{
          ref: ref
        }
      }
    })

    receive do
      {:device_response, data} ->
        conn
        |> put_status(:ok)
        |> json(data)
    after
      5_000 ->
        conn
        |> put_status(:request_timeout)
        |> json(%{error: "No response from device. It may be offline."})
    end
  end

  # Not used?
  def index(conn, params) do
    devices = Organizations.list_devices(params)
    render(conn, :index, devices: devices)
  end

  @doc """
    Returns channels associated to this player
  """
  def get_channels(conn, %{"device_id" => device_id}) do
    channels = Devices.list_channels(device_id)

    conn
    |> put_status(:ok)
    |> put_resp_header("content-type", "application/json")
    |> json(%{data: channels})
  end

  @doc """
    Returns the given playlist.
    Authorization is handled by check_access/3 which verifies:
    - For devices: the playlist is assigned to the device via a channel
    - For dashboard users: the user can view the device AND the playlist is assigned to it
  """
  def get_playlist(conn, %{"device_id" => _device_id, "playlist_id" => playlist_id}) do
    case Resources.get_playlist(playlist_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Playlist not found"})

      playlist ->
        conn
        |> put_status(:ok)
        |> put_resp_header("content-type", "application/json")
        |> json(playlist)
    end
  end

  @doc """
    Adds a channel to a device
  """
  def add_channel(conn, %{"device_id" => device_id, "channel_id" => channel_id}) do
    with {:ok, _device} <- Devices.add_channel(device_id, channel_id) do
      # Get the full channel data to send to the device
      channel = Castmill.Resources.get_channel(channel_id)

      # Notify the device about the new channel via WebSocket
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "devices:#{device_id}",
        %{
          event: "channel_added",
          channel: %{
            id: channel.id,
            name: channel.name,
            timezone: channel.timezone,
            default_playlist_id: channel.default_playlist_id,
            entries: []
          }
        }
      )

      conn
      |> put_status(:ok)
      |> send_resp(200, "")
    end
  end

  @doc """
    Removes a channel from a device
  """
  def remove_channel(conn, %{"device_id" => device_id, "channel_id" => channel_id}) do
    with {num_deleted, nil} <- Devices.remove_channel(device_id, channel_id) do
      # Notify the device about the removed channel via WebSocket
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "devices:#{device_id}",
        %{
          event: "channel_removed",
          channel_id: String.to_integer(channel_id)
        }
      )

      conn
      |> put_status(:ok)
      |> json(%{message: "#{num_deleted} channels removed successfully"})
    else
      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Failed to remove channel", reason: reason})
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
             page: [type: :integer, number: [min: 1], default: 1],
             page_size: [type: :integer, number: [min: 1, max: 100], default: 10],
             search: :string,
             key: [type: :string, default: "timestamp"],
             direction: [type: :string, default: "descending"],
             types: :string
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

  @doc """
    Deletes device events
  """
  def delete_events(conn, %{"device_id" => _device_id} = params) do
    with {:ok, params} <-
           Tarams.cast(params, %{
             device_id: [type: :string, required: true],
             type: [type: :string]
           }) do
      deleted_count = Devices.delete_devices_events(params)

      conn
      |> put_status(:ok)
      |> json(%{success: true, deleted: deleted_count})
    else
      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Phoenix.Controller.json(%{errors: errors})
        |> halt()
    end
  end
end

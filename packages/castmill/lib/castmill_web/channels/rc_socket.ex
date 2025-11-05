defmodule CastmillWeb.RcSocket do
  @moduledoc """
  Socket for Remote Control WebSocket connections.
  
  This socket handles both device RC connections and dashboard RC window connections.
  """
  use Phoenix.Socket

  ## Channels
  channel "device_rc:*", CastmillWeb.DeviceRcChannel
  channel "device_media:*", CastmillWeb.DeviceMediaChannel
  channel "rc_window:*", CastmillWeb.RcWindowChannel

  @impl true
  def connect(params, socket, _connect_info) do
    # For device connections, no user_id needed
    # For RC window connections, user_id is required
    socket = case params["user_id"] do
      nil -> socket
      user_id -> assign(socket, :user_id, user_id)
    end

    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end

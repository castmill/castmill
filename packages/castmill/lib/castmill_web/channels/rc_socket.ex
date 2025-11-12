defmodule CastmillWeb.RcSocket do
  @moduledoc """
  Socket for Remote Control WebSocket connections.
  
  This socket handles both device RC connections and dashboard RC window connections.
  Device connections are authenticated via device tokens in the channel join.
  RC window connections require Phoenix.Token authentication for user identity.
  """
  use Phoenix.Socket

  alias Castmill.Accounts

  ## Channels
  channel "device_rc:*", CastmillWeb.DeviceRcChannel
  channel "device_media:*", CastmillWeb.DeviceMediaChannel
  channel "rc_window:*", CastmillWeb.RcWindowChannel

  @impl true
  def connect(params, socket, _connect_info) do
    # For device connections: no token needed here, device auth happens in channel join
    # For RC window connections: require user token authentication
    case params do
      %{"token" => token} ->
        # Authenticate user for RC window connections
        authenticate_user(token, socket)

      # Device connections don't pass a token here; they authenticate in channel join
      _ ->
        {:ok, socket}
    end
  end

  @impl true
  def id(_socket), do: nil

  # Private functions

  defp authenticate_user(token, socket) do
    with {:ok, user_id} <-
           Phoenix.Token.verify(
             CastmillWeb.Endpoint,
             CastmillWeb.Secrets.get_dashboard_user_token_salt(),
             token,
             max_age: 86_400
           ),
         user <- Accounts.get_user(user_id),
         true <- not is_nil(user) do
      {:ok, assign(socket, :user, user)}
    else
      _ ->
        {:error, %{reason: "unauthorized"}}
    end
  end
end

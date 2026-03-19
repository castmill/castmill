defmodule CastmillWeb.UserSocket do
  use Phoenix.Socket

  require Logger

  # A Socket handler for user connections
  # This socket is used for performing real-time updates on the user's browser
  # for example for keeping device online status up to date.

  ## Channels
  channel("device_updates:*", CastmillWeb.DeviceUpdatesChannel)
  channel("resource:*", CastmillWeb.ResourceUpdatesChannel)
  channel("users:*", CastmillWeb.UsersChannel)
  channel("notifications:*", CastmillWeb.NotificationsChannel)

  def connect(%{"token" => token}, socket, _connect_info) do
    with {:ok, user_id} <-
           Phoenix.Token.verify(
             CastmillWeb.Endpoint,
             CastmillWeb.Secrets.get_dashboard_user_token_salt(),
             token,
             max_age: 86_400
           ),
         true <- is_binary(user_id) and user_id != "",
         %{} = user <- Castmill.Accounts.get_user(user_id) do
      {:ok, assign(socket, :user, user)}
    else
      {:error, :expired} ->
        Logger.info("UserSocket connect rejected: token expired")
        {:error, %{reason: "token_expired"}}

      {:error, :invalid} ->
        Logger.warning("UserSocket connect rejected: invalid token")
        {:error, %{reason: "invalid_token"}}

      nil ->
        Logger.warning("UserSocket connect rejected: user not found")
        {:error, %{reason: "user_not_found"}}

      other ->
        Logger.warning("UserSocket connect rejected: #{inspect(other)}")
        {:error, %{reason: "unauthorized"}}
    end
  rescue
    e ->
      Logger.error("UserSocket connect crash: #{Exception.message(e)}")
      {:error, %{reason: "internal_error"}}
  end

  def connect(_params, _socket, _connect_info) do
    Logger.warning("UserSocket connect rejected: no token provided")
    {:error, %{reason: "no_token"}}
  end

  def id(socket), do: "user_socket:#{socket.assigns.user.id}"
end

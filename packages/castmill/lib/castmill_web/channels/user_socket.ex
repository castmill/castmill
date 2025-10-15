defmodule CastmillWeb.UserSocket do
  use Phoenix.Socket

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
         true <- not is_nil(user_id),
         user <- Castmill.Accounts.get_user(user_id),
         true <- not is_nil(user) do
      {:ok, assign(socket, :user, user)}
    else
      _ ->
        {:error, %{reason: "unauthorized"}}
    end
  end

  def id(_socket), do: "user_socket"
end

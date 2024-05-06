defmodule CastmillWeb.UsersChannel do
  use CastmillWeb, :channel

  @impl true
  def join("users:" <> user_id, _params, socket) do
    if authorized?(user_id, socket) do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Only the user can join its own channel
  defp authorized?(user_id, socket) do
    %{:id => id} =
      socket.assigns.user

    user_id == id
  end
end

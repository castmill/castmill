defmodule CastmillWeb.ResourceUpdatesChannel do
  use CastmillWeb, :channel
  alias Castmill.Organizations

  require Logger

  @impl true
  def join("resource:media:" <> media_id, _params, socket) do
    %{:user => user} = socket.assigns

    Logger.info("User #{user.id} is joining updates channel for media #{media_id}")

    if authorized?(user.id, %{"resource" => "media", "id" => media_id}) do
      {:ok, assign(socket, :media_id, media_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Handle all messages that are not handled by the
  # `handle_in/3` callbacks above
  @impl true
  def handle_in(event, payload, socket) do
    IO.puts("Unhandled event #{inspect(event)} #{inspect(payload)}")
    {:noreply, socket}
  end

  @impl true
  def terminate(reason, _socket) do
    Logger.info("ResourceUpdatesChannel terminated #{inspect(reason)}")
    :ok
  end

  # Handle broadcasted messages from the resource channel via PubSub
  @impl true
  def handle_info(data, socket) do
    push(socket, "update", data)
    {:noreply, socket}
  end

  # We need to verify if the user is authorized to access this resource.
  defp authorized?(actor_id, %{"resource" => "media", "id" => media_id}) do
    media = Castmill.Resources.get_media(media_id)

    case media do
      nil ->
        false

      _ ->
        Organizations.has_access(media.organization_id, actor_id, "medias", "read")
    end
  end
end

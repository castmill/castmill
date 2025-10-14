defmodule CastmillWeb.NotificationsChannel do
  use CastmillWeb, :channel

  alias Castmill.Notifications

  @impl true
  def join("notifications:" <> user_id, _params, socket) do
    if authorized?(user_id, socket) do
      # Send current unread count on join
      count = Notifications.count_unread_notifications(user_id)
      {:ok, %{unread_count: count}, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_in("mark_read", %{"id" => id}, socket) do
    case Notifications.mark_as_read(id) do
      {:ok, _notification} ->
        user_id = socket.assigns.user.id
        count = Notifications.count_unread_notifications(user_id)
        {:reply, {:ok, %{unread_count: count}}, socket}

      {:error, _reason} ->
        {:reply, {:error, %{reason: "not_found"}}, socket}
    end
  end

  @impl true
  def handle_in("mark_all_read", _params, socket) do
    user_id = socket.assigns.user.id
    {count, _} = Notifications.mark_all_as_read(user_id)
    {:reply, {:ok, %{marked_read: count, unread_count: 0}}, socket}
  end

  # Listen for notifications broadcast via PubSub
  @impl true
  def handle_info({:new_notification, notification}, socket) do
    user_id = socket.assigns.user.id
    count = Notifications.count_unread_notifications(user_id)
    
    push(socket, "new_notification", %{
      notification: %{
        id: notification.id,
        title: notification.title,
        description: notification.description,
        link: notification.link,
        type: notification.type,
        read: notification.read,
        metadata: notification.metadata,
        inserted_at: notification.inserted_at
      },
      unread_count: count
    })

    {:noreply, socket}
  end

  # Only the user can join their own notification channel
  defp authorized?(user_id, socket) do
    %{:id => id} = socket.assigns.user
    user_id == id
  end
end

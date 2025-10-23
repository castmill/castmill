defmodule CastmillWeb.NotificationsChannel do
  use CastmillWeb, :channel

  alias Castmill.Notifications
  alias Castmill.Repo
  alias Castmill.Accounts.User

  @impl true
  def join("notifications:" <> user_id, _params, socket) do
    require Logger

    if authorized?(user_id, socket) do
      # Subscribe to user's personal notification channel
      Phoenix.PubSub.subscribe(Castmill.PubSub, "users:#{user_id}")
      Logger.info("User #{user_id} subscribed to personal channel: users:#{user_id}")

      # Subscribe to all organization channels the user belongs to
      # Note: We only preload organizations since teams association doesn't exist yet
      user = Repo.get(User, user_id) |> Repo.preload([:organizations])

      Enum.each(user.organizations, fn org ->
        Phoenix.PubSub.subscribe(Castmill.PubSub, "organization:#{org.id}")
        Logger.info("User #{user_id} subscribed to organization channel: organization:#{org.id}")
      end)

      # TODO: Subscribe to team channels when teams association is added to User schema
      # Enum.each(user.teams, fn team ->
      #   Phoenix.PubSub.subscribe(Castmill.PubSub, "team:#{team.id}")
      # end)

      # Send current unread count on join
      count = Notifications.count_unread_notifications(user_id)
      Logger.info("User #{user_id} joined notifications channel, unread count: #{count}")
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

  # Listen for notifications broadcast via PubSub (with pre-computed count)
  @impl true
  def handle_info({:new_notification, notification, unread_count}, socket) do
    require Logger

    user_id = socket.assigns.user.id
    notif_id = notification[:id] || notification.id

    Logger.info(
      "NotificationsChannel received notification #{notif_id} for user #{user_id} with count #{unread_count}"
    )

    payload = %{
      notification: normalize_notification(notification),
      unread_count: unread_count
    }

    push(socket, "new_notification", payload)

    {:noreply, socket}
  end

  # Listen for notifications broadcast via PubSub (compute count)
  @impl true
  def handle_info({:new_notification, notification}, socket) do
    require Logger

    user_id = socket.assigns.user.id
    notif_id = notification[:id] || notification.id

    Logger.info("NotificationsChannel received notification #{notif_id} for user #{user_id}")

    count = Notifications.count_unread_notifications(user_id)

    payload = %{
      notification: normalize_notification(notification),
      unread_count: count
    }

    Logger.info("Pushing notification payload to WebSocket: #{inspect(payload)}")
    push(socket, "new_notification", payload)
    Logger.info("Pushed notification to user #{user_id} via WebSocket, unread count: #{count}")

    {:noreply, socket}
  end

  # Handle notification_read event broadcast
  @impl true
  def handle_info({:notification_read, notification_id, unread_count}, socket) do
    require Logger

    user_id = socket.assigns.user.id

    Logger.info(
      "NotificationsChannel received notification_read for notification #{notification_id}, user #{user_id}"
    )

    push(socket, "notification_read", %{id: notification_id, unread_count: unread_count})

    {:noreply, socket}
  end

  # Catch-all for debugging - log any unhandled messages
  @impl true
  def handle_info(msg, socket) do
    require Logger
    Logger.warning("NotificationsChannel received unhandled message: #{inspect(msg)}")
    {:noreply, socket}
  end

  # Helper to normalize notification (handles both struct and map)
  defp normalize_notification(notification) do
    %{
      id: notification[:id] || notification.id,
      title_key: notification[:title_key] || Map.get(notification, :title_key),
      description_key: notification[:description_key] || Map.get(notification, :description_key),
      link: notification[:link] || Map.get(notification, :link),
      type: notification[:type] || Map.get(notification, :type),
      read: notification[:read] || Map.get(notification, :read, false),
      metadata: notification[:metadata] || Map.get(notification, :metadata),
      inserted_at: notification[:inserted_at] || Map.get(notification, :inserted_at)
    }
  end

  # Only the user can join their own notification channel
  defp authorized?(user_id, socket) do
    %{:id => id} = socket.assigns.user
    user_id == id
  end
end

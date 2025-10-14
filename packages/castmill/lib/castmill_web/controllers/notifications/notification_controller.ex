defmodule CastmillWeb.NotificationController do
  use CastmillWeb, :controller

  alias Castmill.Notifications
  alias Castmill.Notifications.Notification

  action_fallback CastmillWeb.FallbackController

  @doc """
  Lists notifications for the current user.
  Supports pagination with page and page_size query params.
  """
  def index(conn, params) do
    user = conn.assigns.user
    page = Map.get(params, "page", "1") |> String.to_integer()
    page_size = Map.get(params, "page_size", "20") |> String.to_integer()

    notifications = Notifications.list_user_notifications(user.id, page: page, page_size: page_size)
    unread_count = Notifications.count_unread_notifications(user.id)

    render(conn, :index, notifications: notifications, unread_count: unread_count)
  end

  @doc """
  Gets count of unread notifications for the current user.
  """
  def unread_count(conn, _params) do
    user = conn.assigns.user
    count = Notifications.count_unread_notifications(user.id)

    json(conn, %{count: count})
  end

  @doc """
  Marks a notification as read.
  """
  def mark_read(conn, %{"id" => id}) do
    with {:ok, notification} <- Notifications.mark_as_read(id) do
      render(conn, :show, notification: notification)
    end
  end

  @doc """
  Marks all notifications as read for the current user.
  """
  def mark_all_read(conn, _params) do
    user = conn.assigns.user
    {count, _} = Notifications.mark_all_as_read(user.id)

    json(conn, %{marked_read: count})
  end
end

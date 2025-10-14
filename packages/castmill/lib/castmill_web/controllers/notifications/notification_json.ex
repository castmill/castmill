defmodule CastmillWeb.NotificationJSON do
  alias Castmill.Notifications.Notification

  @doc """
  Renders a list of notifications.
  """
  def index(%{notifications: notifications, unread_count: unread_count}) do
    %{
      data: for(notification <- notifications, do: data(notification)),
      unread_count: unread_count
    }
  end

  @doc """
  Renders a single notification.
  """
  def show(%{notification: notification}) do
    %{data: data(notification)}
  end

  defp data(%Notification{} = notification) do
    %{
      id: notification.id,
      title: notification.title,
      description: notification.description,
      link: notification.link,
      type: notification.type,
      read: notification.read,
      metadata: notification.metadata,
      inserted_at: notification.inserted_at,
      updated_at: notification.updated_at
    }
  end
end

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
      title_key: notification.title_key,
      description_key: notification.description_key,
      link: notification.link,
      type: notification.type,
      read: notification.read,
      metadata: notification.metadata,
      roles: notification.roles || [],
      inserted_at: notification.inserted_at,
      updated_at: notification.updated_at
    }
  end
end

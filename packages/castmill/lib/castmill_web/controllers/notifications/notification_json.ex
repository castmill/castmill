defmodule CastmillWeb.NotificationJSON do
  alias Castmill.Notifications.Notification

  @doc """
  Renders a list of notifications. `has_more` says whether older
  notifications may follow; a page can be short while more follow.
  """
  def index(%{notifications: notifications, unread_count: unread_count} = assigns) do
    %{
      data: for(notification <- notifications, do: data(notification)),
      unread_count: unread_count,
      has_more: Map.get(assigns, :has_more, false)
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

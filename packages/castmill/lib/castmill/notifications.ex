defmodule Castmill.Notifications do
  @moduledoc """
  The Notifications context.
  Provides functionality for creating, reading, and managing notifications.
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Notifications.Notification
  alias Castmill.Accounts.User
  alias Castmill.Organizations.Organization
  alias Castmill.Teams.Team

  @doc """
  Creates a notification for a specific user.
  
  ## Examples
  
      iex> create_user_notification(%{title: "Welcome", type: "system", user_id: user_id})
      {:ok, %Notification{}}
  """
  def create_user_notification(attrs) do
    %Notification{}
    |> Notification.changeset(attrs)
    |> Repo.insert()
    |> broadcast_notification()
  end

  @doc """
  Creates a notification for all users in an organization.
  """
  def create_organization_notification(attrs) do
    %Notification{}
    |> Notification.changeset(attrs)
    |> Repo.insert()
    |> broadcast_notification()
  end

  @doc """
  Creates a notification for all users in a team.
  """
  def create_team_notification(attrs) do
    %Notification{}
    |> Notification.changeset(attrs)
    |> Repo.insert()
    |> broadcast_notification()
  end

  @doc """
  Lists notifications for a specific user with pagination.
  Includes organization and team notifications.
  """
  def list_user_notifications(user_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    page_size = Keyword.get(opts, :page_size, 20)
    offset = max((page - 1) * page_size, 0)

    # Get user's organizations and teams
    user = Repo.get(User, user_id) |> Repo.preload([:organizations, :teams])
    org_ids = Enum.map(user.organizations, & &1.id)
    team_ids = Enum.map(user.teams, & &1.id)

    query =
      from n in Notification,
        where: n.user_id == ^user_id or n.organization_id in ^org_ids or n.team_id in ^team_ids,
        order_by: [desc: n.inserted_at],
        limit: ^page_size,
        offset: ^offset

    Repo.all(query)
  end

  @doc """
  Counts unread notifications for a user.
  """
  def count_unread_notifications(user_id) do
    # Get user's organizations and teams
    user = Repo.get(User, user_id) |> Repo.preload([:organizations, :teams])
    org_ids = Enum.map(user.organizations, & &1.id)
    team_ids = Enum.map(user.teams, & &1.id)

    query =
      from n in Notification,
        where:
          (n.user_id == ^user_id or n.organization_id in ^org_ids or n.team_id in ^team_ids) and
            n.read == false

    Repo.aggregate(query, :count, :id)
  end

  @doc """
  Marks a notification as read.
  """
  def mark_as_read(notification_id) do
    case Repo.get(Notification, notification_id) do
      nil ->
        {:error, :not_found}

      notification ->
        notification
        |> Notification.changeset(%{read: true})
        |> Repo.update()
    end
  end

  @doc """
  Marks multiple notifications as read.
  """
  def mark_all_as_read(user_id) do
    # Get user's organizations and teams
    user = Repo.get(User, user_id) |> Repo.preload([:organizations, :teams])
    org_ids = Enum.map(user.organizations, & &1.id)
    team_ids = Enum.map(user.teams, & &1.id)

    query =
      from n in Notification,
        where:
          (n.user_id == ^user_id or n.organization_id in ^org_ids or n.team_id in ^team_ids) and
            n.read == false

    Repo.update_all(query, set: [read: true, updated_at: DateTime.utc_now()])
  end

  @doc """
  Deletes a notification.
  """
  def delete_notification(%Notification{} = notification) do
    Repo.delete(notification)
  end

  # Private function to broadcast notification via Phoenix PubSub
  defp broadcast_notification({:ok, notification} = result) do
    # Broadcast to user channel if user_id is present
    if notification.user_id do
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "users:#{notification.user_id}",
        {:new_notification, notification}
      )
    end

    # Broadcast to organization channel if organization_id is present
    if notification.organization_id do
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "organization:#{notification.organization_id}",
        {:new_notification, notification}
      )
    end

    # Broadcast to team channel if team_id is present
    if notification.team_id do
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "team:#{notification.team_id}",
        {:new_notification, notification}
      )
    end

    result
  end

  defp broadcast_notification(error), do: error
end

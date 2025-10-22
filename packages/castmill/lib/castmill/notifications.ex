defmodule Castmill.Notifications do
  @moduledoc """
  The Notifications context.
  Provides functionality for creating, reading, and managing notifications.
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Notifications.Notification
  alias Castmill.Accounts.User

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
  Filters organization/team notifications by user's role if roles are specified.
  """
  def list_user_notifications(user_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    page_size = Keyword.get(opts, :page_size, 20)
    offset = max((page - 1) * page_size, 0)

    # Get user's organizations with roles
    user = Repo.get(User, user_id) |> Repo.preload([:organizations])

    # Get organization IDs and user's roles in those organizations
    org_roles = get_user_organization_roles(user_id, user.organizations)
    org_ids = Enum.map(user.organizations, & &1.id)

    # Get team IDs and user's roles in those teams
    team_roles = get_user_team_roles(user_id)
    team_ids = Map.keys(team_roles)

    # Build query with role filtering
    query =
      from n in Notification,
        # User-specific notifications
        # Organization notifications
        # Team notifications
        where:
          n.user_id == ^user_id or
            n.organization_id in ^org_ids or
            n.team_id in ^team_ids,
        order_by: [desc: n.inserted_at],
        limit: ^page_size,
        offset: ^offset

    # Get all notifications and filter by roles in application code
    Repo.all(query)
    |> Enum.filter(fn notification ->
      # Check if user is excluded from this notification
      excluded_user_ids = get_in(notification.metadata, ["excluded_user_ids"]) || []
      user_is_excluded = user_id in excluded_user_ids

      cond do
        # Skip if user is explicitly excluded
        user_is_excluded ->
          false

        # User-specific notifications always included
        notification.user_id == user_id ->
          true

        # Organization notifications - check role if roles specified
        notification.organization_id && notification.organization_id in org_ids ->
          role_matches?(notification.roles, Map.get(org_roles, notification.organization_id))

        # Team notifications - check role if roles specified
        notification.team_id && notification.team_id in team_ids ->
          role_matches?(notification.roles, Map.get(team_roles, notification.team_id))

        true ->
          false
      end
    end)
  end

  @doc """
  Lists all notifications for an organization.
  Returns notifications in reverse chronological order.
  """
  def list_organization_notifications(organization_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    page_size = Keyword.get(opts, :page_size, 20)
    offset = max((page - 1) * page_size, 0)

    from(n in Notification,
      where: n.organization_id == ^organization_id,
      order_by: [desc: n.inserted_at],
      limit: ^page_size,
      offset: ^offset
    )
    |> Repo.all()
  end

  # Check if user's role matches notification role requirements
  # No role restriction
  defp role_matches?([], _user_role), do: true
  # User has no role
  defp role_matches?(_roles, nil), do: false

  defp role_matches?(roles, user_role) do
    Enum.member?(roles, Atom.to_string(user_role))
  end

  # Get user's roles in organizations
  defp get_user_organization_roles(user_id, organizations) do
    org_ids = Enum.map(organizations, & &1.id)

    from(ou in Castmill.Organizations.OrganizationsUsers,
      where: ou.user_id == ^user_id and ou.organization_id in ^org_ids,
      select: {ou.organization_id, ou.role}
    )
    |> Repo.all()
    |> Enum.into(%{})
  end

  # Get user's roles in teams
  defp get_user_team_roles(user_id) do
    from(tu in Castmill.Teams.TeamsUsers,
      where: tu.user_id == ^user_id,
      select: {tu.team_id, tu.role}
    )
    |> Repo.all()
    |> Enum.into(%{})
  end

  @doc """
  Counts unread notifications for a user.
  Includes role-based filtering for organization/team notifications.
  """
  def count_unread_notifications(user_id) do
    # Get user's organizations with roles
    user = Repo.get(User, user_id) |> Repo.preload([:organizations])

    # Get organization IDs and user's roles in those organizations
    org_roles = get_user_organization_roles(user_id, user.organizations)
    org_ids = Enum.map(user.organizations, & &1.id)

    # Get team IDs and user's roles in those teams
    team_roles = get_user_team_roles(user_id)
    team_ids = Map.keys(team_roles)

    query =
      from n in Notification,
        where:
          (n.user_id == ^user_id or n.organization_id in ^org_ids or n.team_id in ^team_ids) and
            n.read == false

    # Get all unread notifications and filter by roles
    Repo.all(query)
    |> Enum.filter(fn notification ->
      # Check if user is excluded from this notification
      excluded_user_ids = get_in(notification.metadata, ["excluded_user_ids"]) || []
      user_is_excluded = user_id in excluded_user_ids

      cond do
        # Skip if user is explicitly excluded
        user_is_excluded ->
          false

        # User-specific notifications always included
        notification.user_id == user_id ->
          true

        # Organization notifications - check role if roles specified
        notification.organization_id && notification.organization_id in org_ids ->
          role_matches?(notification.roles, Map.get(org_roles, notification.organization_id))

        # Team notifications - check role if roles specified
        notification.team_id && notification.team_id in team_ids ->
          role_matches?(notification.roles, Map.get(team_roles, notification.team_id))

        true ->
          false
      end
    end)
    |> length()
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
    # Get user's organizations
    user = Repo.get(User, user_id) |> Repo.preload([:organizations])
    org_ids = Enum.map(user.organizations, & &1.id)

    # Get team IDs from TeamsUsers join table
    team_roles = get_user_team_roles(user_id)
    team_ids = Map.keys(team_roles)

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
    require Logger

    # Broadcast to user channel if user_id is present
    if notification.user_id do
      Logger.info(
        "Broadcasting notification #{notification.id} to user channel: users:#{notification.user_id}"
      )

      unread_count = count_unread_notifications(notification.user_id)

      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "users:#{notification.user_id}",
        {:new_notification, notification, unread_count}
      )
    end

    # Broadcast to organization channel if organization_id is present
    if notification.organization_id do
      Logger.info(
        "Broadcasting notification #{notification.id} to organization channel: organization:#{notification.organization_id}"
      )

      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "organization:#{notification.organization_id}",
        {:new_notification, notification, 0}
      )
    end

    # Broadcast to team channel if team_id is present
    if notification.team_id do
      Logger.info(
        "Broadcasting notification #{notification.id} to team channel: team:#{notification.team_id}"
      )

      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "team:#{notification.team_id}",
        {:new_notification, notification, 0}
      )
    end

    result
  end

  defp broadcast_notification(error), do: error
end

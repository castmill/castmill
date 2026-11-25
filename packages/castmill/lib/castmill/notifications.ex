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

  Pass `broadcast: false` to only insert it, for example inside a transaction,
  and call `broadcast_created/1` after the transaction commits.

  ## Examples

      iex> create_user_notification(%{title: "Welcome", type: "system", user_id: user_id})
      {:ok, %Notification{}}
  """
  def create_user_notification(attrs, opts \\ []) do
    result =
      %Notification{}
      |> Notification.changeset(attrs)
      |> Repo.insert()

    if Keyword.get(opts, :broadcast, true), do: broadcast_notification(result), else: result
  end

  @doc """
  Sends a notification created with `broadcast: false` to its recipients'
  open dashboards.
  """
  def broadcast_created(%Notification{} = notification) do
    {:ok, notification} |> broadcast_notification()
    :ok
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
    {notifications, _has_more} = list_user_notifications_page(user_id, opts)
    notifications
  end

  @doc """
  Like `list_user_notifications/2`, and also returns whether older
  notifications may follow. Pages are taken before notifications the user may
  not see are filtered out, so a page can be short, or even empty, while more
  follow.
  """
  def list_user_notifications_page(user_id, opts \\ []) do
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
        # The id breaks ties, so offset pages stay stable.
        order_by: [desc: n.inserted_at, desc: n.id],
        limit: ^page_size,
        offset: ^offset

    rows = Repo.all(query)

    # Filter by roles in application code
    notifications = Enum.filter(rows, &visible?(&1, user_id, org_roles, team_roles))

    {put_actor_names(notifications), length(rows) == page_size}
  end

  @doc """
  Fills in `actor_name` for notifications whose actor is a user, with one
  query. Users that no longer exist leave it `nil`.
  """
  def put_actor_names(notifications) when is_list(notifications) do
    user_ids =
      for %Notification{actor_type: "user", actor_id: id} <- notifications,
          is_binary(id),
          match?({:ok, _}, Ecto.UUID.cast(id)),
          uniq: true,
          do: id

    names =
      if user_ids == [] do
        %{}
      else
        from(u in User, where: u.id in ^user_ids, select: {u.id, u.name})
        |> Repo.all()
        |> Map.new()
      end

    Enum.map(notifications, fn
      %Notification{actor_type: "user", actor_id: id} = notification ->
        %{notification | actor_name: Map.get(names, id)}

      notification ->
        notification
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
    |> Enum.count(&visible?(&1, user_id, org_roles, team_roles))
  end

  @doc """
  Whether `user_id` may see `notification` (a struct, or a map with the same
  keys): the rules of `list_user_notifications_page/2`, for one notification,
  for example before pushing it to the user's open dashboards.
  """
  def visible_to_user?(notification, user_id) do
    org_id = Map.get(notification, :organization_id)
    team_id = Map.get(notification, :team_id)

    org_roles =
      if org_id do
        from(ou in Castmill.Organizations.OrganizationsUsers,
          where: ou.user_id == ^user_id and ou.organization_id == ^org_id,
          select: {ou.organization_id, ou.role}
        )
        |> Repo.all()
        |> Map.new()
      else
        %{}
      end

    team_roles =
      if team_id do
        from(tu in Castmill.Teams.TeamsUsers,
          where: tu.user_id == ^user_id and tu.team_id == ^team_id,
          select: {tu.team_id, tu.role}
        )
        |> Repo.all()
        |> Map.new()
      else
        %{}
      end

    visible?(notification, user_id, org_roles, team_roles)
  end

  # Who sees a notification: the user it is addressed to (only them), else
  # the members of its organization or team with one of its roles (any role
  # when it has none), minus the excluded users.
  defp visible?(notification, user_id, org_roles, team_roles) do
    org_id = Map.get(notification, :organization_id)
    team_id = Map.get(notification, :team_id)
    roles = Map.get(notification, :roles) || []

    cond do
      user_id in excluded_user_ids(notification) ->
        false

      recipient = Map.get(notification, :user_id) ->
        recipient == user_id

      org_id && Map.has_key?(org_roles, org_id) ->
        role_matches?(roles, Map.get(org_roles, org_id))

      team_id && Map.has_key?(team_roles, team_id) ->
        role_matches?(roles, Map.get(team_roles, team_id))

      true ->
        false
    end
  end

  # Stored metadata has string keys; a notification that was just inserted
  # (and is being broadcast) still has the atom keys it was created with.
  defp excluded_user_ids(notification) do
    metadata = Map.get(notification, :metadata) || %{}
    metadata["excluded_user_ids"] || metadata[:excluded_user_ids] || []
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

  @doc """
  Deletes the notifications of `type` that carry `token` in their metadata,
  for example invitation notifications whose link no longer works, whoever
  received them. A single `DELETE ... RETURNING` that uses the token index
  (`notifications_metadata_token_index`), so it returns exactly the deleted
  notifications, for `broadcast_notifications_deleted/1`.
  """
  def delete_notifications_with_token(type, token)
      when is_binary(type) and is_binary(token) do
    {_count, deleted} =
      from(n in Notification,
        where: fragment("(?->>'token')", n.metadata) == ^token and n.type == ^type,
        select: n
      )
      |> Repo.delete_all()

    deleted
  end

  @doc """
  Tells the recipients' open dashboards that `notifications` were deleted,
  with their new unread count. Call it after the deletion has committed.
  """
  def broadcast_notifications_deleted(notifications) do
    notifications
    |> Enum.filter(& &1.user_id)
    |> Enum.group_by(& &1.user_id)
    |> Enum.each(fn {user_id, deleted_notifications} ->
      Phoenix.PubSub.broadcast(
        Castmill.PubSub,
        "users:#{user_id}",
        {:notifications_deleted, Enum.map(deleted_notifications, & &1.id),
         count_unread_notifications(user_id)}
      )
    end)

    :ok
  end

  # Private function to broadcast notification via Phoenix PubSub
  defp broadcast_notification({:ok, notification} = result) do
    require Logger

    # Recipients' dashboards show who did it.
    [notification] = put_actor_names([notification])

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

defmodule Castmill.Teams do
  @moduledoc """
  The Teams context.
  """
  require Logger

  import Ecto.Query, warn: false
  alias Ecto.Multi

  alias Swoosh.Email

  alias Castmill.Mailer
  alias Castmill.Repo

  alias Castmill.Organizations.Organization

  alias Castmill.Teams.{
    Team,
    TeamsUsers,
    TeamsMedias,
    TeamsPlaylists,
    TeamsChannels,
    TeamsDevices,
    TeamsLayouts,
    Invitation
  }

  alias Castmill.Resources.{Media, Playlist, Channel, Layout}
  alias Castmill.Devices.Device
  alias Castmill.QueryHelpers

  @doc """
  Returns the list of teams.

  ## Examples

      iex> list_teams()
      [%Team{}, ...]

  """
  def list_teams(%{
        organization_id: organization_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    Team.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> order_by([t], desc: t.id)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def list_teams(%{search: search, page: page, page_size: page_size}) do
    list_teams(%{organization_id: nil, search: search, page: page, page_size: page_size})
  end

  def list_teams(organization_id) do
    Team.base_query()
    |> Organization.where_org_id(organization_id)
    |> order_by([t], desc: t.id)
    |> Repo.all()
  end

  def count_teams(%{organization_id: organization_id, search: search}) do
    Team.base_query()
    |> Organization.where_org_id(organization_id)
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def count_teams(%{search: search}) do
    count_teams(%{organization_id: nil, search: search})
  end

  @doc """
  Gets a single network.

  Raises `Ecto.NoResultsError` if the Network does not exist.

  ## Examples

      iex> get_network!(123)
      %Network{}

      iex> get_network!(456)
      ** (Ecto.NoResultsError)

  """
  def get_team(id), do: Repo.get(Team, id)

  @doc """
  Creates a team.

  ## Examples

      iex> create_network(%{field: value})
      {:ok, %Network{}}

      iex> create_network(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_team(attrs \\ %{}, creator \\ nil) do
    organization_id = Map.get(attrs, "organization_id") || Map.get(attrs, :organization_id)
    creator_id = normalize_creator(creator)

    # Check quota before creating the team
    with :ok <- check_team_quota(organization_id) do
      multi =
        Multi.new()
        |> Multi.insert(:team, Team.changeset(%Team{}, attrs))

      multi =
        if creator_id do
          Multi.insert(multi, :membership, fn %{team: team} ->
            TeamsUsers.changeset(%TeamsUsers{}, %{
              team_id: team.id,
              user_id: creator_id,
              role: :admin
            })
          end)
        else
          multi
        end

      case Repo.transaction(multi) do
        {:ok, %{team: team}} -> {:ok, team}
        {:error, :team, changeset, _changes_so_far} -> {:error, changeset}
        {:error, :membership, changeset, _changes_so_far} -> {:error, changeset}
      end
    else
      {:error, :quota_exceeded} -> {:error, :quota_exceeded}
    end
  end

  defp normalize_creator(nil), do: nil
  defp normalize_creator(%{id: id}) when is_binary(id), do: id
  defp normalize_creator(id) when is_binary(id), do: id

  defp normalize_creator(other) do
    raise ArgumentError,
          "expected creator to be a user struct with an :id or a UUID string, got: #{inspect(other)}"
  end

  defp check_team_quota(organization_id) do
    current_count = get_quota_used_for_organization(organization_id, Team)
    max_quota = Castmill.Quotas.get_quota_for_organization(organization_id, :teams)

    if current_count < max_quota do
      :ok
    else
      {:error, :quota_exceeded}
    end
  end

  defp get_quota_used_for_organization(organization_id, schema_module) do
    from(r in schema_module,
      where: r.organization_id == ^organization_id,
      select: count(r.id)
    )
    |> Repo.one()
  end

  @doc """
  Updates a team.

  ## Examples

      iex> update_network(network, %{field: new_value})
      {:ok, %Network{}}

      iex> update_network(network, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_team(%Team{} = team, attrs) do
    team
    |> Team.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a team.

  ## Examples

      iex> delete_network(network)
      {:ok, %Network{}}

      iex> delete_network(network)
      {:error, %Ecto.Changeset{}}
  """
  def delete_team(%Team{} = team) do
    Repo.delete(team)
  end

  @doc """
    Add a user to a team with a given role.
  """
  def add_user_to_team(team_id, user_id, role) do
    %TeamsUsers{}
    |> TeamsUsers.changeset(%{team_id: team_id, user_id: user_id, role: role})
    |> Repo.insert()
  end

  def add_resource_to_team(team_id, resource_type, resource_id, access) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, _resource_mod, _assoc_field} ->
        # Build the attributes, dynamically inserting the correct resource_id key
        attrs =
          %{
            team_id: team_id,
            access: access
          }
          |> Map.put(foreign_key, resource_id)

        # Create a struct for the join table
        record = struct(join_mod, attrs)

        # Build the changeset (each join schema should define its own changeset/2)
        changeset = join_mod.changeset(record, attrs)

        # Insert into the DB (returns {:ok, record} or {:error, changeset})
        Repo.insert(changeset)

      nil ->
        {:error, {:unsupported_resource_type, resource_type}}
    end
  end

  def remove_resource_from_team(team_id, resource_type, resource_id) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, _resource_mod, _assoc_field} ->
        # Build a keyword list for Repo.get_by
        fields = [team_id: team_id] |> Keyword.put(foreign_key, resource_id)

        case Repo.get_by(join_mod, fields) do
          nil ->
            # Record doesn't exist, so nothing to remove
            {:error, :not_found}

          record ->
            Repo.delete(record)
        end

      nil ->
        {:error, {:unsupported_resource_type, resource_type}}
    end
  end

  @doc """
    Update access for a resource in a team.
  """
  def update_resource_access(team_id, resource_type, resource_id, access) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, _resource_mod, _assoc_field} ->
        from(j in join_mod,
          where: j.team_id == ^team_id and field(j, ^foreign_key) == ^resource_id
        )
        |> Repo.update_all(set: [access: access])

      nil ->
        {:error, :unsupported_resource_type}
    end
  end

  def remove_user_from_team(team_id, user_id) do
    case Repo.get_by(TeamsUsers, team_id: team_id, user_id: user_id) do
      nil ->
        {:error, :not_found}

      %TeamsUsers{role: :admin} = teams_user ->
        if count_team_admins(team_id) <= 1 do
          {:error, :last_admin}
        else
          result = Repo.delete(teams_user)

          # Send notifications after successful removal
          with {:ok, _} <- result do
            team = get_team(team_id)
            user = Castmill.Accounts.get_user(user_id)

            if user && team do
              Castmill.Notifications.Events.notify_team_member_removed(
                user_id,
                user.name,
                team_id,
                team.name
              )
            end
          end

          result
        end

      teams_user ->
        result = Repo.delete(teams_user)

        # Send notifications after successful removal
        with {:ok, _} <- result do
          team = get_team(team_id)
          user = Castmill.Accounts.get_user(user_id)

          if user && team do
            Castmill.Notifications.Events.notify_team_member_removed(
              user_id,
              user.name,
              team_id,
              team.name
            )
          end
        end

        result
    end
  end

  defp count_team_admins(team_id) do
    TeamsUsers.base_query()
    |> TeamsUsers.where_team_id(team_id)
    |> where([teams_users: tu], tu.role == :admin)
    |> Repo.aggregate(:count, :user_id)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking team changes.

  ## Examples

      iex> change_team(team)
      %Ecto.Changeset{data: %Team{}}

  """
  def change_team(%Team{} = team, attrs \\ %{}) do
    Team.changeset(team, attrs)
  end

  defp maybe_search_by_user_name(query, nil), do: query
  defp maybe_search_by_user_name(query, ""), do: query

  defp maybe_search_by_user_name(query, search) do
    from [user: u] in query,
      where: ilike(u.name, ^"%#{search}%")
  end

  def list_users(params) when is_map(params) do
    # define sensible defaults for all these optional params
    defaults = %{
      team_id: nil,
      page: 1,
      page_size: 10,
      search: nil,
      filters: nil
    }

    # merge the defaults with whatever keys are passed in params
    merged_params = Map.merge(defaults, params)

    do_list_users(merged_params)
  end

  def do_list_users(%{
        team_id: team_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    users =
      TeamsUsers.base_query()
      |> TeamsUsers.where_team_id(team_id)
      |> join(:inner, [tu], u in assoc(tu, :user), as: :user)
      |> maybe_search_by_user_name(search)
      |> order_by([teams_users: _tu, user: u], asc: u.name)
      |> Ecto.Query.limit(^page_size)
      |> Ecto.Query.offset(^offset)
      |> select([teams_users: tu, user: u], %{
        user_id: tu.user_id,
        role: tu.role,
        inserted_at: tu.inserted_at,
        user: %{
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar
        }
      })
      |> Repo.all()

    users
  end

  def count_users(%{
        team_id: team_id,
        search: search
      }) do
    TeamsUsers.base_query()
    |> Team.where_team_id(team_id)
    # |> QueryHelpers.where_name_like(search)
    |> join(:inner, [tu], u in assoc(tu, :user), as: :user)
    |> maybe_search_by_user_name(search)
    |> Repo.aggregate(:count, :user_id)
  end

  @doc """
  Returns a list of resources for the given `resource_type` and parameters.

  ## Parameters

    - `resource_type`: An atom representing which resource to fetch
      (e.g., `:media`, `:playlist`, `:channel`, etc.).
    - `%{team_id: integer(), search: String.t(), page: integer(), page_size: integer()}`:
      A map containing the relevant parameters.

  ## Examples

      iex> list_resources(:media, %{team_id: 1, search: "demo", page: 1, page_size: 10})
      [%Media{}, ...]

  """
  def list_resources(resource_type, params) when is_map(params) do
    defaults = %{
      team_id: nil,
      search: nil,
      page: 1,
      page_size: 10
    }

    merged_params = Map.merge(defaults, params)

    do_list_resources(resource_type, merged_params)
  end

  def do_list_resources(
        resource_type,
        %{
          team_id: team_id,
          search: search,
          page: page,
          page_size: page_size
        }
      ) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, resource_mod, assoc_field} ->
        resource_preloads =
          if function_exported?(resource_mod, :preloads, 0) do
            resource_mod.preloads()
          else
            []
          end

        join_mod.bare_query()
        |> join(:inner, [j], r in ^resource_mod.bare_query(), on: field(j, ^foreign_key) == r.id)
        |> where([j], j.team_id == ^team_id)
        |> where([_, r], like(r.name, ^"%#{search}%"))
        |> paginate(page, page_size)
        |> Repo.all()
        |> Repo.preload([{assoc_field, resource_preloads}])

      nil ->
        IO.inspect("Unsupported resource type: #{resource_type}")
        default_fallback()
    end
  end

  def count_resources(resource_type, %{team_id: team_id, search: search}) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, resource_mod, _assoc_field} ->
        join_mod.bare_query()
        |> join(:inner, [j], r in ^resource_mod.bare_query(), on: field(j, ^foreign_key) == r.id)
        |> where([j], j.team_id == ^team_id)
        |> where([_, r], like(r.name, ^"%#{search}%"))
        |> Repo.aggregate(:count)

      nil ->
        IO.inspect("Unsupported resource type: #{resource_type}")
        default_fallback()
    end
  end

  defp default_fallback do
    {:error, :unsupported_resource_type}
  end

  defp paginate(query, page, page_size) do
    offset = (page - 1) * page_size

    query
    |> limit(^page_size)
    |> offset(^offset)
  end

  # A simple map describing each resource’s join schema, foreign key, resource schema, and preload field
  defp resources_map do
    %{
      "medias" => {
        # join schema module
        TeamsMedias,
        # foreign key in join schema
        :media_id,
        # resource schema module
        Media,
        # association name in join schema
        :media
      },
      "playlists" => {
        TeamsPlaylists,
        :playlist_id,
        Playlist,
        :playlist
      },
      "channels" => {
        TeamsChannels,
        :channel_id,
        Channel,
        :channel
      },
      "devices" => {
        TeamsDevices,
        :device_id,
        Device,
        :device
      },
      "layouts" => {
        TeamsLayouts,
        :layout_id,
        Layout,
        :layout
      }
    }
  end

  @doc """
    Checks if a given user has access to a given resource. A given resource can be a media, a playlist, a channel, a device or a team.
    The resource belongs to the proxy table Resource, and is part of a Team through the proxy table TeamsResources, which
    includes an access field of type array that can include accesses such as read, write or delete.

    Any user belonging to a given team will have access to a given resource based on the access field of the TeamsResources table
    for the given resource.
  """
  def has_access_to_resource_legacy(user_id, resource_id, access) do
    query =
      from(
        tr in Castmill.Teams.TeamsResources,
        where: tr.resource_id == ^resource_id and ^access in tr.access,
        join: tu in Castmill.Teams.TeamsUsers,
        on: tu.team_id == tr.team_id,
        where: tu.user_id == ^user_id,
        select: tr.access
      )

    Repo.one(query) != nil
  end

  def resource_in_team?(team_id, resource_type, resource_id) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, _resource_mod, _assoc_field} ->
        from(j in join_mod,
          where: j.team_id == ^team_id and field(j, ^foreign_key) == ^resource_id
        )
        |> Repo.exists?()

      nil ->
        false
    end
  end

  def has_access_to_resource(actor_id, resource_type, resource_id, access) do
    case Map.get(resources_map(), resource_type) do
      {join_mod, foreign_key, _resource_mod, _assoc_field} ->
        query =
          from(j in join_mod,
            where:
              j.team_id in subquery(
                from(tu in TeamsUsers, where: tu.user_id == ^actor_id, select: tu.team_id)
              ),
            where: field(j, ^foreign_key) == ^resource_id,
            where: ^access in j.access
          )

        Repo.exists?(query)

      nil ->
        false
    end
  end

  def add_invitation_to_team(organization_id, team_id, email, role \\ :member) do
    token =
      :crypto.strong_rand_bytes(16)
      |> Base.url_encode64(padding: false)

    Ecto.Multi.new()
    # 1) Check if the user is already in the team
    |> Ecto.Multi.run(:check_membership, fn _repo, _changes ->
      if user_in_team?(team_id, email) do
        {:error, :already_member}
      else
        {:ok, :no_conflict}
      end
    end)
    # 2) Check if there's already an active "invited" row
    |> Ecto.Multi.run(:check_existing_invite, fn _repo, _changes ->
      existing =
        Repo.get_by(Invitation,
          team_id: team_id,
          email: email,
          status: "invited"
        )

      if existing do
        {:error, :already_invited}
      else
        {:ok, :no_conflict}
      end
    end)
    # 3) Insert the new invitation row
    |> Ecto.Multi.insert(:invitation, fn _changes ->
      %Invitation{}
      |> Invitation.changeset(%{
        team_id: team_id,
        email: email,
        token: token,
        role: role
        # status defaults to "invited", unless you override it
      })
    end)
    # 4) Execute the DB transaction
    |> Repo.transaction()
    # 5) Send the invitation email only if the transaction succeeds
    |> case do
      {:ok, %{invitation: invitation}} ->
        # Transaction committed successfully;
        # now we can send the email outside the transaction.
        organization = Castmill.Organizations.get_organization(organization_id)
        network = Castmill.Networks.get_network(organization.network_id)
        send_invitation_email(network.domain, email, token)

        # Get team info and send notification if user exists
        team = get_team(team_id)

        case Castmill.Accounts.get_user_by_email(email) do
          nil ->
            # User doesn't exist yet, no notification to send
            :ok

          user ->
            # User exists, send notification
            Castmill.Notifications.Events.notify_team_invitation(
              user.id,
              team.name,
              team_id,
              token
            )
        end

        {:ok, invitation.token}

      # If membership check failed:
      {:error, :check_membership, :already_member, _changes} ->
        {:error, :already_member}

      # If there's already an active invitation:
      {:error, :check_existing_invite, :already_invited, _changes} ->
        {:error, :already_invited}

      # If inserting the invitation failed (e.g. a constraint error):
      {:error, :invitation, changeset, _changes} ->
        {:error, changeset}
    end
  end

  def user_in_team?(team_id, email) do
    # Suppose you can map email -> user.id, then check teams_users to see if
    # that user already exists for the given team:
    from(tu in "teams_users",
      join: u in "users",
      on: u.id == tu.user_id,
      where: tu.team_id == ^team_id and u.email == ^email
    )
    |> Repo.exists?()
  end

  defp send_invitation_email(baseUrl, email, token) do
    subject = "You have been invited to a team on Castmill"

    body = """
    Hello

    You have been invited to join a team on Castmill. Please click on the link below to accept the invitation.

    #{baseUrl}/invite/?token=#{token}

    """

    deliver(email, subject, body)
  end

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    email =
      Email.new()
      |> Email.to(recipient)
      |> Email.from({"Castmill", "no-reply@castmill.com"})
      |> Email.subject(subject)
      |> Email.text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end

  def get_invitation(token) do
    from(i in Invitation,
      where: i.token == ^token,
      join: t in assoc(i, :team),
      join: o in assoc(t, :organization),
      preload: [team: {t, organization: o}]
    )
    |> Repo.one()
  end

  def get_invitation_by_email(email) do
    from(i in Invitation,
      where: i.email == ^email,
      join: t in assoc(i, :team),
      preload: [team: t]
    )
    |> Repo.one()
  end

  # Accepts an invitation by updating the status of the invitation to accepted and
  # adding the user to the team.
  def accept_invitation(token, user_id) do
    case get_invitation(token) do
      nil ->
        {:error, "Invalid token"}

      invitation ->
        # Convert atom role to string for add_user_to_team
        role = Atom.to_string(invitation.role)

        case add_user_to_team(invitation.team_id, user_id, role) do
          {:ok, _} ->
            from(i in Invitation,
              where: i.token == ^token
            )
            |> Repo.update_all(set: [status: "accepted"])

            # Send notification to team members that invitation was accepted
            user = Castmill.Accounts.get_user(user_id)
            team = get_team(invitation.team_id)

            if user && team do
              Castmill.Notifications.Events.notify_invitation_accepted(
                user.name,
                user_id,
                nil,
                invitation.team_id
              )
            end

            {:ok, invitation}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  # Rejects an invitation by updating the status to rejected
  def reject_invitation(token) do
    case get_invitation(token) do
      nil ->
        {:error, "Invalid token"}

      invitation ->
        if invitation.status != "invited" do
          {:error, "Invitation already #{invitation.status}"}
        else
          from(i in Invitation,
            where: i.token == ^token
          )
          |> Repo.update_all(set: [status: "rejected"])

          {:ok, invitation}
        end
    end
  end

  # List invitations for a given team, we need to support pagination, and search
  def list_invitations(%{
        team_id: team_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    from(i in Invitation,
      where: i.team_id == ^team_id,
      where: ilike(i.email, ^"%#{search}%"),
      order_by: [desc: i.inserted_at],
      limit: ^page_size,
      offset: ^offset
    )
    |> Repo.all()
  end

  def count_invitations(%{team_id: team_id, search: search}) do
    from(i in Invitation,
      where: i.team_id == ^team_id,
      where: ilike(i.email, ^"%#{search}%")
    )
    |> Repo.aggregate(:count, :id)
  end

  def remove_invitation_from_team(team_id, invitation_id) do
    case Repo.get_by(Invitation, id: invitation_id, team_id: team_id) do
      nil ->
        {:error, :not_found}

      invitation ->
        Repo.delete(invitation)
    end
  end
end

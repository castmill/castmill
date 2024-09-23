defmodule Castmill.Teams do
  @moduledoc """
  The Teams context.
  """
  import Ecto.Query, warn: false
  alias Ecto.Multi

  alias Castmill.Repo
  alias Castmill.Organizations.Organization
  alias Castmill.Teams.{Team, TeamsUsers, TeamsResources}
  alias Castmill.Resources.{Media, Playlist, Channel}
  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  defimpl Access, for: Team do
    def canAccess(_team, user, _action) do
      if is_nil(user) do
        {:error, "No user provided"}
      else
        # network_admin = Repo.get_by(Castmill.Networks.NetworksAdmins, network_id: network.id, user_id: user.id)
        # if network_admin !== nil do
        #   {:ok, true}
        # else
        #   {:ok, false}
        # end
      end
    end
  end

  @doc """
  Returns the list of teams.

  ## Examples

      iex> list_networks()
      [%Network{}, ...]

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
  def create_team(attrs \\ %{}) do
    %Team{}
    |> Team.changeset(attrs)
    |> Repo.insert()
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

  @doc """
    Add a resource to a team with a given access.
  """
  def add_resource_to_team(team_id, child_id, type, access) do
    {:ok, %{add_resource_to_team: team_resource}} =
      Repo.transaction(
        Multi.new()
        |> Multi.run(:upsert_resource, fn _repo, _changes ->
          upsert_resource(child_id, type)
        end)
        |> Multi.run(:add_resource_to_team, fn _repo, %{upsert_resource: resource_id} ->
          %TeamsResources{}
          |> TeamsResources.changeset(%{
            access: access,
            team_id: team_id,
            resource_id: resource_id
          })
          |> Repo.insert()
        end)
      )

    {:ok, team_resource}
  end

  @doc """
    Update access for a resource in a team.
  """
  def update_resource_access(team_id, resource_id, access) do
    from(team_resource in TeamsResources,
      where: team_resource.team_id == ^team_id and team_resource.resource_id == ^resource_id
    )
    |> Repo.update_all(set: [access: access])
  end

  defp upsert_resource(id, type) do
    # First upsert the resource (insert only if there is no a resource for the given id and type)
    # Check if the child has a resource associated to it already.
    child = get_child_resource(id, type)

    if child.resource_id do
      {:ok, child.resource_id}
    else
      {:ok, resource} =
        %Castmill.Resources.Resource{}
        |> Castmill.Resources.Resource.changeset(%{type: type})
        |> Repo.insert()

      Castmill.Resources.update(child, %{resource_id: resource.id})
      {:ok, resource.id}
    end
  end

  defp get_child_resource(id, type) do
    case type do
      :media -> Repo.get(Media, id)
      :playlist -> Repo.get(Playlist, id)
      :channel -> Repo.get(Channel, id)
      :device -> Repo.get(Device, id)
      _ -> {:error, "Invalid resource type"}
    end
  end

  def remove_user_from_team(team_id, user_id) do
    from(team_user in TeamsUsers,
      where: team_user.team_id == ^team_id and team_user.user_id == ^user_id
    )
    |> Repo.delete_all()
  end

  def remove_resource_from_team(team_id, resource_id) do
    from(team_resource in TeamsResources,
      where: team_resource.team_id == ^team_id and team_resource.resource_id == ^resource_id
    )
    |> Repo.delete_all()
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

  @doc """
    Returns the list of users of the given team

    ## Examples

    iex> list_users()
    [%User{}, ...]
  """
  def list_users(team_id) do
    # Maybe it is possible to do a query that do not requires doing a Enum.map at the end
    # to merge the role into the user, this works well for now.
    query =
      from(teams_users in TeamsUsers,
        where: teams_users.team_id == ^team_id,
        join: user in assoc(teams_users, :user),
        order_by: [asc: user.updated_at],
        select:
          {%{id: user.id, name: user.name, email: user.email, avatar: user.avatar},
           %{role: teams_users.role}}
      )

    Repo.all(query)
    |> Enum.map(fn {user, role} -> Map.put(user, :role, role.role) end)
  end

  @doc """
  Returns the list of resources of the given team

  ## Examples

  iex> list_resources()
  [%User{}, ...]
  """
  def list_resources(team_id) do
    query =
      from(
        tr in Castmill.Teams.TeamsResources,
        where: tr.team_id == ^team_id,
        join: r in Castmill.Resources.Resource,
        on: r.id == tr.resource_id,
        preload: [resource: :media, resource: :playlist, resource: :channel, resource: :device]
      )

    Repo.all(query)
  end

  @doc """
    Checks if a given user has access to a given resource. A given resource can be a media, a playlist, a channel or a device.
    The resource belongs to the proxy table Resource, and is part of a Team through the proxy table TeamsResources, which
    includes an access field of type array that can include accesses such as read, write or delete.

    Any user belonging to a given team will have access to a given resource based on the access field of the TeamsResources table
    for the given resource.
  """
  def has_access_to_resource(user_id, resource_id, access) do
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
end

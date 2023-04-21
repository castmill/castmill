defmodule Castmill.Teams do
  @moduledoc """
  The Teams context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Teams.{Team, TeamsUsers, TeamsResources}
  alias Castmill.Resources.{Media, Playlist, Calendar}

  alias Castmill.Protocol.Access

  defimpl Access, for: Team do
    def canAccess(team, user, _action) do
      if user == nil do
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
  Returns the list of networks.

  ## Examples

      iex> list_networks()
      [%Network{}, ...]

  """
  def list_teams(organization_id) do
    query = from team in Team,
    where: team.organization_id == ^organization_id,
    select: team
    Repo.all(query)
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

  def add_user_to_team(team_id, user_id, role) do
    %TeamsUsers{}
    |> TeamsUsers.changeset(%{team_id: team_id, user_id: user_id, role: role})
    |> Repo.insert()
  end

  def add_resource_to_team(team_id, child_id, type, access) do
    # We need a transaction here
    # First upsert the resource (insert only if there is no a resource for the given id and type)
    {:ok, resource_id} = upsert_resource(child_id, type)

    %TeamsResources{}
    |> TeamsResources.changeset(%{access: access, team_id: team_id, resource_id: resource_id})
    |> Repo.insert()
  end

  def upsert_resource(id, type) do
    # We need a transaction here
    # First upsert the resource (insert only if there is no a resource for the given id and type)
    # Check if the child has a resource associated to it already.
    child = get_child_resource(id, type)

    if child.resource_id  do
      {:ok, child.resource_id}
    else
      {:ok, resource} = %Castmill.Resources.Resource{}
      |> Castmill.Resources.Resource.changeset(%{type: type})
      |> Repo.insert()

      Castmill.Resources.update(child, %{resource_id: resource.id})
      {:ok, resource.id}
    end
  end

  defp get_child_resource(id, type) do
    case type do
      :media -> Repo.get_by(Media, id: id)
      :playlist -> Repo.get_by(Playlist, id: id)
      :calendar -> Repo.get_by(Calendar, id: id)
      :device -> Repo.get_by(Device, id: id)
      _ -> {:error, "Invalid resource type"}
    end
  end

  def remove_user_from_team(team_id, user_id) do
    from(team_user in TeamsUsers,
      where: team_user.team_id == ^team_id and team_user.user_id == ^user_id)
    |> Repo.delete_all
  end

  def remove_resource_from_team(team_id, resource_id) do
    from(team_resource in TeamsResources,
    where: team_resource.team_id == ^team_id and team_resource.resource_id == ^resource_id)
    |> Repo.delete_all
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking network changes.

  ## Examples

      iex> change_network(network)
      %Ecto.Changeset{data: %Network{}}

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
    query = from teams_users in TeamsUsers,
      where: teams_users.team_id == ^team_id,
      join: user in assoc(teams_users, :user),
      order_by: [asc: user.updated_at],
      select: {%{id: user.id, name: user.name, email: user.email, avatar: user.avatar}, %{role: teams_users.role}}
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

    # user = Blog.Repo.one from user in Blog.User,
    #   where: user.id == ^user_id,
    #   left_join: posts in assoc(user, :posts),
    #   left_join: comments in assoc(posts, :comments),
    #   preload: [posts: {posts, comments: comments}]

    # query = from teams_resources in TeamsResources,
    #   where: teams_resources.team_id == ^team_id,
    #   join: resource in assoc(teams_resources, :resource),
    #   #join: media in assoc(resource, :resource),
    #   order_by: [asc: resource.updated_at],
    #   select: {%{id: resource.id}, %{access: teams_resources.access}},
    #   preload: [resource: [Media: :resource]]

    query =
      from(
        tr in Castmill.Teams.TeamsResources,
        where: tr.team_id == ^team_id,
        join: r in Castmill.Resources.Resource,
        on: r.id == tr.resource_id,
        preload: [resource: :media, resource: :playlist, resource: :calendar, resource: :device]
      )

    Repo.all(query)
  end
end

defmodule Castmill.Networks do
  @moduledoc """
  The Networks context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Networks.Network

  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  defimpl Access, for: Network do
    def canAccess(network, user, _action) do
      if user == nil do
        {:error, "No user provided"}
      else
        network_admin =
          Repo.get_by(Castmill.Networks.NetworksAdmins, network_id: network.id, user_id: user.id)

        if network_admin !== nil do
          {:ok, true}
        else
          {:ok, false}
        end
      end
    end
  end

  @doc """
  Returns the list of networks.

  ## Examples

      iex> list_networks(params)
      [%Network{}, ...]

  """
  def list_networks(params \\ %{}) do
    pattern = params[:pattern]
    page = Map.get(params, "page", "1") |> String.to_integer()
    page_size = Map.get(params, "page_size", "10") |> String.to_integer()
    offset = max((page - 1) * page_size, 0)
    name = params[:name]

    Network.base_query()
    |> Network.where_name(name)
    |> QueryHelpers.where_name_like(pattern)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def count_networks(params \\ %{}) do
    pattern = params[:pattern]

    Network.base_query()
    |> QueryHelpers.where_name_like(pattern)
    |> Repo.aggregate(:count, :id)
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
  def get_network(id), do: Repo.get(Network, id)

  @doc """
  Creates a network.

  ## Examples

      iex> create_network(%{field: value})
      {:ok, %Network{}}

      iex> create_network(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_network(attrs \\ %{}) do
    %Network{}
    |> Network.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a network.

  ## Examples

      iex> update_network(network, %{field: new_value})
      {:ok, %Network{}}

      iex> update_network(network, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_network(%Network{} = network, attrs) do
    network
    |> Network.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a network.

  ## Examples

      iex> delete_network(network)
      {:ok, %Network{}}

      iex> delete_network(network)
      {:error, %Ecto.Changeset{}}

  """
  def delete_network(%Network{} = network) do
    Repo.delete(network)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking network changes.

  ## Examples

      iex> change_network(network)
      %Ecto.Changeset{data: %Network{}}

  """
  def change_network(%Network{} = network, attrs \\ %{}) do
    Network.changeset(network, attrs)
  end

  @doc """
    Returns the list of users of the given network

    ## Examples

    iex> list_users()
    [%User{}, ...]
  """
  def list_users(network_id) do
    query =
      from(user in Castmill.Accounts.User,
        where: user.network_id == ^network_id,
        select: user
      )

    Repo.all(query)
  end

  @doc """
  Returns the list of organization of the given network

  ## Examples

  iex> list_organizations()
  [%Organization{}, ...]
  """
  def list_organizations(network_id) do
    query =
      from(organization in Castmill.Organizations.Organization,
        where: organization.network_id == ^network_id,
        select: organization
      )

    Repo.all(query)
  end

  @doc """
  Returns the list of teams of the given network

  ## Examples

  iex> list_teams()
  [%Team{}, ...]
  """
  def list_teams(network_id) do
    query =
      from(team in Castmill.Teams.Team,
        join: organization in Castmill.Organizations.Organization,
        on: team.organization_id == organization.id,
        where: organization.network_id == ^network_id,
        select: team
      )

    Repo.all(query)
  end

  @doc """
  Returns the list of devices of the given network

  ## Examples

  iex> list_devices()
  [%Device{}, ...]
  """
  def list_devices(network_id) do
    query =
      from(device in Castmill.Devices.Device,
        join: organization in Castmill.Organizations.Organization,
        on: device.organization_id == organization.id,
        where: organization.network_id == ^network_id,
        select: device
      )

    Repo.all(query)
  end
end

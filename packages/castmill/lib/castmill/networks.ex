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
      if is_nil(user) do
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
  def list_networks() do
    Network.base_query()
    |> Repo.all()
  end

  def list_networks(%{name: name}) do
    Network.base_query()
    |> Network.where_name(name)
    |> Repo.all()
  end

  def list_networks(%{search: search, page: page, page_size: page_size}) do
    offset = if is_nil(page_size), do: 0, else: max((page - 1) * page_size, 0)

    Network.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.order_by([d], asc: d.name)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def count_networks(%{search: search}) do
    Network.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  @doc """
  Returns the list of all network domains
  """
  def list_network_domains() do
    query =
      from(network in Network,
        select: network.domain
      )

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
    # Create the network
    result =
      %Network{}
      |> Network.changeset(attrs)
      |> Repo.insert()

    case result do
      {:ok, network} ->
        # Create a default plan for the new network
        create_default_plan_for_network(network)
        {:ok, network}

      error ->
        error
    end
  end

  # Creates a default plan with sensible defaults for a network
  defp create_default_plan_for_network(network) do
    default_quotas = [
      %{resource: :teams, max: 10},
      %{resource: :medias, max: 1000},
      %{resource: :playlists, max: 50},
      %{resource: :devices, max: 20},
      %{resource: :channels, max: 20},
      %{resource: :storage, max: 1_073_741_824}  # 1 GB in bytes
    ]

    # Create the default plan
    plan = Castmill.Quotas.create_plan("Default Plan", network.id, default_quotas)

    # Set it as the network's default
    Castmill.Quotas.set_network_default_plan(network.id, plan.id)
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

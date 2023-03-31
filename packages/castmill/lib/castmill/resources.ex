defmodule Castmill.Resources do
  @moduledoc """
  The Resources context.

  This context handles all operations related to resources that are owned by an organization,
  such as:
  - Medias
  - Playlists
  - Widgets
  - Caledars
  - Teams
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Networks.Network
  alias Castmill.Resources.Media
  alias Castmill.Protocol.Access

  @doc """
    Can access the network.
  """
  defimpl Access, for: Media do
    def canAccess(organization, user, action) do
      if user == nil do
        {:error, "No user provided"}
      else
        ou = Repo.get_by(Castmill.Organizations.OrganizationsUsers, organization_id: organization.id, user_id: user.id)
        if ou !== nil && ou.access in "media:#{action}" do
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

      iex> list_networks()
      [%Network{}, ...]

  """
  def list_networks do
    Repo.all(Network)
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
  def create_media(attrs \\ %{}) do
    %Media{}
    |> Media.changeset(attrs)
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
    query = from user in Castmill.Accounts.User,
      where: user.network_id == ^network_id,
      select: user
    Repo.all(query)
  end

  @doc """
  Returns the list of organization of the given network

  ## Examples

  iex> list_organizations()
  [%User{}, ...]
  """
  def list_organizations(network_id) do
    query = from organization in Castmill.Organizations.Organization,
      where: organization.network_id == ^network_id,
      select: organization
    Repo.all(query)
  end


end

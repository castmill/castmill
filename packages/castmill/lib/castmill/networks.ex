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
      %{resource: :users, max: 50},
      # 1 GB in bytes
      %{resource: :storage, max: 1_073_741_824}
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

  # Network Invitations for creating new organizations
  alias Castmill.Networks.NetworkInvitation
  alias Castmill.Organizations

  @doc """
  Invites a user to create a new organization in the network as an admin.
  Returns {:ok, invitation} or {:error, reason}
  """
  def invite_user_to_new_organization(network_id, email, organization_name) do
    token = generate_invitation_token()

    Ecto.Multi.new()
    # 1) Check if user already exists in this network
    |> Ecto.Multi.run(:check_existing_user, fn _repo, _changes ->
      existing_user = 
        from(u in Castmill.Accounts.User,
          where: u.email == ^email and u.network_id == ^network_id
        )
        |> Repo.one()

      if existing_user do
        {:error, :user_already_exists}
      else
        {:ok, :no_conflict}
      end
    end)
    # 2) Check if there's already an active invitation
    |> Ecto.Multi.run(:check_existing_invite, fn _repo, _changes ->
      existing =
        Repo.get_by(NetworkInvitation,
          network_id: network_id,
          email: email,
          status: "invited"
        )

      if existing do
        {:error, :already_invited}
      else
        {:ok, :no_conflict}
      end
    end)
    # 3) Insert the new invitation
    |> Ecto.Multi.insert(:invitation, fn _changes ->
      %NetworkInvitation{}
      |> NetworkInvitation.changeset(%{
        network_id: network_id,
        email: email,
        organization_name: organization_name,
        token: token,
        status: "invited"
      })
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{invitation: invitation}} ->
        # TODO: Send invitation email
        {:ok, invitation}

      {:error, :check_existing_user, :user_already_exists, _} ->
        {:error, "User with this email already exists in the network"}

      {:error, :check_existing_invite, :already_invited, _} ->
        {:error, "An invitation for this email already exists"}

      {:error, _step, changeset, _} ->
        {:error, changeset}
    end
  end

  @doc """
  Gets a network invitation by token
  """
  def get_network_invitation_by_token(token) do
    Repo.get_by(NetworkInvitation, token: token, status: "invited")
  end

  @doc """
  Lists all active (invited) invitations for a network
  """
  def list_network_invitations(network_id) do
    from(ni in NetworkInvitation,
      where: ni.network_id == ^network_id and ni.status == "invited",
      order_by: [desc: ni.inserted_at]
    )
    |> Repo.all()
  end

  @doc """
  Accepts a network invitation, creating a new user and organization
  """
  def accept_network_invitation(token, user_id) do
    Ecto.Multi.new()
    |> Ecto.Multi.run(:invitation, fn _repo, _changes ->
      case get_network_invitation_by_token(token) do
        nil -> {:error, :invitation_not_found}
        invitation ->
          if NetworkInvitation.expired?(invitation) do
            {:error, :invitation_expired}
          else
            {:ok, invitation}
          end
      end
    end)
    |> Ecto.Multi.run(:user, fn _repo, %{invitation: invitation} ->
      case Repo.get(Castmill.Accounts.User, user_id) do
        nil -> {:error, :user_not_found}
        user ->
          # Verify user email matches invitation
          if user.email == invitation.email do
            {:ok, user}
          else
            {:error, :email_mismatch}
          end
      end
    end)
    |> Ecto.Multi.run(:organization, fn _repo, %{invitation: invitation} ->
      Organizations.create_organization(%{
        name: invitation.organization_name,
        network_id: invitation.network_id
      })
    end)
    |> Ecto.Multi.run(:add_user, fn _repo, %{organization: organization, user: user} ->
      Organizations.add_user(organization.id, user.id, :admin)
    end)
    |> Ecto.Multi.update(:mark_accepted, fn %{invitation: invitation} ->
      NetworkInvitation.changeset(invitation, %{status: "accepted"})
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{organization: organization}} ->
        {:ok, organization}

      {:error, _step, reason, _} ->
        {:error, reason}
    end
  end

  @doc """
  Cancels/deletes a network invitation
  """
  def delete_network_invitation(invitation_id) do
    case Repo.get(NetworkInvitation, invitation_id) do
      nil -> {:error, :not_found}
      invitation -> Repo.delete(invitation)
    end
  end

  defp generate_invitation_token do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end
end

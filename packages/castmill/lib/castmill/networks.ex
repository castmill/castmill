defmodule Castmill.Networks do
  @moduledoc """
  The Networks context.
  """
  import Ecto.Query, warn: false
  alias Castmill.Repo
  alias Castmill.Networks.Network
  alias Castmill.Accounts.User

  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers

  alias Castmill.Networks.NetworksUsers

  defimpl Access, for: Network do
    def canAccess(network, user, _action) do
      if is_nil(user) do
        {:error, "No user provided"}
      else
        # Check if user belongs to this network and is an admin via networks_users
        query =
          from(nu in Castmill.Networks.NetworksUsers,
            where: nu.user_id == ^user.id and nu.network_id == ^network.id and nu.role == :admin
          )

        if Castmill.Repo.exists?(query) do
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
      %{resource: :layouts, max: 100},
      # 1 GB storage (in bytes)
      %{resource: :storage, max: 1_073_741_824},
      # 2 GB max upload size per file (in bytes)
      %{resource: :max_upload_size, max: 2_147_483_648}
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

  # ============================================================================
  # Network Admin Management
  # ============================================================================

  @doc """
  Checks if a user is a network admin.

  ## Examples

      iex> is_network_admin?(user_id, network_id)
      true

      iex> is_network_admin?(user_id, other_network_id)
      false
  """
  def is_network_admin?(user_id, network_id) do
    query =
      from(nu in NetworksUsers,
        where: nu.user_id == ^user_id and nu.network_id == ^network_id and nu.role == :admin
      )

    Repo.exists?(query)
  end

  @doc """
  Gets a user's network membership (networks_users) for a given network.

  Returns the NetworksUsers record or nil.
  """
  def get_network_membership(user_id, network_id) do
    Repo.get_by(NetworksUsers, user_id: user_id, network_id: network_id)
  end

  @doc """
  Checks if a user belongs to a network (any role).

  Returns true if the user has a networks_users entry for the given network.
  """
  def is_network_member?(user_id, network_id) do
    query =
      from(nu in NetworksUsers,
        where: nu.user_id == ^user_id and nu.network_id == ^network_id
      )

    Repo.exists?(query)
  end

  @doc """
  Gets an admin network_id for a given user.

  Returns {:ok, network_id} if the user is admin of exactly one network,
  or {:ok, network_id} for the first admin network if they have multiple.
  Returns {:error, :not_admin} if the user is not an admin of any network.
  """
  def get_admin_network_id(user_id) do
    query =
      from(nu in NetworksUsers,
        where: nu.user_id == ^user_id and nu.role == :admin,
        select: nu.network_id,
        limit: 1
      )

    case Repo.one(query) do
      nil -> {:error, :not_admin}
      network_id -> {:ok, network_id}
    end
  end

  @doc """
  Gets a user if they are a network admin.

  Returns the user if they are an admin of any network, nil otherwise.
  """
  def get_network_admin(user_id) do
    query =
      from(nu in NetworksUsers,
        where: nu.user_id == ^user_id and nu.role == :admin,
        join: u in User,
        on: u.id == nu.user_id,
        select: u,
        limit: 1
      )

    Repo.one(query)
  end

  @doc """
  Promotes a user to network admin.

  The user must already be a member of the network (must have a networks_users entry).

  ## Examples

      iex> promote_to_network_admin(user_id, network_id)
      {:ok, %NetworksUsers{}}

      iex> promote_to_network_admin(invalid_user_id, network_id)
      {:error, :user_not_found}
  """
  def promote_to_network_admin(user_id, network_id) do
    case Repo.get_by(NetworksUsers, user_id: user_id, network_id: network_id) do
      nil ->
        # Check if user exists at all
        case Repo.get(User, user_id) do
          nil -> {:error, :user_not_found}
          _user -> {:error, :user_not_in_network}
        end

      %NetworksUsers{role: :admin} = nu ->
        # Already an admin
        {:ok, nu}

      nu ->
        nu
        |> NetworksUsers.changeset(%{role: :admin})
        |> Repo.update()
    end
  end

  @doc """
  Demotes a user from network admin to regular member.

  ## Examples

      iex> demote_from_network_admin(user_id, network_id)
      {:ok, %NetworksUsers{}}

      iex> demote_from_network_admin(non_admin_user_id, network_id)
      {:error, :not_admin}
  """
  def demote_from_network_admin(user_id, network_id) do
    case Repo.get_by(NetworksUsers, user_id: user_id, network_id: network_id) do
      nil ->
        case Repo.get(User, user_id) do
          nil -> {:error, :user_not_found}
          _user -> {:error, :user_not_in_network}
        end

      %NetworksUsers{role: :admin} = nu ->
        nu
        |> NetworksUsers.changeset(%{role: :member})
        |> Repo.update()

      _nu ->
        {:error, :not_admin}
    end
  end

  @doc """
  Lists all network admins for a given network.
  """
  def list_network_admins(network_id) do
    from(u in User,
      join: nu in NetworksUsers,
      on: nu.user_id == u.id,
      where: nu.network_id == ^network_id and nu.role == :admin,
      select: u
    )
    |> Repo.all()
  end

  @doc """
    Returns the list of users of the given network

    ## Examples

    iex> list_users()
    [%User{}, ...]
  """
  def list_users(network_id) do
    query =
      from(u in User,
        join: nu in NetworksUsers,
        on: nu.user_id == u.id,
        where: nu.network_id == ^network_id,
        select: u
      )

    Repo.all(query)
  end

  @doc """
  Adds a user to a network with the given role.
  """
  def add_user_to_network(user_id, network_id, role \\ :member) do
    %NetworksUsers{}
    |> NetworksUsers.changeset(%{user_id: user_id, network_id: network_id, role: role})
    |> Repo.insert()
  end

  @doc """
  Removes a user from a network.
  """
  def remove_user_from_network(user_id, network_id) do
    case Repo.get_by(NetworksUsers, user_id: user_id, network_id: network_id) do
      nil -> {:error, :not_found}
      nu -> Repo.delete(nu)
    end
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
  Returns the list of organizations of the given network with pagination and search.

  ## Options
  - `:page` - Page number (default: 1)
  - `:page_size` - Items per page (default: 10)
  - `:search` - Search term for organization name (optional)

  ## Examples

  iex> list_organizations_paginated(network_id, page: 1, page_size: 10)
  {[%Organization{}, ...], total_count}
  """
  def list_organizations_paginated(network_id, opts \\ []) do
    page = Keyword.get(opts, :page, 1)
    page_size = Keyword.get(opts, :page_size, 10)
    search = Keyword.get(opts, :search)

    offset = max((page - 1) * page_size, 0)

    base_query =
      from(organization in Castmill.Organizations.Organization,
        where: organization.network_id == ^network_id
      )

    # Apply search filter if provided
    base_query =
      if search && String.trim(search) != "" do
        search_term = "%#{String.downcase(search)}%"
        from(o in base_query, where: ilike(o.name, ^search_term))
      else
        base_query
      end

    # Get total count
    total_count = Repo.aggregate(base_query, :count, :id)

    # Get paginated results
    organizations =
      base_query
      |> order_by([o], asc: o.name)
      |> limit(^page_size)
      |> offset(^offset)
      |> Repo.all()

    {organizations, total_count}
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
  alias Castmill.Accounts.UserNotifier

  @doc """
  Invites a user to create a new organization in the network as an admin.
  Returns {:ok, invitation} or {:error, reason}
  """
  def invite_user_to_new_organization(network_id, email, organization_name) do
    token = generate_invitation_token()

    Ecto.Multi.new()
    # 1) Check if user already exists in this network
    |> Ecto.Multi.run(:check_existing_user, fn _repo, _changes ->
      case get_user_by_email_and_network(email, network_id) do
        nil -> {:ok, :no_conflict}
        _user -> {:error, :user_already_exists}
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
        case send_network_invitation_email(invitation) do
          {:ok, _} ->
            {:ok, invitation}

          {:error, _reason} ->
            {:ok, invitation}
        end

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
  Accepts a network invitation, creating a new organization and adding user as admin
  This function assumes it's being called within a transaction context.
  For standalone usage, use accept_network_invitation_transactional/2
  """
  def accept_network_invitation(token, user_id) do
    with {:ok, invitation} <- validate_network_invitation(token),
         {:ok, user} <- validate_invitation_user(invitation, user_id),
         {:ok, organization} <- create_invitation_organization(invitation),
         {:ok, _} <- add_user_to_organization(organization, user) do
      # Mark invitation as accepted
      case Repo.update(NetworkInvitation.changeset(invitation, %{status: "accepted"})) do
        {:ok, _} -> {:ok, organization}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  @doc """
  Accepts a network invitation within its own transaction
  """
  def accept_network_invitation_transactional(token, user_id) do
    Repo.transaction(fn ->
      case accept_network_invitation(token, user_id) do
        {:ok, organization} -> organization
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp validate_network_invitation(token) do
    case get_network_invitation_by_token(token) do
      nil ->
        {:error, :invitation_not_found}

      invitation ->
        if NetworkInvitation.expired?(invitation) do
          {:error, :invitation_expired}
        else
          {:ok, invitation}
        end
    end
  end

  defp validate_invitation_user(invitation, user_id) do
    case Repo.get(Castmill.Accounts.User, user_id) do
      nil ->
        {:error, :user_not_found}

      user ->
        if user.email == invitation.email do
          {:ok, user}
        else
          {:error, :email_mismatch}
        end
    end
  end

  defp create_invitation_organization(invitation) do
    Organizations.create_organization(%{
      name: invitation.organization_name,
      network_id: invitation.network_id
    })
  end

  defp add_user_to_organization(organization, user) do
    Organizations.add_user(organization.id, user.id, :admin)
  end

  @doc """
  Returns the total storage used by all organizations in the network (in bytes).

  ## Examples

      iex> get_total_storage(network_id)
      123456789
  """
  def get_total_storage(network_id) do
    from(f in Castmill.Files.File,
      join: o in Castmill.Organizations.Organization,
      on: f.organization_id == o.id,
      where: o.network_id == ^network_id,
      select: sum(f.size)
    )
    |> Repo.one()
    |> case do
      nil -> 0
      size -> size
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

  defp send_network_invitation_email(invitation) do
    dashboard_url =
      System.get_env("CASTMILL_DASHBOARD_URI") ||
        System.get_env("DASHBOARD_URL") ||
        "http://localhost:3000"

    UserNotifier.deliver_network_invitation_instructions(
      invitation,
      dashboard_url,
      context: "network_invitation",
      metadata: %{
        invitation_id: invitation.id,
        email: invitation.email,
        network_id: invitation.network_id
      }
    )
  end

  # Helper function to get user by email and network ID (via networks_users join)
  defp get_user_by_email_and_network(email, network_id) do
    from(u in Castmill.Accounts.User,
      join: nu in NetworksUsers,
      on: nu.user_id == u.id,
      where: u.email == ^email and nu.network_id == ^network_id
    )
    |> Repo.one()
  end
end

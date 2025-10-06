defmodule Castmill.Organizations do
  @moduledoc """
  The Organizations context.
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Organizations.Organization
  alias Castmill.Organizations.OrganizationsUsersAccess
  alias Castmill.Organizations.OrganizationsUsers
  alias Castmill.Organizations.OrganizationsInvitation
  alias Castmill.Protocol.Access
  alias Castmill.QueryHelpers
  alias Castmill.Mailer

  alias Swoosh.Email

  require Logger

  defimpl Access, for: Organization do
    def canAccess(organization, user, _action) do
      if is_nil(user) do
        {:error, "No user provided"}
      else
        network_admin =
          Repo.get_by(Castmill.Organizations.OrganizationsUsers,
            organization_id: organization.id,
            user_id: user.id
          )

        if network_admin !== nil do
          # TODO: check if the user has access for the action
          {:ok, true}
        else
          {:ok, false}
        end
      end
    end
  end

  @doc """
  Returns the list of organizations.

  ## Examples

      iex> list_organizations()
      [%Organization{}, ...]

  """
  def list_organizations(%{search: search, page: page, page_size: page_size}) do
    offset = if is_nil(page_size), do: 0, else: max((page - 1) * page_size, 0)

    Organization.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.order_by([d], asc: d.name)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def list_organizations(organization_id) do
    query =
      from(organization in Organization,
        where: organization.organization_id == ^organization_id,
        select: organization
      )

    Repo.all(query)
  end

  def list_organizations do
    Repo.all(Organization)
  end

  def count_organizations(%{search: search}) do
    Organization.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  @doc """
    List all organizations a user is part of
  """
  def list_user_organizations(user_id) do
    query =
      from(ou in OrganizationsUsers,
        join: o in Organization,
        on: ou.organization_id == o.id,
        where: ou.user_id == ^user_id,
        select: o
      )

    Repo.all(query)
  end

  @doc """
  Gets a single organization.

  Raises `Ecto.NoResultsError` if the Organization does not exist.

  ## Examples

      iex> get_organization!(123)
      %Organization{}

      iex> get_organization!(456)
      ** (Ecto.NoResultsError)

  """
  def get_organization!(id), do: Repo.get!(Organization, id)

  @doc """
  Gets a single organization.

  Returns nil if the Organization does not exist.

  ## Examples

      iex> get_organization(123)
      %Organization{}

      iex> get_organization(456)
      nil
  """
  def get_organization(id), do: Repo.get(Organization, id)

  @doc """
  Creates a organization.

  ## Examples

      iex> create_organization(%{field: value})
      {:ok, %Organization{}}

      iex> create_organization(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_organization(attrs \\ %{}) do
    network_id = attrs["network_id"] || attrs[:network_id]
    name = attrs["name"] || attrs[:name]

    Repo.transaction(fn ->
      # Lock existing organizations with the same name_lower in this network
      # This prevents race conditions when creating organizations with the same case-insensitive name
      if network_id && name do
        name_lower = String.downcase(String.trim(name))

        from(o in Organization,
          where: o.network_id == ^network_id and o.name_lower == ^name_lower,
          lock: "FOR UPDATE"
        )
        |> Repo.all()
      end

      # Now insert - if there was a conflict, the lock ensures we see it
      case %Organization{}
           |> Organization.changeset(attrs)
           |> Repo.insert() do
        {:ok, organization} -> organization
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  @doc """
  Updates a organization.

  ## Examples

      iex> update_organization(organization, %{field: new_value})
      {:ok, %Organization{}}

      iex> update_organization(organization, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_organization(%Organization{} = organization, attrs) do
    Repo.transaction(fn ->
      # Lock existing organizations with the same name_lower in this network (if name is being changed)
      # This prevents race conditions when updating to a name that conflicts (case-insensitive)
      if attrs["name"] || attrs[:name] do
        name = attrs["name"] || attrs[:name]
        name_lower = String.downcase(String.trim(name))

        from(o in Organization,
          where: o.network_id == ^organization.network_id and o.name_lower == ^name_lower,
          lock: "FOR UPDATE"
        )
        |> Repo.all()
      end

      # Now update - if there was a conflict, the lock ensures we see it
      case organization
           |> Organization.changeset(attrs)
           |> Repo.update() do
        {:ok, updated_organization} -> updated_organization
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  @doc """
  Deletes a organization.

  ## Examples

      iex> delete_organization(organization)
      {:ok, %Organization{}}

      iex> delete_organization(organization)
      {:error, %Ecto.Changeset{}}

  """
  def delete_organization(%Organization{} = organization) do
    Repo.delete(organization)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking organization changes.

  ## Examples

      iex> change_organization(organization)
      %Ecto.Changeset{data: %Organization{}}

  """
  def change_organization(%Organization{} = organization, attrs \\ %{}) do
    Organization.changeset(organization, attrs)
  end

  @doc """
    Sets the role of a user in an organization.
  """
  def set_user_role(organization_id, user_id, role) do
    %OrganizationsUsers{
      organization_id: organization_id,
      user_id: user_id,
      role: role
    }
    |> Repo.insert(
      on_conflict: [set: [role: role]],
      conflict_target: [:organization_id, :user_id]
    )
  end

  @doc """
    Returns the role of a given user in an organization.

    ## Examples

        iex> get_user_role(organization_id, user_id)
        "admin"
  """
  def get_user_role(organization_id, user_id) do
    organization_user =
      Repo.get_by(OrganizationsUsers, organization_id: organization_id, user_id: user_id)

    if organization_user != nil do
      organization_user.role
    else
      nil
    end
  end

  def is_admin?(organization_id, user_id) do
    role = get_user_role(organization_id, user_id)
    role == :admin
  end

  def has_any_role?(organization_id, user_id, roles) do
    role = get_user_role(organization_id, user_id)
    Enum.member?(roles, role)
  end

  @doc """
    Gives access for a given resource type and action
  """
  def give_access(organization_id, user_id, resource_type, action) do
    Repo.insert!(
      %OrganizationsUsersAccess{
        access: "#{resource_type}:#{action}",
        organization_id: organization_id,
        user_id: user_id
      },
      on_conflict: :nothing
    )
  end

  @doc """
    Removes access for a given resource type and action
  """
  def remove_access(organization_id, user_id, resource_type, action) do
    Repo.delete_all(
      from(oua in OrganizationsUsersAccess,
        where:
          oua.organization_id == ^organization_id and oua.user_id == ^user_id and
            oua.access == ^"#{resource_type}:#{action}"
      )
    )
  end

  @doc """
    Checks if the user has access to a fiven resource type and action in the given
    organization or in any of its parents organizations hierarchy
  """
  def has_access(organization_id, user_id, resource_type, action) do
    if is_admin?(organization_id, user_id) do
      true
    else
      query =
        from(oua in OrganizationsUsersAccess,
          join: o in Organization,
          on: oua.organization_id == o.id,
          where:
            oua.user_id == ^user_id and oua.access == ^"#{resource_type}:#{action}" and
              (o.id == ^organization_id or o.organization_id == ^organization_id),
          select: oua
        )

      if is_nil(Repo.one(query)) do
        # Check if parent organization has access recursively
        organization = Repo.get!(Organization, organization_id)

        if organization.organization_id != nil do
          has_access(organization.organization_id, user_id, resource_type, action)
        end
      else
        true
      end
    end
  end

  # TODO: We need a has_access function that checks if the user has access to an actual resource
  # like for example a specific device, media or playlist. This is not implemented yet.

  alias Castmill.Accounts.User

  @doc """
  Returns the list of users.

  ## Examples

      iex> list_users()
      [%User{}, ...]

  """
  def list_users(params) when is_map(params) do
    # define sensible defaults for all these optional params
    defaults = %{
      organization_id: nil,
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
        organization_id: organization_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    users =
      OrganizationsUsers.base_query()
      |> OrganizationsUsers.where_organization_id(organization_id)
      |> join(:inner, [ou], u in assoc(ou, :user), as: :user)
      |> maybe_search_by_user_name(search)
      |> order_by([organizations_users: _ou, user: u], asc: u.name)
      |> Ecto.Query.limit(^page_size)
      |> Ecto.Query.offset(^offset)
      |> select([organizations_users: ou, user: u], %{
        role: ou.role,
        inserted_at: ou.inserted_at,
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
        organization_id: organization_id,
        search: search
      }) do
    OrganizationsUsers.base_query()
    |> OrganizationsUsers.where_organization_id(organization_id)
    |> join(:inner, [ou], u in assoc(ou, :user), as: :user)
    |> maybe_search_by_user_name(search)
    |> Repo.aggregate(:count, :user_id)
  end

  defp maybe_search_by_user_name(query, nil), do: query
  defp maybe_search_by_user_name(query, ""), do: query

  defp maybe_search_by_user_name(query, search) do
    from [user: u] in query,
      where: ilike(u.name, ^"%#{search}%")
  end

  def invite_user(organization_id, email, role) do
    token =
      :crypto.strong_rand_bytes(16)
      |> Base.url_encode64(padding: false)

    Ecto.Multi.new()
    # 1) Check if the user is already in the organization
    |> Ecto.Multi.run(:check_membership, fn _repo, _changes ->
      if user_in_organization?(organization_id, email) do
        {:error, :already_member}
      else
        {:ok, :no_conflict}
      end
    end)
    # 2) Check if there’s already an active “invited” row
    |> Ecto.Multi.run(:check_existing_invite, fn _repo, _changes ->
      existing =
        Repo.get_by(OrganizationsInvitation,
          organization_id: organization_id,
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
      %OrganizationsInvitation{}
      |> OrganizationsInvitation.changeset(%{
        organization_id: organization_id,
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
        send_invitation_email(network.domain, network.name, email, token)

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

  def user_in_organization?(organization_id, email) do
    # Suppose you can map email -> user.id, then check organizations_users to see if
    # that user already exists for the given organization:
    from(ou in OrganizationsUsers,
      join: u in "users",
      on: u.id == ou.user_id,
      where: ou.organization_id == ^organization_id and u.email == ^email
    )
    |> Repo.exists?()
  end

  def list_invitations(params) when is_map(params) do
    # define sensible defaults for all these optional params
    defaults = %{
      organization_id: nil,
      page: 1,
      page_size: 10,
      search: nil,
      filters: nil
    }

    # merge the defaults with whatever keys are passed in params
    merged_params = Map.merge(defaults, params)

    do_list_invitations(merged_params)
  end

  def do_list_invitations(%{
        organization_id: organization_id,
        search: search,
        page: page,
        page_size: page_size
      }) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    invitations =
      OrganizationsInvitation.base_query()
      |> OrganizationsInvitation.where_organization_id(organization_id)
      |> maybe_search_by_email(search)
      |> Ecto.Query.order_by([d], asc: d.email)
      |> Ecto.Query.limit(^page_size)
      |> Ecto.Query.offset(^offset)
      |> Repo.all()

    invitations
  end

  def count_invitations(%{
        organization_id: organization_id,
        search: search
      }) do
    OrganizationsInvitation.base_query()
    |> OrganizationsInvitation.where_organization_id(organization_id)
    |> maybe_search_by_email(search)
    |> Repo.aggregate(:count, :email)
  end

  defp maybe_search_by_email(query, nil), do: query
  defp maybe_search_by_email(query, ""), do: query

  defp maybe_search_by_email(query, search) do
    from [organizations_invitations: u] in query,
      where: ilike(u.email, ^"%#{search}%")
  end

  defp send_invitation_email(baseUrl, name, email, token) do
    subject = "You have been invited to an Organization on #{name}"

    body = """
    Hello

    You have been invited to join an organization on #{name}. Please click on the link below to accept the invitation.

    #{baseUrl}/invite-organization/?token=#{token}

    """

    deliver(email, subject, body)
  end

  # Delivers the email using the application mailer.
  defp deliver(recipient, subject, body) do
    email =
      Email.new()
      |> Email.to(recipient)
      # TODO: fetch this info from the Network
      |> Email.from({"Castmill", "no-reply@castmill.com"})
      |> Email.subject(subject)
      |> Email.text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end

  def get_invitation(token) do
    from(i in OrganizationsInvitation,
      where: i.token == ^token,
      join: o in assoc(i, :organization),
      preload: [organization: o]
    )
    |> Repo.one()
  end

  # Accepts an invitation by updating the status of the invitation to accepted and
  # adding the user to the organization.
  def accept_invitation(token, user_id) do
    case get_invitation(token) do
      nil ->
        {:error, "Invalid token"}

      invitation ->
        case add_user(invitation.organization_id, user_id, invitation.role) do
          {:ok, _} ->
            from(i in OrganizationsInvitation,
              where: i.token == ^token
            )
            |> Repo.update_all(set: [status: "accepted"])

            {:ok, invitation}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  @doc """
  Removes an invitation from an organization by invitation ID.
  """
  def remove_invitation_from_organization(organization_id, invitation_id) do
    case Repo.get_by(OrganizationsInvitation, id: invitation_id, organization_id: organization_id) do
      nil ->
        {:error, :not_found}

      invitation ->
        Repo.delete(invitation)
    end
  end

  @doc """
    Returns a list of resources of a given resource type
  """
  def list_resources(%{resources: "medias"} = params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Media,
      params
    )
  end

  def list_resources(%{resources: "playlists"} = params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Playlist,
      params
    )
  end

  def list_resources(%{resources: "channels"} = params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Channel,
      params
    )
  end

  def list_resources(%{resources: "devices"} = params) do
    Castmill.Resources.list_resources(Castmill.Devices.Device, params)
  end

  def list_resources(%{resources: "teams"} = params) do
    Castmill.Teams.list_teams(params)
  end

  @doc """
    Returns the count of resources of a given resource type
  """
  def count_resources(%{resources: "medias"} = params) do
    Castmill.Resources.count_resources(Castmill.Resources.Media, params)
  end

  def count_resources(%{resources: "playlists"} = params) do
    Castmill.Resources.count_resources(Castmill.Resources.Playlist, params)
  end

  def count_resources(%{resources: "channels"} = params) do
    Castmill.Resources.count_resources(Castmill.Resources.Channel, params)
  end

  def count_resources(%{resources: "devices"} = params) do
    Castmill.Resources.count_resources(Castmill.Devices.Device, params)
  end

  def count_resources(%{resources: "teams"} = params) do
    Castmill.Teams.count_teams(params)
  end

  @doc """
  Returns the list of medias.

  ## Examples

      iex> list_medias()
      [%Media{}, ...]

  """
  def list_medias(params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Media,
      params
    )
  end

  @doc """
  Returns number of matching medias.

  ## Examples

      iex> count_medias()
      2

  """
  def count_medias(params) do
    Castmill.Resources.count_resources(Castmill.Resources.Media, params)
  end

  @doc """
  Returns the list of playlists.

  ## Examples

      iex> list_playlists()
      [%Playlist{}, ...]

  """
  def list_playlists(params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Playlist,
      params
    )
  end

  @doc """
  Returns number of matching playlists.

  ## Examples

      iex> count_playlists()
      2

  """
  def count_playlists(params) do
    Castmill.Resources.count_resources(Castmill.Resources.Playlist, params)
  end

  @doc """
  Returns the list of channels.

  ## Examples

      iex> list_channels()
      [%Channel{}, ...]

  """
  def list_channels(params) do
    Castmill.Resources.list_resources(
      Castmill.Resources.Channel,
      params
    )
  end

  @doc """
  Returns number of matching channels.

  ## Examples

      iex> count_channels()
      2

  """
  def count_channels(params) do
    Castmill.Resources.count_resources(Castmill.Resources.Channel, params)
  end

  @doc """
  Returns the list of devices.

  ## Examples

      iex> list_devices()
      [%Device{}, ...]

  """
  def list_devices(params) do
    Castmill.Resources.list_resources(
      Castmill.Devices.Device,
      params
    )
  end

  @doc """
  Returns number of matching devices.

  ## Examples

      iex> count_devices()
      2

  """
  def count_devices(params) do
    Castmill.Resources.count_resources(Castmill.Devices.Device, params)
  end

  @doc """
    Update the role for a member of an organization.
  """
  def update_role(organization_id, user_id, role) do
    %Castmill.Organizations.OrganizationsUsers{
      role: role,
      user_id: user_id,
      organization_id: organization_id
    }
    |> Castmill.Repo.insert(
      on_conflict: [set: [role: role]],
      conflict_target: [:organization_id, :user_id]
    )
  end

  @doc """
    Add a user to an organization.
  """
  def add_user(organization_id, user_id, role) do
    %Castmill.Organizations.OrganizationsUsers{
      role: role,
      user_id: user_id,
      organization_id: organization_id
    }
    |> Castmill.Repo.insert()
  end

  @doc """
    Remove a user from an organization.
  """
  def remove_user(organization_id, user_id) do
    case Castmill.Repo.delete_all(
           from(ou in Castmill.Organizations.OrganizationsUsers,
             where: ou.organization_id == ^organization_id and ou.user_id == ^user_id
           )
         ) do
      {1, nil} ->
        {:ok, "User successfully removed."}

      _ ->
        {:error, :not_found}
    end
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking user changes.

  ## Examples

      iex> change_user(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user(%User{} = user, attrs \\ %{}) do
    User.changeset(user, attrs)
  end

  @doc """
    Subscribe to an organization.
  """
  def subscribe(organization_id) do
    Phoenix.PubSub.subscribe(Castmill.PubSub, "organization:#{organization_id}")
  end

  @doc """
    Broadcast to an organization.
  """
  def broadcast({:ok, payload}, organization_id, event) do
    Phoenix.PubSub.broadcast(Castmill.PubSub, "organization:#{organization_id}", {event, payload})

    {:ok, payload}
  end

  def broadcast({:error, _changeset} = error, _organization_id, _event), do: error

  @doc """
    Unsubscribe from an organization.
  """
  def unsubscribe(organization_id) do
    Phoenix.PubSub.unsubscribe(Castmill.PubSub, "organization:#{organization_id}")
  end
end

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
  alias Castmill.Organizations.ResourceSharing
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
  def list_organizations(%{search: search, page: page, page_size: page_size} = params) do
    offset = if is_nil(page_size), do: 0, else: max((page - 1) * page_size, 0)

    Organization.base_query()
    |> QueryHelpers.where_name_like(search)
    |> apply_sorting(params)
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

  # Helper function to apply sorting to a query based on params
  defp apply_sorting(query, params) do
    sort_key = Map.get(params, :key)
    sort_direction = Map.get(params, :direction, "ascending")

    sort_dir =
      case sort_direction do
        "ascending" -> :asc
        "descending" -> :desc
        _ -> :asc
      end

    sort_field =
      case sort_key do
        "name" -> :name
        "inserted_at" -> :inserted_at
        "updated_at" -> :updated_at
        _ -> :name
      end

    Ecto.Query.order_by(query, [{^sort_dir, ^sort_field}])
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

  def is_manager?(organization_id, user_id) do
    role = get_user_role(organization_id, user_id)
    role == :manager
  end

  def has_any_role?(organization_id, user_id, roles) do
    role = get_user_role(organization_id, user_id)

    roles
    |> Enum.map(&normalize_role_input/1)
    |> Enum.member?(role)
  end

  defp normalize_role_input(nil), do: nil

  defp normalize_role_input(role) when is_binary(role) do
    case role do
      "admin" -> :admin
      "manager" -> :manager
      "member" -> :member
      "editor" -> :editor
      "publisher" -> :publisher
      "device_manager" -> :device_manager
      "guest" -> :guest
      _ -> role
    end
  end

  defp normalize_role_input(role), do: role

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
    # Get user's role in the organization
    role = get_user_role(organization_id, user_id)

    # Convert string resource_type to atom for permission matrix
    resource_atom =
      case resource_type do
        "playlists" -> :playlists
        "medias" -> :medias
        "channels" -> :channels
        "devices" -> :devices
        "teams" -> :teams
        "widgets" -> :widgets
        _ -> nil
      end

    # Convert action to atom safely and map controller actions to permission matrix actions
    action_atom =
      case action do
        # Map controller index action to list permission
        :index -> :list
        :show -> :show
        :create -> :create
        :update -> :update
        :delete -> :delete
        "index" -> :list
        "show" -> :show
        "create" -> :create
        "update" -> :update
        "delete" -> :delete
        # Keep other atoms as-is
        a when is_atom(a) -> a
        _ -> :unknown
      end

    # First check the new permission matrix if we have a valid role, resource, and recognized action
    if role != nil and resource_atom != nil and action_atom != :unknown do
      # Use the new centralized permission matrix
      Castmill.Authorization.Permissions.can?(role, resource_atom, action_atom)
    else
      # Fallback to old behavior for legacy resources or explicit database permissions
      cond do
        is_admin?(organization_id, user_id) ->
          true

        resource_type == "teams" and action == :create and is_manager?(organization_id, user_id) ->
          true

        true ->
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
            else
              false
            end
          else
            true
          end
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

  def do_list_users(
        %{
          organization_id: organization_id,
          search: search,
          page: page,
          page_size: page_size
        } = params
      ) do
    offset = if page_size == nil, do: 0, else: max((page - 1) * page_size, 0)

    users =
      OrganizationsUsers.base_query()
      |> OrganizationsUsers.where_organization_id(organization_id)
      |> join(:inner, [ou], u in assoc(ou, :user), as: :user)
      |> maybe_search_by_user_name(search)
      |> apply_users_sorting(params)
      |> Ecto.Query.limit(^page_size)
      |> Ecto.Query.offset(^offset)
      |> select([organizations_users: ou, user: u], %{
        user_id: ou.user_id,
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

  # Helper function to apply sorting to organization users query
  defp apply_users_sorting(query, params) do
    sort_key = Map.get(params, :key)
    sort_direction = Map.get(params, :direction, "ascending")

    sort_dir =
      case sort_direction do
        "ascending" -> :asc
        "descending" -> :desc
        _ -> :asc
      end

    case sort_key do
      "user.name" ->
        Ecto.Query.order_by(query, [organizations_users: _ou, user: u], [{^sort_dir, u.name}])

      "role" ->
        Ecto.Query.order_by(query, [organizations_users: ou, user: _u], [{^sort_dir, ou.role}])

      "inserted_at" ->
        Ecto.Query.order_by(query, [organizations_users: ou, user: _u], [
          {^sort_dir, ou.inserted_at}
        ])

      _ ->
        # Default sorting by user name ascending
        Ecto.Query.order_by(query, [organizations_users: _ou, user: u], asc: u.name)
    end
  end

  def create_organizations_user(attrs) when is_map(attrs) do
    organization_id = Map.get(attrs, :organization_id) || Map.get(attrs, "organization_id")
    user_id = Map.get(attrs, :user_id) || Map.get(attrs, "user_id")
    role = Map.get(attrs, :role) || Map.get(attrs, "role")

    role = normalize_role_value(role, :member)

    add_user(organization_id, user_id, role)
  end

  def get_organizations_user(organization_id, user_id) do
    Repo.get_by(OrganizationsUsers, organization_id: organization_id, user_id: user_id)
  end

  def create_organizations_invitation(attrs) when is_map(attrs) do
    organization_id = Map.get(attrs, :organization_id) || Map.get(attrs, "organization_id")
    email = Map.get(attrs, :email) || Map.get(attrs, "email")
    role = Map.get(attrs, :role) || Map.get(attrs, "role")
    expires_at = Map.get(attrs, :expires_at) || Map.get(attrs, "expires_at")
    status = Map.get(attrs, :status) || Map.get(attrs, "status")
    token = Map.get(attrs, :token) || Map.get(attrs, "token")

    desired_expires_at =
      case expires_at do
        %DateTime{} = dt ->
          if DateTime.compare(dt, DateTime.utc_now()) == :lt do
            nil
          else
            dt
          end

        other ->
          other
      end

    params =
      %{
        organization_id: organization_id,
        email: email,
        role: normalize_role_value(role, :member),
        token: token || generate_invitation_token(),
        expires_at: desired_expires_at,
        status: status
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    %OrganizationsInvitation{}
    |> OrganizationsInvitation.changeset(params)
    |> Repo.insert()
    |> case do
      {:ok, invitation} ->
        updated_invitation = maybe_override_invitation_expiration(invitation, expires_at)
        {:ok, updated_invitation}

      error ->
        error
    end
  end

  def invite_user(organization_id, email, role) do
    token = generate_invitation_token()
    normalized_role = normalize_role_value(role, :member)

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
        role: normalized_role
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

        # Check if user exists and send notification
        case Castmill.Accounts.get_user_by_email(email) do
          nil ->
            # User doesn't exist yet, no notification to send
            :ok

          user ->
            # User exists, send notification
            Castmill.Notifications.Events.notify_organization_invitation(
              user.id,
              organization.name,
              organization_id,
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
        cond do
          OrganizationsInvitation.expired?(invitation) ->
            {:error, :expired}

          invitation.status != "invited" ->
            {:error, :invalid_status}

          true ->
            case add_user(invitation.organization_id, user_id, invitation.role) do
              {:ok, _} ->
                from(i in OrganizationsInvitation,
                  where: i.token == ^token
                )
                |> Repo.update_all(set: [status: "accepted"])

                # Send notification to organization members that invitation was accepted
                user = Castmill.Accounts.get_user(user_id)

                if user do
                  Castmill.Notifications.Events.notify_invitation_accepted(
                    user.name,
                    user_id,
                    invitation.organization_id
                  )
                end

                {:ok, invitation}

              {:error, changeset} ->
                {:error, changeset}
            end
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
          from(i in OrganizationsInvitation,
            where: i.token == ^token
          )
          |> Repo.update_all(set: [status: "rejected"])

          {:ok, invitation}
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

  def list_resources(%{resources: "layouts"} = params) do
    # Use specialized list_layouts to include system layouts
    Castmill.Resources.list_layouts(params)
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

  def count_resources(%{resources: "layouts"} = params) do
    # Use specialized count_layouts to include system layouts
    Castmill.Resources.count_layouts(params)
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
  Returns the list of layouts.
  Includes both organization-specific layouts and system layouts.

  ## Examples

      iex> list_layouts()
      [%Layout{}, ...]

  """
  def list_layouts(params) do
    Castmill.Resources.list_layouts(params)
  end

  @doc """
  Returns number of matching layouts.
  Includes both organization-specific layouts and system layouts.

  ## Examples

      iex> count_layouts()
      2

  """
  def count_layouts(params) do
    Castmill.Resources.count_layouts(params)
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
  def update_role(organization_id, user_id, role) when is_binary(role) do
    # Convert string role to atom (e.g., "editor" -> :editor)
    role_atom = String.to_existing_atom(role)
    update_role(organization_id, user_id, role_atom)
  end

  def update_role(organization_id, user_id, role) when is_atom(role) do
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
    If this is the user's last organization, their account will be deleted automatically.
  """
  def remove_user(organization_id, user_id) do
    with %OrganizationsUsers{} = org_user <-
           Repo.get_by(OrganizationsUsers,
             organization_id: organization_id,
             user_id: user_id
           ),
         :ok <- ensure_additional_org_admins(organization_id, org_user),
         :ok <- ensure_user_has_other_organizations(user_id, organization_id),
         {:ok, _} <- Repo.delete(org_user) do
      # Send notification to organization members
      user = Castmill.Accounts.get_user(user_id)

      if user do
        Castmill.Notifications.Events.notify_member_removed(user.name, organization_id)
      end

      {:ok, "User successfully removed."}
    else
      nil ->
        {:error, :not_found}

      {:error, :last_admin} ->
        {:error, :last_admin}

      {:error, :last_organization} ->
        {:error, :last_organization}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}

      {:error, other} ->
        {:error, other}
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

  defp normalize_role_value(nil, default), do: default

  defp normalize_role_value(role, _default) when is_atom(role), do: role

  defp normalize_role_value(role, default) do
    case normalize_role_input(role) do
      nil -> default
      value when is_atom(value) -> value
      value when is_binary(value) -> string_to_role_atom(value, default)
      _ -> default
    end
  end

  defp generate_invitation_token do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end

  defp string_to_role_atom(value, default) do
    try do
      String.to_existing_atom(value)
    rescue
      ArgumentError ->
        try do
          String.to_atom(value)
        rescue
          ArgumentError -> default
        end
    end
  end

  defp maybe_override_invitation_expiration(invitation, %DateTime{} = expires_at) do
    truncated = DateTime.truncate(expires_at, :second)

    case invitation
         |> Ecto.Changeset.change(%{expires_at: truncated})
         |> Repo.update() do
      {:ok, updated_invitation} -> updated_invitation
      {:error, _changeset} -> invitation
    end
  end

  defp maybe_override_invitation_expiration(invitation, _), do: invitation

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

  # ============================================================================
  # Resource Sharing Functions (Castmill 2.0)
  # ============================================================================

  @doc """
  Check if a user can access a specific resource, considering:
  1. Organization-level permissions (role-based)
  2. Visibility mode (parent/child org access)
  3. Resource sharing (parent shared resources)
  4. Team membership (team-scoped resources)

  ## Parameters
  - `user_id` - The user attempting access
  - `organization_id` - The user's current organization context
  - `resource_type` - Type: "media", "playlist", "channel", "device", "widget"
  - `resource_id` - Specific resource ID
  - `action` - Action to perform: :read, :update, :delete, etc.

  ## Returns
  `{:ok, true}` if access is granted, `{:ok, false}` otherwise
  """
  def can_access_resource?(user_id, organization_id, resource_type, resource_id, action) do
    # First check if user has base permission for this resource type and action
    unless has_access(organization_id, user_id, resource_type, action) do
      {:ok, false}
    else
      # Get the actual resource to check its organization_id
      resource_module =
        case resource_type do
          "media" -> Castmill.Resources.Media
          "playlist" -> Castmill.Resources.Playlist
          "channel" -> Castmill.Resources.Channel
          "device" -> Castmill.Devices.Device
          "widget" -> Castmill.Resources.Widget
          _ -> nil
        end

      cond do
        resource_module == nil ->
          {:ok, false}

        true ->
          resource = Repo.get(resource_module, resource_id)

          cond do
            resource == nil ->
              {:ok, false}

            # Check if resource belongs to user's org
            resource.organization_id == organization_id ->
              {:ok, true}

            # Resource belongs to different org - check visibility mode and sharing
            true ->
              check_cross_org_access(user_id, organization_id, resource, resource_type, action)
          end
      end
    end
  end

  # Private helper for cross-organization access checking
  defp check_cross_org_access(user_id, user_org_id, resource, resource_type, action) do
    user_org = get_organization!(user_org_id)
    resource_org = get_organization!(resource.organization_id)
    user_role = get_user_role(user_org_id, user_id)

    cond do
      # Case 1: Resource is from parent org, check if shared with us
      resource_org.id == user_org.organization_id ->
        atom_resource_type = String.to_existing_atom(resource_type)

        can_access =
          Castmill.Authorization.VisibilityMode.can_access_parent_resource?(
            user_org_id,
            resource.id,
            atom_resource_type,
            action
          )

        {:ok, can_access}

      # Case 2: Resource is from child org, check if we're admin with visibility rights
      user_org.id == resource_org.organization_id and user_role == :admin ->
        can_access =
          Castmill.Authorization.VisibilityMode.can_access_child_resources?(
            user_org_id,
            resource.organization_id,
            action
          )

        {:ok, can_access}

      # Case 3: No relationship or insufficient permissions
      true ->
        {:ok, false}
    end
  end

  @doc """
  Share a resource with child organizations.

  ## Parameters
  - `resource_type` - Type of resource: "media", "playlist", "channel", "device", "widget"
  - `resource_id` - ID of the specific resource
  - `organization_id` - ID of the organization sharing the resource
  - `opts` - Options:
    - `:sharing_mode` - :children (default), :descendants, :network
    - `:access_level` - :read (default), :read_write, :full

  ## Examples

      iex> share_resource("playlist", 123, org_id, sharing_mode: :children, access_level: :read)
      {:ok, %ResourceSharing{}}
  """
  def share_resource(resource_type, resource_id, organization_id, opts \\ []) do
    sharing_mode = Keyword.get(opts, :sharing_mode, :children)
    access_level = Keyword.get(opts, :access_level, :read)

    %ResourceSharing{}
    |> ResourceSharing.changeset(%{
      resource_type: resource_type,
      resource_id: resource_id,
      organization_id: organization_id,
      sharing_mode: sharing_mode,
      access_level: access_level
    })
    |> Repo.insert()
  end

  @doc """
  Unshare a resource (remove from resource sharing).
  """
  def unshare_resource(resource_type, resource_id) do
    case ResourceSharing.get_sharing(resource_type, resource_id) do
      nil -> {:error, :not_shared}
      sharing -> Repo.delete(sharing)
    end
  end

  @doc """
  Check if a resource is shared with child organizations.
  """
  def resource_shared?(resource_type, resource_id) do
    ResourceSharing.is_shared?(resource_type, resource_id)
  end

  @doc """
  Get all shared resources of a type for an organization.
  Returns resource IDs that are shared by this org to its children.
  """
  def list_shared_resources(resource_type, organization_id) do
    ResourceSharing.shared_resource_ids(resource_type, organization_id)
  end

  @doc """
  Get resources accessible to a child organization from parent(s).
  Returns map with resource_id, access_level, and parent_org_id.
  """
  def accessible_parent_resources(resource_type, child_org_id) do
    ResourceSharing.accessible_from_parents(resource_type, child_org_id)
  end

  @doc """
  Update sharing configuration for a resource.
  """
  def update_resource_sharing(resource_type, resource_id, attrs) do
    case ResourceSharing.get_sharing(resource_type, resource_id) do
      nil ->
        {:error, :not_found}

      sharing ->
        sharing
        |> ResourceSharing.changeset(attrs)
        |> Repo.update()
    end
  end

  defp ensure_additional_org_admins(_organization_id, %OrganizationsUsers{role: role})
       when role != :admin,
       do: :ok

  defp ensure_additional_org_admins(organization_id, %OrganizationsUsers{role: :admin}) do
    if count_org_admins(organization_id) <= 1 do
      {:error, :last_admin}
    else
      :ok
    end
  end

  defp ensure_user_has_other_organizations(user_id, _current_organization_id) do
    # Count how many organizations the user belongs to
    org_count =
      OrganizationsUsers.base_query()
      |> where([organizations_users: ou], ou.user_id == ^user_id)
      |> Repo.aggregate(:count, :user_id)

    # If user only belongs to 1 organization (the current one), prevent removal
    if org_count <= 1 do
      {:error, :last_organization}
    else
      :ok
    end
  end

  defp count_org_admins(organization_id) do
    OrganizationsUsers.base_query()
    |> OrganizationsUsers.where_organization_id(organization_id)
    |> where([organizations_users: ou], ou.role == :admin)
    |> Repo.aggregate(:count, :user_id)
  end
end

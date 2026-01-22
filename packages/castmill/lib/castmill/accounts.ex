defmodule Castmill.Accounts do
  @moduledoc """
  The Accounts context.
  """

  @behaviour Castmill.AccountsBehaviour

  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Accounts.AccessToken
  alias Castmill.Accounts.UserToken
  alias Castmill.Accounts.UserNotifier
  alias Castmill.Accounts.User
  alias Castmill.Organizations.Organization
  alias Castmill.Organizations.OrganizationsUsers
  alias Castmill.Accounts.SignUp
  alias Castmill.Accounts.UserCredential
  alias Castmill.QueryHelpers

  @doc """
    List all users.
  """
  def list_users(%{search: search, page: page, page_size: page_size}) do
    offset = max((page - 1) * page_size, 0)

    User.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Ecto.Query.order_by([d], asc: d.name)
    |> Ecto.Query.limit(^page_size)
    |> Ecto.Query.offset(^offset)
    |> Repo.all()
  end

  def list_users do
    Repo.all(User)
  end

  def count_users(%{search: search}) do
    User.base_query()
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
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
    Returns the user with the access that has the given token.
  """
  def get_user_by_access_token(token, source_ip) do
    if is_nil(token) do
      {:error, "No token provided"}
    else
      secret_hash = :crypto.hash(:sha256, token) |> Base.encode16()

      from(at in AccessToken, where: at.secret_hash == ^secret_hash, select: at)
      |> Repo.update_all(
        set: [accessed_at: DateTime.utc_now(), last_ip: source_ip],
        inc: [accessed: 1]
      )
      |> case do
        {0, _} ->
          {:error, "Invalid token"}

        {1, [access_token]} ->
          case Repo.get_by!(User, id: access_token.user_id) do
            nil -> {:error, "Invalid token"}
            user -> {:ok, Map.merge(user, %{is_root: access_token.is_root})}
          end

        _ ->
          {:error, "Invalid token"}
      end
    end
  end

  @doc """
    Returns the user with the given email.
  """
  def get_user_by_email(email) do
    Repo.get_by(User, email: email)
  end

  def get_user(id) do
    Repo.get(User, id)
  end

  @doc """
  Returns the list of access_tokens.

  ## Examples

      iex> list_access_tokens()
      [%AccessToken{}, ...]

  """
  def list_access_tokens do
    Repo.all(AccessToken)
  end

  @doc """
  Gets a single access_token.

  Raises `Ecto.NoResultsError` if the Access token does not exist.

  ## Examples

      iex> get_access_token!(123)
      %AccessToken{}

      iex> get_access_token!(456)
      ** (Ecto.NoResultsError)

  """
  def get_access_token!(id), do: Repo.get!(AccessToken, id)

  @doc """
  Creates a access_token.

  ## Examples

      iex> create_access_token(%{field: value})
      {:ok, %AccessToken{}}

      iex> create_access_token(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_access_token(attrs \\ %{}) do
    %AccessToken{}
    |> AccessToken.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a access_token.

  ## Examples

      iex> update_access_token(access_token, %{field: new_value})
      {:ok, %AccessToken{}}

      iex> update_access_token(access_token, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_access_token(%AccessToken{} = access_token, attrs) do
    access_token
    |> AccessToken.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a access_token.

  ## Examples

      iex> delete_access_token(access_token)
      {:ok, %AccessToken{}}

      iex> delete_access_token(access_token)
      {:error, %Ecto.Changeset{}}

  """
  def delete_access_token(%AccessToken{} = access_token) do
    Repo.delete(access_token)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking access_token changes.

  ## Examples

      iex> change_access_token(access_token)
      %Ecto.Changeset{data: %AccessToken{}}

  """
  def change_access_token(%AccessToken{} = access_token, attrs \\ %{}) do
    AccessToken.changeset(access_token, attrs)
  end

  @doc """
  Creates a access_token.

  ## Examples

      iex> create_access_token(%{field: value})
      {:ok, %AccessToken{}}

      iex> create_access_token(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_user(attrs \\ %{}) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
    Delete user by id.

    Before deleting:
    - If user is the ONLY user in an organization, automatically delete that organization
    - If user is the sole admin BUT there are other users, prevent deletion (must transfer admin first)
    - Otherwise, allow deletion

    This ensures no dangling organizations are left in the system.
  """
  def delete_user(user_id) do
    Repo.transaction(fn ->
      # Get all organizations where user is a member
      user_orgs =
        from(ou in OrganizationsUsers,
          where: ou.user_id == ^user_id,
          select: %{org_id: ou.organization_id, role: ou.role}
        )
        |> Repo.all()

      # Check each organization and handle accordingly
      Enum.each(user_orgs, fn %{org_id: org_id, role: role} ->
        # Count total users in this organization
        total_users =
          from(ou in OrganizationsUsers,
            where: ou.organization_id == ^org_id,
            select: count(ou.user_id)
          )
          |> Repo.one()

        cond do
          # If this is the only user, delete the organization
          total_users == 1 ->
            case Repo.get(Organization, org_id) do
              nil ->
                :ok

              org ->
                # Delete the organization (will cascade delete org_user relationships)
                case Repo.delete(org) do
                  {:ok, _} ->
                    :ok

                  {:error, changeset} ->
                    Repo.rollback("Failed to delete organization: #{inspect(changeset)}")
                end
            end

          # If user is sole admin but there are other users, prevent deletion
          role == :admin ->
            admin_count =
              from(ou in OrganizationsUsers,
                where: ou.organization_id == ^org_id and ou.role == :admin,
                select: count(ou.user_id)
              )
              |> Repo.one()

            if admin_count == 1 do
              org_name =
                from(o in Organization,
                  where: o.id == ^org_id,
                  select: o.name
                )
                |> Repo.one()

              Repo.rollback({:sole_administrator, org_name})
            end

          # User is not sole admin, safe to delete
          true ->
            :ok
        end
      end)

      # Now delete the user (org_user relationships will be deleted via cascade or above)
      case Repo.delete_all(
             from(user in Castmill.Accounts.User,
               where: user.id == ^user_id
             )
           ) do
        {1, nil} ->
          "User successfully deleted."

        _ ->
          Repo.rollback(:not_found)
      end
    end)
    |> case do
      {:ok, message} ->
        {:ok, message}

      {:error, :not_found} ->
        {:error, :not_found}

      {:error, reason} when is_binary(reason) ->
        {:error, reason}

      {:error, {:sole_administrator, org_name}} ->
        {:error,
         "Cannot delete account. You are the sole administrator of '#{org_name}' which has other members"}

      {:error, other} ->
        {:error, "Failed to delete user: #{inspect(other)}"}
    end
  end

  ## Session

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user_id) do
    {token, user_token} = UserToken.build_session_token(user_id)
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user with the given signed token.
  """
  def get_user_by_session_token(token) do
    {:ok, query} = UserToken.verify_session_token_query(token)
    Repo.one(query)
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(token) do
    Repo.delete_all(UserToken.token_and_context_query(token, "session"))
    :ok
  end

  ## Reset password

  @doc ~S"""
  Delivers the reset password email to the given user.

  ## Examples

      iex> deliver_user_reset_password_instructions(user, &url(~p"/users/reset_password/#{&1}"))
      {:ok, %{to: ..., body: ...}}

  """
  def deliver_user_reset_password_instructions(%User{} = user, reset_password_url_fun)
      when is_function(reset_password_url_fun, 1) do
    {encoded_token, user_token} = UserToken.build_email_token(user, "reset_password")
    Repo.insert!(user_token)
    UserNotifier.deliver_reset_password_instructions(user, reset_password_url_fun.(encoded_token))
  end

  @doc """
  Gets the user by reset password token.

  ## Examples

      iex> get_user_by_reset_password_token("validtoken")
      %User{}

      iex> get_user_by_reset_password_token("invalidtoken")
      nil
  """
  def get_user_by_reset_password_token(token) do
    with {:ok, query} <- UserToken.verify_email_token_query(token, "reset_password"),
         %User{} = user <- Repo.one(query) do
      user
    else
      _ -> nil
    end
  end

  @doc """
  Resets the user password.

  ## Examples

      iex> reset_user_password(user, %{password: "new long password", password_confirmation: "new long password"})
      {:ok, %User{}}

      iex> reset_user_password(user, %{password: "valid", password_confirmation: "not the same"})
      {:error, %Ecto.Changeset{}}

  """
  def reset_user_password(user, attrs) do
    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, User.password_changeset(user, attrs))
    |> Ecto.Multi.delete_all(:tokens, UserToken.user_and_contexts_query(user, :all))
    |> Repo.transaction()
    |> case do
      {:ok, %{user: user}} -> {:ok, user}
      {:error, :user, changeset, _} -> {:error, changeset}
    end
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user password.

  ## Examples

      iex> change_user_password(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user_password(user, attrs \\ %{}) do
    User.password_changeset(user, attrs, hash_password: false)
  end

  ## Recover credentials

  @doc ~S"""
  Delivers the recover credentials email to the given user.

  ## Examples

      iex> deliver_user_recover_credentials_instructions(user, &url(~p"/recover-credentials/#{&1}"))
      {:ok, %{to: ..., body: ...}}

  """
  def deliver_user_recover_credentials_instructions(%User{} = user, recover_credentials_url_fun)
      when is_function(recover_credentials_url_fun, 1) do
    {encoded_token, user_token} = UserToken.build_email_token(user, "recover_credentials")
    Repo.insert!(user_token)

    UserNotifier.deliver_recover_credentials_instructions(
      user,
      recover_credentials_url_fun.(encoded_token)
    )
  end

  @doc """
  Gets the user by recover credentials token.

  ## Examples

      iex> get_user_by_recover_credentials_token("validtoken")
      %User{}

      iex> get_user_by_recover_credentials_token("invalidtoken")
      nil
  """
  def get_user_by_recover_credentials_token(token) do
    with {:ok, query} <- UserToken.verify_email_token_query(token, "recover_credentials"),
         %User{} = user <- Repo.one(query) do
      user
    else
      _ -> nil
    end
  end

  @doc """
    Creates a Signup and sends verification email with instructions.
  """
  def create_signup(attrs) do
    %SignUp{}
    |> SignUp.changeset(attrs)
    |> Repo.insert()
    |> case do
      {:ok, signup} ->
        {:ok, signup}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
    Registers a user based on an existing Signup
    with the given email, credential_id, and public_key_spki.
  """
  def create_user_from_signup(
        signup_id,
        email,
        credential_id,
        public_key_spki,
        device_info \\ %{},
        invitation_token \\ nil
      ) do
    Repo.transaction(fn ->
      with {:ok, signup} <- validate_signup(signup_id, email),
           {:ok, %{id: user_id} = user} <-
             create_user_with_optional_organization(email, signup.network_id, invitation_token),
           :ok <- create_user_credential(user_id, credential_id, public_key_spki, device_info),
           :ok <- update_signup_status(signup, user_id),
           :ok <- handle_invitation_acceptance(invitation_token, user_id) do
        Castmill.Hooks.trigger_hook(:user_signup, %{user_id: user_id, email: email})

        sanitize_user(user)
      else
        {:error, error} ->
          Repo.rollback(error)
          {:error, error}
      end
    end)
  end

  def get_credential(id) do
    Repo.get(UserCredential, id)
  end

  @doc """
  List all credentials for a user
  """
  def list_user_credentials(user_id) do
    from(uc in UserCredential, where: uc.user_id == ^user_id, order_by: [desc: uc.inserted_at])
    |> Repo.all()
  end

  @doc """
  Delete a specific user credential
  """
  def delete_user_credential(user_id, credential_id) do
    from(uc in UserCredential, where: uc.user_id == ^user_id and uc.id == ^credential_id)
    |> Repo.delete_all()
    |> case do
      {1, nil} -> {:ok, "Credential deleted successfully"}
      {0, nil} -> {:error, :not_found}
    end
  end

  @doc """
  Add a new credential/passkey for an existing user
  """
  def add_user_credential(user_id, credential_id, public_key_spki, device_info \\ %{}) do
    %UserCredential{}
    |> UserCredential.changeset(%{
      id: credential_id,
      public_key_spki: public_key_spki,
      user_id: user_id,
      device_name: device_info[:device_name],
      browser: device_info[:browser],
      os: device_info[:os],
      user_agent: device_info[:user_agent]
    })
    |> Repo.insert()
    |> case do
      {:ok, credential} -> {:ok, credential}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Add a friendly name to a credential by storing it in user meta
  """
  def update_credential_name(user_id, credential_id, name) do
    with user when not is_nil(user) <- Repo.get(User, user_id) do
      current_meta = user.meta || %{}
      credential_names = Map.get(current_meta, "credential_names", %{})
      updated_credential_names = Map.put(credential_names, credential_id, name)
      updated_meta = Map.put(current_meta, "credential_names", updated_credential_names)

      user
      |> Ecto.Changeset.change(meta: updated_meta)
      |> Repo.update()
    else
      nil -> {:error, :user_not_found}
    end
  end

  @doc """
  Get credential name from user meta
  """
  def get_credential_name(user, credential_id) do
    credential = Repo.get(UserCredential, credential_id)

    (user.meta || %{})
    |> Map.get("credential_names", %{})
    |> Map.get(credential_id, generate_default_credential_name(credential))
  end

  defp generate_default_credential_name(credential) when is_nil(credential), do: "Passkey"

  defp generate_default_credential_name(credential) do
    # Use device_name if available (e.g., "Chrome on macOS")
    if credential.device_name do
      credential.device_name
    else
      # Fallback to date-based name
      date =
        credential.inserted_at
        |> Calendar.strftime("%b %d, %Y at %H:%M")

      "Passkey created on #{date}"
    end
  end

  @doc """
  Send email verification when email is updated
  """
  def send_email_verification(%User{} = user, new_email) do
    {encoded_token, user_token} = UserToken.build_email_token(user, "email_verification")
    Repo.insert!(user_token)

    # Store the new email in token context for verification
    UserNotifier.deliver_email_verification_instructions(user, new_email, encoded_token)
  end

  @doc """
  Verify email with token and update user email
  """
  def verify_email_token(token, new_email) do
    with {:ok, query} <- UserToken.verify_email_token_query(token, "email_verification"),
         %UserToken{user_id: user_id} = user_token <- Repo.one(query),
         %User{} = user <- Repo.get(User, user_id) do
      # Update user email and delete the token
      Ecto.Multi.new()
      |> Ecto.Multi.update(:user, User.changeset(user, %{email: new_email}))
      |> Ecto.Multi.delete(:token, user_token)
      |> Repo.transaction()
      |> case do
        {:ok, %{user: user}} -> {:ok, user}
        {:error, changeset} -> {:error, changeset}
      end
    else
      _ -> {:error, :invalid_token}
    end
  end

  def get_network_id_by_domain(domain) do
    case from(network in Castmill.Networks.Network,
           where: network.domain == ^domain,
           select: network.id
         )
         |> Repo.one() do
      nil ->
        {:error, :network_not_found}

      network_id ->
        {:ok, network_id}
    end
  end

  ## Addons
  def list_addons(_user_id) do
    # Get all addons from the configuration
    Application.get_env(:castmill, :addons)
    # Call component_info/0 on each
    |> Enum.map(& &1.component_info())
    # Exclude addons that return nil
    |> Enum.filter(&(&1 != nil))
  end

  defp validate_signup(signup_id, email) do
    case Repo.get(SignUp, signup_id) do
      nil ->
        {:error, "Invalid signup"}

      %SignUp{} = signup ->
        cond do
          signup.status != :created ->
            {:error, "Signup status is not 'created'."}

          signup.email != email ->
            {:error, "Email does not match."}

          true ->
            {:ok, signup}
        end
    end
  end

  # Creates a user with the given email and network_id with a default organization
  # The organization is created with a temporary name (user's email) and onboarding_completed set to false
  # to trigger the onboarding flow where the user must provide a proper organization name.
  defp create_user_and_organization(email, network_id) do
    # Generate a temporary organization name based on timestamp to avoid conflicts
    temp_org_name = "org_#{:os.system_time(:millisecond)}"

    with {:ok, user} <-
           Repo.insert(
             User.changeset(%User{}, %{name: email, email: email, network_id: network_id})
           ),
         {:ok, organization} <-
           Repo.insert(
             Organization.changeset(%Organization{}, %{
               name: temp_org_name,
               network_id: network_id,
               onboarding_completed: false
             })
           ),
         {:ok, _org_user} <-
           Repo.insert(
             OrganizationsUsers.changeset(%OrganizationsUsers{}, %{
               role: :admin,
               organization_id: organization.id,
               user_id: user.id
             })
           ) do
      {:ok, user}
    else
      {:error, %Ecto.Changeset{errors: errors} = changeset} ->
        # Extract readable error message
        error_message =
          case errors do
            [name: {msg, _}] when is_binary(msg) ->
              "Organization #{msg}. This account may have been previously deleted. Please contact support."

            [email: {msg, _}] when is_binary(msg) ->
              "Email #{msg}."

            _ ->
              "Failed to create account: #{inspect(changeset)}"
          end

        {:error, error_message}

      {:error, other} ->
        {:error, "Failed to create account: #{inspect(other)}"}
    end
  end

  # Creates a user, optionally with an organization
  # If invitation_token is provided, skip organization creation (user will be added via invitation acceptance)
  defp create_user_with_optional_organization(email, network_id, nil) do
    # No invitation token - create user with default organization
    create_user_and_organization(email, network_id)
  end

  defp create_user_with_optional_organization(email, network_id, _invitation_token) do
    # Has invitation token - just create user, skip organization
    # Organization will be created/joined when invitation is accepted
    Repo.insert(User.changeset(%User{}, %{name: email, email: email, network_id: network_id}))
  end

  # Handles accepting invitations after user is created
  defp handle_invitation_acceptance(nil, _user_id), do: :ok

  defp handle_invitation_acceptance(invitation_token, user_id) do
    # Try network invitation first
    case Castmill.Networks.get_network_invitation_by_token(invitation_token) do
      nil ->
        # Try organization invitation
        case Castmill.Organizations.get_invitation_by_token(invitation_token) do
          nil ->
            # No valid invitation found, but we already created the user
            # This is okay - they might accept the invitation later
            :ok

          _org_invitation ->
            # Accept organization invitation
            case Castmill.Organizations.accept_invitation(invitation_token, user_id) do
              {:ok, _} -> :ok
              {:error, reason} -> {:error, reason}
            end
        end

      _net_invitation ->
        # Accept network invitation
        case Castmill.Networks.accept_network_invitation(invitation_token, user_id) do
          {:ok, _organization} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp create_user_credential(user_id, credential_id, public_key_spki, device_info) do
    %UserCredential{}
    |> UserCredential.changeset(%{
      id: credential_id,
      public_key_spki: public_key_spki,
      user_id: user_id,
      device_name: device_info[:device_name],
      browser: device_info[:browser],
      os: device_info[:os],
      user_agent: device_info[:user_agent]
    })
    |> Repo.insert()
    |> case do
      {:ok, _credential} -> :ok
      {:error, changeset} -> {:error, inspect(changeset)}
    end
  end

  defp update_signup_status(signup, user_id) do
    signup
    |> SignUp.changeset(%{status: :registered, user_id: user_id})
    |> Repo.update()
    |> case do
      {:ok, _signup} -> :ok
      {:error, _changeset} -> {:error, "Failed to update signup status"}
    end
  end

  defp sanitize_user(user) do
    # Here, selectively choose which fields of the user to expose
    %{
      id: user.id,
      email: user.email,
      name: user.name
      # other fields as needed
    }
  end
end

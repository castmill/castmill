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
    if token == nil do
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

    TODO: If the user is the last user of an organization we need to delete the organization as well,
    including all the resources associated with it, that includes medias, playlists, displays, etc, etc.
  """
  def delete_user(user_id) do
    case Repo.delete_all(
           from(user in Castmill.Accounts.User,
             where: user.id == ^user_id
           )
         ) do
      {1, nil} ->
        {:ok, "User successfully deleted."}

      _ ->
        {:error, :not_found}
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
  def create_user_from_signup(signup_id, email, credential_id, public_key_spki) do
    Repo.transaction(fn ->
      with {:ok, signup} <- validate_signup(signup_id, email),
           {:ok, %{id: user_id} = user} <- create_user_for_email(email),
           :ok <- create_user_credential(user_id, credential_id, public_key_spki),
           :ok <- update_signup_status(signup, user_id) do
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

  defp create_user_for_email(email) do
    %User{}
    |> User.changeset(%{name: email, email: email})
    |> Repo.insert()
    |> case do
      {:ok, user} -> {:ok, user}
      {:error, changeset} -> {:error, inspect(changeset)}
    end
  end

  defp create_user_credential(user_id, credential_id, public_key_spki) do
    %UserCredential{}
    |> UserCredential.changeset(%{
      id: credential_id,
      public_key_spki: public_key_spki,
      user_id: user_id
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

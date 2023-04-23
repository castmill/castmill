defmodule Castmill.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias Castmill.Repo

  alias Castmill.Accounts.AccessToken
  alias Castmill.Accounts.User

  @doc """
    Returns the user with the access that has the given bearer token.
  """
  def get_user_by_access_token(token, source_ip) do
    if token == nil do
      {:error, "No token provided"}
    else
      secret_hash = :crypto.hash(:sha256, token) |> Base.encode16()
      from(at in AccessToken, where: at.secret_hash == ^secret_hash, select: at)
      |> Repo.update_all(set: [accessed_at: DateTime.utc_now(), last_ip: source_ip], inc: [accessed: 1])
      |> case do
        { 0, _ } -> {:error, "Invalid token"}
        { 1, [access_token] } ->
          case Repo.get_by!(User, id: access_token.user_id) do
            nil -> {:error, "Invalid token"}
            user -> {:ok, Map.merge(user, %{ is_root: access_token.is_root })}
          end
        _ -> {:error, "Invalid token"}
      end
    end
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
    case Repo.delete_all(from user in Castmill.Accounts.User,
      where: user.id == ^user_id) do
        {1, nil} ->
          {:ok, "User successfully deleted."}
        _ ->
          {:error, :not_found}
      end
  end
end

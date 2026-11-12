defmodule Castmill.Accounts.AdminPasskeys do
  @moduledoc """
  Root-admin credentials, isolated from dashboard passkeys. All credential
  mutations lock the user so first enrollment and last-key deletion are atomic.
  """
  import Ecto.Query
  alias Castmill.Accounts.{AccessToken, AdminPasskey, User, UserToken}
  alias Castmill.Repo

  def root_user?(%User{blocked_at: nil, is_agent: false, id: id}) do
    Repo.exists?(from t in AccessToken, where: t.user_id == ^id and t.is_root == true)
  end

  def root_user?(_), do: false

  def list(user_id) do
    Repo.all(from k in AdminPasskey, where: k.user_id == ^user_id, order_by: [asc: k.inserted_at])
  end

  def enrolled?(user_id) do
    Repo.exists?(from k in AdminPasskey, where: k.user_id == ^user_id)
  end

  def get(id) when is_binary(id), do: Repo.get(AdminPasskey, id)

  def register(user_id, auth_data, name, bootstrap?) do
    mutate(fn ->
      lock_root!(user_id)
      if bootstrap? && enrolled?(user_id), do: Repo.rollback(:already_enrolled)

      attested = auth_data.attested_credential_data

      changeset =
        AdminPasskey.changeset(%AdminPasskey{}, %{
          id: Base.url_encode64(attested.credential_id, padding: false),
          user_id: user_id,
          public_key: :erlang.term_to_binary(attested.credential_public_key),
          sign_count: auth_data.sign_count,
          name: name
        })

      case Repo.insert(changeset) do
        {:ok, key} ->
          tokens = revoke_sessions(user_id)
          token = Castmill.Accounts.generate_admin_session_token(user_id)
          {{key, token}, tokens}

        {:error, changeset} ->
          Repo.rollback(changeset)
      end
    end)
  end

  def authenticate(key, auth_data) do
    Repo.transaction(fn ->
      user = lock_root!(key.user_id)
      current = Repo.get(AdminPasskey, key.id)
      if is_nil(current), do: Repo.rollback(:not_found)

      # Synced passkeys may always report zero. Nonzero counters must advance.
      unless (current.sign_count == 0 && auth_data.sign_count == 0) ||
               auth_data.sign_count > current.sign_count do
        Repo.rollback(:invalid_counter)
      end

      current
      |> Ecto.Changeset.change(sign_count: auth_data.sign_count)
      |> Repo.update!()

      {user, Castmill.Accounts.generate_admin_session_token(user.id)}
    end)
  end

  def delete(user_id, id) do
    mutate(fn ->
      lock_root!(user_id)
      key = Repo.get_by(AdminPasskey, id: id, user_id: user_id)
      if is_nil(key), do: Repo.rollback(:not_found)
      if length(list(user_id)) <= 1, do: Repo.rollback(:last_passkey)
      Repo.delete!(key)
      {key, revoke_sessions(user_id)}
    end)
  end

  @doc """
  Operator-only recovery from a trusted release console. Removes admin passkeys
  and sessions so root credentials can bootstrap again. Never expose over HTTP.
  """
  def reset(user_id) do
    mutate(fn ->
      lock_root!(user_id)
      Repo.delete_all(from k in AdminPasskey, where: k.user_id == ^user_id)
      {:ok, revoke_sessions(user_id)}
    end)
  end

  defp lock_root!(user_id) do
    user = Repo.one(from u in User, where: u.id == ^user_id, lock: "FOR UPDATE")
    unless root_user?(user), do: Repo.rollback(:not_root)
    user
  end

  defp revoke_sessions(user_id) do
    {_count, tokens} =
      Repo.delete_all(
        from t in UserToken,
          where:
            t.user_id == ^user_id and
              t.context in ["admin_session", "admin_passkey_session", "admin_enrollment"],
          select: t.token
      )

    tokens
  end

  defp mutate(fun) do
    case Repo.transaction(fun) do
      {:ok, {result, tokens}} ->
        Enum.each(tokens, fn token ->
          CastmillWeb.Endpoint.broadcast(
            "admin_users_sessions:#{Base.url_encode64(token)}",
            "disconnect",
            %{}
          )
        end)

        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

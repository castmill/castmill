defmodule Castmill.Repo.Migrations.AddRootUser do
  use Ecto.Migration

  # Seeds an initial root (super-admin) user ONLY when both
  # CASTMILL_ROOT_USER_EMAIL and CASTMILL_ROOT_USER_PASSWORD are explicitly set.
  #
  # Read the environment directly (not CastmillWeb.Secrets, which provides the
  # weak "root@example.com" / "root" defaults) so that a deployment which does
  # NOT set these variables gets NO root here instead of a trivially-guessable
  # one. Runtime provisioning (e.g. CastmillSaas.Release with CASTMILL_ROOT_ADMINS)
  # is responsible for creating root users in that case.
  #
  # This only affects fresh databases; existing databases already ran this
  # migration. Tests create their own root via fixtures, so skipping here is safe.
  def change do
    email = System.get_env("CASTMILL_ROOT_USER_EMAIL")
    password = System.get_env("CASTMILL_ROOT_USER_PASSWORD")

    if is_binary(email) and email != "" and is_binary(password) and password != "" do
      seed_root_user(email, password)
    else
      :ok
    end
  end

  defp seed_root_user(email, password) do
    # Use raw SQL to avoid schema changes affecting this migration
    user_id = Ecto.UUID.generate()
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    execute("""
    INSERT INTO users (id, name, email, inserted_at, updated_at)
    VALUES ('#{user_id}', 'root', '#{email}', '#{now}', '#{now}')
    """)

    # The access token is constructed from the user's name and a password
    token = email <> ":" <> password
    secret_hash = :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)

    # access_tokens uses bigserial ID, so don't pass an ID
    execute("""
    INSERT INTO access_tokens (is_root, user_id, secret_hash, inserted_at, updated_at)
    VALUES (true, '#{user_id}', '#{secret_hash}', '#{now}', '#{now}')
    """)
  end
end

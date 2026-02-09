defmodule Castmill.Repo.Migrations.AddRootUser do
  use Ecto.Migration

  def change do
    email =
      CastmillWeb.Secrets.get_root_user_email() ||
        raise "environment variable CASTMILL_ROOT_USER_EMAIL is missing."

    password =
      CastmillWeb.Secrets.get_root_user_password() ||
        raise "environment variable CASTMILL_ROOT_USER_PASSWORD is missing."

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

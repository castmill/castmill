defmodule Castmill.Repo.Migrations.CreateWebauthnChallenges do
  use Ecto.Migration

  def change do
    create table(:webauthn_challenges, primary_key: false) do
      add :challenge, :text, primary_key: true
      add :expires_at, :utc_datetime_usec, null: false
    end

    # Index for periodic cleanup of expired rows
    create index(:webauthn_challenges, [:expires_at])
  end
end

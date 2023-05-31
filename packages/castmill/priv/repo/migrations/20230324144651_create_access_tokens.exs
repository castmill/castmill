defmodule Castmill.Repo.Migrations.CreateAccessTokens do
  use Ecto.Migration

  def change do
    create table(:access_tokens) do
      add :secret_hash, :string, unique: true, null: false
      add :accessed, :integer
      add :accessed_at, :utc_datetime
      add :last_ip, :string
      add :is_root, :boolean, default: false

      add :user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false

      timestamps()
    end

    create index(:access_tokens, [:user_id])
    create unique_index(:access_tokens, [:secret_hash])
  end
end

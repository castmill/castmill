defmodule Castmill.Repo.Migrations.CreateAdminPasskeys do
  use Ecto.Migration

  def change do
    create table(:admin_passkeys, primary_key: false) do
      add :id, :text, primary_key: true
      add :user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false
      add :public_key, :binary, null: false
      add :sign_count, :bigint, null: false, default: 0
      add :name, :string, null: false
      timestamps()
    end

    create index(:admin_passkeys, [:user_id])
  end
end

defmodule Castmill.Repo.Migrations.CreateOrganizationsUsers do
  use Ecto.Migration

  def change do
    create table(:organizations_users, primary_key: false) do
      add :role, :string, null: false

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :user_id, references(:users, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end

    create unique_index(:organizations_users, [:organization_id, :user_id])
  end
end

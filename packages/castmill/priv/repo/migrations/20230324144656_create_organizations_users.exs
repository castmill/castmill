defmodule Castmill.Repo.Migrations.CreateOrganizationsUsers do
  use Ecto.Migration

  def change do
    create table(:organizations_users, primary_key: false) do
      add :access, {:array, :string}, default: ["read", "write", "delete"], null: false

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all), null: false, primary_key: true
      add :user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false, primary_key: true

      timestamps()
    end
  end
end

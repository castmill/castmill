defmodule Castmill.Repo.Migrations.CreateOrganizationsUsersAccess do
  use Ecto.Migration

  def change do
    create table(:organizations_users_access, primary_key: false) do
      add :access, :string, null: false, primary_key: true

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :user_id, references(:users, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end
  end
end

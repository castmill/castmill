defmodule Castmill.Repo.Migrations.CreateOrganizationsUsers do
  use Ecto.Migration

  def change do
    create table(:organizations_users) do
      add :role, :string

      add :organization_id, references(:organizations, type: :uuid)
      add :user_id, references(:users)

      timestamps()
    end

    create unique_index(:organizations_users, [:organization_id, :user_id])

  end
end

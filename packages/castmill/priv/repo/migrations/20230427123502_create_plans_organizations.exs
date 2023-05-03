defmodule Castmill.Repo.Migrations.CreatePlansOrganizations do
  use Ecto.Migration

  def change do
    create table(:plans_organizations, primary_key: false) do
      add :plan_id, references(:plans, on_delete: :delete_all, column: :id), null: false
      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all), null: false, unique: true, primary_key: true
    end

    create unique_index(:plans_organizations, [:organization_id])
  end
end

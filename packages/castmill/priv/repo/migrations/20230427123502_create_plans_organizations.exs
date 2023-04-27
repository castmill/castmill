defmodule Castmill.Repo.Migrations.CreatePlansOrganizations do
  use Ecto.Migration

  def change do
    create table(:plans_organizations, primary_key: false) do
      add :plan_name, references(:plans, type: :string, on_delete: :delete_all, column: :name), null: false
      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all), null: false, unique: true, primary_key: true
    end

    create unique_index(:plans_organizations, [:organization_id])
  end
end

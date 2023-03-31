defmodule Castmill.Repo.Migrations.CreateTeams do
  use Ecto.Migration

  def change do
    create table(:teams, primary_key: false) do
      add :name, :string, null: false
      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all), null: false, primary_key: true

      timestamps()
    end

    create index(:organization_teams, [:organization_id])
  end
end

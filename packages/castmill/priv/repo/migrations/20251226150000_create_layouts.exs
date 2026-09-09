defmodule Castmill.Repo.Migrations.CreateLayouts do
  use Ecto.Migration

  def change do
    create table(:layouts) do
      add :name, :string, null: false
      add :description, :string
      add :aspect_ratio, :string, null: false, default: "16:9"
      add :zones, :map, null: false, default: %{"zones" => []}

      add :organization_id,
          references(:organizations, column: "id", type: :uuid, on_delete: :delete_all),
          null: false

      timestamps()
    end

    create index(:layouts, [:organization_id])
    create index(:layouts, [:name])

    # Teams access to layouts (similar to teams_playlists)
    create table(:teams_layouts, primary_key: false) do
      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true
      add :layout_id, references(:layouts, on_delete: :delete_all), null: false, primary_key: true
      add :access, :string, null: false, default: "read"

      timestamps()
    end

    create index(:teams_layouts, [:team_id])
    create index(:teams_layouts, [:layout_id])
  end
end

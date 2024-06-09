defmodule Castmill.Repo.Migrations.CreateWidgets do
  use Ecto.Migration

  def change do
    create table(:widgets) do
      add :name, :string
      add :description, :string
      add :slug, :string

      add :template, :map, required: true
      add :options_schema, :map
      add :data_schema, :map

      add :aspect_ratio, :string, required: false

      add :meta, :map

      add :webhook_url, :string, required: false

      add :icon, :string
      add :small_icon, :string
      add :update_interval_seconds, :integer, default: 60

      add :is_system, :boolean, default: false
      timestamps()
    end

    # Create unique index on slug
    create unique_index(:widgets, [:slug])
  end
end

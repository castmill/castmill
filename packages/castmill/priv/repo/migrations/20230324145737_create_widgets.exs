defmodule Castmill.Repo.Migrations.CreateWidgets do
  use Ecto.Migration

  def change do
    create table(:widgets) do
      add :name, :string

      add :template, :map, required: true
      add :options_schema, :map, required: true
      add :data_schema, :map, required: false

      add :meta, :map

      add :webhook_url, :string

      add :icon, :string
      add :small_icon, :string
      add :update_granularity, :integer, default: 60

      add :is_system, :boolean, default: :false

      timestamps()
    end
  end
end

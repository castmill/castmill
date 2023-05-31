defmodule Castmill.Repo.Migrations.CreateWidgets do
  use Ecto.Migration

  def change do
    create table(:widgets) do
      add :name, :string
      add :uri, :string
      add :icon, :string
      add :small_icon, :string
      add :schema, :map, required: false
      add :is_system, :boolean, default: :false

      timestamps()
    end
  end
end

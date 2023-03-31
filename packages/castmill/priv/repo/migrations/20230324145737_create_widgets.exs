defmodule Castmill.Repo.Migrations.CreateWidgets do
  use Ecto.Migration

  def change do
    create table(:widgets) do
      add :name, :string
      add :uri, :string
      add :data, :map

      add :resource_id, references(:resources, on_delete: :nilify_all), null: true
      add :organization_id, references("organizations", column: "id", type: :uuid, on_delete: :delete_all), null: false

      timestamps()
    end
  end
end

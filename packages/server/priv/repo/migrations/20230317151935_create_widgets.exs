defmodule Server.Repo.Migrations.CreateWidgets do
  use Ecto.Migration

  def change do
    create table(:widgets) do
      add :name, :string
      add :uri, :string
      add :data, :map

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end

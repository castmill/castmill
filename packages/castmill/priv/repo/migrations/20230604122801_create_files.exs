defmodule Castmill.Repo.Migrations.CreateFiles do
  use Ecto.Migration

  def change do
    create table(:files) do
      add :name, :string

      add :size, :integer
      add :uri, :string

      add :mimetype, :string

      add :meta, :map

      add(
        :organization_id,
        references(:organizations, column: "id", type: :uuid, on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(unique_index(:files, [:name, :organization_id]))
  end
end

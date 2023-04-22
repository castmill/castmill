defmodule Castmill.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  def change do
    create table(:organizations, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string, null: false

      add :organization_id, references("organizations", column: "id", type: :uuid, on_delete: :delete_all)
      add :network_id, references("networks", column: "id", type: :uuid, on_delete: :delete_all), null: false

      timestamps()
    end

    create index(:organizations, [:network_id])
    create index(:organizations, [:organization_id])
    create unique_index(:organizations, [:name, :network_id], name: :org_name_network_id_index)
  end
end

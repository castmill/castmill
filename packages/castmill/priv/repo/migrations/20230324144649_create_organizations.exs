defmodule Castmill.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  def change do
    create table(:organizations, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string, null: false

      add :country, :string
      add :city, :string
      add :address, :string
      add :postal_code, :string
      add :email, :string

      add :organization_id, references("organizations", column: "id", type: :uuid, on_delete: :delete_all)
      add :network_id, references("networks", column: "id", type: :uuid, on_delete: :delete_all), null: false

      add :meta, :map

      timestamps()
    end

    create index(:organizations, [:network_id])
    create index(:organizations, [:organization_id])
    create unique_index(:organizations, [:name, :network_id], name: :org_name_network_id_index)
  end
end

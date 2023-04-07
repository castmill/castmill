defmodule Server.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  def change do
    create table(:organizations) do
      add :id, :uuid, primary_key: true
      add :name, :string
      add :owner_id, :uuid

      add :network_id, references("networks", column: "id", type: :uuid)

      timestamps()
    end
  end
end
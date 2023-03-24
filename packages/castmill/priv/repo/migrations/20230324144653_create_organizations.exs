defmodule Castmill.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  def change do
    create table(:organizations, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string

      add :network_id, references("networks", column: "id", type: :integer)

      timestamps()
    end
  end
end

defmodule Server.Repo.Migrations.CreateTeams do
  use Ecto.Migration

  def change do
    create table(:teams) do
      add :id, :uuid, primary_key: true
      add :name, :string

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end

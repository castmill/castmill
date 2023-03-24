defmodule Castmill.Repo.Migrations.CreateTeams do
  use Ecto.Migration

  def change do
    create table(:teams) do
      add :name, :string

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end

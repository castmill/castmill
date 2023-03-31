defmodule Server.Repo.Migrations.CreatePlaylists do
  use Ecto.Migration

  def change do
    create table(:playlists) do
      add :name, :string
      add :entries, {:array, :map}

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end

defmodule Castmill.Repo.Migrations.CreatePlaylists do
  use Ecto.Migration

  def change do
    create table(:playlists) do
      add :name, :string
      add :status, :string
      add :settings, :map

      add :organization_id,
          references(:organizations, column: "id", type: :uuid, on_delete: :delete_all),
          null: false
      timestamps()
    end
  end
end

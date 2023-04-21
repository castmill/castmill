defmodule Castmill.Repo.Migrations.CreatePlaylists do
  use Ecto.Migration

  def change do
    create table(:playlists) do
      add :name, :string
      add :status, :string
      add :settings, :map

      add :organization_id, references(:organizations, column: "id", type: :uuid, on_delete: :delete_all), null: false
      add :resource_id, references(:resources, on_delete: :nilify_all), null: true

      timestamps()
    end
  end
end

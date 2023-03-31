defmodule Castmill.Repo.Migrations.CreateCalendars do
  use Ecto.Migration

  def change do
    create table(:calendars) do
      add :name, :string
      add :timezone, :string
      add :description, :string

      add :resource_id, references(:resources, on_delete: :nilify_all), null: true

      add :organization_id, references("organizations", column: "id", type: :uuid, on_delete: :delete_all), null: false
      add :default_playlist_id, references("playlists", column: "id", type: :integer, on_delete: :nilify_all)

      timestamps()
    end
  end
end

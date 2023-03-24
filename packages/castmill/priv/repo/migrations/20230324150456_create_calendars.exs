defmodule Castmill.Repo.Migrations.CreateCalendars do
  use Ecto.Migration

  def change do
    create table(:calendars) do
      add :name, :string
      add :timezone, :string
      add :description, :string

      add :organization_id, references("organizations", column: "id", type: :uuid)
      add :default_playlist_id, references("playlists", column: "id", type: :integer)

      timestamps()
    end
  end
end

defmodule Server.Repo.Migrations.CreateCalendars do
  use Ecto.Migration

  def change do
    create table(:calendars) do
      add :name, :string
      add :timezone, :string
      add :default_playlist_id, :string
      add :description, :string

      add :organization_id, references("organizations", column: "id", type: :uuid)

      timestamps()
    end
  end
end

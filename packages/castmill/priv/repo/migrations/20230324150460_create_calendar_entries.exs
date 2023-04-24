defmodule Castmill.Repo.Migrations.CreateCalendarEntries do
  use Ecto.Migration

  def change do
    create table(:calendar_entries) do
      add :start, :date
      add :end, :date
      add :repeat_weekly_until, :date, null: true

      add :calendar_id, references("calendars", column: "id", type: :integer, on_delete: :delete_all), null: false
      add :playlist_id, references("playlists", column: "id", type: :integer, on_delete: :delete_all), null: false

      timestamps()
    end
  end
end

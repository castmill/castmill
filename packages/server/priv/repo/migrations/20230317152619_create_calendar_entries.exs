defmodule Server.Repo.Migrations.CreateCalendarEntries do
  use Ecto.Migration

  def change do
    create table(:calendar_entries) do
      add :start, :date
      add :end, :date
      add :repeat_weekly, :boolean, default: false, null: false

      add :calendar_id, references("calendars", column: "id", type: :uuid)

      timestamps()
    end
  end
end

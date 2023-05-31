defmodule Castmill.Repo.Migrations.CreateDevicesCalendars do
  use Ecto.Migration

  def change do
    create table(:devices_calendars, primary_key: false) do
      add :device_id, references(:devices, type: :uuid, on_delete: :delete_all), null: false, primary_key: true
      add :calendar_id, references(:calendars, on_delete: :delete_all), null: false, primary_key: true

      timestamps()
    end

    create unique_index(:devices_calendars, [:device_id, :calendar_id])
  end
end

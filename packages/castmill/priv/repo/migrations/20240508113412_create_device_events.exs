defmodule Castmill.Repo.Migrations.CreateDeviceEvents do
  use Ecto.Migration

  def change do
    create table(:devices_events) do
      add(:device_id, references(:devices, type: :uuid, on_delete: :delete_all), null: false)
      add(:timestamp, :utc_datetime, null: false)

      # Type is an enum, valid values are: online, offline, error, warning, info
      # Since enums are not supported by Elixir, we will use a character instead
      # o => online, x => offline, e => error, w => warning, i => info
      add(:type, :char, null: false)
      add(:msg, :string)
    end

    # Index for efficient device-specific queries
    create(index(:devices_events, [:device_id, :timestamp]))
  end
end

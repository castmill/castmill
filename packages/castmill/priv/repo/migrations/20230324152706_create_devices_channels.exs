defmodule Castmill.Repo.Migrations.CreateDevicesChannels do
  use Ecto.Migration

  def change do
    create table(:devices_channels, primary_key: false) do
      add :device_id, references(:devices, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :channel_id, references(:channels, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end

    create unique_index(:devices_channels, [:device_id, :channel_id])
  end
end

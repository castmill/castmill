defmodule Castmill.Repo.Migrations.AddRcHeartbeatToDevices do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :rc_last_heartbeat, :utc_datetime, null: true
    end
  end
end

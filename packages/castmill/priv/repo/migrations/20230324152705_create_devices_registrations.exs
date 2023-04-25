defmodule Castmill.Repo.Migrations.CreateDevicesRegistrations do
  use Ecto.Migration

  def change do
    create table(:devices_registrations) do
      add :pincode, :string
      add :device_ip, :string
      add :hardware_id, :string
      add :user_agent, :string
      add :version, :string
      add :expires_at, :utc_datetime

      add :timezone, :string
      add :loc_lat, :string
      add :loc_long, :string

      timestamps()
    end

    create unique_index(:devices_registrations, [:pincode])
  end
end

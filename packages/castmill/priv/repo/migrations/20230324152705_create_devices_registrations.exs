defmodule Castmill.Repo.Migrations.CreateDevicesRegistrations do
  use Ecto.Migration

  def change do
    create table(:devices_registrations, primary_key: false) do
      add :hardware_id, :string, null: false, primary_key: true

      add :pincode, :string
      add :device_ip, :string
      add :user_agent, :string
      add :version, :string
      add :expires_at, :utc_datetime

      add :timezone, :string
      add :loc_lat, :float
      add :loc_long, :float

      timestamps()
    end

    create unique_index(:devices_registrations, [:pincode])
  end
end

defmodule Castmill.Repo.Migrations.AddDeviceOrientation do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :orientation, :integer, null: false, default: 0
    end

    create constraint(:devices, :devices_orientation_degrees,
             check: "orientation IN (0, 90, 180, 270)"
           )
  end
end

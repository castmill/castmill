defmodule Castmill.Repo.Migrations.AddMaxDevicesToNetworks do
  use Ecto.Migration

  # Optional limit on the devices of all of a network's organizations together,
  # for example its licensed screens. NULL means no limit.
  def change do
    alter table(:networks) do
      add :max_devices, :integer
    end
  end
end

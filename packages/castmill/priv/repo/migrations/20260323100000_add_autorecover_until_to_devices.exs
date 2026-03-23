defmodule Castmill.Repo.Migrations.AddAutorecoverUntilToDevices do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :autorecover_until, :utc_datetime
    end
  end
end

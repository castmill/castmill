defmodule Castmill.Repo.Migrations.AddScheduleToDevices do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :schedule, :map
    end
  end
end

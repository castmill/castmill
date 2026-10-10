defmodule Castmill.Repo.Migrations.AddEnabledToDevices do
  use Ecto.Migration

  def change do
    alter table(:devices) do
      add :enabled, :boolean, default: true, null: false
    end
  end
end

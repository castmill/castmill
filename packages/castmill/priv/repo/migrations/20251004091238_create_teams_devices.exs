defmodule Castmill.Repo.Migrations.CreateTeamsDevices do
  use Ecto.Migration

  def change do
    create table(:teams_devices, primary_key: false) do
      add :access, {:array, :string}, default: ["read", "write", "delete"], null: false

      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true

      add :device_id, references(:devices, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end
  end
end

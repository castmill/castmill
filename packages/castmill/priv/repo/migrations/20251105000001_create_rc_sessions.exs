defmodule Castmill.Repo.Migrations.CreateRcSessions do
  use Ecto.Migration

  def change do
    create table(:rc_sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :device_id, references(:devices, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :status, :string, null: false, default: "active"
      add :started_at, :utc_datetime, null: false
      add :stopped_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:rc_sessions, [:device_id])
    create index(:rc_sessions, [:user_id])
    create index(:rc_sessions, [:status])
    create index(:rc_sessions, [:device_id, :status])
  end
end

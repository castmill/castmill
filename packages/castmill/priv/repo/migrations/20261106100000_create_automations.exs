defmodule Castmill.Repo.Migrations.CreateAutomations do
  use Ecto.Migration

  def change do
    create table(:automations) do
      add :name, :string, null: false
      add :enabled, :boolean, null: false, default: true
      add :rules, :jsonb, null: false, default: fragment("'[]'::jsonb")

      add :organization_id,
          references(:organizations, column: "id", type: :uuid, on_delete: :delete_all),
          null: false

      timestamps()
    end

    create index(:automations, [:organization_id])
    create index(:automations, [:name])

    create table(:automations_devices, primary_key: false) do
      add :automation_id, references(:automations, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :device_id, references(:devices, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :position, :integer, null: false, default: 0

      timestamps()
    end

    create index(:automations_devices, [:device_id])

    create table(:automations_channels, primary_key: false) do
      add :automation_id, references(:automations, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :channel_id, references(:channels, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :position, :integer, null: false, default: 0

      timestamps()
    end

    create index(:automations_channels, [:channel_id])

    create table(:teams_automations, primary_key: false) do
      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true

      add :automation_id, references(:automations, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :access, {:array, :string}, default: ["read", "write", "delete"], null: false

      timestamps()
    end

    create index(:teams_automations, [:team_id])
    create index(:teams_automations, [:automation_id])
  end
end

defmodule Castmill.Repo.Migrations.CreateOrganizationIntegrationSettings do
  use Ecto.Migration

  def change do
    create table(:organization_integration_settings, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :key, :string, null: false
      add :settings, :map, null: false, default: %{}
      add :updated_by_id, :binary_id

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:organization_integration_settings, [:organization_id, :key])
  end
end

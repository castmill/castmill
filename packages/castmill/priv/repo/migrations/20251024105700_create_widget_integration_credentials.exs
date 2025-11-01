defmodule Castmill.Repo.Migrations.CreateWidgetIntegrationCredentials do
  use Ecto.Migration

  def change do
    create table(:widget_integration_credentials, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :widget_integration_id, references(:widget_integrations, on_delete: :delete_all),
        null: false

      # Organization-scoped credentials (nullable)
      add :organization_id, references(:organizations, on_delete: :delete_all)

      # Widget-scoped credentials (nullable)
      add :widget_config_id, references(:widgets_config, type: :uuid, on_delete: :delete_all)

      # Encrypted credentials (JSON encrypted with organization key)
      add :encrypted_credentials, :binary, null: false

      # Metadata about credentials (non-sensitive)
      add :metadata, :map, default: %{}

      # When credentials were last validated
      add :validated_at, :utc_datetime

      # Whether credentials are currently valid
      add :is_valid, :boolean, default: false

      timestamps()
    end

    create index(:widget_integration_credentials, [:widget_integration_id])
    create index(:widget_integration_credentials, [:organization_id])
    create index(:widget_integration_credentials, [:widget_config_id])

    # Ensure exactly one of organization_id or widget_config_id is set
    create constraint(:widget_integration_credentials, :must_have_scope,
             check:
               "(organization_id IS NOT NULL AND widget_config_id IS NULL) OR (organization_id IS NULL AND widget_config_id IS NOT NULL)"
           )

    # Unique constraint: one credential per integration per scope
    create unique_index(:widget_integration_credentials, [
             :widget_integration_id,
             :organization_id
           ])

    create unique_index(:widget_integration_credentials, [:widget_integration_id, :widget_config_id])
  end
end

defmodule Castmill.Repo.Migrations.CreateWidgetIntegrationData do
  use Ecto.Migration

  def change do
    # Add discriminator configuration to widget_integrations
    alter table(:widget_integrations) do
      # How to compute the discriminator:
      # - "organization": discriminator = organization_id (all widgets share)
      # - "widget_option": discriminator = org_id + option value (widgets with same option share)
      # - "widget_config": discriminator = widget_config_id (no sharing)
      add :discriminator_type, :string, default: "organization"

      # For "widget_option" type: which option key to use for discrimination
      # e.g., "property_id" for broker widget
      add :discriminator_key, :string, null: true
    end

    create table(:widget_integration_data, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :widget_integration_id, references(:widget_integrations, on_delete: :delete_all),
        null: false

      # Widget config is nullable - discriminator_id can replace it as the key
      add :widget_config_id,
          references(:widgets_config, type: :uuid, on_delete: :delete_all),
          null: true

      # Organization that owns this data (for queries and cleanup)
      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: true

      # Discriminator ID - computed based on integration's discriminator_type
      # This is the cache key that determines data sharing
      add :discriminator_id, :string, null: true

      # Cached data from integration
      add :data, :map, default: %{}

      # Version number (incremented on each update)
      add :version, :integer, default: 1

      # When data was last fetched/pushed
      add :fetched_at, :utc_datetime

      # When data should be refreshed (for PULL mode)
      add :refresh_at, :utc_datetime

      # Track when this cache entry was last used (for cleanup job)
      add :last_used_at, :utc_datetime, null: true

      # HTTP status or error information
      add :status, :string
      add :error_message, :text

      timestamps()
    end

    create index(:widget_integration_data, [:widget_integration_id])
    create index(:widget_integration_data, [:widget_config_id])
    create index(:widget_integration_data, [:refresh_at])
    create index(:widget_integration_data, [:organization_id])
    create index(:widget_integration_data, [:last_used_at])

    # Index for discriminator-based lookups (the main query pattern)
    create index(:widget_integration_data, [:widget_integration_id, :discriminator_id])

    # Unique constraint: one data record per widget config per integration
    create unique_index(:widget_integration_data, [:widget_integration_id, :widget_config_id])

    # Unique constraint: one data record per integration per discriminator
    create unique_index(:widget_integration_data, [:widget_integration_id, :discriminator_id],
             where: "discriminator_id IS NOT NULL",
             name: :widget_integration_data_discriminator_unique
           )
  end
end

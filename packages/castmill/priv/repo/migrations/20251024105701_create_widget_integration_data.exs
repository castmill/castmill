defmodule Castmill.Repo.Migrations.CreateWidgetIntegrationData do
  use Ecto.Migration

  def change do
    create table(:widget_integration_data, primary_key: false) do
      add :id, :uuid, primary_key: true

      add :widget_integration_id, references(:widget_integrations, on_delete: :delete_all),
        null: false

      add :widget_config_id,
          references(:widgets_config, type: :uuid, on_delete: :delete_all),
          null: false

      # Cached data from integration
      add :data, :map, default: %{}

      # Version number (incremented on each update)
      add :version, :integer, default: 1

      # When data was last fetched/pushed
      add :fetched_at, :utc_datetime

      # When data should be refreshed (for PULL mode)
      add :refresh_at, :utc_datetime

      # HTTP status or error information
      add :status, :string
      add :error_message, :text

      timestamps()
    end

    create index(:widget_integration_data, [:widget_integration_id])
    create index(:widget_integration_data, [:widget_config_id])
    create index(:widget_integration_data, [:refresh_at])

    # Unique constraint: one data record per widget config per integration
    create unique_index(:widget_integration_data, [:widget_integration_id, :widget_config_id])
  end
end

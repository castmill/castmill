defmodule Castmill.Repo.Migrations.CreateWidgetIntegrations do
  use Ecto.Migration

  def change do
    create table(:widget_integrations) do
      add :widget_id, references(:widgets, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :description, :text

      # Integration type: "pull", "push", or "both"
      add :integration_type, :string, null: false

      # Credential scope: "organization" or "widget"
      add :credential_scope, :string, null: false

      # Configuration schema for the integration
      add :config_schema, :map, default: %{}

      # Credential schema (defines required credentials)
      add :credential_schema, :map, default: %{}

      # Pull configuration (if applicable)
      add :pull_endpoint, :string
      add :pull_interval_seconds, :integer
      add :pull_config, :map, default: %{}

      # Push configuration (if applicable)
      add :push_webhook_path, :string
      add :push_config, :map, default: %{}

      add :is_active, :boolean, default: true

      timestamps()
    end

    # Unique constraint: one integration per widget with a given name
    create unique_index(:widget_integrations, [:widget_id, :name])
    create index(:widget_integrations, [:widget_id])
  end
end

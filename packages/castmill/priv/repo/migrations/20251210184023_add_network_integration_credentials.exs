defmodule Castmill.Repo.Migrations.AddNetworkIntegrationCredentials do
  use Ecto.Migration

  def change do
    # Network-level credentials for widget integrations
    # Stores Client ID/Secret, API keys that are shared across all orgs in a network
    create table(:network_integration_credentials) do
      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false
      add :integration_id, references(:widget_integrations, on_delete: :delete_all), null: false

      # Encrypted credentials (using Castmill.Encryption with versioned keys)
      add :encrypted_credentials, :binary, null: false

      # Admin can disable an integration even if credentials are configured
      add :is_enabled, :boolean, default: true, null: false

      timestamps()
    end

    # Each network can only have one credential set per integration
    create unique_index(:network_integration_credentials, [:network_id, :integration_id])

    # Index for looking up all integrations for a network
    create index(:network_integration_credentials, [:network_id])

    # Index for finding which networks have configured a specific integration
    create index(:network_integration_credentials, [:integration_id])
  end
end

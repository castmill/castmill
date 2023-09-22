defmodule Castmill.Repo.Migrations.CreateQuotasNetworks do
  use Ecto.Migration

  def change do
    create table(:quotas_networks, primary_key: false) do
      add :max, :integer

      add :resource, :string, primary_key: true

      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end

    create unique_index(:quotas_networks, [:network_id, :resource])
  end
end

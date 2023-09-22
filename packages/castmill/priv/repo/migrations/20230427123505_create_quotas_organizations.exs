defmodule Castmill.Repo.Migrations.CreateQuotasOrganizations do
  use Ecto.Migration

  def change do
    create table(:quotas_organizations, primary_key: false) do
      add :max, :integer

      add :resource, :string, primary_key: true

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      timestamps()
    end

    create unique_index(:quotas_organizations, [:organization_id, :resource])
  end
end

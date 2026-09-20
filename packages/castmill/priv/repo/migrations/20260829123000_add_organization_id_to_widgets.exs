defmodule Castmill.Repo.Migrations.AddOrganizationIdToWidgets do
  use Ecto.Migration

  def up do
    alter table(:widgets) do
      add(
        :organization_id,
        references(:organizations, type: :uuid, on_delete: :delete_all)
      )
    end

    execute("UPDATE widgets SET is_system = true WHERE slug = 'location-display-demo'")

    create(index(:widgets, [:organization_id]))
  end

  def down do
    drop(index(:widgets, [:organization_id]))

    alter table(:widgets) do
      remove(:organization_id)
    end
  end
end

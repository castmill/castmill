defmodule Castmill.Repo.Migrations.AddWidgetScopes do
  @moduledoc """
  Scopes widgets so organizations only see the widgets meant for them:

    * system widgets (`is_system`, no owner) are available everywhere,
    * network widgets (`network_id`) are available to that network's organizations,
    * organization widgets (`organization_id`) are available only to that organization,
    * `restricted` network/system widgets are only available to the organizations
      listed in `widgets_organizations`.

  Existing non-system widgets get an owner inferred from where they are used, without
  widening access: one organization -> organization widget; several organizations ->
  restricted network (or system, across networks) widget granted to exactly those
  organizations; unused -> unassigned (available to no organization).
  """
  use Ecto.Migration

  def up do
    execute("UPDATE widgets SET is_system = false WHERE is_system IS NULL")

    alter table(:widgets) do
      modify(:is_system, :boolean, null: false, default: false)
      add(:network_id, references(:networks, type: :uuid, on_delete: :delete_all))
      add(:restricted, :boolean, null: false, default: false)
    end

    # Also added (identically) by 20260829123000_add_organization_id_to_widgets (Instagram
    # widget PR); databases that ran it already have the column, foreign key and index.
    execute("ALTER TABLE widgets ADD COLUMN IF NOT EXISTS organization_id uuid")

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'widgets_organization_id_fkey') THEN
        ALTER TABLE widgets ADD CONSTRAINT widgets_organization_id_fkey
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END $$
    """)

    create(index(:widgets, [:network_id]))
    create_if_not_exists(index(:widgets, [:organization_id]))

    create(
      constraint(:widgets, :widgets_single_owner,
        check: "network_id IS NULL OR organization_id IS NULL"
      )
    )

    create(
      constraint(:widgets, :widgets_system_has_no_owner,
        check: "is_system IS FALSE OR (network_id IS NULL AND organization_id IS NULL)"
      )
    )

    create(
      constraint(:widgets, :widgets_organization_not_restricted,
        check: "organization_id IS NULL OR restricted IS FALSE"
      )
    )

    create table(:widgets_organizations, primary_key: false) do
      add(:widget_id, references(:widgets, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      timestamps(type: :utc_datetime)
    end

    create(index(:widgets_organizations, [:organization_id]))

    flush()

    # Shipped with the platform (a migration demo and the widget loader's intro widget,
    # which device registration adds to every organization); keep them available to
    # everyone. Run directly (not queued with execute/1) so it happens before the backfill.
    repo().query!(
      "UPDATE widgets SET is_system = true WHERE slug IN ('location-display-demo', 'intro')",
      []
    )

    Castmill.Widgets.ScopeBackfill.run(repo())
  end

  def down do
    drop(table(:widgets_organizations))
    drop(constraint(:widgets, :widgets_organization_not_restricted))
    drop(constraint(:widgets, :widgets_system_has_no_owner))
    drop(constraint(:widgets, :widgets_single_owner))

    alter table(:widgets) do
      remove(:restricted)
      remove(:network_id)
      modify(:is_system, :boolean, null: true, default: nil)
    end

    # Keep organization_id when 20260829123000_add_organization_id_to_widgets owns it.
    unless organization_id_migration_ran?() do
      drop_if_exists(index(:widgets, [:organization_id]))

      alter table(:widgets) do
        remove(:organization_id)
      end
    end
  end

  defp organization_id_migration_ran? do
    %{num_rows: rows} =
      repo().query!("SELECT 1 FROM schema_migrations WHERE version = 20260829123000", [])

    rows > 0
  end
end

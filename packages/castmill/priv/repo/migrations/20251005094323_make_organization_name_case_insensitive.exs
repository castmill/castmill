defmodule Castmill.Repo.Migrations.MakeOrganizationNameCaseInsensitive do
  use Ecto.Migration

  def up do
    # Drop the existing case-sensitive unique index
    drop_if_exists unique_index(:organizations, [:name, :network_id],
                     name: :org_name_network_id_index
                   )

    # Add a new column to store the lowercase version of the name
    alter table(:organizations) do
      add :name_lower, :string
    end

    # Populate the name_lower column with lowercase versions of existing names
    execute "UPDATE organizations SET name_lower = LOWER(name)"

    # Find and rename duplicate organization names (case-insensitive)
    # This appends a counter to duplicate names to make them unique
    execute """
    WITH duplicates AS (
      SELECT
        id,
        name,
        network_id,
        ROW_NUMBER() OVER (
          PARTITION BY name_lower, network_id
          ORDER BY inserted_at
        ) as rn
      FROM organizations
    )
    UPDATE organizations
    SET name = organizations.name || ' (' || duplicates.rn || ')',
        name_lower = LOWER(organizations.name || ' (' || duplicates.rn || ')')
    FROM duplicates
    WHERE organizations.id = duplicates.id
      AND duplicates.rn > 1
    """

    # Create a case-insensitive unique index on the name_lower column
    # This works with PostgreSQL, MySQL, and SQLite
    create unique_index(:organizations, [:name_lower, :network_id],
             name: :org_name_lower_network_id_index
           )

    # Make name_lower NOT NULL since it's required for uniqueness
    alter table(:organizations) do
      modify :name_lower, :string, null: false
    end
  end

  def down do
    # Revert to case-sensitive index
    drop_if_exists unique_index(:organizations, [:name_lower, :network_id],
                     name: :org_name_lower_network_id_index
                   )

    alter table(:organizations) do
      remove :name_lower
    end

    create unique_index(:organizations, [:name, :network_id], name: :org_name_network_id_index)

    # Note: We don't automatically revert the name changes as they might have been manually edited
    # Manual cleanup would be required if rolling back
  end
end

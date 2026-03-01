defmodule Castmill.Repo.Migrations.RemoveNetworkIdFromUsers do
  use Ecto.Migration

  @moduledoc """
  Migrates user↔network relationship from the `users` table to `networks_users`.

  Before: users.network_id (FK) + users.network_role (column)
  After:  networks_users (join table) is the single source of truth

  Steps:
  1. Copy existing user→network relationships into networks_users (skip duplicates)
  2. Drop the old index and columns from users
  3. Add a global email unique index on users (email alone, no network scoping)
  """

  def up do
    # Step 1: Copy existing relationships to networks_users (skip rows that already exist)
    execute("""
    INSERT INTO networks_users (network_id, user_id, role, inserted_at, updated_at)
    SELECT u.network_id, u.id, COALESCE(u.network_role, 'member'), NOW(), NOW()
    FROM users u
    WHERE u.network_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM networks_users nu
      WHERE nu.network_id = u.network_id AND nu.user_id = u.id
    )
    """)

    # Step 2: Merge duplicate emails.
    # Same email can exist across different networks (old schema allowed this).
    # Keep the oldest user per email, transfer all relationships to the survivor,
    # then delete the duplicates.
    #
    # We use a temp table to avoid repeating the CTE logic in every statement.
    execute("""
    CREATE TEMP TABLE _dup_merge AS
    WITH survivors AS (
      SELECT DISTINCT ON (email) id AS survivor_id, email
      FROM users
      ORDER BY email, inserted_at ASC
    )
    SELECT u.id AS dup_id, s.survivor_id
    FROM users u
    JOIN survivors s ON s.email = u.email
    WHERE u.id != s.survivor_id
    """)

    # 2a: Transfer networks_users from duplicates to survivor (skip conflicts)
    execute("""
    INSERT INTO networks_users (network_id, user_id, role, inserted_at, updated_at)
    SELECT nu.network_id, d.survivor_id, nu.role, nu.inserted_at, nu.updated_at
    FROM networks_users nu
    JOIN _dup_merge d ON d.dup_id = nu.user_id
    ON CONFLICT (network_id, user_id) DO NOTHING
    """)

    # 2b: Transfer organizations_users from duplicates to survivor (skip conflicts)
    execute("""
    INSERT INTO organizations_users (organization_id, user_id, role, inserted_at, updated_at)
    SELECT ou.organization_id, d.survivor_id, ou.role, ou.inserted_at, ou.updated_at
    FROM organizations_users ou
    JOIN _dup_merge d ON d.dup_id = ou.user_id
    ON CONFLICT (organization_id, user_id) DO NOTHING
    """)

    # 2c: Delete all FK references for duplicate users
    for table <- ~w(networks_users organizations_users organizations_users_access
                     teams_users notifications onboarding_progress
                     users_tokens access_tokens users_credentials) do
      execute("DELETE FROM #{table} WHERE user_id IN (SELECT dup_id FROM _dup_merge)")
    end

    # 2d: Delete duplicate user rows
    execute("DELETE FROM users WHERE id IN (SELECT dup_id FROM _dup_merge)")

    # Clean up temp table
    execute("DROP TABLE _dup_merge")

    # Step 3: Drop old indexes
    drop_if_exists(index(:users, [:network_id, :network_role]))
    drop_if_exists(index(:users, [:name, :network_id], name: :users_name_network_id_index))
    drop_if_exists(index(:users, [:network_id]))

    # Step 4: Remove columns from users table
    alter table(:users) do
      remove(:network_role)
      remove(:network_id)
    end

    # Step 5: Add global email unique index
    create(unique_index(:users, [:email], name: :users_email_index))
  end

  def down do
    # Remove the global email unique index
    drop_if_exists(index(:users, [:email], name: :users_email_index))

    # Re-add columns to users table
    alter table(:users) do
      add(:network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: true)
      add(:network_role, :string, default: "member", null: false)
    end

    # Restore data from networks_users back to users (take the first network per user)
    execute("""
    UPDATE users u
    SET network_id = nu.network_id, network_role = nu.role
    FROM (
      SELECT DISTINCT ON (user_id) user_id, network_id, role
      FROM networks_users
      ORDER BY user_id, inserted_at ASC
    ) nu
    WHERE u.id = nu.user_id
    """)

    # Re-add old indexes
    create(index(:users, [:network_id]))
    create(unique_index(:users, [:name, :network_id], name: :users_name_network_id_index))
    create(index(:users, [:network_id, :network_role]))
  end
end

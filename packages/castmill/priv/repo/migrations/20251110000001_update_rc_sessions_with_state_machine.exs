defmodule Castmill.Repo.Migrations.UpdateRcSessionsWithStateMachine do
  use Ecto.Migration

  def change do
    # Add new state field to replace the simple status field
    # States: created, starting, streaming, stopping, closed
    alter table(:rc_sessions) do
      add :state, :string
      add :timeout_at, :utc_datetime
      add :last_activity_at, :utc_datetime
    end

    # Migrate existing data: "active" -> "streaming", "stopped" -> "closed"
    execute """
    UPDATE rc_sessions 
    SET state = CASE 
      WHEN status = 'active' THEN 'streaming'
      WHEN status = 'stopped' THEN 'closed'
      ELSE 'created'
    END,
    last_activity_at = COALESCE(started_at, inserted_at)
    WHERE state IS NULL
    """, ""

    # Now make state non-nullable and add index
    alter table(:rc_sessions) do
      modify :state, :string, null: false
    end

    # Add index for querying active sessions
    create index(:rc_sessions, [:state])
    create index(:rc_sessions, [:device_id, :state])
    
    # Keep the old status field for backward compatibility during migration
    # In a future migration, we can remove it after confirming everything works
  end
end

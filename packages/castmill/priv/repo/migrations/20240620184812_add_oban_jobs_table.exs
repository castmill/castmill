defmodule Castmill.Repo.Migrations.AddObanJobsTable do
  use Ecto.Migration

  # NOTE: This migration originally created Oban tables using Oban.Migration.up/1
  # Oban has been replaced with BullMQ (which uses Redis instead of PostgreSQL).
  # The oban_jobs and oban_peers tables are dropped in migration 20260113120000.
  # This migration is now a no-op to allow fresh installations without Oban dependency.

  def up do
    # No-op: Oban tables are no longer needed (BullMQ uses Redis)
    # Tables will be dropped by migration 20260113120000_remove_oban_jobs_table.exs
    :ok
  end

  def down do
    # No-op: Tables were never created
    :ok
  end
end

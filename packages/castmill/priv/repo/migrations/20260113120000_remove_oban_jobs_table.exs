defmodule Castmill.Repo.Migrations.RemoveObanJobsTable do
  use Ecto.Migration

  def up do
    # Drop the Oban jobs table since we're moving to BullMQ (which uses Redis)
    # BullMQ stores all job data in Redis, so we don't need database tables

    # Note: If Oban was never installed (e.g., fresh installation), this will safely do nothing
    drop_if_exists table("oban_jobs")
    drop_if_exists table("oban_peers")
  end

  def down do
    # If we need to roll back, we would need to recreate Oban tables manually
    # This requires re-adding the Oban dependency first, so we just warn here
    IO.warn("""
    To rollback this migration, you must:
    1. Add {:oban, "~> 2.17"} back to mix.exs
    2. Run: mix deps.get
    3. Create a new migration to add Oban tables:
       mix ecto.gen.migration add_oban_jobs_table
    4. In that migration, call: Oban.Migration.up(version: 12)
    """)
  end
end

defmodule Castmill.Repo.Migrations.RemoveObanJobsTable do
  use Ecto.Migration

  def up do
    # Drop the Oban jobs table since we're moving to BullMQ (which uses Redis)
    # BullMQ stores all job data in Redis, so we don't need database tables
    Oban.Migration.down(version: 1)
  end

  def down do
    # If we need to roll back, recreate the Oban tables
    Oban.Migration.up(version: 12)
  end
end

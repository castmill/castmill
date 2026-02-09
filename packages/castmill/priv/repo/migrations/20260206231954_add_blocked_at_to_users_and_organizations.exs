defmodule Castmill.Repo.Migrations.AddBlockedAtToUsersAndOrganizations do
  use Ecto.Migration

  def change do
    # Add blocked_at field to users table
    # When not null, the user is blocked and cannot login
    alter table(:users) do
      add :blocked_at, :utc_datetime_usec
      add :blocked_reason, :string
    end

    # Add blocked_at field to organizations table
    # When not null, all users in the organization are blocked from logging in
    alter table(:organizations) do
      add :blocked_at, :utc_datetime_usec
      add :blocked_reason, :string
    end

    # Add indexes for efficient blocked status checks during auth
    create index(:users, [:blocked_at])
    create index(:organizations, [:blocked_at])
  end
end

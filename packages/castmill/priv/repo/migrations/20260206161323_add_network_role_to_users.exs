defmodule Castmill.Repo.Migrations.AddNetworkRoleToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      # Network role: admin can manage network settings, member is a regular user
      # Default to "member" for all existing users
      add :network_role, :string, default: "member", null: false
    end

    # Create index for efficient lookup of network admins
    create index(:users, [:network_id, :network_role])
  end
end

defmodule Castmill.Repo.Migrations.AddRoleToTeamInvitations do
  use Ecto.Migration

  def change do
    alter table(:invitations) do
      add :role, :string, default: "member", null: false
    end
  end
end

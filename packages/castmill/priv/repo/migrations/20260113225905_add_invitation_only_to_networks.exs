defmodule Castmill.Repo.Migrations.AddInvitationOnlyToNetworks do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      add :invitation_only, :boolean, default: false, null: false
      add :invitation_only_org_admins, :boolean, default: false, null: false
    end
  end
end

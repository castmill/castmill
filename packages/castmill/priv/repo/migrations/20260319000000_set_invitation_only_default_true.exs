defmodule Castmill.Repo.Migrations.SetInvitationOnlyDefaultTrue do
  use Ecto.Migration

  def change do
    alter table(:networks) do
      modify(:invitation_only, :boolean, default: true, null: false)
    end
  end
end

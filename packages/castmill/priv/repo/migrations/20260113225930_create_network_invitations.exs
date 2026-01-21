defmodule Castmill.Repo.Migrations.CreateNetworkInvitations do
  use Ecto.Migration

  def change do
    create table(:network_invitations, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :email, :string, null: false
      add :token, :string, null: false
      add :organization_name, :string, null: false
      add :status, :string, default: "invited", null: false
      add :expires_at, :utc_datetime, null: false

      add :network_id, references(:networks, type: :uuid, on_delete: :delete_all), null: false

      timestamps()
    end

    create unique_index(:network_invitations, [:token])

    create unique_index(:network_invitations, [:network_id, :email],
             where: "status = 'invited'",
             name: :unique_network_email_invite_active
           )

    create index(:network_invitations, [:network_id])
    create index(:network_invitations, [:email])
  end
end

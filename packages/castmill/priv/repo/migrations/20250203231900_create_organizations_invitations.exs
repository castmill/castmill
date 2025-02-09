defmodule Castmill.Repo.Migrations.CreateOrganizationsInvitations do
  use Ecto.Migration

  def change do
    create table(:organizations_invitations) do
      add :email, :string, null: false

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :role, :string, default: "regular", null: false

      add :token, :string, null: false
      add :status, :string, default: "invited", null: false
      add :expires_at, :utc_datetime

      timestamps()
    end

    create unique_index(:organizations_invitations, [:organization_id, :email],
             where: "status = 'invited'",
             name: :unique_organization_email_invite_active
           )

    create unique_index(:organizations_invitations, [:token])
  end
end

defmodule Castmill.Repo.Migrations.CreateInvitations do
  use Ecto.Migration

  def change do
    create table(:invitations) do
      add :email, :string, null: false
      add :team_id, references(:teams, on_delete: :delete_all), null: false
      add :token, :string, null: false
      add :status, :string, default: "invited", null: false
      add :expires_at, :utc_datetime

      timestamps()
    end

    create unique_index(:invitations, [:team_id, :email],
             where: "status = 'invited'",
             name: :unique_team_email_invite_active
           )

    create unique_index(:invitations, [:token])
  end
end

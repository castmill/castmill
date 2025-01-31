defmodule Castmill.Repo.Migrations.CreateTeamsUsers do
  use Ecto.Migration

  def change do
    create table(:teams_users, primary_key: false) do
      add :role, :string

      add :user_id, references(:users, type: :uuid, on_delete: :delete_all),
        null: false,
        primary_key: true

      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true

      add :status, :string, null: false, default: "invited"

      timestamps()
    end
  end
end

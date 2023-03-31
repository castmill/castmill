defmodule Castmill.Repo.Migrations.CreateTeamsResources do
  use Ecto.Migration

  def change do
    create table(:teams_resources, primary_key: false) do
      add :access, {:array, :string}, default: ["read", "write"], null: false

      add :team_id, references(:teams, on_delete: :nilify_all), null: false, primary_key: true
      add :resource_id, references(:resources, on_delete: :nilify_all), null: false, primary_key: true
    end
  end
end

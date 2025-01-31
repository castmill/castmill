defmodule Castmill.Repo.Migrations.CreateTeamsPlaylists do
  use Ecto.Migration

  def change do
    create table(:teams_playlists, primary_key: false) do
      add :access, {:array, :string}, default: ["read", "write"], null: false

      add :team_id, references(:teams, on_delete: :delete_all), null: false, primary_key: true

      add :playlist_id, references(:playlists, on_delete: :delete_all),
        null: false,
        primary_key: true

      timestamps()
    end
  end
end

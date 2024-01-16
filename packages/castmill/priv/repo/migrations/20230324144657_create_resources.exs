defmodule Castmill.Repo.Migrations.CreateResources do
  use Ecto.Migration

  # This is a wrapper table for all resources so that we can use it in the teams_resources and in playlist_item tables
  def change do
    create table(:resources) do
      # This is the type of the resource, e.g. "playlist", "calendar", "media", etc
      add :type, :string, null: false

      timestamps()
    end
  end
end

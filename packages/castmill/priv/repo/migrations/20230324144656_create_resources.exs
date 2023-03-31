defmodule Castmill.Repo.Migrations.CreateResources do
  use Ecto.Migration

  # This is a wrapper table for all resources so that we can use it in the teams_resources and in playlist_item tables
  def change do
    create table(:resources) do
      add :type, :string, null: false # This is the type of the resource, e.g. "playlist", "calendar", "media", etc
    end
  end
end

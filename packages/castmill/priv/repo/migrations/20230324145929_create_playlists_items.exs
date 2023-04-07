defmodule Castmill.Repo.Migrations.CreatePlaylistsItems do
  use Ecto.Migration

  def change do
    create table(:playlists_items) do

      add :duration, :integer
      add :offset, :integer
      add :options, :map

      add :prev_item_id, references(:playlists_items, on_delete: :nilify_all), null: true
      add :next_item_id, references(:playlists_items, on_delete: :nilify_all), null: true

      add :widget_id, references(:widgets, on_delete: :nilify_all), null: false
      add :playlist_id, references(:playlists, on_delete: :delete_all), null: false

      timestamps()
    end

    create index(:playlists_items, [:playlist_id])
    create index(:playlists_items, [:prev_item_id])
    create index(:playlists_items, [:next_item_id])
  end
end

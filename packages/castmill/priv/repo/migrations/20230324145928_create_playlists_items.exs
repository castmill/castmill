defmodule Castmill.Repo.Migrations.CreatePlaylistsItems do
  use Ecto.Migration

  def change do
    create table(:playlists_items) do
      add :resource_id, references(:resources, on_delete: :nilify_all), null: false

      add :playlist_id, references(:playlists, column: "id", on_delete: :delete_all), null: false
      add :prev_item_id, references(:playlists_items, column: "id", on_delete: :nilify_all), null: true
      add :next_item_id, references(:playlists_items, column: "id", on_delete: :nilify_all), null: true

      timestamps()
    end

    create index(:playlists_items, [:playlist_id])
    create index(:playlists_items_prev, [:prev_item_id])
    create index(:playlists_items_next, [:next_item_id])
  end
end

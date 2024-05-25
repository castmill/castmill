defmodule Castmill.Repo.Migrations.CreateChannelEntries do
  use Ecto.Migration

  def change do
    create table(:channel_entries) do
      add :start, :bigint
      add :end, :bigint
      add :repeat_weekly_until, :date, null: true

      add :channel_id,
          references("channels", column: "id", type: :integer, on_delete: :delete_all),
          null: false

      add :playlist_id,
          references("playlists", column: "id", type: :integer, on_delete: :delete_all),
          null: false

      timestamps()
    end
  end
end

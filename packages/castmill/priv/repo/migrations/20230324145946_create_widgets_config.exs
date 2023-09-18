defmodule Castmill.Repo.Migrations.CreateWidgetsConfig do
  use Ecto.Migration

  def change do
    create table(:widgets_config, primary_key: false) do
      add(:id, :uuid, primary_key: true)
      add(:version, :integer, default: 1)

      add(:options, :map, default: %{})
      add(:data, :map, default: %{})

      add(:last_request_at, :naive_datetime, default: nil)

      add(:widget_id, references(:widgets, column: "id", on_delete: :delete_all), null: false)

      add(
        :playlist_item_id,
        references(:playlists_items, column: "id", on_delete: :delete_all),
        null: false
      )

      timestamps()
    end

    create(index(:widgets_config, [:playlist_item_id]))
    create(index(:widgets_config, [:widget_id]))
  end
end

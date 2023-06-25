defmodule Castmill.Resources.PlaylistItem do
  use Ecto.Schema
  import Ecto.Changeset

  schema "playlists_items" do
    field :duration, :integer
    field :offset, :integer
    field :options, :map

    belongs_to :prev_item, Castmill.Resources.PlaylistItem, foreign_key: :prev_item_id
    belongs_to :next_item, Castmill.Resources.PlaylistItem, foreign_key: :next_item_id

    belongs_to :playlist, Castmill.Resources.Playlist, primary_key: true
    belongs_to :widget_data, Castmill.Widgets.WidgetData, type: Ecto.UUID, primary_key: true

    timestamps()
  end

  @doc false
  def changeset(media, attrs) do
    media
    |> cast(attrs, [:duration, :offset, :options, :playlist_id, :widget_data_id, :prev_item_id, :next_item_id])
    |> validate_required([:duration, :offset, :options, :playlist_id, :widget_data_id])
  end
end

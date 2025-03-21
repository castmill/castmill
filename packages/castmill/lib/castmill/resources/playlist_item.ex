defmodule Castmill.Resources.PlaylistItem do
  use Castmill.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder,
           only: [:id, :duration, :offset, :inserted_at, :updated_at, :widget_config]}
  schema "playlists_items" do
    field :duration, :integer
    field :offset, :integer

    belongs_to :prev_item, Castmill.Resources.PlaylistItem, foreign_key: :prev_item_id
    belongs_to :next_item, Castmill.Resources.PlaylistItem, foreign_key: :next_item_id

    belongs_to :playlist, Castmill.Resources.Playlist
    has_one :widget_config, Castmill.Widgets.WidgetConfig

    belongs_to :transitions, Castmill.Widgets.Transition, foreign_key: :transition_id
    field :transition_opts, :map

    timestamps()
  end

  @doc false
  def changeset(item, attrs) do
    item
    |> cast(attrs, [:duration, :offset, :playlist_id, :prev_item_id, :next_item_id])
    |> validate_required([:duration, :offset, :playlist_id])
  end
end

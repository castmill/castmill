defmodule Castmill.Resources.CalendarEntry do
  use Ecto.Schema
  import Ecto.Changeset

  schema "calendar_entries" do
    field :start, :date
    field :end, :date
    field :repeat_weekly_until, :date, default: nil

    # belongs_to is not semantically correct, as what we want to express is that
    # a calendar entry points to a playlist.
    belongs_to :playlist, Castmill.Resources.Playlist
    belongs_to :calendar, Castmill.Resources.Calendar

    timestamps()
  end

  @doc false
  def changeset(calendar_entry, attrs) do
    calendar_entry
    |> cast(attrs, [:start, :end, :repeat_weekly_until, :playlist_id, :calendar_id])
    |> validate_required([:start, :end, :playlist_id, :calendar_id])
  end
end

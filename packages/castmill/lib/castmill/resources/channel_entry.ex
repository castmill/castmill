defmodule Castmill.Resources.ChannelEntry do
  use Ecto.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder,
           only: [
             :id,
             :start,
             :end,
             :repeat_weekly_until,
             :playlist_id,
             :inserted_at,
             :updated_at
           ]}
  schema "channel_entries" do
    field(:start, :integer)
    field(:end, :integer)
    field(:repeat_weekly_until, :date, default: nil)

    belongs_to(:playlist, Castmill.Resources.Playlist)
    belongs_to(:channel, Castmill.Resources.Channel)

    timestamps()
  end

  @doc false
  def changeset(channel_entry, attrs) do
    channel_entry
    |> cast(attrs, [:start, :end, :repeat_weekly_until, :playlist_id, :channel_id])
    |> validate_required([:start, :end, :playlist_id, :channel_id])
    |> validate_same_week(:start, :end)
    |> validate_date_before(:start, :end)
    |> validate_future_or_nil(:repeat_weekly_until)
  end

  defp validate_same_week(changeset, start_field, end_field) do
    start_date = DateTime.to_date(DateTime.from_unix!(get_field(changeset, start_field)))
    end_date = DateTime.to_date(DateTime.from_unix!(get_field(changeset, end_field)))

    start_week_start = Date.beginning_of_week(start_date)
    end_week_start = Date.beginning_of_week(end_date)

    if start_week_start == end_week_start do
      changeset
    else
      add_error(changeset, start_field, "and end date must be in the same week")
    end
  end

  defp validate_date_before(changeset, start_field, end_field) do
    start_date = get_field(changeset, start_field)
    end_date = get_field(changeset, end_field)

    if start_date < end_date do
      changeset
    else
      add_error(changeset, start_field, "must be before the end date")
    end
  end

  defp validate_future_or_nil(changeset, field) do
    field_date = get_field(changeset, field)

    if is_nil(field_date) do
      changeset
    else
      iso_date = "#{Date.to_iso8601(field_date)}T00:00:00Z"
      {:ok, datetime, 0} = DateTime.from_iso8601(iso_date)
      date = DateTime.to_unix(datetime)
      today = timestamp()

      if date > today do
        changeset
      else
        add_error(changeset, field, "must be in the future or nil")
      end
    end
  end

  def timestamp do
    DateTime.to_unix(DateTime.utc_now())
  end
end

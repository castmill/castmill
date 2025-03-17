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
    field(:start, :utc_datetime)
    field(:end, :utc_datetime)
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
    |> validate_same_week()
    |> validate_date_before(:start, :end)
    |> validate_future_or_nil(:repeat_weekly_until)
  end

  # Validate that the start and end dates are in the same week considering the channel's timezone
  defp validate_same_week(changeset) do
    # Get the current values of start, end, and channel_id, considering changes and existing data
    start = get_field(changeset, :start)
    end_time = get_field(changeset, :end)
    channel_id = get_field(changeset, :channel_id)

    # Only proceed if all required fields are present
    if start && end_time && channel_id do
      # Fetch the channel to get its timezone
      case Castmill.Repo.get(Castmill.Resources.Channel, channel_id) do
        nil ->
          # If the channel doesn't exist, add an error
          add_error(changeset, :channel_id, "invalid channel")

        channel ->
          timezone = channel.timezone

          # Shift start and end times to the channel's timezone
          case {DateTime.shift_zone(start, timezone), DateTime.shift_zone(end_time, timezone)} do
            {{:ok, start_in_tz}, {:ok, end_in_tz}} ->
              # Convert to local dates and get ISO week numbers
              start_date = DateTime.to_date(start_in_tz)
              end_date = DateTime.to_date(end_in_tz)

              {start_year, start_week} =
                iso_week_number(start_date)

              {end_year, end_week} =
                iso_week_number(end_date)

              # Check if they're in the same week
              if start_year == end_year && start_week == end_week do
                changeset
              else
                add_error(changeset, :start, "and end date must be in the same week")
              end

            _ ->
              # Handle invalid timezone conversion (unlikely but possible)
              add_error(changeset, :start, "invalid timezone conversion")
          end
      end
    else
      # If any field is missing, skip validation (required fields should be caught elsewhere)
      changeset
    end
  end

  defp iso_week_number(date) do
    {year, month, day} = {date.year, date.month, date.day}
    :calendar.iso_week_number({year, month, day})
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
      today = Date.utc_today()

      if Date.compare(field_date, today) == :gt do
        changeset
      else
        add_error(changeset, field, "must be in the future or nil")
      end
    end
  end
end

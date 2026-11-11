defmodule Castmill.Automations.Sources.Clock do
  @moduledoc """
  Clock event source: fires at local wall-clock times.

  Configuration (string keys):

      %{
        "schedule" => %{"type" => "hourly", "minute" => 8}
                    | %{"type" => "interval", "every_minutes" => 15}
                    | %{"type" => "times", "times" => ["08:00", "17:55"]}
                    | %{"type" => "once", "date" => "2026-12-24", "time" => "17:55"},
        "weekdays" => [1, 2, 3, 4, 5] | nil,        # ISO weekdays, nil = every day
        "window" => %{"start" => "08:00", "end" => "18:00"} | nil,
        "dates" => %{"start" => "2026-01-01" | nil, "end" => "2026-03-01" | nil} | nil,
        "timezone" => "Europe/Stockholm" | nil     # nil = device timezone
      }

  `interval` is aligned to the start of the window (or midnight). The window
  is inclusive and cannot cross midnight. Weekdays, window and dates are not
  allowed for `once`.

  Players such as Chrome 38 cannot reliably handle IANA time zones, so the
  server expands every rule into UTC occurrences for the next
  14 days (`device_payload/2`) with tzdata.

  Daylight saving time:
    * a local time that happens twice (overlap) fires once, at the first instant;
    * a local time that does not exist (gap) is skipped for `hourly` and
      `interval` schedules, and fires at the first valid instant after the gap
      for `times` and `once`.
  """

  @behaviour Castmill.Automations.Source

  @payload_days 14
  @min_interval_minutes 5
  @max_interval_minutes 1440
  @max_times 48
  @schedule_types ~w(hourly interval times once)

  @impl true
  def type, do: "clock"

  @impl true
  def conditions, do: [%{name: "at", kind: :event}]

  @impl true
  def required_capability, do: "clock"

  @doc "Number of days of occurrences sent to devices."
  def payload_days, do: @payload_days

  @impl true
  def validate_config(config) when is_map(config) do
    with {:ok, schedule} <- validate_schedule(Map.get(config, "schedule")),
         once? = schedule["type"] == "once",
         {:ok, weekdays} <- validate_weekdays(Map.get(config, "weekdays"), once?),
         {:ok, window} <- validate_window(Map.get(config, "window"), once?),
         {:ok, dates} <- validate_dates(Map.get(config, "dates"), once?),
         {:ok, timezone} <- validate_timezone(Map.get(config, "timezone")) do
      {:ok,
       %{
         "schedule" => schedule,
         "weekdays" => weekdays,
         "window" => window,
         "dates" => dates,
         "timezone" => timezone
       }}
    end
  end

  def validate_config(_config), do: {:error, "clock configuration must be an object"}

  @impl true
  def device_payload(config, %{timezone: timezone, from: from, to: to}) do
    tz = effective_timezone(config, timezone)

    %{
      "timezone" => tz,
      "occurrences" =>
        config
        |> occurrences(tz, from, to)
        |> Enum.map(&DateTime.to_unix(&1, :millisecond))
    }
  end

  @impl true
  def upcoming(config, timezone, %DateTime{} = from, count) when is_integer(count) do
    from
    |> Stream.unfold(fn cursor ->
      case next_occurrence(config, timezone, cursor) do
        nil -> nil
        at -> {at, DateTime.add(at, 1, :second)}
      end
    end)
    |> Enum.take(max(count, 0))
  end

  @doc """
  The timezone used to evaluate a rule: its explicit timezone, else the given
  one (device or channel timezone), else UTC.
  """
  def effective_timezone(config, timezone) do
    cond do
      is_binary(config["timezone"]) and config["timezone"] != "" -> config["timezone"]
      is_binary(timezone) and timezone != "" and valid_timezone?(timezone) -> timezone
      true -> "Etc/UTC"
    end
  end

  @doc """
  Returns the sorted UTC instants in `[from, to)` at which a (validated) clock
  configuration fires, evaluated in `timezone` unless the configuration sets
  its own timezone. Pure function.
  """
  @spec occurrences(map(), String.t() | nil, DateTime.t(), DateTime.t()) :: [DateTime.t()]
  def occurrences(config, timezone, %DateTime{} = from, %DateTime{} = to) do
    tz = effective_timezone(config, timezone)

    with :lt <- DateTime.compare(from, to),
         {:ok, local_from} <- DateTime.shift_zone(from, tz),
         {:ok, local_to} <- DateTime.shift_zone(to, tz) do
      first = Date.add(DateTime.to_date(local_from), -1)
      last = Date.add(DateTime.to_date(local_to), 1)

      Date.range(first, last)
      |> Enum.flat_map(&day_occurrences(config, &1, tz))
      |> Enum.filter(&in_range?(&1, from, to))
      |> Enum.sort(DateTime)
      |> Enum.uniq_by(&DateTime.to_unix(&1, :millisecond))
    else
      _ -> []
    end
  end

  @doc """
  Returns the first occurrence at or after `from`, looking at most `max_days`
  days ahead, or nil.
  """
  def next_occurrence(config, timezone, %DateTime{} = from, max_days \\ 366) do
    tz = effective_timezone(config, timezone)

    case DateTime.shift_zone(from, tz) do
      {:ok, local_from} ->
        start = Date.add(DateTime.to_date(local_from), -1)

        Stream.iterate(start, &Date.add(&1, 1))
        |> Stream.take(max_days + 2)
        |> Stream.flat_map(fn date ->
          config
          |> day_occurrences(date, tz)
          |> Enum.filter(&(DateTime.compare(&1, from) != :lt))
          |> Enum.sort(DateTime)
        end)
        |> Enum.at(0)

      _ ->
        nil
    end
  end

  # Occurrences of one local date, in UTC.
  defp day_occurrences(%{"schedule" => %{"type" => "once"} = schedule}, date, tz) do
    if Date.from_iso8601!(schedule["date"]) == date do
      to_utc(date, parse_time!(schedule["time"]), tz, :shift)
    else
      []
    end
  end

  defp day_occurrences(%{"schedule" => schedule} = config, date, tz) do
    if date_active?(config["dates"], date) and weekday_active?(config["weekdays"], date) do
      window = parse_window(config["window"])
      gap_mode = if schedule["type"] == "times", do: :shift, else: :skip

      schedule
      |> local_times(window)
      |> Enum.filter(&in_window?(&1, window))
      |> Enum.flat_map(&to_utc(date, &1, tz, gap_mode))
    else
      []
    end
  end

  defp local_times(%{"type" => "hourly", "minute" => minute}, _window) do
    for hour <- 0..23, do: Time.new!(hour, minute, 0)
  end

  defp local_times(%{"type" => "interval", "every_minutes" => every}, window) do
    {start_minute, end_minute} =
      case window do
        nil -> {0, 24 * 60 - 1}
        {start, stop} -> {minutes(start), minutes(stop)}
      end

    start_minute
    |> Stream.iterate(&(&1 + every))
    |> Enum.take_while(&(&1 <= end_minute))
    |> Enum.map(&Time.new!(div(&1, 60), rem(&1, 60), 0))
  end

  defp local_times(%{"type" => "times", "times" => times}, _window) do
    Enum.map(times, &parse_time!/1)
  end

  defp to_utc(date, time, tz, gap_mode) do
    naive = NaiveDateTime.new!(date, time)

    case DateTime.from_naive(naive, tz) do
      {:ok, datetime} -> [to_utc!(datetime)]
      {:ambiguous, first, _second} -> [to_utc!(first)]
      {:gap, _just_before, just_after} when gap_mode == :shift -> [to_utc!(just_after)]
      _ -> []
    end
  end

  defp to_utc!(datetime) do
    datetime |> DateTime.shift_zone!("Etc/UTC") |> DateTime.truncate(:second)
  end

  defp in_range?(datetime, from, to) do
    DateTime.compare(datetime, from) != :lt and DateTime.compare(datetime, to) == :lt
  end

  defp date_active?(nil, _date), do: true

  defp date_active?(dates, date) do
    after_start? =
      case dates["start"] do
        nil -> true
        start -> Date.compare(date, Date.from_iso8601!(start)) != :lt
      end

    before_end? =
      case dates["end"] do
        nil -> true
        stop -> Date.compare(date, Date.from_iso8601!(stop)) != :gt
      end

    after_start? and before_end?
  end

  defp weekday_active?(nil, _date), do: true
  defp weekday_active?(weekdays, date), do: Date.day_of_week(date) in weekdays

  defp parse_window(nil), do: nil

  defp parse_window(%{"start" => start, "end" => stop}),
    do: {parse_time!(start), parse_time!(stop)}

  defp in_window?(_time, nil), do: true

  defp in_window?(time, {start, stop}),
    do: Time.compare(time, start) != :lt and Time.compare(time, stop) != :gt

  defp minutes(%Time{hour: hour, minute: minute}), do: hour * 60 + minute

  defp parse_time!(value) do
    {:ok, time} = parse_time(value)
    time
  end

  # Validation

  defp validate_schedule(%{"type" => "hourly"} = schedule) do
    case schedule["minute"] do
      minute when is_integer(minute) and minute >= 0 and minute <= 59 ->
        {:ok, %{"type" => "hourly", "minute" => minute}}

      _ ->
        {:error, "schedule.minute must be an integer between 0 and 59"}
    end
  end

  defp validate_schedule(%{"type" => "interval"} = schedule) do
    case schedule["every_minutes"] do
      every
      when is_integer(every) and every >= @min_interval_minutes and
             every <= @max_interval_minutes ->
        {:ok, %{"type" => "interval", "every_minutes" => every}}

      _ ->
        {:error,
         "schedule.every_minutes must be an integer between #{@min_interval_minutes} and #{@max_interval_minutes}"}
    end
  end

  defp validate_schedule(%{"type" => "times"} = schedule) do
    times = schedule["times"]

    cond do
      not is_list(times) or times == [] ->
        {:error, "schedule.times must be a non-empty list of HH:MM times"}

      length(times) > @max_times ->
        {:error, "schedule.times can have at most #{@max_times} entries"}

      not Enum.all?(times, &match?({:ok, _}, parse_time(&1))) ->
        {:error, "schedule.times must only contain HH:MM times"}

      true ->
        {:ok, %{"type" => "times", "times" => times |> Enum.uniq() |> Enum.sort()}}
    end
  end

  defp validate_schedule(%{"type" => "once"} = schedule) do
    with {:date, {:ok, _date}} <- {:date, parse_date(schedule["date"])},
         {:time, {:ok, _time}} <- {:time, parse_time(schedule["time"])} do
      {:ok, %{"type" => "once", "date" => schedule["date"], "time" => schedule["time"]}}
    else
      {:date, _} -> {:error, "schedule.date must be a YYYY-MM-DD date"}
      {:time, _} -> {:error, "schedule.time must be a HH:MM time"}
    end
  end

  defp validate_schedule(_schedule),
    do: {:error, "schedule.type must be one of #{Enum.join(@schedule_types, ", ")}"}

  defp validate_weekdays(nil, _once?), do: {:ok, nil}
  defp validate_weekdays(_weekdays, true), do: {:error, "weekdays are not allowed for once"}

  defp validate_weekdays(weekdays, false) when is_list(weekdays) and weekdays != [] do
    if Enum.all?(weekdays, &(is_integer(&1) and &1 >= 1 and &1 <= 7)) do
      {:ok, weekdays |> Enum.uniq() |> Enum.sort()}
    else
      {:error, "weekdays must contain ISO weekdays between 1 (Monday) and 7 (Sunday)"}
    end
  end

  defp validate_weekdays(_weekdays, _once?),
    do: {:error, "weekdays must be a non-empty list or null"}

  defp validate_window(nil, _once?), do: {:ok, nil}
  defp validate_window(_window, true), do: {:error, "window is not allowed for once"}

  defp validate_window(%{"start" => start, "end" => stop}, false) do
    with {:ok, start_time} <- parse_time(start),
         {:ok, stop_time} <- parse_time(stop) do
      if Time.compare(start_time, stop_time) == :lt do
        {:ok, %{"start" => start, "end" => stop}}
      else
        {:error, "window.start must be before window.end (windows cannot cross midnight)"}
      end
    else
      _ -> {:error, "window.start and window.end must be HH:MM times"}
    end
  end

  defp validate_window(_window, _once?), do: {:error, "window must have start and end"}

  defp validate_dates(nil, _once?), do: {:ok, nil}
  defp validate_dates(_dates, true), do: {:error, "dates are not allowed for once"}

  defp validate_dates(dates, false) when is_map(dates) do
    start = Map.get(dates, "start")
    stop = Map.get(dates, "end")

    with {:ok, start_date} <- parse_optional_date(start),
         {:ok, stop_date} <- parse_optional_date(stop) do
      cond do
        is_nil(start_date) and is_nil(stop_date) ->
          {:ok, nil}

        start_date && stop_date && Date.compare(start_date, stop_date) == :gt ->
          {:error, "dates.start must not be after dates.end"}

        true ->
          {:ok, %{"start" => start, "end" => stop}}
      end
    else
      _ -> {:error, "dates.start and dates.end must be YYYY-MM-DD dates or null"}
    end
  end

  defp validate_dates(_dates, _once?), do: {:error, "dates must be an object or null"}

  defp validate_timezone(nil), do: {:ok, nil}
  defp validate_timezone(""), do: {:ok, nil}

  defp validate_timezone(timezone) when is_binary(timezone) do
    if valid_timezone?(timezone),
      do: {:ok, timezone},
      else: {:error, "timezone is not a valid IANA timezone"}
  end

  defp validate_timezone(_timezone), do: {:error, "timezone must be a string"}

  defp valid_timezone?(timezone) do
    match?({:ok, _}, DateTime.shift_zone(~U[2000-01-01 00:00:00Z], timezone))
  end

  defp parse_optional_date(nil), do: {:ok, nil}
  defp parse_optional_date(value), do: parse_date(value)

  defp parse_date(value) when is_binary(value), do: Date.from_iso8601(value)
  defp parse_date(_value), do: {:error, :invalid}

  defp parse_time(value) when is_binary(value) do
    case Regex.run(~r/\A(\d{2}):(\d{2})\z/, value) do
      [_, hour, minute] -> Time.new(String.to_integer(hour), String.to_integer(minute), 0)
      _ -> {:error, :invalid}
    end
  end

  defp parse_time(_value), do: {:error, :invalid}
end

defmodule Castmill.Widgets.Integrations.Rss.DateParser do
  @moduledoc """
  Lenient date parsing for syndication feeds.

  Supports RFC 822 / RFC 1123 dates used by RSS (with numeric offsets, named
  time zones, optional weekday and seconds, two-digit years and full month
  names) and ISO 8601 / RFC 3339 dates used by Atom, RSS 1.0 (`dc:date`) and
  JSON Feed. All dates are normalised to UTC.
  """

  @months %{
    "jan" => 1,
    "feb" => 2,
    "mar" => 3,
    "apr" => 4,
    "may" => 5,
    "jun" => 6,
    "jul" => 7,
    "aug" => 8,
    "sep" => 9,
    "oct" => 10,
    "nov" => 11,
    "dec" => 12
  }

  # Offsets in minutes for time zone abbreviations commonly found in feeds.
  @zones %{
    "UT" => 0,
    "UTC" => 0,
    "GMT" => 0,
    "Z" => 0,
    "EST" => -300,
    "EDT" => -240,
    "CST" => -360,
    "CDT" => -300,
    "MST" => -420,
    "MDT" => -360,
    "PST" => -480,
    "PDT" => -420,
    "AKST" => -540,
    "AKDT" => -480,
    "HST" => -600,
    "WET" => 0,
    "WEST" => 60,
    "BST" => 60,
    "CET" => 60,
    "CEST" => 120,
    "MET" => 60,
    "MEST" => 120,
    "EET" => 120,
    "EEST" => 180,
    "MSK" => 180,
    "JST" => 540,
    "KST" => 540,
    "AEST" => 600,
    "AEDT" => 660,
    "NZST" => 720,
    "NZDT" => 780
  }

  @rfc822 ~r/^(?:[A-Za-z]+\.?,?\s*)?(\d{1,2})[\s\-]+([A-Za-z]{3,9})\.?[\s\-]+(\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*([A-Za-z]{1,5}|[+\-]\d{2}:?\d{2})?/

  @doc """
  Parses a feed date string into a UTC `DateTime`.
  """
  @spec parse(String.t() | nil) :: {:ok, DateTime.t()} | :error
  def parse(nil), do: :error

  def parse(value) when is_binary(value) do
    value = String.trim(value)

    cond do
      value == "" -> :error
      Regex.match?(~r/^\d{4}-\d{2}-\d{2}/, value) -> parse_iso8601(value)
      true -> parse_rfc822(value)
    end
  end

  @doc """
  Formats a date for display, e.g. `"Jan 5, 2025"`.
  """
  @spec format(DateTime.t()) :: String.t()
  def format(%DateTime{} = datetime), do: Calendar.strftime(datetime, "%b %-d, %Y")

  defp parse_iso8601(value) do
    normalized =
      value
      |> String.replace(~r/^(\d{4}-\d{2}-\d{2})[ t](\d)/, "\\1T\\2")
      |> String.replace(~r/(T[\d:.]+)\s*([+\-]\d{2})(\d{2})$/, "\\1\\2:\\3")
      |> String.replace(~r/(T[\d:.]+)\s*([+\-]\d{2})$/, "\\1\\2:00")
      |> String.replace(~r/(T[\d:.]+)\s*(?:z|UTC|GMT)$/i, "\\1Z")

    case DateTime.from_iso8601(normalized) do
      {:ok, datetime, _offset} ->
        {:ok, DateTime.truncate(datetime, :second)}

      {:error, _} ->
        with {:error, _} <- naive_iso8601(normalized) do
          date_only(normalized)
        end
    end
  end

  defp naive_iso8601(value) do
    case NaiveDateTime.from_iso8601(value) do
      {:ok, naive} -> {:ok, naive |> NaiveDateTime.truncate(:second) |> to_utc(0)}
      error -> error
    end
  end

  defp date_only(value) do
    case Date.from_iso8601(String.slice(value, 0, 10)) do
      {:ok, date} -> {:ok, date |> NaiveDateTime.new!(~T[00:00:00]) |> to_utc(0)}
      _ -> :error
    end
  end

  defp parse_rfc822(value) do
    with [_ | captures] <- Regex.run(@rfc822, value),
         [day, month, year, hour, minute, second, zone] <- pad(captures, 7),
         {:ok, month} <- month_number(month),
         {:ok, offset} <- zone_offset(zone),
         {:ok, naive} <-
           NaiveDateTime.new(
             normalize_year(String.to_integer(year)),
             month,
             String.to_integer(day),
             to_int(hour),
             to_int(minute),
             to_int(second)
           ) do
      {:ok, to_utc(naive, offset)}
    else
      _ -> :error
    end
  end

  defp pad(list, size), do: list ++ List.duplicate("", size - length(list))

  defp month_number(name) do
    case Map.fetch(@months, name |> String.slice(0, 3) |> String.downcase()) do
      {:ok, month} -> {:ok, month}
      :error -> :error
    end
  end

  defp zone_offset(""), do: {:ok, 0}

  defp zone_offset(<<sign, rest::binary>>) when sign in [?+, ?-] do
    digits = String.replace(rest, ":", "")
    hours = digits |> String.slice(0, 2) |> String.to_integer()
    minutes = digits |> String.slice(2, 2) |> String.to_integer()
    total = hours * 60 + minutes
    {:ok, if(sign == ?-, do: -total, else: total)}
  end

  defp zone_offset(name), do: {:ok, Map.get(@zones, String.upcase(name), 0)}

  defp normalize_year(year) when year < 50, do: 2000 + year
  defp normalize_year(year) when year < 100, do: 1900 + year
  defp normalize_year(year), do: year

  defp to_int(""), do: 0
  defp to_int(value), do: String.to_integer(value)

  defp to_utc(naive, offset_minutes) do
    naive
    |> NaiveDateTime.add(-offset_minutes * 60, :second)
    |> DateTime.from_naive!("Etc/UTC")
  end
end

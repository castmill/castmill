defmodule Castmill.Widgets.Integrations.Fetchers.OpenMeteo do
  @moduledoc """
  Fetches current conditions and a short forecast from the credential-free
  Open-Meteo API.
  """

  @behaviour Castmill.Widgets.Integrations.Fetcher

  @endpoint "https://api.open-meteo.com/v1/forecast"
  @timeout 10_000

  @impl true
  def fetch(credentials, %{"location" => %{"lat" => lat, "lng" => lng}} = options)
      when is_number(lat) and is_number(lng) do
    query =
      URI.encode_query(%{
        "latitude" => lat,
        "longitude" => lng,
        "current" =>
          "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "daily" => "weather_code,temperature_2m_max,temperature_2m_min",
        "forecast_days" => 6,
        "timezone" => "auto"
      })

    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get("#{@endpoint}?#{query}", headers, recv_timeout: @timeout) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        with {:ok, response} <- Jason.decode(body),
             {:ok, data} <- transform(response, options["location"]) do
          {:ok, data, credentials}
        else
          {:error, %Jason.DecodeError{}} -> {:error, :json_parse_error, credentials}
          {:error, reason} -> {:error, reason, credentials}
        end

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:http_error, status}, credentials}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:network_error, reason}, credentials}
    end
  end

  def fetch(credentials, _options), do: {:error, :invalid_location, credentials}

  @doc false
  def transform(
        %{
          "current" => current,
          "current_units" => current_units,
          "daily" => %{
            "time" => dates,
            "weather_code" => codes,
            "temperature_2m_max" => maximums,
            "temperature_2m_min" => minimums
          },
          "daily_units" => daily_units
        },
        location
      )
      when is_map(current) and is_map(location) do
    temperature_unit = current_units["temperature_2m"] || "°C"
    wind_unit = current_units["wind_speed_10m"] || "km/h"
    daily_unit = daily_units["temperature_2m_max"] || temperature_unit

    forecast =
      [dates, codes, maximums, minimums]
      |> Enum.zip()
      |> Enum.drop(1)
      |> Enum.take(5)
      |> Enum.map(fn {date, code, maximum, minimum} ->
        %{
          "day" => format_day(date),
          "icon" => weather_icon(code),
          "condition" => weather_condition(code),
          "temperature" =>
            "#{format_temperature(maximum)}#{daily_unit} / " <>
              "#{format_temperature(minimum)}#{daily_unit}"
        }
      end)

    code = current["weather_code"]

    {:ok,
     %{
       "location" => location["address"] || "Selected location",
       "temperature" =>
         "#{format_temperature(current["temperature_2m"])}#{temperature_unit}",
       "feels_like" =>
         "Feels like #{format_temperature(current["apparent_temperature"])}#{temperature_unit}",
       "condition" => weather_condition(code),
       "icon" => weather_icon(code),
       "humidity" => "Humidity #{current["relative_humidity_2m"]}%",
       "wind" => "Wind #{format_temperature(current["wind_speed_10m"])} #{wind_unit}",
       "forecast" => forecast,
       "last_updated" => System.system_time(:second)
     }}
  rescue
    _ -> {:error, :invalid_response}
  end

  def transform(_response, _location), do: {:error, :invalid_response}

  defp format_day(date) do
    case Date.from_iso8601(date) do
      {:ok, parsed} -> Calendar.strftime(parsed, "%a")
      _ -> date
    end
  end

  defp format_temperature(value) when is_number(value),
    do: :erlang.float_to_binary(value / 1, decimals: 0)

  defp format_temperature(_value), do: "--"

  defp weather_condition(code) when code == 0, do: "Clear sky"
  defp weather_condition(code) when code in 1..3, do: "Partly cloudy"
  defp weather_condition(code) when code in [45, 48], do: "Fog"
  defp weather_condition(code) when code in 51..57, do: "Drizzle"
  defp weather_condition(code) when code in 61..67, do: "Rain"
  defp weather_condition(code) when code in 71..77, do: "Snow"
  defp weather_condition(code) when code in 80..82, do: "Rain showers"
  defp weather_condition(code) when code in 85..86, do: "Snow showers"
  defp weather_condition(code) when code in 95..99, do: "Thunderstorm"
  defp weather_condition(_code), do: "Weather unavailable"

  defp weather_icon(code) when code == 0, do: "☀️"
  defp weather_icon(code) when code in 1..2, do: "🌤️"
  defp weather_icon(code) when code == 3, do: "☁️"
  defp weather_icon(code) when code in [45, 48], do: "🌫️"
  defp weather_icon(code) when code in 51..67, do: "🌧️"
  defp weather_icon(code) when code in 71..77, do: "❄️"
  defp weather_icon(code) when code in 80..82, do: "🌦️"
  defp weather_icon(code) when code in 85..86, do: "🌨️"
  defp weather_icon(code) when code in 95..99, do: "⛈️"
  defp weather_icon(_code), do: "🌡️"
end

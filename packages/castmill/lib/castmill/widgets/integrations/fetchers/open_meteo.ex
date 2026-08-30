defmodule Castmill.Widgets.Integrations.Fetchers.OpenMeteo do
  @moduledoc """
  Fetches current conditions and a short forecast from Open-Meteo.

  Open-Meteo is free for non-commercial use and requires no credentials. For
  commercial use an API key from an Open-Meteo subscription can be provided; when
  present the fetcher uses the commercial (`customer-api`) endpoint and appends
  the key as the `apikey` query parameter.
  """

  @behaviour Castmill.Widgets.Integrations.Fetcher

  @free_endpoint "https://api.open-meteo.com/v1/forecast"
  @commercial_endpoint "https://customer-api.open-meteo.com/v1/forecast"
  @timeout 10_000

  @impl true
  def fetch(credentials, %{"location" => %{"lat" => lat, "lng" => lng}} = options)
      when is_number(lat) and is_number(lng) do
    api_key = api_key(credentials, options)
    endpoint = if api_key, do: @commercial_endpoint, else: @free_endpoint

    query =
      options
      |> query_params()
      |> maybe_put_api_key(api_key)
      |> URI.encode_query()

    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get("#{endpoint}?#{query}", headers, recv_timeout: @timeout) do
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

  # Reads the optional commercial API key from stored credentials (preferred) or
  # from the widget options, normalizing blank values to `nil`.
  @doc false
  def api_key(credentials, options \\ %{}) do
    raw =
      credential_value(credentials, "apikey") ||
        credential_value(options, "apikey")

    case raw do
      value when is_binary(value) ->
        trimmed = String.trim(value)
        if trimmed == "", do: nil, else: trimmed

      _ ->
        nil
    end
  end

  defp credential_value(map, key) when is_map(map) do
    Map.get(map, key) || Map.get(map, String.to_atom(key))
  end

  defp credential_value(_map, _key), do: nil

  defp maybe_put_api_key(params, nil), do: params
  defp maybe_put_api_key(params, api_key), do: Map.put(params, "apikey", api_key)

  @doc false
  def query_params(%{"location" => %{"lat" => lat, "lng" => lng}} = options) do
    %{
      "latitude" => lat,
      "longitude" => lng,
      "current" =>
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      "daily" => "weather_code,temperature_2m_max,temperature_2m_min",
      "forecast_days" => 6,
      "timezone" => "auto",
      "temperature_unit" => temperature_unit(options)
    }
  end

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
       "temperature" => "#{format_temperature(current["temperature_2m"])}#{temperature_unit}",
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

  defp temperature_unit(%{"fahrenheit" => value}) when value in [true, "true"],
    do: "fahrenheit"

  defp temperature_unit(_options), do: "celsius"

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
  defp weather_condition(code) when code == 1, do: "Mostly clear"
  defp weather_condition(code) when code == 2, do: "Partly cloudy"
  defp weather_condition(code) when code == 3, do: "Overcast"
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

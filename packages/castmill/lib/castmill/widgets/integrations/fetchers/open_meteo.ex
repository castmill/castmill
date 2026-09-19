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
  @day_keys ~w(monday tuesday wednesday thursday friday saturday sunday)
  @translations %{
    "en" => %{
      "selected_location" => "Selected location",
      "feels_like" => "Feels like {temperature}",
      "humidity" => "Humidity {humidity}%",
      "wind" => "Wind {wind} {unit}",
      "forecast_title" => "5-day forecast",
      "monday" => "Mon",
      "tuesday" => "Tue",
      "wednesday" => "Wed",
      "thursday" => "Thu",
      "friday" => "Fri",
      "saturday" => "Sat",
      "sunday" => "Sun",
      "clear_sky" => "Clear sky",
      "mostly_clear" => "Mostly clear",
      "partly_cloudy" => "Partly cloudy",
      "overcast" => "Overcast",
      "fog" => "Fog",
      "drizzle" => "Drizzle",
      "rain" => "Rain",
      "snow" => "Snow",
      "rain_showers" => "Rain showers",
      "snow_showers" => "Snow showers",
      "thunderstorm" => "Thunderstorm",
      "weather_unavailable" => "Weather unavailable"
    },
    "es" => %{
      "selected_location" => "Ubicación seleccionada",
      "feels_like" => "Sensación {temperature}",
      "humidity" => "Humedad {humidity}%",
      "wind" => "Viento {wind} {unit}",
      "forecast_title" => "Pronóstico de 5 días",
      "monday" => "lun",
      "tuesday" => "mar",
      "wednesday" => "mié",
      "thursday" => "jue",
      "friday" => "vie",
      "saturday" => "sáb",
      "sunday" => "dom",
      "clear_sky" => "Cielo despejado",
      "mostly_clear" => "Mayormente despejado",
      "partly_cloudy" => "Parcialmente nublado",
      "overcast" => "Cubierto",
      "fog" => "Niebla",
      "drizzle" => "Llovizna",
      "rain" => "Lluvia",
      "snow" => "Nieve",
      "rain_showers" => "Chubascos",
      "snow_showers" => "Nevadas",
      "thunderstorm" => "Tormenta",
      "weather_unavailable" => "Tiempo no disponible"
    },
    "sv" => %{
      "selected_location" => "Vald plats",
      "feels_like" => "Känns som {temperature}",
      "humidity" => "Luftfuktighet {humidity}%",
      "wind" => "Vind {wind} {unit}",
      "forecast_title" => "5-dygnsprognos",
      "monday" => "mån",
      "tuesday" => "tis",
      "wednesday" => "ons",
      "thursday" => "tors",
      "friday" => "fre",
      "saturday" => "lör",
      "sunday" => "sön",
      "clear_sky" => "Klart",
      "mostly_clear" => "Mestadels klart",
      "partly_cloudy" => "Delvis molnigt",
      "overcast" => "Mulet",
      "fog" => "Dimma",
      "drizzle" => "Duggregn",
      "rain" => "Regn",
      "snow" => "Snö",
      "rain_showers" => "Regnskurar",
      "snow_showers" => "Snöbyar",
      "thunderstorm" => "Åska",
      "weather_unavailable" => "Väder ej tillgängligt"
    },
    "de" => %{
      "selected_location" => "Ausgewählter Ort",
      "feels_like" => "Gefühlt {temperature}",
      "humidity" => "Luftfeuchte {humidity}%",
      "wind" => "Wind {wind} {unit}",
      "forecast_title" => "5-Tage-Vorhersage",
      "monday" => "Mo",
      "tuesday" => "Di",
      "wednesday" => "Mi",
      "thursday" => "Do",
      "friday" => "Fr",
      "saturday" => "Sa",
      "sunday" => "So",
      "clear_sky" => "Klarer Himmel",
      "mostly_clear" => "Meist klar",
      "partly_cloudy" => "Teilweise bewölkt",
      "overcast" => "Bedeckt",
      "fog" => "Nebel",
      "drizzle" => "Nieselregen",
      "rain" => "Regen",
      "snow" => "Schnee",
      "rain_showers" => "Regenschauer",
      "snow_showers" => "Schneeschauer",
      "thunderstorm" => "Gewitter",
      "weather_unavailable" => "Wetter nicht verfügbar"
    },
    "fr" => %{
      "selected_location" => "Lieu sélectionné",
      "feels_like" => "Ressenti {temperature}",
      "humidity" => "Humidité {humidity}%",
      "wind" => "Vent {wind} {unit}",
      "forecast_title" => "Prévisions sur 5 jours",
      "monday" => "lun.",
      "tuesday" => "mar.",
      "wednesday" => "mer.",
      "thursday" => "jeu.",
      "friday" => "ven.",
      "saturday" => "sam.",
      "sunday" => "dim.",
      "clear_sky" => "Ciel dégagé",
      "mostly_clear" => "Plutôt dégagé",
      "partly_cloudy" => "Partiellement nuageux",
      "overcast" => "Couvert",
      "fog" => "Brouillard",
      "drizzle" => "Bruine",
      "rain" => "Pluie",
      "snow" => "Neige",
      "rain_showers" => "Averses",
      "snow_showers" => "Averses de neige",
      "thunderstorm" => "Orage",
      "weather_unavailable" => "Météo indisponible"
    },
    "zh" => %{
      "selected_location" => "所选位置",
      "feels_like" => "体感 {temperature}",
      "humidity" => "湿度 {humidity}%",
      "wind" => "风速 {wind} {unit}",
      "forecast_title" => "5日预报",
      "monday" => "周一",
      "tuesday" => "周二",
      "wednesday" => "周三",
      "thursday" => "周四",
      "friday" => "周五",
      "saturday" => "周六",
      "sunday" => "周日",
      "clear_sky" => "晴朗",
      "mostly_clear" => "大部晴朗",
      "partly_cloudy" => "局部多云",
      "overcast" => "阴天",
      "fog" => "雾",
      "drizzle" => "毛毛雨",
      "rain" => "雨",
      "snow" => "雪",
      "rain_showers" => "阵雨",
      "snow_showers" => "阵雪",
      "thunderstorm" => "雷暴",
      "weather_unavailable" => "天气不可用"
    },
    "ar" => %{
      "selected_location" => "الموقع المحدد",
      "feels_like" => "تبدو كأنها {temperature}",
      "humidity" => "الرطوبة {humidity}%",
      "wind" => "الرياح {wind} {unit}",
      "forecast_title" => "توقعات 5 أيام",
      "monday" => "الاثنين",
      "tuesday" => "الثلاثاء",
      "wednesday" => "الأربعاء",
      "thursday" => "الخميس",
      "friday" => "الجمعة",
      "saturday" => "السبت",
      "sunday" => "الأحد",
      "clear_sky" => "سماء صافية",
      "mostly_clear" => "صافٍ غالبًا",
      "partly_cloudy" => "غائم جزئيًا",
      "overcast" => "ملبد بالغيوم",
      "fog" => "ضباب",
      "drizzle" => "رذاذ",
      "rain" => "مطر",
      "snow" => "ثلج",
      "rain_showers" => "زخات مطر",
      "snow_showers" => "زخات ثلج",
      "thunderstorm" => "عاصفة رعدية",
      "weather_unavailable" => "الطقس غير متاح"
    },
    "ko" => %{
      "selected_location" => "선택한 위치",
      "feels_like" => "체감 {temperature}",
      "humidity" => "습도 {humidity}%",
      "wind" => "바람 {wind} {unit}",
      "forecast_title" => "5일 예보",
      "monday" => "월",
      "tuesday" => "화",
      "wednesday" => "수",
      "thursday" => "목",
      "friday" => "금",
      "saturday" => "토",
      "sunday" => "일",
      "clear_sky" => "맑음",
      "mostly_clear" => "대체로 맑음",
      "partly_cloudy" => "부분적으로 흐림",
      "overcast" => "흐림",
      "fog" => "안개",
      "drizzle" => "이슬비",
      "rain" => "비",
      "snow" => "눈",
      "rain_showers" => "소나기",
      "snow_showers" => "소낙눈",
      "thunderstorm" => "뇌우",
      "weather_unavailable" => "날씨를 사용할 수 없음"
    },
    "ja" => %{
      "selected_location" => "選択した場所",
      "feels_like" => "体感 {temperature}",
      "humidity" => "湿度 {humidity}%",
      "wind" => "風 {wind} {unit}",
      "forecast_title" => "5日間予報",
      "monday" => "月",
      "tuesday" => "火",
      "wednesday" => "水",
      "thursday" => "木",
      "friday" => "金",
      "saturday" => "土",
      "sunday" => "日",
      "clear_sky" => "快晴",
      "mostly_clear" => "ほぼ快晴",
      "partly_cloudy" => "晴れ時々曇り",
      "overcast" => "曇り",
      "fog" => "霧",
      "drizzle" => "霧雨",
      "rain" => "雨",
      "snow" => "雪",
      "rain_showers" => "にわか雨",
      "snow_showers" => "にわか雪",
      "thunderstorm" => "雷雨",
      "weather_unavailable" => "天気を利用できません"
    }
  }

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
             {:ok, data} <- transform(response, options["location"], options) do
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
  def transform(response, location, options \\ %{})

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
        location,
        options
      )
      when is_map(current) and is_map(location) do
    locale = display_locale(options)
    temperature_unit = current_units["temperature_2m"] || "°C"
    wind_unit = current_units["wind_speed_10m"] || "km/h"
    daily_unit = daily_units["temperature_2m_max"] || temperature_unit

    forecast =
      [dates, codes, maximums, minimums]
      |> Enum.zip()
      |> Enum.drop(1)
      |> Enum.take(5)
      |> Enum.map(fn {date, code, maximum, minimum} ->
        condition_key = weather_condition_key(code)

        %{
          "date" => date,
          "day" => format_day(date, locale),
          "weather_code" => code,
          "condition_key" => condition_key,
          "icon" => weather_icon(code),
          "condition" => translate(locale, condition_key),
          "temperature" =>
            "#{format_temperature(maximum)}#{daily_unit} / " <>
              "#{format_temperature(minimum)}#{daily_unit}"
        }
      end)

    code = current["weather_code"]
    condition_key = weather_condition_key(code)

    apparent_temperature =
      "#{format_temperature(current["apparent_temperature"])}#{temperature_unit}"

    {:ok,
     %{
       "display_locale" => locale,
       "location" => location["address"] || translate(locale, "selected_location"),
       "temperature" => "#{format_temperature(current["temperature_2m"])}#{temperature_unit}",
       "temperature_value" => current["temperature_2m"],
       "temperature_unit" => temperature_unit,
       "feels_like" => translate(locale, "feels_like", %{"temperature" => apparent_temperature}),
       "feels_like_value" => current["apparent_temperature"],
       "condition" => translate(locale, condition_key),
       "condition_key" => condition_key,
       "weather_code" => code,
       "icon" => weather_icon(code),
       "humidity" =>
         translate(locale, "humidity", %{"humidity" => current["relative_humidity_2m"]}),
       "humidity_value" => current["relative_humidity_2m"],
       "wind" =>
         translate(locale, "wind", %{
           "wind" => format_temperature(current["wind_speed_10m"]),
           "unit" => wind_unit
         }),
       "wind_value" => current["wind_speed_10m"],
       "wind_unit" => wind_unit,
       "forecast_title" => translate(locale, "forecast_title"),
       "forecast" => forecast,
       "last_updated" => System.system_time(:second)
     }}
  rescue
    _ -> {:error, :invalid_response}
  end

  def transform(_response, _location, _options), do: {:error, :invalid_response}

  defp temperature_unit(%{"fahrenheit" => value}) when value in [true, "true"],
    do: "fahrenheit"

  defp temperature_unit(_options), do: "celsius"

  defp display_locale(options) do
    options
    |> credential_value("display_locale")
    |> normalize_locale()
  end

  defp normalize_locale(locale) when is_binary(locale) do
    locale = locale |> String.split(["-", "_"]) |> List.first()
    if Map.has_key?(@translations, locale), do: locale, else: "en"
  end

  defp normalize_locale(_locale), do: "en"

  defp format_day(date, locale) do
    case Date.from_iso8601(date) do
      {:ok, parsed} ->
        day_key = Enum.at(@day_keys, Date.day_of_week(parsed) - 1)
        translate(locale, day_key)

      _ ->
        date
    end
  end

  defp format_temperature(value) when is_number(value),
    do: :erlang.float_to_binary(value / 1, decimals: 0)

  defp format_temperature(_value), do: "--"

  defp translate(locale, key, params \\ %{}) do
    template =
      @translations
      |> Map.get(locale, @translations["en"])
      |> Map.get(key, @translations["en"][key] || key)

    Enum.reduce(params, template, fn {name, value}, acc ->
      String.replace(acc, "{#{name}}", to_string(value))
    end)
  end

  defp weather_condition_key(code) when code == 0, do: "clear_sky"
  defp weather_condition_key(code) when code == 1, do: "mostly_clear"
  defp weather_condition_key(code) when code == 2, do: "partly_cloudy"
  defp weather_condition_key(code) when code == 3, do: "overcast"
  defp weather_condition_key(code) when code in [45, 48], do: "fog"
  defp weather_condition_key(code) when code in 51..57, do: "drizzle"
  defp weather_condition_key(code) when code in 61..67, do: "rain"
  defp weather_condition_key(code) when code in 71..77, do: "snow"
  defp weather_condition_key(code) when code in 80..82, do: "rain_showers"
  defp weather_condition_key(code) when code in 85..86, do: "snow_showers"
  defp weather_condition_key(code) when code in 95..99, do: "thunderstorm"
  defp weather_condition_key(_code), do: "weather_unavailable"

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

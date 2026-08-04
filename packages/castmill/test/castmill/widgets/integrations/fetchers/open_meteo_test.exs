defmodule Castmill.Widgets.Integrations.Fetchers.OpenMeteoTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.Integrations.Fetchers.OpenMeteo

  test "rejects a missing or invalid location" do
    assert {:error, :invalid_location, %{}} = OpenMeteo.fetch(%{}, %{})

    assert {:error, :invalid_location, %{}} =
             OpenMeteo.fetch(%{}, %{"location" => %{"lat" => "51.5", "lng" => -0.09}})
  end

  test "transforms Open-Meteo current conditions and forecast" do
    response = %{
      "current" => %{
        "temperature_2m" => 18.4,
        "apparent_temperature" => 17.6,
        "relative_humidity_2m" => 72,
        "weather_code" => 3,
        "wind_speed_10m" => 11.2
      },
      "current_units" => %{
        "temperature_2m" => "°C",
        "wind_speed_10m" => "km/h"
      },
      "daily" => %{
        "time" => ["2026-08-03", "2026-08-04", "2026-08-05"],
        "weather_code" => [3, 61, 1],
        "temperature_2m_max" => [20.1, 19.4, 22.2],
        "temperature_2m_min" => [12.0, 11.8, 13.1]
      },
      "daily_units" => %{"temperature_2m_max" => "°C"}
    }

    assert {:ok, data} = OpenMeteo.transform(response, %{"address" => "London, United Kingdom"})

    assert data["location"] == "London, United Kingdom"
    assert data["temperature"] == "18°C"
    assert data["condition"] == "Overcast"
    assert data["icon"] == "☁️"
    assert data["humidity"] == "Humidity 72%"
    assert data["wind"] == "Wind 11 km/h"

    assert data["forecast"] == [
             %{
               "day" => "Tue",
               "icon" => "🌧️",
               "condition" => "Rain",
               "temperature" => "19°C / 12°C"
             },
             %{
               "day" => "Wed",
               "icon" => "🌤️",
               "condition" => "Mostly clear",
               "temperature" => "22°C / 13°C"
             }
           ]
  end

  test "rejects malformed API data" do
    assert {:error, :invalid_response} = OpenMeteo.transform(%{"current" => %{}}, %{})
  end
end

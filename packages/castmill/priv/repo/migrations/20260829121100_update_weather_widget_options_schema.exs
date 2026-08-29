defmodule Castmill.Repo.Migrations.UpdateWeatherWidgetOptionsSchema do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  def up do
    update_weather_options_schema(location_options_schema())
  end

  def down do
    :ok
  end

  defp update_weather_options_schema(options_schema) do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(w in Widget, where: w.id == ^weather.id)
      |> Repo.update_all(set: [options_schema: options_schema])
    end
  end

  defp location_options_schema do
    %{
      "location" => %{
        "type" => "location",
        "required" => true,
        "description" => "Select the location for weather information",
        "default" => %{
          "lat" => 51.505,
          "lng" => -0.09,
          "address" => "London, United Kingdom"
        },
        "defaultZoom" => 10,
        "order" => 1
      }
    }
  end
end

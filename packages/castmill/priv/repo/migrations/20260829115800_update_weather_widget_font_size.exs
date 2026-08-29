defmodule Castmill.Repo.Migrations.UpdateWeatherWidgetFontSize do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  def up do
    update_weather_font_size("1.8vmin")
  end

  def down do
    update_weather_font_size("1.8vh")
  end

  defp update_weather_font_size(font_size) do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      template =
        weather.template
        |> Map.update("style", %{"font-size" => font_size}, fn style ->
          Map.put(style, "font-size", font_size)
        end)

      from(w in Widget, where: w.id == ^weather.id)
      |> Repo.update_all(set: [template: template])
    end
  end
end

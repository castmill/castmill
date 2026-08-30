defmodule Castmill.Repo.Migrations.UpdateWeatherIntegrationDiscriminatorKey do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  def up do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(i in WidgetIntegration,
        where: i.widget_id == ^weather.id and i.name == "open-meteo"
      )
      |> Repo.update_all(
        set: [discriminator_type: "widget_option", discriminator_key: "location,fahrenheit"]
      )
    end
  end

  def down do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(i in WidgetIntegration,
        where: i.widget_id == ^weather.id and i.name == "open-meteo"
      )
      |> Repo.update_all(set: [discriminator_key: "location"])
    end
  end
end

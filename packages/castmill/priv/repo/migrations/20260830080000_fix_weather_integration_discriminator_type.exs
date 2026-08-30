defmodule Castmill.Repo.Migrations.FixWeatherIntegrationDiscriminatorType do
  @moduledoc """
  Repairs the Open-Meteo weather integration on databases that were created
  before the discriminator was made unit-aware.

  The integration must use the `widget_option` discriminator keyed by
  `location,fahrenheit` so that toggling the Fahrenheit option produces a
  different cache key. Databases that defaulted to `widget_config` cached the
  weather data per widget instance (`cfg:<id>`), which meant switching the
  temperature unit reused the previously cached Celsius data and appeared to
  ignore the setting.

  A previous migration only corrected `discriminator_key`, leaving a stale
  `discriminator_type`, so this migration fixes the type and clears the stale
  cached data so the next fetch repopulates it with the correct unit.
  """
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Widgets.Integrations.WidgetIntegrationData

  def up do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      integration =
        Repo.one(
          from(i in WidgetIntegration,
            where: i.widget_id == ^weather.id and i.name == "open-meteo"
          )
        )

      if integration do
        from(i in WidgetIntegration, where: i.id == ^integration.id)
        |> Repo.update_all(
          set: [
            discriminator_type: "widget_option",
            discriminator_key: "location,fahrenheit"
          ]
        )

        # Drop any data cached under the previous discriminator scheme so the
        # next request refetches with the currently selected temperature unit.
        from(d in WidgetIntegrationData, where: d.widget_integration_id == ^integration.id)
        |> Repo.delete_all()
      end
    end
  end

  def down do
    :ok
  end
end

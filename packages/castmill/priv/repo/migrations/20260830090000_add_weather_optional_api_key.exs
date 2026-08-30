defmodule Castmill.Repo.Migrations.AddWeatherOptionalApiKey do
  @moduledoc """
  Models the Open-Meteo weather integration as optionally authenticated.

  Open-Meteo is free for non-commercial use and needs no credentials, but
  commercial use requires an API key from an Open-Meteo subscription. This
  migration switches the integration to `auth_type: "optional"` with an optional
  `apikey` credential field (organization-scoped, so each organization can
  provide its own commercial key), replacing the previous `"none"` schema that
  incorrectly implied there was never anything to configure.
  """
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  def up do
    update_integration(%{
      credential_scope: "organization",
      credential_schema: optional_api_key_schema(),
      pull_config: %{
        "auth_type" => "optional",
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.OpenMeteo"
      }
    })
  end

  def down do
    update_integration(%{
      credential_scope: "widget",
      credential_schema: %{"auth_type" => "none"},
      pull_config: %{
        "auth_type" => "none",
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.OpenMeteo"
      }
    })
  end

  defp update_integration(changes) do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(i in WidgetIntegration,
        where: i.widget_id == ^weather.id and i.name == "open-meteo"
      )
      |> Repo.update_all(set: Enum.to_list(changes))
    end
  end

  defp optional_api_key_schema do
    %{
      "auth_type" => "optional",
      "fields" => %{
        "apikey" => %{
          "label" => "Commercial API Key",
          "type" => "password",
          "required" => false,
          "description" =>
            "Optional. Open-Meteo is free for non-commercial use. For commercial use, " <>
              "enter the API key from your Open-Meteo subscription."
        }
      }
    }
  end
end

defmodule Castmill.Repo.Migrations.ImplementWeatherWidget do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  def up do
    weather = Repo.one!(from(w in Widget, where: w.slug == "weather"))

    from(w in Widget, where: w.id == ^weather.id)
    |> Repo.update_all(
      set: [
        description: "Displays current weather and a five-day forecast for a selected location.",
        aspect_ratio: nil,
        options_schema: options_schema(),
        template: template(),
        data_schema: data_schema(),
        webhook_url: nil,
        update_interval_seconds: 900
      ]
    )

    integration_attrs = %{
      widget_id: weather.id,
      name: "open-meteo",
      description: "Free weather forecasts from Open-Meteo",
      integration_type: "pull",
      credential_scope: "organization",
      credential_schema: %{
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
      },
      pull_endpoint: "https://api.open-meteo.com/v1/forecast",
      pull_interval_seconds: 900,
      pull_config: %{
        "auth_type" => "optional",
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.OpenMeteo"
      },
      discriminator_type: "widget_option",
      discriminator_key: "location,fahrenheit",
      is_active: true
    }

    %WidgetIntegration{}
    |> WidgetIntegration.changeset(integration_attrs)
    |> Repo.insert!(
      on_conflict:
        {:replace,
         [
           :description,
           :integration_type,
           :credential_scope,
           :credential_schema,
           :pull_endpoint,
           :pull_interval_seconds,
           :pull_config,
           :discriminator_type,
           :discriminator_key,
           :is_active,
           :updated_at
         ]},
      conflict_target: [:widget_id, :name]
    )
  end

  def down do
    weather = Repo.one(from(w in Widget, where: w.slug == "weather"))

    if weather do
      from(i in WidgetIntegration,
        where: i.widget_id == ^weather.id and i.name == "open-meteo"
      )
      |> Repo.delete_all()

      from(w in Widget, where: w.id == ^weather.id)
      |> Repo.update_all(
        set: [
          description: "Display weather information.",
          aspect_ratio: nil,
          options_schema: options_schema(),
          template: %{
            "type" => "group",
            "name" => "weather",
            "style" => %{
              "background" => %{"key" => "options.background"},
              "color" => %{"key" => "options.color"}
            },
            "components" => []
          },
          data_schema: %{
            "icons" => %{
              "type" => "list",
              "items" => %{
                "type" => "map",
                "schema" => %{"id" => "string", "url" => "string"}
              }
            },
            "days" => %{
              "type" => "list",
              "items" => %{
                "type" => "map",
                "schema" => %{
                  "date" => "string",
                  "temp" => "number",
                  "unit" => "string",
                  "min_temp" => "number",
                  "max_temp" => "number",
                  "icon" => "string"
                }
              }
            }
          },
          webhook_url: "widgets/weather",
          update_interval_seconds: 60
        ]
      )
    end
  end

  defp options_schema do
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
      },
      "fahrenheit" => %{
        "type" => "boolean",
        "default" => false,
        "description" => "Display temperatures in Fahrenheit instead of Celsius",
        "order" => 2
      }
    }
  end

  defp template do
    %{
      "type" => "group",
      "name" => "weather",
      "style" => %{
        "width" => "100%",
        "height" => "100%",
        "display" => "flex",
        "flex-direction" => "column",
        "box-sizing" => "border-box",
        "overflow" => "hidden",
        "padding" => "2.5em 3em",
        "font-size" => "1.8vh",
        "color" => "#f8fafc",
        "background" =>
          "radial-gradient(circle at top right, #38bdf8 0%, #2563eb 35%, #172554 100%)",
        "font-family" => "Inter, system-ui, sans-serif"
      },
      "components" => [
        %{
          "type" => "text",
          "name" => "location",
          "opts" => %{
            "text" => %{"key" => "data.location", "default" => "London, United Kingdom"},
            "autofit" => %{"baseSize" => 1.35, "maxSize" => 1.35, "minSize" => 0.8}
          },
          "style" => %{
            "height" => "12%",
            "font-size" => "1.35em",
            "font-weight" => "600",
            "opacity" => "0.9"
          }
        },
        %{
          "type" => "group",
          "name" => "current-weather",
          "style" => %{
            "height" => "46%",
            "display" => "flex",
            "align-items" => "center",
            "gap" => "2em"
          },
          "components" => [
            %{
              "type" => "text",
              "name" => "current-icon",
              "opts" => %{
                "text" => %{"key" => "data.icon", "default" => "🌤️"},
                "autofit" => %{"baseSize" => 5.0, "maxSize" => 5.0, "minSize" => 2.5}
              },
              "style" => %{
                "width" => "24%",
                "font-size" => "5em",
                "filter" => "drop-shadow(0 0.2em 0.5em rgba(15, 23, 42, 0.25))"
              }
            },
            %{
              "type" => "group",
              "name" => "current-details",
              "style" => %{
                "width" => "46%",
                "display" => "flex",
                "flex-direction" => "column",
                "justify-content" => "center"
              },
              "components" => [
                %{
                  "type" => "text",
                  "name" => "temperature",
                  "opts" => %{
                    "text" => %{"key" => "data.temperature", "default" => "18°C"},
                    "autofit" => %{"baseSize" => 4.8, "maxSize" => 4.8, "minSize" => 2.2}
                  },
                  "style" => %{
                    "height" => "55%",
                    "font-size" => "4.8em",
                    "font-weight" => "300",
                    "letter-spacing" => "-0.05em"
                  }
                },
                %{
                  "type" => "text",
                  "name" => "condition",
                  "opts" => %{
                    "text" => %{"key" => "data.condition", "default" => "Partly cloudy"},
                    "autofit" => %{"baseSize" => 1.6, "maxSize" => 1.6, "minSize" => 0.85}
                  },
                  "style" => %{
                    "height" => "25%",
                    "font-size" => "1.6em",
                    "font-weight" => "600"
                  }
                },
                %{
                  "type" => "text",
                  "name" => "feels-like",
                  "opts" => %{
                    "text" => %{"key" => "data.feels_like", "default" => "Feels like 17°C"},
                    "autofit" => %{"baseSize" => 1.0, "maxSize" => 1.0, "minSize" => 0.75}
                  },
                  "style" => %{"height" => "20%", "font-size" => "1em", "opacity" => "0.72"}
                }
              ]
            },
            %{
              "type" => "group",
              "name" => "current-metrics",
              "style" => %{
                "width" => "30%",
                "display" => "flex",
                "flex-direction" => "column",
                "gap" => "1em",
                "padding" => "1.5em",
                "border-radius" => "1.2em",
                "background" => "rgba(255, 255, 255, 0.13)"
              },
              "components" => [
                %{
                  "type" => "text",
                  "name" => "humidity",
                  "opts" => %{
                    "text" => %{"key" => "data.humidity", "default" => "Humidity 72%"},
                    "autofit" => %{"baseSize" => 1.1, "maxSize" => 1.1, "minSize" => 0.8}
                  },
                  "style" => %{"height" => "2em", "font-size" => "1.1em"}
                },
                %{
                  "type" => "text",
                  "name" => "wind",
                  "opts" => %{
                    "text" => %{"key" => "data.wind", "default" => "Wind 11 km/h"},
                    "autofit" => %{"baseSize" => 1.1, "maxSize" => 1.1, "minSize" => 0.8}
                  },
                  "style" => %{"height" => "2em", "font-size" => "1.1em"}
                }
              ]
            }
          ]
        },
        %{
          "type" => "text",
          "name" => "forecast-title",
          "opts" => %{
            "text" => "5-DAY FORECAST",
            "autofit" => %{"baseSize" => 0.8, "maxSize" => 0.8, "minSize" => 0.65}
          },
          "style" => %{
            "height" => "8%",
            "font-size" => "0.8em",
            "font-weight" => "700",
            "letter-spacing" => "0.16em",
            "opacity" => "0.7"
          }
        },
        %{
          "type" => "scroller",
          "name" => "forecast",
          "opts" => %{
            "items" => %{"key" => "data.forecast"},
            "direction" => "left",
            "speed" => 12,
            "gap" => "1em"
          },
          "style" => %{"height" => "34%", "width" => "100%"},
          "component" => %{
            "type" => "group",
            "name" => "forecast-day",
            "style" => %{
              "width" => "10em",
              "height" => "100%",
              "display" => "flex",
              "flex-direction" => "column",
              "align-items" => "center",
              "justify-content" => "center",
              "border-radius" => "1.1em",
              "background" => "rgba(255, 255, 255, 0.12)"
            },
            "components" => [
              %{
                "type" => "text",
                "name" => "day",
                "opts" => %{
                  "text" => %{"key" => "$.day"},
                  "autofit" => %{"baseSize" => 1.0, "maxSize" => 1.0, "minSize" => 0.75}
                },
                "style" => %{
                  "height" => "20%",
                  "font-size" => "1em",
                  "font-weight" => "700",
                  "text-align" => "center"
                }
              },
              %{
                "type" => "text",
                "name" => "icon",
                "opts" => %{
                  "text" => %{"key" => "$.icon"},
                  "autofit" => %{"baseSize" => 2.4, "maxSize" => 2.4, "minSize" => 1.4}
                },
                "style" => %{"height" => "45%", "font-size" => "2.4em", "text-align" => "center"}
              },
              %{
                "type" => "text",
                "name" => "forecast-temperature",
                "opts" => %{
                  "text" => %{"key" => "$.temperature"},
                  "autofit" => %{"baseSize" => 0.95, "maxSize" => 0.95, "minSize" => 0.7}
                },
                "style" => %{
                  "height" => "22%",
                  "font-size" => "0.95em",
                  "font-weight" => "600",
                  "text-align" => "center"
                }
              }
            ]
          }
        }
      ]
    }
  end

  defp data_schema do
    %{
      "location" => %{"type" => "string", "default" => "London, United Kingdom"},
      "temperature" => %{"type" => "string", "default" => "18°C"},
      "feels_like" => %{"type" => "string", "default" => "Feels like 17°C"},
      "condition" => %{"type" => "string", "default" => "Partly cloudy"},
      "icon" => %{"type" => "string", "default" => "🌤️"},
      "humidity" => %{"type" => "string", "default" => "Humidity 72%"},
      "wind" => %{"type" => "string", "default" => "Wind 11 km/h"},
      "forecast" => %{
        "type" => "list",
        "default" => [
          %{"day" => "Tue", "icon" => "🌧️", "condition" => "Rain", "temperature" => "19°C / 12°C"},
          %{
            "day" => "Wed",
            "icon" => "☀️",
            "condition" => "Clear sky",
            "temperature" => "22°C / 13°C"
          },
          %{
            "day" => "Thu",
            "icon" => "🌤️",
            "condition" => "Partly cloudy",
            "temperature" => "21°C / 14°C"
          },
          %{
            "day" => "Fri",
            "icon" => "☁️",
            "condition" => "Cloudy",
            "temperature" => "20°C / 13°C"
          },
          %{
            "day" => "Sat",
            "icon" => "☀️",
            "condition" => "Clear sky",
            "temperature" => "23°C / 15°C"
          }
        ],
        "items" => %{
          "type" => "map",
          "schema" => %{
            "day" => "string",
            "icon" => "string",
            "condition" => "string",
            "temperature" => "string"
          }
        }
      },
      "last_updated" => %{"type" => "number", "default" => 0}
    }
  end
end

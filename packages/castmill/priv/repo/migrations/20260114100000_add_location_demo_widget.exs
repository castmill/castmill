defmodule Castmill.Repo.Migrations.AddLocationDemoWidget do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  def up do
    # Insert a demo widget that uses the location picker
    widget_attrs = %{
      name: "Location Display",
      slug: "location-display-demo",
      description: "Displays location information with coordinates and address. Demo widget for location picker functionality.",
      icon: "/widgets/location-display/icon.svg",
      small_icon: "/widgets/location-display/icon-small.svg",
      aspect_ratio: "16:9",
      is_system: false,
      template: %{
        "type" => "group",
        "name" => "location-display-widget",
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "display" => "flex",
          "flex-direction" => "column",
          "align-items" => "center",
          "justify-content" => "center",
          "background" => %{"key" => "options.background"},
          "padding" => "2em",
          "box-sizing" => "border-box"
        },
        "components" => [
          # Title
          %{
            "type" => "text",
            "name" => "title",
            "opts" => %{
              "text" => %{"key" => "options.title"}
            },
            "style" => %{
              "font-size" => "3em",
              "font-weight" => "bold",
              "color" => %{"key" => "options.text_color"},
              "text-align" => "center",
              "margin-bottom" => "0.5em"
            }
          },
          # Location information container
          %{
            "type" => "group",
            "name" => "location-info",
            "style" => %{
              "display" => "flex",
              "flex-direction" => "column",
              "align-items" => "center",
              "gap" => "1em",
              "background" => "rgba(255, 255, 255, 0.1)",
              "padding" => "2em",
              "border-radius" => "1em",
              "max-width" => "80%"
            },
            "components" => [
              # Address
              %{
                "type" => "text",
                "name" => "address",
                "opts" => %{
                  "text" => %{"key" => "options.location.address", "default" => "No address"}
                },
                "style" => %{
                  "font-size" => "2em",
                  "color" => %{"key" => "options.text_color"},
                  "text-align" => "center"
                }
              },
              # Coordinates
              %{
                "type" => "text",
                "name" => "coordinates",
                "opts" => %{
                  "text" => %{
                    "template" => "📍 {{options.location.lat}}, {{options.location.lng}}",
                    "default" => "No location selected"
                  }
                },
                "style" => %{
                  "font-size" => "1.5em",
                  "color" => %{"key" => "options.text_color"},
                  "opacity" => "0.8"
                }
              },
              # City and Country
              %{
                "type" => "text",
                "name" => "city-country",
                "opts" => %{
                  "text" => %{
                    "template" => "{{options.location.city}}, {{options.location.country}}",
                    "default" => ""
                  }
                },
                "style" => %{
                  "font-size" => "1.2em",
                  "color" => %{"key" => "options.text_color"},
                  "opacity" => "0.7"
                }
              }
            ]
          }
        ]
      },
      options_schema: %{
        "title" => %{
          "type" => "string",
          "required" => false,
          "default" => "Location",
          "placeholder" => "Enter title",
          "description" => "Title text to display above the location",
          "order" => 1
        },
        "location" => %{
          "type" => "location",
          "required" => true,
          "description" => "Select a location on the map",
          "default" => %{
            "lat" => 51.505,
            "lng" => -0.09,
            "address" => "London, United Kingdom"
          },
          "defaultZoom" => 13,
          "order" => 2
        },
        "text_color" => %{
          "type" => "color",
          "required" => false,
          "default" => "#ffffff",
          "description" => "Color of the text",
          "order" => 3
        },
        "background" => %{
          "type" => "color",
          "required" => false,
          "default" => "#1a73e8",
          "description" => "Background color of the widget",
          "order" => 4
        },
        "duration" => %{
          "type" => "number",
          "required" => true,
          "default" => 10,
          "description" => "Duration in seconds to display the location",
          "min" => 1,
          "max" => 300,
          "order" => 5
        }
      }
    }

    %Widget{is_system: false}
    |> Widget.changeset(widget_attrs)
    |> Repo.insert!()
  end

  def down do
    Repo.delete_all(from(w in Widget, where: w.slug == "location-display-demo"))
  end
end

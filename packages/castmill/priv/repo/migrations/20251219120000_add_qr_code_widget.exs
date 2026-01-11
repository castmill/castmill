defmodule Castmill.Repo.Migrations.AddQrCodeWidget do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  def up do
    # Insert the QR Code widget
    widget_attrs = %{
      name: "QR Code",
      slug: "qr-code",
      description: "Displays a QR code for URLs or text with optional caption.",
      icon: "/widgets/qr-code/icon.svg",
      small_icon: "/widgets/qr-code/icon-small.svg",
      aspect_ratio: "1:1",
      is_system: true,
      template: %{
        "type" => "group",
        "name" => "qr-code-widget",
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "display" => "flex",
          "flex-direction" => "column",
          "align-items" => "center",
          "justify-content" => "center",
          "background" => %{"key" => "options.background"},
          "padding" => "1.5em",
          "box-sizing" => "border-box"
        },
        "components" => [
          # QR Code container with subtle shadow
          %{
            "type" => "group",
            "name" => "qr-container",
            "style" => %{
              "display" => "flex",
              "align-items" => "center",
              "justify-content" => "center",
              "width" => "75%",
              "height" => "75%",
              "background" => %{"key" => "options.qr_background"},
              "border-radius" => "0.5em",
              "box-shadow" => "0 0.25em 1em rgba(0, 0, 0, 0.1)",
              "padding" => "1em"
            },
            "components" => [
              %{
                "type" => "qr-code",
                "name" => "qr-code",
                "opts" => %{
                  "content" => %{"key" => "options.content"},
                  "foregroundColor" => %{"key" => "options.foreground_color"},
                  "backgroundColor" => %{"key" => "options.qr_background"}
                },
                "style" => %{
                  "width" => "100%",
                  "height" => "100%"
                }
              }
            ]
          },
          # Optional caption text below QR code
          # Only visible when caption has content
          %{
            "type" => "text",
            "name" => "caption",
            "opts" => %{
              "text" => %{"key" => "options.caption", "default" => ""}
            },
            "style" => %{
              "margin-top" => "0.8em",
              "font-size" => %{"key" => "options.caption_size"},
              "font-weight" => "500",
              "color" => %{"key" => "options.text_color"},
              "text-align" => "center",
              "max-width" => "90%",
              "overflow" => "hidden",
              "text-overflow" => "ellipsis",
              "white-space" => "nowrap"
            }
          }
        ]
      },
      options_schema: %{
        "content" => %{
          "type" => "url",
          "required" => true,
          "default" => "https://example.com",
          "placeholder" => "https://example.com",
          "description" => "The URL or text to encode in the QR code",
          "order" => 1
        },
        "caption" => %{
          "type" => "string",
          "required" => false,
          "placeholder" => "Scan me!",
          "description" => "Optional text to display below the QR code",
          "order" => 2
        },
        "caption_size" => %{
          "type" => "string",
          "required" => false,
          "default" => "2em",
          "placeholder" => "2em",
          "description" => "Font size of the caption text (e.g., 1.5em, 2em, 3em)",
          "order" => 3
        },
        "text_color" => %{
          "type" => "color",
          "required" => false,
          "default" => "#333333",
          "description" => "Color of the caption text",
          "order" => 4
        },
        "background" => %{
          "type" => "color",
          "required" => false,
          "default" => "#ffffff",
          "description" => "Background color of the widget",
          "order" => 5
        },
        "qr_background" => %{
          "type" => "color",
          "required" => false,
          "default" => "#ffffff",
          "description" => "Background color of the QR code",
          "order" => 6
        },
        "foreground_color" => %{
          "type" => "color",
          "required" => false,
          "default" => "#000000",
          "description" => "Color of the QR code modules",
          "order" => 7
        },
        "duration" => %{
          "type" => "number",
          "required" => true,
          "default" => 10,
          "description" => "Duration in seconds to display the QR code",
          "min" => 1,
          "max" => 300,
          "order" => 8
        }
      }
    }

    %Widget{is_system: true}
    |> Widget.changeset(widget_attrs)
    |> Repo.insert!()
  end

  def down do
    Repo.delete_all(from(w in Widget, where: w.slug == "qr-code"))
  end
end

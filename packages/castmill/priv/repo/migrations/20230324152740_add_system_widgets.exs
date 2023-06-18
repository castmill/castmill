defmodule Castmill.Repo.Migrations.AddDefaultWidgets do
  use Ecto.Migration

  # Add default, system-wide widgets
  def change do
    for attrs <- [
          %{
            name: "image",
            template: %{
              "type" => "image",
              "name" => "image",
              "opts" => %{
                "url" => "${data.media.url}",
                "autozoom" => "${options.autozoom}",
                "duration" => "${options.duration}"
              }
            },
            options_schema: %{
              "media_id" => %{"type" => "ref", "required" => true, "collection" => "medias"},
              "autozoom" => "string",
              "duration" => "number"
            },
            data_schema: %{
              "media" => %{
                "type" => "map",
                "schema" => %{
                  "id" => "string",
                  "url" => "string",
                  "preview_url" => "string",
                  "mimetype" => "string"
                },
                "required" => true
              }
            },
            webhook_url: "widgets/image"
          },
          %{
            name: "video",
            template: %{
              "type" => "video",
              "name" => "video",
              "opts" => %{
                "url" => "${data.media.url}"
              }
            },
            options_schema: %{
              "media_id" => %{"type" => "ref", "required" => true, "collection" => "medias"}
            },
            data_schema: %{
              "media" => %{
                "type" => "map",
                "schema" => %{
                  "id" => "string",
                  "url" => "string",
                  "preview_url" => "string",
                  "mimetype" => "string"
                },
                "required" => true
              }
            },
            webhook_url: "widgets/video"
          },
          %{
            name: "layout",
            template: %{
              "type" => "group",
              "name" => "layout",
              "style" => %{
                "background" => "${options.background}",
                "color" => "${options.color}"
              },
              # The number of components here would be dynamic, based on the data.
              # we can also have different widgets, one per number of sections, for example
              # layout_1, layout_2, layout_3, layout_4, etc.
              components: []
            },
            options_schema: %{
              "sections" => %{
                "type" => "list",
                "schema" => %{
                  "playlist_id" => %{
                    "type" => "ref",
                    "required" => true,
                    "collection" => "playlists"
                  },
                  "rect" => %{
                    "type" => "map",
                    "schema" => %{
                      "x" => "number",
                      "y" => "number",
                      "w" => "number",
                      "h" => "number"
                    }
                  }
                }
              }
            },
            # data_schema:
            #  %{
                # This is tricky as the data would be a playlist, we would probably need to support
                # playlists as a primitive type, in that case data would not even be needed.
            # }
            webhook_url: "widgets/layout"
          },
          %{
            name: "weather",
            template: %{
              "type" => "group",
              "name" => "weather",
              "style" => %{
                "background" => "${options.background}",
                "color" => "${options.color}"
              },
              components: []
            },
            options_schema: %{
              "lat" => "number",
              "long" => "number"
            },
            data_schema: %{
              "icons" => %{
                "type" => "list",
                "schema" => %{
                  "id" => "string",
                  "url" => "string"
                }
              },
              "days" => %{
                "type" => "list",
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
          %{
            name: "web",
            template: %{
              "type" => "web",
              "name" => "web",
              "opts" => %{
                "url" => "${options.url}"
              }
            },
            options_schema: %{
              "url" => "string"
            }
          }
        ] do
      %Castmill.Widgets.Widget{is_system: true}
      |> Castmill.Widgets.Widget.changeset(attrs)
      |> Castmill.Repo.insert!()
    end
  end
end

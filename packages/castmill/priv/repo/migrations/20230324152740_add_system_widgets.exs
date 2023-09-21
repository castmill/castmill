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
                "url" => %{"key" => "options.image.files[@target].uri"},
                "autozoom" => %{"key" => "options.autozoom"},
                "duration" => %{"key" => "options.duration"}
              }
            },
            options_schema: %{
              "image" => %{
                "type" => "ref",
                "required" => true,
                "collection" => "medias|type:image"
              },
              "autozoom" => "string",
              "duration" => "number"
            },
            data_schema: %{
              "image" => %{
                "type" => "map",
                "schema" => %{
                  "id" => "string",
                  "url" => "string",
                  "preview_url" => "string",
                  "mimetype" => "string"
                },
                "required" => true
              }
            }
          },
          %{
            name: "video",
            template: %{
              "type" => "video",
              "name" => "video",
              "opts" => %{
                "url" => %{"key" => "options.video.files[@target].uri"}
              }
            },
            options_schema: %{
              "video" => %{
                "type" => "ref",
                "required" => true,
                "collection" => "medias|type:video"
              }
            },
            data_schema: %{
              "video" => %{
                "type" => "map",
                "schema" => %{
                  "id" => "string",
                  "url" => "string",
                  "preview_url" => "string",
                  "mimetype" => "string"
                },
                "required" => true
              }
            }
          },
          %{
            name: "layout-portrait-3",
            aspect_ratio: "9:16",
            template: %{
              "type" => "layout",
              "name" => "layout",
              "style" => %{
                "background" => %{"key" => "options.background"},
                "color" => %{"key" => "options.color"}
              },
              "opts" => %{
                "containers" => [
                  %{
                    "playlist" => %{"key" => "options.playlists[0]"},
                    "rect" => %{
                      "width" => "100%",
                      "height" => "33%",
                      "top" => "0%",
                      "left" => "0%"
                    }
                  },
                  %{
                    "playlist" => %{"key" => "options.playlists[1]"},
                    "rect" => %{
                      "width" => "100%",
                      "height" => "33%",
                      "top" => "33%",
                      "left" => "0%"
                    }
                  },
                  %{
                    "playlist" => %{"key" => "options.playlists[2]"},
                    "rect" => %{
                      "width" => "100%",
                      "height" => "33%",
                      "top" => "66%",
                      "left" => "0%"
                    }
                  }
                ]
              }
            },
            options_schema: %{
              "background" => "string",
              "color" => "string",
              "playlists" => %{
                # "list|3" means a list of exact 3 items
                "type" => "list",
                "items" => %{
                  "type" => "ref",
                  "required" => true,
                  "collection" => "playlists"
                }
              }
            }
          },
          %{
            name: "weather",
            template: %{
              "type" => "group",
              "name" => "weather",
              "style" => %{
                "background" => %{"key" => "options.background"},
                "color" => %{"key" => "options.color"}
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
                "items" => %{
                  "type" => "map",
                  "schema" => %{
                    "id" => "string",
                    "url" => "string"
                  }
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
            webhook_url: "widgets/weather"
          },
          %{
            name: "web",
            template: %{
              "type" => "web",
              "name" => "web",
              "opts" => %{
                "url" => %{"key" => "options.url"}
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

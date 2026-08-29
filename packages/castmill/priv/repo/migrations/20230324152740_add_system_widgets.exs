defmodule Castmill.Repo.Migrations.AddDefaultWidgets do
  use Ecto.Migration

  # Add default, system-wide widgets
  def change do
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    widgets =
      for attrs <- [
            %{
              name: "Image",
              description: "Display an image.",
              slug: "image",
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
                "autozoom" => "boolean",
                "duration" => %{
                  "type" => "number",
                  "required" => true,
                  "default" => 10,
                  "description" => "The duration in seconds to display the image",
                  "min" => 1,
                  "max" => 60
                }
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
              name: "Video",
              description: "Display a video.",
              slug: "video",
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
              name: "Layout Portrait 3",
              description: "Display 3 playlists in a portrait layout.",
              slug: "layout-portrait-3",
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
                "background" => "color",
                "playlists" => %{
                  # "list|3" means a list of exact 3 items, maybe introduce tuple type?
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
              name: "Weather",
              description: "Display weather information.",
              slug: "weather",
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
              name: "Web",
              description: "Displays the content of a web page.",
              slug: "web",
              template: %{
                "type" => "web",
                "name" => "web",
                "opts" => %{
                  "url" => %{"key" => "options.url"}
                }
              },
              options_schema: %{
                "url" => %{
                  "type" => "url",
                  "required" => true,
                  "placeholder" => "https://example.com",
                  "description" => "The URL to be used by the widget"
                }
              }
            }
          ] do
        Map.merge(attrs, %{
          is_system: true,
          update_interval_seconds: Map.get(attrs, :update_interval_seconds, 60),
          assets: %{},
          fonts: [],
          inserted_at: now,
          updated_at: now
        })
      end

    repo().insert_all("widgets", widgets)
  end
end

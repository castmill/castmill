defmodule Castmill.Repo.Migrations.AddRssNewsWidget do
  use Ecto.Migration
  import Ecto.Query, only: [from: 2]

  @widget_slug "rss-news"
  @widget_name "RSS News"

  def up do
    widget_slug = @widget_slug
    widget_name = @widget_name

    template = build_template()
    options_schema = build_options_schema()
    data_schema = build_data_schema()

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Insert the widget
    execute(fn ->
      repo().insert_all("widgets", [
        %{
          slug: widget_slug,
          name: widget_name,
          template: template,
          options_schema: options_schema,
          data_schema: data_schema,
          is_system: true,
          inserted_at: now,
          updated_at: now
        }
      ])
    end)
  end

  def down do
    widget_slug = @widget_slug

    execute(fn ->
      # Delete the widget by slug
      widget_delete_query = from(w in "widgets", where: w.slug == ^widget_slug)
      repo().delete_all(widget_delete_query)
    end)
  end

  defp build_template do
    %{
      "opts" => %{"style" => %{"width" => "100%", "height" => "100%"}},
      "type" => "group",
      "name" => "rss-news-container",
      "children" => [
        %{
          "opts" => %{
            "class" => %{"v" => "paginated-list-container"},
            "data" => %{"type" => "ctx", "key" => "items"},
            "page_size" => %{"type" => "opt", "key" => "max_items"},
            "page_duration" => %{"type" => "opt", "key" => "page_duration"},
            "style" => %{
              "display" => "flex",
              "flex-direction" => "column",
              "width" => "100%",
              "height" => %{
                "type" => "condition",
                "if" => %{
                  "type" => "comparison",
                  "left" => %{"type" => "opt", "key" => "show_ticker"},
                  "operator" => "==",
                  "right" => true
                },
                "then" => "calc(100% - 3em)",
                "else" => "100%"
              },
              "overflow" => "hidden",
              "background-color" => %{"type" => "opt", "key" => "bg_color"},
              "box-sizing" => "border-box",
              "padding" => "0.5em"
            },
            "transition" => %{
              "type" => %{"type" => "opt", "key" => "transition_type"},
              "duration" => %{"type" => "opt", "key" => "transition_duration"},
              "easing" => %{"type" => "opt", "key" => "transition_easing"}
            }
          },
          "type" => "paginated-list",
          "name" => "news-list",
          "item_template" => build_news_card()
        },
        %{
          "opts" => %{
            "filter" => %{
              "type" => "condition",
              "if" => %{
                "type" => "comparison",
                "left" => %{"type" => "opt", "key" => "show_ticker"},
                "operator" => "==",
                "right" => true
              },
              "then" => false,
              "else" => true
            },
            "class" => %{"v" => "ticker-bar"},
            "style" => %{
              "display" => "flex",
              "flex-direction" => "row",
              "align-items" => "center",
              "width" => "100%",
              "height" => "3em",
              "background-color" => %{"type" => "opt", "key" => "ticker_bg_color"},
              "overflow" => "hidden",
              "flex-shrink" => "0"
            }
          },
          "type" => "group",
          "name" => "ticker-bar",
          "children" => [
            %{
              "opts" => %{
                "class" => %{"v" => "ticker-label"},
                "text" => %{"type" => "opt", "key" => "ticker_label"},
                "style" => %{
                  "display" => "flex",
                  "align-items" => "center",
                  "justify-content" => "center",
                  "height" => "100%",
                  "padding" => "0 1em",
                  "background-color" => %{"type" => "opt", "key" => "ticker_label_bg_color"},
                  "color" => %{"type" => "opt", "key" => "ticker_label_color"},
                  "font-weight" => "bold",
                  "font-size" => "1.2em",
                  "white-space" => "nowrap",
                  "flex-shrink" => "0",
                  "z-index" => "1"
                }
              },
              "type" => "text",
              "name" => "ticker-label"
            },
            %{
              "opts" => %{
                "class" => %{"v" => "ticker-scroller"},
                "data" => %{"type" => "ctx", "key" => "items"},
                "speed" => %{"type" => "opt", "key" => "ticker_speed"},
                "separator" => %{"type" => "opt", "key" => "ticker_separator"},
                "style" => %{
                  "flex" => "1",
                  "height" => "100%",
                  "overflow" => "hidden",
                  "color" => %{"type" => "opt", "key" => "ticker_text_color"},
                  "font-size" => "1.2em"
                }
              },
              "type" => "scroller",
              "name" => "ticker-scroller",
              "item_template" => %{
                "opts" => %{
                  "text" => %{"type" => "item", "key" => "title"},
                  "style" => %{"white-space" => "nowrap"}
                },
                "type" => "text",
                "name" => "ticker-item"
              }
            }
          ]
        }
      ]
    }
  end

  defp build_news_card do
    %{
      "opts" => %{
        "class" => %{"v" => "news-card"},
        "style" => %{
          "display" => "flex",
          "flex-direction" => %{"type" => "opt", "key" => "card_layout"},
          "width" => "100%",
          "height" => "100%",
          "gap" => "1em",
          "box-sizing" => "border-box",
          "padding" => "0.5em",
          "overflow" => "hidden"
        }
      },
      "type" => "group",
      "name" => "news-card",
      "children" => [
        %{
          "opts" => %{
            "filter" => %{
              "type" => "condition",
              "if" => %{
                "type" => "comparison",
                "left" => %{"type" => "opt", "key" => "show_image"},
                "operator" => "==",
                "right" => true
              },
              "then" => false,
              "else" => true
            },
            "class" => %{"v" => "news-image-container"},
            "style" => %{
              "width" => %{"type" => "opt", "key" => "image_width"},
              "height" => "100%",
              "flex-shrink" => "0",
              "overflow" => "hidden",
              "border-radius" => "0.25em"
            }
          },
          "type" => "group",
          "name" => "news-image-container",
          "children" => [
            %{
              "opts" => %{
                "src" => %{
                  "type" => "coalesce",
                  "values" => [
                    %{"type" => "item", "key" => "image"},
                    %{"type" => "opt", "key" => "fallback_image"}
                  ]
                },
                "style" => %{
                  "width" => "100%",
                  "height" => "100%",
                  "object-fit" => "cover"
                }
              },
              "type" => "image",
              "name" => "news-image"
            }
          ]
        },
        %{
          "opts" => %{
            "class" => %{"v" => "news-content"},
            "style" => %{
              "display" => "flex",
              "flex-direction" => "column",
              "flex" => "1",
              "gap" => "0.3em",
              "overflow" => "hidden",
              "min-width" => "0"
            }
          },
          "type" => "group",
          "name" => "news-content",
          "children" => [
            %{
              "opts" => %{
                "class" => %{"v" => "news-title"},
                "text" => %{"type" => "item", "key" => "title"},
                "autofit" => %{
                  "mode" => "height",
                  "min" => 0.5,
                  "max" => 2.0
                },
                "style" => %{
                  "color" => %{"type" => "opt", "key" => "title_color"},
                  "font-size" => "1.5em",
                  "font-weight" => "bold",
                  "line-height" => "1.2",
                  "overflow" => "hidden",
                  "display" => "-webkit-box",
                  "-webkit-line-clamp" => "3",
                  "-webkit-box-orient" => "vertical",
                  "flex-shrink" => "0",
                  "max-height" => "30%",
                  "height" => "auto"
                }
              },
              "type" => "text",
              "name" => "news-title"
            },
            %{
              "opts" => %{
                "class" => %{"v" => "news-description"},
                "text" => %{"type" => "item", "key" => "description"},
                "autofit" => %{
                  "mode" => "height",
                  "min" => 0.5,
                  "max" => 1.5
                },
                "style" => %{
                  "flex" => "1",
                  "color" => %{"type" => "opt", "key" => "description_color"},
                  "font-size" => "1em",
                  "line-height" => "1.4",
                  "overflow" => "hidden",
                  "display" => "-webkit-box",
                  "-webkit-box-orient" => "vertical",
                  "min-height" => "0",
                  "height" => "auto"
                }
              },
              "type" => "text",
              "name" => "news-description"
            },
            %{
              "opts" => %{
                "filter" => %{
                  "type" => "condition",
                  "if" => %{
                    "type" => "comparison",
                    "left" => %{"type" => "opt", "key" => "show_source"},
                    "operator" => "==",
                    "right" => true
                  },
                  "then" => false,
                  "else" => true
                },
                "class" => %{"v" => "news-source"},
                "text" => %{"type" => "item", "key" => "source"},
                "style" => %{
                  "color" => %{"type" => "opt", "key" => "source_color"},
                  "font-size" => "0.8em",
                  "font-style" => "italic",
                  "flex-shrink" => "0",
                  "height" => "auto"
                }
              },
              "type" => "text",
              "name" => "news-source"
            }
          ]
        }
      ]
    }
  end

  defp build_options_schema do
    %{
      "type" => "object",
      "properties" => %{
        "max_items" => %{
          "type" => "integer",
          "title" => "Max Items Per Page",
          "description" => "Maximum number of news items to display per page",
          "default" => 3,
          "minimum" => 1,
          "maximum" => 10
        },
        "page_duration" => %{
          "type" => "integer",
          "title" => "Page Duration (seconds)",
          "description" => "How long to show each page before transitioning",
          "default" => 10,
          "minimum" => 3,
          "maximum" => 60
        },
        "card_layout" => %{
          "type" => "string",
          "title" => "Card Layout",
          "description" => "Layout direction for news cards",
          "enum" => ["row", "row-reverse", "column", "column-reverse"],
          "default" => "row"
        },
        "transition_type" => %{
          "type" => "string",
          "title" => "Page Transition",
          "description" => "Animation type between pages",
          "enum" => ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "none"],
          "default" => "fade"
        },
        "transition_duration" => %{
          "type" => "number",
          "title" => "Transition Duration (seconds)",
          "description" => "Duration of page transition animation",
          "default" => 0.5,
          "minimum" => 0.1,
          "maximum" => 2.0
        },
        "transition_easing" => %{
          "type" => "string",
          "title" => "Transition Easing",
          "description" => "Easing function for transitions",
          "enum" => ["ease", "ease-in", "ease-out", "ease-in-out", "linear"],
          "default" => "ease-in-out"
        },
        "show_image" => %{
          "type" => "boolean",
          "title" => "Show Image",
          "description" => "Whether to display the news image",
          "default" => true
        },
        "image_width" => %{
          "type" => "string",
          "title" => "Image Width",
          "description" => "Width of the news image",
          "default" => "40%"
        },
        "fallback_image" => %{
          "type" => "ref",
          "title" => "Fallback Image",
          "description" => "Image to show when no image is available in the feed",
          "collection" => "medias|type:image"
        },
        "show_source" => %{
          "type" => "boolean",
          "title" => "Show Source",
          "description" => "Whether to display the news source",
          "default" => true
        },
        "bg_color" => %{
          "type" => "color",
          "title" => "Background Color",
          "description" => "Background color of the widget",
          "default" => "#1a1a2e"
        },
        "title_color" => %{
          "type" => "color",
          "title" => "Title Color",
          "description" => "Color of the news title",
          "default" => "#ffffff"
        },
        "description_color" => %{
          "type" => "color",
          "title" => "Description Color",
          "description" => "Color of the news description",
          "default" => "#cccccc"
        },
        "source_color" => %{
          "type" => "color",
          "title" => "Source Color",
          "description" => "Color of the news source text",
          "default" => "#888888"
        },
        "show_ticker" => %{
          "type" => "boolean",
          "title" => "Show News Ticker",
          "description" => "Display a scrolling news ticker at the bottom",
          "default" => false
        },
        "ticker_speed" => %{
          "type" => "number",
          "title" => "Ticker Speed",
          "description" => "Speed of the ticker scroll (pixels per second)",
          "default" => 100,
          "minimum" => 20,
          "maximum" => 500
        },
        "ticker_separator" => %{
          "type" => "string",
          "title" => "Ticker Separator",
          "description" => "Text separator between ticker items",
          "default" => " • "
        },
        "ticker_label" => %{
          "type" => "string",
          "title" => "Ticker Label",
          "description" => "Label text shown at the start of the ticker",
          "default" => "BREAKING"
        },
        "ticker_bg_color" => %{
          "type" => "color",
          "title" => "Ticker Background Color",
          "description" => "Background color of the ticker bar",
          "default" => "#cc0000"
        },
        "ticker_text_color" => %{
          "type" => "color",
          "title" => "Ticker Text Color",
          "description" => "Color of the scrolling ticker text",
          "default" => "#ffffff"
        },
        "ticker_label_bg_color" => %{
          "type" => "color",
          "title" => "Ticker Label Background",
          "description" => "Background color of the ticker label",
          "default" => "#ff0000"
        },
        "ticker_label_color" => %{
          "type" => "color",
          "title" => "Ticker Label Color",
          "description" => "Text color of the ticker label",
          "default" => "#ffffff"
        }
      }
    }
  end

  defp build_data_schema do
    %{
      "type" => "object",
      "properties" => %{
        "items" => %{
          "type" => "array",
          "items" => %{
            "type" => "object",
            "properties" => %{
              "title" => %{"type" => "string"},
              "description" => %{"type" => "string"},
              "image" => %{"type" => "string"},
              "source" => %{"type" => "string"},
              "link" => %{"type" => "string"},
              "pubDate" => %{"type" => "string"}
            }
          }
        }
      }
    }
  end
end

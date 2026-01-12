defmodule Castmill.Repo.Migrations.AddStockTickerWidget do
  @moduledoc """
  Adds the Stock Ticker widget with Finnhub integration.

  This widget displays a continuously scrolling ticker of stock quotes,
  showing symbol, price, and price change with conditional color styling
  (green for gains, red for losses).

  ## Features

  - Real-time stock quotes from Finnhub API
  - Smooth horizontal scrolling using the Scroller component
  - Conditional styling: green for positive changes, red for negative
  - Customizable symbols list
  - Adjustable scroll speed and appearance
  - Organization-wide credential sharing
  - Resolution-independent sizing using vh/vw units

  ## Data Flow

  1. User configures widget with stock symbols
  2. Backend fetches quotes from Finnhub every 30 seconds
  3. Data is cached and served to players
  4. Player renders scrolling ticker with live updates
  """
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  def up do
    # Insert the Stock Ticker widget
    widget_attrs = %{
      name: "Stock Ticker",
      slug: "stock-ticker",
      description:
        "Displays a scrolling ticker of real-time stock quotes with price changes. " <>
          "Supports multiple symbols with automatic color-coding for gains (green) and losses (red).",
      icon: "/widgets/stock-ticker/icon.svg",
      small_icon: "/widgets/stock-ticker/icon-small.svg",
      # No aspect ratio - ticker fills available space and scales based on viewport height
      aspect_ratio: nil,
      is_system: true,
      template: build_template(),
      options_schema: build_options_schema(),
      data_schema: build_data_schema()
    }

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Insert widget
    {:ok, widget} =
      %Widget{is_system: true}
      |> Widget.changeset(widget_attrs)
      |> Ecto.Changeset.put_change(:inserted_at, now)
      |> Ecto.Changeset.put_change(:updated_at, now)
      |> Repo.insert()

    # Insert the Finnhub integration for this widget
    integration_attrs = %{
      widget_id: widget.id,
      name: "finnhub",
      description: "Finnhub Stock API integration for real-time quotes",
      integration_type: "pull",
      credential_scope: "organization",
      pull_endpoint: "https://finnhub.io/api/v1/quote",
      pull_interval_seconds: 30,
      pull_config: %{
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Finnhub",
        "batch_symbols" => true,
        "rate_limit_per_minute" => 60
      },
      credential_schema: %{
        "auth_type" => "api_key",
        "fields" => %{
          "api_key" => %{
            "type" => "string",
            "required" => true,
            "label" => "Finnhub API Key",
            "description" => "Your Finnhub API key. Get one free at https://finnhub.io/register",
            "sensitive" => true,
            "input_type" => "password"
          }
        }
      },
      is_active: true,
      # Widget option discriminator: widgets with same symbols share cached data
      discriminator_type: "widget_option",
      discriminator_key: "symbols"
    }

    %WidgetIntegration{}
    |> WidgetIntegration.changeset(integration_attrs)
    |> Ecto.Changeset.put_change(:inserted_at, now)
    |> Ecto.Changeset.put_change(:updated_at, now)
    |> Repo.insert!()
  end

  def down do
    # Get the widget by slug
    widget =
      from(w in Widget, where: w.slug == "stock-ticker")
      |> Repo.one()

    if widget do
      # Delete integration first (foreign key constraint)
      from(i in WidgetIntegration, where: i.widget_id == ^widget.id)
      |> Repo.delete_all()

      # Delete the widget
      Repo.delete(widget)
    end
  end

  # ============================================================================
  # TEMPLATE BUILDER
  # ============================================================================

  defp build_template do
    %{
      "type" => "group",
      "name" => "stock-ticker-widget",
      "style" => %{
        "width" => "100%",
        "height" => "100%",
        "display" => "flex",
        "flex-direction" => "column",
        "background" => %{"key" => "options.background"},
        "overflow" => "hidden"
      },
      "components" => [
        # Main scrolling ticker (takes full height)
        %{
          "type" => "scroller",
          "name" => "ticker-scroller",
          "opts" => %{
            "items" => %{"key" => "data.quotes"},
            "direction" => %{"key" => "options.scroll_direction", "default" => "left"},
            "speed" => %{"key" => "options.scroll_speed", "default" => 100},
            # Gap in em units (relative to font-size, which uses vh)
            "gap" => %{"concat" => [%{"key" => "options.item_gap", "default" => 1}, "em"]}
          },
          "style" => %{
            # Height fills container, font-size controls proportional scaling
            "height" => "100%",
            "width" => "100%",
            "font-size" => %{
              "concat" => [%{"key" => "options.ticker_height", "default" => 5}, "vh"]
            },
            "display" => "flex",
            "align-items" => "center"
          },
          # Template for each stock item
          "component" => %{
            "type" => "group",
            "name" => "stock-item",
            "style" => %{
              "display" => "flex",
              "align-items" => "baseline",
              "gap" => "0.25em",
              "padding" => "0.15em 0.3em",
              "background" => %{"key" => "options.item_background"},
              "border-radius" => "0.3em"
            },
            "components" => [
              # Stock symbol
              %{
                "type" => "text",
                "name" => "symbol",
                "opts" => %{
                  "text" => %{"key" => "$.symbol"}
                },
                "style" => %{
                  "font-size" => "0.85em",
                  "font-weight" => "700",
                  "color" => %{"key" => "options.symbol_color"}
                }
              },
              # Current price
              %{
                "type" => "text",
                "name" => "price",
                "opts" => %{
                  "text" => %{"key" => "$.priceFormatted"}
                },
                "style" => %{
                  "font-size" => "0.75em",
                  "font-weight" => "600",
                  "color" => %{"key" => "options.price_color"},
                  "font-variant-numeric" => "tabular-nums"
                }
              },
              # Change indicator (amount and percentage)
              %{
                "type" => "group",
                "name" => "change-group",
                "style" => %{
                  "display" => "flex",
                  "align-items" => "baseline",
                  "gap" => "0.25em"
                },
                "components" => [
                  # Change arrow indicator
                  %{
                    "type" => "text",
                    "name" => "change-arrow",
                    "opts" => %{
                      "text" => %{"key" => "$.changeArrow"}
                    },
                    "style" => %{
                      "font-size" => "0.65em",
                      "color" => %{
                        "switch" => %{
                          "key" => "$.changeDirection",
                          "cases" => %{
                            "up" => %{"key" => "options.positive_color", "default" => "#00C853"},
                            "down" => %{"key" => "options.negative_color", "default" => "#FF1744"},
                            "default" => %{
                              "key" => "options.neutral_color",
                              "default" => "#9E9E9E"
                            }
                          }
                        }
                      }
                    }
                  },
                  # Change amount
                  %{
                    "type" => "text",
                    "name" => "change-amount",
                    "opts" => %{
                      "text" => %{"key" => "$.changeFormatted"}
                    },
                    "style" => %{
                      "font-size" => "0.65em",
                      "font-weight" => "500",
                      "color" => %{
                        "switch" => %{
                          "key" => "$.changeDirection",
                          "cases" => %{
                            "up" => %{"key" => "options.positive_color", "default" => "#00C853"},
                            "down" => %{"key" => "options.negative_color", "default" => "#FF1744"},
                            "default" => %{
                              "key" => "options.neutral_color",
                              "default" => "#9E9E9E"
                            }
                          }
                        }
                      },
                      "font-variant-numeric" => "tabular-nums"
                    }
                  },
                  # Change percentage
                  %{
                    "type" => "text",
                    "name" => "change-percent",
                    "opts" => %{
                      "text" => %{"key" => "$.changePercentFormatted"}
                    },
                    "style" => %{
                      "font-size" => "0.65em",
                      "font-weight" => "500",
                      "color" => %{
                        "switch" => %{
                          "key" => "$.changeDirection",
                          "cases" => %{
                            "up" => %{"key" => "options.positive_color", "default" => "#00C853"},
                            "down" => %{"key" => "options.negative_color", "default" => "#FF1744"},
                            "default" => %{
                              "key" => "options.neutral_color",
                              "default" => "#9E9E9E"
                            }
                          }
                        }
                      },
                      "font-variant-numeric" => "tabular-nums"
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  end

  # ============================================================================
  # OPTIONS SCHEMA
  # ============================================================================

  defp build_options_schema do
    %{
      # Data Configuration (order 1)
      "symbols" => %{
        "type" => "string",
        "required" => true,
        "default" => "AAPL,GOOGL,MSFT,AMZN,TSLA",
        "placeholder" => "AAPL,GOOGL,MSFT",
        "description" => "Comma-separated list of stock symbols (e.g., AAPL,GOOGL,MSFT)",
        "order" => 1
      },

      # Size & Layout (order 2-3)
      "ticker_height" => %{
        "type" => "number",
        "required" => false,
        "default" => 5,
        "min" => 2,
        "max" => 20,
        "description" => "Ticker height in viewport height units (vh)",
        "order" => 2
      },
      "item_gap" => %{
        "type" => "number",
        "required" => false,
        "default" => 1,
        "min" => 1,
        "max" => 10,
        "description" => "Gap between stock items in em units",
        "order" => 3
      },

      # Scroll Behavior (order 4-5)
      "scroll_speed" => %{
        "type" => "number",
        "required" => false,
        "default" => 100,
        "min" => 20,
        "max" => 500,
        "description" => "Scroll speed (pixels/second). Higher = faster.",
        "order" => 4
      },
      "scroll_direction" => %{
        "type" => "string",
        "required" => false,
        "default" => "left",
        "description" => "Scroll direction",
        "enum" => ["left", "right"],
        "order" => 5
      },

      # Background Colors (order 6-7)
      "background" => %{
        "type" => "color",
        "required" => false,
        "default" => "#1a1a2e",
        "description" => "Widget background color",
        "order" => 6
      },
      "item_background" => %{
        "type" => "color",
        "required" => false,
        "default" => "#2a2a3e",
        "description" => "Stock item card background color",
        "order" => 7
      },

      # Text Colors (order 8-9)
      "symbol_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#ffffff",
        "description" => "Stock symbol text color",
        "order" => 8
      },
      "price_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#ffffff",
        "description" => "Price text color",
        "order" => 9
      },

      # Change Indicator Colors (order 10-12)
      "positive_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#00C853",
        "description" => "Positive change color (green)",
        "order" => 10
      },
      "negative_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#FF1744",
        "description" => "Negative change color (red)",
        "order" => 11
      },
      "neutral_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#9E9E9E",
        "description" => "No change color (gray)",
        "order" => 12
      }
    }
  end

  # ============================================================================
  # DATA SCHEMA
  # ============================================================================

  defp build_data_schema do
    %{
      "quotes" => %{
        "type" => "list",
        "default" => [
          %{
            "symbol" => "AAPL",
            "price" => 178.50,
            "priceFormatted" => "$178.50",
            "change" => 2.35,
            "changeFormatted" => "+2.35",
            "changePercent" => 1.33,
            "changePercentFormatted" => "+1.33%",
            "changeDirection" => "up",
            "changeArrow" => "↑",
            "open" => 176.15,
            "high" => 179.20,
            "low" => 175.80,
            "previousClose" => 176.15
          },
          %{
            "symbol" => "GOOGL",
            "price" => 141.25,
            "priceFormatted" => "$141.25",
            "change" => -1.50,
            "changeFormatted" => "-1.50",
            "changePercent" => -1.05,
            "changePercentFormatted" => "-1.05%",
            "changeDirection" => "down",
            "changeArrow" => "↓",
            "open" => 142.75,
            "high" => 143.10,
            "low" => 140.90,
            "previousClose" => 142.75
          },
          %{
            "symbol" => "MSFT",
            "price" => 378.90,
            "priceFormatted" => "$378.90",
            "change" => 5.20,
            "changeFormatted" => "+5.20",
            "changePercent" => 1.39,
            "changePercentFormatted" => "+1.39%",
            "changeDirection" => "up",
            "changeArrow" => "↑",
            "open" => 373.70,
            "high" => 380.15,
            "low" => 372.50,
            "previousClose" => 373.70
          },
          %{
            "symbol" => "AMZN",
            "price" => 185.75,
            "priceFormatted" => "$185.75",
            "change" => 3.25,
            "changeFormatted" => "+3.25",
            "changePercent" => 1.78,
            "changePercentFormatted" => "+1.78%",
            "changeDirection" => "up",
            "changeArrow" => "↑",
            "open" => 182.50,
            "high" => 186.90,
            "low" => 181.75,
            "previousClose" => 182.50
          },
          %{
            "symbol" => "TSLA",
            "price" => 252.30,
            "priceFormatted" => "$252.30",
            "change" => -4.70,
            "changeFormatted" => "-4.70",
            "changePercent" => -1.83,
            "changePercentFormatted" => "-1.83%",
            "changeDirection" => "down",
            "changeArrow" => "↓",
            "open" => 257.00,
            "high" => 258.45,
            "low" => 250.10,
            "previousClose" => 257.00
          }
        ],
        "items" => %{
          "type" => "map",
          "schema" => %{
            "symbol" => "string",
            "price" => "number",
            "priceFormatted" => "string",
            "change" => "number",
            "changeFormatted" => "string",
            "changePercent" => "number",
            "changePercentFormatted" => "string",
            "changeDirection" => "string",
            "changeArrow" => "string",
            "high" => "number",
            "low" => "number",
            "open" => "number",
            "previousClose" => "number"
          }
        }
      },
      "lastUpdated" => %{
        "type" => "number",
        "default" => 0
      },
      "marketStatus" => %{
        "type" => "string",
        "default" => "closed"
      }
    }
  end
end

defmodule Castmill.Repo.Migrations.AddSpotifyNowPlayingWidget do
  use Ecto.Migration

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  def change do
    # Insert the Spotify Now Playing widget
    widget_attrs = %{
      name: "Spotify Now Playing",
      slug: "spotify-now-playing",
      description:
        "Displays the currently playing track from a Spotify account with album artwork, track information, and playback progress.",
      icon: "/widgets/spotify-now-playing/icon.svg",
      small_icon: "/widgets/spotify-now-playing/icon-small.svg",
      is_system: true,
      template: %{
        "type" => "group",
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "display" => "flex",
          "flex-direction" => "row",
          "align-items" => "center",
          "justify-content" => "flex-start",
          "background" => "linear-gradient(135deg, #1DB954 0%, #191414 100%)",
          "padding-left" => "1.5em",
          "font-family" => "'Circular Std', sans-serif"
        },
        "components" => [
          # Album artwork
          %{
            "type" => "image",
            "opts" => %{
              "url" => %{
                "key" => "data.album_art_url",
                "default" => "https://placehold.co/400x400/1DB954/FFFFFF/png?text=Now+Playing"
              },
              "size" => "cover"
            },
            "style" => %{
              "width" => "45%",
              "height" => "80%",
              "border-radius" => "0.3em",
              "box-shadow" => "0 1em 3em rgba(0,0,0,0.5)"
            }
          },
          # Track info section
          %{
            "type" => "group",
            "style" => %{
              "margin-left" => "1em",
              "display" => "flex",
              "color" => "#FFFFFF",
              "flex-direction" => "column",
              "width" => "40%"
            },
            "components" => [
              # Spotify logo + "Now Playing" row
              %{
                "type" => "group",
                "style" => %{
                  "display" => "flex",
                  "flex-direction" => "row",
                  "align-items" => "center",
                  "margin-bottom" => "0.8em"
                },
                "components" => [
                  %{
                    "type" => "image",
                    "opts" => %{
                      "url" =>
                        "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_White.png",
                      "size" => "contain"
                    },
                    "style" => %{
                      "width" => "5em",
                      "height" => "1.5em",
                      "margin-right" => "0.6em",
                      "opacity" => "0.85"
                    }
                  },
                  %{
                    "type" => "text",
                    "opts" => %{"text" => "NOW PLAYING"},
                    "style" => %{
                      "font-size" => "0.7em",
                      "font-weight" => "600",
                      "letter-spacing" => "0.2em",
                      "opacity" => "0.7",
                      "text-transform" => "uppercase"
                    }
                  }
                ]
              },
              # Track name
              %{
                "type" => "text",
                "opts" => %{
                  "text" => %{
                    "key" => "data.track_name",
                    "default" => "Song Title"
                  }
                },
                "style" => %{
                  "font-size" => "1.4em",
                  "font-weight" => "900",
                  "margin-bottom" => "0.2em",
                  "text-shadow" => "0 0.3em 1em rgba(0, 0, 0, 0.3)"
                }
              },
              # Artist name
              %{
                "type" => "text",
                "opts" => %{
                  "text" => %{
                    "key" => "data.artist_name",
                    "default" => "Artist Name"
                  }
                },
                "style" => %{
                  "font-size" => "1.2em",
                  "font-weight" => "500",
                  "margin-bottom" => "0.2em",
                  "opacity" => "0.9"
                }
              },
              # Album name
              %{
                "type" => "text",
                "opts" => %{
                  "text" => %{
                    "key" => "data.album_name",
                    "default" => "Album Name"
                  }
                },
                "style" => %{
                  "font-size" => "1em",
                  "font-weight" => "300",
                  "opacity" => "0.7",
                  "margin-bottom" => "3em"
                }
              },
              # Progress bar section
              %{
                "type" => "group",
                "style" => %{
                  "display" => "flex",
                  "flex-direction" => "row",
                  "align-items" => "center",
                  "margin-top" => "1em"
                },
                "components" => [
                  %{
                    "type" => "text",
                    "opts" => %{
                      "text" => %{
                        "key" => "data.progress_formatted",
                        "default" => "0:00"
                      }
                    },
                    "style" => %{
                      "font-size" => "1.5em",
                      "font-weight" => "500",
                      "margin-right" => "1.3em",
                      "font-variant-numeric" => "tabular-nums"
                    }
                  },
                  %{
                    "type" => "group",
                    "style" => %{
                      "flex" => "1",
                      "height" => "0.5em",
                      "background" => "rgba(255,255,255,0.2)",
                      "border-radius" => "0.25em",
                      "position" => "relative",
                      "overflow" => "hidden"
                    },
                    "components" => [
                      %{
                        "type" => "group",
                        "style" => %{
                          "position" => "absolute",
                          "left" => "0",
                          "top" => "0",
                          "width" => %{
                            "key" => "data.progress_percent",
                            "default" => "0%"
                          },
                          "height" => "100%",
                          "background" => "#1DB954",
                          "border-radius" => "0.25em",
                          "transition" => "width 1s linear"
                        }
                      }
                    ]
                  },
                  %{
                    "type" => "text",
                    "opts" => %{
                      "text" => %{
                        "key" => "data.duration_formatted",
                        "default" => "3:30"
                      }
                    },
                    "style" => %{
                      "font-size" => "1.5em",
                      "font-weight" => "500",
                      "margin-left" => "1.3em",
                      "font-variant-numeric" => "tabular-nums"
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      # Note: Theme and animation options would require player-side logic to implement.
      # For this POC, we keep the schema minimal.
      # The timestamp field enables client-side progress interpolation for smooth updates.
      options_schema: %{},
      data_schema: %{
        "track_name" => %{"type" => "string", "default" => "Song Title"},
        "artist_name" => %{"type" => "string", "default" => "Artist Name"},
        "album_name" => %{"type" => "string", "default" => "Album Name"},
        "album_art_url" => %{
          "type" => "string",
          "default" => "https://via.placeholder.com/400x400/1DB954/FFFFFF?text=♪"
        },
        "duration_ms" => %{"type" => "number", "default" => 210_000},
        "duration_formatted" => %{"type" => "string", "default" => "3:30"},
        "progress_ms" => %{"type" => "number", "default" => 90000},
        "progress_formatted" => %{"type" => "string", "default" => "1:30"},
        "progress_percent" => %{"type" => "string", "default" => "43%"},
        "is_playing" => %{"type" => "boolean", "default" => true},
        # Timestamp when data was fetched - used for client-side progress interpolation
        # Client calculates: current_progress = progress_ms + (Date.now() - timestamp) if is_playing
        "timestamp" => %{"type" => "number", "default" => 0}
      }
    }

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Insert widget
    {:ok, widget} =
      %Widget{is_system: true}
      |> Widget.changeset(widget_attrs)
      |> Ecto.Changeset.put_change(:inserted_at, now)
      |> Ecto.Changeset.put_change(:updated_at, now)
      |> Repo.insert()

    # Insert the Spotify integration for this widget
    integration_attrs = %{
      widget_id: widget.id,
      name: "spotify",
      description: "Spotify Web API integration for Now Playing data",
      integration_type: "pull",
      credential_scope: "widget",
      pull_endpoint: "https://api.spotify.com/v1/me/player/currently-playing",
      pull_interval_seconds: 15,
      pull_config: %{
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Spotify",
        "poller_module" => "Castmill.Workers.SpotifyPoller",
        "oauth_token_endpoint" => "https://accounts.spotify.com/api/token",
        "oauth_scopes" => ["user-read-currently-playing", "user-read-playback-state"]
      },
      credential_schema: %{
        "auth_type" => "oauth2",
        "oauth2" => %{
          "authorization_url" => "https://accounts.spotify.com/authorize",
          "token_url" => "https://accounts.spotify.com/api/token",
          "scopes" => ["user-read-currently-playing", "user-read-playback-state"],
          "pkce" => false,
          "token_placement" => "header",
          "client_auth" => "basic"
        },
        "fields" => %{
          "client_id" => %{
            "type" => "string",
            "required" => true,
            "label" => "Spotify Client ID",
            "description" => "OAuth 2.0 Client ID from Spotify Developer Dashboard",
            "input_type" => "text"
          },
          "client_secret" => %{
            "type" => "string",
            "required" => true,
            "label" => "Spotify Client Secret",
            "description" => "OAuth 2.0 Client Secret (kept secure on server)",
            "sensitive" => true,
            "input_type" => "password"
          }
        }
      },
      is_active: true,
      # Organization-level: all Spotify widgets in an org share the same cached data
      discriminator_type: "organization"
    }

    %WidgetIntegration{}
    |> WidgetIntegration.changeset(integration_attrs)
    |> Ecto.Changeset.put_change(:inserted_at, now)
    |> Ecto.Changeset.put_change(:updated_at, now)
    |> Repo.insert!()
  end
end

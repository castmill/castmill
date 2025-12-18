# Spotify Now Playing Widget Seed
#
# This file creates the Spotify "Now Playing" widget and its integration.
# It's a proof of concept for the widget third-party integration system.

alias Castmill.Repo
alias Castmill.Widgets
alias Castmill.Widgets.Widget
alias Castmill.Widgets.Integrations

# Create the Spotify Now Playing widget
{:ok, spotify_widget} = Widgets.create_widget(%{
  name: "Spotify Now Playing",
  slug: "spotify-now-playing",
  description: "Displays the currently playing track from a Spotify account with album artwork, track information, and playback progress.",
  icon: "/widgets/spotify-now-playing/icon.svg",
  small_icon: "/widgets/spotify-now-playing/icon-small.svg",
  is_system: true,
  aspect_ratio: "16:9",
  update_interval_seconds: 15,  # Check for updates every 15 seconds

  # Template uses relative units (em, %) for responsive/liquid layout
  # All data bindings include defaults to show placeholder content when first added
  template: %{
    "type" => "group",
    "style" => %{
      "width" => "100%",
      "height" => "100%",
      "display" => "flex",
      "flexDirection" => "row",
      "alignItems" => "center",
      "background" => "linear-gradient(135deg, #1DB954 0%, #191414 100%)",
      "padding" => "2.5em",
      "fontFamily" => "'Circular Std', sans-serif"
    },
    "components" => [
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
          "width" => "30%",
          "aspectRatio" => "1",
          "borderRadius" => "0.75em",
          "boxShadow" => "0 1.25em 3.75em rgba(0,0,0,0.5)"
        }
      },
      %{
        "type" => "group",
        "style" => %{
          "marginLeft" => "3.75em",
          "flex" => "1",
          "display" => "flex",
          "flexDirection" => "column",
          "justifyContent" => "center",
          "color" => "#FFFFFF"
        },
        "components" => [
          %{
            "type" => "text",
            "opts" => %{
              "text" => %{
                "key" => "data.track_name",
                "default" => "Song Title"
              }
            },
            "style" => %{
              "fontSize" => "4.5em",
              "fontWeight" => "700",
              "marginBottom" => "0.3em",
              "textShadow" => "0 0.06em 0.17em rgba(0,0,0,0.3)",
              "height" => "auto",
              "width" => "auto"
            }
          },
          %{
            "type" => "text",
            "opts" => %{
              "text" => %{
                "key" => "data.artist_name",
                "default" => "Artist Name"
              }
            },
            "style" => %{
              "fontSize" => "3em",
              "fontWeight" => "400",
              "marginBottom" => "0.3em",
              "opacity" => "0.9",
              "height" => "auto",
              "width" => "auto"
            }
          },
          %{
            "type" => "text",
            "opts" => %{
              "text" => %{
                "key" => "data.album_name",
                "default" => "Album Name"
              }
            },
            "style" => %{
              "fontSize" => "2.25em",
              "fontWeight" => "300",
              "opacity" => "0.7",
              "marginBottom" => "1.1em",
              "height" => "auto",
              "width" => "auto"
            }
          },
          %{
            "type" => "group",
            "style" => %{
              "display" => "flex",
              "flexDirection" => "row",
              "alignItems" => "center",
              "marginTop" => "1em",
              "width" => "100%"
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
                  "fontSize" => "1.75em",
                  "fontWeight" => "500",
                  "marginRight" => "1.25em",
                  "fontVariantNumeric" => "tabular-nums",
                  "height" => "auto",
                  "width" => "auto"
                }
              },
              %{
                "type" => "group",
                "style" => %{
                  "flex" => "1",
                  "height" => "0.5em",
                  "background" => "rgba(255,255,255,0.2)",
                  "borderRadius" => "0.25em",
                  "position" => "relative",
                  "overflow" => "hidden"
                },
                "components" => [
                  %{
                    "type" => "group",
                    "style" => %{
                      "width" => %{
                        "key" => "data.progress_percent",
                        "default" => "0%"
                      },
                      "height" => "100%",
                      "background" => "#1DB954",
                      "borderRadius" => "0.25em",
                      "transition" => "width 1s linear",
                      "position" => "absolute",
                      "left" => "0",
                      "top" => "0"
                    },
                    "components" => []
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
                  "fontSize" => "1.75em",
                  "fontWeight" => "500",
                  "marginLeft" => "1.25em",
                  "fontVariantNumeric" => "tabular-nums",
                  "height" => "auto",
                  "width" => "auto"
                }
              }
            ]
          }
        ]
      }
    ]
  },

  options_schema: %{
    "theme" => %{
      "type" => "string",
      "enum" => ["dark", "light", "gradient"],
      "default" => "gradient",
      "label" => "Theme",
      "description" => "Visual theme for the widget"
    },
    "show_progress" => %{
      "type" => "boolean",
      "default" => true,
      "label" => "Show Progress Bar",
      "description" => "Display playback progress bar"
    },
    "animation" => %{
      "type" => "string",
      "enum" => ["fade", "slide", "none"],
      "default" => "fade",
      "label" => "Track Change Animation"
    }
  },

  data_schema: %{
    "track_name" => %{
      "type" => "string",
      "required" => true,
      "label" => "Track Name",
      "default" => "Song Title"
    },
    "artist_name" => %{
      "type" => "string",
      "required" => true,
      "label" => "Artist Name",
      "default" => "Artist Name"
    },
    "album_name" => %{
      "type" => "string",
      "required" => true,
      "label" => "Album Name",
      "default" => "Album Name"
    },
    "album_art_url" => %{
      "type" => "string",
      "format" => "uri",
      "required" => true,
      "label" => "Album Artwork URL",
      "default" => "https://placehold.co/400x400/1DB954/FFFFFF/png?text=Now+Playing"
    },
    "duration_ms" => %{
      "type" => "number",
      "required" => true,
      "label" => "Track Duration (milliseconds)",
      "default" => 210000
    },
    "duration_formatted" => %{
      "type" => "string",
      "required" => true,
      "label" => "Track Duration (formatted)",
      "default" => "3:30"
    },
    "progress_ms" => %{
      "type" => "number",
      "required" => true,
      "label" => "Playback Progress (milliseconds)",
      "default" => 90000
    },
    "progress_formatted" => %{
      "type" => "string",
      "required" => true,
      "label" => "Playback Progress (formatted)",
      "default" => "1:30"
    },
    "progress_percent" => %{
      "type" => "string",
      "required" => true,
      "label" => "Progress Percentage",
      "default" => "43%"
    },
    "is_playing" => %{
      "type" => "boolean",
      "required" => true,
      "label" => "Is Currently Playing",
      "default" => true
    }
  }
})

IO.puts("✓ Created Spotify Now Playing widget (ID: #{spotify_widget.id})")

# Create the Spotify integration
{:ok, spotify_integration} = Integrations.create_integration(%{
  widget_id: spotify_widget.id,
  name: "spotify",
  description: "Spotify Web API integration for Now Playing data",
  integration_type: "pull",
  credential_scope: "widget",  # Each user needs their own OAuth tokens

  # Pull configuration
  pull_endpoint: "https://api.spotify.com/v1/me/player/currently-playing",
  pull_interval_seconds: 15,  # Poll every 15 seconds
  pull_config: %{
    "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Spotify",
    "poller_module" => "Castmill.Workers.SpotifyPoller",
    "oauth_token_endpoint" => "https://accounts.spotify.com/api/token",
    "oauth_scopes" => ["user-read-currently-playing", "user-read-playback-state"]
  },

  # Credential schema (Generic OAuth 2.0 format)
  # This format enables the dashboard UI to render the OAuth authorization flow
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

  is_active: true
})

IO.puts("✓ Created Spotify integration (ID: #{spotify_integration.id})")
IO.puts("")
IO.puts("Spotify Now Playing widget is ready!")
IO.puts("Users can now add this widget to their playlists and connect their Spotify accounts.")

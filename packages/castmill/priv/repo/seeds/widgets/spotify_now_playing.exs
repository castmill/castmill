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
  update_interval_seconds: 15,  # Check for updates every 15 seconds
  
  template: %{
    "type" => "group",
    "style" => %{
      "width" => "100%",
      "height" => "100%",
      "display" => "flex",
      "flexDirection" => "row",
      "alignItems" => "center",
      "background" => "linear-gradient(135deg, #1DB954 0%, #191414 100%)",
      "padding" => "40px",
      "fontFamily" => "'Circular Std', sans-serif"
    },
    "components" => [
      %{
        "type" => "image",
        "source" => %{"key" => "data.album_art_url"},
        "style" => %{
          "width" => "400px",
          "height" => "400px",
          "borderRadius" => "12px",
          "boxShadow" => "0 20px 60px rgba(0,0,0,0.5)"
        }
      },
      %{
        "type" => "group",
        "style" => %{
          "marginLeft" => "60px",
          "flex" => "1",
          "color" => "#FFFFFF"
        },
        "components" => [
          %{
            "type" => "text",
            "text" => %{"key" => "data.track_name"},
            "style" => %{
              "fontSize" => "72px",
              "fontWeight" => "700",
              "marginBottom" => "20px",
              "textShadow" => "0 4px 12px rgba(0,0,0,0.3)"
            }
          },
          %{
            "type" => "text",
            "text" => %{"key" => "data.artist_name"},
            "style" => %{
              "fontSize" => "48px",
              "fontWeight" => "400",
              "marginBottom" => "15px",
              "opacity" => "0.9"
            }
          },
          %{
            "type" => "text",
            "text" => %{"key" => "data.album_name"},
            "style" => %{
              "fontSize" => "36px",
              "fontWeight" => "300",
              "opacity" => "0.7",
              "marginBottom" => "40px"
            }
          },
          %{
            "type" => "group",
            "style" => %{
              "display" => "flex",
              "flexDirection" => "row",
              "alignItems" => "center",
              "marginTop" => "30px"
            },
            "components" => [
              %{
                "type" => "text",
                "text" => %{"key" => "data.progress_formatted"},
                "style" => %{
                  "fontSize" => "28px",
                  "fontWeight" => "500",
                  "marginRight" => "20px",
                  "fontVariantNumeric" => "tabular-nums"
                }
              },
              %{
                "type" => "group",
                "style" => %{
                  "flex" => "1",
                  "height" => "8px",
                  "background" => "rgba(255,255,255,0.2)",
                  "borderRadius" => "4px",
                  "position" => "relative",
                  "overflow" => "hidden"
                },
                "components" => [
                  %{
                    "type" => "group",
                    "style" => %{
                      "width" => %{"key" => "data.progress_percent"},
                      "height" => "100%",
                      "background" => "#1DB954",
                      "borderRadius" => "4px",
                      "transition" => "width 1s linear"
                    }
                  }
                ]
              },
              %{
                "type" => "text",
                "text" => %{"key" => "data.duration_formatted"},
                "style" => %{
                  "fontSize" => "28px",
                  "fontWeight" => "500",
                  "marginLeft" => "20px",
                  "fontVariantNumeric" => "tabular-nums"
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
      "label" => "Track Name"
    },
    "artist_name" => %{
      "type" => "string",
      "required" => true,
      "label" => "Artist Name"
    },
    "album_name" => %{
      "type" => "string",
      "required" => true,
      "label" => "Album Name"
    },
    "album_art_url" => %{
      "type" => "string",
      "format" => "uri",
      "required" => true,
      "label" => "Album Artwork URL"
    },
    "duration_ms" => %{
      "type" => "number",
      "required" => true,
      "label" => "Track Duration (milliseconds)"
    },
    "duration_formatted" => %{
      "type" => "string",
      "required" => true,
      "label" => "Track Duration (formatted)"
    },
    "progress_ms" => %{
      "type" => "number",
      "required" => true,
      "label" => "Playback Progress (milliseconds)"
    },
    "progress_formatted" => %{
      "type" => "string",
      "required" => true,
      "label" => "Playback Progress (formatted)"
    },
    "progress_percent" => %{
      "type" => "string",
      "required" => true,
      "label" => "Progress Percentage"
    },
    "is_playing" => %{
      "type" => "boolean",
      "required" => true,
      "label" => "Is Currently Playing"
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
    "oauth_token_endpoint" => "https://accounts.spotify.com/api/token",
    "oauth_scopes" => ["user-read-currently-playing", "user-read-playback-state"]
  },
  
  # Credential schema (OAuth 2.0 tokens)
  credential_schema: %{
    "client_id" => %{
      "type" => "string",
      "required" => true,
      "label" => "Spotify Client ID",
      "description" => "OAuth 2.0 Client ID from Spotify Developer Dashboard"
    },
    "client_secret" => %{
      "type" => "string",
      "required" => true,
      "label" => "Spotify Client Secret",
      "description" => "OAuth 2.0 Client Secret (kept secure on server)",
      "sensitive" => true
    },
    "access_token" => %{
      "type" => "string",
      "required" => true,
      "label" => "Access Token",
      "description" => "OAuth 2.0 Access Token (obtained via authorization flow)",
      "sensitive" => true
    },
    "refresh_token" => %{
      "type" => "string",
      "required" => true,
      "label" => "Refresh Token",
      "description" => "OAuth 2.0 Refresh Token for automatic token renewal",
      "sensitive" => true
    },
    "expires_at" => %{
      "type" => "number",
      "required" => true,
      "label" => "Token Expiration",
      "description" => "Unix timestamp when access_token expires"
    }
  },
  
  is_active: true
})

IO.puts("✓ Created Spotify integration (ID: #{spotify_integration.id})")
IO.puts("")
IO.puts("Spotify Now Playing widget is ready!")
IO.puts("Users can now add this widget to their playlists and connect their Spotify accounts.")

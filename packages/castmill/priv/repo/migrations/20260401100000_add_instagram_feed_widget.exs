defmodule Castmill.Repo.Migrations.AddInstagramFeedWidget do
  @moduledoc """
  Adds the Instagram Feed widget with integration.

  This widget displays a paginated slideshow of a user's recent Instagram
  posts (images and videos).  Each page shows one post at a time and
  automatically advances after a configurable duration so that viewers
  cycle through the latest content.

  ## Features

  - Paginated slideshow of up to 30 recent Instagram posts
  - Supports IMAGE, VIDEO, and CAROUSEL_ALBUM media types
  - Optional caption and username display
  - Configurable post duration and page transitions
  - Per-widget credentials (each widget instance shows a different account)
  - Long-lived access token support with automatic refresh

  ## Data Flow

  1. User connects their Instagram account via OAuth in the dashboard
  2. Backend fetches recent media every 30 minutes
  3. Data is cached and served to players
  4. Player cycles through posts using the paginated-list component
  """
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.WidgetIntegration

  @widget_slug "instagram-feed"

  def up do
    widget_attrs = %{
      name: "Instagram Feed",
      slug: @widget_slug,
      description:
        "Displays a slideshow of recent Instagram posts from a connected account. " <>
          "Supports images, videos, and carousel albums with optional captions.",
      icon: "/widgets/instagram-feed/icon.svg",
      small_icon: "/widgets/instagram-feed/icon-small.svg",
      aspect_ratio: "16:9",
      is_system: true,
      template: build_template(),
      options_schema: build_options_schema(),
      data_schema: build_data_schema()
    }

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {:ok, widget} =
      %Widget{is_system: true}
      |> Widget.changeset(widget_attrs)
      |> Ecto.Changeset.put_change(:inserted_at, now)
      |> Ecto.Changeset.put_change(:updated_at, now)
      |> Repo.insert()

    integration_attrs = %{
      widget_id: widget.id,
      name: "instagram",
      description: "Instagram Basic Display API – fetches recent user media",
      integration_type: "pull",
      # Each widget instance shows a different user's feed
      credential_scope: "widget",
      pull_endpoint: "https://graph.instagram.com/me/media",
      # Fetch fresh posts every 30 minutes
      pull_interval_seconds: 1800,
      pull_config: %{
        "fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Instagram"
      },
      credential_schema: %{
        "auth_type" => "oauth2",
        "oauth2" => %{
          "authorization_url" => "https://www.instagram.com/oauth/authorize",
          "token_url" => "https://api.instagram.com/oauth/access_token",
          "scopes" => ["instagram_business_basic", "instagram_business_manage_messages"],
          "pkce" => false,
          "token_placement" => "query",
          "client_auth" => "form"
        },
        "fields" => %{
          "client_id" => %{
            "type" => "string",
            "required" => true,
            "label" => "Instagram App ID",
            "description" => "App ID from your Meta for Developers dashboard",
            "input_type" => "text"
          },
          "client_secret" => %{
            "type" => "string",
            "required" => true,
            "label" => "Instagram App Secret",
            "description" => "App Secret from your Meta for Developers dashboard",
            "sensitive" => true,
            "input_type" => "password"
          }
        }
      },
      is_active: true
    }

    %WidgetIntegration{}
    |> WidgetIntegration.changeset(integration_attrs)
    |> Ecto.Changeset.put_change(:inserted_at, now)
    |> Ecto.Changeset.put_change(:updated_at, now)
    |> Repo.insert!()
  end

  def down do
    widget =
      from(w in Widget, where: w.slug == @widget_slug)
      |> Repo.one()

    if widget do
      from(i in WidgetIntegration, where: i.widget_id == ^widget.id)
      |> Repo.delete_all()

      Repo.delete(widget)
    end
  end

  # ============================================================================
  # TEMPLATE
  # ============================================================================

  defp build_template do
    %{
      "type" => "group",
      "name" => "instagram-feed-widget",
      "opts" => %{
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "background-color" => %{"type" => "opt", "key" => "bg_color"},
          "overflow" => "hidden",
          "position" => "relative"
        }
      },
      "children" => [
        %{
          "type" => "paginated-list",
          "name" => "posts-list",
          "opts" => %{
            "data" => %{"type" => "ctx", "key" => "posts"},
            "page_size" => 1,
            "page_duration" => %{"type" => "opt", "key" => "post_duration"},
            "style" => %{
              "width" => "100%",
              "height" => "100%"
            },
            "transition" => %{
              "type" => %{"type" => "opt", "key" => "transition_type"},
              "duration" => %{"type" => "opt", "key" => "transition_duration"},
              "easing" => %{"type" => "opt", "key" => "transition_easing"}
            }
          },
          "item_template" => build_post_card()
        }
      ]
    }
  end

  defp build_post_card do
    %{
      "type" => "group",
      "name" => "post-card",
      "opts" => %{
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "position" => "relative",
          "overflow" => "hidden",
          "display" => "flex",
          "flex-direction" => "column"
        }
      },
      "children" => [
        # Media layer – image or video thumbnail
        %{
          "type" => "image",
          "name" => "post-media",
          "opts" => %{
            "src" => %{
              "type" => "coalesce",
              "values" => [
                %{"type" => "item", "key" => "thumbnail_url"},
                %{"type" => "item", "key" => "media_url"}
              ]
            },
            "style" => %{
              "width" => "100%",
              "height" => "100%",
              "object-fit" => %{"type" => "opt", "key" => "media_fit"},
              "position" => "absolute",
              "top" => "0",
              "left" => "0"
            }
          }
        },
        # Gradient overlay for readability
        %{
          "type" => "group",
          "name" => "gradient-overlay",
          "opts" => %{
            "style" => %{
              "position" => "absolute",
              "bottom" => "0",
              "left" => "0",
              "width" => "100%",
              "height" => "50%",
              "background" => "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
              "pointer-events" => "none"
            }
          },
          "children" => []
        },
        # Header: username + date (top-left)
        %{
          "type" => "group",
          "name" => "post-header",
          "opts" => %{
            "filter" => %{
              "type" => "condition",
              "if" => %{
                "type" => "comparison",
                "left" => %{"type" => "opt", "key" => "show_username"},
                "operator" => "==",
                "right" => true
              },
              "then" => false,
              "else" => true
            },
            "style" => %{
              "position" => "absolute",
              "top" => "0",
              "left" => "0",
              "width" => "100%",
              "display" => "flex",
              "flex-direction" => "row",
              "align-items" => "center",
              "padding" => "0.75em 1em",
              "box-sizing" => "border-box",
              "background" => "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
              "gap" => "0.4em"
            }
          },
          "children" => [
            %{
              "type" => "text",
              "name" => "at-prefix",
              "opts" => %{
                "text" => "@",
                "style" => %{
                  "color" => "#ffffff",
                  "font-size" => "1.1em",
                  "font-weight" => "600",
                  "opacity" => "0.9",
                  "height" => "auto",
                  "width" => "auto"
                }
              }
            },
            %{
              "type" => "text",
              "name" => "username",
              "opts" => %{
                "text" => %{"type" => "item", "key" => "username"},
                "style" => %{
                  "color" => "#ffffff",
                  "font-size" => "1.1em",
                  "font-weight" => "600",
                  "opacity" => "0.9",
                  "height" => "auto",
                  "width" => "auto"
                }
              }
            },
            %{
              "type" => "text",
              "name" => "post-date",
              "opts" => %{
                "text" => %{"type" => "item", "key" => "timestamp_formatted"},
                "style" => %{
                  "color" => "#ffffff",
                  "font-size" => "0.9em",
                  "opacity" => "0.75",
                  "margin-left" => "0.5em",
                  "height" => "auto",
                  "width" => "auto"
                }
              }
            }
          ]
        },
        # Footer: caption
        %{
          "type" => "group",
          "name" => "post-footer",
          "opts" => %{
            "filter" => %{
              "type" => "condition",
              "if" => %{
                "type" => "comparison",
                "left" => %{"type" => "opt", "key" => "show_caption"},
                "operator" => "==",
                "right" => true
              },
              "then" => false,
              "else" => true
            },
            "style" => %{
              "position" => "absolute",
              "bottom" => "0",
              "left" => "0",
              "width" => "100%",
              "padding" => "0.75em 1em",
              "box-sizing" => "border-box"
            }
          },
          "children" => [
            %{
              "type" => "text",
              "name" => "caption",
              "opts" => %{
                "text" => %{"type" => "item", "key" => "caption"},
                "style" => %{
                  "color" => %{"type" => "opt", "key" => "caption_color"},
                  "font-size" => "1em",
                  "line-height" => "1.4",
                  "overflow" => "hidden",
                  "display" => "-webkit-box",
                  "-webkit-line-clamp" => "3",
                  "-webkit-box-orient" => "vertical",
                  "height" => "auto",
                  "width" => "100%"
                }
              }
            }
          ]
        }
      ]
    }
  end

  # ============================================================================
  # SCHEMAS
  # ============================================================================

  defp build_options_schema do
    %{
      "max_posts" => %{
        "type" => "number",
        "required" => false,
        "default" => 10,
        "min" => 1,
        "max" => 30,
        "description" => "Maximum number of recent posts to fetch and cycle through",
        "order" => 1
      },
      "post_duration" => %{
        "type" => "number",
        "required" => false,
        "default" => 8,
        "min" => 3,
        "max" => 120,
        "description" => "How long each post is displayed before advancing (seconds)",
        "order" => 2
      },
      "show_caption" => %{
        "type" => "boolean",
        "required" => false,
        "default" => true,
        "description" => "Display the post caption at the bottom of each post",
        "order" => 3
      },
      "show_username" => %{
        "type" => "boolean",
        "required" => false,
        "default" => true,
        "description" => "Display the Instagram username and post date at the top",
        "order" => 4
      },
      "media_fit" => %{
        "type" => "string",
        "required" => false,
        "default" => "cover",
        "enum" => ["cover", "contain", "fill"],
        "description" => "How post images/videos are scaled to fill the widget",
        "order" => 5
      },
      "transition_type" => %{
        "type" => "string",
        "required" => false,
        "default" => "fade",
        "enum" => ["fade", "slide-left", "slide-right", "slide-up", "slide-down", "none"],
        "description" => "Animation between posts",
        "order" => 6
      },
      "transition_duration" => %{
        "type" => "number",
        "required" => false,
        "default" => 0.6,
        "min" => 0.1,
        "max" => 2.0,
        "description" => "Duration of the transition animation (seconds)",
        "order" => 7
      },
      "transition_easing" => %{
        "type" => "string",
        "required" => false,
        "default" => "ease-in-out",
        "enum" => ["ease", "ease-in", "ease-out", "ease-in-out", "linear"],
        "description" => "Easing function for the transition",
        "order" => 8
      },
      "bg_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#000000",
        "description" => "Background colour shown behind contained images",
        "order" => 9
      },
      "caption_color" => %{
        "type" => "color",
        "required" => false,
        "default" => "#ffffff",
        "description" => "Text colour for captions",
        "order" => 10
      }
    }
  end

  defp build_data_schema do
    %{
      "posts" => %{
        "type" => "list",
        "default" => [
          %{
            "id" => "example_post_1",
            "media_type" => "IMAGE",
            "media_url" => "https://placehold.co/1280x720/E1306C/FFFFFF/png?text=Instagram",
            "thumbnail_url" => "https://placehold.co/1280x720/E1306C/FFFFFF/png?text=Instagram",
            "caption" => "Welcome to the Instagram Feed widget! Connect your account to show your latest posts here.",
            "timestamp" => "2024-01-01T00:00:00+0000",
            "timestamp_formatted" => "Jan 1, 2024",
            "permalink" => "https://www.instagram.com/",
            "username" => "your_instagram"
          }
        ],
        "items" => %{
          "type" => "map",
          "schema" => %{
            "id" => "string",
            "media_type" => "string",
            "media_url" => "string",
            "thumbnail_url" => "string",
            "caption" => "string",
            "timestamp" => "string",
            "timestamp_formatted" => "string",
            "permalink" => "string",
            "username" => "string"
          }
        }
      },
      "username" => %{
        "type" => "string",
        "default" => ""
      },
      "last_updated" => %{
        "type" => "number",
        "default" => 0
      }
    }
  end
end

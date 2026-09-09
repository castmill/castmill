defmodule Castmill.Repo.Migrations.UpdateLayoutPortrait3Widget do
  use Ecto.Migration

  def up do
    # Update the Layout Portrait 3 widget to use 3 individual playlist refs
    # instead of a list type
    execute """
    UPDATE widgets
    SET
      template = '#{Jason.encode!(template()) |> String.replace("'", "''")}',
      options_schema = '#{Jason.encode!(options_schema()) |> String.replace("'", "''")}'
    WHERE slug = 'layout-portrait-3'
    """
  end

  def down do
    # Revert to the original list-based schema
    execute """
    UPDATE widgets
    SET
      template = '#{Jason.encode!(original_template()) |> String.replace("'", "''")}',
      options_schema = '#{Jason.encode!(original_options_schema()) |> String.replace("'", "''")}'
    WHERE slug = 'layout-portrait-3'
    """
  end

  defp template do
    %{
      "type" => "layout",
      "name" => "layout",
      "style" => %{
        "background" => %{"key" => "options.background"},
        "color" => %{"key" => "options.color"}
      },
      "opts" => %{
        "containers" => [
          %{
            "playlist" => %{"key" => "options.playlist_1"},
            "rect" => %{
              "width" => "100%",
              "height" => "33.33%",
              "top" => "0%",
              "left" => "0%"
            }
          },
          %{
            "playlist" => %{"key" => "options.playlist_2"},
            "rect" => %{
              "width" => "100%",
              "height" => "33.33%",
              "top" => "33.33%",
              "left" => "0%"
            }
          },
          %{
            "playlist" => %{"key" => "options.playlist_3"},
            "rect" => %{
              "width" => "100%",
              "height" => "33.34%",
              "top" => "66.66%",
              "left" => "0%"
            }
          }
        ]
      }
    }
  end

  defp options_schema do
    %{
      "background" => "color",
      "playlist_1" => %{
        "type" => "ref",
        "required" => true,
        "collection" => "playlists",
        "description" => "Top playlist"
      },
      "playlist_2" => %{
        "type" => "ref",
        "required" => true,
        "collection" => "playlists",
        "description" => "Middle playlist"
      },
      "playlist_3" => %{
        "type" => "ref",
        "required" => true,
        "collection" => "playlists",
        "description" => "Bottom playlist"
      }
    }
  end

  defp original_template do
    %{
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
    }
  end

  defp original_options_schema do
    %{
      "background" => "color",
      "playlists" => %{
        "type" => "list",
        "items" => %{
          "type" => "ref",
          "required" => true,
          "collection" => "playlists"
        }
      }
    }
  end
end

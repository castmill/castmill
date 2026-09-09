defmodule Castmill.Repo.Migrations.AddSystemLayoutsAndRemoveLayoutPortrait3 do
  use Ecto.Migration

  alias Castmill.Repo

  def up do
    # Step 1: Add is_system column to layouts table
    alter table(:layouts) do
      add :is_system, :boolean, default: false, null: false
    end

    # Step 2: Make organization_id nullable for system layouts
    alter table(:layouts) do
      modify :organization_id, :uuid, null: true
    end

    flush()

    # Step 3: Create system layout "Portrait 3 Zones" that replaces the old widget
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    Repo.insert_all("layouts", [
      %{
        name: "Portrait 3 Zones",
        description:
          "Three horizontal zones stacked vertically for portrait displays. Each zone takes 1/3 of the screen height.",
        aspect_ratio: "9:16",
        is_system: true,
        organization_id: nil,
        zones: %{
          "zones" => [
            %{
              "id" => "zone-top",
              "name" => "Top Zone",
              "rect" => %{"x" => 0, "y" => 0, "width" => 100, "height" => 33.33},
              "zIndex" => 1
            },
            %{
              "id" => "zone-middle",
              "name" => "Middle Zone",
              "rect" => %{"x" => 0, "y" => 33.33, "width" => 100, "height" => 33.33},
              "zIndex" => 1
            },
            %{
              "id" => "zone-bottom",
              "name" => "Bottom Zone",
              "rect" => %{"x" => 0, "y" => 66.66, "width" => 100, "height" => 33.34},
              "zIndex" => 1
            }
          ]
        },
        inserted_at: now,
        updated_at: now
      }
    ])

    # Step 4: Remove the layout-portrait-3 widget (now redundant)
    execute "DELETE FROM widgets WHERE slug = 'layout-portrait-3'"
  end

  def down do
    # Remove the system layout
    execute "DELETE FROM layouts WHERE name = 'Portrait 3 Zones' AND is_system = true"

    # Restore the layout-portrait-3 widget
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    template = %{
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

    options_schema = %{
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

    Repo.insert_all("widgets", [
      %{
        name: "Layout Portrait 3",
        description: "Display 3 playlists in a portrait layout.",
        slug: "layout-portrait-3",
        aspect_ratio: "9:16",
        is_system: true,
        template: Jason.encode!(template),
        options_schema: Jason.encode!(options_schema),
        inserted_at: now,
        updated_at: now
      }
    ])

    # Make organization_id non-nullable again
    alter table(:layouts) do
      modify :organization_id, :uuid, null: false
    end

    # Remove is_system column
    alter table(:layouts) do
      remove :is_system
    end
  end
end

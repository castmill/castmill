defmodule Castmill.Repo.Migrations.AddLayoutRefWidget do
  use Ecto.Migration

  import Ecto.Query

  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  def up do
    # Insert the Layout Widget that uses layout-ref to select existing layouts
    widget_attrs = %{
      name: "Layout Widget",
      slug: "layout-widget",
      description:
        "Display multiple playlists using a pre-defined layout. Select a layout and assign playlists to each zone.",
      icon: "/widgets/layout-widget/icon.svg",
      small_icon: "/widgets/layout-widget/icon-small.svg",
      aspect_ratio: "16:9",
      is_system: true,
      template: %{
        "type" => "layout",
        "name" => "layout-ref-widget",
        "style" => %{
          "width" => "100%",
          "height" => "100%",
          "position" => "relative",
          "overflow" => "hidden"
        },
        # The template will be resolved from the layout-ref data
        "opts" => %{
          "layoutRef" => %{"key" => "options.layoutRef"}
        }
      },
      options_schema: %{
        "layoutRef" => %{
          "type" => "layout-ref",
          "required" => true,
          "description" => "Select a layout and assign playlists to each zone",
          "order" => 1
        }
      }
    }

    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    widget_row =
      widget_attrs
      |> Map.merge(%{
        assets: %{},
        fonts: [],
        inserted_at: now,
        updated_at: now,
        update_interval_seconds: Map.get(widget_attrs, :update_interval_seconds, 60)
      })
      |> Map.drop([:translations])

    Repo.insert_all("widgets", [widget_row])
  end

  def down do
    # Remove the Layout Widget
    from(w in Widget, where: w.slug == "layout-widget")
    |> Repo.delete_all()
  end
end

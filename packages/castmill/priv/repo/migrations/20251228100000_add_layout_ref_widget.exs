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

    %Widget{}
    |> Widget.changeset(widget_attrs)
    |> Repo.insert!()
  end

  def down do
    # Remove the Layout Widget
    from(w in Widget, where: w.slug == "layout-widget")
    |> Repo.delete_all()
  end
end

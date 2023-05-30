defmodule Castmill.Repo.Migrations.AddDefaultWidgets do
  use Ecto.Migration

  # Add default, system wide widgets
  def change do
    for attrs <- [
          %{
            name: "image",
            uri: "widget://image",
            schema: %{
              media_id: :string,
              size: :string
            }
          },
          %{
            name: "video",
            uri: "widget://video",
            schema: %{
              media_id: :integer,
              size: :string
            }
          },
          %{
            name: "text",
            uri: "widget://text",
            schema: %{
              text: :string,
              css: :object,
              # { url: string, name: string }
              font: :object,
              # { from, perspective, chars }
              animation: :object
            }
          },
          %{name: "layout", uri: "widget://layout", schema: %{}},
          %{
            name: "template",
            uri: "widget://template",
            schema: %{
              name: :string,
              template_id: :integer,
              model: :object
            }
          }
        ] do
      %Castmill.Widgets.Widget{is_system: true}
      |> Castmill.Widgets.Widget.changeset(attrs)
      |> Castmill.Repo.insert!()
    end
  end
end

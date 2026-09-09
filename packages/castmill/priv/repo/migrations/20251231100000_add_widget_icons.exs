defmodule Castmill.Repo.Migrations.AddWidgetIcons do
  use Ecto.Migration

  @doc """
  Migration to add icon paths to widgets that are missing them.

  This updates the following widgets with their icon paths:
  - image
  - video
  - weather
  - web
  - intro
  - layout-widget (updating from existing if different)

  Icons are stored in priv/static/widgets/{widget-slug}/ and served at /widgets/{widget-slug}/
  """

  def up do
    # Define widget icons to update
    widget_icons = [
      {"image", "/widgets/image/icon.svg", "/widgets/image/icon-small.svg"},
      {"video", "/widgets/video/icon.svg", "/widgets/video/icon-small.svg"},
      {"weather", "/widgets/weather/icon.svg", "/widgets/weather/icon-small.svg"},
      {"web", "/widgets/web/icon.svg", "/widgets/web/icon-small.svg"},
      {"intro", "/widgets/intro/icon.svg", "/widgets/intro/icon-small.svg"},
      {"layout-widget", "/widgets/layout-widget/icon.svg",
       "/widgets/layout-widget/icon-small.svg"}
    ]

    # Update each widget with its icons
    for {slug, icon_path, small_icon_path} <- widget_icons do
      execute("""
        UPDATE widgets
        SET icon = '#{icon_path}',
            small_icon = '#{small_icon_path}',
            updated_at = NOW()
        WHERE slug = '#{slug}'
          AND (icon IS NULL OR small_icon IS NULL)
      """)
    end
  end

  def down do
    # Optionally revert icons to NULL (or keep them as is)
    # Since having icons doesn't break functionality, we can leave them
    # But for clean rollback, we can set them back to NULL

    widget_slugs = ["image", "video", "weather", "web", "intro"]

    for slug <- widget_slugs do
      execute("""
        UPDATE widgets
        SET icon = NULL,
            small_icon = NULL,
            updated_at = NOW()
        WHERE slug = '#{slug}'
      """)
    end

    # Note: layout-widget may have had icons before, so we don't revert it
  end
end

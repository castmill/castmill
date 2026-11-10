defmodule Castmill.Widgets.TemplateBaseFontTest do
  # The system widgets were migrated to the template base font size (see the
  # ScaleSystemWidgetsToTemplateBaseFont migration): their root font size keeps
  # their full HD look now that `em` follows the widget's size.
  use Castmill.DataCase, async: true

  alias Castmill.Widgets.Widget

  defp root_font_size(slug),
    do: Repo.get_by!(Widget, slug: slug).template["style"]["font-size"]

  test "system widgets keep their full HD sizes with the 10px base" do
    for slug <- ~w(location-display-demo qr-code rss-news spotify-now-playing stock-ticker) do
      assert root_font_size(slug) == "1.6em", slug
      assert Repo.get_by!(Widget, slug: slug).template["fontScale"] == true, slug
    end

    # 1.8vmin was 19.44px on a 1080p player.
    assert root_font_size("weather") == "1.944em"
    assert Repo.get_by!(Widget, slug: "weather").template["fontScale"] == true
  end
end

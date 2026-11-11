defmodule Castmill.Widgets.TemplateBaseFontTest do
  # The system widgets were migrated to the template base font size (see the
  # ScaleSystemWidgetsToTemplateBaseFont migration): their root font size keeps
  # their full HD look now that `em` follows the widget's size.
  use Castmill.DataCase, async: true

  alias Castmill.Widgets.Widget

  unless Code.ensure_loaded?(Castmill.Repo.Migrations.RepairSystemWidgetFontScale) do
    Code.require_file(
      "../../../priv/repo/migrations/20261111120000_repair_system_widget_font_scale.exs",
      __DIR__
    )
  end

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

  test "stock ticker height scales with its layout zone" do
    widget = Repo.get_by!(Widget, slug: "stock-ticker")

    [ticker_scroller] =
      Enum.filter(widget.template["components"], &(&1["name"] == "ticker-scroller"))

    assert ticker_scroller["style"]["font-size"] == %{
             "concat" => [%{"key" => "options.ticker_height", "default" => 3.375}, "em"]
           }

    assert widget.options_schema["ticker_height"]["default"] == 3.375
    assert widget.options_schema["ticker_height"]["min"] == 1.35
    assert widget.options_schema["ticker_height"]["max"] == 13.5
    assert widget.options_schema["ticker_height"]["description"] == "Ticker height in em units"
  end

  test "repair enables scaling only for converted system widgets missing the flag" do
    rss = Repo.get_by!(Widget, slug: "rss-news")
    weather = Repo.get_by!(Widget, slug: "weather")
    qr = Repo.get_by!(Widget, slug: "qr-code")

    Repo.update!(Ecto.Changeset.change(rss, template: Map.delete(rss.template, "fontScale")))

    Repo.update!(
      Ecto.Changeset.change(weather, template: Map.put(weather.template, "fontScale", false))
    )

    custom_qr =
      qr.template
      |> Map.delete("fontScale")
      |> put_in(["style", "font-size"], "2em")

    Repo.update!(Ecto.Changeset.change(qr, template: custom_qr))

    for _ <- 1..2 do
      Ecto.Migration.Runner.run(
        Repo,
        Repo.config(),
        20_261_111_120_000,
        Castmill.Repo.Migrations.RepairSystemWidgetFontScale,
        :forward,
        :up,
        :up,
        log: false
      )
    end

    repaired = Repo.get!(Widget, rss.id).template
    assert repaired == Map.put(rss.template, "fontScale", true)
    assert Repo.get!(Widget, weather.id).template["fontScale"] == false
    assert Repo.get!(Widget, qr.id).template == custom_qr
  end
end

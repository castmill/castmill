defmodule Castmill.Repo.Migrations.ScaleSystemWidgetsToTemplateBaseFont do
  @moduledoc """
  The system widget templates opt into a base font size that follows their
  rendered size (10px at 1920×1080, see the player's `baseFontSize`). Before,
  `em` resolved against the page's 16px and `vmin` against the window, whatever
  the widget's size.

  Every `em` in a template resolves through its ancestors' font sizes, so
  converting the root font size of the system widgets that use `em` keeps them
  exactly as they looked on a full-screen 1920×1080 player:

    * no root font size or `em`/`%`: × 1.6 (16px / 10px);
    * `vmin`: × 1.08 in `em` (1vmin was 10.8px at 1080p).

  From then on they also scale with their zone and in previews.
  """
  use Ecto.Migration

  import Ecto.Query

  @slugs ~w(location-display-demo qr-code rss-news spotify-now-playing stock-ticker weather)
  @factor 1.6
  @vmin_to_em 1.08
  # 1vh is 10.8px at 1080p; the stock-ticker root font is 16px after scaling.
  @ticker_height_vh_to_em 0.675

  def up, do: update_widgets(&up_size/2, true)
  def down, do: update_widgets(&down_size/2, false)

  # Schemaless, so later Widget schema fields do not break this migration.
  defp update_widgets(convert, font_scale) do
    from(w in "widgets",
      where: w.slug in ^@slugs,
      select: %{
        id: w.id,
        slug: w.slug,
        template: w.template,
        options_schema: w.options_schema
      }
    )
    |> repo().all()
    |> Enum.each(fn %{id: id, slug: slug, template: template, options_schema: options_schema} ->
      converted_template =
        case root_font_size(template, &convert.(slug, &1)) do
          :keep -> template
          converted -> converted
        end

      converted_template = convert_ticker_template(converted_template, slug, font_scale)
      converted_options_schema = convert_ticker_options_schema(options_schema, slug, font_scale)

      converted_template =
        if is_map(converted_template) do
          if font_scale do
            Map.put(converted_template, "fontScale", true)
          else
            Map.delete(converted_template, "fontScale")
          end
        else
          converted_template
        end

      if converted_template != template or converted_options_schema != options_schema do
        from(w in "widgets", where: w.id == ^id)
        |> repo().update_all(
          set: [template: converted_template, options_schema: converted_options_schema]
        )
      end

      if slug == "stock-ticker", do: update_ticker_widget_configs(id, font_scale)
    end)
  end

  defp convert_ticker_template(template, "stock-ticker", true),
    do: update_ticker_scroller(template, &up_ticker_font_size/1)

  defp convert_ticker_template(template, "stock-ticker", false),
    do: update_ticker_scroller(template, &down_ticker_font_size/1)

  defp convert_ticker_template(template, _slug, _font_scale), do: template

  defp update_ticker_scroller(%{} = template, convert) do
    Map.update(template, "components", [], fn components ->
      Enum.map(components, fn
        %{"name" => "ticker-scroller", "style" => style} = component ->
          Map.put(component, "style", Map.update(style, "font-size", nil, convert))

        component ->
          component
      end)
    end)
  end

  defp update_ticker_scroller(template, _convert), do: template

  defp up_ticker_font_size(%{
         "concat" => [%{"key" => "options.ticker_height"} = binding, "vh"]
       }) do
    %{
      "concat" => [
        Map.put(
          binding,
          "default",
          scale_number(Map.get(binding, "default", 5), @ticker_height_vh_to_em)
        ),
        "em"
      ]
    }
  end

  defp up_ticker_font_size(size), do: size

  defp down_ticker_font_size(%{
         "concat" => [%{"key" => "options.ticker_height", "default" => 3.375} = binding, "em"]
       }) do
    %{"concat" => [Map.put(binding, "default", 5), "vh"]}
  end

  defp down_ticker_font_size(size), do: size

  defp convert_ticker_options_schema(schema, "stock-ticker", true),
    do: update_ticker_height_schema(schema, &scale_number(&1, @ticker_height_vh_to_em), "em")

  defp convert_ticker_options_schema(schema, "stock-ticker", false),
    do: update_ticker_height_schema(schema, &scale_number(&1, 1 / @ticker_height_vh_to_em), "vh")

  defp convert_ticker_options_schema(schema, _slug, _font_scale), do: schema

  defp update_ticker_height_schema(%{} = schema, convert, unit) do
    Map.update(schema, "ticker_height", nil, fn
      %{} = field ->
        field
        |> Enum.reduce(%{}, fn
          {key, value}, acc when key in ["default", "min", "max"] and is_number(value) ->
            Map.put(acc, key, convert.(value))

          {key, value}, acc ->
            Map.put(acc, key, value)
        end)
        |> Map.update("description", "Ticker height in #{unit} units", fn _ ->
          "Ticker height in #{unit} units"
        end)

      field ->
        field
    end)
  end

  defp update_ticker_height_schema(schema, _convert, _unit), do: schema

  defp update_ticker_widget_configs(widget_id, true),
    do: scale_ticker_widget_configs(widget_id, @ticker_height_vh_to_em)

  defp update_ticker_widget_configs(widget_id, false),
    do: scale_ticker_widget_configs(widget_id, 1 / @ticker_height_vh_to_em)

  defp scale_ticker_widget_configs(widget_id, factor) do
    from(wc in "widgets_config",
      where: wc.widget_id == ^widget_id,
      select: %{id: wc.id, options: wc.options}
    )
    |> repo().all()
    |> Enum.each(fn %{id: id, options: options} ->
      converted_options =
        case options do
          %{"ticker_height" => value} when is_number(value) ->
            Map.put(options, "ticker_height", value * factor)

          _ ->
            options
        end

      if converted_options != options do
        from(wc in "widgets_config", where: wc.id == ^id)
        |> repo().update_all(set: [options: converted_options])
      end
    end)
  end

  defp scale_number(value, factor) when is_number(value),
    do: Float.round(value * factor, 4)

  defp scale_number(value, _factor), do: value

  defp root_font_size(%{} = template, convert) do
    style = template["style"] || %{}

    case convert.(style["font-size"]) do
      :keep -> :keep
      nil -> Map.put(template, "style", Map.delete(style, "font-size"))
      size -> Map.put(template, "style", Map.put(style, "font-size", size))
    end
  end

  defp root_font_size(_template, _convert), do: :keep

  defp up_size(_slug, nil), do: em(@factor)

  defp up_size(_slug, size) when is_binary(size) do
    case parse(size) do
      {value, "em"} -> em(value * @factor)
      {value, "%"} -> number(value * @factor) <> "%"
      {value, "vmin"} -> em(value * @vmin_to_em)
      _ -> :keep
    end
  end

  defp up_size(_slug, _size), do: :keep

  defp down_size("weather", size) when is_binary(size) do
    case parse(size) do
      {value, "em"} -> number(value / @vmin_to_em) <> "vmin"
      _ -> :keep
    end
  end

  defp down_size(_slug, size) when is_binary(size) do
    case parse(size) do
      {value, "em"} -> if value == @factor, do: nil, else: em(value / @factor)
      {value, "%"} -> number(value / @factor) <> "%"
      _ -> :keep
    end
  end

  defp down_size(_slug, _size), do: :keep

  defp parse(size) do
    case Regex.run(~r/^\s*(\d+(?:\.\d+)?)\s*(em|%|vmin)\s*$/, size) do
      [_, value, unit] -> {String.to_float(ensure_decimal(value)), unit}
      _ -> :error
    end
  end

  defp ensure_decimal(value), do: if(String.contains?(value, "."), do: value, else: value <> ".0")

  defp em(value), do: number(value) <> "em"

  defp number(value) do
    value
    |> Float.round(4)
    |> :erlang.float_to_binary([:compact, decimals: 4])
  end
end

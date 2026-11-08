defmodule Castmill.Repo.Migrations.ScaleSystemWidgetsToTemplateBaseFont do
  @moduledoc """
  Template widgets now get a base font size that follows their rendered size
  (10px at 1920×1080, see the player's `baseFontSize`). Before, `em` resolved
  against the page's 16px and `vmin` against the window, whatever the widget's
  size.

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

  def up, do: update_widgets(&up_size/2)
  def down, do: update_widgets(&down_size/2)

  # Schemaless, so later Widget schema fields do not break this migration.
  defp update_widgets(convert) do
    from(w in "widgets",
      where: w.slug in ^@slugs,
      select: %{id: w.id, slug: w.slug, template: w.template}
    )
    |> repo().all()
    |> Enum.each(fn %{id: id, slug: slug, template: template} ->
      case root_font_size(template, &convert.(slug, &1)) do
        :keep ->
          :ok

        template ->
          from(w in "widgets", where: w.id == ^id)
          |> repo().update_all(set: [template: template])
      end
    end)
  end

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

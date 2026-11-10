defmodule Castmill.Repo.Migrations.MakeTextFittingExplicit do
  @moduledoc """
  Template texts are now only fitted to their container (measured and observed)
  when they declare `opts.autofit`; otherwise they keep their `em` size, which
  follows the widget's size. Before, every text was fitted.

  Existing widgets keep their behaviour: every text component without `autofit`
  gets `"autofit": {}` (fill the container), in widgets of every scope.
  """
  use Ecto.Migration

  import Ecto.Query

  def up, do: update_templates(&add_autofit/1)
  def down, do: update_templates(&remove_empty_autofit/1)

  # Schemaless, so later Widget schema fields do not break this migration.
  defp update_templates(convert) do
    from(w in "widgets", select: %{id: w.id, template: w.template})
    |> repo().all()
    |> Enum.each(fn %{id: id, template: template} ->
      updated = walk(template, convert)

      if updated != template do
        from(w in "widgets", where: w.id == ^id)
        |> repo().update_all(set: [template: updated])
      end
    end)
  end

  defp walk(%{"type" => "text"} = component, convert),
    do: component |> convert.() |> Map.new(fn {k, v} -> {k, walk(v, convert)} end)

  defp walk(%{} = map, convert), do: Map.new(map, fn {k, v} -> {k, walk(v, convert)} end)
  defp walk(list, convert) when is_list(list), do: Enum.map(list, &walk(&1, convert))
  defp walk(value, _convert), do: value

  defp add_autofit(component) do
    opts = if is_map(component["opts"]), do: component["opts"], else: %{}

    if Map.has_key?(opts, "autofit"),
      do: component,
      else: Map.put(component, "opts", Map.put(opts, "autofit", %{}))
  end

  defp remove_empty_autofit(%{"opts" => %{"autofit" => autofit} = opts} = component)
       when autofit == %{},
       do: Map.put(component, "opts", Map.delete(opts, "autofit"))

  defp remove_empty_autofit(component), do: component
end

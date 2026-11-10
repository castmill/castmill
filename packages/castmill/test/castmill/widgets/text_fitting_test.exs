defmodule Castmill.Widgets.TextFittingTest do
  # Texts are only fitted when they declare autofit; the MakeTextFittingExplicit
  # migration added it to every text of the existing widgets.
  use Castmill.DataCase, async: true

  alias Castmill.Widgets.Widget

  defp texts(%{"type" => "text"} = component), do: [component]

  defp texts(%{} = map), do: map |> Map.values() |> Enum.flat_map(&texts/1)
  defp texts(list) when is_list(list), do: Enum.flat_map(list, &texts/1)
  defp texts(_value), do: []

  test "the texts of existing widgets keep fitting their containers" do
    texts =
      Widget
      |> Repo.all()
      |> Enum.flat_map(&texts(&1.template))

    assert length(texts) > 10
    assert Enum.all?(texts, &is_map(&1["opts"]["autofit"])), "every text declares autofit"

    rss = Repo.get_by!(Widget, slug: "rss-news")
    assert Enum.any?(texts(rss.template), &(&1["opts"]["autofit"] == %{}))
  end
end

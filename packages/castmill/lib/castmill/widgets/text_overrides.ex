defmodule Castmill.Widgets.TextOverrides do
  @moduledoc """
  Validates the reserved `overrides` option of template widgets with editable texts
  (see `agents/systems/IN-PLACE-TEXT-EDITING.md`).

      "overrides" => %{
        "street" => %{"text" => "Hemlig adress"},
        "viewings" => %{"hidden" => true}
      }

  Keys that no longer match an editable text are kept, so the dashboard can list
  them as unused.
  """

  alias Castmill.Widgets.TemplateBindings

  @max_entries 200
  @max_key_length 200

  def max_entries, do: @max_entries

  @doc """
  True when the widget reserves `overrides`: its template has editable texts and its
  options_schema doesn't declare an `overrides` option of its own.
  """
  def reserved?(%{template: template, options_schema: schema}) do
    not Map.has_key?(schema || %{}, "overrides") and TemplateBindings.editables(template) != []
  end

  def reserved?(_widget), do: false

  @doc """
  Validates `overrides` against the widget's editable texts. Returns `:ok` or
  `{:error, message}`.
  """
  def validate(nil, _widget), do: :ok

  def validate(overrides, widget) when is_map(overrides) do
    editables = TemplateBindings.editables(widget.template)

    limits =
      for %{key: key, max_length: max} when is_binary(key) <- editables, into: %{}, do: {key, max}

    # Keys of texts inside lists come from bindings and can't be known here.
    fallback =
      editables
      |> Enum.map(& &1.max_length)
      |> Enum.max(fn -> TemplateBindings.default_max_length() end)

    if map_size(overrides) > @max_entries do
      {:error, "has more than #{@max_entries} entries"}
    else
      Enum.reduce_while(overrides, :ok, fn {key, value}, :ok ->
        case validate_entry(key, value, Map.get(limits, key, fallback)) do
          :ok -> {:cont, :ok}
          {:error, message} -> {:halt, {:error, "#{inspect(key)} #{message}"}}
        end
      end)
    end
  end

  def validate(_overrides, _widget), do: {:error, "must be an object"}

  defp validate_entry(key, _value, _max)
       when not is_binary(key) or key == "" or byte_size(key) > @max_key_length * 4,
       do: {:error, "is not a valid key"}

  defp validate_entry(key, value, max) do
    cond do
      String.length(key) > @max_key_length ->
        {:error, "is longer than #{@max_key_length} characters"}

      value == %{"hidden" => true} ->
        :ok

      match?(%{"text" => text} when is_binary(text), value) and map_size(value) == 1 ->
        if String.length(value["text"]) <= max,
          do: :ok,
          else: {:error, "text is longer than #{max} characters"}

      true ->
        {:error, ~s(must be {"text": "…"} or {"hidden": true})}
    end
  end
end

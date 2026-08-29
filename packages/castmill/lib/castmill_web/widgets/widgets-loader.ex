defmodule CastmillWeb.Widgets.WidgetsLoader do
  alias Ecto.Adapters.SQL
  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  @json_dir Application.compile_env(:castmill, CastmillWeb.Widgets.WidgetsLoader)[:json_dir]

  def load_and_insert_json_data do
    normalize_stringified_translations()

    @json_dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, ".json"))
    |> Enum.each(&insert_or_update_json_data_from_file/1)
  end

  # Some deployments may contain widgets.translations stored as a JSON string
  # instead of a JSON object. Normalize those rows before Ecto tries to load them.
  defp normalize_stringified_translations do
    SQL.query!(
      Repo,
      """
      UPDATE widgets
      SET translations = (translations #>> '{}')::jsonb
      WHERE translations IS NOT NULL
        AND jsonb_typeof(translations) = 'string'
      """,
      []
    )
  end

  defp insert_or_update_json_data_from_file(file) do
    full_path = Path.join(@json_dir, file)

    case File.read(full_path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, widget_data} when is_map(widget_data) ->
            update_or_insert_widget(widget_data["name"], widget_data)

          {:error, reason} ->
            IO.puts("Failed to decode JSON from file: #{file}, reason: #{reason}")

          _ ->
            IO.puts("Unexpected data structure in JSON file: #{file}")
        end

      {:error, reason} ->
        IO.puts("Failed to read file: #{full_path}, reason: #{reason}")
    end
  end

  defp update_or_insert_widget(name, widget_data) do
    Repo.transaction(fn ->
      slug = slugify(name)
      widget = Widget |> Repo.get_by(slug: slug)

      # Preserve existing icon and small_icon if not provided in JSON
      widget_data_with_icons =
        case widget do
          nil ->
            widget_data

          existing ->
            widget_data
            |> maybe_preserve_field("icon", existing.icon)
            |> maybe_preserve_field("small_icon", existing.small_icon)
        end

      changeset =
        case widget do
          nil ->
            %Widget{} |> Widget.changeset(Map.put(widget_data_with_icons, "slug", slug))

          _ ->
            Widget.changeset(widget, Map.put(widget_data_with_icons, "slug", slug))
        end

      case Repo.insert_or_update(changeset) do
        {:ok, _widget} ->
          :ok

        {:error, _changeset} ->
          IO.puts("Failed to insert/update widget: #{inspect(changeset)}")
      end
    end)
  end

  # Preserve existing field value if not provided in new data
  defp maybe_preserve_field(widget_data, field, existing_value) do
    if Map.has_key?(widget_data, field) do
      widget_data
    else
      Map.put(widget_data, field, existing_value)
    end
  end

  defp slugify(name) do
    name
    |> String.downcase()
    # Remove non-alphanumeric except spaces
    |> String.replace(~r/[^\w\s]/, "")
    # Replace spaces with dashes
    |> String.replace(~r/\s+/, "-")
  end
end

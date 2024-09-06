defmodule CastmillWeb.Widgets.WidgetsLoader do
  alias Castmill.Repo
  alias Castmill.Widgets.Widget

  @json_dir Application.compile_env(:castmill, CastmillWeb.Widgets.WidgetsLoader)[:json_dir]

  def load_and_insert_json_data do
    @json_dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, ".json"))
    |> Enum.each(&insert_or_update_json_data_from_file/1)
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

      changeset =
        case widget do
          nil ->
            %Widget{} |> Widget.changeset(Map.put(widget_data, "slug", slug))

          _ ->
            Widget.changeset(widget, Map.put(widget_data, "slug", slug))
        end

      case Repo.insert_or_update(changeset) do
        {:ok, _widget} ->
          :ok

        {:error, _changeset} ->
          IO.puts("Failed to insert/update widget: #{inspect(changeset)}")
      end
    end)
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

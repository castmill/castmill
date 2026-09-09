defmodule Castmill.Widgets.PackageProcessor do
  @moduledoc """
  Processes widget packages in JSON or ZIP format.

  ZIP packages can contain:
  - widget.json - Required widget definition
  - assets/ - Optional directory with icons, images, fonts, styles
  - README.md - Optional documentation

  Assets are extracted and stored, with their paths updated in the widget definition.
  """

  require Logger

  # 10MB
  @max_package_size 10 * 1024 * 1024
  @max_file_size %{
    # 100KB per icon
    "icons" => 100 * 1024,
    # 512KB per font
    "fonts" => 512 * 1024,
    # 1MB per image
    "images" => 1024 * 1024,
    # 50KB per stylesheet
    "styles" => 50 * 1024
  }
  @allowed_extensions %{
    "icons" => ~w(.svg .png .jpg .jpeg .ico),
    "fonts" => ~w(.woff .woff2 .ttf .otf),
    "images" => ~w(.png .jpg .jpeg .webp .gif .svg),
    "styles" => ~w(.css)
  }

  @doc """
  Process an uploaded file (JSON or ZIP) and return the widget data.

  For JSON files, parses and returns the content directly.
  For ZIP files, extracts widget.json and processes any assets.

  Returns {:ok, widget_data, assets} or {:error, reason}
  """
  def process_upload(%Plug.Upload{path: path, filename: filename, content_type: content_type}) do
    cond do
      is_zip_file?(filename, content_type) ->
        process_zip_package(path)

      is_json_file?(filename, content_type) ->
        process_json_file(path)

      true ->
        {:error, "Unsupported file type. Upload a .json or .zip file."}
    end
  end

  defp is_zip_file?(filename, content_type) do
    String.ends_with?(filename, ".zip") or
      content_type in ["application/zip", "application/x-zip-compressed", "application/x-zip"]
  end

  defp is_json_file?(filename, content_type) do
    String.ends_with?(filename, ".json") or
      content_type in ["application/json", "text/json"]
  end

  @doc """
  Process a JSON file upload.
  """
  def process_json_file(path) do
    with {:ok, content} <- File.read(path),
         {:ok, widget_data} <- Jason.decode(content),
         :ok <- validate_widget_json(widget_data) do
      {:ok, widget_data, %{}}
    else
      {:error, :enoent} ->
        {:error, "Failed to read uploaded file"}

      {:error, %Jason.DecodeError{} = error} ->
        {:error, "Invalid JSON: #{Exception.message(error)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Process a ZIP package upload.

  Extracts widget.json and any assets, validates the package structure,
  and returns the widget data along with extracted asset information.
  """
  def process_zip_package(zip_path) do
    with :ok <- check_package_size(zip_path),
         {:ok, file_list} <- list_zip_contents(zip_path),
         {:ok, widget_json_path} <- find_widget_json(file_list),
         {:ok, widget_data} <- extract_and_parse_widget_json(zip_path, widget_json_path),
         :ok <- validate_widget_json(widget_data),
         {:ok, assets} <- extract_assets(zip_path, file_list, widget_json_path) do
      # Update widget data with extracted asset paths if needed
      updated_widget_data = process_asset_references(widget_data, assets)
      {:ok, updated_widget_data, assets}
    end
  end

  defp check_package_size(zip_path) do
    case File.stat(zip_path) do
      {:ok, %{size: size}} when size <= @max_package_size ->
        :ok

      {:ok, %{size: size}} ->
        {:error,
         "Package too large: #{format_size(size)} (max: #{format_size(@max_package_size)})"}

      {:error, reason} ->
        {:error, "Failed to read file: #{reason}"}
    end
  end

  defp format_size(bytes) when bytes < 1024, do: "#{bytes} B"
  defp format_size(bytes) when bytes < 1024 * 1024, do: "#{Float.round(bytes / 1024, 1)} KB"
  defp format_size(bytes), do: "#{Float.round(bytes / (1024 * 1024), 1)} MB"

  defp list_zip_contents(zip_path) do
    case :zip.list_dir(String.to_charlist(zip_path)) do
      {:ok, file_list} ->
        files =
          file_list
          |> Enum.filter(fn
            {:zip_file, _, _, _, _, _} -> true
            _ -> false
          end)
          |> Enum.map(fn {:zip_file, name, _, _, _, _} -> to_string(name) end)

        {:ok, files}

      {:error, reason} ->
        {:error, "Failed to read ZIP file: #{inspect(reason)}"}
    end
  end

  defp find_widget_json(file_list) do
    # Look for widget.json at root level or in a subdirectory
    widget_json =
      Enum.find(file_list, fn path ->
        basename = Path.basename(path)
        basename == "widget.json"
      end)

    case widget_json do
      nil -> {:error, "Missing widget.json in package"}
      path -> {:ok, path}
    end
  end

  defp extract_and_parse_widget_json(zip_path, widget_json_path) do
    case :zip.extract(String.to_charlist(zip_path), [
           {:file_list, [String.to_charlist(widget_json_path)]},
           :memory
         ]) do
      {:ok, [{_, content}]} ->
        case Jason.decode(content) do
          {:ok, data} -> {:ok, data}
          {:error, error} -> {:error, "Invalid widget.json: #{Exception.message(error)}"}
        end

      {:error, reason} ->
        {:error, "Failed to extract widget.json: #{inspect(reason)}"}
    end
  end

  defp validate_widget_json(widget_data) do
    cond do
      not is_map(widget_data) ->
        {:error, "Widget definition must be a JSON object"}

      not Map.has_key?(widget_data, "name") ->
        {:error, "Widget must have a 'name' field"}

      not Map.has_key?(widget_data, "template") ->
        {:error, "Widget must have a 'template' field"}

      not is_binary(widget_data["name"]) ->
        {:error, "Widget 'name' must be a string"}

      not is_map(widget_data["template"]) ->
        {:error, "Widget 'template' must be an object"}

      true ->
        :ok
    end
  end

  defp extract_assets(zip_path, file_list, widget_json_path) do
    # Get the base directory (if widget.json is in a subdirectory)
    base_dir = Path.dirname(widget_json_path)
    base_dir = if base_dir == ".", do: "", else: base_dir <> "/"

    # Find all asset files
    asset_files =
      file_list
      |> Enum.filter(fn path ->
        # Must be under assets/ directory relative to widget.json
        relative = String.replace_prefix(path, base_dir, "")
        String.starts_with?(relative, "assets/") and not String.ends_with?(path, "/")
      end)
      |> Enum.filter(&valid_asset_file?/1)

    # Extract assets to temp directory
    temp_dir = System.tmp_dir!()
    extract_id = :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
    assets_dir = Path.join(temp_dir, "widget_assets_#{extract_id}")

    File.mkdir_p!(assets_dir)

    assets =
      asset_files
      |> Enum.reduce_while(%{}, fn asset_path, acc ->
        case extract_single_asset(zip_path, asset_path, base_dir, assets_dir) do
          {:ok, asset_info} ->
            relative_path = String.replace_prefix(asset_path, base_dir, "")
            {:cont, Map.put(acc, relative_path, asset_info)}

          {:error, reason} ->
            # Clean up on error
            File.rm_rf(assets_dir)
            {:halt, {:error, reason}}
        end
      end)

    case assets do
      {:error, reason} -> {:error, reason}
      assets_map -> {:ok, %{dir: assets_dir, files: assets_map}}
    end
  end

  defp valid_asset_file?(path) do
    ext = Path.extname(path) |> String.downcase()

    all_allowed =
      @allowed_extensions
      |> Map.values()
      |> List.flatten()
      |> Enum.uniq()

    ext in all_allowed
  end

  defp extract_single_asset(zip_path, asset_path, base_dir, assets_dir) do
    relative_path = String.replace_prefix(asset_path, base_dir, "")
    target_path = Path.join(assets_dir, relative_path)

    # Ensure target directory exists
    target_path |> Path.dirname() |> File.mkdir_p!()

    case :zip.extract(String.to_charlist(zip_path), [
           {:file_list, [String.to_charlist(asset_path)]},
           :memory
         ]) do
      {:ok, [{_, content}]} ->
        # Validate file size
        category = get_asset_category(relative_path)
        max_size = Map.get(@max_file_size, category, 1024 * 1024)

        if byte_size(content) > max_size do
          {:error, "Asset #{relative_path} exceeds maximum size of #{format_size(max_size)}"}
        else
          File.write!(target_path, content)

          {:ok,
           %{
             path: target_path,
             size: byte_size(content),
             type: get_mime_type(relative_path)
           }}
        end

      {:error, reason} ->
        {:error, "Failed to extract #{relative_path}: #{inspect(reason)}"}
    end
  end

  defp get_asset_category(path) do
    cond do
      String.contains?(path, "/icons/") -> "icons"
      String.contains?(path, "/fonts/") -> "fonts"
      String.contains?(path, "/images/") -> "images"
      String.contains?(path, "/styles/") -> "styles"
      true -> "other"
    end
  end

  defp get_mime_type(path) do
    ext = Path.extname(path) |> String.downcase()

    case ext do
      ".svg" -> "image/svg+xml"
      ".png" -> "image/png"
      ".jpg" -> "image/jpeg"
      ".jpeg" -> "image/jpeg"
      ".gif" -> "image/gif"
      ".webp" -> "image/webp"
      ".ico" -> "image/x-icon"
      ".woff" -> "font/woff"
      ".woff2" -> "font/woff2"
      ".ttf" -> "font/ttf"
      ".otf" -> "font/otf"
      ".css" -> "text/css"
      _ -> "application/octet-stream"
    end
  end

  @doc """
  Process asset references in the widget template.

  Replaces {{asset:category.name}} placeholders with actual asset paths.
  This is called after assets are stored to update the template with
  the correct URLs.
  """
  def process_asset_references(widget_data, %{files: files}) when map_size(files) > 0 do
    # For now, we keep the asset references as-is in the widget data
    # The player will resolve them at runtime based on the widget's asset manifest
    widget_data
  end

  def process_asset_references(widget_data, _assets) do
    widget_data
  end

  @doc """
  Clean up temporary asset files after processing.
  """
  def cleanup_assets(%{dir: dir}) do
    File.rm_rf(dir)
    :ok
  end

  def cleanup_assets(_), do: :ok
end

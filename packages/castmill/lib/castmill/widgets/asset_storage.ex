defmodule Castmill.Widgets.AssetStorage do
  @moduledoc """
  Handles persistent storage and retrieval of widget assets.

  Assets are stored in `priv/static/widget_assets/{widget_slug}/`
  and served via the `/widget_assets/:slug/*path` route.
  """

  require Logger

  @assets_dir "priv/static/widget_assets"

  @doc """
  Returns the base directory for widget assets.
  """
  def assets_base_dir do
    Application.app_dir(:castmill, @assets_dir)
  end

  @doc """
  Returns the directory for a specific widget's assets.
  """
  def widget_assets_dir(widget_slug) do
    Path.join(assets_base_dir(), widget_slug)
  end

  @doc """
  Returns the public URL path for a widget's assets.
  """
  def widget_assets_url(widget_slug) do
    "/widget_assets/#{widget_slug}"
  end

  @doc """
  Stores assets from a temporary extraction directory to permanent storage.

  Returns {:ok, stored_assets} with updated paths, or {:error, reason}
  """
  def store_assets(widget_slug, %{dir: temp_dir, files: files}) when map_size(files) > 0 do
    target_dir = widget_assets_dir(widget_slug)

    # Clean up existing assets for this widget
    if File.exists?(target_dir) do
      File.rm_rf!(target_dir)
    end

    File.mkdir_p!(target_dir)

    stored_files =
      files
      |> Enum.reduce_while(%{}, fn {relative_path, file_info}, acc ->
        source_path = file_info.path
        target_path = Path.join(target_dir, relative_path)

        # Ensure target directory exists
        target_path |> Path.dirname() |> File.mkdir_p!()

        case File.copy(source_path, target_path) do
          {:ok, _} ->
            public_url = "#{widget_assets_url(widget_slug)}/#{relative_path}"
            updated_info = Map.put(file_info, :url, public_url)
            {:cont, Map.put(acc, relative_path, updated_info)}

          {:error, reason} ->
            Logger.error("Failed to copy asset #{relative_path}: #{inspect(reason)}")
            {:halt, {:error, "Failed to store asset #{relative_path}: #{reason}"}}
        end
      end)

    case stored_files do
      {:error, _} = error ->
        error

      files_map ->
        {:ok, %{dir: target_dir, files: files_map, base_url: widget_assets_url(widget_slug)}}
    end
  end

  def store_assets(_widget_slug, _assets), do: {:ok, %{files: %{}}}

  @doc """
  Resolves the icon field to a full URL if it's a relative asset path.
  """
  def resolve_icon(icon, widget_slug, stored_assets) when is_binary(icon) do
    cond do
      # Already a data URL or absolute URL
      String.starts_with?(icon, "data:") or String.starts_with?(icon, "http") ->
        icon

      # Relative path - check if it's in stored assets
      true ->
        base_url = widget_assets_url(widget_slug)
        "#{base_url}/#{icon}"
    end
  end

  def resolve_icon(icon, _widget_slug, _stored_assets), do: icon

  @doc """
  Extracts font metadata from widget assets and returns a list of font definitions
  suitable for the player's FontFace API.

  Parses the assets.fonts section from widget.json and creates URL mappings.
  Each font entry should have a "path" and optional "name" field.

  Returns a list of %{\"url\" => string, \"name\" => string} maps.
  """
  def extract_fonts(widget_data, widget_slug, stored_assets) do
    assets = Map.get(widget_data, "assets", %{})
    fonts_config = Map.get(assets, "fonts", %{})

    fonts_config
    |> Enum.map(fn {font_key, font_info} ->
      path = Map.get(font_info, "path")
      # Use the font key as the name if no explicit name is provided
      # Strip extension and format nicely (e.g., "PlayfairDisplay-Regular" -> "Playfair Display")
      name = Map.get(font_info, "name") || format_font_name(font_key, path)

      if path do
        # Resolve the path to a full URL
        url = resolve_asset_url(path, widget_slug, stored_assets)
        %{"url" => url, "name" => name}
      else
        nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  # Resolves a relative asset path to a full URL
  defp resolve_asset_url(path, widget_slug, _stored_assets) do
    # The path is stored as-is (e.g., "assets/fonts/Lato-Regular.woff2")
    # so we use it directly without modification
    "#{widget_assets_url(widget_slug)}/#{path}"
  end

  # Format font name from key or path
  defp format_font_name(font_key, path) do
    # Try to create a nice font name from the key or path
    base_name =
      if path do
        Path.basename(path)
        # Remove extension
        |> Path.rootname()
      else
        font_key
      end

    # Convert camelCase/PascalCase to spaces, handle hyphens
    base_name
    |> String.replace(~r/([a-z])([A-Z])/, "\\1 \\2")
    |> String.replace("-", " ")
    |> String.replace("_", " ")
    |> String.split()
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  @doc """
  Deletes all assets for a widget.
  """
  def delete_assets(widget_slug) do
    target_dir = widget_assets_dir(widget_slug)

    if File.exists?(target_dir) do
      File.rm_rf!(target_dir)
    end

    :ok
  end

  @doc """
  Gets the full path for an asset file.
  Returns {:ok, path} if the file exists, {:error, :not_found} otherwise.
  """
  def get_asset_path(widget_slug, asset_path) do
    # Prevent directory traversal attacks
    if String.contains?(asset_path, "..") do
      {:error, :invalid_path}
    else
      full_path = Path.join(widget_assets_dir(widget_slug), asset_path)

      if File.exists?(full_path) and File.regular?(full_path) do
        {:ok, full_path}
      else
        {:error, :not_found}
      end
    end
  end

  @doc """
  Gets the MIME type for a file based on its extension.
  """
  def get_mime_type(path) do
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
end

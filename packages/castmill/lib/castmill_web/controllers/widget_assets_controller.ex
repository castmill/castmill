defmodule CastmillWeb.WidgetAssetsController do
  @moduledoc """
  Serves static assets for uploaded widgets.

  Assets are stored in `priv/static/widget_assets/{widget_slug}/`
  and served via GET /widget_assets/:slug/*path
  """

  use CastmillWeb, :controller

  alias Castmill.Widgets.AssetStorage

  @doc """
  Serves a widget asset file.
  """
  def show(conn, %{"slug" => slug, "path" => path_segments}) do
    # Join path segments (handles nested paths like assets/icons/logo.svg)
    asset_path = Path.join(path_segments)

    case AssetStorage.get_asset_path(slug, asset_path) do
      {:ok, file_path} ->
        mime_type = AssetStorage.get_mime_type(file_path)

        conn
        |> put_resp_content_type(mime_type)
        |> put_resp_header("cache-control", "public, max-age=31536000, immutable")
        |> send_file(200, file_path)

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Asset not found"})

      {:error, :invalid_path} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid asset path"})
    end
  end
end

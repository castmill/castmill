defmodule CastmillWeb.PlaylistController do
  use CastmillWeb, :controller

  alias Castmill.Resources
  alias Castmill.Resources.PlaylistItem

  action_fallback(CastmillWeb.FallbackController)

  # TODO: It would be better to handle the missing or invalid fields in the changeset
  def add_item(
        %Plug.Conn{
          body_params: %{
            "prev_item_id" => prev_item_id,
            "widget_id" => widget_id,
            "offset" => offset,
            "duration" => duration,
            "options" => options
          }
        } = conn,
        %{"playlist_id" => playlist_id}
      ) do
    with {:ok, item} <-
           Resources.insert_item_into_playlist(
             playlist_id,
             prev_item_id,
             widget_id,
             offset,
             duration,
             options
           ) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/playlists/#{playlist_id}/items/#{item.id}")
      |> render(:show, item: item)
    end
  end

  # Catch-all function to handle the case when not all fields are present
  def add_item(conn, %{"playlist_id" => _playlist_id}) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing required fields"})
  end

  def update_item(conn, %{"playlist_id" => playlist_id, "id" => id, "item" => item_params}) do
    with {:ok, %PlaylistItem{} = item} <- Resources.get_playlist_item(playlist_id, id) do
      {:ok, item} = Resources.update_playlist_item(item, item_params)

      conn
      |> put_status(:ok)
      |> render(:show, item: item)
    end
  end

  def show_item(conn, %{"playlist_id" => playlist_id, "id" => id}) do
    with {:ok, %PlaylistItem{} = item} <- Resources.get_playlist_item(playlist_id, id) do
      conn
      |> put_status(:ok)
      |> render(:show, item: item)
    end
  end

  def delete_item(conn, %{"playlist_id" => _playlist_id, "item_id" => item_id}) do
    {:ok, _} = Resources.remove_item_from_playlist(item_id)

    conn
    |> send_resp(:no_content, "")
  end
end

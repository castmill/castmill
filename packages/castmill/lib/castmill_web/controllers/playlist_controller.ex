defmodule CastmillWeb.PlaylistController do
  use CastmillWeb, :controller

  alias Castmill.Resources
  alias Castmill.Resources.PlaylistItem
  alias Castmill.Widgets

  action_fallback(CastmillWeb.FallbackController)

  # TODO: It would be better to handle the missing or invalid fields in the changeset
  def add_item(
        %Plug.Conn{
          body_params:
            %{
              "widget_id" => widget_id,
              "offset" => offset,
              "duration" => duration,
              "options" => options
            } = params
        } = conn,
        %{"playlist_id" => playlist_id}
      ) do
    result =
      Resources.insert_item_into_playlist(
        playlist_id,
        params["prev_item_id"],
        widget_id,
        offset,
        duration,
        options
      )

    case result do
      {:ok, item} ->
        conn
        |> put_status(:created)
        |> put_resp_header("location", ~p"/api/playlists/#{playlist_id}/items/#{item.id}")
        |> render(:show, item: item)

      error ->
        error
    end
  end

  # Catch-all function to handle the case when not all fields are present
  def add_item(conn, %{"playlist_id" => _playlist_id}) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing required fields"})
  end

  # Allows updating stuff like duration, offset or transitions.
  def update_item(conn, %{
        "playlist_id" => playlist_id,
        "item_id" => item_id,
        "options" => options_params
      }) do
    with %PlaylistItem{} = item <- Resources.get_playlist_item(playlist_id, item_id) do
      {:ok, item} = Resources.update_playlist_item(item, options_params)

      conn
      |> put_status(:ok)
      |> render(:show, item: item)
    end
  end

  def update_widget_config(conn, %{
        "playlist_id" => playlist_id,
        "item_id" => item_id,
        "config" => widget_config_params
      }) do
    case Widgets.update_widget_config(
           playlist_id,
           item_id,
           widget_config_params["options"],
           widget_config_params["data"]
         ) do
      {:ok, _} ->
        conn
        |> send_resp(:no_content, "")

      {:error, :circular_reference} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Cannot select this playlist as it would create a circular reference"})
        |> halt()

      {:error, _} = error ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to update widget config due to #{inspect(error)}"})
        |> halt()
    end
  end

  def move_item(conn, %{
        "playlist_id" => playlist_id,
        "item_id" => item_id,
        "target_id" => target_id
      }) do
    # Validate if the target_id is a valid item in the playlist or intended to move the item to the end
    case target_id do
      nil ->
        # Proceed to move the item to the end of the playlist
        perform_move_item(conn, item_id, nil)

      _ ->
        # Attempt to retrieve the target item
        case Resources.get_playlist_item(playlist_id, target_id) do
          nil ->
            # If no item is found, return an error response immediately
            conn
            |> put_status(:bad_request)
            |> json(%{error: "Target item not found in the playlist."})
            |> halt()

          _item ->
            # Proceed if item is found
            perform_move_item(conn, item_id, target_id)
        end
    end
  end

  defp perform_move_item(conn, item_id, target_id) do
    case Resources.move_item_in_playlist(item_id, target_id) do
      {:ok, _} ->
        # Successfully moved the item
        conn
        |> send_resp(:no_content, "")

      {:error, _} = error ->
        # Handle errors from moving the item
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to move item due to #{inspect(error)}"})
        |> halt()
    end
  end

  def show_item(conn, %{"playlist_id" => playlist_id, "id" => id}) do
    with {:ok, %PlaylistItem{} = item} <- Resources.get_playlist_item(playlist_id, id) do
      conn
      |> put_status(:ok)
      |> render(:show, item: item)
    end
  end

  def delete_item(conn, %{"playlist_id" => playlist_id, "item_id" => item_id}) do
    {:ok, _} = Resources.remove_item_from_playlist(playlist_id, item_id)

    conn
    |> send_resp(:no_content, "")
  end

  @doc """
  Returns the list of ancestor playlist IDs for a given playlist.
  Ancestors are playlists that contain layout widgets referencing this playlist.
  This is used to prevent circular references when configuring layout widgets.
  """
  def get_ancestors(conn, %{"playlist_id" => playlist_id}) do
    playlist_id = String.to_integer(playlist_id)
    ancestor_ids = Resources.get_playlist_ancestors(playlist_id)

    conn
    |> put_status(:ok)
    |> json(%{ancestor_ids: ancestor_ids})
  end
end

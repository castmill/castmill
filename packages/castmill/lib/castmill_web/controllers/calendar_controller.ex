defmodule CastmillWeb.CalendarController do
  use CastmillWeb, :controller

  alias Castmill.Files
  alias Castmill.Files.File

  action_fallback(CastmillWeb.FallbackController)

  def index(conn, %{"calendar_id" => calendar_id}) do
    files = Files.get_media_files(calendar_id)
    render(conn, :index, files: files)
  end

  def create(%Plug.Conn{body_params: body_params} = conn, %{"calendar_id" => calendar_id} = params) do
    with {:ok, %File{} = file} <-
           Files.create_file(params) do
      Files.add_file_to_media(file.id, calendar_id, body_params["context"] || "default")

      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/medias/#{calendar_id}/files#{file.id}")
      |> render(:create, file: file)
    end
  end

  def delete(
        conn,
        %{
          "calendar_id" => calendar_id,
          "id" => file_id,
          "organization_id" => organization_id
        }
      ) do
    case Files.delete_file(file_id, calendar_id, organization_id) do
      {:ok, _count} ->
        send_resp(conn, :no_content, "")

      :error ->
        send_resp(conn, :not_found, "")
    end
  end
end

defmodule CastmillWeb.LegacyPlayerController do
  use CastmillWeb, :controller

  def index(conn, _params) do
    index_path = Application.app_dir(:castmill, "priv/static/legacy/index.html")

    if File.exists?(index_path) do
      conn
      |> put_resp_content_type("text/html")
      |> send_file(200, index_path)
    else
      conn
      |> put_resp_content_type("text/html")
      |> send_resp(404, "Legacy player not available")
    end
  end
end

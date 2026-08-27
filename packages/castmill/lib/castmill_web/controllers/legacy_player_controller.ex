defmodule CastmillWeb.LegacyPlayerController do
  use CastmillWeb, :controller

  def index(conn, _params) do
    index_path = Application.app_dir(:castmill, "priv/static/legacy/index.html")

    conn
    |> put_resp_content_type("text/html")
    |> send_file(200, index_path)
  end
end

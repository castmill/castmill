defmodule CastmillWeb.LegacyPlayerController do
  use CastmillWeb, :controller

  require Logger

  @max_log_bytes 32_768
  @max_log_entries 50

  def index(conn, _params) do
    index_path = Application.app_dir(:castmill, "priv/static/legacy/index.html")

    if File.exists?(index_path) do
      conn
      |> put_resp_content_type("text/html")
      |> put_resp_header("cache-control", "no-cache")
      |> send_file(200, index_path)
    else
      conn
      |> put_resp_content_type("text/html")
      |> send_resp(404, "Legacy player not available")
    end
  end

  def log(conn, %{"payload" => payload}) do
    cond do
      byte_size(Jason.encode!(payload)) > @max_log_bytes ->
        conn |> put_status(:request_entity_too_large) |> json(%{error: "Log payload too large"})

      is_binary(payload) ->
        Logger.info("Legacy player log: #{inspect(payload)}")
        json(conn, %{ok: true})

      is_map(payload) and is_list(payload["logs"]) and
          length(payload["logs"]) <= @max_log_entries ->
        Logger.info("Legacy player logs: #{inspect(payload["logs"])}")
        json(conn, %{ok: true})

      true ->
        conn |> put_status(:bad_request) |> json(%{error: "Invalid log payload"})
    end
  end

  def log(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "Invalid log payload"})
  end
end

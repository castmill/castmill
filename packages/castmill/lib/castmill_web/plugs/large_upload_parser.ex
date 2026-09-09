defmodule CastmillWeb.Plugs.LargeUploadParser do
  @moduledoc """
  A plug that wraps Plug.Parsers for multipart uploads and catches
  RequestTooLargeError to return a JSON response instead of HTML.
  """

  @behaviour Plug

  @impl true
  def init(opts), do: Plug.Parsers.init(opts)

  @impl true
  def call(conn, opts) do
    Plug.Parsers.call(conn, opts)
  rescue
    Plug.Parsers.RequestTooLargeError ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.send_resp(
        413,
        Jason.encode!(%{
          error: "File too large",
          message: "The file size exceeds the maximum allowed upload size"
        })
      )
      |> Plug.Conn.halt()
  end
end

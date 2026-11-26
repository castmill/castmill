defmodule CastmillWeb.EndpointCorsPathsTest do
  # Changes the global :cors_any_origin_paths configuration.
  use CastmillWeb.ConnCase, async: false

  setup do
    previous = Application.fetch_env(:castmill, :cors_any_origin_paths)

    on_exit(fn ->
      case previous do
        {:ok, paths} -> Application.put_env(:castmill, :cors_any_origin_paths, paths)
        :error -> Application.delete_env(:castmill, :cors_any_origin_paths)
      end
    end)
  end

  defp preflight(path, origin) do
    :options
    |> Plug.Test.conn(path)
    |> Plug.Conn.put_req_header("origin", origin)
    |> Plug.Conn.put_req_header("access-control-request-method", "GET")
    |> Plug.Conn.put_req_header("access-control-request-headers", "authorization")
    |> CORSPlug.call(
      CORSPlug.init(
        origin: &CastmillWeb.Endpoint.getAllowedOrigins/1,
        credentials: true
      )
    )
  end

  test "keeps the device API limited to known origins by default" do
    Application.delete_env(:castmill, :cors_any_origin_paths)

    conn = preflight("/devices/device-id/channels", "https://player.example.com")

    assert Plug.Conn.get_resp_header(conn, "access-control-allow-origin") == []
  end

  test "allows any origin for configured path prefixes" do
    Application.put_env(:castmill, :cors_any_origin_paths, ["/devices/"])

    conn = preflight("/devices/device-id/channels", "https://player.example.com")

    assert conn.status == 204
    assert Plug.Conn.get_resp_header(conn, "access-control-allow-origin") == ["*"]

    assert "Authorization" in (conn
                               |> Plug.Conn.get_resp_header("access-control-allow-headers")
                               |> hd()
                               |> String.split(","))

    assert Plug.Conn.get_resp_header(
             preflight("/dashboard/devices/device-id", "https://player.example.com"),
             "access-control-allow-origin"
           ) == []
  end

  test "matches entries without a trailing slash exactly" do
    Application.put_env(:castmill, :cors_any_origin_paths, ["/status"])

    assert Plug.Conn.get_resp_header(
             preflight("/status", "https://player.example.com"),
             "access-control-allow-origin"
           ) == ["*"]

    assert Plug.Conn.get_resp_header(
             preflight("/status/details", "https://player.example.com"),
             "access-control-allow-origin"
           ) == []
  end
end

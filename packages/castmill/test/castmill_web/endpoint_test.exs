defmodule CastmillWeb.EndpointTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures

  test "allows local browser players to fetch resources through a LAN address" do
    network_fixture(%{domain: "192.168.68.57:4000"})

    conn =
      :options
      |> Plug.Test.conn("/medias/media-id/poster.jpg")
      |> Plug.Conn.put_req_header("origin", "http://localhost:4000")
      |> Plug.Conn.put_req_header("access-control-request-method", "GET")
      |> CORSPlug.call(
        CORSPlug.init(
          origin: &CastmillWeb.Endpoint.getAllowedOrigins/1,
          credentials: true
        )
      )

    assert Plug.Conn.get_resp_header(conn, "access-control-allow-origin") == [
             "http://localhost:4000"
           ]
  end

  test "allows the standalone legacy adapter development origin" do
    conn =
      :options
      |> Plug.Test.conn("/devices/device-id/channels")
      |> Plug.Conn.put_req_header("origin", "http://localhost:3003")
      |> Plug.Conn.put_req_header("access-control-request-method", "GET")
      |> CORSPlug.call(
        CORSPlug.init(
          origin: &CastmillWeb.Endpoint.getAllowedOrigins/1,
          credentials: true
        )
      )

    assert Plug.Conn.get_resp_header(conn, "access-control-allow-origin") == [
             "http://localhost:3003"
           ]
  end

  test "allows a file-based legacy WebOS wrapper to post logs" do
    conn =
      :options
      |> Plug.Test.conn("/legacy/log")
      |> Plug.Conn.put_req_header("origin", "null")
      |> Plug.Conn.put_req_header("access-control-request-method", "POST")
      |> Plug.Conn.put_req_header("access-control-request-headers", "content-type")
      |> CORSPlug.call(
        CORSPlug.init(
          origin: &CastmillWeb.Endpoint.getAllowedOrigins/1,
          credentials: true
        )
      )

    assert conn.status == 204
    assert Plug.Conn.get_resp_header(conn, "access-control-allow-origin") == ["*"]

    assert "Content-Type" in (conn
                              |> Plug.Conn.get_resp_header("access-control-allow-headers")
                              |> hd()
                              |> String.split(","))

    assert "POST" in (conn
                      |> Plug.Conn.get_resp_header("access-control-allow-methods")
                      |> hd()
                      |> String.split(","))
  end
end

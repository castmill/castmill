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
end

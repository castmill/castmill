defmodule CastmillWeb.RouterAuthTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.AccountsFixtures
  import Castmill.OrganizationsFixtures

  test "uses the auth query parameter when the authorization header is blank", %{conn: conn} do
    user = user_fixture()
    access_token = access_token_fixture(%{secret: "query-param-secret", user_id: user.id})
    auth = URI.encode_www_form("Bearer #{access_token.secret}")

    conn =
      conn
      |> put_req_header("authorization", "   ")
      |> get("/api/users/#{user.id}?auth=#{auth}")

    assert json_response(conn, 200)["data"]["id"] == user.id
  end
end

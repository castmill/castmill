defmodule CastmillWeb.AccessTokenControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.AccountsFixtures
  alias Castmill.Accounts.AccessToken

  @create_attrs %{
    accessed: 42,
    accessed_at: ~D[2023-03-25],
    last_ip: "some last_ip"
  }
  @update_attrs %{
    accessed: 43,
    accessed_at: ~D[2023-03-26],
    last_ip: "some updated last_ip"
  }
  @invalid_attrs %{accessed: nil, accessed_at: nil, last_ip: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all access_tokens", %{conn: conn} do
      conn = get(conn, ~p"/api/access_tokens")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create access_token" do
    test "renders access_token when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/access_tokens", access_token: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/access_tokens/#{id}")

      assert %{
               "id" => ^id,
               "accessed" => 42,
               "accessed_at" => "2023-03-25",
               "last_ip" => "some last_ip"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/access_tokens", access_token: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update access_token" do
    setup [:create_access_token]

    test "renders access_token when data is valid", %{conn: conn, access_token: %AccessToken{id: id} = access_token} do
      conn = put(conn, ~p"/api/access_tokens/#{access_token}", access_token: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/access_tokens/#{id}")

      assert %{
               "id" => ^id,
               "accessed" => 43,
               "accessed_at" => "2023-03-26",
               "last_ip" => "some updated last_ip"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, access_token: access_token} do
      conn = put(conn, ~p"/api/access_tokens/#{access_token}", access_token: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete access_token" do
    setup [:create_access_token]

    test "deletes chosen access_token", %{conn: conn, access_token: access_token} do
      conn = delete(conn, ~p"/api/access_tokens/#{access_token}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/access_tokens/#{access_token}")
      end
    end
  end

  defp create_access_token(_) do
    access_token = access_token_fixture()
    %{access_token: access_token}
  end
end

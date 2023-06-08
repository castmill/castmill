defmodule CastmillWeb.NetworkControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures

  alias Castmill.Networks.Network

  @create_attrs %{
    copyright: "some copyright",
    domain: "some domain",
    email: "some email",
    logo: "some logo",
    name: "some name"
  }
  @update_attrs %{
    copyright: "some updated copyright",
    domain: "some updated domain",
    email: "some updated email",
    logo: "some updated logo",
    name: "some updated name"
  }
  @invalid_attrs %{copyright: nil, domain: nil, email: nil, logo: nil, name: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all networks", %{conn: conn} do
      conn = get(conn, ~p"/api/networks")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create network" do
    test "renders network when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/networks", network: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/networks/#{id}")

      assert %{
               "id" => ^id,
               "copyright" => "some copyright",
               "domain" => "some domain",
               "email" => "some email",
               "logo" => "some logo",
               "name" => "some name"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/networks", network: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update network" do
    setup [:create_network]

    test "renders network when data is valid", %{conn: conn, network: %Network{id: id} = network} do
      conn = put(conn, ~p"/api/networks/#{network}", network: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/networks/#{id}")

      assert %{
               "id" => ^id,
               "copyright" => "some updated copyright",
               "domain" => "some updated domain",
               "email" => "some updated email",
               "logo" => "some updated logo",
               "name" => "some updated name"
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, network: network} do
      conn = put(conn, ~p"/api/networks/#{network}", network: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete network" do
    setup [:create_network]

    test "deletes chosen network", %{conn: conn, network: network} do
      conn = delete(conn, ~p"/api/networks/#{network}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/networks/#{network}")
      end
    end
  end

  defp create_network(_) do
    network = network_fixture()
    %{network: network}
  end
end

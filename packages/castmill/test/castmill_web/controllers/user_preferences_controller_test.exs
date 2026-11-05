defmodule CastmillWeb.UserPreferencesControllerTest do
  use CastmillWeb.ConnCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts

  setup %{conn: conn} do
    network = network_fixture()
    user = user_fixture(%{network_id: network.id})
    other_user = user_fixture(%{network_id: network.id})

    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> put_bearer_auth(user)

    %{conn: conn, user: user, other_user: other_user}
  end

  describe "GET /dashboard/users/:user_id/preferences" do
    test "returns empty preferences by default", %{conn: conn, user: user} do
      conn = get(conn, "/dashboard/users/#{user.id}/preferences")
      assert json_response(conn, 200) == %{"data" => %{}}
    end

    test "returns the stored theme", %{conn: conn, user: user} do
      {:ok, _} = Accounts.update_user_preferences(user, %{"theme" => "light"})

      conn = get(conn, "/dashboard/users/#{user.id}/preferences")
      assert json_response(conn, 200) == %{"data" => %{"theme" => "light"}}
    end

    test "forbids reading another user's preferences", %{conn: conn, other_user: other} do
      conn = get(conn, "/dashboard/users/#{other.id}/preferences")
      assert json_response(conn, 403)
    end

    test "requires authentication", %{user: user} do
      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> get("/dashboard/users/#{user.id}/preferences")

      assert conn.status == 401
    end
  end

  describe "PUT /dashboard/users/:user_id/preferences" do
    test "stores the theme and preserves other meta", %{conn: conn, user: user} do
      {:ok, _} = Accounts.update_credential_name(user.id, "cred-1", "Laptop")

      conn =
        put(conn, "/dashboard/users/#{user.id}/preferences", %{
          "preferences" => %{"theme" => "light"}
        })

      assert json_response(conn, 200) == %{"data" => %{"theme" => "light"}}

      reloaded = Accounts.get_user(user.id)
      assert reloaded.meta["preferences"] == %{"theme" => "light"}
      assert reloaded.meta["credential_names"] == %{"cred-1" => "Laptop"}
    end

    test "switches back to dark", %{conn: conn, user: user} do
      {:ok, _} = Accounts.update_user_preferences(user, %{"theme" => "light"})

      conn =
        put(conn, "/dashboard/users/#{user.id}/preferences", %{
          "preferences" => %{"theme" => "dark"}
        })

      assert json_response(conn, 200) == %{"data" => %{"theme" => "dark"}}
    end

    test "rejects invalid themes", %{conn: conn, user: user} do
      conn =
        put(conn, "/dashboard/users/#{user.id}/preferences", %{
          "preferences" => %{"theme" => "purple"}
        })

      assert json_response(conn, 422)
      assert Accounts.get_user_preferences(Accounts.get_user(user.id)) == %{}
    end

    test "forbids updating another user's preferences", %{conn: conn, other_user: other} do
      conn =
        put(conn, "/dashboard/users/#{other.id}/preferences", %{
          "preferences" => %{"theme" => "light"}
        })

      assert json_response(conn, 403)
      assert Accounts.get_user_preferences(Accounts.get_user(other.id)) == %{}
    end
  end
end

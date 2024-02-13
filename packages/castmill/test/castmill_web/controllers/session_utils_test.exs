defmodule CastmillWeb.SessionUtilsTest do
  use CastmillWeb.ConnCase, async: true
  import Mox

  alias CastmillWeb.SessionUtils

  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures


  # Setup Mox for each test
  setup :verify_on_exit!

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

    access_token =
      access_token_fixture(%{secret: "testuser:testpass", user_id: user.id, is_root: true})

    # Mock the function call
    Mox.stub(Castmill.AccountsMock, :generate_user_session_token, fn _user_id ->
      "mock_token"
    end)

    # Ensure the application uses the mock instead of the real Accounts module
    Application.put_env(:castmill, :accounts, Castmill.AccountsMock)

    # Setup session and headers without directly using Plug.Session
    conn =
      conn
      # Simulate having the user ID in the session
      |> Plug.Test.init_test_session(user_id: user.id)
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{access_token.secret}")

    {:ok, conn: conn, user: user, organization: organization}
  end

  describe "new_challenge/0" do
    test "generates a cryptographically secure challenge" do
      challenge = CastmillWeb.SessionUtils.new_challenge()
      assert byte_size(Base.url_decode64!(challenge, padding: false)) == 64
    end
  end

  describe "check_client_data_json/1" do
    test "validates input correctly" do
      valid_input = %{
        "type" => "webauthn.get",
        "challenge" => "dummy_challenge",
        "origin" => CastmillWeb.Envs.get_dashboard_uri()
      }

      assert CastmillWeb.SessionUtils.check_client_data_json(valid_input) ==
               {:ok, "dummy_challenge"}

      invalid_input = %{"invalid" => "data"}
      assert CastmillWeb.SessionUtils.check_client_data_json(invalid_input) == false
    end
  end

  describe "log_in_user/3" do
    test "logs in the user and sets session token", %{conn: conn, user: user} do
      user_id = user.id
      params = %{}

      conn = SessionUtils.log_in_user(conn, user_id, params)

      assert get_session(conn, :user) == user
      assert get_session(conn, :user_session_token) == "mock_token"
    end

    test "sets remember_me cookie if parameter is true", %{conn: conn, user: user} do
      user_id = user.id
      params = %{"remember_me" => true}

      # Adjusted to use the UUID
      conn = CastmillWeb.SessionUtils.log_in_user(conn, user_id, params)

      assert Map.has_key?(conn.resp_cookies, "remember_me_token")
      remember_me_cookie = conn.resp_cookies["remember_me_token"]

      assert remember_me_cookie.value == "mock_token"
      # Your assertions regarding the cookie properties go here
    end
  end
end

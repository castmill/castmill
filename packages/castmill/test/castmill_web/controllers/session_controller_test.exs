defmodule CastmillWeb.SessionControllerTest do
  use CastmillWeb.ConnCase

  alias CastmillWeb.Router.Helpers
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id})

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

    {:ok, conn: conn, user: user, organization: organization}
  end

  describe "create_challenge/2" do
    test "creates a new challenge", %{conn: conn} do
      conn = get(conn, Helpers.session_path(conn, :create_challenge))
      assert json_response(conn, 200)
      challenge = get_session(conn, :webauthn_challenge)
      assert challenge
    end
  end

  describe "get/2" do
    test "returns error if not logged in", %{conn: conn} do
      conn = get(conn, Helpers.session_path(conn, :get))
      assert json_response(conn, 401) == %{"status" => "error", "message" => "Not logged in"}
    end

    test "returns current user if logged in", %{conn: conn} do
      user = %{"id" => "some_id", "name" => "John Doe"}
      conn = conn |> put_session(:user, user) |> get(Helpers.session_path(conn, :get))
      assert json_response(conn, 200) == %{"status" => "ok", "user" => user}
    end
  end

  describe "login_user/2" do
    # setup do
    # Mock dependencies here
    # end

    test "successfully logs in user", %{conn: _conn} do
      # Setup test data and expectations
      # Perform the login request
      # Assert on response and session data
    end

    test "handles invalid login attempt", %{conn: _conn} do
      # Setup test data for an invalid request
      # Perform the login request
      # Assert that login fails with unauthorized status
    end
  end

  describe "logout_user/2" do
    test "clears session data on logout", %{conn: conn} do
      # Setup session data
      conn = put_session(conn, :user, %{id: "user_id"})
      conn = delete(conn, Helpers.session_path(conn, :logout_user))

      assert json_response(conn, 200) == %{"status" => "ok"}

      # Attempt to retrieve a cleared session value
      logged_out_user = get_session(conn, :user)

      # Assert the value is nil, indicating the session key has been cleared
      assert logged_out_user == nil
    end
  end
end

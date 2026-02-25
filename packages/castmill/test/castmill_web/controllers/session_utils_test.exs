defmodule CastmillWeb.SessionUtilsTest do
  use CastmillWeb.ConnCase, async: true
  import Mox

  alias CastmillWeb.SessionUtils
  alias Castmill.Accounts.User
  alias Castmill.Organizations.Organization

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

    {:ok, conn: conn, user: user, organization: organization, network: network}
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
        "origin" => "http://localhost:3000"
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

  describe "check_user_blocked_status/1" do
    test "returns error for nil user" do
      assert SessionUtils.check_user_blocked_status(nil) == {:error, :user_not_found}
    end

    test "returns ok for non-blocked user", %{user: user} do
      assert {:ok, ^user} = SessionUtils.check_user_blocked_status(user)
    end

    test "returns error when user is directly blocked", %{user: user} do
      {:ok, blocked_user} =
        user
        |> User.block_changeset(%{
          blocked_at: DateTime.utc_now(),
          blocked_reason: "Test block reason"
        })
        |> Castmill.Repo.update()

      assert {:error, {:user_blocked, "Test block reason"}} =
               SessionUtils.check_user_blocked_status(blocked_user)
    end

    test "returns error with default message when user is blocked without reason", %{user: user} do
      {:ok, blocked_user} =
        user
        |> User.block_changeset(%{
          blocked_at: DateTime.utc_now(),
          blocked_reason: nil
        })
        |> Castmill.Repo.update()

      assert {:error, {:user_blocked, "Your account has been blocked"}} =
               SessionUtils.check_user_blocked_status(blocked_user)
    end

    test "returns error when user's organization is blocked", %{network: network} do
      # Create an organization that we can block (use unique name)
      unique_id = System.unique_integer([:positive])
      org = organization_fixture(%{network_id: network.id, name: "Test Org #{unique_id}"})

      # Create user and add them to the organization
      user = user_fixture(%{network_id: network.id})

      # Add user to organization (this creates the join table entry)
      {:ok, _} =
        Castmill.Organizations.add_user(org.id, user.id, :member)

      # Block the organization
      {:ok, _blocked_org} =
        org
        |> Organization.block_changeset(%{
          blocked_at: DateTime.utc_now(),
          blocked_reason: "Organization violated terms"
        })
        |> Castmill.Repo.update()

      # Reload user with fresh data
      user = Castmill.Accounts.get_user(user.id)

      assert {:error, {:organization_blocked, "Organization violated terms"}} =
               SessionUtils.check_user_blocked_status(user)
    end

    test "network admin is NOT blocked when their organization is blocked", %{
      network: network
    } do
      # Create an organization (use unique name)
      unique_id = System.unique_integer([:positive])
      org = organization_fixture(%{network_id: network.id, name: "Admin Org #{unique_id}"})

      # Create a network admin user
      admin_user = user_fixture(%{network_id: network.id, network_role: :admin})

      # Add admin to the organization
      {:ok, _} =
        Castmill.Organizations.add_user(org.id, admin_user.id, :admin)

      # Block the organization
      {:ok, _blocked_org} =
        org
        |> Organization.block_changeset(%{
          blocked_at: DateTime.utc_now(),
          blocked_reason: "Organization blocked"
        })
        |> Castmill.Repo.update()

      # Reload user with fresh data
      admin_user = Castmill.Accounts.get_user(admin_user.id)

      # Network admin should still be able to login
      assert {:ok, ^admin_user} = SessionUtils.check_user_blocked_status(admin_user)
    end

    test "network admin CAN still be blocked directly", %{network: network} do
      # Create an organization (use unique name)
      unique_id = System.unique_integer([:positive])
      org = organization_fixture(%{network_id: network.id, name: "Block Admin Org #{unique_id}"})

      # Create a network admin user
      admin_user = user_fixture(%{network_id: network.id, network_role: :admin})

      # Add admin to the organization
      {:ok, _} =
        Castmill.Organizations.add_user(org.id, admin_user.id, :admin)

      # Block the user directly
      {:ok, blocked_admin} =
        admin_user
        |> User.block_changeset(%{
          blocked_at: DateTime.utc_now(),
          blocked_reason: "Admin blocked for misconduct"
        })
        |> Castmill.Repo.update()

      # Network admin should be blocked when blocked directly
      assert {:error, {:user_blocked, "Admin blocked for misconduct"}} =
               SessionUtils.check_user_blocked_status(blocked_admin)
    end
  end

  describe "is_network_admin?/1" do
    test "returns true for network admin", %{network: network} do
      admin_user =
        user_fixture(%{network_id: network.id, network_role: :admin})

      assert SessionUtils.is_network_admin?(admin_user) == true
    end

    test "returns false for regular member", %{user: user} do
      assert SessionUtils.is_network_admin?(user) == false
    end

    test "returns false for user not in any network" do
      user = user_fixture(%{email: "no_network@test.com", name: "No Network"})
      assert SessionUtils.is_network_admin?(user) == false
    end
  end
end

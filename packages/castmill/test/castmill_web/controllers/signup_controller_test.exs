defmodule CastmillWeb.SignUpControllerTest do
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  alias CastmillWeb.Router.Helpers
  alias CastmillWeb.Router.Helpers, as: Routes

  # Import or define any necessary fixture functions here
  import Castmill.AccountsFixtures
  import Swoosh.TestAssertions

  @moduletag :signups

  setup %{conn: conn} do
    Mox.stub(Castmill.AccountsMock, :generate_user_session_token, fn _user_id ->
      "mock_token"
    end)

    {:ok, conn: conn}
  end

  describe "create_challenge/2 - for invitation flow" do
    test "creates signup challenge without sending email", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com"})

      email = "newuser@example.com"
      invitation_token = "test-invitation-token"

      conn =
        post(conn, Routes.sign_up_path(conn, :create_challenge), %{
          email: email,
          invitation_token: invitation_token
        })

      response = json_response(conn, 201)
      assert response["signup_id"]
      assert response["challenge"]

      # Ensure NO email was sent (unlike regular signup)
      refute_email_sent()
    end

    test "returns error when origin is missing", %{conn: conn} do
      conn =
        post(conn, Routes.sign_up_path(conn, :create_challenge), %{
          email: "test@example.com",
          invitation_token: "token"
        })

      response = json_response(conn, 422)
      assert response["status"] == "error"
      assert response["msg"] == "Missing origin"
    end

    test "returns error when network not found", %{conn: conn} do
      origin = "https://unknown.com"
      conn = put_req_header(conn, "origin", origin)

      conn =
        post(conn, Routes.sign_up_path(conn, :create_challenge), %{
          email: "test@example.com",
          invitation_token: "token"
        })

      response = json_response(conn, 422)
      assert response["status"] == "error"
      assert response["msg"] == "Network not found"
    end
  end

  describe "create/2" do
    test "returns error when origin header is missing", %{conn: conn} do
      email = "test@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 422)
      assert response["status"] == "error"
      assert response["msg"] == "Missing origin"
    end

    test "returns error when network is not found", %{conn: conn} do
      origin = "https://unknown.com"
      conn = put_req_header(conn, "origin", origin)

      email = "test@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 422)
      assert response["status"] == "error"
      assert response["msg"] == "Network not found"
    end

    test "successfully creates a signup and returns serialized data", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com"})

      email = "test@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 201)
      assert response["status"] == "ok"
      assert response["signup"]

      signup = response["signup"]
      assert signup["email"] == email
      assert signup["challenge"]
      assert signup["inserted_at"]
      assert signup["updated_at"]
      refute Map.has_key?(signup, "__meta__")
      refute Map.has_key?(signup, "password_hash")

      # Ensure an email was sent
      assert_email_sent(subject: "Complete Your Castmill Signup")
    end

    test "successfully creates a signup and sends instructions", %{conn: conn} do
      origin = "https://example.com"
      # Setting the origin header
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com"})

      email = "test@example.com"

      conn =
        post(conn, Helpers.sign_up_path(conn, :create), %{email: email})

      assert json_response(conn, 201)["status"] == "ok"

      # Use Swoosh test helpers to assert an email was sent
      assert_email_sent(subject: "Complete Your Castmill Signup")
    end

    test "handles errors during signup creation", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com"})

      # Simulate invalid email
      email = nil

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 422)
      assert response["status"] == "error"
      # Optionally check for specific error messages
    end
  end

  describe "create_user/2" do
    setup do
      # Define or use a fixture function
      network = network_fixture(%{domain: "example.com"})
      challenge = CastmillWeb.SessionUtils.new_challenge()

      signup =
        signup_fixture(%{email: "user@example.com", network_id: network.id, challenge: challenge})

      {:ok, signup: signup}
    end

    test "successfully creates a user from a signup", %{conn: conn, signup: signup} do
      valid_params = %{
        "id" => signup.id,
        "email" => signup.email,
        "credential_id" => "some_credential_id",
        "public_key_spki" => Base.encode64("public_key")
      }

      conn =
        post(
          conn,
          Helpers.sign_up_path(conn, :create_user, signup.id),
          valid_params
        )

      assert json_response(conn, 201)["status"] == "ok"
      # Assert the user was logged in
      assert get_session(conn, :user)
    end

    test "handles errors during user creation from signup", %{conn: conn, signup: signup} do
      invalid_params = %{
        "id" => "invalid",
        "email" => "not_existing@example.com",
        "credential_id" => "invalid_credential_id",
        "public_key_spki" => Base.encode64("invalid_key")
      }

      conn =
        post(
          conn,
          Helpers.sign_up_path(conn, :create_user, signup.id),
          invalid_params
        )

      assert json_response(conn, 422)["status"] == "error"
    end
  end

  describe "invitation_only mode" do
    test "blocks signup when invitation_only is enabled", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com", invitation_only: true})

      email = "test@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 403)
      assert response["status"] == "error"
      assert response["msg"] =~ "invitation"
    end

    test "allows signup when invitation_only is disabled", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com", invitation_only: false})

      email = "test@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create), %{email: email})

      response = json_response(conn, 201)
      assert response["status"] == "ok"
    end

    test "allows challenge creation with valid invitation token", %{conn: conn} do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      network = network_fixture(%{domain: "example.com", invitation_only: true})

      email = "invited@example.com"

      # Create a network invitation
      {:ok, invitation} =
        Castmill.Networks.invite_user_to_new_organization(network.id, email, "New Org")

      conn =
        post(conn, Routes.sign_up_path(conn, :create_challenge), %{
          email: email,
          invitation_token: invitation.token
        })

      response = json_response(conn, 201)
      assert response["signup_id"]
      assert response["challenge"]
    end

    test "blocks challenge creation without valid invitation when invitation_only", %{
      conn: conn
    } do
      origin = "https://example.com"
      conn = put_req_header(conn, "origin", origin)
      _network = network_fixture(%{domain: "example.com", invitation_only: true})

      email = "uninvited@example.com"

      conn =
        post(conn, Routes.sign_up_path(conn, :create_challenge), %{
          email: email,
          invitation_token: "invalid-token"
        })

      response = json_response(conn, 403)
      assert response["status"] == "error"
      assert response["msg"] =~ "invitation required"
    end
  end
end

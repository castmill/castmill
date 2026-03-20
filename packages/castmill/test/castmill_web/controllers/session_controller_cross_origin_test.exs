defmodule CastmillWeb.SessionControllerCrossOriginTest do
  @moduledoc """
  Tests for the cross-origin WebAuthn login flow using signed challenge tokens.
  Verifies that login works without session cookies and that challenges are
  single-use (replay protection via ChallengeStore).
  """
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  setup %{conn: conn} do
    # Create network with a known domain for check_client_data_json
    network = network_fixture(%{domain: "localhost:4000"})
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id, network_id: network.id})

    # Generate an ECDSA P-256 key pair for WebAuthn
    private_key = X509.PrivateKey.new_ec(:secp256r1)
    public_key_der = private_key |> X509.PublicKey.derive() |> X509.PublicKey.to_der()

    # Store credential in DB
    credential_id = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

    {:ok, _credential} =
      Castmill.Accounts.add_user_credential(user.id, credential_id, public_key_der)

    # Stub the mock so log_in_user's generate_user_session_token works
    Mox.stub(Castmill.AccountsMock, :generate_user_session_token, fn _user_id ->
      "mock_session_token"
    end)

    Application.put_env(:castmill, :accounts, Castmill.AccountsMock)

    conn =
      conn
      |> Plug.Test.init_test_session(%{})
      |> put_req_header("accept", "application/json")

    {:ok,
     conn: conn,
     user: user,
     network: network,
     private_key: private_key,
     credential_id: credential_id}
  end

  # ── Helpers ─────────────────────────────────────────────────────────

  # Build a valid WebAuthn assertion (navigator.credentials.get result)
  # that will pass verify_signature, check_client_data_json, and RP ID check.
  defp build_login_assertion(private_key, credential_id, challenge, origin) do
    rp_id = URI.parse(origin).host
    rp_id_hash = :crypto.hash(:sha256, rp_id)

    # authenticator_data = RP ID hash (32) + flags (1) + counter (4)
    flags = <<0x01>>
    counter = <<0, 0, 0, 1>>
    authenticator_data = rp_id_hash <> flags <> counter

    client_data_json_str =
      Jason.encode!(%{
        "type" => "webauthn.get",
        "challenge" => challenge,
        "origin" => origin
      })

    # WebAuthn signature covers: authenticator_data || SHA-256(clientDataJSON)
    client_data_hash = :crypto.hash(:sha256, client_data_json_str)
    signed_message = authenticator_data <> client_data_hash
    signature = :public_key.sign(signed_message, :sha256, private_key)

    %{
      "credential_id" => credential_id,
      "authenticator_data" => Base.encode64(authenticator_data),
      "signature" => Base.encode64(signature),
      "client_data_json" => client_data_json_str
    }
  end

  # Build a completely fresh conn with no session state
  defp fresh_conn do
    build_conn()
    |> Plug.Test.init_test_session(%{})
    |> put_req_header("accept", "application/json")
  end

  # ── Tests ───────────────────────────────────────────────────────────

  describe "cross-origin login with challenge_token" do
    test "login succeeds with challenge_token when session challenge is missing", %{
      private_key: private_key,
      credential_id: credential_id,
      network: network,
      conn: conn
    } do
      # Step 1: Get challenge + token from the server
      conn1 = get(conn, ~p"/sessions/challenges")
      body = json_response(conn1, 200)
      challenge = body["challenge"]
      challenge_token = body["challenge_token"]

      assert challenge
      assert challenge_token

      # Step 2: Login on a completely fresh conn (no session carry-over,
      #         simulating a cross-origin request where cookies are blocked)
      origin = "http://#{network.domain}"
      params = build_login_assertion(private_key, credential_id, challenge, origin)
      params = Map.put(params, "challenge_token", challenge_token)

      conn2 = post(fresh_conn(), ~p"/sessions/", params)
      response = json_response(conn2, 200)
      assert response["status"] == "ok"
      # Verify the response includes user data and token so the frontend
      # can establish a session without a follow-up cookie-dependent GET
      assert response["user"]["id"]
      assert response["user"]["email"]
      assert is_binary(response["token"])
    end

    test "replayed assertion is rejected (challenge already consumed)", %{
      private_key: private_key,
      credential_id: credential_id,
      network: network,
      conn: conn
    } do
      # Get challenge
      conn1 = get(conn, ~p"/sessions/challenges")
      body = json_response(conn1, 200)
      challenge = body["challenge"]
      challenge_token = body["challenge_token"]

      origin = "http://#{network.domain}"
      params = build_login_assertion(private_key, credential_id, challenge, origin)
      params = Map.put(params, "challenge_token", challenge_token)

      # First login succeeds
      conn2 = post(fresh_conn(), ~p"/sessions/", params)
      assert json_response(conn2, 200)["status"] == "ok"

      # Replay the exact same assertion → rejected
      conn3 = post(fresh_conn(), ~p"/sessions/", params)
      assert json_response(conn3, 401)["status"] == "error"
    end

    test "expired challenge_token is rejected", %{
      private_key: private_key,
      credential_id: credential_id,
      network: _network
    } do
      challenge = CastmillWeb.SessionUtils.new_challenge()
      CastmillWeb.ChallengeStore.put(challenge)

      # Sign the token with a timestamp > 5 minutes in the past so that
      # Phoenix.Token.verify with max_age: 300 treats it as expired.
      expired_token =
        Phoenix.Token.sign(
          CastmillWeb.Endpoint,
          "CastmillWeb.SessionController.challenge.v1",
          challenge,
          signed_at: System.system_time(:second) - 301
        )

      origin = "http://localhost:4000"
      params = build_login_assertion(private_key, credential_id, challenge, origin)
      params = Map.put(params, "challenge_token", expired_token)

      conn = post(fresh_conn(), ~p"/sessions/", params)
      assert json_response(conn, 401)["status"] == "error"
    end

    test "invalid challenge_token (tampered) is rejected", %{
      private_key: private_key,
      credential_id: credential_id,
      network: network,
      conn: conn
    } do
      # Get a real challenge
      conn1 = get(conn, ~p"/sessions/challenges")
      body = json_response(conn1, 200)
      challenge = body["challenge"]

      # Use challenge_token from a DIFFERENT challenge
      conn_other = get(fresh_conn() |> Plug.Test.init_test_session(%{}), ~p"/sessions/challenges")
      other_token = json_response(conn_other, 200)["challenge_token"]

      origin = "http://#{network.domain}"
      params = build_login_assertion(private_key, credential_id, challenge, origin)
      params = Map.put(params, "challenge_token", other_token)

      conn2 = post(fresh_conn(), ~p"/sessions/", params)
      assert json_response(conn2, 401)["status"] == "error"
    end
  end
end

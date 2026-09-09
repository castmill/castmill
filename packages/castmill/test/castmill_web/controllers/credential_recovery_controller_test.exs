defmodule CastmillWeb.CredentialRecoveryControllerTest do
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts.UserToken
  alias Castmill.Repo

  # The same salt used inside the controller
  @recovery_challenge_salt "CastmillWeb.CredentialRecovery.challenge.v1"

  setup %{conn: conn} do
    # Create network with a known domain so check_client_data_json can resolve it
    network = network_fixture(%{domain: "localhost:4000"})
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id, network_id: network.id})

    # Generate a valid recovery token (mirroring what deliver_user_recover_credentials_instructions does)
    {encoded_token, user_token} = UserToken.build_email_token(user, "recover_credentials")
    Repo.insert!(user_token)

    # Stub the accounts mock so log_in_user works
    Mox.stub(Castmill.AccountsMock, :generate_user_session_token, fn _user_id ->
      "mock_session_token"
    end)

    Application.put_env(:castmill, :accounts, Castmill.AccountsMock)

    conn =
      conn
      |> Plug.Test.init_test_session(%{})
      |> put_req_header("accept", "application/json")

    {:ok, conn: conn, user: user, network: network, token: encoded_token}
  end

  # ── Helper ────────────────────────────────────────────────────────────

  # Reproduce the same HMAC derivation used by the controller so we can
  # assert on expected challenge values.
  defp expected_challenge_for(token) do
    secret =
      Application.get_env(:castmill, CastmillWeb.Endpoint)[:secret_key_base] ||
        raise "missing secret_key_base in test config"

    signing_key = Plug.Crypto.KeyGenerator.generate(secret, @recovery_challenge_salt, length: 32)

    :crypto.mac(:hmac, :sha256, signing_key, token)
    |> Base.url_encode64(padding: false)
  end

  # ── POST /credentials/recover ──────────────────────────────────────

  describe "POST /credentials/recover (request_recovery)" do
    test "returns generic success message for an existing email", %{conn: conn, user: user} do
      conn = post(conn, ~p"/credentials/recover", %{"email" => user.email})
      body = json_response(conn, 200)
      assert body["status"] == "ok"
      assert body["message"] =~ "instructions"
    end

    test "returns same generic message for a non-existent email", %{conn: conn} do
      conn = post(conn, ~p"/credentials/recover", %{"email" => "nonexistent@example.com"})
      body = json_response(conn, 200)
      assert body["status"] == "ok"
      assert body["message"] =~ "instructions"
    end
  end

  # ── GET /credentials/recover/verify ────────────────────────────────

  describe "GET /credentials/recover/verify (verify_token)" do
    test "returns user info for a valid token", %{conn: conn, user: user, token: token} do
      conn = get(conn, ~p"/credentials/recover/verify", %{"token" => token})
      body = json_response(conn, 200)
      assert body["status"] == "ok"
      assert body["user"]["id"] == user.id
      assert body["user"]["email"] == user.email
    end

    test "rejects an invalid token", %{conn: conn} do
      conn = get(conn, ~p"/credentials/recover/verify", %{"token" => "bogus_token"})
      body = json_response(conn, 422)
      assert body["status"] == "error"
    end
  end

  # ── GET /credentials/recover/challenge ─────────────────────────────

  describe "GET /credentials/recover/challenge (create_recovery_challenge)" do
    test "returns a deterministic challenge for a given token", %{
      conn: conn,
      user: user,
      token: token
    } do
      conn1 = get(conn, ~p"/credentials/recover/challenge", %{"token" => token})
      body1 = json_response(conn1, 200)

      # Rebuild a fresh conn for the second call (same session-less scenario)
      conn2 =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")

      conn2 = get(conn2, ~p"/credentials/recover/challenge", %{"token" => token})
      body2 = json_response(conn2, 200)

      # Both calls must return the exact same challenge
      assert body1["challenge"] == body2["challenge"]
      assert body1["challenge"] == expected_challenge_for(token)

      # Sanity: response also includes user info
      assert body1["user_id"] == user.id
      assert body1["email"] == user.email
    end

    test "different tokens produce different challenges", %{conn: conn, user: user} do
      # Create a second token for the same user
      {token2, ut2} = UserToken.build_email_token(user, "recover_credentials")
      Repo.insert!(ut2)

      conn1 =
        conn
        |> get(~p"/credentials/recover/challenge", %{"token" => token2})

      body1 = json_response(conn1, 200)

      # Original token from setup
      conn2 =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")
        |> get(~p"/credentials/recover/challenge", %{"token" => token2})

      _ = json_response(conn2, 200)

      # The challenge must match the recomputed HMAC for token2
      assert body1["challenge"] == expected_challenge_for(token2)
    end

    test "rejects an invalid token", %{conn: conn} do
      conn = get(conn, ~p"/credentials/recover/challenge", %{"token" => "invalid"})
      assert json_response(conn, 422)["status"] == "error"
    end
  end

  # ── POST /credentials/recover/credential ───────────────────────────

  describe "POST /credentials/recover/credential (add_recovery_credential)" do
    test "succeeds without any prior session state", %{
      user: user,
      token: token,
      network: network
    } do
      # Build a completely fresh conn — no session carry-over
      conn =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")

      challenge = expected_challenge_for(token)

      # Construct a valid WebAuthn clientDataJSON whose origin matches the network domain
      client_data =
        Jason.encode!(%{
          "type" => "webauthn.create",
          "challenge" => challenge,
          "origin" => "http://#{network.domain}"
        })

      credential_id = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      # A minimal SPKI-encoded public key (doesn't matter for this test — we just need the flow to succeed)
      public_key_spki = Base.encode64(:crypto.strong_rand_bytes(64))

      conn =
        post(conn, ~p"/credentials/recover/credential", %{
          "token" => token,
          "credential_id" => credential_id,
          "public_key_spki" => public_key_spki,
          "client_data_json" => client_data
        })

      body = json_response(conn, 201)
      assert body["status"] == "ok"
      assert body["message"] =~ "Credential added"
      assert body["credential"]["id"]

      # The response includes user + token so the frontend can establish
      # a Bearer-auth session (no cookies/session writes).
      assert body["user"]["id"] == user.id
      assert is_binary(body["token"])
    end

    test "rejects when challenge does not match the token", %{
      token: token,
      network: network
    } do
      conn =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")

      # Use a completely wrong challenge
      wrong_challenge = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

      client_data =
        Jason.encode!(%{
          "type" => "webauthn.create",
          "challenge" => wrong_challenge,
          "origin" => "http://#{network.domain}"
        })

      conn =
        post(conn, ~p"/credentials/recover/credential", %{
          "token" => token,
          "credential_id" => "some-cred-id",
          "public_key_spki" => Base.encode64("fake-key"),
          "client_data_json" => client_data
        })

      assert json_response(conn, 401)["status"] == "error"
      assert json_response(conn, 401)["message"] =~ "Invalid challenge"
    end

    test "rejects when token is invalid or expired", %{network: network} do
      bogus_token = "totally_invalid_token"

      conn =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")

      # The challenge is derived from the bogus token — so it will be
      # self-consistent, but the token itself won't resolve to a user.
      challenge = expected_challenge_for(bogus_token)

      client_data =
        Jason.encode!(%{
          "type" => "webauthn.create",
          "challenge" => challenge,
          "origin" => "http://#{network.domain}"
        })

      conn =
        post(conn, ~p"/credentials/recover/credential", %{
          "token" => bogus_token,
          "credential_id" => "some-cred-id",
          "public_key_spki" => Base.encode64("fake-key"),
          "client_data_json" => client_data
        })

      assert json_response(conn, 422)["status"] == "error"
    end

    test "rejects when origin does not match any network", %{token: token} do
      conn =
        build_conn()
        |> Plug.Test.init_test_session(%{})
        |> put_req_header("accept", "application/json")

      challenge = expected_challenge_for(token)

      client_data =
        Jason.encode!(%{
          "type" => "webauthn.create",
          "challenge" => challenge,
          "origin" => "http://evil.example.com"
        })

      conn =
        post(conn, ~p"/credentials/recover/credential", %{
          "token" => token,
          "credential_id" => "some-cred-id",
          "public_key_spki" => Base.encode64("fake-key"),
          "client_data_json" => client_data
        })

      assert json_response(conn, 401)["status"] == "error"
    end
  end
end

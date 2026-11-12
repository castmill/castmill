defmodule CastmillWeb.AdminPasskeyControllerTest do
  use CastmillWeb.ConnCase, async: false
  import Phoenix.LiveViewTest
  import Castmill.{AccountsFixtures, AdminPasskeysFixtures, OrganizationsFixtures}

  alias Castmill.Accounts
  alias Castmill.Accounts.{AdminPasskeys, UserToken}
  alias Castmill.Repo

  setup do
    Castmill.RateLimiter.clear()
    root = user_fixture()
    access_token_fixture(%{user_id: root.id, secret: "#{root.email}:password", is_root: true})
    %{root: root, authenticator: authenticator_fixture()}
  end

  test "password bootstraps enrollment without granting admin access", %{conn: conn, root: root} do
    conn = bootstrap(conn, root)
    assert redirected_to(conn) == ~p"/admin/passkeys/enroll"
    refute get_session(conn, :admin_user_token)
    assert get_session(conn, :admin_enrollment_token)
    assert {:error, {:redirect, %{to: "/admin/login"}}} = live(recycle(conn), ~p"/admin")
    assert {:ok, _, html} = live(recycle(conn), ~p"/admin/passkeys/enroll")
    assert html =~ "Register your first passkey"
  end

  test "registration validates attestation and enables passkey-only login", ctx do
    {conn, options, registration} = registration_request(ctx)

    expected_handle = Base.url_encode64(AdminPasskeys.user_handle(ctx.root.id), padding: false)
    assert options["user"]["id"] == expected_handle
    refute options["user"]["id"] == Base.url_encode64(ctx.root.id, padding: false)

    replay_conn = recycle(conn)
    conn = post(recycle(conn), ~p"/admin/passkeys/register", registration)
    assert json_response(conn, 200)["redirect"] == "/admin/passkeys"
    assert AdminPasskeys.enrolled?(ctx.root.id)
    assert get_session(conn, :admin_user_token)
    refute get_session(conn, :admin_enrollment_token)
    assert {:ok, _, html} = live(recycle(conn), ~p"/admin/passkeys")
    assert html =~ "Test passkey"
    refute html =~ ">Remove<"

    conn = bootstrap(build_conn(), ctx.root)
    assert redirected_to(conn) == ~p"/admin/login"
    refute get_session(conn, :admin_enrollment_token)

    assert post(replay_conn, ~p"/admin/passkeys/register", registration)
           |> json_response(422)
  end

  test "real signed assertions log in, cannot replay, and log out cleanly", ctx do
    enroll(ctx)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    options = json_response(conn, 200)
    assert options["userVerification"] == "required"
    refute Map.has_key?(options, "allowCredentials")
    params = assertion_fixture(ctx.authenticator, options, ctx.root.id)
    replay_conn = recycle(conn)
    conn = post(recycle(conn), ~p"/admin/passkeys/login", params)
    assert json_response(conn, 200)["redirect"] == "/admin"
    token = get_session(conn, :admin_user_token)
    assert Accounts.get_user_by_admin_session_token(token).id == ctx.root.id
    assert Accounts.get_user_by_session_token(token) == nil
    assert {:ok, _, _} = live(recycle(conn), ~p"/admin")

    assert post(replay_conn, ~p"/admin/passkeys/login", params) |> json_response(401)
    conn = delete(recycle(conn), ~p"/admin/logout")
    assert redirected_to(conn) == ~p"/admin/login"
    assert Accounts.get_user_by_admin_session_token(token) == nil
  end

  test "supports RS256 passkeys as well as ES256", ctx do
    ctx = %{ctx | authenticator: rsa_authenticator_fixture()}
    enroll(ctx)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(200)
  end

  test "passkey sign-in returns to the requested admin page", ctx do
    enroll(ctx)
    conn = get(ctx.conn, ~p"/admin/networks")
    assert redirected_to(conn) == "/admin/login"
    conn = post(recycle(conn), ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    conn = post(recycle(conn), ~p"/admin/passkeys/login", params)
    assert json_response(conn, 200)["redirect"] == "/admin/networks"
  end

  test "supports the WebAuthn maximum credential ID length", ctx do
    authenticator = %{ctx.authenticator | id: :crypto.strong_rand_bytes(1023)}
    ctx = %{ctx | authenticator: authenticator}
    enroll(ctx)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    params = assertion_fixture(authenticator, json_response(conn, 200), ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(200)
  end

  test "WebAuthn endpoints reject requests without CSRF tokens", %{conn: conn} do
    conn = Plug.Conn.put_private(conn, :plug_skip_csrf_protection, false)

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      post(conn, ~p"/admin/passkeys/login/options", %{})
    end
  end

  test "rejects registration without attested credential data", ctx do
    {conn, options, params} = registration_request(ctx)
    auth_data = :crypto.hash(:sha256, options["rp"]["id"]) <> <<0x05, 0::32>>

    attestation =
      CBOR.encode(%{
        "fmt" => "none",
        "attStmt" => %{},
        "authData" => %CBOR.Tag{tag: :bytes, value: auth_data}
      })
      |> Base.url_encode64(padding: false)

    params = Map.put(params, "attestation_object", attestation)
    assert post(recycle(conn), ~p"/admin/passkeys/register", params) |> json_response(422)
  end

  test "malformed root-password input returns a login error", %{conn: conn} do
    for params <- [%{}, %{"user" => %{}}, %{"user" => %{"email" => [], "password" => nil}}] do
      assert post(conn, ~p"/admin/login", params) |> redirected_to() == "/admin/login"
    end
  end

  test "dashboard passkeys and dashboard user handles cannot authenticate to the admin tool",
       ctx do
    public_key =
      ctx.authenticator.cose_key |> Wax.CoseKey.to_erlang_public_key() |> X509.PublicKey.to_der()

    id = Base.url_encode64(ctx.authenticator.id, padding: false)
    {:ok, _} = Accounts.add_user_credential(ctx.root.id, id, public_key)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)

    enroll(ctx)
    conn = post(build_conn(), ~p"/admin/passkeys/login/options")

    dashboard_handle_params =
      assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id, %{
        user_handle: ctx.root.id
      })

    assert post(recycle(conn), ~p"/admin/passkeys/login", dashboard_handle_params)
           |> json_response(401)
  end

  test "blocked root users cannot bootstrap or use existing passkeys", ctx do
    conn = enroll(ctx)
    token = get_session(conn, :admin_user_token)
    ctx.root |> Accounts.User.block_changeset(%{blocked_at: DateTime.utc_now()}) |> Repo.update!()
    assert Accounts.get_user_by_admin_session_token(token) == nil
    assert bootstrap(build_conn(), ctx.root) |> redirected_to() == "/admin/login"
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)
  end

  for {name, overrides} <- [
        {"missing user verification", %{flags: 0x01}},
        {"missing user presence", %{flags: 0x04}},
        {"wrong origin", %{origin: "https://evil.example"}},
        {"wrong RP ID", %{rp_id: "evil.example"}},
        {"wrong ceremony", %{type: "webauthn.create"}},
        {"cross-origin iframe", %{cross_origin: true}}
      ] do
    test "authentication rejects #{name}", ctx do
      enroll(ctx)
      conn = post(ctx.conn, ~p"/admin/passkeys/login/options")

      params =
        assertion_fixture(
          ctx.authenticator,
          json_response(conn, 200),
          ctx.root.id,
          unquote(Macro.escape(overrides))
        )

      conn = post(recycle(conn), ~p"/admin/passkeys/login", params)
      assert json_response(conn, 401)["error"]
      refute get_session(conn, :admin_user_token)
    end
  end

  for {name, overrides} <- [
        {"missing user verification", %{flags: 0x41}},
        {"missing presence", %{flags: 0x44}},
        {"wrong origin", %{origin: "https://evil.example"}},
        {"wrong RP ID", %{rp_id: "evil.example"}},
        {"wrong ceremony", %{type: "webauthn.get"}},
        {"cross-origin iframe", %{cross_origin: true}}
      ] do
    test "registration rejects #{name}", ctx do
      {conn, options, _} = registration_request(ctx)
      params = registration_fixture(ctx.authenticator, options, unquote(Macro.escape(overrides)))
      assert post(recycle(conn), ~p"/admin/passkeys/register", params) |> json_response(422)
      refute AdminPasskeys.enrolled?(ctx.root.id)
    end
  end

  test "unknown credential, wrong handle, invalid signature and malformed payloads fail", ctx do
    enroll(ctx)

    for field <- ["id", "user_handle", "signature", "authenticator_data", "client_data"] do
      conn = post(build_conn(), ~p"/admin/passkeys/login/options")
      params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
      params = Map.put(params, field, "AAAA")
      assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)
    end

    for params <- [%{}, %{"client_data" => []}, %{"id" => "%invalid"}] do
      conn = post(build_conn(), ~p"/admin/passkeys/login/options")
      assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)
    end
  end

  test "challenges are bound to browser session and ceremony", ctx do
    {conn, options, registration} = registration_request(ctx)
    assert post(build_conn(), ~p"/admin/passkeys/register", registration) |> json_response(422)

    assertion =
      assertion_fixture(
        ctx.authenticator,
        %{"rpId" => "localhost", "challenge" => options["challenge"]},
        ctx.root.id
      )

    assert post(recycle(conn), ~p"/admin/passkeys/login", assertion) |> json_response(401)
  end

  test "expired and previously consumed challenges fail", ctx do
    enroll(ctx)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    options = json_response(conn, 200)
    CastmillWeb.ChallengeStore.consume(options["challenge"])
    params = assertion_fixture(ctx.authenticator, options, ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)

    conn = post(build_conn(), ~p"/admin/passkeys/login/options")
    options = json_response(conn, 200)

    Repo.update_all("webauthn_challenges",
      set: [expires_at: DateTime.add(DateTime.utc_now(), -1)]
    )

    params = assertion_fixture(ctx.authenticator, options, ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)
  end

  test "password bootstrap expires and cannot register a second key", ctx do
    {conn, _, registration} = registration_request(ctx)
    token = get_session(conn, :admin_enrollment_token)
    import Ecto.Query

    Repo.update_all(from(t in UserToken, where: t.token == ^token),
      set: [inserted_at: DateTime.add(DateTime.utc_now(), -301) |> DateTime.truncate(:second)]
    )

    assert post(recycle(conn), ~p"/admin/passkeys/register", registration) |> json_response(422)
    refute AdminPasskeys.enrolled?(ctx.root.id)

    {first, _, registration} = registration_request(ctx)
    {second, _, other} = registration_request(%{ctx | authenticator: authenticator_fixture()})
    assert post(recycle(first), ~p"/admin/passkeys/register", registration) |> json_response(200)
    assert post(recycle(second), ~p"/admin/passkeys/register", other) |> json_response(422)
    assert length(AdminPasskeys.list(ctx.root.id)) == 1
  end

  test "management permits a backup key, preserves the last key and revokes sessions", ctx do
    conn = enroll(ctx)
    old_token = get_session(conn, :admin_user_token)
    [first] = AdminPasskeys.list(ctx.root.id)
    result = delete(recycle(conn), ~p"/admin/passkeys/#{first.id}")
    assert redirected_to(result) == "/admin/passkeys"
    assert AdminPasskeys.get(first.id)

    options_conn = post(recycle(conn), ~p"/admin/passkeys/register/options")
    options = json_response(options_conn, 200)
    assert options["excludeCredentials"] == [%{"type" => "public-key", "id" => first.id}]
    registration = registration_fixture(authenticator_fixture(), options)
    conn = post(recycle(options_conn), ~p"/admin/passkeys/register", registration)
    assert json_response(conn, 200)
    assert Accounts.get_user_by_admin_session_token(old_token) == nil
    assert {:ok, _, html} = live(recycle(conn), ~p"/admin/passkeys")
    assert html =~ "Remove"
    current_token = get_session(conn, :admin_user_token)
    conn = delete(recycle(conn), ~p"/admin/passkeys/#{first.id}")
    assert redirected_to(conn) == "/admin/login"
    assert AdminPasskeys.get(first.id) == nil
    assert Accounts.get_user_by_admin_session_token(current_token) == nil
    assert length(AdminPasskeys.list(ctx.root.id)) == 1
  end

  test "management rejects deletion with a revoked admin session", ctx do
    conn = enroll(ctx)
    token = get_session(conn, :admin_user_token)
    [key] = AdminPasskeys.list(ctx.root.id)
    Accounts.delete_admin_session_token(token)

    assert {:error, :unauthorized} = AdminPasskeys.delete(ctx.root.id, key.id, token)
    assert AdminPasskeys.get(key.id)
  end

  test "rejects duplicate credentials, invalid names and another admin's deletion request", ctx do
    conn = enroll(ctx)
    [key] = AdminPasskeys.list(ctx.root.id)
    other = user_fixture()
    access_token_fixture(%{user_id: other.id, secret: "#{other.email}:password", is_root: true})
    other_token = Accounts.generate_admin_session_token(other.id)
    other_conn = build_conn() |> init_test_session(%{admin_user_token: other_token})
    result = delete(other_conn, ~p"/admin/passkeys/#{key.id}")
    assert redirected_to(result) == "/admin/passkeys"
    assert AdminPasskeys.get(key.id)

    options_conn = post(recycle(conn), ~p"/admin/passkeys/register/options")
    params = registration_fixture(ctx.authenticator, json_response(options_conn, 200))
    assert post(recycle(options_conn), ~p"/admin/passkeys/register", params) |> json_response(422)

    options_conn = post(recycle(conn), ~p"/admin/passkeys/register/options")
    params = registration_fixture(authenticator_fixture(), json_response(options_conn, 200))

    assert post(recycle(options_conn), ~p"/admin/passkeys/register", Map.put(params, "name", ""))
           |> json_response(422)
  end

  test "management broadcasts disconnects to existing admin sessions", ctx do
    conn = enroll(ctx)
    token = get_session(conn, :admin_user_token)
    topic = "admin_users_sessions:#{Base.url_encode64(token)}"
    CastmillWeb.Endpoint.subscribe(topic)
    assert {:ok, :ok} = AdminPasskeys.reset(ctx.root.id)
    assert_receive %Phoenix.Socket.Broadcast{topic: ^topic, event: "disconnect"}
  end

  test "cannot authenticate using a deleted credential snapshot", ctx do
    enroll(ctx)
    [key] = AdminPasskeys.list(ctx.root.id)
    assert {:ok, :ok} = AdminPasskeys.reset(ctx.root.id)
    assert {:error, :not_found} = AdminPasskeys.authenticate(key, %{sign_count: 0})
  end

  test "invalid key algorithms and malformed client data do not crash enrollment", ctx do
    for data <- [%{}, %{"type" => "invalid", "challenge" => "!", "origin" => nil}] do
      {conn, _, params} = registration_request(ctx)
      encoded = data |> Jason.encode!() |> Base.url_encode64(padding: false)

      assert post(
               recycle(conn),
               ~p"/admin/passkeys/register",
               Map.put(params, "client_data", encoded)
             )
             |> json_response(422)
    end

    {conn, options, _} = registration_request(ctx)
    invalid = %{ctx.authenticator | cose_key: %{1 => 2, 3 => -8}}
    params = registration_fixture(invalid, options)
    assert post(recycle(conn), ~p"/admin/passkeys/register", params) |> json_response(422)
  end

  test "remember-me admin cookie restores only passkey-authenticated sessions", ctx do
    enroll(ctx)
    conn = post(ctx.conn, ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    conn = post(recycle(conn), ~p"/admin/passkeys/login", Map.put(params, "remember_me", "true"))
    assert json_response(conn, 200)
    cookie = conn.resp_cookies["_castmill_admin_user_remember_me"]
    assert cookie.max_age == 60 * 60 * 24 * 60
    restored = build_conn() |> put_req_cookie("_castmill_admin_user_remember_me", cookie.value)
    assert {:ok, _, _} = live(restored, ~p"/admin/passkeys")
  end

  test "operator recovery revokes sessions and permits bootstrap again", ctx do
    conn = enroll(ctx)
    token = get_session(conn, :admin_user_token)
    assert {:ok, :ok} = AdminPasskeys.reset(ctx.root.id)
    assert Accounts.get_user_by_admin_session_token(token) == nil
    refute AdminPasskeys.enrolled?(ctx.root.id)
    assert bootstrap(build_conn(), ctx.root) |> redirected_to() == "/admin/passkeys/enroll"
  end

  test "signature counters must advance, but synced keys may use zero", ctx do
    enroll(ctx)

    for {count, status} <- [{0, 200}, {0, 200}, {1, 200}, {1, 401}, {0, 401}, {2, 200}] do
      conn = post(build_conn(), ~p"/admin/passkeys/login/options")

      params =
        assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id, %{
          sign_count: count
        })

      assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(status)
    end
  end

  test "revoked root privileges invalidate passkeys and existing sessions", ctx do
    conn = enroll(ctx)
    token = get_session(conn, :admin_user_token)
    import Ecto.Query

    Repo.update_all(from(t in Accounts.AccessToken, where: t.user_id == ^ctx.root.id),
      set: [is_root: false]
    )

    assert Accounts.get_user_by_admin_session_token(token) == nil
    conn = post(build_conn(), ~p"/admin/passkeys/login/options")
    params = assertion_fixture(ctx.authenticator, json_response(conn, 200), ctx.root.id)
    assert post(recycle(conn), ~p"/admin/passkeys/login", params) |> json_response(401)
  end

  test "dashboard credentials and old admin sessions cannot access admin", ctx do
    ordinary = user_fixture()
    access_token_fixture(%{user_id: ordinary.id, secret: "#{ordinary.email}:password"})
    assert bootstrap(ctx.conn, ordinary) |> redirected_to() == "/admin/login"

    for context <- ["session", "admin_session", "admin_enrollment"] do
      token = :crypto.strong_rand_bytes(32)
      Repo.insert!(%UserToken{user_id: ctx.root.id, token: token, context: context})
      conn = build_conn() |> init_test_session(%{admin_user_token: token})
      assert {:error, {:redirect, %{to: "/admin/login"}}} = live(conn, ~p"/admin")
    end
  end

  test "missing authorization and malformed registration requests return explicit errors", ctx do
    assert post(ctx.conn, ~p"/admin/passkeys/register/options") |> json_response(401)

    assert {:error, {:redirect, %{to: "/admin/login"}}} =
             live(ctx.conn, ~p"/admin/passkeys/enroll")

    for malformed <- [%{}, %{"attestation_object" => "AA"}, %{"attestation_object" => []}] do
      {conn, _, _} = registration_request(ctx)
      assert post(recycle(conn), ~p"/admin/passkeys/register", malformed) |> json_response(422)
    end
  end

  test "registration revalidates authorizing token under the user lock", ctx do
    import Ecto.Query

    backup_auth = authenticator_fixture()

    auth_data = %{
      sign_count: 0,
      attested_credential_data: %{
        credential_id: backup_auth.id,
        credential_public_key: backup_auth.cose_key
      }
    }

    conn = enroll(ctx)
    session_token = get_session(conn, :admin_user_token)

    other_root = user_fixture()

    access_token_fixture(%{
      user_id: other_root.id,
      secret: "#{other_root.email}:password",
      is_root: true
    })

    other_session = Accounts.generate_admin_session_token(other_root.id)

    assert {:error, :unauthorized} =
             AdminPasskeys.register(ctx.root.id, auth_data, "Wrong owner", false, other_session)

    for bad_context <- ["session", "admin_session", "admin_enrollment"] do
      bad_token = :crypto.strong_rand_bytes(32)
      Repo.insert!(%UserToken{user_id: ctx.root.id, token: bad_token, context: bad_context})

      assert {:error, :unauthorized} =
               AdminPasskeys.register(ctx.root.id, auth_data, "Wrong context", false, bad_token)
    end

    assert {:error, :unauthorized} =
             AdminPasskeys.register(ctx.root.id, auth_data, "Wrong mode", true, session_token)

    expired_token = Accounts.generate_admin_session_token(ctx.root.id)

    Repo.update_all(from(t in UserToken, where: t.token == ^expired_token),
      set: [
        inserted_at: DateTime.add(DateTime.utc_now(), -61, :day) |> DateTime.truncate(:second)
      ]
    )

    assert {:error, :unauthorized} =
             AdminPasskeys.register(ctx.root.id, auth_data, "Expired", false, expired_token)

    assert {:error, :unauthorized} =
             AdminPasskeys.register(ctx.root.id, auth_data, "Missing token", false, nil)

    # Simulate session revocation (e.g. reset/delete) after registration_options or pre-checks.
    options_conn = post(recycle(conn), ~p"/admin/passkeys/register/options")
    registration = registration_fixture(backup_auth, json_response(options_conn, 200))
    assert {:ok, :ok} = AdminPasskeys.reset(ctx.root.id)

    assert {:error, :unauthorized} =
             AdminPasskeys.register(ctx.root.id, auth_data, "Revoked", false, session_token)

    assert post(recycle(options_conn), ~p"/admin/passkeys/register", registration)
           |> json_response(422)

    refute AdminPasskeys.enrolled?(ctx.root.id)
    assert Accounts.get_user_by_admin_session_token(session_token) == nil
  end

  test "limits challenge and password requests using trusted proxy client IPs", %{
    conn: conn,
    root: root
  } do
    previous = Application.get_env(:castmill, :trusted_proxies, [])
    on_exit(fn -> Application.put_env(:castmill, :trusted_proxies, previous) end)

    for _ <- 1..30,
        do: assert(post(conn, ~p"/admin/passkeys/login/options") |> json_response(200))

    assert post(conn, ~p"/admin/passkeys/login/options") |> json_response(429)

    # Untrusted peer cannot bypass rate limit with spoofed X-Forwarded-For.
    spoofed = put_req_header(conn, "x-forwarded-for", "198.51.100.25")
    assert post(spoofed, ~p"/admin/passkeys/login/options") |> json_response(429)

    # Behind an explicitly trusted proxy, separate client IPs use separate buckets.
    Application.put_env(:castmill, :trusted_proxies, ["10.0.0.0/8"])
    Castmill.RateLimiter.clear()

    proxy_client_a =
      %{build_conn() | remote_ip: {10, 0, 0, 5}}
      |> put_req_header("x-forwarded-for", "203.0.113.99, 198.51.100.10")

    proxy_client_b =
      %{build_conn() | remote_ip: {10, 0, 0, 5}}
      |> put_req_header("x-forwarded-for", "198.51.100.11")

    for i <- 1..30 do
      req = put_req_header(proxy_client_a, "x-forwarded-for", "203.0.113.#{i}, 198.51.100.10")
      assert post(req, ~p"/admin/passkeys/login/options") |> json_response(200)
    end

    assert post(proxy_client_a, ~p"/admin/passkeys/login/options") |> json_response(429)
    assert post(proxy_client_b, ~p"/admin/passkeys/login/options") |> json_response(200)

    for _ <- 1..10 do
      assert post(proxy_client_a, ~p"/admin/login", %{
               "user" => %{"email" => root.email, "password" => "wrong"}
             })
             |> redirected_to() == "/admin/login"
    end

    throttled =
      post(proxy_client_a, ~p"/admin/login", %{
        "user" => %{"email" => root.email, "password" => "password"}
      })

    assert redirected_to(throttled) == "/admin/login"
    refute get_session(throttled, :admin_enrollment_token)

    allowed =
      post(proxy_client_b, ~p"/admin/login", %{
        "user" => %{"email" => root.email, "password" => "password"}
      })

    assert redirected_to(allowed) == "/admin/passkeys/enroll"
    assert get_session(allowed, :admin_enrollment_token)
  end

  defp bootstrap(conn, root) do
    post(recycle(conn), ~p"/admin/login", %{
      "user" => %{"email" => root.email, "password" => "password"}
    })
  end

  defp registration_request(ctx) do
    conn = bootstrap(ctx.conn, ctx.root)
    conn = post(recycle(conn), ~p"/admin/passkeys/register/options")
    options = json_response(conn, 200)
    {conn, options, registration_fixture(ctx.authenticator, options)}
  end

  defp enroll(ctx) do
    {conn, _, params} = registration_request(ctx)
    conn = post(recycle(conn), ~p"/admin/passkeys/register", params)
    assert json_response(conn, 200)
    conn
  end
end

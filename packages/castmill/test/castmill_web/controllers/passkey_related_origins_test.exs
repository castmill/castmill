defmodule CastmillWeb.PasskeyRelatedOriginsTest do
  @moduledoc """
  Passkeys use the network's primary domain as RP ID on all of its domains
  (WebAuthn Related Origin Requests, see Castmill.Networks.PasskeyDomains).
  """
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Networks.PasskeyDomains

  @primary "net-tpd.castmill.test"
  @custom "app.tpd.test"

  # Stands in for the custom domains addon: app.tpd.test belongs to the
  # network stored in :passkey_test_network_id.
  defmodule Domains do
    def resolve("app.tpd.test"),
      do: {:ok, Application.fetch_env!(:castmill, :passkey_test_network_id)}

    def resolve("app.tpd.test:8443"),
      do: {:ok, Application.fetch_env!(:castmill, :passkey_test_network_id)}

    def resolve(_domain), do: {:error, :network_not_found}

    def for_network(network_id) do
      if network_id == Application.fetch_env!(:castmill, :passkey_test_network_id),
        do: ["app.tpd.test", "APP.TPD.TEST", "app.tpd.test:8443", "net-tpd.castmill.test"],
        else: []
    end

    def failing(_network_id), do: raise("boom")
  end

  setup %{conn: conn} do
    network = network_fixture(%{domain: @primary})
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{organization_id: organization.id, network_id: network.id})

    Application.put_env(:castmill, :passkey_test_network_id, network.id)
    Application.put_env(:castmill, :additional_domain_resolver, {Domains, :resolve})
    Application.put_env(:castmill, :additional_domains_for_network, {Domains, :for_network})

    on_exit(fn ->
      Application.delete_env(:castmill, :passkey_test_network_id)
      Application.delete_env(:castmill, :additional_domain_resolver)
      Application.delete_env(:castmill, :additional_domains_for_network)
    end)

    private_key = X509.PrivateKey.new_ec(:secp256r1)
    public_key_der = private_key |> X509.PublicKey.derive() |> X509.PublicKey.to_der()
    credential_id = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

    {:ok, _credential} =
      Castmill.Accounts.add_user_credential(user.id, credential_id, public_key_der)

    Mox.stub(Castmill.AccountsMock, :generate_user_session_token, fn _user_id -> "token" end)
    Application.put_env(:castmill, :accounts, Castmill.AccountsMock)

    conn =
      conn
      |> Plug.Test.init_test_session(%{})
      |> put_req_header("accept", "application/json")

    %{conn: conn, network: network, private_key: private_key, credential_id: credential_id}
  end

  describe "login" do
    test "a passkey of the network's domain works on its custom domain", context do
      assert login(context, "https://#{@custom}", @primary).status == 200
    end

    test "a passkey created on the custom domain itself still works", context do
      assert login(context, "https://#{@custom}", @custom).status == 200
    end

    test "a passkey of another domain is rejected", context do
      other = network_fixture(%{domain: "net-other.castmill.test"})

      assert login(context, "https://#{@custom}", other.domain).status == 401
      assert login(context, "https://#{@primary}", @custom).status == 401
    end
  end

  describe "/.well-known/webauthn" do
    test "lists the network's other origins", %{conn: conn} do
      body = conn |> get(~p"/.well-known/webauthn?host=#{@primary}") |> json_response(200)

      assert body == %{
               "origins" => ["https://#{@custom}", "https://#{@custom}:8443"]
             }
    end

    test "uses the request host without the host parameter", %{conn: conn} do
      conn = %{conn | host: @primary} |> get(~p"/.well-known/webauthn")

      assert json_response(conn, 200) == %{
               "origins" => ["https://#{@custom}", "https://#{@custom}:8443"]
             }

      assert get_resp_header(conn, "cache-control") == ["public, max-age=300"]
    end

    test "is empty for networks without other domains", %{conn: conn} do
      network_fixture(%{domain: "net-solo.castmill.test"})

      body =
        conn |> get(~p"/.well-known/webauthn?host=net-solo.castmill.test") |> json_response(200)

      assert body == %{"origins" => []}
    end

    test "is not found for unknown or invalid hosts", %{conn: conn} do
      assert conn |> get(~p"/.well-known/webauthn?host=unknown.test") |> json_response(404)
      assert conn |> get(~p"/.well-known/webauthn?host=%25") |> json_response(404)
    end

    test "a failing domains hook lists no origins", %{conn: conn} do
      Application.put_env(:castmill, :additional_domains_for_network, {Domains, :failing})

      log =
        ExUnit.CaptureLog.capture_log(fn ->
          body = conn |> get(~p"/.well-known/webauthn?host=#{@primary}") |> json_response(200)
          assert body == %{"origins" => []}
        end)

      assert log =~ "additional_domains_for_network failed"
    end
  end

  test "public network settings return the passkey RP ID on every domain", %{conn: conn} do
    for origin <- ["https://#{@primary}", "https://#{@custom}"] do
      body =
        conn
        |> put_req_header("origin", origin)
        |> get(~p"/dashboard/network/public-settings")
        |> json_response(200)

      assert body["passkey_rp_id"] == @primary
    end
  end

  test "public network settings use the request host when Origin is absent", %{
    conn: conn,
    network: network
  } do
    body =
      %{conn | host: @custom, port: 8443}
      |> get(~p"/dashboard/network/public-settings")
      |> json_response(200)

    assert body["passkey_rp_id"] == network.domain
  end

  test "the RP ID is the domain host without port or scheme" do
    assert PasskeyDomains.rp_id(%Castmill.Networks.Network{domain: "localhost:3000"}) ==
             "localhost"

    assert PasskeyDomains.rp_id_for_origin("https://#{@custom}") == {:ok, @primary}
    assert PasskeyDomains.rp_id_for_origin("https://nowhere.test") == {:error, :network_not_found}
    assert PasskeyDomains.rp_id_for_origin(nil) == {:error, :network_not_found}
    refute PasskeyDomains.valid_rp_id_hash?(nil, <<0::256>>)
  end

  test "counts the network's users with passkeys once each", %{network: network} do
    add_passkey = fn user ->
      id = Base.url_encode64(:crypto.strong_rand_bytes(16), padding: false)
      {:ok, _} = Castmill.Accounts.add_user_credential(user.id, id, "spki")
    end

    # The setup user (an organization member) already has a passkey.
    network_admin = user_fixture(%{network_id: network.id, network_role: :admin})
    add_passkey.(network_admin)
    add_passkey.(network_admin)

    _without_passkey = user_fixture(%{network_id: network.id})

    other_network = network_fixture()
    add_passkey.(user_fixture(%{network_id: other_network.id}))

    assert PasskeyDomains.count_users_with_passkeys(network.id) == 2
    assert PasskeyDomains.count_users_with_passkeys(other_network.id) == 1
  end

  defp login(context, origin, rp_id) do
    %{conn: conn, private_key: private_key, credential_id: credential_id} = context
    body = conn |> get(~p"/sessions/challenges") |> json_response(200)

    authenticator_data = :crypto.hash(:sha256, rp_id) <> <<0x01>> <> <<0, 0, 0, 1>>

    client_data_json =
      Jason.encode!(%{
        "type" => "webauthn.get",
        "challenge" => body["challenge"],
        "origin" => origin
      })

    signature =
      :public_key.sign(
        authenticator_data <> :crypto.hash(:sha256, client_data_json),
        :sha256,
        private_key
      )

    build_conn()
    |> Plug.Test.init_test_session(%{})
    |> put_req_header("accept", "application/json")
    |> post(~p"/sessions/", %{
      "credential_id" => credential_id,
      "authenticator_data" => Base.encode64(authenticator_data),
      "signature" => Base.encode64(signature),
      "client_data_json" => client_data_json,
      "challenge_token" => body["challenge_token"]
    })
  end
end

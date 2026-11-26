defmodule CastmillWeb.UserAuthorizationTest do
  @moduledoc """
  Dashboard actions on a user are only for that user (profile, deletion,
  passkeys, email); changing a member's role needs an organization admin.
  """
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Accounts, Organizations}

  setup %{conn: conn} do
    network = network_fixture()
    actor = user_fixture(%{network_id: network.id})
    other = user_fixture(%{network_id: network_fixture().id})

    conn =
      conn
      |> Plug.Test.init_test_session(user_id: actor.id)
      |> assign(:current_user, actor)
      |> put_req_header("accept", "application/json")
      |> put_req_header("origin", network.domain)

    %{conn: conn, network: network, actor: actor, other: other}
  end

  test "users cannot read, change or delete another user", %{conn: conn, other: other} do
    base = "/dashboard/users/#{other.id}"

    for {method, path, body} <- [
          {:get, base, %{}},
          {:put, base, %{"user" => %{"name" => "Renamed"}}},
          {:delete, base, %{}},
          {:get, "#{base}/credentials", %{}},
          {:post, "#{base}/credentials/challenge", %{}},
          {:delete, "#{base}/credentials/#{Ecto.UUID.generate()}", %{}},
          {:put, "#{base}/credentials/#{Ecto.UUID.generate()}", %{"name" => "Mine"}},
          {:post, "#{base}/send-email-verification", %{"email" => "attacker@example.com"}}
        ] do
      assert json_response(dispatch(conn, @endpoint, method, path, body), 403) == %{
               "error" => "forbidden"
             }
    end

    assert %{name: name} = Accounts.get_user(other.id)
    refute name == "Renamed"
  end

  test "a passkey cannot be added to another user's account", %{conn: conn, other: other} do
    token =
      Phoenix.Token.sign(CastmillWeb.Endpoint, "credential_challenge", %{
        challenge: "challenge",
        user_id: other.id
      })

    conn =
      post(conn, "/dashboard/users/#{other.id}/credentials", %{
        "credential_id" => "attacker-key",
        "public_key_spki" => Base.encode64("key"),
        "client_data_json" => "{}",
        "challenge_token" => token
      })

    assert json_response(conn, 403)
    assert Accounts.list_user_credentials(other.id) == []
  end

  test "users manage their own profile", %{conn: conn, actor: actor} do
    assert json_response(get(conn, "/dashboard/users/#{actor.id}"), 200)

    put(conn, "/dashboard/users/#{actor.id}", %{"user" => %{"name" => "New name"}})
    assert Accounts.get_user(actor.id).name == "New name"
  end

  test "users keep every account action on their own account", %{
    conn: conn,
    network: network,
    actor: actor
  } do
    base = "/dashboard/users/#{actor.id}"

    # Add a passkey through the challenge flow.
    %{"challenge" => challenge, "challenge_token" => token} =
      json_response(post(conn, "#{base}/credentials/challenge", %{}), 200)

    client_data =
      Jason.encode!(%{
        "type" => "webauthn.create",
        "challenge" => challenge,
        "origin" => network.domain
      })

    assert %{"credential" => %{"id" => credential_id}} =
             conn
             |> post("#{base}/credentials", %{
               "credential_id" => "my-key",
               "public_key_spki" => Base.encode64("key"),
               "client_data_json" => client_data,
               "challenge_token" => token
             })
             |> json_response(201)

    assert json_response(
             put(conn, "#{base}/credentials/#{credential_id}", %{"name" => "Laptop"}),
             200
           )

    assert %{"credentials" => [%{"id" => ^credential_id, "name" => "Laptop"}]} =
             json_response(get(conn, "#{base}/credentials"), 200)

    assert response(delete(conn, "#{base}/credentials/#{credential_id}"), 204)
    assert Accounts.list_user_credentials(actor.id) == []

    assert json_response(
             post(conn, "#{base}/send-email-verification", %{"email" => "new@example.com"}),
             200
           )

    assert response(delete(conn, base), 204)
    refute Accounts.get_user(actor.id)
  end

  test "members cannot change roles; organization admins can", %{
    conn: conn,
    network: network,
    actor: actor
  } do
    organization = organization_fixture(%{network_id: network.id})
    member = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, actor.id, :guest)
    {:ok, _} = Organizations.add_user(organization.id, member.id, :member)

    promote = fn conn, user ->
      put(conn, "/dashboard/users/#{user.id}", %{
        "access" => "admin",
        "organization_id" => organization.id
      })
    end

    assert json_response(promote.(conn, actor), 403)
    refute Organizations.is_admin?(organization.id, actor.id)

    {:ok, _} = Organizations.update_role(organization.id, actor.id, :admin)
    assert response(promote.(conn, member), 204)
    assert Organizations.is_admin?(organization.id, member.id)
  end

  test "an organization admin cannot change another user's profile with role parameters", %{
    conn: conn,
    network: network,
    actor: actor,
    other: other
  } do
    organization = organization_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, actor.id, :admin)

    # `user` makes it a profile update, whatever else the request contains.
    conn =
      put(conn, "/dashboard/users/#{other.id}", %{
        "user" => %{"name" => "Renamed", "email" => "attacker@example.com"},
        "access" => "member",
        "organization_id" => organization.id
      })

    assert json_response(conn, 403) == %{"error" => "forbidden"}
    assert %{name: name, email: email} = Accounts.get_user(other.id)
    refute name == "Renamed"
    refute email == "attacker@example.com"
  end

  test "an encoded dashboard path gets the same checks", %{conn: conn, other: other} do
    conn = put(conn, "/%64ashboard/users/#{other.id}", %{"user" => %{"name" => "Renamed"}})

    assert json_response(conn, 403) == %{"error" => "forbidden"}
    refute Accounts.get_user(other.id).name == "Renamed"
  end
end

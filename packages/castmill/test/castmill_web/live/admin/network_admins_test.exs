defmodule CastmillWeb.Live.Admin.NetworkAdminsTest do
  use CastmillWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Networks

  setup do
    %{network: network_fixture(), root: user_fixture()}
  end

  test "root login opens the admin page; ordinary credentials and sessions cannot", %{
    conn: conn,
    network: network,
    root: root
  } do
    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    ordinary = user_fixture()

    access_token_fixture(%{
      user_id: ordinary.id,
      secret: "#{ordinary.email}:ordinary-password",
      is_root: false
    })

    ordinary_conn =
      post(conn, ~p"/admin/login", %{
        "user" => %{"email" => ordinary.email, "password" => "ordinary-password"}
      })

    assert redirected_to(ordinary_conn) == ~p"/admin/login"

    token = Accounts.generate_user_session_token(ordinary.id)

    for key <- [:user_token, :admin_user_token] do
      session_conn =
        conn
        |> init_test_session(%{})
        |> Plug.Conn.put_session(key, token)

      assert {:error, {:redirect, %{to: "/admin/login"}}} =
               live(session_conn, ~p"/admin/networks/#{network.id}/admins")
    end

    root_conn =
      post(conn, ~p"/admin/login", %{
        "user" => %{"email" => root.email, "password" => "root-password"}
      })

    assert redirected_to(root_conn) == ~p"/admin/networks"
    assert {:ok, _, html} = live(recycle(root_conn), ~p"/admin/networks/#{network.id}/admins")
    assert html =~ "Add admin"
  end

  test "promotes existing members and removes only their admin role", %{
    conn: conn,
    network: network,
    root: root
  } do
    user = user_fixture(%{network_id: network.id})
    other_network = network_fixture()
    {:ok, _} = Networks.add_user_to_network(user.id, other_network.id, :admin)
    {:ok, view, html} = live(admin_conn(conn, root), ~p"/admin/networks/#{network.id}/admins")
    refute html =~ user.email

    html = view |> form("#network-admin-form", email: user.email) |> render_submit()
    assert html =~ user.email
    assert Networks.is_network_admin?(user.id, network.id)

    view |> form("#network-admin-form", email: user.email) |> render_submit()
    assert length(Floki.find(Floki.parse_document!(render(view)), "#network-admins tr")) == 1

    view |> element("#network-admins a", "Remove admin") |> render_click()
    refute render(view) =~ user.email
    assert Networks.get_network_membership(user.id, network.id).role == :member
    assert Networks.is_network_admin?(user.id, other_network.id)
  end

  test "admin sessions are separate from regular sessions and are revoked on logout", %{
    conn: conn,
    network: network,
    root: root
  } do
    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    conn =
      post(conn, ~p"/admin/login", %{
        "user" => %{"email" => root.email, "password" => "root-password"}
      })

    admin_token = Plug.Conn.get_session(conn, :admin_user_token)
    assert Accounts.get_user_by_admin_session_token(admin_token).id == root.id
    assert Accounts.get_user_by_session_token(admin_token) == nil

    conn = delete(recycle(conn), ~p"/admin/logout")
    assert redirected_to(conn) == ~p"/admin/login"
    assert Accounts.get_user_by_admin_session_token(admin_token) == nil

    conn =
      conn
      |> recycle()
      |> init_test_session(%{})
      |> Plug.Conn.put_session(:admin_user_token, admin_token)

    assert {:error, {:redirect, %{to: "/admin/login"}}} =
             live(conn, ~p"/admin/networks/#{network.id}/admins")
  end

  test "adds an existing user from another network and reports unknown emails", %{
    conn: conn,
    network: network,
    root: root
  } do
    other_network = network_fixture()
    user = user_fixture(%{network_id: other_network.id})
    {:ok, view, _} = live(admin_conn(conn, root), ~p"/admin/networks/#{network.id}/admins")

    html = view |> form("#network-admin-form", email: "missing@example.com") |> render_submit()
    assert html =~ "No existing user found"
    refute Networks.is_network_member?(user.id, network.id)

    html = view |> form("#network-admin-form", email: user.email) |> render_submit()
    assert html =~ user.email
    assert Networks.is_network_admin?(user.id, network.id)
    assert Networks.get_network_membership(user.id, other_network.id).role == :member
  end

  test "rejects invalid and out-of-network removal requests", %{
    conn: conn,
    network: network,
    root: root
  } do
    other_network = network_fixture()
    user = user_fixture(%{network_id: other_network.id, network_role: :admin})
    {:ok, view, _} = live(admin_conn(conn, root), ~p"/admin/networks/#{network.id}/admins")

    assert render_click(view, "demote_from_admin", %{"id" => "invalid"}) =~ "Invalid user ID"

    assert render_click(view, "demote_from_admin", %{"id" => user.id}) =~
             "User does not belong to this network"

    assert render_click(view, "demote_from_admin", %{"id" => Ecto.UUID.generate()}) =~
             "User not found"

    member = user_fixture(%{network_id: network.id})
    assert render_click(view, "demote_from_admin", %{"id" => member.id}) =~ "User is not an admin"
    assert render_submit(view, "add_network_admin", %{}) =~ "Enter an existing user"
    assert Networks.is_network_admin?(user.id, other_network.id)
  end

  test "admin events do not mutate a network from another tab", %{
    conn: conn,
    network: network,
    root: root
  } do
    admin = user_fixture(%{network_id: network.id, network_role: :admin})
    member = user_fixture(%{network_id: network.id})
    {:ok, view, _} = live(admin_conn(conn, root), ~p"/admin/networks/#{network.id}/users")

    assert render_submit(view, "add_network_admin", %{"email" => member.email}) =~
             "Enter an existing user"

    assert render_click(view, "demote_from_admin", %{"id" => admin.id}) =~
             "Cannot remove network admin"

    assert Networks.get_network_membership(member.id, network.id).role == :member
    assert Networks.is_network_admin?(admin.id, network.id)
  end

  defp admin_conn(conn, root) do
    token = Accounts.generate_admin_session_token(root.id)

    conn
    |> init_test_session(%{})
    |> Plug.Conn.put_session(:admin_user_token, token)
  end
end

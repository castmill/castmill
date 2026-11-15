defmodule CastmillWeb.Live.Admin.OrganizationShowTest do
  use CastmillWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Ecto.Query, only: [from: 2]
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Accounts.User
  alias Castmill.Organizations
  alias Castmill.Repo

  setup %{conn: conn} do
    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    network = network_fixture()
    organization = organization_fixture(%{network: network, name: "Acme"})

    %{conn: admin_conn(conn, root), network: network, organization: organization}
  end

  test "the users tab lists the organization's members", %{
    conn: conn,
    organization: organization
  } do
    admin = user_fixture(%{name: "Alice Admin"})
    member = user_fixture(%{name: "Bob Member"})
    outsider = user_fixture(%{name: "Olga Outsider"})
    agent = user_fixture(%{name: "Agent Smith"})

    {:ok, _} = Organizations.add_user(organization.id, admin.id, :admin)
    {:ok, _} = Organizations.add_user(organization.id, member.id, :member)
    {:ok, _} = Organizations.add_user(organization.id, agent.id, :member)
    Repo.update_all(from(u in User, where: u.id == ^agent.id), set: [is_agent: true])

    {:ok, view, html} = live(conn, ~p"/admin/organizations/#{organization.id}/users")

    assert html =~ "Alice Admin"
    assert html =~ admin.email
    assert html =~ "Bob Member"
    assert html =~ member.email
    assert has_element?(view, "#rows-#{admin.id}", "admin")
    assert has_element?(view, "#rows-#{member.id}", "member")
    refute html =~ "Olga Outsider"
    refute html =~ outsider.email
    refute html =~ "Agent Smith"
  end

  test "a member can be removed from the users tab", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    admin = user_fixture()
    member = user_fixture(%{name: "Bob Member"})
    other_organization = organization_fixture(%{network: network})

    {:ok, _} = Organizations.add_user(organization.id, admin.id, :admin)
    {:ok, _} = Organizations.add_user(organization.id, member.id, :member)
    {:ok, _} = Organizations.add_user(other_organization.id, member.id, :member)

    {:ok, view, _html} = live(conn, ~p"/admin/organizations/#{organization.id}/users")
    assert has_element?(view, "#rows-#{member.id}")

    render_click(view, "delete", %{"id" => member.id, "resource" => "users"})

    refute has_element?(view, "#rows-#{member.id}")

    assert Enum.map(Organizations.list_user_organizations(member.id), & &1.id) == [
             other_organization.id
           ]
  end

  defp admin_conn(conn, root) do
    token = Accounts.generate_admin_session_token(root.id)

    conn
    |> init_test_session(%{})
    |> Plug.Conn.put_session(:admin_user_token, token)
  end
end

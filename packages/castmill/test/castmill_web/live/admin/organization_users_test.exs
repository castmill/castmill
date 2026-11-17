defmodule CastmillWeb.Live.Admin.OrganizationUsersTest do
  @moduledoc """
  The root user adds people, new or existing, to an organization from its
  Users tab in the admin tool.
  """
  use CastmillWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Networks
  alias Castmill.Organizations

  setup %{conn: conn} do
    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    network = network_fixture(%{domain: "net-org-users.castmill.test"})
    organization = organization_fixture(%{network_id: network.id, name: "Tylöprint"})

    conn =
      conn
      |> init_test_session(%{})
      |> Plug.Conn.put_session(:admin_user_token, Accounts.generate_admin_session_token(root.id))

    %{conn: conn, network: network, organization: organization}
  end

  defp in_network?(user, network) do
    Castmill.Repo.get_by(Networks.NetworksUsers, user_id: user.id, network_id: network.id) != nil
  end

  defp add_user(conn, organization, params) do
    {:ok, view, _html} = live(conn, ~p"/admin/organizations/#{organization.id}/users/new")

    html = view |> form("#user-form", user: params) |> render_submit()
    {view, html}
  end

  test "adds an existing user from another network with the chosen role", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    user = user_fixture(%{network_id: network_fixture().id})

    {view, _html} = add_user(conn, organization, %{email: user.email, name: "", role: "admin"})

    assert_patch(view, "/admin/organizations/#{organization.id}/users")
    assert Organizations.get_user_role(organization.id, user.id) == :admin
    assert in_network?(user, network)
    assert render(view) =~ "#{user.email} was added to Tylöprint as admin"
  end

  test "adds a network admin to an organization of their network", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    admin = user_fixture(%{network_id: network.id, network_role: :admin})

    add_user(conn, organization, %{email: admin.email, role: "admin"})

    assert Organizations.get_user_role(organization.id, admin.id) == :admin
    assert Networks.is_network_admin?(admin.id, network.id)
  end

  test "creates a new user in the organization and its network", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    {_view, html} =
      add_user(conn, organization, %{email: " new.person@example.test ", name: "", role: "member"})

    user = Accounts.get_user_by_email("new.person@example.test")
    assert user.name == "new.person@example.test"
    assert Organizations.get_user_role(organization.id, user.id) == :member
    assert in_network?(user, network)
    assert html =~ "Lost your credentials?"
  end

  test "explains in the form why a user cannot be added", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    member = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, member.id, :member)

    {view, html} = add_user(conn, organization, %{email: member.email, role: "admin"})
    assert html =~ "is already a member of this organization"
    assert has_element?(view, "#user-form")
    assert Organizations.get_user_role(organization.id, member.id) == :member

    {_view, html} = add_user(conn, organization, %{email: "not-an-email", role: "member"})
    assert html =~ "has invalid format"
    refute Accounts.get_user_by_email("not-an-email")
  end
end

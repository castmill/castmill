defmodule CastmillWeb.OrganizationDeleteTest do
  @moduledoc "Organization admins delete their organization from the dashboard."
  use CastmillWeb.ConnCase, async: false

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Organizations

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id, name: "Corner Shop"})
    %{conn: conn, network: network, organization: organization}
  end

  defp signed_in(conn, network, organization, role) do
    user = user_fixture(%{network_id: network.id})
    {:ok, _} = Organizations.add_user(organization.id, user.id, role)

    conn
    |> Plug.Test.init_test_session(user_id: user.id)
    |> assign(:current_user, user)
    |> put_req_header("accept", "application/json")
    |> put_req_header("origin", network.domain)
  end

  defp delete_org(conn, organization, confirm_name) do
    delete(conn, "/dashboard/organizations/#{organization.id}", %{"confirm_name" => confirm_name})
  end

  test "admins delete their organization after typing its name", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    conn = signed_in(conn, network, organization, :admin)

    assert %{"error" => "confirmation_mismatch"} =
             conn |> delete_org(organization, "corner shop") |> json_response(422)

    assert Organizations.get_organization(organization.id)

    assert response(delete_org(conn, organization, "Corner Shop"), 204)
    refute Organizations.get_organization(organization.id)
  end

  test "members and managers cannot delete it", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    for role <- [:member, :manager] do
      conn = signed_in(conn, network, organization, role)
      assert delete_org(conn, organization, "Corner Shop").status in [401, 403]
    end

    assert Organizations.get_organization(organization.id)
  end

  test "organizations with child organizations are refused", %{
    conn: conn,
    network: network,
    organization: organization
  } do
    organization_fixture(%{
      network_id: network.id,
      organization_id: organization.id,
      name: "Child"
    })

    conn = signed_in(conn, network, organization, :admin)

    assert %{"error" => "has_child_organizations"} =
             conn |> delete_org(organization, "Corner Shop") |> json_response(409)
  end
end

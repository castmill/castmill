defmodule CastmillWeb.OrganizationQuotaAccessTest do
  @moduledoc """
  Quotas limit what an organization may use (for example its licensed
  devices), so the dashboard API only reads them.
  """
  use CastmillWeb.ConnCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Quotas

  setup %{conn: conn} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    user = user_fixture(%{network_id: network.id, network_role: :admin})
    {:ok, _} = Castmill.Organizations.add_user(organization.id, user.id, :admin)

    conn =
      conn
      |> Plug.Test.init_test_session(user_id: user.id)
      |> assign(:current_user, user)
      |> put_req_header("accept", "application/json")

    %{conn: conn, organization: organization}
  end

  test "quotas cannot be created or changed through the dashboard API", %{
    conn: conn,
    organization: organization
  } do
    before = Quotas.get_quota_for_organization(organization.id, "devices")
    path = "/dashboard/organizations/#{organization.id}/quotas"

    for {method, url} <- [{:post, path}, {:put, "#{path}/devices"}, {:patch, "#{path}/devices"}] do
      conn =
        dispatch(conn, @endpoint, method, url, %{
          "quota" => %{"resource" => "devices", "max" => 1_000}
        })

      assert %{"error" => "Quotas are read-only"} = json_response(conn, 405)
      assert get_resp_header(conn, "allow") == ["GET"]
    end

    assert Quotas.get_quota_for_organization(organization.id, "devices") == before
  end

  test "organization admins cannot move their organization to another network", %{
    conn: conn,
    organization: organization
  } do
    other_network = network_fixture()

    conn =
      put(conn, "/dashboard/organizations/#{organization.id}", %{
        "name" => "Renamed organization",
        "network_id" => other_network.id,
        "organization_id" => Ecto.UUID.generate()
      })

    assert json_response(conn, 200)
    organization = Castmill.Organizations.get_organization!(organization.id)
    assert organization.name == "Renamed organization"
    assert organization.network_id != other_network.id
    assert is_nil(organization.organization_id)
  end

  test "quotas can still be read", %{conn: conn, organization: organization} do
    conn = get(conn, "/dashboard/organizations/#{organization.id}/quotas")
    assert is_list(json_response(conn, 200))
  end
end

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

    assert refused?(fn ->
             post(conn, path, %{"quota" => %{"resource" => "devices", "max" => 1_000}})
           end)

    assert refused?(fn -> put(conn, "#{path}/devices", %{"quota" => %{"max" => 1_000}}) end)

    assert Quotas.get_quota_for_organization(organization.id, "devices") == before
  end

  # No quota route matches, so the request ends in an error status (from
  # whichever generic route catches it).
  defp refused?(request) do
    status =
      try do
        request.().status
      rescue
        error -> Plug.Exception.status(error)
      end

    status >= 400
  end

  test "quotas can still be read", %{conn: conn, organization: organization} do
    conn = get(conn, "/dashboard/organizations/#{organization.id}/quotas")
    assert is_list(json_response(conn, 200))
  end
end

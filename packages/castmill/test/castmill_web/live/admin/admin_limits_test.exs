defmodule CastmillWeb.Live.Admin.AdminLimitsTest do
  @moduledoc """
  Root admins set organization quota overrides and network-wide limits in
  the Phoenix admin; the dashboard API cannot change them.
  """
  use CastmillWeb.ConnCase, async: false

  import Phoenix.LiveViewTest
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.{Accounts, Networks, Quotas}

  setup %{conn: conn} do
    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    conn =
      conn
      |> init_test_session(%{})
      |> Plug.Conn.put_session(:admin_user_token, Accounts.generate_admin_session_token(root.id))

    %{conn: conn, network: network, organization: organization}
  end

  test "root admins set and remove an organization's quota override", %{
    conn: conn,
    organization: organization
  } do
    {:ok, view, html} = live(conn, ~p"/admin/organizations/#{organization.id}/quotas")
    assert html =~ "Override for devices"

    view |> form("#quota-devices", %{"max" => "42"}) |> render_submit()
    assert Quotas.get_quota_for_organization(organization.id, :devices) == 42
    assert render(view) =~ "Quota for devices saved."

    view |> form("#quota-devices", %{"max" => ""}) |> render_submit()
    assert Quotas.list_quotas(organization.id) == []

    view |> form("#quota-devices", %{"max" => "-1"}) |> render_submit()
    assert Quotas.list_quotas(organization.id) == []
  end

  test "root admins set and remove a network's device and storage limits", %{
    conn: conn,
    network: network
  } do
    {:ok, view, html} = live(conn, ~p"/admin/networks/#{network.id}/limits")
    assert html =~ "0 registered"

    view
    |> form("#network-limits-form", %{"max_devices" => "30", "max_storage_mb" => "61440"})
    |> render_submit()

    assert %{max_devices: 30, max_storage_mb: 61_440} = Networks.get_network(network.id)

    view
    |> form("#network-limits-form", %{"max_devices" => "", "max_storage_mb" => ""})
    |> render_submit()

    assert %{max_devices: nil, max_storage_mb: nil} = Networks.get_network(network.id)
  end
end

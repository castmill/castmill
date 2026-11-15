defmodule CastmillWeb.Live.Admin.NetworkFormTest do
  use CastmillWeb.ConnCase, async: false

  import Phoenix.LiveViewTest
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Networks

  setup %{conn: conn} do
    Application.put_env(:castmill, :network_domain_provider, Castmill.FakeNetworkDomainProvider)

    Application.put_env(:castmill, :fake_domain_provider_pid, self())

    on_exit(fn ->
      Application.delete_env(:castmill, :network_domain_provider)
      Application.delete_env(:castmill, :fake_domain_provider_pid)
    end)

    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    token = Accounts.generate_admin_session_token(root.id)

    %{
      conn:
        conn
        |> init_test_session(%{})
        |> Plug.Conn.put_session(:admin_user_token, token)
    }
  end

  test "a network created without a domain gets a generated address", %{conn: conn} do
    {:ok, view, html} = live(conn, ~p"/admin/networks/new")
    assert html =~ "Leave the domain empty"

    name = "Tylöprint #{System.unique_integer([:positive])}"

    view
    |> form("#network-form", network: %{name: name, email: "ops@example.test", domain: ""})
    |> render_submit()

    network = Enum.find(Networks.list_networks(), &(&1.name == name))
    assert network.domain =~ ~r/^net-/
    assert_patch(view, ~p"/admin/networks")
    assert render(view) =~ "Dashboard: https://#{network.domain}"
    assert_received {:registered, domain}
    assert domain == network.domain
  end

  test "emptying a network's domain gives it a generated address", %{conn: conn} do
    network = network_fixture(%{domain: "app.customer.test"})

    {:ok, view, _html} = live(conn, ~p"/admin/networks/#{network.id}/show/edit")

    view
    |> form("#network-form", network: %{domain: ""})
    |> render_submit()

    assert Networks.get_network(network.id).domain =~ ~r/^net-/
    assert_received {:registered, _domain}
  end
end

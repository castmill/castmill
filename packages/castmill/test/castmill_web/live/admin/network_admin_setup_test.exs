defmodule CastmillWeb.Live.Admin.NetworkAdminSetupTest do
  @moduledoc """
  Adding a network admin emails them a link to create a passkey for the
  network's domain, so they can sign in to a new network right away.
  """
  use CastmillWeb.ConnCase, async: false

  import Phoenix.LiveViewTest
  import Swoosh.TestAssertions
  import Castmill.AccountsFixtures
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Accounts
  alias Castmill.Networks

  setup :set_swoosh_global

  setup %{conn: conn} do
    root = user_fixture()

    access_token_fixture(%{
      user_id: root.id,
      secret: "#{root.email}:root-password",
      is_root: true
    })

    network = network_fixture(%{name: "Tylöprint", domain: "net-setup.castmill.test"})
    token = Accounts.generate_admin_session_token(root.id)

    conn =
      conn
      |> init_test_session(%{})
      |> Plug.Conn.put_session(:admin_user_token, token)

    %{conn: conn, network: network}
  end

  test "a new person gets an account, becomes admin and is emailed a setup link", %{
    conn: conn,
    network: network
  } do
    {:ok, view, html} = live(conn, ~p"/admin/networks/#{network.id}/admins")
    assert html =~ "https://net-setup.castmill.test"

    html =
      view
      |> form("#network-admin-form", email: " new.admin@example.test ")
      |> render_submit()

    user = Accounts.get_user_by_email("new.admin@example.test")
    assert Networks.is_network_admin?(user.id, network.id)
    assert html =~ "A link to create a passkey for net-setup.castmill.test was emailed"
    assert has_element?(view, "#network-admins", "new.admin@example.test")

    assert_email_sent(fn email ->
      assert email.to == [{"", "new.admin@example.test"}]
      assert email.subject == "You are an administrator of Tylöprint on Castmill"
      assert setup_token(email) |> Accounts.get_user_by_recover_credentials_token() == user
    end)
  end

  test "an existing user is emailed a setup link for the network", %{
    conn: conn,
    network: network
  } do
    user = user_fixture(%{network_id: network_fixture().id})
    {:ok, view, _html} = live(conn, ~p"/admin/networks/#{network.id}/admins")

    view |> form("#network-admin-form", email: user.email) |> render_submit()

    assert Networks.is_network_admin?(user.id, network.id)
    assert_email_sent(to: [{"", user.email}])
  end

  test "the setup link can be sent again", %{conn: conn, network: network} do
    admin = user_fixture(%{network_id: network.id, network_role: :admin})
    {:ok, view, _html} = live(conn, ~p"/admin/networks/#{network.id}/admins")

    html = render_click(view, "send_admin_setup_link", %{"id" => admin.id})
    assert html =~ "was emailed to #{admin.email}"
    assert_email_sent(to: [{"", admin.email}])

    assert render_click(view, "send_admin_setup_link", %{"id" => Ecto.UUID.generate()}) =~
             "User not found"
  end

  defp setup_token(email) do
    [_, token] =
      Regex.run(
        ~r{https://net-setup\.castmill\.test/setup-passkey\?token=([^&\s]+)&email=},
        email.text_body
      )

    token
  end
end

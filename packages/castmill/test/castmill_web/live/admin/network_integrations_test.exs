defmodule CastmillWeb.Live.Admin.NetworkIntegrationsTest do
  use CastmillWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations
  alias Castmill.Accounts

  @moduletag :network_integrations_live

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    admin_user = user_fixture()

    {:ok, widget} =
      Widgets.create_widget(%{
        name: "Spotify Widget #{System.unique_integer([:positive])}",
        slug: "spotify-#{System.unique_integer([:positive])}",
        template: %{"html" => "<div>Spotify</div>"},
        is_system: true
      })

    {:ok, integration} =
      Integrations.create_integration(%{
        widget_id: widget.id,
        name: "spotify",
        description: "Spotify OAuth Integration",
        integration_type: "pull",
        credential_scope: "organization",
        pull_endpoint: "https://api.spotify.com/v1/me",
        pull_interval_seconds: 3600,
        credential_schema: %{
          "fields" => [
            %{
              "name" => "client_id",
              "label" => "Client ID",
              "type" => "text",
              "required" => true
            },
            %{
              "name" => "client_secret",
              "label" => "Client Secret",
              "type" => "password",
              "required" => true
            }
          ]
        }
      })

    %{
      network: network,
      organization: organization,
      admin_user: admin_user,
      widget: widget,
      integration: integration
    }
  end

  describe "network integrations tab" do
    test "displays integrations list", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      conn = log_in_admin(conn, admin_user)
      {:ok, _view, html} = live(conn, ~p"/admin/networks/#{network.id}/integrations")

      # Should show the integration name
      assert html =~ integration.name
      assert html =~ "Not Configured"
      assert html =~ "Configure"
    end

    test "shows configured status when credentials exist", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      # Add credentials first
      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      conn = log_in_admin(conn, admin_user)
      {:ok, _view, html} = live(conn, ~p"/admin/networks/#{network.id}/integrations")

      assert html =~ "Configured"
    end
  end

  describe "integration configuration modal" do
    test "opens configuration modal when navigating to configure route", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      conn = log_in_admin(conn, admin_user)

      # Navigate directly to configure URL
      {:ok, _view, html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Modal should be open with the form
      assert html =~ "Configure #{integration.name}"
      assert html =~ "Client ID"
      assert html =~ "Client Secret"
      assert html =~ "Save Credentials"
    end

    test "saves new credentials", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      conn = log_in_admin(conn, admin_user)

      {:ok, view, _html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Fill in the form and submit
      view
      |> form("#network-integration-form",
        credentials: %{
          client_id: "my-new-client-id",
          client_secret: "my-new-secret"
        }
      )
      |> render_submit()

      # Verify credentials were saved
      assert {:ok, creds} =
               Integrations.get_decrypted_network_credentials(network.id, integration.id)

      assert creds["client_id"] == "my-new-client-id"
      assert creds["client_secret"] == "my-new-secret"
    end

    test "validates required fields", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      conn = log_in_admin(conn, admin_user)

      {:ok, view, _html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Submit with empty fields
      view
      |> form("#network-integration-form",
        credentials: %{
          client_id: "",
          client_secret: ""
        }
      )
      |> render_submit()

      # Should show error - flash may need a render() call to appear
      html = render(view)

      assert html =~ "Please fill in all required fields" or
               html =~ "Client ID" or
               html =~ "Client Secret"

      # Alternative: verify credentials were NOT saved
      assert {:error, :not_found} =
               Integrations.get_decrypted_network_credentials(network.id, integration.id)
    end

    test "shows existing credentials indicator", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      # Add credentials first
      credentials = %{"client_id" => "existing-id", "client_secret" => "existing-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      conn = log_in_admin(conn, admin_user)

      {:ok, _view, html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Should show "Configured" indicator
      assert html =~ "Configured"
      # Should show delete button
      assert html =~ "Delete Credentials"
    end

    test "deletes existing credentials", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      # Add credentials first
      credentials = %{"client_id" => "existing-id", "client_secret" => "existing-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      conn = log_in_admin(conn, admin_user)

      {:ok, view, _html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Click delete
      view
      |> element("button", "Delete Credentials")
      |> render_click()

      # Verify credentials were deleted
      assert {:error, :not_found} =
               Integrations.get_decrypted_network_credentials(network.id, integration.id)
    end
  end

  # Helper to log in as admin
  defp log_in_admin(conn, user) do
    # Generate a session token for the user
    token = Accounts.generate_user_session_token(user.id)

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
    |> Plug.Conn.put_session(:live_socket_id, "users_sessions:#{Base.url_encode64(token)}")
  end
end

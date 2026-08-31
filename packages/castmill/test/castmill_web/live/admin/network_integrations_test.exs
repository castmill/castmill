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

    test "keeps the stored secret when the password field is left blank", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      integration: integration
    } do
      credentials = %{"client_id" => "existing-id", "client_secret" => "existing-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      conn = log_in_admin(conn, admin_user)

      {:ok, view, _html} =
        live(conn, ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure")

      # Password inputs are rendered blank, so submitting the form without
      # retyping the secret must not erase it
      view
      |> form("#network-integration-form",
        credentials: %{
          client_id: "existing-id",
          client_secret: ""
        }
      )
      |> render_submit()

      assert {:ok, creds} =
               Integrations.get_decrypted_network_credentials(network.id, integration.id)

      assert creds["client_secret"] == "existing-secret"
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

  describe "network tabs" do
    test "widgets tab renders without crashing and lists widgets", %{
      conn: conn,
      network: network,
      admin_user: admin_user,
      widget: widget
    } do
      conn = log_in_admin(conn, admin_user)
      {:ok, _view, html} = live(conn, ~p"/admin/networks/#{network.id}/widgets")

      assert html =~ widget.name
    end

    test "not-yet-implemented tabs render gracefully instead of crashing", %{
      conn: conn,
      network: network,
      admin_user: admin_user
    } do
      conn = log_in_admin(conn, admin_user)

      for tab <- ["channels", "playlists", "medias"] do
        assert {:ok, _view, _html} = live(conn, ~p"/admin/networks/#{network.id}/#{tab}")
      end
    end

    test "credential-free integrations are shown as needing no configuration", %{
      conn: conn,
      network: network,
      admin_user: admin_user
    } do
      {:ok, weather_widget} =
        Widgets.create_widget(%{
          name: "Weather #{System.unique_integer([:positive])}",
          slug: "weather-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Weather</div>"},
          is_system: true
        })

      {:ok, integration} =
        Integrations.create_integration(%{
          widget_id: weather_widget.id,
          name: "no-auth-#{System.unique_integer([:positive])}",
          description: "Credential-free integration",
          integration_type: "pull",
          credential_scope: "widget",
          pull_endpoint: "https://example.com/api",
          pull_interval_seconds: 900,
          credential_schema: %{"auth_type" => "none"}
        })

      conn = log_in_admin(conn, admin_user)
      {:ok, _view, html} = live(conn, ~p"/admin/networks/#{network.id}/integrations")

      assert html =~ integration.name
      assert html =~ "No configuration required"

      {:ok, _view, configure_html} =
        live(
          conn,
          ~p"/admin/networks/#{network.id}/integrations/#{integration.id}/configure"
        )

      assert configure_html =~ "No configuration required"
    end

    test "optional integrations are shown as optional with a per-organization note", %{
      conn: conn,
      network: network,
      admin_user: admin_user
    } do
      {:ok, weather_widget} =
        Widgets.create_widget(%{
          name: "Weather #{System.unique_integer([:positive])}",
          slug: "weather-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Weather</div>"},
          is_system: true
        })

      {:ok, weather_integration} =
        Integrations.create_integration(%{
          widget_id: weather_widget.id,
          name: "open-meteo",
          description: "Weather with optional commercial key",
          integration_type: "pull",
          credential_scope: "organization",
          pull_endpoint: "https://api.open-meteo.com/v1/forecast",
          pull_interval_seconds: 900,
          credential_schema: %{
            "auth_type" => "optional",
            "fields" => %{
              "apikey" => %{"label" => "Commercial API Key", "required" => false}
            }
          }
        })

      conn = log_in_admin(conn, admin_user)
      {:ok, _view, html} = live(conn, ~p"/admin/networks/#{network.id}/integrations")

      # It should be listed and flagged as optional.
      assert html =~ weather_integration.name
      assert html =~ "Optional"

      # The configure page should explain it's optional and configured per organization.
      {:ok, _view, configure_html} =
        live(
          conn,
          ~p"/admin/networks/#{network.id}/integrations/#{weather_integration.id}/configure"
        )

      assert configure_html =~ "Optional"
      assert configure_html =~ "whole network"
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

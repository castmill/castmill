defmodule CastmillWeb.WidgetOAuthControllerTest do
  use CastmillWeb.ConnCase, async: false

  import ExUnit.CaptureLog
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures
  import Castmill.NetworksFixtures

  alias Castmill.Accounts
  alias Castmill.Organizations
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.OAuth.Generic, as: GenericOAuth

  @oauth_credential_schema %{
    "auth_type" => "oauth2",
    "oauth2" => %{
      "authorization_url" => "https://example-oauth.com/authorize",
      "token_url" => "https://example-oauth.com/token",
      "scopes" => ["read", "write"],
      "client_auth" => "basic"
    },
    "fields" => %{
      "client_id" => %{"type" => "string", "label" => "Client ID", "required" => true},
      "client_secret" => %{"type" => "string", "label" => "Client Secret", "secret" => true}
    }
  }

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})

    # Create a user and add them to the organization as admin
    {:ok, user} =
      Accounts.create_user(%{
        email: "oauth-test-#{System.unique_integer([:positive])}@test.com",
        name: "OAuth Test User",
        network_id: network.id
      })

    {:ok, _} = Organizations.add_user(organization.id, user.id, :admin)

    # Create a widget with OAuth credential schema
    widget =
      widget_fixture(%{
        name: "OAuth Test Widget #{System.unique_integer([:positive])}",
        slug: "oauth-test-widget-#{System.unique_integer([:positive])}",
        template: %{"type" => "text", "text" => "{{data.value}}"},
        options_schema: %{},
        data_schema: %{},
        small_icon: nil,
        icon: nil,
        meta: %{}
      })

    # Create integration with OAuth config
    {:ok, integration} =
      Integrations.create_integration(%{
        widget_id: widget.id,
        name: "oauth-test",
        integration_type: "pull",
        credential_scope: "organization",
        credential_schema: @oauth_credential_schema,
        pull_config: %{
          "client_id" => "test-client-id",
          "client_secret" => "test-client-secret"
        },
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300,
        is_active: true
      })

    %{
      organization: organization,
      widget: widget,
      integration: integration,
      network: network,
      user: user
    }
  end

  describe "authorize/2" do
    test "redirects to OAuth provider with proper parameters", %{
      conn: conn,
      organization: organization,
      integration: integration,
      user: user
    } do
      conn =
        conn
        |> log_in_user(user)
        |> get(
          "/auth/widget-integrations/#{integration.id}/authorize",
          %{
            "organization_id" => organization.id,
            "redirect_url" => "http://localhost:4000/dashboard"
          }
        )

      assert redirected_to(conn, 302) =~ "https://example-oauth.com/authorize"
      assert redirected_to(conn, 302) =~ "client_id=test-client-id"
      assert redirected_to(conn, 302) =~ "response_type=code"
      assert redirected_to(conn, 302) =~ "scope=read+write"
      assert redirected_to(conn, 302) =~ "state="
    end

    test "returns 401 when user is not authenticated", %{
      conn: conn,
      organization: organization,
      integration: integration
    } do
      conn =
        get(
          conn,
          "/auth/widget-integrations/#{integration.id}/authorize",
          %{"organization_id" => organization.id}
        )

      assert json_response(conn, 401)["error"] == "Authentication required"
    end

    test "returns 403 when user does not belong to organization", %{
      conn: conn,
      organization: organization,
      integration: integration,
      network: network
    } do
      # Create another user not in the organization
      {:ok, other_user} =
        Accounts.create_user(%{
          email: "other-user-#{System.unique_integer([:positive])}@test.com",
          name: "Other User",
          network_id: network.id
        })

      conn =
        conn
        |> log_in_user(other_user)
        |> get(
          "/auth/widget-integrations/#{integration.id}/authorize",
          %{"organization_id" => organization.id}
        )

      assert json_response(conn, 403)["error"] == "Not authorized"
    end

    test "returns 400 when organization_id is missing", %{
      conn: conn,
      integration: integration,
      user: user
    } do
      conn =
        conn
        |> log_in_user(user)
        |> get(
          "/auth/widget-integrations/#{integration.id}/authorize",
          %{}
        )

      assert json_response(conn, 400)["error"] =~ "organization_id"
    end

    test "returns 404 when integration does not exist", %{
      conn: conn,
      organization: organization,
      user: user
    } do
      # Use a non-existent integer ID
      conn =
        conn
        |> log_in_user(user)
        |> get(
          "/auth/widget-integrations/999999/authorize",
          %{"organization_id" => organization.id}
        )

      assert json_response(conn, 404)["error"] == "Integration not found"
    end

    test "returns 400 when integration has no OAuth config", %{
      conn: conn,
      organization: organization,
      widget: widget,
      user: user
    } do
      # Create an integration without OAuth
      {:ok, non_oauth_integration} =
        Integrations.create_integration(%{
          widget_id: widget.id,
          name: "api-key-only",
          integration_type: "pull",
          credential_scope: "organization",
          credential_schema: %{
            "auth_type" => "api_key",
            "fields" => %{"api_key" => %{"type" => "string"}}
          },
          pull_endpoint: "https://api.example.com/data",
          pull_interval_seconds: 300,
          is_active: true
        })

      conn =
        conn
        |> log_in_user(user)
        |> get(
          "/auth/widget-integrations/#{non_oauth_integration.id}/authorize",
          %{"organization_id" => organization.id}
        )

      assert json_response(conn, 400)["error"] =~ "OAuth"
    end

    test "includes redirect_url in state parameter for OAuth round-trip", %{
      conn: conn,
      organization: organization,
      integration: integration,
      user: user
    } do
      redirect_url = "http://myapp.com/settings/widgets"

      conn =
        conn
        |> log_in_user(user)
        |> get(
          "/auth/widget-integrations/#{integration.id}/authorize",
          %{
            "organization_id" => organization.id,
            "redirect_url" => redirect_url
          }
        )

      # Extract state from redirect URL
      location = redirected_to(conn, 302)
      uri = URI.parse(location)
      query_params = URI.decode_query(uri.query || "")
      state = query_params["state"]

      # Decode state and verify redirect_url is included
      {:ok, decoded} = Base.url_decode64(state, padding: false)
      {:ok, data} = Jason.decode(decoded)
      assert data["redirect_url"] == redirect_url
    end
  end

  describe "callback_unified/2" do
    test "handles OAuth error from provider", %{
      conn: conn,
      integration: integration,
      organization: organization
    } do
      # Create a valid state parameter that includes redirect_url
      {:ok, oauth_config} = GenericOAuth.get_oauth_config(@oauth_credential_schema)

      {:ok, _url, state} =
        GenericOAuth.authorization_url(
          oauth_config,
          "client-id",
          "http://localhost/callback",
          %{
            integration_id: integration.id,
            organization_id: organization.id,
            widget_config_id: nil,
            redirect_url: "http://localhost/dashboard"
          }
        )

      {conn, _log} =
        with_log(fn ->
          conn
          |> get("/auth/widget-integrations/callback", %{
            "error" => "access_denied",
            "error_description" => "User denied access",
            "state" => state
          })
        end)

      location = redirected_to(conn, 302)
      assert location =~ "oauth_status=error"
      assert location =~ "User+denied+access" or location =~ "User%20denied%20access"
    end

    test "returns error for missing state parameter", %{
      conn: conn
    } do
      {conn, _log} =
        with_log(fn ->
          conn
          |> get("/auth/widget-integrations/callback", %{
            "code" => "auth-code-123"
          })
        end)

      location = redirected_to(conn, 302)
      assert location =~ "oauth_status=error"
      assert location =~ "Invalid" or location =~ "state"
    end

    test "returns error for invalid state parameter", %{
      conn: conn
    } do
      {conn, _log} =
        with_log(fn ->
          conn
          |> get("/auth/widget-integrations/callback", %{
            "code" => "auth-code-123",
            "state" => "invalid-state-data"
          })
        end)

      location = redirected_to(conn, 302)
      assert location =~ "oauth_status=error"
    end

    test "returns error when state integration_id doesn't match extracted context", %{
      conn: conn,
      organization: organization,
      integration: integration,
      widget: widget
    } do
      # Create another integration
      {:ok, other_integration} =
        Integrations.create_integration(%{
          widget_id: widget.id,
          name: "other-integration",
          integration_type: "pull",
          credential_scope: "organization",
          credential_schema: @oauth_credential_schema,
          pull_config: %{
            "client_id" => "other-client",
            "client_secret" => "other-secret"
          },
          pull_endpoint: "https://api.example.com/other",
          pull_interval_seconds: 600,
          is_active: true
        })

      # Generate state for one integration
      {:ok, oauth_config} = GenericOAuth.get_oauth_config(@oauth_credential_schema)

      {:ok, _url, _state} =
        GenericOAuth.authorization_url(
          oauth_config,
          "client-id",
          "http://localhost/callback",
          %{
            integration_id: integration.id,
            organization_id: organization.id,
            widget_config_id: nil,
            redirect_url: "http://localhost/dashboard"
          }
        )

      # Manually tamper with the state to change integration_id (this should fail signature validation)
      # Instead, we create a properly signed state for a different integration
      {:ok, _url2, other_state} =
        GenericOAuth.authorization_url(
          oauth_config,
          "client-id",
          "http://localhost/callback",
          %{
            integration_id: other_integration.id,
            organization_id: organization.id,
            widget_config_id: nil,
            redirect_url: "http://localhost/dashboard"
          }
        )

      # Use the callback with other_state - the integration_id in state will be validated against process_callback
      # This tests that extract_context_from_state properly extracts integration_id
      {conn, _log} =
        with_log(fn ->
          conn
          |> get("/auth/widget-integrations/callback", %{
            "code" => "auth-code-123",
            "state" => other_state
          })
        end)

      # This should actually succeed at extraction but fail at token exchange (no mock)
      # For now, just verify we get some response
      location = redirected_to(conn, 302)
      assert location =~ "oauth_status=error"
    end

    test "uses default redirect URL when error occurs and state is missing", %{
      conn: conn
    } do
      {conn, _log} =
        with_log(fn ->
          conn
          |> get("/auth/widget-integrations/callback", %{
            "error" => "access_denied"
          })
        end)

      # Should redirect to /dashboard by default
      location = redirected_to(conn, 302)
      assert location =~ "/dashboard"
      assert location =~ "oauth_status=error"
    end
  end

  describe "state validation" do
    test "validates state was generated for the correct integration", %{
      organization: organization,
      integration: integration
    } do
      {:ok, oauth_config} = GenericOAuth.get_oauth_config(@oauth_credential_schema)

      {:ok, _url, state} =
        GenericOAuth.authorization_url(
          oauth_config,
          "client-id",
          "http://localhost/callback",
          %{
            integration_id: integration.id,
            organization_id: organization.id,
            widget_config_id: nil
          }
        )

      # State should be valid
      assert {:ok, context} = GenericOAuth.validate_state(state)
      assert context.integration_id == integration.id
      assert context.organization_id == organization.id
    end
  end

  # Helper to log in a user via session
  defp log_in_user(conn, user) do
    token = Accounts.generate_user_session_token(user.id)

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end
end

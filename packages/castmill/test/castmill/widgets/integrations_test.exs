defmodule Castmill.Widgets.IntegrationsTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{
    WidgetIntegration,
    WidgetIntegrationCredential
  }

  @moduletag :widget_integrations_case

  describe "widget integrations" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget} =
        Widgets.create_widget(%{
          name: "Weather Widget #{System.unique_integer([:positive])}",
          slug: "weather-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Weather</div>"}
        })

      %{widget: widget, organization: organization}
    end

    test "create_integration/1 creates a PULL integration", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "openweather",
        description: "OpenWeather API Integration",
        integration_type: "pull",
        credential_scope: "organization",
        pull_endpoint: "https://api.openweathermap.org/data/2.5/weather",
        pull_interval_seconds: 1800,
        credential_schema: %{
          "api_key" => %{"type" => "string", "required" => true}
        }
      }

      assert {:ok, %WidgetIntegration{} = integration} = Integrations.create_integration(attrs)
      assert integration.name == "openweather"
      assert integration.integration_type == "pull"
      assert integration.credential_scope == "organization"
      assert integration.pull_interval_seconds == 1800
    end

    test "create_integration/1 creates a PUSH integration", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "facebook",
        description: "Facebook Webhook",
        integration_type: "push",
        credential_scope: "widget",
        push_webhook_path: "/facebook"
      }

      assert {:ok, %WidgetIntegration{} = integration} = Integrations.create_integration(attrs)
      assert integration.name == "facebook"
      assert integration.integration_type == "push"
      assert integration.push_webhook_path == "/facebook"
    end

    test "create_integration/1 validates required fields for PULL type", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "test",
        integration_type: "pull",
        credential_scope: "organization"
        # Missing pull_endpoint and pull_interval_seconds
      }

      assert {:error, changeset} = Integrations.create_integration(attrs)
      assert "can't be blank" in errors_on(changeset).pull_endpoint
      assert "can't be blank" in errors_on(changeset).pull_interval_seconds
    end

    test "create_integration/1 validates required fields for PUSH type", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "test",
        integration_type: "push",
        credential_scope: "organization"
        # Missing push_webhook_path
      }

      assert {:error, changeset} = Integrations.create_integration(attrs)
      assert "can't be blank" in errors_on(changeset).push_webhook_path
    end
  end

  describe "widget integration credentials" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget} =
        Widgets.create_widget(%{
          name: "Weather Widget Creds #{System.unique_integer([:positive])}",
          slug: "weather-creds-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Weather</div>"}
        })

      {:ok, integration} =
        Integrations.create_integration(%{
          widget_id: widget.id,
          name: "openweather",
          integration_type: "pull",
          credential_scope: "organization",
          pull_endpoint: "https://api.example.com",
          pull_interval_seconds: 1800
        })

      %{widget: widget, organization: organization, integration: integration}
    end

    test "create_credentials/1 creates organization-scoped credentials", %{
      integration: integration,
      organization: organization
    } do
      encrypted = :crypto.strong_rand_bytes(100)

      attrs = %{
        widget_integration_id: integration.id,
        organization_id: organization.id,
        encrypted_credentials: encrypted
      }

      assert {:ok, %WidgetIntegrationCredential{} = cred} = Integrations.create_credentials(attrs)
      assert cred.organization_id == organization.id
      assert is_nil(cred.widget_config_id)
      assert cred.encrypted_credentials == encrypted
    end

    test "create_credentials/1 validates scope requirement" do
      encrypted = :crypto.strong_rand_bytes(100)

      # Neither organization_id nor widget_config_id set
      attrs = %{
        widget_integration_id: 123,
        encrypted_credentials: encrypted
      }

      assert {:error, changeset} = Integrations.create_credentials(attrs)

      assert "either organization_id or widget_config_id must be set" in errors_on(changeset).organization_id
    end
  end

  describe "network integration credentials" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget} =
        Widgets.create_widget(%{
          name: "OAuth Widget #{System.unique_integer([:positive])}",
          slug: "oauth-widget-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>OAuth</div>"},
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
              %{"name" => "client_id", "type" => "text", "required" => true},
              %{"name" => "client_secret", "type" => "password", "required" => true}
            ]
          }
        })

      %{network: network, organization: organization, widget: widget, integration: integration}
    end

    test "upsert_network_credentials/3 creates new credentials", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "test-client-id", "client_secret" => "test-secret"}

      assert {:ok, cred} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)
      assert cred.network_id == network.id
      assert cred.integration_id == integration.id
      assert cred.is_enabled == true
      assert is_binary(cred.encrypted_credentials)
    end

    test "upsert_network_credentials/3 updates existing credentials", %{
      network: network,
      integration: integration
    } do
      # Create first
      credentials1 = %{"client_id" => "first-id", "client_secret" => "first-secret"}
      assert {:ok, cred1} = Integrations.upsert_network_credentials(network.id, integration.id, credentials1)

      # Update
      credentials2 = %{"client_id" => "second-id", "client_secret" => "second-secret"}
      assert {:ok, cred2} = Integrations.upsert_network_credentials(network.id, integration.id, credentials2)

      # Same ID (updated, not created new)
      assert cred1.id == cred2.id

      # Verify new credentials are stored
      assert {:ok, decrypted} = Integrations.get_decrypted_network_credentials(network.id, integration.id)
      assert decrypted["client_id"] == "second-id"
      assert decrypted["client_secret"] == "second-secret"
    end

    test "get_decrypted_network_credentials/2 returns decrypted credentials", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "my-client-id", "client_secret" => "super-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      assert {:ok, decrypted} = Integrations.get_decrypted_network_credentials(network.id, integration.id)
      assert decrypted["client_id"] == "my-client-id"
      assert decrypted["client_secret"] == "super-secret"
    end

    test "get_decrypted_network_credentials/2 returns error for non-existent", %{
      network: network,
      integration: integration
    } do
      assert {:error, :not_found} = Integrations.get_decrypted_network_credentials(network.id, integration.id)
    end

    test "get_decrypted_network_credentials/2 returns error for disabled credentials", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)
      {:ok, _} = Integrations.set_network_credentials_enabled(network.id, integration.id, false)

      assert {:error, :disabled} = Integrations.get_decrypted_network_credentials(network.id, integration.id)
    end

    test "set_network_credentials_enabled/3 toggles enabled status", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, cred} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)
      assert cred.is_enabled == true

      {:ok, updated} = Integrations.set_network_credentials_enabled(network.id, integration.id, false)
      assert updated.is_enabled == false

      {:ok, re_enabled} = Integrations.set_network_credentials_enabled(network.id, integration.id, true)
      assert re_enabled.is_enabled == true
    end

    test "delete_network_credentials/2 removes credentials", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      assert {:ok, _} = Integrations.delete_network_credentials(network.id, integration.id)
      assert {:error, :not_found} = Integrations.get_decrypted_network_credentials(network.id, integration.id)
    end

    test "delete_network_credentials/2 returns error if not found", %{
      network: network,
      integration: integration
    } do
      assert {:error, :not_found} = Integrations.delete_network_credentials(network.id, integration.id)
    end

    test "has_network_credentials?/2 returns true when configured", %{
      network: network,
      integration: integration
    } do
      assert Integrations.has_network_credentials?(network.id, integration.id) == false

      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      assert Integrations.has_network_credentials?(network.id, integration.id) == true
    end

    test "has_network_credentials?/2 returns false when disabled", %{
      network: network,
      integration: integration
    } do
      credentials = %{"client_id" => "test-id", "client_secret" => "test-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)
      {:ok, _} = Integrations.set_network_credentials_enabled(network.id, integration.id, false)

      assert Integrations.has_network_credentials?(network.id, integration.id) == false
    end

    test "get_client_credentials/2 returns network credentials", %{
      network: network,
      organization: organization,
      integration: integration
    } do
      credentials = %{"client_id" => "network-client-id", "client_secret" => "network-secret"}
      {:ok, _} = Integrations.upsert_network_credentials(network.id, integration.id, credentials)

      assert {:ok, creds} = Integrations.get_client_credentials(integration.id, organization.id)
      assert creds.client_id == "network-client-id"
      assert creds.client_secret == "network-secret"
    end

    test "list_system_integrations_requiring_credentials/0 returns system integrations with schemas", %{
      integration: integration
    } do
      integrations = Integrations.list_system_integrations_requiring_credentials()

      assert Enum.any?(integrations, fn i -> i.id == integration.id end)

      found = Enum.find(integrations, fn i -> i.id == integration.id end)
      assert found.widget.is_system == true
      assert found.credential_schema != nil
    end
  end

  describe "discriminator-based caching" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget} =
        Widgets.create_widget(%{
          name: "Test Widget #{System.unique_integer([:positive])}",
          slug: "test-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Test</div>"},
          is_system: false
        })

      %{widget: widget, organization: organization}
    end

    test "create_integration/1 with discriminator_type organization", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "org-shared-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "organization",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      }

      assert {:ok, %WidgetIntegration{} = integration} = Integrations.create_integration(attrs)
      assert integration.discriminator_type == "organization"
      assert integration.discriminator_key == nil
    end

    test "create_integration/1 with discriminator_type widget_option requires discriminator_key", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "option-shared-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_option",
        # Missing discriminator_key
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      }

      assert {:error, changeset} = Integrations.create_integration(attrs)
      assert "can't be blank" in errors_on(changeset).discriminator_key
    end

    test "create_integration/1 with discriminator_type widget_option with key", %{widget: widget} do
      attrs = %{
        widget_id: widget.id,
        name: "option-shared-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_option",
        discriminator_key: "property_id",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      }

      assert {:ok, %WidgetIntegration{} = integration} = Integrations.create_integration(attrs)
      assert integration.discriminator_type == "widget_option"
      assert integration.discriminator_key == "property_id"
    end

    test "compute_discriminator_id/4 for organization type", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "org-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "organization",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      assert {:ok, discriminator} = Integrations.compute_discriminator_id(integration, organization.id)
      assert discriminator == "org:#{organization.id}"
    end

    test "compute_discriminator_id/4 for widget_option type", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "opt-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_option",
        discriminator_key: "property_id",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      options = %{"property_id" => "abc-123"}
      assert {:ok, discriminator} = Integrations.compute_discriminator_id(integration, organization.id, nil, options)
      assert discriminator == "opt:abc-123"
    end

    test "compute_discriminator_id/4 for widget_option type with atom keys", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "opt-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_option",
        discriminator_key: "property_id",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      options = %{property_id: "xyz-789"}
      assert {:ok, discriminator} = Integrations.compute_discriminator_id(integration, organization.id, nil, options)
      assert discriminator == "opt:xyz-789"
    end

    test "compute_discriminator_id/4 for widget_option type missing option returns error", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "opt-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_option",
        discriminator_key: "property_id",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      options = %{"other_option" => "value"}
      assert {:error, {:missing_option, "property_id"}} = Integrations.compute_discriminator_id(integration, organization.id, nil, options)
    end

    test "compute_discriminator_id/4 for widget_config type", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "cfg-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_config",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      widget_config_id = Ecto.UUID.generate()
      assert {:ok, discriminator} = Integrations.compute_discriminator_id(integration, organization.id, widget_config_id)
      assert discriminator == "cfg:#{widget_config_id}"
    end

    test "compute_discriminator_id/4 for widget_config type requires widget_config_id", %{widget: widget, organization: organization} do
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "cfg-test-#{System.unique_integer([:positive])}",
        integration_type: "pull",
        credential_scope: "organization",
        discriminator_type: "widget_config",
        pull_endpoint: "https://api.example.com/data",
        pull_interval_seconds: 300
      })

      assert {:error, :widget_config_required} = Integrations.compute_discriminator_id(integration, organization.id, nil)
    end
  end

  describe "validate_integration_credentials_for_widget/2" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget_with_integration} =
        Widgets.create_widget(%{
          name: "Spotify Widget #{System.unique_integer([:positive])}",
          slug: "spotify-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Spotify</div>"}
        })

      {:ok, widget_without_integration} =
        Widgets.create_widget(%{
          name: "Simple Widget #{System.unique_integer([:positive])}",
          slug: "simple-#{System.unique_integer([:positive])}",
          template: %{"html" => "<div>Simple</div>"}
        })

      # Create integration with credentials required (has auth_type in credential_schema)
      {:ok, integration} = Integrations.create_integration(%{
        widget_id: widget_with_integration.id,
        name: "spotify",
        description: "Spotify integration",
        integration_type: "pull",
        credential_scope: "organization",
        pull_endpoint: "https://api.spotify.com/v1/me/player",
        pull_interval_seconds: 15,
        credential_schema: %{
          "auth_type" => "oauth2",
          "fields" => %{
            "client_id" => %{"type" => "string", "required" => true},
            "client_secret" => %{"type" => "string", "required" => true}
          }
        }
      })

      %{
        widget_with_integration: widget_with_integration,
        widget_without_integration: widget_without_integration,
        integration: integration,
        organization: organization
      }
    end

    test "returns :ok for widget without integrations", %{
      widget_without_integration: widget,
      organization: organization
    } do
      assert :ok = Widgets.validate_integration_credentials_for_widget(widget.id, organization.id)
    end

    test "returns error for widget with integration requiring credentials but none configured", %{
      widget_with_integration: widget,
      organization: organization
    } do
      # Widget has integration with credential_schema, but no credentials stored
      assert {:error, :missing_integration_credentials} =
        Widgets.validate_integration_credentials_for_widget(widget.id, organization.id)
    end

    test "returns :ok for widget with integration when credentials are configured", %{
      widget_with_integration: widget,
      integration: integration,
      organization: organization
    } do
      # Store credentials for this organization
      {:ok, _credential} = Integrations.upsert_credentials(%{
        widget_integration_id: integration.id,
        organization_id: organization.id,
        encrypted_credentials: "test_encrypted_data"
      })

      assert :ok = Widgets.validate_integration_credentials_for_widget(widget.id, organization.id)
    end

    test "returns :ok for widget with integration that has empty credential_schema", %{
      widget_without_integration: widget,
      organization: organization
    } do
      # Create integration with empty credential_schema (no credentials needed)
      {:ok, _integration} = Integrations.create_integration(%{
        widget_id: widget.id,
        name: "no-auth",
        description: "No auth needed",
        integration_type: "pull",
        credential_scope: "organization",
        pull_endpoint: "https://api.public.com/data",
        pull_interval_seconds: 300,
        credential_schema: %{}
      })

      assert :ok = Widgets.validate_integration_credentials_for_widget(widget.id, organization.id)
    end
  end
end

defmodule Castmill.Widgets.IntegrationsTest do
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{
    WidgetIntegration,
    WidgetIntegrationCredential,
    WidgetIntegrationData
  }

  @moduletag :widget_integrations_case

  describe "widget integrations" do
    setup do
      network = network_fixture()
      organization = organization_fixture(%{network_id: network.id})

      {:ok, widget} =
        Widgets.create_widget(%{
          name: "Weather Widget",
          slug: "weather",
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
          name: "Weather Widget",
          slug: "weather",
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
end

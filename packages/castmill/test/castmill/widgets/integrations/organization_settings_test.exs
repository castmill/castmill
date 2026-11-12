defmodule Castmill.Widgets.Integrations.OrganizationSettingsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.OrganizationSettings
  alias Castmill.Widgets.NetworkAccess
  alias Castmill.Widgets

  @definition %{
    "key" => "property-listing",
    "name" => "Property listings",
    "description" => "Agency and offices",
    "schema" => %{
      "agency" => %{"type" => "string", "label" => "Agency", "required" => true, "x" => 1},
      "office_ids" => %{"type" => "list", "label" => "Office IDs"},
      "limit" => %{"type" => "number"},
      "enabled" => %{"type" => "boolean"},
      "bad name" => %{"type" => "string"},
      "weird" => %{"type" => "date"}
    }
  }

  defp integration_for(widget, settings, name \\ "listing") do
    {:ok, integration} =
      Integrations.create_integration(%{
        widget_id: widget.id,
        name: name,
        integration_type: "pull",
        pull_endpoint: "fetcher",
        pull_interval_seconds: 300,
        credential_scope: "organization",
        pull_config: %{"auth_type" => "none", "organization_settings" => settings}
      })

    integration
  end

  setup do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    widget = widget_fixture(%{is_system: false, network_id: network.id})
    integration = integration_for(widget, @definition)
    {:ok, network: network, organization: organization, widget: widget, integration: integration}
  end

  test "lists valid definitions declared by available widgets", %{
    network: network,
    organization: organization
  } do
    system = widget_fixture(%{is_system: true})

    integration_for(system, %{
      "key" => "a-system",
      "schema" => %{"code" => %{"type" => "string"}}
    })

    other_network = network_fixture()
    other = widget_fixture(%{is_system: false, network_id: other_network.id})
    integration_for(other, %{"key" => "other", "schema" => %{"x" => %{"type" => "string"}}})

    invalid = widget_fixture(%{is_system: false, network_id: network.id})
    integration_for(invalid, %{"key" => "Bad Key", "schema" => %{"x" => %{"type" => "string"}}})
    integration_for(invalid, %{"key" => "no-fields", "schema" => %{}}, "b")
    integration_for(invalid, "not a map", "c")

    assert [%{"key" => "a-system", "name" => nil}, listing] =
             OrganizationSettings.definitions(network.id, organization.id)

    assert listing["name"] == "Property listings"
    assert Map.keys(listing["schema"]) |> Enum.sort() == ~w(agency enabled limit office_ids)

    assert listing["schema"]["agency"] == %{
             "type" => "string",
             "label" => "Agency",
             "required" => true
           }
  end

  test "availability controls definitions and saves without deleting stored settings", %{
    network: network,
    organization: org,
    widget: widget
  } do
    other = organization_fixture(%{network_id: network.id, name: "Other organization"})

    {:ok, _} =
      OrganizationSettings.put(network.id, org.id, "property-listing", %{"agency" => "fb"})

    assert {:ok, _} = NetworkAccess.set_access(network.id, widget.id, "selected")

    assert {:ok, _} =
             NetworkAccess.update_organizations(network.id, widget.id, %{disable: [org.id]})

    assert OrganizationSettings.list_for_organization(network.id, org.id) == []

    assert [%{"key" => "property-listing"}] =
             OrganizationSettings.list_for_organization(network.id, other.id)

    assert {:error, :unknown_key} =
             OrganizationSettings.put(network.id, org.id, "property-listing", %{"agency" => "x"})

    assert OrganizationSettings.get(org.id, "property-listing") == %{"agency" => "fb"}

    assert {:ok, _} =
             NetworkAccess.update_organizations(network.id, widget.id, %{enable: [org.id]})

    assert [%{"settings" => %{"agency" => "fb"}}] =
             OrganizationSettings.list_for_organization(network.id, org.id)
  end

  test "includes organization-owned widgets and excludes other organizations and networks", %{
    network: network,
    organization: org
  } do
    other = organization_fixture(%{network_id: network.id, name: "Other organization"})
    private = widget_fixture(%{is_system: false, organization_id: org.id})
    integration_for(private, %{"key" => "private", "schema" => %{"x" => %{"type" => "string"}}})

    assert Enum.any?(
             OrganizationSettings.definitions(network.id, org.id),
             &(&1["key"] == "private")
           )

    refute Enum.any?(
             OrganizationSettings.definitions(network.id, other.id),
             &(&1["key"] == "private")
           )

    assert OrganizationSettings.definitions(network_fixture().id, org.id) == []

    assert {:error, :unknown_key} =
             OrganizationSettings.put(network_fixture().id, org.id, "property-listing", %{
               "agency" => "x"
             })
  end

  test "a shared key remains available while any declaring widget is available", %{
    network: network,
    organization: org,
    widget: widget
  } do
    other = widget_fixture(%{is_system: false, network_id: network.id})
    integration_for(other, @definition)
    assert {:ok, _} = NetworkAccess.set_access(network.id, widget.id, "hidden")
    assert [%{"key" => "property-listing"}] = OrganizationSettings.definitions(network.id, org.id)
    assert {:ok, _} = NetworkAccess.set_access(network.id, other.id, "hidden")
    assert OrganizationSettings.definitions(network.id, org.id) == []
  end

  test "uses the newest available declaration for a shared key", %{
    network: network,
    organization: org,
    widget: widget,
    integration: integration
  } do
    older = Ecto.Changeset.change(integration, updated_at: ~U[2020-01-01 00:00:00Z])
    Castmill.Repo.update!(older)
    newer_widget = widget_fixture(%{is_system: true})
    newer = integration_for(newer_widget, Map.put(@definition, "name", "Newer"))
    Castmill.Repo.update!(Ecto.Changeset.change(newer, updated_at: ~U[2021-01-01 00:00:00Z]))

    assert [%{"name" => "Newer"}] = OrganizationSettings.definitions(network.id, org.id)
    assert {:ok, _} = NetworkAccess.set_access(network.id, newer_widget.id, "hidden")

    assert [%{"name" => "Property listings"}] =
             OrganizationSettings.definitions(network.id, org.id)

    assert {:ok, _} = NetworkAccess.set_access(network.id, widget.id, "hidden")
    assert OrganizationSettings.definitions(network.id, org.id) == []
  end

  test "honors except policies and platform restrictions", %{
    network: network,
    organization: org,
    widget: widget
  } do
    other = organization_fixture(%{network_id: network.id, name: "Other organization"})

    assert {:ok, _} =
             NetworkAccess.update_organizations(network.id, widget.id, %{disable: [org.id]})

    assert OrganizationSettings.definitions(network.id, org.id) == []

    assert [%{"key" => "property-listing"}] =
             OrganizationSettings.definitions(network.id, other.id)

    system = widget_fixture(%{is_system: true, restricted: true})
    integration_for(system, %{"key" => "restricted", "schema" => %{"x" => %{"type" => "string"}}})

    refute Enum.any?(
             OrganizationSettings.definitions(network.id, org.id),
             &(&1["key"] == "restricted")
           )

    assert {:ok, _} = Widgets.enable_widget_for_organization(system, org.id)
    assert [%{"key" => "restricted"}] = OrganizationSettings.definitions(network.id, org.id)

    refute Enum.any?(
             OrganizationSettings.definitions(network.id, other.id),
             &(&1["key"] == "restricted")
           )
  end

  test "validates, normalizes and stores settings", %{network: network, organization: org} do
    assert OrganizationSettings.put(network.id, org.id, "nope", %{}) == {:error, :unknown_key}

    assert {:error, {:invalid, %{"settings" => _}}} =
             OrganizationSettings.put(network.id, org.id, "x", "y")

    assert {:error, {:invalid, errors}} =
             OrganizationSettings.put(network.id, org.id, "property-listing", %{
               "agency" => "  ",
               "office_ids" => ["a", 1],
               "limit" => "ten",
               "enabled" => "yes"
             })

    assert errors == %{
             "agency" => "required",
             "office_ids" => "invalid",
             "limit" => "invalid",
             "enabled" => "invalid"
           }

    assert {:error, {:invalid, %{"agency" => "too_long", "office_ids" => "too_many"}}} =
             OrganizationSettings.put(network.id, org.id, "property-listing", %{
               "agency" => String.duplicate("a", 1_001),
               "office_ids" => Enum.map(1..101, &"o#{&1}")
             })

    assert {:error, {:invalid, %{"office_ids" => "too_long"}}} =
             OrganizationSettings.put(network.id, org.id, "property-listing", %{
               "agency" => "fb",
               "office_ids" => [String.duplicate("a", 1_001)]
             })

    user_id = Ecto.UUID.generate()

    assert {:ok,
            %{"agency" => "fb", "office_ids" => ["M1", "M2"], "limit" => 3, "enabled" => false}} =
             OrganizationSettings.put(
               network.id,
               org.id,
               "property-listing",
               %{
                 "agency" => " fb ",
                 "office_ids" => [" M1", "M2", "M1", ""],
                 "limit" => 3,
                 "enabled" => false,
                 "unknown" => "dropped"
               },
               user_id
             )

    # Empty optional values are removed on update.
    assert {:ok, %{"agency" => "lff"}} =
             OrganizationSettings.put(network.id, org.id, "property-listing", %{
               "agency" => "lff",
               "office_ids" => []
             })

    assert OrganizationSettings.get(org.id, "property-listing") == %{"agency" => "lff"}

    assert [%{"key" => "property-listing", "settings" => %{"agency" => "lff"}}] =
             OrganizationSettings.list_for_organization(network.id, org.id)

    assert :ok = OrganizationSettings.delete(org.id, "property-listing")
    assert OrganizationSettings.get(org.id, "property-listing") == nil
  end

  test "fetchers receive the settings next to the credentials", %{
    organization: org,
    integration: integration
  } do
    assert Integrations.get_fetch_credentials(org.id, integration) == {:ok, %{}}

    {:ok, _} = OrganizationSettings.store(org.id, "property-listing", %{"agency" => "fb"})

    assert Integrations.get_fetch_credentials(org.id, integration) ==
             {:ok, %{"organization_settings" => %{"agency" => "fb"}}}

    assert OrganizationSettings.key_of(integration) == "property-listing"
    assert OrganizationSettings.key_of(%{integration | pull_config: %{}}) == nil
  end

  test "organization credentials cannot provide or satisfy organization settings", %{
    organization: org,
    integration: integration
  } do
    required_integration = %{
      integration
      | pull_config: Map.put(integration.pull_config, "auth_type", "required")
    }

    {:ok, _} = OrganizationSettings.store(org.id, "property-listing", %{"agency" => "fb"})

    assert Integrations.get_fetch_credentials(org.id, required_integration) ==
             {:error, :no_credentials}

    {:ok, _} =
      Integrations.upsert_organization_credentials(org.id, integration.id, %{
        "organization_settings" => %{"agency" => "injected"}
      })

    assert Integrations.get_fetch_credentials(org.id, required_integration) ==
             {:error, :no_credentials}

    {:ok, _} =
      Integrations.upsert_organization_credentials(org.id, integration.id, %{
        "api_key" => "secret",
        "organization_settings" => %{"agency" => "injected"}
      })

    assert Integrations.get_fetch_credentials(org.id, required_integration) ==
             {:ok, %{"api_key" => "secret", "organization_settings" => %{"agency" => "fb"}}}

    :ok = OrganizationSettings.delete(org.id, "property-listing")

    assert Integrations.get_fetch_credentials(org.id, required_integration) ==
             {:ok, %{"api_key" => "secret"}}
  end
end

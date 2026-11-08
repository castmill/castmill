defmodule Castmill.Widgets.Integrations.OrganizationSettingsTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.OrganizationSettings

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
    {:ok, network: network, organization: organization, integration: integration}
  end

  test "lists valid definitions declared by the network's and system widgets", %{network: network} do
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
             OrganizationSettings.definitions(network.id)

    assert listing["name"] == "Property listings"
    assert Map.keys(listing["schema"]) |> Enum.sort() == ~w(agency enabled limit office_ids)

    assert listing["schema"]["agency"] == %{
             "type" => "string",
             "label" => "Agency",
             "required" => true
           }
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
end

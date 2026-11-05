defmodule Castmill.Widgets.NetworkAccessTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Resources
  alias Castmill.Widgets
  alias Castmill.Widgets.NetworkAccess

  setup do
    network = network_fixture()
    other_network = network_fixture()

    org_a = organization_fixture(%{network_id: network.id, name: "Alpha Realty"})
    org_b = organization_fixture(%{network_id: network.id, name: "Beta Homes"})
    org_c = organization_fixture(%{network_id: network.id, name: "Gamma Cafe"})
    org_x = organization_fixture(%{network_id: other_network.id, name: "Other network org"})

    tag = "nat#{System.unique_integer([:positive])}"

    system = widget_fixture(%{is_system: true, name: "#{tag} German transit"})

    network_widget =
      widget_fixture(%{is_system: false, network_id: network.id, name: "#{tag} Realty"})

    other_widget =
      widget_fixture(%{is_system: false, network_id: other_network.id, name: "#{tag} Other"})

    org_widget =
      widget_fixture(%{is_system: false, organization_id: org_a.id, name: "#{tag} Private"})

    %{
      network: network,
      other_network: other_network,
      org_a: org_a,
      org_b: org_b,
      org_c: org_c,
      org_x: org_x,
      tag: tag,
      system: system,
      network_widget: network_widget,
      other_widget: other_widget,
      org_widget: org_widget
    }
  end

  defp use_widget(organization, widget) do
    playlist = playlist_fixture(%{organization_id: organization.id})
    {:ok, _} = Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 1000)
  end

  defp list(ctx, params \\ %{}),
    do: NetworkAccess.list_widgets(ctx.network.id, Map.put(params, :search, ctx.tag))

  defp ids(entries), do: Enum.map(entries, & &1.widget.id)

  defp organizations(ctx, widget, params \\ %{}) do
    {:ok, page} = NetworkAccess.list_organizations(ctx.network.id, widget.id, params)
    page
  end

  defp available?(organization, widget), do: Widgets.available?(organization.id, widget.id)

  describe "list_widgets/2" do
    test "lists system and network widgets with summaries, not other networks' or organization widgets",
         ctx do
      %{entries: entries, total: 2, summary: summary, organizations_count: 3} = list(ctx)

      assert ids(entries) == [ctx.system.id, ctx.network_widget.id]
      assert summary == %{"all" => 2, "except" => 0, "selected" => 0, "hidden" => 0, "total" => 2}

      assert [
               %{kind: "system", access: "all", enabled_count: 3, eligible_count: 3, core: false},
               %{kind: "network", access: "all", enabled_count: 3}
             ] = entries
    end

    test "filters by kind, access and paginates", ctx do
      assert ids(list(ctx, %{kind: "network"}).entries) == [ctx.network_widget.id]
      assert ids(list(ctx, %{kind: "system"}).entries) == [ctx.system.id]

      {:ok, _} = NetworkAccess.set_access(ctx.network.id, ctx.system.id, "hidden")

      {:ok, _} = NetworkAccess.set_access(ctx.network.id, ctx.network_widget.id, "except")

      assert ids(list(ctx, %{access: "hidden"}).entries) == [ctx.system.id]
      assert ids(list(ctx, %{access: "except"}).entries) == [ctx.network_widget.id]
      assert list(ctx, %{access: "all"}).entries == []

      assert list(ctx).summary == %{
               "all" => 0,
               "except" => 1,
               "selected" => 0,
               "hidden" => 1,
               "total" => 2
             }

      page = list(ctx, %{page: "2", page_size: "1"})
      assert ids(page.entries) == [ctx.network_widget.id]
      assert {page.page, page.page_size, page.total} == {2, 1, 2}
    end

    test "search treats wildcards literally", ctx do
      assert NetworkAccess.list_widgets(ctx.network.id, %{search: "%"}).entries == []
    end

    test "excludes platform-restricted system widgets not offered to the network", ctx do
      {:ok, restricted} = Widgets.set_widget_scope(ctx.system, %{restricted: true})
      refute ctx.system.id in ids(list(ctx).entries)

      {:ok, _} = Widgets.enable_widget_for_organization(restricted, ctx.org_b.id)

      assert [%{platform_restricted: true, eligible_count: 1, enabled_count: 1}] =
               list(ctx, %{kind: "system"}).entries

      assert [%{id: id}] = organizations(ctx, restricted).entries
      assert id == ctx.org_b.id
    end
  end

  describe "hiding a system widget" do
    test "only affects the network that hides it", ctx do
      assert {:ok, %{access: "hidden", enabled_count: 0}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "hidden")

      refute available?(ctx.org_a, ctx.system)
      refute available?(ctx.org_b, ctx.system)
      assert available?(ctx.org_x, ctx.system)

      assert {:ok, %{access: "all"}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "all")

      assert available?(ctx.org_a, ctx.system)
    end

    test "is refused while organizations use it", ctx do
      use_widget(ctx.org_b, ctx.system)

      assert {:error, {:in_use, [org_id]}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "hidden")

      assert org_id == ctx.org_b.id
      assert available?(ctx.org_a, ctx.system)
      assert hd(list(ctx, %{kind: "system"}).entries).in_use_count == 1
    end

    test "validates usage only in the network whose policy changes", ctx do
      use_widget(ctx.org_x, ctx.system)

      Castmill.Repo.insert!(%Castmill.Widgets.NetworkWidgetPolicy{
        network_id: ctx.other_network.id,
        widget_id: ctx.system.id,
        mode: "hidden"
      })

      refute available?(ctx.org_x, ctx.system)

      assert {:ok, %{access: "hidden"}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "hidden")

      refute available?(ctx.org_a, ctx.system)
    end
  end

  describe "selected organizations" do
    test "switching to selected keeps everyone enabled until deselected", ctx do
      for widget <- [ctx.system, ctx.network_widget] do
        assert {:ok, %{access: "selected", enabled_count: 3}} =
                 NetworkAccess.set_access(ctx.network.id, widget.id, "selected")

        assert {:ok, %{access: "selected", enabled_count: 2}} =
                 NetworkAccess.update_organizations(ctx.network.id, widget.id, %{
                   disable: [ctx.org_c.id]
                 })

        assert available?(ctx.org_a, widget)
        refute available?(ctx.org_c, widget)
      end

      assert Widgets.available?(ctx.org_x.id, ctx.system.id)
    end

    test "deselecting from all excludes the organization", ctx do
      assert {:ok, %{access: "except", enabled_count: 2, listed_count: 1}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 disable: [ctx.org_a.id]
               })

      refute available?(ctx.org_a, ctx.system)
      assert available?(ctx.org_b, ctx.system)
    end

    test "enabling organizations of an available-to-all widget is a no-op", ctx do
      assert {:ok, %{access: "all"}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 enable: [ctx.org_a.id]
               })
    end

    test "enabling an organization of a hidden widget selects it", ctx do
      {:ok, _} = NetworkAccess.set_access(ctx.network.id, ctx.network_widget.id, "hidden")

      assert {:ok, %{access: "selected", enabled_count: 0}} =
               NetworkAccess.set_access(ctx.network.id, ctx.network_widget.id, "selected")

      assert {:ok, %{access: "selected", enabled_count: 1}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.network_widget.id, %{
                 enable: [ctx.org_b.id]
               })

      assert available?(ctx.org_b, ctx.network_widget)
      refute available?(ctx.org_a, ctx.network_widget)
    end

    test "deselecting every organization leaves an empty selection", ctx do
      {:ok, _} = NetworkAccess.set_access(ctx.network.id, ctx.system.id, "selected")

      assert {:ok, %{access: "selected", enabled_count: 0, listed_count: 0}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 search: "",
                 enabled: false
               })
    end

    test "bulk changes apply to every organization matching the search", ctx do
      {:ok, _} = NetworkAccess.set_access(ctx.network.id, ctx.system.id, "hidden")

      assert {:ok, %{access: "selected", enabled_count: 1}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 search: "realty",
                 enabled: true
               })

      assert available?(ctx.org_a, ctx.system)
      refute available?(ctx.org_b, ctx.system)
      refute available?(ctx.org_c, ctx.system)
    end

    test "refuses deselecting organizations that use the widget", ctx do
      use_widget(ctx.org_a, ctx.network_widget)

      assert {:error, {:in_use, _}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.network_widget.id, %{
                 disable: [ctx.org_a.id]
               })

      assert available?(ctx.org_a, ctx.network_widget)
    end

    test "rejects organizations outside the network and conflicting changes", ctx do
      assert {:error, :organization_not_in_network} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 disable: [ctx.org_x.id]
               })

      assert {:error, :conflicting_changes} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 enable: [ctx.org_a.id],
                 disable: [ctx.org_a.id]
               })

      assert {:error, :invalid_organization_id} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 enable: ["nope"]
               })

      assert available?(ctx.org_a, ctx.system)
    end
  end

  describe "all except" do
    test "excluded organizations lose access, organizations created later keep it", ctx do
      assert {:ok, %{access: "except", enabled_count: 3, listed_count: 0}} =
               NetworkAccess.set_access(ctx.network.id, ctx.network_widget.id, "except")

      assert {:ok, %{access: "except", enabled_count: 2, listed_count: 1}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.network_widget.id, %{
                 disable: [ctx.org_b.id]
               })

      refute available?(ctx.org_b, ctx.network_widget)
      assert available?(ctx.org_a, ctx.network_widget)

      newcomer = organization_fixture(%{network_id: ctx.network.id, name: "Delta Newcomer"})
      assert available?(newcomer, ctx.network_widget)

      assert {:ok, %{access: "except", enabled_count: 4, listed_count: 0}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.network_widget.id, %{
                 enable: [ctx.org_b.id]
               })

      assert available?(ctx.org_b, ctx.network_widget)
    end

    test "switching modes keeps the organizations that can use the widget", ctx do
      {:ok, _} =
        NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
          disable: [ctx.org_c.id]
        })

      assert {:ok, %{access: "selected", enabled_count: 2, listed_count: 2}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "selected")

      assert {:ok, %{access: "except", enabled_count: 2, listed_count: 1}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "except")

      refute available?(ctx.org_c, ctx.system)

      assert {:ok, %{access: "except", enabled_count: 0}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 search: "",
                 enabled: false
               })

      assert {:ok, %{access: "all", enabled_count: 3}} =
               NetworkAccess.set_access(ctx.network.id, ctx.system.id, "all")
    end

    test "refuses excluding organizations that use the widget", ctx do
      use_widget(ctx.org_b, ctx.system)

      assert {:error, {:in_use, [org_id]}} =
               NetworkAccess.update_organizations(ctx.network.id, ctx.system.id, %{
                 disable: [ctx.org_b.id]
               })

      assert org_id == ctx.org_b.id
      assert available?(ctx.org_b, ctx.system)
    end
  end

  test "owner-restricted network widgets move to a network policy on their first change",
       ctx do
    {:ok, restricted} = Widgets.set_widget_scope(ctx.network_widget, %{restricted: true})
    {:ok, _} = Widgets.enable_widget_for_organization(restricted, ctx.org_a.id)

    assert %{access: "selected", enabled_count: 1, listed_count: 1} =
             NetworkAccess.get_widget(ctx.network.id, restricted.id)

    assert ids(list(ctx, %{access: "selected"}).entries) == [restricted.id]

    assert {:ok, %{access: "selected", enabled_count: 2}} =
             NetworkAccess.update_organizations(ctx.network.id, restricted.id, %{
               enable: [ctx.org_b.id]
             })

    refute Castmill.Repo.get!(Castmill.Widgets.Widget, restricted.id).restricted
    assert available?(ctx.org_a, restricted)
    assert available?(ctx.org_b, restricted)
    refute available?(ctx.org_c, restricted)
  end

  describe "list_organizations/3" do
    test "lists eligible organizations with access, usage, search and status filters", ctx do
      use_widget(ctx.org_b, ctx.network_widget)

      {:ok, _} =
        NetworkAccess.update_organizations(ctx.network.id, ctx.network_widget.id, %{
          disable: [ctx.org_c.id]
        })

      page = organizations(ctx, ctx.network_widget)
      assert page.counts == %{"total" => 3, "enabled" => 2}

      assert [
               %{name: "Alpha Realty", enabled: true, in_use: false},
               %{name: "Beta Homes", enabled: true, in_use: true},
               %{name: "Gamma Cafe", enabled: false, in_use: false}
             ] = page.entries

      assert [%{name: "Gamma Cafe"}] =
               organizations(ctx, ctx.network_widget, %{status: "disabled"}).entries

      assert [_, _] = organizations(ctx, ctx.network_widget, %{status: "enabled"}).entries

      assert [%{name: "Beta Homes"}] =
               organizations(ctx, ctx.network_widget, %{search: "beta"}).entries
    end

    test "is not found for widgets the network does not curate", ctx do
      for widget <- [ctx.other_widget, ctx.org_widget] do
        assert {:error, :not_found} =
                 NetworkAccess.list_organizations(ctx.network.id, widget.id, %{})

        assert {:error, :not_found} =
                 NetworkAccess.set_access(ctx.network.id, widget.id, "hidden")
      end

      assert NetworkAccess.get_widget(ctx.network.id, "abc") == nil
    end
  end

  test "core widgets cannot be restricted", ctx do
    assert NetworkAccess.core?(%Castmill.Widgets.Widget{slug: "layout-widget"})
    refute NetworkAccess.core?(ctx.system)

    image =
      Castmill.Repo.get_by(Castmill.Widgets.Widget, slug: "image") ||
        widget_fixture(%{is_system: true, slug: "image", name: "Image #{ctx.tag}"})

    assert {:error, :core_widget} = NetworkAccess.set_access(ctx.network.id, image.id, "hidden")

    assert {:error, :core_widget} =
             NetworkAccess.update_organizations(ctx.network.id, image.id, %{
               disable: [ctx.org_a.id]
             })

    assert {:ok, %{core: true, access: "all"}} =
             NetworkAccess.set_access(ctx.network.id, image.id, "all")
  end

  test "rejects unknown access modes", ctx do
    assert {:error, :invalid_access} =
             NetworkAccess.set_access(ctx.network.id, ctx.system.id, "x")
  end
end

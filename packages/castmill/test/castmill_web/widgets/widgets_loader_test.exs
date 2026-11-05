defmodule CastmillWeb.Widgets.WidgetsLoaderTest do
  use Castmill.DataCase, async: true

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.Widgets
  alias CastmillWeb.Widgets.WidgetsLoader

  setup do
    unique = System.unique_integer([:positive])
    directory = Path.join(System.tmp_dir!(), "castmill-widgets-loader-#{unique}")
    File.mkdir!(directory)
    on_exit(fn -> File.rm_rf!(directory) end)

    %{directory: directory, name: "Shipped Review #{unique}", slug: "shipped-review-#{unique}"}
  end

  test "startup refresh preserves a shipped widget's restriction and organization grants", ctx do
    network = network_fixture()
    enabled = organization_fixture(%{network_id: network.id, name: "Enabled"})
    disabled = organization_fixture(%{network_id: network.id, name: "Disabled"})
    widget = widget_fixture(%{name: ctx.name, slug: ctx.slug, restricted: true})
    {:ok, _} = Widgets.enable_widget_for_organization(widget, enabled.id)

    write_definition(ctx)
    WidgetsLoader.load_and_insert_json_data(ctx.directory)
    WidgetsLoader.load_and_insert_json_data(ctx.directory)

    updated = Widgets.get_widget(widget.id)
    assert updated.is_system
    assert updated.restricted
    assert updated.description == "Refreshed definition"
    assert Widgets.available?(enabled.id, widget.id)
    refute Widgets.available?(disabled.id, widget.id)
  end

  test "startup refresh keeps an unrestricted shipped widget unrestricted", ctx do
    widget = widget_fixture(%{name: ctx.name, slug: ctx.slug})
    write_definition(ctx)

    WidgetsLoader.load_and_insert_json_data(ctx.directory)

    refute Widgets.get_widget(widget.id).restricted
  end

  test "new shipped widgets are unrestricted system widgets", ctx do
    write_definition(ctx)

    WidgetsLoader.load_and_insert_json_data(ctx.directory)

    widget = Widgets.get_widget_by_slug(ctx.slug)
    assert widget.is_system
    refute widget.restricted
    assert widget.network_id == nil
    assert widget.organization_id == nil
  end

  defp write_definition(ctx) do
    File.write!(
      Path.join(ctx.directory, "widget.json"),
      Jason.encode!(%{
        name: ctx.name,
        description: "Refreshed definition",
        template: %{"components" => []},
        restricted: true
      })
    )
  end
end

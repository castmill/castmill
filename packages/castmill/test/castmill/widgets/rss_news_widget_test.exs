defmodule Castmill.Widgets.RssNewsWidgetTest do
  @moduledoc """
  The system RSS News widget, as the migrations leave it: options in
  Castmill's flat widget schema (the dashboard couldn't render its JSON Schema
  and the playlist editor stopped adding widgets), a required feed URL and
  the RSS integration, and a template in the player's format.
  """
  use Castmill.DataCase

  import Castmill.NetworksFixtures
  import Castmill.OrganizationsFixtures
  import Castmill.PlaylistsFixtures

  alias Castmill.{Resources, Widgets}
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Schema

  setup do
    %{widget: Widgets.get_widget_by_slug("rss-news")}
  end

  test "declares its options in the flat widget schema", %{widget: widget} do
    schema = widget.options_schema

    refute Map.has_key?(schema, "properties")
    refute Map.has_key?(schema, "type")
    assert {:ok, _} = Schema.validate_schema(schema, choices: true, visible_when: true)

    assert %{"type" => "url", "required" => true, "order" => 0} = schema["feed_url"]
    # max_items limits the whole feed, page_size is how many show at once.
    assert %{"type" => "number", "min" => 1, "max" => 100, "default" => 10} = schema["max_items"]
    assert %{"type" => "number", "min" => 1, "max" => 10, "default" => 3} = schema["page_size"]
    assert schema["transition_type"]["enum"] == ["fade", "slide-left", "none"]
    refute Map.has_key?(schema, "transition_easing")

    for {key, field} <- schema do
      refute Map.has_key?(field, "title"), "#{key} has a title"
      assert is_integer(field["order"]), "#{key} has no order"
    end
  end

  # The player renders this fixture in packages/player/tests/rss-news.spec.ts.
  @template_fixture Path.expand(
                      "../../../../player/tests/fixtures/rss-news-template.json",
                      __DIR__
                    )

  test "stores the template the player renders", %{widget: widget} do
    assert widget.template == @template_fixture |> File.read!() |> Jason.decode!()
    assert Castmill.Widgets.TemplateBindings.validate(widget.template) == :ok
  end

  test "labels every option, in every dashboard language", %{widget: widget} do
    for locale <- ~w(en es sv de fr zh ar ko ja), key <- Map.keys(widget.options_schema) do
      assert is_binary(get_in(widget.translations, [locale, "options", key, "label"])),
             "no #{locale} label for #{key}"
    end

    assert widget.translations["en"]["options"]["feed_url"]["label"] == "Feed URL"
    # Existing name and description translations are kept.
    assert widget.translations["sv"]["name"] == "RSS-nyheter"
  end

  test "fetches its feed through the RSS integration", %{widget: widget} do
    assert [integration] = Integrations.list_integrations(widget_id: widget.id)

    assert %{
             name: "rss",
             integration_type: "pull",
             discriminator_type: "widget_option",
             discriminator_key: "feed_url",
             refresh_mode: "on_demand",
             pull_config: %{"fetcher_module" => "Castmill.Widgets.Integrations.Fetchers.Rss"}
           } = integration
  end

  test "can be added to a playlist with a feed URL, not without one", %{widget: widget} do
    network = network_fixture()
    organization = organization_fixture(%{network_id: network.id})
    playlist = playlist_fixture(%{organization_id: organization.id})

    assert {:error, _} =
             Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{
               "max_items" => 3
             })

    assert {:ok, item} =
             Resources.insert_item_into_playlist(playlist.id, nil, widget.id, 0, 10_000, %{
               "feed_url" => "https://example.com/feed.xml",
               "max_items" => 3
             })

    assert [%{id: id}] = Resources.get_playlist_items(playlist.id)
    assert id == item.id
  end
end

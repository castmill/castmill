defmodule Castmill.Widgets.InstagramFeedWidgetTest do
  use Castmill.DataCase, async: true

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations

  # Keys used by an older template format that the player does not understand
  @unsupported_keys ["children", "item_template", "page_size", "page_duration", "data"]

  setup do
    widget = Widgets.get_widget_by_slug("instagram-feed")
    %{widget: widget}
  end

  test "template uses the player's template schema", %{widget: widget} do
    template = widget.template

    assert template["type"] == "group"
    assert is_map(template["style"])
    refute Map.has_key?(template["opts"] || %{}, "style")

    [list] = template["components"]
    assert list["type"] == "paginated-list"
    assert list["opts"]["items"] == %{"key" => "data.posts", "default" => []}
    assert list["opts"]["pageSize"] == 1
    assert %{"key" => "options.post_duration"} = list["opts"]["pageDuration"]

    card = list["component"]
    assert card["type"] == "group"

    names = Enum.map(card["components"], & &1["name"])
    assert names == ["post-media", "gradient-overlay", "post-header", "post-footer"]

    assert_no_unsupported_keys(template)
  end

  test "post bindings resolve against each item and the widget options", %{widget: widget} do
    [list] = widget.template["components"]
    [media | _] = list["component"]["components"]

    assert media["opts"]["url"] == %{"key" => "$.thumbnail_url"}
    assert media["opts"]["src"] == %{"key" => "$.media_url"}
    assert %{"key" => "options.media_fit"} = media["opts"]["size"]

    refute Enum.any?(Map.keys(widget.options_schema), &String.starts_with?(&1, "transition"))
  end

  test "integration uses widget-scoped credentials and posts client auth", %{widget: widget} do
    [integration] = Integrations.list_integrations(widget_id: widget.id)

    assert integration.credential_scope == "widget"
    assert Integrations.widget_scoped?(integration)
    assert integration.credential_schema["oauth2"]["client_auth"] == "post"
  end

  defp assert_no_unsupported_keys(component) when is_map(component) do
    for key <- @unsupported_keys do
      refute Map.has_key?(component, key), "unsupported key #{key} in #{component["name"]}"
    end

    Enum.each(component["components"] || [], &assert_no_unsupported_keys/1)

    if component["component"], do: assert_no_unsupported_keys(component["component"])
  end
end

defmodule Castmill.Widgets.TextOverridesTest do
  use Castmill.DataCase, async: true

  import Castmill.PlaylistsFixtures

  alias Castmill.Widgets.{TemplateBindings, TextOverrides, WidgetConfig}

  defp text(name, editable, style \\ %{}) do
    %{
      "type" => "text",
      "name" => name,
      "opts" => %{"text" => %{"key" => "data.#{name}"}},
      "style" => style,
      "editable" => editable
    }
  end

  @template %{
    "type" => "group",
    "name" => "root",
    "components" => [
      %{
        "type" => "text",
        "name" => "street",
        "opts" => %{"text" => %{"key" => "data.street"}},
        "editable" => %{"key" => "street", "label" => "Street", "max_length" => 10}
      },
      %{
        "type" => "paginated-list",
        "name" => "facts",
        "opts" => %{
          "items" => %{"key" => "data.facts"},
          "component" => %{
            "type" => "text",
            "name" => "value",
            "opts" => %{"text" => %{"key" => "$.value"}},
            "editable" => %{
              "key" => %{"fmt" => "fact.{$.id}"},
              "label" => %{"key" => "$.label"},
              "multiline" => true,
              "max_length" => 40
            }
          }
        }
      }
    ]
  }

  describe "TemplateBindings editable validation" do
    test "accepts editable texts with static and bound keys" do
      assert TemplateBindings.check(@template) == {[], []}
      assert TemplateBindings.validate(@template) == :ok
    end

    test "rejects invalid editable attributes" do
      cases = [
        {%{"type" => "image", "editable" => %{"key" => "x"}}, "only supported on text"},
        {text("a", "street"), "must be an object"},
        {text("a", %{}), "needs a key"},
        {text("a", %{"key" => " "}), "needs a key"},
        {text("a", %{"key" => String.duplicate("k", 201)}), "needs a key"},
        {text("a", %{"key" => %{}}), "needs a key"},
        {text("a", %{"key" => "a", "color" => "red"}), "unknown editable keys color"},
        {text("a", %{"key" => "a", "label" => 1}), "label must be a string or a binding"},
        {text("a", %{"key" => "a", "multiline" => "yes"}), "multiline must be a boolean"},
        {text("a", %{"key" => "a", "max_length" => 0}), "max_length must be an integer"},
        {text("a", %{"key" => "a", "max_length" => 5_001}), "max_length must be an integer"},
        {text("a", %{"key" => %{"fmt" => "fact.{$.id | nope}"}}), "unknown formatter"}
      ]

      for {template, expected} <- cases do
        assert {:error, messages} = TemplateBindings.validate(template)

        assert Enum.any?(messages, &(&1 =~ expected)),
               "expected #{inspect(expected)} in #{inspect(messages)}"
      end
    end

    test "names the component in error paths" do
      assert {:error, [message]} = TemplateBindings.validate(text("street", %{}))
      assert message =~ "street.editable"
    end

    test "warns about text-transform on editable texts" do
      assert {[], [{_path, warning}]} =
               TemplateBindings.check(
                 text("a", %{"key" => "a"}, %{"text-transform" => "uppercase"})
               )

      assert warning =~ "text-transform"

      with_conditional =
        text("a", %{"key" => "a"})
        |> Map.put("$styles", [%{"filter" => %{}, "style" => %{"text-transform" => "lowercase"}}])

      assert {[], [_]} = TemplateBindings.check(with_conditional)

      assert {[], []} =
               TemplateBindings.check(%{
                 "type" => "text",
                 "style" => %{"text-transform" => "uppercase"}
               })
    end

    test "editables/1 lists keys and limits" do
      assert TemplateBindings.editables(@template) == [
               %{key: "street", max_length: 10, multiline: false},
               %{key: nil, max_length: 40, multiline: true}
             ]

      assert TemplateBindings.editables(text("a", %{"key" => "a", "max_length" => "x"})) == [
               %{key: "a", max_length: 500, multiline: false}
             ]

      assert TemplateBindings.editables(%{"type" => "text"}) == []
      assert TemplateBindings.editables(nil) == []
    end
  end

  describe "TextOverrides.validate/2" do
    setup do
      {:ok, widget: %{template: @template, options_schema: %{}}}
    end

    test "accepts texts and hidden entries within limits", %{widget: widget} do
      assert :ok = TextOverrides.validate(nil, widget)
      assert :ok = TextOverrides.validate(%{}, widget)

      assert :ok =
               TextOverrides.validate(
                 %{
                   "street" => %{"text" => "Hemlig"},
                   "fact.price" => %{"text" => String.duplicate("x", 40)},
                   "viewings" => %{"hidden" => true},
                   "removed.key" => %{"text" => ""}
                 },
                 widget
               )
    end

    test "rejects malformed overrides", %{widget: widget} do
      too_many = for n <- 1..201, into: %{}, do: {"k#{n}", %{"hidden" => true}}

      cases = [
        {"nope", "must be an object"},
        {too_many, "more than 200 entries"},
        {%{"" => %{"hidden" => true}}, "not a valid key"},
        {%{String.duplicate("k", 201) => %{"hidden" => true}}, "longer than 200 characters"},
        {%{"street" => %{"text" => "Hemlig adress"}}, "longer than 10 characters"},
        {%{"fact.price" => %{"text" => String.duplicate("x", 41)}}, "longer than 40"},
        {%{"street" => %{"hidden" => false}}, ~s(must be {"text")},
        {%{"street" => %{"text" => 1}}, ~s(must be {"text")},
        {%{"street" => %{"text" => "a", "hidden" => true}}, ~s(must be {"text")},
        {%{"street" => "PÅ BEGÄRAN"}, ~s(must be {"text")}
      ]

      for {overrides, expected} <- cases do
        assert {:error, message} = TextOverrides.validate(overrides, widget)
        assert message =~ expected, "expected #{inspect(expected)}, got #{inspect(message)}"
      end
    end

    test "reserved?/1 needs editable texts and no declared overrides option" do
      assert TextOverrides.reserved?(%{template: @template, options_schema: %{}})
      assert TextOverrides.reserved?(%{template: @template, options_schema: nil})

      refute TextOverrides.reserved?(%{
               template: @template,
               options_schema: %{"overrides" => "string"}
             })

      refute TextOverrides.reserved?(%{template: %{"type" => "text"}, options_schema: %{}})
      refute TextOverrides.reserved?(nil)
    end
  end

  describe "WidgetConfig.changeset/2" do
    defp changeset(widget, options) do
      WidgetConfig.changeset(%WidgetConfig{}, %{
        widget_id: widget.id,
        playlist_item_id: 1,
        options: options
      })
    end

    test "validates overrides of widgets with editable texts" do
      widget = widget_fixture(%{template: @template})

      assert changeset(widget, %{"overrides" => %{"street" => %{"text" => "Ok"}}}).valid?
      assert changeset(widget, %{}).valid?

      invalid = changeset(widget, %{"overrides" => %{"street" => %{"text" => "Far too long"}}})
      refute invalid.valid?

      assert {"overrides: \"street\" text is longer than 10 characters", _} =
               invalid.errors[:options]
    end

    test "leaves overrides alone for other widgets" do
      plain = widget_fixture(%{template: %{"type" => "text"}})
      assert changeset(plain, %{"overrides" => "anything"}).valid?

      declared =
        widget_fixture(%{template: @template, options_schema: %{"overrides" => "string"}})

      assert changeset(declared, %{"overrides" => "custom"}).valid?
    end
  end
end

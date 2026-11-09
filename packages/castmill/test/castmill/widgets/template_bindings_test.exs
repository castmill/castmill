defmodule Castmill.Widgets.TemplateBindingsTest do
  use ExUnit.Case, async: true

  alias Castmill.Widgets.TemplateBindings

  @fixtures Path.expand("../../../../player/tests/fixtures/fmt-grammar.json", __DIR__)

  describe "fmt grammar (shared fixtures with the player)" do
    test "accepts every valid fixture" do
      %{"valid" => valid} = @fixtures |> File.read!() |> Jason.decode!()

      for fmt <- valid do
        assert TemplateBindings.parse(fmt) == :ok, "expected #{inspect(fmt)} to be valid"
      end
    end

    test "rejects every invalid fixture" do
      %{"invalid" => invalid} = @fixtures |> File.read!() |> Jason.decode!()

      for fmt <- invalid do
        assert {:error, _message} = TemplateBindings.parse(fmt),
               "expected #{inspect(fmt)} to be invalid"
      end
    end

    test "explains the problem" do
      assert TemplateBindings.parse("{data.x | money}") == {:error, ~s(unknown formatter "money")}

      assert TemplateBindings.parse("{data.x | date}") ==
               {:error, ~s(formatter "date" takes 1 to 2 argument(s\))}

      assert TemplateBindings.parse("{data.x | upper:1}") ==
               {:error, ~s(formatter "upper" takes 0 argument(s\))}

      assert TemplateBindings.parse("{data.x") == {:error, "unclosed placeholder at position 0"}
      assert TemplateBindings.parse("a}") == {:error, ~s(unexpected "}" at position 1)}
    end
  end

  describe "check/1" do
    test "finds errors in nested fmt, list and first bindings with their path" do
      template = %{
        "type" => "group",
        "name" => "root",
        "components" => [
          %{
            "type" => "text",
            "name" => "price",
            "opts" => %{"text" => %{"fmt" => "{data.price | money}"}}
          },
          %{
            "type" => "text",
            "name" => "viewings",
            "opts" => %{
              "text" => %{
                "list" => %{
                  "key" => "data.viewings",
                  "where" => [%{"key" => "$.end", "gte" => "@now", "lt" => 3}],
                  "item" => %{"first" => [%{"fmt" => "{$.start | date}"}]},
                  "limit" => -1,
                  "skip" => "two",
                  "colour" => "red"
                }
              }
            }
          }
        ]
      }

      {errors, []} = TemplateBindings.check(template)
      messages = Enum.map(errors, &TemplateBindings.describe/1)

      assert "root.components > [0] > price.opts > text: invalid fmt \"{data.price | money}\": unknown formatter \"money\"" in messages

      assert Enum.any?(messages, &(&1 =~ "unknown list keys colour"))
      assert Enum.any?(messages, &(&1 =~ "takes exactly one of"))
      assert Enum.any?(messages, &(&1 =~ "first[0]: invalid fmt"))
      assert Enum.any?(messages, &(&1 =~ "limit must be a non-negative integer"))
      assert Enum.any?(messages, &(&1 =~ "skip must be a non-negative integer"))
    end

    test "validates list sources and conditions" do
      check = fn list -> TemplateBindings.check(%{"list" => list}) |> elem(0) end

      assert check.(%{"key" => "data.items"}) == []
      assert check.(%{"items" => [%{"label" => "A", "value" => %{"fmt" => "{data.a}"}}]}) == []
      assert [{_, "list needs either a key (string) or items (list)"}] = check.(%{})

      assert [{_, "list needs either a key (string) or items (list)"}] =
               check.(%{"key" => "a", "items" => []})

      assert [{_, "where must be a list of conditions"}] = check.(%{"key" => "a", "where" => %{}})

      assert [{_, "a condition must be an object"}] = check.(%{"key" => "a", "where" => ["x"]})

      assert [{_, "a condition needs a key"}] = check.(%{"key" => "a", "where" => [%{"eq" => 1}]})

      assert [{_, "a condition needs one of" <> _}] =
               check.(%{"key" => "a", "where" => [%{"key" => "$.x"}]})

      assert [{_, "present must be a boolean"}] =
               check.(%{"key" => "a", "where" => [%{"key" => "$.x", "present" => "yes"}]})

      assert [{_, "a condition takes exactly one of" <> _}] =
               check.(%{"key" => "a", "where" => [%{"key" => "$.x", "between" => 1}]})

      assert [
               {_, "sort must be a key path"},
               {_, "desc must be a boolean"},
               {_, "join must be a string"}
             ] =
               check.(%{"key" => "a", "sort" => 1, "desc" => "yes", "join" => 0})
    end

    test "rejects malformed fmt and first values" do
      assert {[{_, "fmt must be a string"}], []} = TemplateBindings.check(%{"fmt" => 1})

      assert {[{_, "first must be a non-empty list"}], []} =
               TemplateBindings.check(%{"first" => []})
    end

    test "validates first bindings with additional keys" do
      {errors, []} =
        TemplateBindings.check(%{
          "first" => [],
          "other" => %{"fmt" => "{data.price | money}"}
        })

      messages = Enum.map(errors, &TemplateBindings.describe/1)
      assert "first must be a non-empty list" in messages
      assert Enum.any?(messages, &(&1 =~ ~s(unknown formatter "money")))
    end

    test "validates fmt bindings with additional keys" do
      assert {[{_, message}], []} =
               TemplateBindings.check(%{"fmt" => "{data.price | money}", "default" => "—"})

      assert message =~ ~s(unknown formatter "money")
    end

    test "rejects list wrappers whose values are not objects" do
      for malformed <- [[], "data.viewings", nil] do
        assert {[{_, "list must be an object"}], []} =
                 TemplateBindings.check(%{"list" => malformed})
      end
    end

    test "warns about plain strings that look like a format text" do
      template = %{
        "type" => "text",
        "name" => "price",
        "opts" => %{"text" => "{data.price | number} kr"},
        "style" => %{"background" => "url(data:image/svg+xml,<style>.a{fill:red}</style>)"}
      }

      assert {[], [warning]} = TemplateBindings.check(template)
      assert TemplateBindings.describe(warning) =~ "looks like a format text"
    end

    test "existing templates without formatting bindings are valid" do
      template = %{
        "type" => "group",
        "components" => [
          %{"type" => "text", "opts" => %{"text" => %{"key" => "data.title"}}},
          %{"type" => "list", "opts" => %{"items" => %{"key" => "data.items"}}},
          %{"type" => "text", "opts" => %{"text" => "Visningar {not a placeholder}"}}
        ]
      }

      assert TemplateBindings.check(template) == {[], []}
      assert TemplateBindings.validate(template) == :ok
    end
  end

  describe "widget changeset" do
    test "rejects templates with invalid bindings" do
      changeset =
        Castmill.Widgets.Widget.changeset(%Castmill.Widgets.Widget{}, %{
          name: "Bad",
          template: %{"type" => "text", "opts" => %{"text" => %{"fmt" => "{data.x | nope}"}}}
        })

      refute changeset.valid?
      assert [{:template, {message, []}}] = changeset.errors
      assert message =~ ~s(unknown formatter "nope")
    end
  end
end

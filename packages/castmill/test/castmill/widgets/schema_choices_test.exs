defmodule Castmill.Widgets.SchemaChoicesTest do
  use Castmill.DataCase, async: true

  alias Castmill.Widgets.{Schema, Widget}

  @provider "Castmill.Widgets.Integrations.Fetchers.TestChoices"

  defp listing(choices \\ %{}),
    do: %{"type" => "string", "choices" => Map.merge(%{"list" => "listings"}, choices)}

  defp photos(choices \\ %{}) do
    %{
      "type" => "list",
      "items" => %{"type" => "string"},
      "choices" => Map.merge(%{"list" => "images", "multiple" => true}, choices)
    }
  end

  defp validate(schema), do: Schema.validate_schema(schema, choices: true)

  defp error(schema) do
    assert {:error, message} = validate(schema)
    message
  end

  describe "validate_schema/2 with choices" do
    test "accepts string and list-of-string fields" do
      assert {:ok, nil} =
               validate(%{
                 "listing" => listing(%{"display" => "cards", "search" => true}),
                 "photos" =>
                   photos(%{
                     "display" => "grid",
                     "ordered" => true,
                     "min" => 0,
                     "max" => 30,
                     "depends_on" => ["listing"]
                   }),
                 "gallery" => photos(),
                 "tags" => %{
                   "type" => "list",
                   "items" => "string",
                   "choices" => %{"list" => "tags", "multiple" => true, "display" => "list"}
                 }
               })
    end

    test "is only allowed when enabled and on top-level fields" do
      assert Schema.validate_schema(%{"listing" => listing()}) ==
               {:error,
                "Field \"listing\": 'choices' is only supported on top-level options_schema fields"}

      assert {:error, _} =
               validate(%{
                 "group" => %{"type" => "map", "schema" => %{"listing" => listing()}}
               })
    end

    test "rejects invalid choices attributes" do
      cases = [
        {%{"count" => %{"type" => "number", "choices" => %{"list" => "x"}}},
         "requires a string or list of strings"},
        {%{"ids" => %{"type" => "list", "items" => "number", "choices" => %{"list" => "x"}}},
         "requires a string or list of strings"},
        {%{"listing" => %{"type" => "string", "choices" => "listings"}}, "must be a map"},
        {%{"listing" => listing(%{"extra" => 1})}, "unexpected key \"extra\""},
        {%{"listing" => listing(%{"list" => ""})}, "choices.list must be a non-empty string"},
        {%{"listing" => listing(%{"display" => "table"})}, "choices.display must be one of"},
        {%{"listing" => listing(%{"search" => "yes"})}, "choices.search must be a boolean"},
        {%{"listing" => listing(%{"multiple" => true})}, "only allowed on list fields"},
        {%{"photos" => photos(%{"multiple" => false})}, "require choices.multiple"},
        {%{"listing" => listing(%{"ordered" => true})}, "choices.ordered requires"},
        {%{"photos" => photos(%{"max" => -1})}, "choices.max must be a non-negative integer"},
        {%{"listing" => listing(%{"min" => 1})}, "choices.min and choices.max require"},
        {%{"photos" => photos(%{"min" => 3, "max" => 2})}, "must not exceed"},
        {%{"photos" => photos(%{"depends_on" => "listing"})}, "must be a list of field keys"},
        {%{"photos" => photos(%{"depends_on" => ["missing"]})}, "invalid field \"missing\""},
        {%{"photos" => photos(%{"depends_on" => ["photos"]})}, "invalid field \"photos\""}
      ]

      for {schema, expected} <- cases do
        assert error(schema) =~ expected, "expected #{inspect(expected)} for #{inspect(schema)}"
      end
    end

    test "rejects dependency cycles" do
      assert error(%{
               "a" => listing(%{"depends_on" => ["b"]}),
               "b" => listing(%{"depends_on" => ["c"]}),
               "c" => listing(%{"depends_on" => ["a"]})
             }) =~ "forms a cycle"
    end

    test "still validates the rest of the field" do
      assert error(%{"listing" => Map.put(listing(), "default", 1)}) =~ "Default value"
    end
  end

  test "field_choices/2 and has_choices?/1" do
    schema = %{"listing" => listing(), "title" => "string"}

    assert Schema.field_choices(schema, "listing") == %{"list" => "listings"}
    assert Schema.field_choices(schema, "title") == nil
    assert Schema.field_choices(nil, "listing") == nil
    assert Schema.has_choices?(schema)
    refute Schema.has_choices?(%{"title" => "string"})
    refute Schema.has_choices?(nil)
  end

  describe "Widget.changeset/2" do
    defp changeset(attrs) do
      Widget.changeset(
        %Widget{},
        Map.merge(%{name: "Choices #{System.unique_integer()}", template: %{}}, attrs)
      )
    end

    test "accepts choices when the integration fetcher provides them" do
      assert changeset(%{
               options_schema: %{"listing" => listing()},
               meta: %{"integration" => %{"fetcher" => @provider}}
             }).valid?
    end

    test "rejects choices without a provider" do
      for meta <- [
            nil,
            %{},
            %{"integration" => %{"fetcher" => "Castmill.Widgets.Integrations.Fetchers.TestStub"}}
          ] do
        changeset = changeset(%{options_schema: %{"listing" => listing()}, meta: meta})

        refute changeset.valid?
        assert {"uses choices" <> _, _} = changeset.errors[:options_schema]
      end
    end

    test "rejects choices in data_schema" do
      changeset =
        changeset(%{
          data_schema: %{"listing" => listing()},
          meta: %{"integration" => %{"fetcher" => @provider}}
        })

      refute changeset.valid?
      assert changeset.errors[:data_schema]
    end
  end
end

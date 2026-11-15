defmodule Castmill.Widgets.SchemaVisibleWhenTest do
  use Castmill.DataCase, async: true

  alias Castmill.Widgets.{Schema, Widget}

  @schema %{
    "mode" => %{"type" => "string", "enum" => ["listing", "listings"], "default" => "listing"},
    "show_logo" => "boolean",
    "columns" => %{"type" => "number", "default" => 1},
    "estate_id" => %{
      "type" => "string",
      "required" => true,
      "visible_when" => %{"mode" => ["listing"]},
      "choices" => %{"list" => "listings"}
    },
    "max_listings" => %{
      "type" => "number",
      "required" => true,
      "min" => 1,
      "visible_when" => %{"mode" => ["listings"], "columns" => [1, 2]}
    },
    "logo" => %{"type" => "url", "visible_when" => %{"show_logo" => [true]}}
  }

  defp validate(schema), do: Schema.validate_schema(schema, choices: true, visible_when: true)

  defp error(schema) do
    assert {:error, message} = validate(schema)
    message
  end

  defp with_condition(conditions),
    do: Map.put(@schema, "logo", %{"type" => "url", "visible_when" => conditions})

  describe "validate_schema/2 with visible_when" do
    test "accepts conditions on plain fields, also with choices" do
      assert {:ok, nil} = validate(@schema)
    end

    test "is only allowed when enabled and on top-level fields" do
      assert Schema.validate_schema(@schema, choices: true) ==
               {:error,
                "Field \"estate_id\": 'visible_when' is only supported on top-level options_schema fields"}

      assert {:error, message} =
               validate(%{
                 "mode" => "string",
                 "group" => %{
                   "type" => "map",
                   "schema" => %{
                     "mode" => "string",
                     "name" => %{"type" => "string", "visible_when" => %{"mode" => ["a"]}}
                   }
                 }
               })

      assert message =~ "visible_when"
    end

    test "rejects invalid conditions" do
      cases = [
        {nil, "non-empty map"},
        {%{}, "non-empty map"},
        {["mode"], "non-empty map"},
        {%{"logo" => ["a"]}, "cannot reference the field itself"},
        {%{"missing" => ["a"]}, "invalid field \"missing\""},
        {%{"estate_id" => ["a"]}, "must not be conditional itself"},
        {%{"mode" => "listing"}, "non-empty list"},
        {%{"mode" => []}, "non-empty list"},
        {%{"mode" => [%{"a" => 1}]}, "non-empty list"}
      ]

      for {conditions, expected} <- cases do
        assert error(with_condition(conditions)) =~ expected
      end

      assert error(
               Map.merge(@schema, %{
                 "tags" => %{"type" => "list", "items" => "string"},
                 "logo" => %{"type" => "url", "visible_when" => %{"tags" => ["a"]}}
               })
             ) =~ "must be a string, number or boolean"
    end

    test "still validates the rest of the field" do
      note = %{"type" => "string", "default" => 1, "visible_when" => %{"mode" => ["listing"]}}
      assert error(Map.put(@schema, "note", note)) =~ "Default value"
    end
  end

  describe "visible?/3" do
    test "compares the referenced values, falling back to their defaults" do
      field = @schema["estate_id"]

      assert Schema.visible?(@schema, field, %{})
      assert Schema.visible?(@schema, field, nil)
      assert Schema.visible?(@schema, field, %{"mode" => "listing"})
      refute Schema.visible?(@schema, field, %{"mode" => "listings"})

      assert Schema.visible?(@schema, @schema["max_listings"], %{"mode" => "listings"})

      refute Schema.visible?(@schema, @schema["max_listings"], %{
               "mode" => "listings",
               "columns" => 3
             })

      refute Schema.visible?(@schema, @schema["logo"], %{})
      assert Schema.visible?(@schema, @schema["logo"], %{"show_logo" => true})
      assert Schema.visible?(@schema, @schema["mode"], %{})
      assert Schema.visible?(@schema, "string", %{})
    end

    test "compares numbers by value and other values strictly" do
      field = %{"type" => "number", "visible_when" => %{"columns" => [1.0]}}

      assert Schema.visible?(@schema, field, %{"columns" => 1})
      assert Schema.visible?(@schema, field, %{"columns" => 1.0})
      refute Schema.visible?(@schema, field, %{"columns" => 2})
      refute Schema.visible?(@schema, field, %{"columns" => "1"})
    end
  end

  describe "validate_data/2" do
    test "requires only visible fields" do
      assert {:error, "Field estate_id is required but missing"} =
               Schema.validate_data(@schema, %{})

      assert {:ok, data} =
               Schema.validate_data(@schema, %{"mode" => "listings", "max_listings" => 5})

      refute Map.has_key?(data, "estate_id")

      assert {:error, "Field max_listings is required but missing"} =
               Schema.validate_data(@schema, %{"mode" => "listings"})

      assert {:ok, _} = Schema.validate_data(@schema, %{"estate_id" => "1"})
    end

    test "still validates the values of hidden fields" do
      assert {:error, message} =
               Schema.validate_data(@schema, %{"estate_id" => "1", "max_listings" => 0})

      assert message =~ "less than the minimum"
    end
  end

  describe "Widget.changeset/2" do
    defp changeset(attrs) do
      Widget.changeset(
        %Widget{},
        Map.merge(%{name: "Visible when #{System.unique_integer()}", template: %{}}, attrs)
      )
    end

    test "accepts visible_when in options_schema only" do
      schema = Map.delete(@schema, "estate_id")

      assert changeset(%{options_schema: schema}).valid?

      changeset = changeset(%{data_schema: schema})
      refute changeset.valid?
      assert changeset.errors[:data_schema]
    end
  end
end

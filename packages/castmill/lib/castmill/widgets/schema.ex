defmodule Castmill.Widgets.Schema do
  @doc """
    This function validates the schema according to the provided specifications.

    ## Grammar

  <schema> ::= "{" <field-list> "}"
  <field-list> ::= <field>
             | <field> "," <field-list>

  <field> ::= <simple-field>
        | <complex-field>
        | <ref-field>
        | <map-field>
        | <list-field>

  <field> ::= '"' <field-name> '"' ":" <field-value>
  <field-name> ::= <string>

  <field-value> ::= <simple-type>
              | "{" <field-attributes> "}"
              | "{" <ref-field-attributes> "," "collection" ":" <field-name> "}"
              | "{" <map-field-attributes> "," "schema" ":" <schema> "}"
              | "{" <list-field-attributes> "," "items" ":" <field-value> "}"

  <field-attributes> ::= <field-type>
                 | <field-type> "," <field-required>
                 | <field-type> "," <field-required> "," <field-default>

  <field-min> ::= "min" ":" <number>
  <field-max> ::= "max" ":" <number>

  <map-field-attributes> ::= "type" ":" '"' "map" '"'
  <list-field-attributes> ::= "type" ":" '"' "list" '"'
  <ref-field-attributes> ::= "type" ":" '"' "ref" '"'
  <field-type> ::= "type" ":" <field-value-type>
  <field-required> ::= "required" ":" <boolean>
  <field-default> ::= "default" ":" <default-value>

  <field-value-type> ::= '"' <simple-type> '"'
                    |  '"' <complex-type> '"'
  <simple-type> ::= "string"
             | "number"
             | "boolean"
  <complex-type> ::= "ref"
              | "map"
              | "list"

  <default-value> ::= <string>
                | <number>
                | <boolean>

  <string> ::= "a sequence of characters"
  <number> ::= "an integer or a float"
  <boolean> ::= true | false
  """

  def is_url(value) when is_binary(value) do
    Regex.match?(~r/^https?:\/\/[^\s$.?#].[^\s]*$/, value)
  end

  # Color validation using a regular expression
  # Accepts hex colors (#RGB, #RRGGBB) and rgba/rgb functional notation
  def is_color(value) when is_binary(value) do
    hex_regex = ~r/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    rgba_regex = ~r/^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/

    Regex.match?(hex_regex, value) or Regex.match?(rgba_regex, value)
  end

  # Define a map of validations for simple types
  @type_validations %{
    "string" => &is_binary/1,
    "number" => &is_number/1,
    "boolean" => &is_boolean/1,
    "url" => &Castmill.Widgets.Schema.is_url/1,
    "color" => &Castmill.Widgets.Schema.is_color/1,
    # Simplistic assumption that cities are just strings
    "city" => &is_binary/1,
    # Layout type for dynamic multi-zone layouts (value is a map with aspectRatio and zones)
    "layout" => &is_map/1,
    # Layout reference type - references an existing layout by ID (value is a number/integer)
    "layout-ref" => &is_number/1,
    # Location type for geographic coordinates (value is a map with lat, lng, and optional address fields)
    "location" => &is_map/1
  }
  def validate_schema(schema) when map_size(schema) > 0 do
    schema
    |> Enum.reduce_while({:ok, nil}, fn
      {field, value}, _acc when is_map(value) ->
        validate_field(value, field)

      {_field, value}, _acc ->
        case @type_validations[value] do
          nil -> {:halt, {:error, "Field's type '#{value}' is not a recognized type"}}
          _ -> {:cont, {:ok, nil}}
        end
    end)
  end

  def validate_schema(_schema), do: {:error, "Schema is not a non-empty map"}

  defp validate_field(%{"type" => type} = map, field) do
    validator = @type_validations[type]

    if is_nil(validator) do
      case type do
        "ref" ->
          validate_complex_field(map, field, &is_binary/1, "binary", ["collection"])

        "map" ->
          is_valid_default_for_schema = fn v -> valid_data?(map["schema"], v) end

          validate_complex_field(
            map,
            field,
            is_valid_default_for_schema,
            "map",
            ["schema"]
          )

        "list" ->
          # For list types, the items schema is under "items", not "schema"
          # We just validate that the default is a list - detailed item validation
          # happens during actual data validation
          validate_complex_field(map, field, &is_list/1, "list", ["items"])

        _ ->
          {:halt, {:error, "Invalid type #{inspect(type)} for field #{inspect(field)}"}}
      end
    else
      validate_complex_field(map, field, validator, type)
    end
  end

  defp validate_complex_field(map, field, validator, expected_type, required_keys \\ []) do
    optional_keys = [
      "type",
      "required",
      "default",
      "description",
      "help",
      "placeholder",
      "min",
      "max",
      "order",
      # Enum options for string fields
      "enum",
      # Layout-specific options
      "aspectRatios",
      # Location-specific options
      "defaultZoom" | required_keys
    ]

    keys = Map.keys(map)

    invalid_key = Enum.find(keys, fn key -> key not in optional_keys end)

    if invalid_key != nil do
      {:halt, {:error, "Unexpected key #{inspect(invalid_key)} in field #{inspect(field)}"}}
    else
      missing_key = Enum.find(required_keys, &(not Map.has_key?(map, &1)))

      if missing_key != nil do
        {:halt, {:error, "Missing key #{inspect(missing_key)} in field #{inspect(field)}"}}
      else
        cond do
          Map.has_key?(map, "required") and not is_boolean(map["required"]) ->
            {:halt, {:error, "Field 'required' should be a boolean in field #{inspect(field)}"}}

          Map.has_key?(map, "default") and not validator.(map["default"]) ->
            {:halt,
             {:error,
              "Default value doesn't match the expected type #{expected_type} in field #{inspect(field)}"}}

          Map.has_key?(map, "schema") ->
            case validate_schema(map["schema"]) do
              {:ok, nil} -> {:cont, {:ok, nil}}
              {:error, message} -> {:halt, {:error, message}}
              other -> other
            end

          Map.has_key?(map, "items") and is_binary(map["items"]) ->
            case map["items"] do
              type when type in ["string", "number", "boolean"] -> {:cont, {:ok, nil}}
              _ -> {:halt, {:error, "Invalid type for items in field #{inspect(field)}"}}
            end

          Map.has_key?(map, "items") and is_map(map["items"]) ->
            case validate_field(map["items"], field) do
              {:ok, nil} -> {:cont, {:ok, nil}}
              {:error, message} -> {:halt, {:error, message}}
              other -> other
            end

          true ->
            {:cont, {:ok, nil}}
        end
      end
    end
  end

  defp valid_data?(schema, data) do
    case validate_data(schema, data) do
      {:ok, nil} -> true
      _ -> false
    end
  end

  @doc """
    Validate a widget data using a schema.

    Using a valid schema (there is no need for validate the schema as we assume it follows the grammar below),
    this method validates that the options conform with the passed schema. It adds any default values,
    gives errors is required values are missing, and it also cleans any properties that are not part
    of the schema.

    returns {:ok, nil} or {:error, message}

    ## Examples

    %{
      field_a: "string",
      field_b: "number",
      field_c: %{ type: "string", required: true },
      field_d: %{ type: "number", required: true },
      field_e: %{ type: "map", schema: %{
        field_a: "string",
        field_b: "number",
      }},
      field_f: %{ type: "list", schema: "string" },
      field_g: %{ type: "number", default: 123 },
      field_h: %{ type: "ref", collection: "medias" },
    }

    %{
      field_a: "string",
      field_b: "number",
      field_c: "string",
      field_d: 123,
      field_e: %{
        field_a: "string",
        field_b: "number",
      },
      field_f: ["string"],
      field_g: 123,
      field_h: "medias-uuid",
    }

    returns {:ok, %{
      field_a: "string",
      field_b: 123,
      field_c: "string",
      field_d: 123,
      field_e: %{
        field_a: "string",
        field_b: 123,
      },
      field_f: ["string"],
      field_g: 123,
      field_h: "medias",
    }}
  """
  def validate_data(schema, data) do
    schema
    |> Enum.reduce_while({:ok, %{}}, fn {field, field_schema}, {:ok, acc_data} ->
      case data[field] do
        nil ->
          handle_missing_data_field(field_schema, field, acc_data)

        value ->
          validate_data_field(
            value,
            field_schema,
            field,
            acc_data
          )
      end
    end)
  end

  defp handle_missing_data_field("string", _field, acc_data), do: {:cont, {:ok, acc_data}}
  defp handle_missing_data_field("number", _field, acc_data), do: {:cont, {:ok, acc_data}}

  defp handle_missing_data_field(%{"required" => true}, field, _acc_data),
    do: {:halt, {:error, "Field #{field} is required but missing"}}

  defp handle_missing_data_field(%{"default" => default}, field, acc_data),
    do: {:cont, {:ok, Map.put(acc_data, field, default)}}

  defp handle_missing_data_field(_field_schema, _field, acc_data), do: {:cont, {:ok, acc_data}}

  defp validate_data_field(value, "string", field, acc_data) when is_binary(value),
    do: {:cont, {:ok, Map.put(acc_data, field, value)}}

  defp validate_data_field(value, "number", field, acc_data) when is_number(value),
    do: {:cont, {:ok, Map.put(acc_data, field, value)}}

  defp validate_data_field(value, %{"type" => "number"} = map, field, acc_data)
       when is_number(value) do
    if Map.has_key?(map, "min") and value < map["min"] do
      {:halt,
       {:error, "Value #{value} is less than the minimum value in field #{inspect(field)}"}}
    else
      if Map.has_key?(map, "max") and value > map["max"] do
        {:halt,
         {:error, "Value #{value} is greater than the maximum value in field #{inspect(field)}"}}
      else
        {:cont, {:ok, Map.put(acc_data, field, value)}}
      end
    end
  end

  defp validate_data_field(value, "boolean", field, acc_data) when is_boolean(value),
    do: {:cont, {:ok, Map.put(acc_data, field, value)}}

  defp validate_data_field(value, "color", field, acc_data) when is_binary(value) do
    if is_color(value) do
      {:cont, {:ok, Map.put(acc_data, field, value)}}
    else
      {:halt, {:error, "Value is not a valid color (expected hex format like #RRGGBB)"}}
    end
  end

  defp validate_data_field(value, "url", field, acc_data) when is_binary(value) do
    if is_url(value) do
      {:cont, {:ok, Map.put(acc_data, field, value)}}
    else
      {:halt, {:error, "Value is not a valid URL"}}
    end
  end

  defp validate_data_field(value, "city", field, acc_data) when is_binary(value),
    do: {:cont, {:ok, Map.put(acc_data, field, value)}}

  defp validate_data_field(value, %{"type" => "map", "schema" => sub_schema}, field, acc_data)
       when is_map(value) do
    case validate_data(sub_schema, value) do
      {:ok, new_data} -> {:cont, {:ok, Map.put(acc_data, field, new_data)}}
      {:error, _} = error -> {:halt, error}
    end
  end

  defp validate_data_field(value, %{"type" => "list", "items" => sub_schema}, field, acc_data)
       when is_list(value) do
    value
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, acc} ->
      case validate_data_field(item, sub_schema, "", %{}) do
        {:cont, {:ok, validated_item}} ->
          case Map.values(validated_item) do
            [valid_value] -> {:cont, {:ok, [valid_value | acc]}}
            _ -> {:halt, {:error, "Invalid list item"}}
          end

        error ->
          error
      end
    end)
    |> case do
      {:ok, validated_list} ->
        {:cont, {:ok, Map.put(acc_data, field, Enum.reverse(validated_list))}}

      error ->
        {:halt, error}
    end
  end

  defp validate_data_field(
         _value,
         %{"type" => "list", "schema" => _sub_schema},
         _field,
         _acc_data
       ) do
    {:halt, {:error, "Value is not a list"}}
  end

  defp validate_data_field(
         value,
         %{"type" => "ref", "collection" => _collection},
         field,
         acc_data
       ) do
    # We'll simply check if the value is a string or a number for simplicity. We might want to validate that this value
    # refers to an actual existing resource in the specified collection.
    if is_binary(value) or is_number(value) do
      {:cont, {:ok, Map.put(acc_data, field, value)}}
    else
      {:halt, {:error, "Invalid ref value #{inspect(value)} for #{field}"}}
    end
  end

  defp validate_data_field(value, %{"type" => type}, field, acc_data)
       when type in ["string", "number", "boolean", "color", "url", "city"] do
    validate_data_field(value, type, field, acc_data)
  end

  # Layout type validation for dynamic multi-zone layouts
  # Layout value should be a map with:
  # - aspectRatio: string like "16:9"
  # - zones: list of zone objects, each with id, name, rect, zIndex
  defp validate_data_field(value, %{"type" => "layout"}, field, acc_data)
       when is_map(value) do
    cond do
      not is_binary(value["aspectRatio"]) ->
        {:halt, {:error, "Layout field #{inspect(field)} must have an aspectRatio string"}}

      not is_list(value["zones"]) ->
        {:halt, {:error, "Layout field #{inspect(field)} must have a zones list"}}

      true ->
        # Validate each zone in the zones list
        zones_valid =
          Enum.all?(value["zones"], fn zone ->
            is_map(zone) and
              is_binary(zone["id"]) and
              is_binary(zone["name"]) and
              is_map(zone["rect"]) and
              is_number(zone["rect"]["x"]) and
              is_number(zone["rect"]["y"]) and
              is_number(zone["rect"]["width"]) and
              is_number(zone["rect"]["height"]) and
              is_number(zone["zIndex"])
          end)

        if zones_valid do
          {:cont, {:ok, Map.put(acc_data, field, value)}}
        else
          {:halt,
           {:error,
            "Invalid zone structure in layout field #{inspect(field)}. Each zone must have id (string), name (string), rect (map with x, y, width, height as numbers), and zIndex (number)"}}
        end
    end
  end

  defp validate_data_field(_value, %{"type" => "layout"}, field, _acc_data) do
    {:halt, {:error, "Layout field #{inspect(field)} must be a map with aspectRatio and zones"}}
  end

  # Layout-ref value should be a map with:
  # - layoutId: integer referencing a layout
  # - aspectRatio: string like "16:9"
  # - zones: optional map containing zone definitions
  # - zonePlaylistMap: map of zone IDs to playlist assignments
  defp validate_data_field(value, %{"type" => "layout-ref"}, field, acc_data)
       when is_map(value) do
    cond do
      not is_integer(value["layoutId"]) ->
        {:halt, {:error, "Layout-ref field #{inspect(field)} must have a layoutId integer"}}

      not is_binary(value["aspectRatio"]) ->
        {:halt, {:error, "Layout-ref field #{inspect(field)} must have an aspectRatio string"}}

      not is_map(value["zonePlaylistMap"]) ->
        {:halt, {:error, "Layout-ref field #{inspect(field)} must have a zonePlaylistMap"}}

      true ->
        # zonePlaylistMap validation: each entry should have playlistId
        zones_valid =
          Enum.all?(value["zonePlaylistMap"], fn {_zone_id, assignment} ->
            is_map(assignment) and is_integer(assignment["playlistId"])
          end)

        if zones_valid do
          {:cont, {:ok, Map.put(acc_data, field, value)}}
        else
          {:halt,
           {:error,
            "Invalid zone assignment in layout-ref field #{inspect(field)}. Each zone assignment must have playlistId (integer)"}}
        end
    end
  end

  defp validate_data_field(_value, %{"type" => "layout-ref"}, field, _acc_data) do
    {:halt,
     {:error,
      "Layout-ref field #{inspect(field)} must be a map with layoutId, aspectRatio, and zonePlaylistMap"}}
  end

  # Location value should be a map with:
  # - lat: number (latitude)
  # - lng: number (longitude)
  # - address: optional string
  # - city: optional string
  # - country: optional string
  # - postalCode: optional string
  defp validate_data_field(value, %{"type" => "location"}, field, acc_data)
       when is_map(value) do
    cond do
      not is_number(value["lat"]) ->
        {:halt, {:error, "Location field #{inspect(field)} must have a lat number"}}

      not is_number(value["lng"]) ->
        {:halt, {:error, "Location field #{inspect(field)} must have a lng number"}}

      value["lat"] < -90 or value["lat"] > 90 ->
        {:halt, {:error, "Location field #{inspect(field)} lat must be between -90 and 90"}}

      value["lng"] < -180 or value["lng"] > 180 ->
        {:halt, {:error, "Location field #{inspect(field)} lng must be between -180 and 180"}}

      true ->
        {:cont, {:ok, Map.put(acc_data, field, value)}}
    end
  end

  defp validate_data_field(_value, %{"type" => "location"}, field, _acc_data) do
    {:halt, {:error, "Location field #{inspect(field)} must be a map with lat and lng numbers"}}
  end

  # We need to add two more catch-all clauses for cases when the data does not match the schema type
  defp validate_data_field(_value, "string", _field, _acc_data) do
    {:halt, {:error, "Value is not a string"}}
  end

  defp validate_data_field(_value, "number", _field, _acc_data) do
    {:halt, {:error, "Value is not a number"}}
  end
end

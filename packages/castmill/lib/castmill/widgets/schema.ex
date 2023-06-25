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

  <simple-field> ::= '"' <field-name> '"' ":" '"' <simple-type> '"'
  <complex-field> ::= '"' <field-name> '"' ":" "{" <field-attributes> "}"
  <ref-field> ::= '"' <field-name> '"' ":" "{" <field-attributes> "," "collection" ":" <field-name> "}"
  <map-field> ::= '"' <field-name> '"' ":" "{" <field-attributes> "," "schema" ":" <schema> "}"
  <list-field> ::= '"' <field-name> '"' ":" "{" <field-attributes> "," "schema" ":" <schema> "}"
  <field-name> ::= <string>
  <field-attributes> ::= <field-type>
                     | <field-type> "," <field-required>
                     | <field-type> "," <field-required> "," <field-default>
  <field-type> ::= "type" ":" <field-value-type>
  <field-required> ::= "required" ":" <boolean>
  <field-default> ::= "default" ":" <default-value>
  <field-value-type> ::= '"' <simple-type> '"'
                    |  '"' <complex-type> '"'
  <simple-type> ::= "string"
               | "number"
  <complex-type> ::= "ref"
                | "map"
                | "list"
  <boolean> ::= "true"
            | "false"
  <default-value> ::= <string>
                  | <number>
  <string> ::= "a sequence of characters"
  <number> ::= "an integer or a float"
  <boolean> ::= true | false
  """
  def validate_schema(schema) when map_size(schema) > 0 do
    schema
    |> Enum.reduce_while({:ok, nil}, fn
      {field, value}, _acc when is_map(value) ->
        validate_field(value, field)

      {_field, value}, _acc when is_binary(value) and (value == "string" or value == "number") ->
        {:cont, {:ok, nil}}

      {field, value}, _acc ->
        {:halt, {:error, "Field's '#{field}' type '#{value}' is not a recognized type"}}
    end)
  end

  def validate_schema(_schema), do: {:error, "Schema is not a non-empty map"}

  defp validate_field(%{"type" => type} = map, field) do
    is_valid_default_for_schema = fn v -> valid_data?(map["schema"], v) end

    case type do
      "string" ->
        validate_complex_field(map, field, &is_binary/1, "binary")

      "number" ->
        validate_complex_field(map, field, &is_number/1, "number")

      "ref" ->
        validate_complex_field(map, field, &is_binary/1, "binary", ["collection"])

      "map" ->
        validate_complex_field(
          map,
          field,
          is_valid_default_for_schema,
          "map",
          ["schema"]
        )

      "list" ->
        validate_complex_field(map, field, is_valid_default_for_schema, "list", ["schema"])

      _ ->
        {:halt, {:error, "Invalid type #{inspect(type)} for field #{inspect(field)}"}}
    end
  end

  defp validate_complex_field(map, field, validator, expected_type, required_keys \\ []) do
    optional_keys = ["type", "required", "default" | required_keys]
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

  defp validate_data_field(value, %{"type" => "map", "schema" => sub_schema}, field, acc_data)
       when is_map(value) do
    case validate_data(sub_schema, value) do
      {:ok, new_data} -> {:cont, {:ok, Map.put(acc_data, field, new_data)}}
      {:error, _} = error -> {:halt, error}
    end
  end

  defp validate_data_field(value, %{"type" => "list", "schema" => sub_schema}, field, acc_data)
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
    # We'll simply check if the value is a string for simplicity. In a real system, you might want to validate that this value
    # refers to an actual existing resource in the specified collection.
    if is_binary(value) do
      {:cont, {:ok, Map.put(acc_data, field, value)}}
    else
      {:halt, {:error, "Invalid ref value for #{field}"}}
    end
  end

  defp validate_data_field(value, %{"type" => type}, field, acc_data)
       when type == "string" or type == "number" do
    validate_data_field(value, type, field, acc_data)
  end

  # We need to add two more catch-all clauses for cases when the data does not match the schema type
  defp validate_data_field(_value, "string", _field, _acc_data) do
    {:halt, {:error, "Value is not a string"}}
  end

  defp validate_data_field(_value, "number", _field, _acc_data) do
    {:halt, {:error, "Value is not a number"}}
  end
end

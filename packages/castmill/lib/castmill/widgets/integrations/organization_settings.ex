defmodule Castmill.Widgets.Integrations.OrganizationSettings do
  @moduledoc """
  Organization-level integration settings: non-secret values that a network
  admin (or a migration) sets per organization, and that organization users
  cannot change. A typical use is identity that many widgets share, such as the
  agency and office IDs of a real estate office, used by every property listing
  widget to list only that office's listings.

  An integration opts in by declaring the settings in its `pull_config`:

      "organization_settings": {
        "key": "property-listing",
        "name": "Property listings",
        "description": "The agency and offices whose listings the organization shows.",
        "schema": {
          "agency": {"type": "string", "label": "Agency", "required": true},
          "office_ids": {"type": "list", "label": "Office IDs"}
        }
      }

  Integrations declaring the same `key` share the values. Fetchers and choice
  providers receive them as `credentials["organization_settings"]` (see
  `Castmill.Widgets.Integrations.get_fetch_credentials/2`), so playlist items can
  never override them. See agents/systems/WIDGET-INTEGRATIONS.md.
  """

  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.{OrganizationSetting, WidgetIntegration}

  @key_format ~r/^[a-z0-9][a-z0-9_-]{0,63}$/
  @field_format ~r/^[A-Za-z][A-Za-z0-9_]{0,63}$/
  @types ~w(string number boolean list)
  @max_fields 20
  @max_string 1_000
  @max_list 100

  @doc "The settings key an integration declares, or nil."
  def key_of(%WidgetIntegration{pull_config: pull_config}) do
    case definition_of(pull_config) do
      %{"key" => key} -> key
      nil -> nil
    end
  end

  @doc """
  The settings definitions available in a network: those declared by
  integrations of system widgets and of the network's widgets. When several
  integrations declare a key, the most recently updated declaration wins.
  """
  def definitions(network_id) do
    from(i in WidgetIntegration,
      join: w in Widget,
      on: w.id == i.widget_id,
      where: w.is_system == true or w.network_id == ^network_id,
      where: fragment("(? -> 'organization_settings') IS NOT NULL", i.pull_config),
      order_by: [desc: i.updated_at],
      select: i.pull_config
    )
    |> Repo.all()
    |> Enum.map(&definition_of/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq_by(& &1["key"])
    |> Enum.sort_by(&String.downcase(&1["name"] || &1["key"]))
  end

  @doc "A network's definitions with the organization's current values."
  def list_for_organization(network_id, organization_id) do
    values = values(organization_id)

    Enum.map(definitions(network_id), fn definition ->
      Map.put(definition, "settings", Map.get(values, definition["key"], %{}))
    end)
  end

  @doc "The organization's settings for `key`, or nil."
  def get(organization_id, key) when is_binary(key) do
    Repo.one(
      from(s in OrganizationSetting,
        where: s.organization_id == ^organization_id and s.key == ^key,
        select: s.settings
      )
    )
  end

  @doc """
  Validates `settings` against the network's definition for `key` and stores
  them. Unknown fields are dropped; empty optional values are removed. Errors
  are `{:invalid, %{field => code}}` with codes `required`, `invalid`,
  `too_long` and `too_many`.
  """
  def put(network_id, organization_id, key, settings, updated_by_id \\ nil)

  def put(network_id, organization_id, key, settings, updated_by_id) when is_map(settings) do
    with %{} = definition <- Enum.find(definitions(network_id), &(&1["key"] == key)),
         {:ok, settings} <- validate(definition["schema"], settings) do
      store(organization_id, key, settings, updated_by_id)
    else
      nil -> {:error, :unknown_key}
      {:error, _} = error -> error
    end
  end

  def put(_network_id, _organization_id, _key, _settings, _updated_by_id),
    do: {:error, {:invalid, %{"settings" => "invalid"}}}

  @doc """
  Stores settings without a definition check, for migrations that write
  settings before the widgets declaring them are installed.
  """
  def store(organization_id, key, settings, updated_by_id \\ nil) when is_map(settings) do
    now = DateTime.utc_now()

    %OrganizationSetting{}
    |> Ecto.Changeset.change(
      organization_id: organization_id,
      key: key,
      settings: settings,
      updated_by_id: updated_by_id
    )
    |> Repo.insert(
      on_conflict: [set: [settings: settings, updated_by_id: updated_by_id, updated_at: now]],
      conflict_target: [:organization_id, :key],
      returning: true
    )
    |> case do
      {:ok, setting} -> {:ok, setting.settings}
      error -> error
    end
  end

  @doc "Removes the organization's settings for `key`."
  def delete(organization_id, key) do
    Repo.delete_all(
      from(s in OrganizationSetting,
        where: s.organization_id == ^organization_id and s.key == ^key
      )
    )

    :ok
  end

  defp values(organization_id) do
    from(s in OrganizationSetting,
      where: s.organization_id == ^organization_id,
      select: {s.key, s.settings}
    )
    |> Repo.all()
    |> Map.new()
  end

  # Returns a normalized definition, or nil when the declaration is invalid.
  defp definition_of(%{"organization_settings" => %{"key" => key, "schema" => schema} = d})
       when is_binary(key) and is_map(schema) do
    fields =
      for {name, field} <- schema,
          is_binary(name) and Regex.match?(@field_format, name),
          is_map(field),
          field["type"] in @types,
          into: %{},
          do: {name, Map.take(field, ~w(type label description required order placeholder))}

    if Regex.match?(@key_format, key) and fields != %{} and map_size(fields) <= @max_fields do
      %{
        "key" => key,
        "name" => string_or_nil(d["name"]),
        "description" => string_or_nil(d["description"]),
        "schema" => fields
      }
    end
  end

  defp definition_of(_pull_config), do: nil

  defp string_or_nil(value) when is_binary(value), do: value
  defp string_or_nil(_value), do: nil

  defp validate(schema, settings) do
    {values, errors} =
      Enum.reduce(schema, {%{}, %{}}, fn {name, field}, {values, errors} ->
        case cast(field, Map.get(settings, name)) do
          {:ok, nil} ->
            if field["required"] == true,
              do: {values, Map.put(errors, name, "required")},
              else: {values, errors}

          {:ok, value} ->
            {Map.put(values, name, value), errors}

          {:error, message} ->
            {values, Map.put(errors, name, message)}
        end
      end)

    if errors == %{}, do: {:ok, values}, else: {:error, {:invalid, errors}}
  end

  defp cast(_field, nil), do: {:ok, nil}

  defp cast(%{"type" => "string"}, value) when is_binary(value) do
    value = String.trim(value)

    cond do
      value == "" -> {:ok, nil}
      String.length(value) > @max_string -> {:error, "too_long"}
      true -> {:ok, value}
    end
  end

  defp cast(%{"type" => "number"}, value) when is_number(value), do: {:ok, value}
  defp cast(%{"type" => "boolean"}, value) when is_boolean(value), do: {:ok, value}

  defp cast(%{"type" => "list"}, value) when is_list(value) do
    items =
      value
      |> Enum.map(&if(is_binary(&1), do: String.trim(&1), else: &1))
      |> Enum.reject(&(&1 in ["", nil]))

    cond do
      not Enum.all?(items, &is_binary/1) -> {:error, "invalid"}
      length(items) > @max_list -> {:error, "too_many"}
      Enum.any?(items, &(String.length(&1) > @max_string)) -> {:error, "too_long"}
      items == [] -> {:ok, nil}
      true -> {:ok, Enum.uniq(items)}
    end
  end

  defp cast(_field, _value), do: {:error, "invalid"}
end

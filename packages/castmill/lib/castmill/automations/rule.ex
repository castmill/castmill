defmodule Castmill.Automations.Rule do
  @moduledoc """
  Validation and normalization of automation rules.

  A rule is stored as a JSON object:

      %{
        "id" => "uuid",
        "when" => %{"source" => "clock", "condition" => "at", "config" => %{...}},
        "then" => %{"action" => "interrupt", "config" => %{...}},
        "cooldown_seconds" => 0
      }

  The source and action configurations are validated by the modules
  registered in `Castmill.Automations.Registry`, which also decide whether
  the action supports the kind (event or state) of the condition.
  """

  alias Castmill.Automations.Registry

  @max_rules 50
  @max_cooldown_seconds 86_400

  def max_rules, do: @max_rules

  @doc """
  Validates and normalizes a list of rules. Returns `{:ok, rules}` or
  `{:error, [message]}`.
  """
  def validate_rules(rules) when is_list(rules) do
    if length(rules) > @max_rules do
      {:error, ["an automation can have at most #{@max_rules} rules"]}
    else
      rules
      |> stringify()
      |> Enum.with_index(1)
      |> Enum.reduce({[], [], MapSet.new()}, fn {rule, index}, {acc, errors, ids} ->
        case validate(rule) do
          {:ok, normalized} ->
            if MapSet.member?(ids, normalized["id"]) do
              {acc, ["rule #{index}: duplicate rule id" | errors], ids}
            else
              {[normalized | acc], errors, MapSet.put(ids, normalized["id"])}
            end

          {:error, message} ->
            {acc, ["rule #{index}: #{message}" | errors], ids}
        end
      end)
      |> case do
        {rules, [], _} -> {:ok, Enum.reverse(rules)}
        {_, errors, _} -> {:error, Enum.reverse(errors)}
      end
    end
  end

  def validate_rules(_rules), do: {:error, ["rules must be a list"]}

  @doc "Validates and normalizes a single rule (string keys)."
  def validate(rule) when is_map(rule) do
    rule = stringify(rule)

    with {:ok, id} <- validate_id(Map.get(rule, "id")),
         {:ok, when_part, kind} <- validate_when(Map.get(rule, "when")),
         {:ok, then_part} <- validate_then(Map.get(rule, "then"), kind),
         {:ok, cooldown} <- validate_cooldown(Map.get(rule, "cooldown_seconds")) do
      {:ok,
       %{
         "id" => id,
         "when" => when_part,
         "then" => then_part,
         "cooldown_seconds" => cooldown
       }}
    end
  end

  def validate(_rule), do: {:error, "rule must be an object"}

  @doc """
  Validates only the `when` part of a rule. Used for previews.
  """
  def validate_when(%{"source" => source_type} = when_part) when is_binary(source_type) do
    case Registry.source(source_type) do
      nil ->
        {:error, "when.source '#{source_type}' is not supported"}

      source ->
        condition = Map.get(when_part, "condition") || default_condition(source)
        condition = if is_binary(condition), do: condition, else: inspect(condition)

        case Registry.condition_kind(source, condition) do
          nil ->
            {:error, "when.condition '#{condition}' is not supported by #{source_type}"}

          kind ->
            case source.validate_config(Map.get(when_part, "config") || %{}) do
              {:ok, config} ->
                {:ok, %{"source" => source_type, "condition" => condition, "config" => config},
                 kind}

              {:error, message} ->
                {:error, "when.config: #{message}"}
            end
        end
    end
  end

  def validate_when(_), do: {:error, "when.source is required"}

  defp validate_then(%{"action" => action_type} = then_part, kind) when is_binary(action_type) do
    case Registry.action(action_type) do
      nil ->
        {:error, "then.action '#{action_type}' is not supported"}

      action ->
        if action.supports(kind) do
          case action.validate_config(Map.get(then_part, "config") || %{}) do
            {:ok, config} -> {:ok, %{"action" => action_type, "config" => config}}
            {:error, message} -> {:error, "then.config: #{message}"}
          end
        else
          {:error, "then.action '#{action_type}' does not support #{kind} conditions"}
        end
    end
  end

  defp validate_then(_, _kind), do: {:error, "then.action is required"}

  defp default_condition(source) do
    case source.conditions() do
      [%{name: name} | _] -> name
      _ -> nil
    end
  end

  defp validate_id(nil), do: {:ok, Ecto.UUID.generate()}
  defp validate_id(""), do: {:ok, Ecto.UUID.generate()}

  defp validate_id(id) when is_binary(id) and byte_size(id) <= 64 do
    if String.match?(id, ~r/^[A-Za-z0-9_-]+$/),
      do: {:ok, id},
      else: {:error, "id contains invalid characters"}
  end

  defp validate_id(_), do: {:error, "id must be a string of at most 64 characters"}

  defp validate_cooldown(nil), do: {:ok, 0}

  defp validate_cooldown(value)
       when is_integer(value) and value >= 0 and value <= @max_cooldown_seconds,
       do: {:ok, value}

  defp validate_cooldown(_),
    do: {:error, "cooldown_seconds must be an integer between 0 and #{@max_cooldown_seconds}"}

  @doc "Converts all map keys to strings (deeply)."
  def stringify(value), do: value |> Jason.encode!() |> Jason.decode!()

  @doc "Resources referenced by a rule's action (e.g. `%{playlists: [1]}`)."
  def referenced_resources(%{"then" => %{"action" => action_type, "config" => config}}) do
    case Registry.action(action_type) do
      nil -> %{}
      action -> action.referenced_resources(config)
    end
  end

  def referenced_resources(_rule), do: %{}

  @doc "Playlist ids referenced by a list of rules."
  def referenced_playlist_ids(rules) do
    rules
    |> Enum.flat_map(&Map.get(referenced_resources(&1), :playlists, []))
    |> Enum.uniq()
  end

  @doc "Capability names required by the rule (source and action)."
  def required_capabilities(%{"when" => %{"source" => s}, "then" => %{"action" => a}}) do
    source = Registry.source(s)
    action = Registry.action(a)

    %{
      source: source && source.required_capability(),
      action: action && action.required_capability()
    }
  end
end

defmodule Castmill.Widgets.Integrations.Choices do
  @moduledoc """
  Lists the choices an integration provides for a widget option.

  A top-level `options_schema` field may declare `"choices": {"list": ...}`. The
  dashboard then asks this module for the selectable values instead of letting the
  user type identifiers. The widget's integration fetcher provides them through the
  optional `choices/3` callback of `Castmill.Widgets.Integrations.Fetcher`.

  Safety rules:

    * Only the field's `depends_on` values are taken from the request, and the
      integration's `pull_config` always wins over them.
    * Credentials are resolved on the server and never returned.
    * Calls are bounded by a timeout, cached briefly and rate-limited per actor.
    * Provider output is sanitized: only known keys, string values, and https
      thumbnail/preview URLs (http too when `allow_http` is configured).

  Configuration (`config :castmill, Castmill.Widgets.Integrations.Choices`):
  `timeout` (10_000 ms), `cache_ttl` (60_000 ms), `rate_limit` (60 requests per
  minute and actor), `allow_http` (false).
  """

  require Logger

  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{ChoicesStore, WidgetIntegration}
  alias Castmill.Widgets.Schema

  @fetcher_prefix "Castmill.Widgets.Integrations.Fetchers."
  @max_items 500
  @max_values 200
  @max_query_length 200
  @max_cursor_length 2_000
  @max_text_length 500
  @max_url_length 2_048

  @type error ::
          :not_a_choice_field
          | :missing_dependency
          | :no_provider
          | :no_credentials
          | :rate_limited
          | :provider_error

  @doc """
  Lists choices for `field` of `widget` in the organization.

  `params` is the request body: `"options"` (form values), `"query"`, `"cursor"`
  and `"values"`. Pass `actor_id:` to apply the per-actor rate limit.
  """
  @spec list(String.t(), Castmill.Widgets.Widget.t() | map(), String.t(), map(), keyword()) ::
          {:ok, %{items: [map()], next: String.t() | nil}} | {:error, error()}
  def list(organization_id, widget, field, params, opts \\ []) when is_map(params) do
    with {:ok, choices} <- field_choices(widget, field),
         {:ok, dependencies} <- dependency_values(choices, params["options"]),
         :ok <- rate_limit(opts[:actor_id]),
         {:ok, integration, module} <- provider(widget),
         {:ok, credentials} <- credentials(organization_id, integration) do
      provider_params = %{
        "options" => provider_options(organization_id, integration, dependencies),
        "query" => query(params["query"]),
        "cursor" => cursor(params["cursor"]),
        "values" => values(params["values"])
      }

      key = {integration.id, organization_id, choices["list"], provider_params}

      case ChoicesStore.get(key) do
        {:ok, result} ->
          {:ok, result}

        :miss ->
          with {:ok, result} <-
                 call_provider(module, choices["list"], provider_params, credentials) do
            ChoicesStore.put(key, result, config(:cache_ttl, 60_000))
            {:ok, result}
          end
      end
    end
  end

  @doc """
  True when a widget meta integration names a fetcher that implements `choices/3`.
  """
  def provider_for_meta?(meta) when is_map(meta) do
    config = Map.get(meta, "integration") || Map.get(meta, :integration)
    fetcher = is_map(config) && (Map.get(config, "fetcher") || Map.get(config, :fetcher))

    with name when is_binary(name) <- Integrations.resolve_fetcher_module_name(fetcher),
         {:ok, module} <- provider_module(name) do
      is_atom(module)
    else
      _ -> false
    end
  end

  def provider_for_meta?(_meta), do: false

  @doc """
  Resolves an allowed fetcher module name to a loaded module exporting `choices/3`.
  """
  def provider_module(name) when is_binary(name) do
    name = String.replace_prefix(name, "Elixir.", "")

    with true <- String.starts_with?(name, @fetcher_prefix),
         {:ok, module} <- existing_module(name),
         true <- Code.ensure_loaded?(module),
         true <- function_exported?(module, :choices, 3) do
      {:ok, module}
    else
      _ -> :error
    end
  end

  def provider_module(_name), do: :error

  # Names come from widget definitions and are limited to the fetcher namespace.
  defp existing_module(name) do
    if Regex.match?(~r/^[A-Za-z0-9_.]+$/, name) and byte_size(name) <= 200 do
      {:ok, Module.concat([name])}
    else
      :error
    end
  end

  defp field_choices(widget, field) do
    case Schema.field_choices(Map.get(widget, :options_schema), field) do
      %{"list" => list} = choices when is_binary(list) -> {:ok, choices}
      _ -> {:error, :not_a_choice_field}
    end
  end

  defp dependency_values(choices, options) do
    options = if is_map(options), do: options, else: %{}

    Enum.reduce_while(Map.get(choices, "depends_on", []), {:ok, %{}}, fn key, {:ok, acc} ->
      case Map.get(options, key) do
        value when value in [nil, "", []] -> {:halt, {:error, :missing_dependency}}
        value -> {:cont, {:ok, Map.put(acc, key, value)}}
      end
    end)
  end

  defp rate_limit(nil), do: :ok
  defp rate_limit(actor_id), do: ChoicesStore.allow(actor_id, config(:rate_limit, 60))

  defp provider(widget) do
    integrations =
      case Integrations.list_integrations(widget_id: widget.id) do
        [] ->
          case Integrations.ensure_integration_for_widget(widget) do
            {:ok, %WidgetIntegration{} = integration} -> [integration]
            _ -> []
          end

        integrations ->
          integrations
      end

    Enum.find_value(integrations, {:error, :no_provider}, fn
      %WidgetIntegration{integration_type: "pull", is_active: true} = integration ->
        case provider_module(Map.get(integration.pull_config || %{}, "fetcher_module")) do
          {:ok, module} -> {:ok, integration, module}
          :error -> nil
        end

      _ ->
        nil
    end)
  end

  defp credentials(organization_id, integration) do
    case Integrations.get_fetch_credentials(organization_id, integration) do
      {:ok, credentials} -> {:ok, credentials}
      {:error, _reason} -> {:error, :no_credentials}
    end
  end

  # pull_config wins over form values, so users cannot redirect integration settings.
  defp provider_options(organization_id, integration, dependencies) do
    organization_id
    |> Integrations.with_display_locale(dependencies)
    |> Map.merge(integration.pull_config || %{})
  end

  defp query(query) when is_binary(query),
    do: query |> String.trim() |> String.slice(0, @max_query_length)

  defp query(_query), do: ""

  defp cursor(cursor) when is_binary(cursor) and byte_size(cursor) <= @max_cursor_length,
    do: cursor

  defp cursor(_cursor), do: nil

  defp values(values) when is_list(values) do
    values
    |> Enum.filter(&(is_binary(&1) and &1 != ""))
    |> Enum.take(@max_values)
  end

  defp values(value) when is_binary(value) and value != "", do: [value]
  defp values(_values), do: []

  defp call_provider(module, list, params, credentials) do
    timeout = config(:timeout, 10_000)
    caller = self()
    ref = make_ref()

    {pid, monitor} =
      spawn_monitor(fn ->
        result =
          try do
            module.choices(list, params, credentials)
          rescue
            error -> {:error, {:exception, Exception.message(error)}}
          end

        send(caller, {ref, result})
      end)

    receive do
      {^ref, result} ->
        Process.demonitor(monitor, [:flush])
        normalize_result(module, list, result)

      {:DOWN, ^monitor, :process, ^pid, reason} ->
        provider_failed(module, list, {:exit, reason})
    after
      timeout ->
        Process.exit(pid, :kill)
        Process.demonitor(monitor, [:flush])

        receive do
          {^ref, _late} -> :ok
        after
          0 -> :ok
        end

        provider_failed(module, list, :timeout)
    end
  end

  defp normalize_result(module, list, {:ok, result}) when is_map(result) do
    items = Map.get(result, :items) || Map.get(result, "items")
    next = Map.get(result, :next) || Map.get(result, "next")

    if is_list(items) do
      {:ok,
       %{
         items: items |> Enum.take(@max_items) |> Enum.flat_map(&normalize_item/1),
         next: if(is_binary(next) and next != "", do: next, else: nil)
       }}
    else
      provider_failed(module, list, :invalid_result)
    end
  end

  defp normalize_result(module, list, {:error, reason}), do: provider_failed(module, list, reason)
  defp normalize_result(module, list, _other), do: provider_failed(module, list, :invalid_result)

  defp provider_failed(module, list, reason) do
    Logger.warning(
      "Choices provider #{inspect(module)} failed for list #{inspect(list)}: " <>
        String.slice(inspect(reason), 0, 300)
    )

    {:error, :provider_error}
  end

  @doc false
  def normalize_item(item) when is_map(item) do
    value = text(field(item, :value))
    label = text(field(item, :label)) || value

    if value do
      [
        %{value: value, label: label}
        |> put_present(:description, text(field(item, :description)))
        |> put_present(:thumbnail_url, safe_url(field(item, :thumbnail_url)))
        |> put_present(:preview, preview(field(item, :preview)))
        |> put_present(:disabled, if(field(item, :disabled) == true, do: true))
      ]
    else
      []
    end
  end

  def normalize_item(_item), do: []

  defp preview(preview) when is_map(preview) do
    type = text(field(preview, :type))
    url = safe_url(field(preview, :url))

    if type && url do
      put_present(%{type: type, url: url}, :mime_type, text(field(preview, :mime_type)))
    end
  end

  defp preview(_preview), do: nil

  defp field(map, key), do: Map.get(map, key, Map.get(map, Atom.to_string(key)))

  defp text(value) when is_binary(value) and value != "",
    do: String.slice(value, 0, @max_text_length)

  defp text(value) when is_integer(value), do: Integer.to_string(value)
  defp text(_value), do: nil

  @doc false
  def safe_url(url) when is_binary(url) and byte_size(url) <= @max_url_length do
    allowed = if config(:allow_http, false), do: ["https", "http"], else: ["https"]

    case URI.parse(url) do
      %URI{scheme: scheme, host: host} when is_binary(host) and host != "" ->
        if scheme in allowed, do: url

      _ ->
        nil
    end
  end

  def safe_url(_url), do: nil

  defp put_present(map, _key, nil), do: map
  defp put_present(map, key, value), do: Map.put(map, key, value)

  defp config(key, default) do
    :castmill
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(key, default)
  end
end

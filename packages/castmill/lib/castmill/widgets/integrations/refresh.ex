defmodule Castmill.Widgets.Integrations.Refresh do
  @moduledoc """
  Fetching and refreshing pull-integration data, shared by every read path
  (device playlists, the widget data endpoint, dashboard previews) and the
  poller. See `agents/systems/INTEGRATION-ON-DEMAND-REFRESH.md`.

  ## Fetch options

  `fetch_options/3` builds the options a fetcher receives: the integration's
  `pull_config` merged with the playlist item's options. An item may only
  override `pull_config` keys that the widget declares in its `options_schema`
  (e.g. a default `feed_url`); undeclared integration settings such as a
  service URL always win, so item options cannot redirect server-side
  requests.

  ## On-demand integrations

  Integrations with `refresh_mode: "on_demand"` never get repeatable polling
  jobs. When their data is read (`read/5`):

    * missing: fetched now, waiting up to 5 s;
    * fresh: returned as is;
    * stale: returned as is, and one deduplicated background refresh is queued;
    * very stale (older than 6 × the interval): fetched now, waiting up to
      3 s, falling back to the stale data.

  Concurrent fetches of the same data take a PostgreSQL advisory lock, so many
  devices loading the same playlist cause a single upstream call. Failed
  refreshes keep the last good data and back off (one interval, then 2×, 4×,
  … up to 30 minutes).
  """

  require Logger

  import Ecto.Query, only: [from: 2]

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{WidgetIntegration, WidgetIntegrationData}

  @default_interval 300
  @very_stale_factor 6
  @max_backoff_seconds 1_800
  @lock_wait_step 200

  @allowed_prefixes [
    "Castmill.Widgets.Integrations.Fetchers.",
    "Elixir.Castmill.Widgets.Integrations.Fetchers."
  ]

  # ---------------------------------------------------------------------------
  # Options and fetching
  # ---------------------------------------------------------------------------

  @doc "Whether the integration refreshes on demand instead of polling."
  def on_demand?(%WidgetIntegration{refresh_mode: "on_demand"}), do: true
  def on_demand?(_integration), do: false

  @doc """
  The options passed to the integration's fetcher. Item options may override
  only the `pull_config` keys declared in the widget's `options_schema`.
  """
  def fetch_options(%WidgetIntegration{} = integration, widget_options, options_schema \\ nil) do
    pull_config = integration.pull_config || %{}
    widget_options = stringify_keys(widget_options || %{})
    declared = declared_option_keys(options_schema || options_schema_of(integration))

    protected = Map.keys(pull_config) -- declared
    Map.merge(pull_config, Map.drop(widget_options, protected))
  end

  @doc """
  Calls the integration's fetcher for an organization. Returns
  `{:ok, data}` or `{:error, reason}`.
  """
  def fetch(%WidgetIntegration{} = integration, organization_id, widget_options) do
    with {:ok, module} <- fetcher_module(integration),
         {:ok, credentials} <- Integrations.get_fetch_credentials(organization_id, integration) do
      case module.fetch(credentials, fetch_options(integration, widget_options)) do
        {:ok, data, _credentials} -> {:ok, data}
        {:ok, data} -> {:ok, data}
        {:error, reason, _credentials} -> {:error, reason}
        {:error, reason} -> {:error, reason}
        other -> {:error, {:unexpected_fetch_result, other}}
      end
    end
  end

  @doc "Resolves an integration's fetcher module, only from the allowed namespace."
  def fetcher_module(%WidgetIntegration{pull_config: pull_config}) do
    case Map.get(pull_config || %{}, "fetcher_module") do
      name when is_binary(name) ->
        if Enum.any?(@allowed_prefixes, &String.starts_with?(name, &1)) do
          full = if String.starts_with?(name, "Elixir."), do: name, else: "Elixir." <> name

          try do
            module = String.to_existing_atom(full)

            if Code.ensure_loaded?(module),
              do: {:ok, module},
              else: {:error, :invalid_fetcher_module}
          rescue
            ArgumentError -> {:error, :invalid_fetcher_module}
          end
        else
          {:error, :unauthorized_fetcher_module}
        end

      _ ->
        {:error, :no_fetcher_module}
    end
  end

  @doc """
  Fetches and stores data for a discriminator. On failure, records it on the
  stored data (if any) so on-demand refreshes back off.
  """
  def fetch_and_store(%WidgetIntegration{} = integration, organization_id, widget_options) do
    discriminator_id =
      Integrations.build_discriminator_id(integration, widget_options || %{}, organization_id)

    case fetch(integration, organization_id, widget_options) do
      {:ok, data} ->
        store(integration, organization_id, discriminator_id, data)

      {:error, reason} = error ->
        record_failure(integration, discriminator_id, reason)
        error
    end
  end

  @doc "Stores freshly fetched data, resetting the failure count."
  def store(%WidgetIntegration{} = integration, organization_id, discriminator_id, data) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Integrations.upsert_integration_data(%{
      widget_integration_id: integration.id,
      organization_id: organization_id,
      discriminator_id: discriminator_id,
      data: data,
      status: "active",
      error_message: nil,
      refresh_failures: 0,
      fetched_at: now,
      last_used_at: now,
      refresh_at: DateTime.add(now, interval(integration), :second),
      version: System.system_time(:second)
    })
  end

  @doc """
  Records a failed refresh: keeps the last good data and postpones the next
  refresh with exponential backoff.
  """
  def record_failure(%WidgetIntegration{} = integration, discriminator_id, reason) do
    case Integrations.get_integration_data_by_discriminator(integration.id, discriminator_id) do
      %WidgetIntegrationData{} = data ->
        failures = (data.refresh_failures || 0) + 1
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        data
        |> WidgetIntegrationData.changeset(%{
          refresh_failures: failures,
          status: "error",
          error_message: describe(reason),
          refresh_at: DateTime.add(now, backoff_seconds(integration, failures), :second)
        })
        |> Repo.update()

      nil ->
        :ok
    end
  end

  @doc "Seconds to wait before the next refresh after `failures` consecutive failures."
  def backoff_seconds(integration, failures) when failures >= 1 do
    min(interval(integration) * Integer.pow(2, failures - 1), @max_backoff_seconds)
  end

  # ---------------------------------------------------------------------------
  # Reading on-demand data
  # ---------------------------------------------------------------------------

  @doc """
  The stored data for exactly these widget options (no fallback to other
  discriminators), or nil.
  """
  def stored(%WidgetIntegration{} = integration, organization_id, widget_options) do
    discriminator_id =
      Integrations.build_discriminator_id(integration, widget_options || %{}, organization_id)

    Integrations.get_integration_data_by_discriminator(integration.id, discriminator_id)
  end

  @doc """
  Returns the data to serve for an on-demand integration, refreshing it as
  described in the module docs. `existing` is the stored data, or nil.

  Returns `{:ok, %WidgetIntegrationData{}}`, `{:error, reason}` or `nil` (no
  data and nothing could be fetched in time).
  """
  def read(
        %WidgetIntegration{} = integration,
        existing,
        organization_id,
        widget_id,
        widget_options
      ) do
    now = DateTime.utc_now()

    case state(existing, integration, now) do
      :missing ->
        integration
        |> fetch_now(organization_id, widget_options, timeout(:missing_timeout, 5_000))
        |> case do
          {:ok, data} -> {:ok, data}
          {:error, reason} -> {:error, reason}
          :timeout -> nil
        end

      :fresh ->
        {:ok, existing}

      :stale ->
        enqueue_refresh(integration, organization_id, widget_id, widget_options)
        {:ok, existing}

      :very_stale ->
        case fetch_now(
               integration,
               organization_id,
               widget_options,
               timeout(:very_stale_timeout, 3_000)
             ) do
          {:ok, data} -> {:ok, data}
          _ -> {:ok, existing}
        end
    end
  end

  @doc false
  def state(nil, _integration, _now), do: :missing

  def state(%WidgetIntegrationData{} = data, integration, now) do
    due? =
      case data.refresh_at do
        %DateTime{} = refresh_at -> DateTime.compare(refresh_at, now) != :gt
        _ -> true
      end

    age =
      case data.fetched_at do
        %DateTime{} = fetched_at -> DateTime.diff(now, fetched_at)
        _ -> :infinity
      end

    cond do
      not due? -> :fresh
      # A failing source is not retried synchronously, only through backoff.
      (data.refresh_failures || 0) > 0 -> :stale
      age == :infinity or age > interval(integration) * @very_stale_factor -> :very_stale
      true -> :stale
    end
  end

  # Fetches now, under an advisory lock so that concurrent readers of the same
  # data cause one upstream call. Waits at most `timeout` ms; a fetch that is
  # still running keeps going and stores its result for later reads.
  defp fetch_now(integration, organization_id, widget_options, timeout) do
    discriminator_id =
      Integrations.build_discriminator_id(integration, widget_options || %{}, organization_id)

    work = fn -> locked_fetch(integration, organization_id, widget_options, discriminator_id) end

    case run_with_timeout(work, timeout) do
      {:ok, {:fetched, result}} ->
        result

      {:ok, :locked} ->
        await_stored(integration, discriminator_id, timeout)

      :timeout ->
        :timeout
    end
  end

  defp locked_fetch(integration, organization_id, widget_options, discriminator_id) do
    key = lock_key(integration, discriminator_id)

    result =
      Repo.transaction(fn ->
        case Repo.query!("SELECT pg_try_advisory_xact_lock($1, $2)", [integration.id, key]) do
          %{rows: [[true]]} ->
            {:fetched, fetch_and_store(integration, organization_id, widget_options)}

          _ ->
            :locked
        end
      end)

    case result do
      {:ok, value} -> value
      {:error, reason} -> {:fetched, {:error, reason}}
    end
  end

  @doc false
  # Another reader is fetching the same data: wait for it to be stored.
  def await_stored(integration, discriminator_id, timeout) do
    deadline = System.monotonic_time(:millisecond) + timeout
    do_wait(integration, discriminator_id, deadline)
  end

  defp do_wait(integration, discriminator_id, deadline) do
    case Integrations.get_integration_data_by_discriminator(integration.id, discriminator_id) do
      %WidgetIntegrationData{status: "active"} = data ->
        {:ok, data}

      _ ->
        if System.monotonic_time(:millisecond) >= deadline do
          :timeout
        else
          Process.sleep(@lock_wait_step)
          do_wait(integration, discriminator_id, deadline)
        end
    end
  end

  # Tests run fetches inline (shared sandbox connection, deterministic results).
  defp run_with_timeout(fun, timeout) do
    if Application.get_env(:castmill, :async_poll_scheduling, true) do
      task = Task.async(fun)

      case Task.yield(task, timeout) do
        {:ok, value} ->
          {:ok, value}

        nil ->
          Task.ignore(task)
          :timeout
      end
    else
      {:ok, fun.()}
    end
  end

  @doc """
  Queues one background refresh. Queuing is deduplicated: while a refresh
  for the same organization, integration and discriminator is queued or
  running, further calls do nothing.
  """
  def enqueue_refresh(integration, organization_id, widget_id, widget_options) do
    Castmill.Workers.IntegrationPoller.enqueue_refresh(%{
      organization_id: organization_id,
      widget_id: widget_id,
      integration_id: integration.id,
      discriminator_id:
        Integrations.build_discriminator_id(integration, widget_options || %{}, organization_id),
      widget_options: widget_options || %{}
    })
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  # Waits (ms) for synchronous fetches; configurable with
  # `config :castmill, Castmill.Widgets.Integrations.Refresh, missing_timeout: …`.
  defp timeout(key, default),
    do: Application.get_env(:castmill, __MODULE__, []) |> Keyword.get(key, default)

  @doc "The integration's refresh interval in seconds."
  def interval(%WidgetIntegration{pull_interval_seconds: seconds})
      when is_integer(seconds) and seconds > 0,
      do: seconds

  def interval(_integration), do: @default_interval

  defp lock_key(integration, discriminator_id),
    do: :erlang.phash2({integration.id, discriminator_id}, 2_147_483_647)

  defp options_schema_of(%WidgetIntegration{widget_id: widget_id}) when not is_nil(widget_id) do
    from(w in Castmill.Widgets.Widget, where: w.id == ^widget_id, select: w.options_schema)
    |> Repo.one()
  end

  defp options_schema_of(_integration), do: %{}

  defp declared_option_keys(schema) when is_map(schema),
    do: schema |> Map.keys() |> Enum.map(&to_string/1)

  defp declared_option_keys(schema) when is_list(schema) do
    Enum.flat_map(schema, fn
      %{"key" => key} -> [to_string(key)]
      %{key: key} -> [to_string(key)]
      _ -> []
    end)
  end

  defp declared_option_keys(_schema), do: []

  defp stringify_keys(map) when is_map(map),
    do: Map.new(map, fn {key, value} -> {to_string(key), value} end)

  defp describe(reason) when is_binary(reason), do: String.slice(reason, 0, 500)
  defp describe(reason), do: reason |> inspect() |> String.slice(0, 500)
end

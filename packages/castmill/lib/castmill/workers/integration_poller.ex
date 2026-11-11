defmodule Castmill.Workers.IntegrationPoller do
  @moduledoc """
  BullMQ worker for polling PULL-mode integrations with API key credentials.

  This worker handles periodic data fetching for integrations that use
  API keys (not OAuth) to authenticate with third-party services.

  ## Scheduling

  Jobs are scheduled when:
  1. A user saves API key credentials for an integration
  2. A widget config using the integration is created/updated

  The worker:
  1. Fetches data from the third-party API using the configured fetcher module
  2. Stores the transformed data in widget_integration_data
  3. Broadcasts updates to connected players via Phoenix channels
  4. Reschedules itself based on the integration's pull_interval_seconds

  ## Job Arguments

  - `organization_id`: The organization owning the credentials
  - `widget_id`: The widget type ID
  - `widget_config_id`: The widget configuration ID, when data is config-scoped
  - `integration_id`: The integration configuration ID
  - `discriminator_id`: Unique ID for shared data (e.g., "symbols:AAPL,GOOGL")
  - `widget_options`: Options from widget config needed for data fetching

  ## Example

      Castmill.Workers.IntegrationPoller.schedule_poll(%{
        organization_id: org_id,
        widget_id: widget_id,
        integration_id: integration_id,
        discriminator_id: "symbols:AAPL,GOOGL,MSFT",
        widget_options: %{"symbols" => "AAPL,GOOGL,MSFT"}
      })
  """

  require Logger

  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.{Refresh, WidgetIntegration}
  alias Castmill.Workers.BullMQHelper

  @queue "integrations"

  @doc """
  Processes the integration polling job.
  This is called by BullMQ worker.
  """
  def process(%BullMQ.Job{data: args}) do
    %{
      "organization_id" => organization_id,
      "widget_id" => widget_id,
      "integration_id" => integration_id,
      "discriminator_id" => discriminator_id,
      "widget_options" => widget_options
    } = args

    Logger.info(
      "IntegrationPoller: Polling integration #{integration_id} for org #{organization_id}, discriminator: #{discriminator_id}"
    )

    with {:ok, integration} <- get_integration(integration_id) do
      if Refresh.on_demand?(integration) do
        process_on_demand(
          integration,
          organization_id,
          widget_id,
          discriminator_id,
          Map.get(args, "widget_config_id"),
          widget_options
        )
      else
        process_scheduled(
          integration,
          organization_id,
          widget_id,
          integration_id,
          discriminator_id,
          Map.get(args, "widget_config_id"),
          widget_options
        )
      end
    else
      {:error, :integration_not_found} ->
        Logger.warning(
          "IntegrationPoller: Integration #{integration_id} not found. Stopping polling."
        )

        :ok
    end
  end

  defp process_scheduled(
         integration,
         organization_id,
         widget_id,
         integration_id,
         discriminator_id,
         widget_config_id,
         widget_options
       ) do
    with {:ok, credentials} <- get_credentials(organization_id, integration_id, widget_config_id),
         {:ok, data, _updated_credentials} <-
           fetch_data(integration, credentials, widget_options),
         {:ok, _integration_data} <-
           Refresh.store(integration, organization_id, discriminator_id, data, widget_config_id) do
      # Broadcast the update to connected clients
      broadcast_update(widget_id, integration_id, discriminator_id, data)

      # No need to reschedule - BullMQ repeatable jobs handle this automatically
      :ok
    else
      {:error, :no_credentials} ->
        Logger.warning(
          "IntegrationPoller: No credentials found for org #{organization_id}, integration #{integration_id}. Stopping polling."
        )

        # Remove the repeatable job since credentials are gone
        cancel_polling(organization_id, integration_id)
        :ok

      {:error, :missing_api_key} ->
        Logger.warning(
          "IntegrationPoller: Missing API key for org #{organization_id}, integration #{integration_id}. Stopping polling."
        )

        :ok

      {:error, reason, _updated_credentials} ->
        Logger.error(
          "IntegrationPoller: Failed to poll integration #{integration_id}: #{inspect(reason)}"
        )

        # Return error to trigger retry
        {:error, reason}

      {:error, reason} ->
        Logger.error(
          "IntegrationPoller: Failed to poll integration #{integration_id}: #{inspect(reason)}"
        )

        # Return error to trigger retry
        {:error, reason}
    end
  end

  defp process_on_demand(
         integration,
         organization_id,
         widget_id,
         discriminator_id,
         widget_config_id,
         widget_options
       ) do
    case Refresh.refresh_if_needed(
           integration,
           organization_id,
           widget_options,
           discriminator_id,
           widget_config_id
         ) do
      {:ok, :refreshed, data} ->
        Integrations.broadcast_widget_config_data_update(
          organization_id,
          to_string(widget_id),
          integration.id,
          data.data,
          discriminator_id
        )

      {:ok, _status, _data} ->
        :ok

      {:error, :on_demand_refresh_failed} ->
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Schedules a polling job for an integration using BullMQ repeatable jobs.

  ## Parameters

  - `params`: Map with required keys:
    - `organization_id`: Organization ID
    - `widget_id`: Widget type ID
    - `integration_id`: Integration ID
    - `discriminator_id`: Unique discriminator for shared data
    - `widget_options`: Widget configuration options

  ## Options

  - `interval`: Poll interval in seconds (default: fetched from integration config)
  """
  def schedule_poll(params, opts \\ []) do
    # Get the integration to determine the polling interval
    integration_id = normalize_param(params, :integration_id)

    with {:ok, integration} <- get_integration(integration_id),
         false <- Refresh.on_demand?(integration) do
      interval_seconds =
        Keyword.get(opts, :interval) ||
          integration.pull_interval_seconds || 30

      job_data = %{
        "organization_id" => normalize_param(params, :organization_id),
        "widget_id" => normalize_param(params, :widget_id),
        "widget_config_id" => normalize_param(params, :widget_config_id),
        "integration_id" => normalize_param(params, :integration_id),
        "discriminator_id" => normalize_param(params, :discriminator_id),
        "widget_options" => normalize_param(params, :widget_options, %{})
      }

      # Create a unique scheduler ID based on the integration parameters
      # NOTE: Using underscores as separators to avoid having 5+ colon-separated parts,
      # which BullMQ would misidentify as legacy repeatable jobs.
      # The discriminator_id may contain colons (e.g., "org:uuid"), so we sanitize it.
      sanitized_discriminator = String.replace(job_data["discriminator_id"] || "", ":", "_")

      scheduler_id =
        "int_poll_#{job_data["organization_id"]}_#{job_data["integration_id"]}_#{sanitized_discriminator}"

      # Use BullMQ JobScheduler for repeatable jobs (via helper for test mode support)
      BullMQHelper.upsert_scheduler(
        @queue,
        scheduler_id,
        # BullMQ expects milliseconds
        %{every: interval_seconds * 1000},
        # job_name
        scheduler_id,
        job_data,
        attempts: 3
      )
    else
      # On-demand integrations are refreshed when their data is read, never by
      # repeatable jobs (see Castmill.Widgets.Integrations.Refresh).
      true ->
        {:ok, :on_demand}

      {:error, reason} ->
        Logger.error("IntegrationPoller: Failed to schedule poll: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Removes every polling scheduler of an integration (all organizations and
  discriminators), e.g. after switching it to on-demand refresh. Returns
  `{:ok, removed_count}`.
  """
  def remove_schedulers(integration_id) do
    pattern = ~r/^int_poll_[0-9a-fA-F-]+_#{integration_id}_/

    with {:ok, ids} <- BullMQHelper.list_scheduler_ids(@queue) do
      removed =
        ids
        |> Enum.filter(&(is_binary(&1) and Regex.match?(pattern, &1)))
        |> Enum.count(&match?({:ok, true}, BullMQHelper.remove_scheduler(@queue, &1)))

      {:ok, removed}
    end
  end

  @doc """
  Queues a single refresh of on-demand integration data. The job ID is derived
  from the organization, integration and discriminator, so while a refresh is
  queued or running, further requests for the same data are ignored.
  """
  def enqueue_refresh(params) do
    job_data = %{
      "organization_id" => normalize_param(params, :organization_id),
      "widget_id" => normalize_param(params, :widget_id),
      "widget_config_id" => normalize_param(params, :widget_config_id),
      "integration_id" => normalize_param(params, :integration_id),
      "discriminator_id" => normalize_param(params, :discriminator_id),
      "widget_options" => normalize_param(params, :widget_options, %{})
    }

    job_id =
      refresh_job_id(
        job_data["organization_id"],
        job_data["integration_id"],
        job_data["discriminator_id"]
      )

    enqueue = fn ->
      try do
        BullMQHelper.add_job(@queue, job_id, job_data,
          job_id: job_id,
          attempts: 1,
          remove_on_complete: true,
          remove_on_fail: true
        )
      rescue
        error -> {:error, error}
      catch
        :exit, reason -> {:error, reason}
      end
    end

    if Application.get_env(:castmill, :async_poll_scheduling, true) do
      # Never block (or crash) the read that triggered the refresh.
      Task.start(enqueue)
      :ok
    else
      enqueue.()
    end
  end

  @doc false
  def refresh_job_id(organization_id, integration_id, discriminator_id) do
    discriminator_hash =
      :sha256
      |> :crypto.hash(discriminator_id || "")
      |> Base.encode16(case: :lower)

    "int_refresh_#{organization_id}_#{integration_id}_#{discriminator_hash}"
  end

  @doc """
  Cancels polling jobs for a specific organization, integration, and discriminator.
  Uses BullMQ's JobScheduler.remove to stop the scheduled job.
  """
  def cancel_polling(organization_id, integration_id, discriminator_id \\ nil) do
    if discriminator_id do
      # Remove specific scheduler
      # NOTE: Must match the format used in schedule_poll - underscores instead of colons
      sanitized_discriminator = String.replace(discriminator_id || "", ":", "_")
      scheduler_id = "int_poll_#{organization_id}_#{integration_id}_#{sanitized_discriminator}"

      case BullMQHelper.remove_scheduler(@queue, scheduler_id) do
        {:ok, true} ->
          Logger.info("IntegrationPoller: Canceled polling for scheduler #{scheduler_id}")
          {:ok, 1}

        {:ok, false} ->
          Logger.info("IntegrationPoller: No scheduler found for #{scheduler_id}")
          {:ok, 0}

        {:error, reason} ->
          Logger.error("IntegrationPoller: Failed to cancel polling: #{inspect(reason)}")
          {:error, reason}
      end
    else
      # Can't cancel without discriminator - would need to list and filter
      Logger.warning(
        "IntegrationPoller: Cannot cancel polling without discriminator_id for org=#{organization_id}, integration=#{integration_id}"
      )

      {:ok, 0}
    end
  end

  # ===========================================================================
  # Private Functions
  # ===========================================================================

  defp get_integration(integration_id) do
    case Integrations.get_integration(integration_id) do
      nil -> {:error, :integration_not_found}
      integration -> {:ok, integration}
    end
  end

  defp get_credentials(organization_id, integration_id, widget_config_id) do
    case Integrations.get_integration(integration_id) do
      %WidgetIntegration{} = integration ->
        # Merges network-level credentials (shared across the network, e.g. a
        # commercial API key) with organization-level credentials.
        Integrations.get_fetch_credentials(organization_id, integration, widget_config_id)

      _ ->
        {:error, :no_credentials}
    end
  end

  defp fetch_data(%WidgetIntegration{} = integration, credentials, widget_options) do
    pull_config = integration.pull_config || %{}
    fetcher_module_name = Map.get(pull_config, "fetcher_module")

    # Item options may only override pull_config keys the widget declares as
    # options (see Refresh.fetch_options/3).
    merged_options = Refresh.fetch_options(integration, widget_options)

    if fetcher_module_name do
      # Use custom fetcher module
      case get_fetcher_module(fetcher_module_name) do
        {:ok, module} ->
          # Credentials are already decrypted by get_organization_credentials
          module.fetch(credentials, merged_options)

        {:error, reason} ->
          {:error, reason}
      end
    else
      # Use generic HTTP fetch
      fetch_generic(integration, credentials, merged_options)
    end
  end

  defp get_fetcher_module(module_name) when is_binary(module_name) do
    # Security: Only allow modules from our namespace
    allowed_prefixes = [
      "Castmill.Widgets.Integrations.Fetchers.",
      "Elixir.Castmill.Widgets.Integrations.Fetchers."
    ]

    if Enum.any?(allowed_prefixes, &String.starts_with?(module_name, &1)) do
      try do
        module = String.to_existing_atom("Elixir.#{module_name}")
        {:ok, module}
      rescue
        ArgumentError ->
          # Module doesn't exist as an atom, try to convert
          try do
            module = String.to_atom("Elixir.#{module_name}")
            {:ok, module}
          rescue
            _ -> {:error, :invalid_fetcher_module}
          end
      end
    else
      {:error, :unauthorized_fetcher_module}
    end
  end

  defp fetch_generic(integration, credentials, _widget_options) do
    # Fallback to generic HTTP fetch using the integration's pull_endpoint
    Integrations.do_fetch_integration_data(integration, credentials)
    |> case do
      {:ok, data} -> {:ok, data, credentials}
      {:error, reason} -> {:error, reason}
    end
  end

  defp broadcast_update(widget_id, integration_id, discriminator_id, data) do
    # Broadcast to the organization's notification channel
    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "integration_updates:#{widget_id}",
      {:integration_data_updated,
       %{
         widget_id: widget_id,
         integration_id: integration_id,
         discriminator_id: discriminator_id,
         data: data,
         updated_at: DateTime.utc_now()
       }}
    )
  end

  defp normalize_param(params, key, default \\ nil) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key)) || default
  end
end

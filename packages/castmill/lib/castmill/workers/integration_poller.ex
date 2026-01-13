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
  alias Castmill.Widgets.Integrations.WidgetIntegration
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

    with {:ok, integration} <- get_integration(integration_id),
         {:ok, credentials} <- get_credentials(organization_id, integration_id),
         {:ok, data, _updated_credentials} <-
           fetch_data(integration, credentials, widget_options),
         {:ok, _integration_data} <-
           store_data(organization_id, widget_id, integration, discriminator_id, data) do
      # Broadcast the update to connected clients
      broadcast_update(widget_id, integration_id, discriminator_id, data)

      # Schedule next poll
      schedule_next_poll(args, integration)

      :ok
    else
      {:error, :no_credentials} ->
        Logger.warning(
          "IntegrationPoller: No credentials found for org #{organization_id}, integration #{integration_id}. Stopping polling."
        )

        # Don't reschedule - credentials were deleted or not configured
        :ok

      {:error, :integration_not_found} ->
        Logger.warning(
          "IntegrationPoller: Integration #{integration_id} not found. Stopping polling."
        )

        :ok

      {:error, :missing_api_key} ->
        Logger.warning(
          "IntegrationPoller: Missing API key for org #{organization_id}, integration #{integration_id}. Stopping polling."
        )

        :ok

      {:error, reason} ->
        Logger.error(
          "IntegrationPoller: Failed to poll integration #{integration_id}: #{inspect(reason)}"
        )

        # Return error to trigger retry
        {:error, reason}
    end
  end

  @doc """
  Schedules a polling job for an integration.

  ## Parameters

  - `params`: Map with required keys:
    - `organization_id`: Organization ID
    - `widget_id`: Widget type ID
    - `integration_id`: Integration ID
    - `discriminator_id`: Unique discriminator for shared data
    - `widget_options`: Widget configuration options

  ## Options

  - `delay`: Initial delay in seconds (default: 0)
  """
  def schedule_poll(params, opts \\ []) do
    delay = Keyword.get(opts, :delay, 0)

    args = %{
      "organization_id" => normalize_param(params, :organization_id),
      "widget_id" => normalize_param(params, :widget_id),
      "integration_id" => normalize_param(params, :integration_id),
      "discriminator_id" => normalize_param(params, :discriminator_id),
      "widget_options" => normalize_param(params, :widget_options, %{})
    }

    job =
      if delay > 0 do
        BullMQHelper.add_job(@queue, "integration_poll", args, delay: delay, attempts: 3)
      else
        BullMQHelper.add_job(@queue, "integration_poll", args, attempts: 3)
      end

    job
  end

  @doc """
  Cancels all polling jobs for a specific organization and integration.
  """
  def cancel_polling(organization_id, integration_id) do
    # BullMQ doesn't have direct SQL-based cancellation like Oban
    # For now, we'll log a warning
    Logger.warning(
      "IntegrationPoller: Job cancellation for org=#{organization_id}, integration=#{integration_id} not fully implemented in BullMQ"
    )

    {:ok, 0}
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

  defp get_credentials(organization_id, integration_id) do
    case Integrations.get_organization_credentials(organization_id, integration_id) do
      {:ok, credentials} ->
        {:ok, credentials}

      {:error, _} ->
        # Check if integration allows optional auth
        # auth_type can be in pull_config or credential_schema
        case Integrations.get_integration(integration_id) do
          %{pull_config: %{"auth_type" => auth_type}} when auth_type in ["optional", "none"] ->
            {:ok, %{}}

          %{credential_schema: %{"auth_type" => auth_type}}
          when auth_type in ["optional", "none"] ->
            {:ok, %{}}

          _ ->
            {:error, :no_credentials}
        end
    end
  end

  defp fetch_data(%WidgetIntegration{} = integration, credentials, widget_options) do
    pull_config = integration.pull_config || %{}
    fetcher_module_name = Map.get(pull_config, "fetcher_module")

    if fetcher_module_name do
      # Use custom fetcher module
      case get_fetcher_module(fetcher_module_name) do
        {:ok, module} ->
          # Credentials are already decrypted by get_organization_credentials
          module.fetch(credentials, widget_options)

        {:error, reason} ->
          {:error, reason}
      end
    else
      # Use generic HTTP fetch
      fetch_generic(integration, credentials, widget_options)
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

  defp store_data(
         organization_id,
         widget_id,
         %WidgetIntegration{} = integration,
         discriminator_id,
         data
       ) do
    now = DateTime.utc_now()
    interval = integration.pull_interval_seconds || 300
    refresh_at = DateTime.add(now, interval, :second)

    attrs = %{
      widget_integration_id: integration.id,
      organization_id: organization_id,
      widget_id: widget_id,
      discriminator_id: discriminator_id,
      data: data,
      status: "active",
      fetched_at: now,
      last_used_at: now,
      refresh_at: refresh_at,
      version: System.system_time(:second)
    }

    Integrations.upsert_integration_data(attrs)
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

  defp schedule_next_poll(args, integration) do
    # Get poll interval from integration config (default 30 seconds)
    interval = integration.pull_interval_seconds || 30

    # Schedule next poll
    schedule_poll(args, delay: interval)
  end

  defp normalize_param(params, key, default \\ nil) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key)) || default
  end
end

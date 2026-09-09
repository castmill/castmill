defmodule Castmill.Workers.IntegrationDataCleanup do
  @moduledoc """
  BullMQ worker for cleaning up stale widget integration data.

  This worker periodically removes integration data cache entries that
  haven't been accessed in a configurable number of days. This prevents
  the database from accumulating stale cached data for widgets that are
  no longer in use.

  ## Scheduling

  This job runs daily by default. To schedule it in your application:

      # In Application.start/2 or a migration
      Castmill.Workers.IntegrationDataCleanup.schedule()

  ## Job Arguments

    - days_old: Number of days since last_used_at to consider stale (default: 30)

  ## What Gets Cleaned

  - Integration data entries where `last_used_at < NOW() - days_old`
  - Entries where `last_used_at` is NULL (never accessed)
  - Does NOT delete entries that are actively being used by widgets
  """

  require Logger

  alias Castmill.Widgets.Integrations
  alias Castmill.Workers.BullMQHelper

  @default_days_old 30
  @queue "maintenance"

  @doc """
  Processes the integration data cleanup job.
  This is called by BullMQ worker.
  """
  def process(%BullMQ.Job{data: args}) do
    days_old = args["days_old"] || @default_days_old

    Logger.info(
      "[IntegrationDataCleanup] Starting cleanup of entries older than #{days_old} days"
    )

    {:ok, count} = Integrations.delete_stale_integration_data(days_old)

    Logger.info(
      "[IntegrationDataCleanup] Successfully deleted #{count} stale integration data entries"
    )

    :ok
  end

  @doc """
  Schedules the cleanup job to run.

  By default, schedules for immediate execution. Use the `:delay`
  option to delay execution.

  ## Options

    - `:days_old` - Number of days to consider data stale (default: 30)
    - `:delay` - Delay in seconds before execution (default: 0)

  ## Examples

      # Run immediately
      IntegrationDataCleanup.schedule()

      # Run with custom stale threshold
      IntegrationDataCleanup.schedule(days_old: 7)

      # Schedule for later (in 1 hour)
      IntegrationDataCleanup.schedule(delay: 3600)
  """
  def schedule(opts \\ []) do
    days_old = Keyword.get(opts, :days_old, @default_days_old)
    delay = Keyword.get(opts, :delay, 0)

    args = %{days_old: days_old}

    job_opts = [priority: 3, attempts: 3]
    job_opts = if delay > 0, do: [{:delay, delay} | job_opts], else: job_opts

    BullMQHelper.add_job(@queue, "integration_data_cleanup", args, job_opts)
  end
end

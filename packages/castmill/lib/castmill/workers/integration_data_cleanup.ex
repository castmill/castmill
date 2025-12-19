defmodule Castmill.Workers.IntegrationDataCleanup do
  @moduledoc """
  Oban worker for cleaning up stale widget integration data.

  This worker periodically removes integration data cache entries that
  haven't been accessed in a configurable number of days. This prevents
  the database from accumulating stale cached data for widgets that are
  no longer in use.

  ## Scheduling

  This job runs daily by default. To schedule it in your application:

      # In Application.start/2 or a migration
      Castmill.Workers.IntegrationDataCleanup.schedule()

  Or configure via Oban cron plugin:

      config :castmill, Oban,
        plugins: [
          {Oban.Plugins.Cron, crontab: [
            {"0 3 * * *", Castmill.Workers.IntegrationDataCleanup}
          ]}
        ]

  ## Job Arguments

    - days_old: Number of days since last_used_at to consider stale (default: 30)

  ## What Gets Cleaned

  - Integration data entries where `last_used_at < NOW() - days_old`
  - Entries where `last_used_at` is NULL (never accessed)
  - Does NOT delete entries that are actively being used by widgets
  """

  use Oban.Worker,
    queue: :maintenance,
    max_attempts: 3,
    priority: 3,
    unique: [period: :infinity, states: [:available, :scheduled, :executing]]

  require Logger

  alias Castmill.Widgets.Integrations

  @default_days_old 30

  @doc """
  Schedules the cleanup job to run.

  By default, schedules for immediate execution. Use the `:scheduled_at`
  option to delay execution.

  ## Options

    - `:days_old` - Number of days to consider data stale (default: 30)
    - `:scheduled_at` - When to run the job (default: now)

  ## Examples

      # Run immediately
      IntegrationDataCleanup.schedule()

      # Run with custom stale threshold
      IntegrationDataCleanup.schedule(days_old: 7)

      # Schedule for later
      IntegrationDataCleanup.schedule(scheduled_at: ~U[2024-01-01 03:00:00Z])
  """
  def schedule(opts \\ []) do
    days_old = Keyword.get(opts, :days_old, @default_days_old)

    args = %{days_old: days_old}

    job_opts =
      case Keyword.get(opts, :scheduled_at) do
        nil -> []
        scheduled_at -> [scheduled_at: scheduled_at]
      end

    args
    |> new(job_opts)
    |> Oban.insert()
  end

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
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
end

defmodule Castmill.Workers.BullMQHelper do
  @moduledoc """
  Helper module for working with BullMQ jobs.
  Provides utilities to schedule, manage and test BullMQ jobs.

  ## Scheduler ID Format Warning

  When using `upsert_scheduler/6`, the scheduler ID **must have fewer than 5 colon-separated parts**.

  BullMQ uses a heuristic to distinguish scheduler types:
  - `< 5` colon parts → New job scheduler (correct behavior)
  - `≥ 5` colon parts → Legacy repeatable job (broken - only first iteration runs!)

  ### Examples

  **Incorrect (broken):**
      scheduler_id = "integration_poll:\#{org_id}:\#{integration_id}:\#{discriminator_id}"
      # If discriminator_id = "org:uuid", result = 5+ parts → BROKEN!

  **Correct:**
      sanitized = String.replace(discriminator_id, ":", "_")
      scheduler_id = "int_poll_\#{org_id}_\#{integration_id}_\#{sanitized}"
      # Result = 0 colon parts → Works correctly!

  See `MIGRATION_OBAN_TO_BULLMQ.md` for more details.
  """

  require Logger

  @doc """
  Adds a job to a BullMQ queue.

  ## Parameters
    - queue: The queue name (atom or string)
    - job_name: The job name/type (string)
    - args: Job arguments (map)
    - opts: Additional options for the job

  ## Options
    - :delay - Delay in seconds before job execution
    - :schedule_in - Same as delay (for Oban compatibility)
    - :priority - Job priority (lower = higher priority)
    - :attempts - Maximum retry attempts
    - :connection - Redis connection name (defaults to :castmill_redis)

  ## Returns
    - {:ok, job} on success
    - {:error, reason} on failure
  """
  def add_job(queue, job_name, args \\ %{}, opts \\ []) do
    # Check if in testing mode
    if testing_mode?() do
      # In testing mode, execute job synchronously
      execute_job_inline(queue, job_name, args)
    else
      # Normal mode - add to BullMQ queue
      # NOTE: BullMQ API based on v1.2 documentation
      # See: https://hexdocs.pm/bullmq/BullMQ.Queue.html#add/4
      connection = Keyword.get(opts, :connection, :castmill_redis)

      # Convert Oban-style options to BullMQ options
      bullmq_opts = convert_options(opts) ++ [connection: connection]

      queue_name = to_string(queue)

      BullMQ.Queue.add(queue_name, job_name, args, bullmq_opts)
    end
  end

  @doc """
  Cancels jobs matching the given criteria.

  ## Parameters
    - queue: The queue name
    - filter: A function that takes job data and returns true to cancel
  """
  def cancel_jobs(_queue, filter_fn) when is_function(filter_fn) do
    if testing_mode?() do
      {:ok, 0}
    else
      # BullMQ doesn't have a direct bulk cancel, so we'd need to implement
      # this by getting jobs and removing them individually
      # For now, return ok
      Logger.warning("BullMQ job cancellation not fully implemented yet")
      {:ok, 0}
    end
  end

  @doc """
  Creates or updates a job scheduler for repeatable jobs.

  Uses BullMQ.JobScheduler.upsert in production, but skips in test mode
  since tests don't need actual scheduling.

  ## Parameters
    - queue: The queue name (atom or string)
    - scheduler_id: Unique identifier for the scheduler
    - repeat_opts: Repeat configuration (e.g., %{every: 300_000} for 5 minutes)
    - job_name: Name for the jobs created by this scheduler
    - job_data: Data to be passed to each job
    - opts: Additional job options (attempts, priority, etc.)

  ## Returns
    - {:ok, job} on success (or mock job in test mode)
    - {:error, reason} on failure
  """
  def upsert_scheduler(queue, scheduler_id, repeat_opts, job_name, job_data \\ %{}, opts \\ []) do
    # Validate scheduler ID format - BullMQ treats IDs with 5+ colon-separated parts
    # as legacy repeatable jobs, which breaks the new job scheduler behavior
    colon_parts = String.split(scheduler_id, ":")
    if length(colon_parts) >= 5 do
      Logger.error(
        "[BullMQHelper] Scheduler ID '#{scheduler_id}' has #{length(colon_parts)} colon-separated parts. " <>
        "BullMQ will misidentify this as a legacy repeatable job. Use fewer than 5 colon-separated parts."
      )
    end

    if testing_mode?() do
      # In testing mode, don't actually create schedulers
      # Return a mock job struct for compatibility
      mock_job = BullMQ.Job.new(
        to_string(queue),
        job_name,
        job_data,
        timestamp: System.system_time(:millisecond)
      )
      {:ok, mock_job}
    else
      # BullMQ.JobScheduler uses Redix.command directly (not the connection pool)
      # so we need to use the direct Redix connection
      connection = Keyword.get(opts, :connection, :castmill_redis_direct)
      job_opts = Keyword.drop(opts, [:connection])

      BullMQ.JobScheduler.upsert(
        connection,
        to_string(queue),
        scheduler_id,
        repeat_opts,
        job_name,
        job_data,
        job_opts
      )
    end
  end

  @doc """
  Removes a job scheduler.

  ## Parameters
    - queue: The queue name
    - scheduler_id: The scheduler ID to remove

  ## Returns
    - {:ok, true} if removed
    - {:ok, false} if not found
    - {:error, reason} on failure
  """
  def remove_scheduler(queue, scheduler_id, opts \\ []) do
    if testing_mode?() do
      {:ok, true}
    else
      # BullMQ.JobScheduler uses Redix.command directly (not the connection pool)
      # so we need to use the direct Redix connection
      connection = Keyword.get(opts, :connection, :castmill_redis_direct)
      BullMQ.JobScheduler.remove(connection, to_string(queue), scheduler_id)
    end
  end

  @doc """
  Returns the appropriate queue name for a worker module.
  """
  def queue_for_worker(worker_module) do
    case worker_module do
      Castmill.Workers.ImageTranscoder -> "image_transcoder"
      Castmill.Workers.VideoTranscoder -> "video_transcoder"
      Castmill.Workers.SpotifyPoller -> "integration_polling"
      Castmill.Workers.IntegrationPoller -> "integrations"
      Castmill.Workers.IntegrationDataCleanup -> "maintenance"
      Castmill.Workers.EncryptionRotation -> "maintenance"
      _ -> "default"
    end
  end

  # Private functions

  defp testing_mode? do
    config = Application.get_env(:castmill, :bullmq, [])
    Keyword.get(config, :testing) == :inline
  end

  defp execute_job_inline(queue, job_name, args) do
    # In testing mode, execute the job immediately
    worker_module = worker_module_for_queue(queue, job_name)

    # Create a job struct that matches BullMQ.Job
    # NOTE: This structure is based on BullMQ Elixir v1.2 documentation
    # If the BullMQ library is updated, this may need adjustment
    # See: https://hexdocs.pm/bullmq/BullMQ.Job.html
    job =
      BullMQ.Job.new(
        to_string(queue),
        job_name,
        args,
        timestamp: System.system_time(:millisecond)
      )

    case worker_module.process(job) do
      :ok -> {:ok, job}
      {:ok, _result} -> {:ok, job}
      {:error, reason} -> {:error, reason}
    end
  end

  defp worker_module_for_queue(queue, job_name) do
    queue_str = to_string(queue)

    case {queue_str, job_name} do
      {"image_transcoder", _} -> Castmill.Workers.ImageTranscoder
      {"video_transcoder", _} -> Castmill.Workers.VideoTranscoder
      {"integration_polling", _} -> Castmill.Workers.SpotifyPoller
      {"integrations", _} -> Castmill.Workers.IntegrationPoller
      {"maintenance", "integration_data_cleanup"} -> Castmill.Workers.IntegrationDataCleanup
      {"maintenance", "encryption_rotation"} -> Castmill.Workers.EncryptionRotation
      _ -> raise "Unknown queue/job combination: queue=#{queue_str}, job_name=#{job_name}"
    end
  end

  defp convert_options(opts) do
    opts
    |> Enum.reduce([], fn
      {:schedule_in, seconds}, acc when is_integer(seconds) ->
        [{:delay, seconds * 1000} | acc]

      {:delay, seconds}, acc when is_integer(seconds) ->
        [{:delay, seconds * 1000} | acc]

      {:priority, priority}, acc ->
        [{:priority, priority} | acc]

      {:max_attempts, attempts}, acc ->
        [{:attempts, attempts} | acc]

      {:attempts, attempts}, acc ->
        [{:attempts, attempts} | acc]

      {_key, _value}, acc ->
        # Skip unknown options (including :repeat - use upsert_scheduler for repeatable jobs)
        acc
    end)
  end
end

defmodule Castmill.Workers.BullMQHelper do
  @moduledoc """
  Helper module for working with BullMQ jobs.
  Provides utilities to schedule, manage and test BullMQ jobs.
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
  def cancel_jobs(queue, filter_fn) when is_function(filter_fn) do
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
    worker_module = worker_module_for_queue(queue)
    
    # Create a job struct that matches BullMQ.Job
    job = %BullMQ.Job{
      id: Ecto.UUID.generate(),
      name: job_name,
      data: args,
      opts: %{},
      queue: to_string(queue),
      timestamp: System.system_time(:millisecond),
      attempts_made: 0
    }
    
    case worker_module.process(job) do
      :ok -> {:ok, job}
      {:ok, _result} -> {:ok, job}
      {:error, reason} -> {:error, reason}
    end
  end

  defp worker_module_for_queue(queue) do
    queue_str = to_string(queue)
    
    case queue_str do
      "image_transcoder" -> Castmill.Workers.ImageTranscoder
      "video_transcoder" -> Castmill.Workers.VideoTranscoder
      "integration_polling" -> Castmill.Workers.SpotifyPoller
      "integrations" -> Castmill.Workers.IntegrationPoller
      "maintenance" -> Castmill.Workers.IntegrationDataCleanup
      _ -> raise "Unknown queue: #{queue_str}"
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
        # Skip unknown options
        acc
    end)
  end
end

defmodule Castmill.Workers.BullMQCallbacks do
  @moduledoc """
  Logging for the BullMQ workers started in `Castmill.Application`.

  bullmq 2.2 validates `on_error` as a one-argument function but applies it as
  `(job, error, nil)` when a failed attempt is retried, so any `on_error`
  callback raises ("Worker event callback failed"). Workers therefore don't
  set `on_error`; `processor/2` logs failed attempts that will be retried, and
  `on_failed/1` (applied as `(job, reason)`) logs jobs that failed for good.
  """

  require Logger

  @doc "Wraps a job processor to log failed attempts that BullMQ will retry."
  def processor(queue, process) do
    fn job ->
      try do
        result = process.(job)

        case result do
          {:error, reason} -> log_attempt(queue, job, reason)
          _ -> :ok
        end

        result
      rescue
        exception ->
          log_attempt(queue, job, Exception.message(exception))
          reraise exception, __STACKTRACE__
      end
    end
  end

  @doc "Logs a job that failed after its last attempt."
  def on_failed(queue) do
    fn job, reason ->
      Logger.error(
        "BullMQ job failed queue=#{queue} job=#{job_name(job)} id=#{job_id(job)} " <>
          "attempts=#{attempt(job)}: #{describe(reason)}"
      )
    end
  end

  defp log_attempt(queue, job, reason) do
    if retry?(job) do
      Logger.warning(
        "BullMQ job attempt failed, retrying queue=#{queue} job=#{job_name(job)} " <>
          "id=#{job_id(job)} attempt=#{attempt(job)}: #{describe(reason)}"
      )
    end
  end

  defp retry?(%BullMQ.Job{} = job), do: BullMQ.Job.should_retry?(job)
  defp retry?(_job), do: false

  defp job_name(%{name: name}), do: name
  defp job_name(_job), do: "?"

  defp job_id(%{id: id}), do: id
  defp job_id(_job), do: "?"

  defp attempt(%{attempts_made: made}) when is_integer(made), do: made + 1
  defp attempt(_job), do: "?"

  defp describe(reason) when is_binary(reason), do: reason
  defp describe(reason), do: inspect(reason)
end

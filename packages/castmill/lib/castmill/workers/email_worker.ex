defmodule Castmill.Workers.EmailWorker do
  @moduledoc """
  BullMQ worker for background email delivery.

  Emails are serialized to JSON, enqueued via `Castmill.EmailDelivery.deliver/2`,
  and processed here. This provides:

  - Automatic retries on transient SES/provider failures
  - Non-blocking email sending for HTTP request handlers
  - Consistent background job semantics with other BullMQ workers

  In test mode (`:bullmq, testing: :inline`), jobs run synchronously in the
  same process, so `Swoosh.Adapters.Test` mailbox assertions still work.
  """

  require Logger

  alias Castmill.EmailDelivery

  @doc """
  Processes the email sending job.
  Called by BullMQ worker (or inline in test mode).
  """
  def process(%BullMQ.Job{data: data} = _job) do
    email = EmailDelivery.deserialize_email(data)
    context = data["context"] || "email"
    metadata = sanitize_metadata(data["metadata"])
    success_log_level = parse_log_level(data["success_log_level"])

    case EmailDelivery.deliver_now(email,
           context: context,
           metadata: metadata,
           success_log_level: success_log_level
         ) do
      {:ok, _email} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # Normalize metadata from JSON: ensure it's always a map (string keys preserved as-is).
  defp sanitize_metadata(nil), do: %{}
  defp sanitize_metadata(map) when is_map(map), do: map
  defp sanitize_metadata(_), do: %{}

  defp parse_log_level("debug"), do: :debug
  defp parse_log_level("info"), do: :info
  defp parse_log_level("false"), do: false
  defp parse_log_level(false), do: false
  defp parse_log_level(_), do: :debug
end

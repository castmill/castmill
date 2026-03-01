defmodule Castmill.EmailDelivery do
  @moduledoc """
  Centralized email delivery for all Castmill mail sending.

  All emails are enqueued via BullMQ for background delivery, providing:
  - Automatic retries on transient provider failures (SES, Mailgun, etc.)
  - Non-blocking sends — HTTP handlers return immediately
  - Consistent background job semantics with other BullMQ workers

  ## Public API

  - `deliver/2`     — Enqueues the email via BullMQ (returns `{:ok, :queued}`)
  - `deliver_now/2`  — Sends immediately via Mailer (used by `EmailWorker`)

  In test mode (`:bullmq, testing: :inline`), `deliver/2` executes the full
  send chain synchronously so `Swoosh.Adapters.Test` mailbox assertions work.
  """

  require Logger

  alias Castmill.Mailer
  alias Castmill.Workers.BullMQHelper

  @queue "email"

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc """
  Enqueues an email for background delivery via BullMQ.

  Returns `{:ok, :queued}` when the job is accepted, or `{:error, reason}`
  if enqueuing fails (or if inline-mode delivery fails in tests).

  ## Options

    * `:context`           — descriptive label for logs (default `"email"`)
    * `:metadata`          — map of structured metadata for log correlation
    * `:success_log_level` — `:debug` | `:info` | `false` (default `:debug`)
  """
  @spec deliver(Swoosh.Email.t(), keyword()) :: {:ok, :queued} | {:error, term()}
  def deliver(email, opts \\ []) do
    job_data = serialize_email(email, opts)

    case BullMQHelper.add_job(@queue, "send_email", job_data) do
      {:ok, _job} -> {:ok, :queued}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Sends an email immediately via the configured Mailer adapter.

  This is called by `Castmill.Workers.EmailWorker` to perform the actual send.
  It should not be called directly by application code — use `deliver/2` instead.

  Returns `{:ok, email}` on success, `{:error, reason}` on failure.
  """
  @spec deliver_now(Swoosh.Email.t(), keyword()) :: {:ok, Swoosh.Email.t()} | {:error, term()}
  def deliver_now(email, opts \\ []) do
    context = Keyword.get(opts, :context, "email")
    metadata = Keyword.get(opts, :metadata, %{})
    success_log_level = Keyword.get(opts, :success_log_level, :debug)
    metadata_suffix = format_metadata(metadata)

    try do
      case Mailer.deliver(email) do
        {:ok, response} ->
          log_success(context, metadata_suffix, response, success_log_level)
          {:ok, email}

        {:error, reason} ->
          Logger.error("Failed to send email (#{context})#{metadata_suffix}: #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      exception ->
        formatted_exception = Exception.format(:error, exception, __STACKTRACE__)

        Logger.error(
          "Failed to send email (#{context})#{metadata_suffix}:\n#{formatted_exception}"
        )

        {:error, exception}
    end
  end

  # ---------------------------------------------------------------------------
  # Serialization — Swoosh.Email ↔ JSON-compatible map
  # ---------------------------------------------------------------------------

  @doc false
  def serialize_email(email, opts) do
    %{
      "to" => serialize_recipients(email.to),
      "from" => serialize_recipient(email.from),
      "subject" => email.subject,
      "text_body" => email.text_body,
      "html_body" => email.html_body,
      "context" => Keyword.get(opts, :context, "email"),
      "metadata" => Keyword.get(opts, :metadata, %{}),
      "success_log_level" => to_string(Keyword.get(opts, :success_log_level, :debug))
    }
  end

  @doc false
  def deserialize_email(data) do
    import Swoosh.Email

    email =
      new()
      |> to(deserialize_recipients(data["to"]))
      |> from(deserialize_recipient(data["from"]))
      |> subject(data["subject"])

    email =
      if data["text_body"] do
        text_body(email, data["text_body"])
      else
        email
      end

    if data["html_body"] do
      html_body(email, data["html_body"])
    else
      email
    end
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp serialize_recipients(recipients) when is_list(recipients),
    do: Enum.map(recipients, &serialize_recipient/1)

  defp serialize_recipients(recipient), do: [serialize_recipient(recipient)]

  defp serialize_recipient({name, address}),
    do: %{"name" => name, "address" => address}

  defp serialize_recipient(address) when is_binary(address),
    do: %{"name" => "", "address" => address}

  defp deserialize_recipients(recipients) when is_list(recipients),
    do: Enum.map(recipients, &deserialize_recipient/1)

  defp deserialize_recipients(nil), do: []

  defp deserialize_recipient(%{"name" => "", "address" => address}), do: address
  defp deserialize_recipient(%{"name" => name, "address" => address}), do: {name, address}

  defp format_metadata(metadata) when metadata in [nil, %{}, []], do: ""

  defp format_metadata(metadata) do
    " metadata=#{inspect(metadata)}"
  end

  defp log_success(_context, _metadata_suffix, _response, false), do: :ok

  defp log_success(context, metadata_suffix, response, level) when level in [:debug, :info] do
    response_suffix = format_response_id(response)
    Logger.log(level, "Email sent successfully (#{context})#{metadata_suffix}#{response_suffix}")
  end

  defp log_success(context, metadata_suffix, response, _invalid_level) do
    response_suffix = format_response_id(response)
    Logger.debug("Email sent successfully (#{context})#{metadata_suffix}#{response_suffix}")
  end

  defp format_response_id(response) do
    case extract_response_id(response) do
      nil -> ""
      id -> " response_id=#{inspect(id)}"
    end
  end

  defp extract_response_id(%{id: id}), do: id
  defp extract_response_id(%{"id" => id}), do: id
  defp extract_response_id(_), do: nil
end

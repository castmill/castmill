defmodule Castmill.EmailDelivery do
  @moduledoc """
  Centralized, robust email delivery wrapper for all Castmill mail sending.

  Guarantees consistent behavior across callers:
  - returns `{:ok, email}` on successful delivery
  - returns `{:error, reason}` on provider errors
  - rescues unexpected exceptions and returns `{:error, exception}`
  - emits consistent logs for success and failures
  """

  require Logger

  alias Castmill.Mailer

  @spec deliver(Swoosh.Email.t(), keyword()) :: {:ok, Swoosh.Email.t()} | {:error, term()}
  def deliver(email, opts \\ []) do
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

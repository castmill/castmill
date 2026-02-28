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

    try do
      case Mailer.deliver(email) do
        {:ok, response} ->
          Logger.info("Email sent successfully (#{context}): #{inspect(response)}")
          {:ok, email}

        {:error, reason} ->
          Logger.error("Failed to send email (#{context}): #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      exception ->
        Logger.error("Failed to send email (#{context}): #{Exception.message(exception)}")
        {:error, exception}
    end
  end
end

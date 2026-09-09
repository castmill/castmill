defmodule CastmillWeb.AddonWebhookController do
  @moduledoc """
  Controller for handling webhook requests to addons.

  Addons can define webhook handlers via their `webhook_handlers/0` callback.
  Webhooks are routed to: POST /webhooks/addons/:addon_id/:path

  ## Example

  An addon can define a webhook handler like:

      def webhook_handlers do
        [
          %{
            path: "/stripe",
            handler: {MyApp.Billing, :handle_stripe_webhook},
            verify: {MyApp.Billing, :verify_stripe_signature}
          }
        ]
      end

  Then a POST to `/webhooks/addons/billing/stripe` will:
  1. Look up the handler for the "billing" addon with path "/stripe"
  2. Call the verify function (if defined) with the connection
  3. Call the handler function with the connection and params
  """

  use CastmillWeb, :controller
  require Logger

  @doc """
  Handles incoming webhook requests for addons.

  The addon_id is used to look up the addon's webhook handlers.
  The path is matched against the handler's path.
  """
  def handle_webhook(conn, %{"addon_id" => addon_id, "path" => path_parts}) do
    # Reconstruct the path from the path parts
    path = "/" <> Enum.join(path_parts, "/")

    case Castmill.Addons.Supervisor.find_webhook_handler(addon_id, path) do
      nil ->
        Logger.warning("No webhook handler found for addon=#{addon_id} path=#{path}")

        conn
        |> put_status(:not_found)
        |> json(%{error: "Webhook handler not found"})

      handler ->
        handle_with_handler(conn, handler)
    end
  end

  defp handle_with_handler(conn, handler) do
    # Verify signature if a verify function is provided
    with :ok <- verify_signature(conn, handler) do
      # Call the handler
      {module, function} = handler.handler

      case apply(module, function, [conn, conn.params]) do
        {:ok, response} ->
          conn
          |> put_status(:ok)
          |> json(response)

        {:error, reason} ->
          Logger.error("Webhook handler error: #{inspect(reason)}")

          conn
          |> put_status(:bad_request)
          |> json(%{error: reason})

        # Allow handlers to return a conn directly for custom responses
        %Plug.Conn{} = conn ->
          conn
      end
    else
      {:error, :invalid_signature} ->
        Logger.warning("Invalid webhook signature for addon=#{handler.addon_id}")

        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid signature"})

      {:error, reason} ->
        Logger.error("Webhook verification error: #{inspect(reason)}")

        conn
        |> put_status(:bad_request)
        |> json(%{error: "Verification failed"})
    end
  end

  defp verify_signature(_conn, %{verify: nil}), do: :ok
  defp verify_signature(conn, %{verify: {module, function}}), do: apply(module, function, [conn])
  defp verify_signature(_conn, _handler), do: :ok
end

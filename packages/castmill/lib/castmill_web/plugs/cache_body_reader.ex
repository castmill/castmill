defmodule CastmillWeb.Plugs.CacheBodyReader do
  @moduledoc """
  A custom body reader that caches the raw request body in `conn.assigns[:raw_body]`.

  This is required for webhook signature verification (e.g., Stripe) where
  the raw body bytes must be preserved exactly as received, before JSON parsing.

  ## Usage

  Configure in the endpoint's `Plug.Parsers`:

      plug Plug.Parsers,
        parsers: [:urlencoded, :json],
        body_reader: {CastmillWeb.Plugs.CacheBodyReader, :read_body, []},
        ...
  """

  def read_body(conn, opts \\ []) do
    case Plug.Conn.read_body(conn, opts) do
      {:ok, body, conn} ->
        conn = update_in(conn.assigns[:raw_body], &[body | &1 || []])
        {:ok, body, conn}

      {:more, body, conn} ->
        conn = update_in(conn.assigns[:raw_body], &[body | &1 || []])
        {:more, body, conn}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

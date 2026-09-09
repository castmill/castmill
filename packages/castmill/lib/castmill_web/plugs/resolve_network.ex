defmodule CastmillWeb.Plugs.ResolveNetwork do
  @moduledoc """
  Plug that resolves the current network from the request's Origin header.

  The Origin header tells us which domain the dashboard is being accessed from,
  which determines which network the user is operating in. All resource queries
  should be scoped to this network.

  Assigns:
    - `conn.assigns.network_id` — the resolved network UUID, or nil if no Origin
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    origin = List.first(get_req_header(conn, "origin"))

    case resolve_network_id(origin) do
      {:ok, network_id} ->
        assign(conn, :network_id, network_id)

      :skip ->
        assign(conn, :network_id, nil)
    end
  end

  defp resolve_network_id(nil), do: :skip

  defp resolve_network_id(origin) do
    case Castmill.Accounts.get_network_id_by_domain(origin) do
      {:ok, network_id} -> {:ok, network_id}
      {:error, _} -> :skip
    end
  end
end

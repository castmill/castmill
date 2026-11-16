defmodule CastmillWeb.NetworkSettingsController do
  use CastmillWeb, :controller

  alias Castmill.Accounts

  action_fallback(CastmillWeb.FallbackController)

  @doc """
  Returns public network settings based on the request origin or host.
  This is used by the frontend to determine if signup is allowed,
  and to display network-specific branding (copyright, social links).
  """
  def show(conn, _params) do
    origin =
      List.first(Plug.Conn.get_req_header(conn, "origin")) || request_host(conn)

    if is_nil(origin) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: "Missing origin header"})
    else
      case Accounts.get_network_id_by_domain(origin) do
        {:ok, network_id} ->
          network = Castmill.Networks.get_network(network_id)

          conn
          |> put_status(:ok)
          |> json(%{
            name: network.name,
            invitation_only: network.invitation_only,
            logo: network.logo,
            logo_light: network.logo_light,
            copyright: network.copyright,
            email: network.email,
            default_locale: network.default_locale,
            privacy_policy_url: network.privacy_policy_url,
            social_links: get_in(network.meta, ["social_links"]) || %{},
            # Passkeys use this RP ID on all of the network's domains
            passkey_rp_id: Castmill.Networks.PasskeyDomains.rp_id(network)
          })

        {:error, :network_not_found} ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Network not found"})
      end
    end
  end

  defp request_host(conn) do
    case Plug.Conn.get_req_header(conn, "host") do
      [host | _] ->
        host

      [] ->
        if conn.port == default_port(conn.scheme),
          do: conn.host,
          else: "#{conn.host}:#{conn.port}"
    end
  end

  defp default_port(:https), do: 443
  defp default_port(_scheme), do: 80
end

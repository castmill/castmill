defmodule CastmillWeb.WebauthnController do
  @moduledoc """
  `GET /.well-known/webauthn` for WebAuthn Related Origin Requests: the
  origins that may use the passkeys of the network whose primary domain is the
  requested host (see `Castmill.Networks.PasskeyDomains`).

  Hosts served elsewhere (e.g. a static dashboard host) can proxy to this
  endpoint and pass their host in the `host` query parameter.
  """
  use CastmillWeb, :controller

  alias Castmill.Networks.PasskeyDomains

  def related_origins(conn, params) do
    host =
      case params do
        %{"host" => host} when is_binary(host) and host != "" -> host
        _ -> conn.host
      end

    case PasskeyDomains.related_origins(host) do
      {:ok, origins} ->
        conn
        |> put_resp_header("cache-control", "public, max-age=300")
        |> json(%{origins: origins})

      {:error, :network_not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Not found"})
    end
  end
end

defmodule CastmillWeb.MCPController do
  @moduledoc """
  Streamable HTTP transport for the Castmill MCP server.

  `POST /mcp` receives JSON-RPC messages from MCP clients (Claude Desktop,
  Claude Code, VS Code, Cursor, ...) and replies with `application/json`.
  The server is stateless, so it does not use `Mcp-Session-Id` and does not
  offer a server-to-client SSE stream (`GET /mcp` returns 405).

  Requests must be authenticated with an agent credential:

      Authorization: Bearer <agent credential>

  Agent credentials are only valid here; they cannot be used with the
  dashboard or REST APIs.
  """
  use CastmillWeb, :controller

  alias Castmill.Agents
  alias CastmillWeb.MCP.Server

  def message(conn, _params) do
    with {:ok, agent} <- authenticate(conn) do
      messages =
        case conn.body_params do
          %{"_json" => batch} when is_list(batch) -> batch
          %Plug.Conn.Unfetched{} -> %{}
          message -> message
        end

      case Server.handle(messages, %{agent: agent, conn: conn}) do
        nil ->
          send_resp(conn, :accepted, "")

        response ->
          conn
          |> put_status(:ok)
          |> json(response)
      end
    end
  end

  def method_not_allowed(conn, _params) do
    conn
    |> put_resp_header("allow", "POST")
    |> put_status(:method_not_allowed)
    |> json(%{error: "Method not allowed. Send JSON-RPC messages with POST."})
  end

  defp authenticate(conn) do
    with {:ok, token} <- bearer_token(conn),
         {:ok, agent} <- Agents.authenticate(token, Utils.RemoteIp.get(conn)),
         {:ok, _user} <- CastmillWeb.SessionUtils.check_user_blocked_status(agent.user) do
      {:ok, agent}
    else
      {:error, {reason, message}} when reason in [:user_blocked, :organization_blocked] ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: message, code: to_string(reason)})
        |> halt()

      _ ->
        conn
        |> put_resp_header("www-authenticate", ~s(Bearer realm="castmill-mcp"))
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid or missing agent credentials"})
        |> halt()
    end
  end

  defp bearer_token(conn) do
    with [header | _] <- get_req_header(conn, "authorization"),
         [scheme, token] <- String.split(header, " ", parts: 2, trim: true),
         "bearer" <- String.downcase(scheme),
         token when token != "" <- String.trim(token) do
      {:ok, token}
    else
      _ -> {:error, :missing_token}
    end
  end
end

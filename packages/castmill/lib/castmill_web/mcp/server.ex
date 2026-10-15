defmodule CastmillWeb.MCP.Server do
  @moduledoc """
  Model Context Protocol (MCP) server for Castmill.

  Implements the JSON-RPC 2.0 message handling of the MCP specification
  (https://modelcontextprotocol.io) for the Streamable HTTP transport in
  stateless JSON-response mode. The transport is handled by
  `CastmillWeb.MCPController`.

  Supported methods: `initialize`, `ping`, `tools/list`, `tools/call`,
  `resources/list`, `resources/read`, `resources/templates/list`,
  `prompts/list` and the `notifications/*` notifications.
  """

  require Logger

  alias Castmill.Agents
  alias CastmillWeb.MCP.Tools

  @supported_versions ["2025-06-18", "2025-03-26", "2024-11-05"]
  @latest_version "2025-06-18"

  @guide_path Path.expand("../../../priv/mcp/agent-guide.md", __DIR__)
  @external_resource @guide_path
  @guide File.read!(@guide_path)
  @guide_uri "castmill://docs/agent-guide"

  @max_logged_arguments_bytes 8_000

  # JSON-RPC error codes
  @parse_error -32700
  @invalid_request -32600
  @method_not_found -32601
  @invalid_params -32602

  @doc "Protocol versions supported by the server."
  def supported_versions, do: @supported_versions

  @doc "The agent guide served as an MCP resource."
  def guide, do: @guide

  @doc """
  Handles a decoded JSON-RPC message (or batch).

  `ctx` must contain the authenticated `:agent` and may contain the
  originating `:conn`.

  Returns the response to send (a map, a list for batches) or `nil` when the
  message(s) did not require a response (notifications and responses).
  """
  def handle(messages, ctx) when is_list(messages) do
    if messages == [] do
      error_response(nil, @invalid_request, "Invalid Request: empty batch")
    else
      messages
      |> Enum.map(&handle(&1, ctx))
      |> Enum.reject(&is_nil/1)
      |> case do
        [] -> nil
        responses -> responses
      end
    end
  end

  def handle(%{"jsonrpc" => "2.0", "method" => method} = message, ctx) when is_binary(method) do
    params = Map.get(message, "params") || %{}

    case Map.fetch(message, "id") do
      # Notifications do not get a response
      :error ->
        handle_notification(method, params, ctx)
        nil

      {:ok, id} when is_binary(id) or is_integer(id) ->
        if is_map(params) do
          id |> dispatch(method, params, ctx) |> to_response(id)
        else
          error_response(id, @invalid_params, "Invalid params")
        end

      {:ok, _id} ->
        error_response(nil, @invalid_request, "Invalid Request: invalid id")
    end
  end

  # Responses sent by the client (we never send requests) are ignored.
  def handle(%{"jsonrpc" => "2.0", "id" => _} = message, _ctx)
      when is_map_key(message, "result") or is_map_key(message, "error") do
    nil
  end

  def handle(message, _ctx) when is_map(message) do
    id = Map.get(message, "id")
    id = if is_binary(id) or is_integer(id), do: id, else: nil
    error_response(id, @invalid_request, "Invalid Request")
  end

  def handle(_message, _ctx), do: error_response(nil, @parse_error, "Parse error")

  defp handle_notification(_method, _params, _ctx), do: :ok

  defp dispatch(_id, "initialize", params, _ctx) do
    requested = Map.get(params, "protocolVersion")
    version = if requested in @supported_versions, do: requested, else: @latest_version

    {:ok,
     %{
       "protocolVersion" => version,
       "capabilities" => %{
         "tools" => %{"listChanged" => false},
         "resources" => %{"listChanged" => false, "subscribe" => false},
         "prompts" => %{"listChanged" => false}
       },
       "serverInfo" => %{
         "name" => "castmill",
         "title" => "Castmill Digital Signage",
         "version" => server_version()
       },
       "instructions" => instructions()
     }}
  end

  defp dispatch(_id, "ping", _params, _ctx), do: {:ok, %{}}

  defp dispatch(_id, "tools/list", _params, _ctx), do: {:ok, %{"tools" => Tools.list()}}

  defp dispatch(_id, "tools/call", %{"name" => name} = params, ctx) when is_binary(name) do
    args = Map.get(params, "arguments") || %{}

    if is_map(args) do
      call_tool(name, args, ctx)
    else
      {:error, @invalid_params, "Tool arguments must be an object"}
    end
  end

  defp dispatch(_id, "tools/call", _params, _ctx) do
    {:error, @invalid_params, "Missing tool name"}
  end

  defp dispatch(_id, "resources/list", _params, _ctx) do
    {:ok,
     %{
       "resources" => [
         %{
           "uri" => @guide_uri,
           "name" => "agent-guide",
           "title" => "Castmill agent guide",
           "description" =>
             "How Castmill works, recommended workflows and the API endpoint catalog.",
           "mimeType" => "text/markdown"
         }
       ]
     }}
  end

  defp dispatch(_id, "resources/read", %{"uri" => @guide_uri}, _ctx) do
    {:ok,
     %{
       "contents" => [
         %{"uri" => @guide_uri, "mimeType" => "text/markdown", "text" => @guide}
       ]
     }}
  end

  defp dispatch(_id, "resources/read", _params, _ctx) do
    {:error, -32002, "Resource not found"}
  end

  defp dispatch(_id, "resources/templates/list", _params, _ctx),
    do: {:ok, %{"resourceTemplates" => []}}

  defp dispatch(_id, "prompts/list", _params, _ctx), do: {:ok, %{"prompts" => []}}

  defp dispatch(_id, method, _params, _ctx) do
    {:error, @method_not_found, "Method not found: #{method}"}
  end

  defp call_tool(name, args, ctx) do
    started_at = System.monotonic_time(:millisecond)

    case Tools.call(name, args, ctx) do
      {:ok, result, log} ->
        log_action(ctx, name, args, result, log, System.monotonic_time(:millisecond) - started_at)
        {:ok, result}

      {:error, :unknown_tool} ->
        {:error, @invalid_params, "Unknown tool: #{name}"}
    end
  end

  defp log_action(ctx, name, args, result, log, duration_ms) do
    is_error = Map.get(result, "isError", false)

    attrs = %{
      tool: name,
      arguments: loggable_arguments(args),
      method: log.method,
      path: log.path,
      http_status: log.http_status,
      status: if(is_error, do: "error", else: "success"),
      error: if(is_error, do: error_text(result)),
      duration_ms: duration_ms,
      ip: client_ip(ctx[:conn])
    }

    case Agents.log_action(ctx.agent, attrs) do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.error("Could not log agent action #{name}: #{inspect(reason)}")
    end
  end

  defp loggable_arguments(args) do
    case Jason.encode(args) do
      {:ok, json} when byte_size(json) <= @max_logged_arguments_bytes ->
        args

      {:ok, json} ->
        %{
          "_truncated" => true,
          "preview" => String.slice(json, 0, 1_000)
        }

      {:error, _} ->
        %{"_unserializable" => true}
    end
  end

  defp error_text(%{"content" => [%{"text" => text} | _]}), do: String.slice(text, 0, 2_000)
  defp error_text(_), do: nil

  defp client_ip(%Plug.Conn{} = conn), do: Utils.RemoteIp.get(conn)
  defp client_ip(_), do: nil

  defp to_response({:ok, result}, id), do: %{"jsonrpc" => "2.0", "id" => id, "result" => result}

  defp to_response({:error, code, message}, id), do: error_response(id, code, message)

  defp error_response(id, code, message) do
    %{"jsonrpc" => "2.0", "id" => id, "error" => %{"code" => code, "message" => message}}
  end

  defp server_version do
    case Application.spec(:castmill, :vsn) do
      nil -> "0.0.0"
      vsn -> to_string(vsn)
    end
  end

  defp instructions do
    """
    You are connected to Castmill, a digital signage platform, as an AI agent that is a \
    member of one organization. You can do what a user with your role can do in the \
    Castmill dashboard, and every action you perform is logged and visible to the \
    organization administrators.

    Start by calling `get_context` to learn your organization, role and permissions. Read \
    the `#{@guide_uri}` resource for the domain model, recommended workflows and the API \
    endpoint catalog. Typical flow: medias -> playlists (widget items) -> channels \
    (schedule playlists) -> devices (assign channels). Ask for confirmation before \
    destructive actions (deleting resources, device commands) unless explicitly told \
    otherwise.
    """
  end
end

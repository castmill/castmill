defmodule CastmillWeb.MCP.Dispatcher do
  @moduledoc """
  Executes dashboard API requests on behalf of an agent.

  The request is dispatched in-process through `CastmillWeb.Endpoint`, exactly
  as if it had been sent by the dashboard for the agent user: it goes through
  the `:dashboard` pipeline (`fetch_dashboard_user`, blocked user/organization
  checks, `authenticate_user`), the controllers' `check_access/3` callbacks
  (`Castmill.Plug.AuthorizeDash`) and the regular validations. No
  authorization logic is duplicated for agents.

  The short-lived dashboard token used for the internal request is signed on
  the server and never leaves this process.
  """

  require Logger

  alias Castmill.Agents.Agent

  @type response :: %{status: non_neg_integer(), body: term()}

  @doc """
  Dispatches a request as the agent user.

  Options:
    * `:query` - map of query string parameters
    * `:body` - map sent as JSON body
    * `:conn` - the originating connection (used to propagate the client IP,
      host and user agent)
  """
  @spec request(struct(), String.t(), String.t(), keyword()) :: response()
  def request(%Agent{user_id: user_id}, method, path, opts \\ []) do
    method = String.upcase(method)
    uri = path <> encode_query(Keyword.get(opts, :query))
    body = Keyword.get(opts, :body)

    conn =
      %Plug.Conn{}
      |> Plug.Adapters.Test.Conn.conn(method, uri, body_params(method, body))
      |> propagate_origin(Keyword.get(opts, :conn))
      |> Plug.Conn.put_req_header("accept", "application/json")
      |> Plug.Conn.put_req_header("content-type", "application/json")
      |> Plug.Conn.put_req_header("authorization", "Bearer " <> sign_token(user_id))

    {Plug.Adapters.Test.Conn, %{ref: ref}} = conn.adapter
    logger_metadata = Logger.metadata()

    try do
      conn
      |> CastmillWeb.Endpoint.call(CastmillWeb.Endpoint.init([]))
      |> read_response(ref)
    rescue
      exception ->
        sent_response(ref) || exception_response(exception)
    catch
      kind, reason ->
        Logger.error("MCP dispatch failed: #{inspect(kind)} #{inspect(reason)}")
        sent_response(ref) || %{status: 500, body: %{"error" => "Internal server error"}}
    after
      Logger.reset_metadata(logger_metadata)
      flush_sent_messages(ref)
    end
  end

  defp sign_token(user_id) do
    Phoenix.Token.sign(
      CastmillWeb.Endpoint,
      CastmillWeb.Secrets.get_dashboard_user_token_salt(),
      user_id
    )
  end

  defp body_params(method, _body) when method in ["GET", "HEAD"], do: nil
  defp body_params(_method, nil), do: %{}
  defp body_params(_method, body) when is_map(body), do: body
  defp body_params(_method, body), do: %{"_json" => body}

  defp encode_query(nil), do: ""
  defp encode_query(query) when query == %{}, do: ""

  defp encode_query(query) when is_map(query) do
    query =
      query
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new(fn {key, value} -> {to_string(key), query_value(value)} end)

    if query == %{}, do: "", else: "?" <> Plug.Conn.Query.encode(query)
  end

  defp query_value(value) when is_list(value), do: Enum.map_join(value, ",", &to_string/1)
  defp query_value(value) when is_map(value), do: value
  defp query_value(value), do: to_string(value)

  defp propagate_origin(conn, %Plug.Conn{} = origin) do
    conn = %{
      conn
      | remote_ip: origin.remote_ip,
        host: origin.host,
        scheme: origin.scheme,
        port: origin.port
    }

    Enum.reduce(["user-agent", "x-forwarded-for", "x-real-ip"], conn, fn header, conn ->
      case Plug.Conn.get_req_header(origin, header) do
        [value | _] -> Plug.Conn.put_req_header(conn, header, value)
        [] -> conn
      end
    end)
  end

  defp propagate_origin(conn, _), do: conn

  defp read_response(%Plug.Conn{state: :sent, status: status, resp_body: body}, _ref) do
    %{status: status, body: decode_body(body)}
  end

  defp read_response(%Plug.Conn{status: status} = conn, ref) do
    case sent_response(ref) do
      nil ->
        %{status: status || 500, body: decode_body(conn.resp_body)}

      response ->
        response
    end
  end

  # When the endpoint renders an error page for an exception, the response
  # has already been sent through the test adapter before the exception is
  # re-raised.
  defp sent_response(ref) do
    receive do
      {^ref, {status, _headers, body}} -> %{status: status, body: decode_body(body)}
    after
      0 -> nil
    end
  end

  defp exception_response(%Plug.Conn.WrapperError{reason: reason}),
    do: exception_response(reason)

  defp exception_response(exception) do
    status = Plug.Exception.status(exception)

    if status >= 500 do
      Logger.error("MCP dispatch failed: " <> Exception.message(exception))
    end

    %{status: status, body: %{"error" => error_message(status)}}
  end

  defp error_message(404), do: "Not found"
  defp error_message(status) when status >= 500, do: "Internal server error"
  defp error_message(_status), do: "Bad request"

  defp decode_body(nil), do: nil
  defp decode_body(""), do: nil

  defp decode_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> decoded
      {:error, _} -> body
    end
  end

  defp decode_body(body) when is_list(body), do: body |> IO.iodata_to_binary() |> decode_body()
  defp decode_body(body), do: body

  # The test adapter notifies the owner process when a response is sent;
  # discard those messages so they do not leak into the caller's mailbox.
  defp flush_sent_messages(ref) do
    receive do
      {^ref, _} -> flush_sent_messages(ref)
      {:plug_conn, :sent} -> flush_sent_messages(ref)
    after
      0 -> :ok
    end
  end
end

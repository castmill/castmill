defmodule CastmillWeb.FeedApiController do
  @moduledoc """
  Write API for data feeds (`/api/v1/feeds`), for Make, Zapier and scripts.

  Authentication (`Authorization: Bearer <token>`):

    * a feed token (`cmfeed_…`) writes to its own feed only;
    * a member token (an organization member's access token or an AI agent
      token) writes to every feed its role allows (`feeds: :update`).

  Requests are logged with the feed, the credential's id and the result, never
  with the token or the body.
  """
  use CastmillWeb, :controller

  require Logger

  alias Castmill.{Feeds, Organizations}
  alias Castmill.Feeds.Feed

  plug(:authenticate)

  @token_limit_per_minute 120
  @feed_limit_per_minute 240

  # POST /api/v1/feeds/:id/entries
  def append(conn, %{"id" => id}) do
    with {:ok, feed} <- authorize(conn, id, :update),
         :ok <- rate_limit(conn, feed) do
      result = Feeds.append_entries(feed, entries_from_body(conn.body_params))
      respond(conn, feed, :append, result, :created)
    end
    |> handle_error(conn)
  end

  # POST /api/v1/feeds/entries — the same entry to several feeds.
  def append_many(conn, _params) do
    body = conn.body_params

    with {:member, _user_id} <- member_or_error(conn),
         ids when is_list(ids) and ids != [] <- body["feeds"] || {:error, :no_feeds},
         entry when is_map(entry) <- body["entry"] || {:error, :missing_entry},
         {:ok, feeds} <- authorize_all(conn, ids),
         :ok <- Enum.reduce_while(feeds, :ok, &rate_limit_reducer(conn, &1, &2)) do
      case Feeds.append_to_feeds(feeds, entry) do
        {:ok, results} ->
          Enum.each(results, &log(conn, &1.feed_id, :append_many, :ok))
          conn |> put_status(:created) |> json(%{feeds: results})

        error ->
          error
      end
    end
    |> handle_error(conn)
  end

  # PUT /api/v1/feeds/:id/data
  def replace(conn, %{"id" => id}) do
    with {:ok, feed} <- authorize(conn, id, :update),
         :ok <- rate_limit(conn, feed) do
      respond(conn, feed, :replace, Feeds.replace_data(feed, conn.body_params), :ok)
    end
    |> handle_error(conn)
  end

  # DELETE /api/v1/feeds/:id/entries/:entry_id
  def delete_entry(conn, %{"id" => id, "entry_id" => entry_id}) do
    with {:ok, feed} <- authorize(conn, id, :update),
         :ok <- rate_limit(conn, feed),
         {:ok, _feed} <- Feeds.delete_entry(feed, entry_id) do
      log(conn, feed.id, :delete_entry, :ok)
      send_resp(conn, :no_content, "")
    end
    |> handle_error(conn)
  end

  # DELETE /api/v1/feeds/:id/entries
  def clear(conn, %{"id" => id}) do
    with {:ok, feed} <- authorize(conn, id, :update),
         :ok <- rate_limit(conn, feed),
         {:ok, _feed} <- Feeds.clear(feed) do
      log(conn, feed.id, :clear, :ok)
      send_resp(conn, :no_content, "")
    end
    |> handle_error(conn)
  end

  # GET /api/v1/feeds/:id
  def show(conn, %{"id" => id}) do
    with {:ok, feed} <- authorize(conn, id, :show),
         :ok <- rate_limit(conn, feed) do
      json(conn, %{
        id: feed.id,
        name: feed.name,
        mode: feed.mode,
        keep: feed.keep,
        version: feed.version,
        data: Feeds.data(feed)
      })
    end
    |> handle_error(conn)
  end

  # A JSON array, or a body with only an "entries" list, is a batch; any other
  # object is one entry.
  defp entries_from_body(%{"entries" => entries} = body)
       when is_list(entries) and map_size(body) == 1,
       do: entries

  defp entries_from_body(%{"_json" => entries}) when is_list(entries), do: entries
  defp entries_from_body(%{"_json" => _}), do: :invalid
  defp entries_from_body(body) when is_map(body) and map_size(body) > 0, do: [body]
  defp entries_from_body(_body), do: []

  defp respond(conn, feed, action, {:ok, result}, status) do
    log(conn, feed.id, action, :ok)
    conn |> put_status(status) |> json(Map.put(result, :feed_id, feed.id))
  end

  defp respond(conn, feed, action, {:error, reason} = error, _status) do
    log(conn, feed.id, action, reason)
    error
  end

  # --- authentication ---------------------------------------------------------

  defp authenticate(conn, _opts) do
    with {:ok, secret} <- bearer_token(conn),
         {:ok, credential} <- resolve(secret, Utils.RemoteIp.get(conn)) do
      assign(conn, :feed_credential, credential)
    else
      {:error, {:blocked, message}} ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden", message: message}) |> halt()

      _ ->
        conn
        |> put_resp_header("www-authenticate", ~s(Bearer realm="castmill-feeds"))
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized", message: "A valid bearer token is required"})
        |> halt()
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] when token != "" -> {:ok, String.trim(token)}
      _ -> {:error, :missing_token}
    end
  end

  defp resolve(secret, source_ip) do
    feed_prefix = Feeds.token_prefix()
    agent_prefix = Castmill.Agents.secret_prefix()

    case secret do
      ^feed_prefix <> _ ->
        with {:ok, token} <- Feeds.authenticate_token(secret),
             do: {:ok, {:feed_token, token}}

      ^agent_prefix <> _ ->
        with {:ok, agent} <- Castmill.Agents.authenticate(secret, source_ip),
             :ok <- check_blocked(agent.user),
             do: {:ok, {:member, agent.user_id}}

      _ ->
        with {:ok, user} <- Castmill.Accounts.get_user_by_access_token(secret, source_ip),
             :ok <- check_blocked(user),
             do: {:ok, {:member, user.id}}
    end
  end

  defp check_blocked(user) do
    case CastmillWeb.SessionUtils.check_user_blocked_status(user) do
      {:ok, _user} -> :ok
      {:error, {_reason, message}} -> {:error, {:blocked, message}}
      {:error, reason} -> {:error, reason}
    end
  end

  # --- authorization ----------------------------------------------------------

  defp authorize(conn, id, action) do
    case conn.assigns.feed_credential do
      {:feed_token, token} ->
        # Feed tokens can read and write their own feed only.
        if token.feed_id == id,
          do: {:ok, token.feed},
          else: {:error, :forbidden}

      {:member, user_id} ->
        case Feeds.get_feed(id) do
          %Feed{} = feed ->
            if Organizations.has_access(feed.organization_id, user_id, "feeds", action),
              do: {:ok, feed},
              else: {:error, :forbidden}

          nil ->
            {:error, :not_found}
        end
    end
  end

  defp authorize_all(conn, ids) do
    if length(ids) > Feeds.max_batch() do
      {:error, :too_many_feeds}
    else
      Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, acc} ->
        case is_binary(id) && authorize(conn, id, :update) do
          {:ok, feed} -> {:cont, {:ok, acc ++ [feed]}}
          {:error, reason} -> {:halt, {:error, reason}}
          false -> {:halt, {:error, :not_found}}
        end
      end)
    end
  end

  defp member_or_error(conn) do
    case conn.assigns.feed_credential do
      {:member, _} = member -> member
      _ -> {:error, :member_token_required}
    end
  end

  # --- rate limiting ----------------------------------------------------------

  defp rate_limit(conn, feed) do
    with :ok <- Castmill.RateLimiter.allow(credential_key(conn), limit(:token)),
         :ok <- Castmill.RateLimiter.allow({:feed, feed.id}, limit(:feed)) do
      :ok
    end
  end

  defp rate_limit_reducer(conn, feed, :ok) do
    case rate_limit(conn, feed) do
      :ok -> {:cont, :ok}
      error -> {:halt, error}
    end
  end

  defp limit(:token),
    do: config()[:token_limit_per_minute] || @token_limit_per_minute

  defp limit(:feed),
    do: config()[:feed_limit_per_minute] || @feed_limit_per_minute

  defp config, do: Application.get_env(:castmill, __MODULE__, [])

  defp credential_key(conn) do
    case conn.assigns.feed_credential do
      {:feed_token, token} -> {:feed_token, token.id}
      {:member, user_id} -> {:feed_member, user_id}
    end
  end

  # --- responses --------------------------------------------------------------

  defp log(conn, feed_id, action, result) do
    credential =
      case conn.assigns.feed_credential do
        {:feed_token, token} -> "feed_token:#{token.id}"
        {:member, user_id} -> "member:#{user_id}"
      end

    Logger.info(
      "Feed API #{action} feed=#{feed_id} credential=#{credential} result=#{inspect(result)} " <>
        "bytes=#{conn |> get_req_header("content-length") |> List.first("0")}"
    )
  end

  defp handle_error(%Plug.Conn{} = conn, _conn), do: conn

  defp handle_error({:error, reason}, conn) do
    {status, body} = error_body(reason)
    conn |> put_status(status) |> json(body)
  end

  defp handle_error(other, conn), do: handle_error({:error, other}, conn)

  defp error_body(:not_found), do: {:not_found, %{error: "not_found", message: "Feed not found"}}

  defp error_body(:forbidden),
    do: {:forbidden, %{error: "forbidden", message: "This token can't access the feed"}}

  defp error_body(:member_token_required),
    do:
      {:forbidden,
       %{error: "forbidden", message: "Writing to several feeds needs a member token"}}

  defp error_body(:rate_limited),
    do: {:too_many_requests, %{error: "rate_limited", message: "Too many requests"}}

  defp error_body(:not_a_list_feed),
    do:
      {:bad_request,
       %{error: "not_a_list_feed", message: "Entries can only be added to list feeds"}}

  defp error_body({:not_a_list_feed, feed_id}),
    do:
      {:bad_request,
       %{
         error: "not_a_list_feed",
         message: "Feed #{feed_id} is not a list feed",
         feed_id: feed_id
       }}

  defp error_body(:no_entries),
    do: {:bad_request, %{error: "invalid_entry", message: "No entries were sent"}}

  defp error_body(:too_many_entries),
    do:
      {:request_entity_too_large,
       %{error: "too_many_entries", message: "At most #{Feeds.max_batch()} entries per request"}}

  defp error_body(:no_feeds),
    do: {:bad_request, %{error: "invalid_request", message: ~s(Expected "feeds": [feed ids])}}

  defp error_body(:too_many_feeds),
    do:
      {:bad_request,
       %{error: "invalid_request", message: "At most #{Feeds.max_batch()} feeds per request"}}

  defp error_body(:missing_entry),
    do: {:bad_request, %{error: "invalid_request", message: ~s(Expected "entry": {...})}}

  defp error_body({:entry_too_large, index}),
    do:
      {:request_entity_too_large,
       %{
         error: "entry_too_large",
         message: "Entries can be at most #{div(Feeds.max_entry_bytes(), 1024)} KB",
         index: index
       }}

  defp error_body(:document_too_large),
    do:
      {:request_entity_too_large,
       %{
         error: "document_too_large",
         message: "Documents can be at most #{div(Feeds.max_document_bytes(), 1024)} KB"
       }}

  defp error_body({:schema_mismatch, index, message}),
    do: {:bad_request, %{error: "schema_mismatch", message: message, index: index}}

  defp error_body({:invalid_entry, index, message}),
    do: {:bad_request, %{error: "invalid_entry", message: message, index: index}}

  defp error_body({:feed, feed_id, reason}) do
    {status, body} = error_body(reason)
    {status, Map.put(body, :feed_id, feed_id)}
  end

  defp error_body(_reason),
    do: {:bad_request, %{error: "invalid_request", message: "The request could not be processed"}}
end

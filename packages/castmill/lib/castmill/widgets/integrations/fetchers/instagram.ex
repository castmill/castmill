defmodule Castmill.Widgets.Integrations.Fetchers.Instagram do
  @moduledoc """
  Instagram Graph API fetcher for the Instagram Feed widget.

  Fetches a user's recent media posts (images and videos) using an access
  token obtained via the generic widget OAuth flow.

  The OAuth code exchange yields a short-lived (1 hour) token, which the
  fetcher exchanges for a long-lived (60 day) token on first use.  Long-lived
  tokens are refreshed when they have less than 7 days remaining.  Updated
  credentials are returned so callers can persist them.

  ## Credentials

  - `access_token`  – Instagram access token.
  - `expires_at`    – Unix timestamp (seconds) when the token expires, as stored
                      by the generic OAuth flow.  The legacy `token_expires_at`
                      key is still honoured.
  - `long_lived`    – `true` once the token has been exchanged for a long-lived one.
  - `client_secret` – Instagram App Secret, required for the long-lived exchange.

  ## Options

  - `max_posts` – Maximum number of recent posts to return (default: 10, max: 30).

  ## Data Schema

  Returns a map matching the widget's `data_schema`:

  ```json
  {
    "posts": [
      {
        "id": "...",
        "media_type": "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
        "media_url": "https://...",
        "thumbnail_url": "https://...",
        "caption": "...",
        "timestamp": "2024-01-01T00:00:00+0000",
        "timestamp_formatted": "Jan 1, 2024",
        "permalink": "https://www.instagram.com/p/..."
      }
    ],
    "username": "...",
    "last_updated": 1703001600
  }
  ```
  """

  @behaviour Castmill.Widgets.Integrations.Fetcher

  require Logger

  @graph_base "https://graph.instagram.com"
  @media_fields "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink"
  # Refresh threshold: refresh token if it expires within 7 days
  @refresh_threshold_seconds 7 * 24 * 60 * 60
  # Short-lived tokens last 1 hour; anything valid for longer than a day is long-lived
  @long_lived_min_seconds 24 * 60 * 60
  @default_max_posts 10
  @max_allowed_posts 30

  @doc """
  Fetches recent media from the authenticated user's Instagram account.

  Exchanges short-lived tokens for long-lived ones and refreshes long-lived
  tokens that expire within 7 days.

  ## Parameters

    - `credentials` – Map with `access_token` and optionally `expires_at`,
                      `long_lived` and `client_secret`.
    - `options`     – Map with `max_posts` (integer, default: 10).

  ## Returns

    - `{:ok, data, updated_credentials}` on success.
    - `{:error, reason, credentials}` on failure.
  """
  @impl true
  def fetch(credentials, options) do
    access_token = Map.get(credentials, "access_token")

    if !access_token || access_token == "" do
      {:error, :missing_access_token, credentials}
    else
      credentials = maybe_renew_token(credentials)
      max_posts = parse_max_posts(Map.get(options, "max_posts", @default_max_posts))

      case fetch_media(credentials["access_token"], max_posts) do
        {:ok, media_data} ->
          username = fetch_username(credentials["access_token"])
          data = build_response(media_data, username)
          {:ok, data, credentials}

        {:error, :unauthorized} ->
          Logger.error("Instagram: access token is invalid or expired")
          {:error, :unauthorized, credentials}

        {:error, reason} ->
          Logger.error("Instagram API error: #{inspect(reason)}")
          {:error, reason, credentials}
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Token refresh
  # ---------------------------------------------------------------------------

  @doc false
  # Decides how the access token must be renewed before fetching:
  #   * `:exchange` – short-lived OAuth token, exchange it for a long-lived one
  #   * `:refresh`  – long-lived token expiring within the refresh threshold
  #   * `:none`     – token is fine (or its expiry is unknown)
  def token_action(credentials, now \\ System.system_time(:second)) do
    expires_at = token_expires_at(credentials)

    cond do
      is_nil(expires_at) ->
        :none

      not long_lived?(credentials, expires_at, now) ->
        if present?(Map.get(credentials, "client_secret")), do: :exchange, else: :none

      now >= expires_at - @refresh_threshold_seconds ->
        :refresh

      true ->
        :none
    end
  end

  defp token_expires_at(credentials) do
    case Map.get(credentials, "expires_at") || Map.get(credentials, "token_expires_at") do
      ts when is_integer(ts) ->
        ts

      ts when is_float(ts) ->
        trunc(ts)

      ts when is_binary(ts) ->
        case Integer.parse(ts) do
          {value, _} -> value
          :error -> nil
        end

      _ ->
        nil
    end
  end

  # Tokens stored under the legacy `token_expires_at` key were always long-lived.
  defp long_lived?(credentials, expires_at, now) do
    Map.get(credentials, "long_lived") == true or
      Map.has_key?(credentials, "token_expires_at") or
      expires_at - now > @long_lived_min_seconds
  end

  defp present?(value), do: is_binary(value) and value != ""

  defp maybe_renew_token(credentials) do
    access_token = Map.get(credentials, "access_token")

    result =
      case token_action(credentials) do
        :exchange -> exchange_token(access_token, Map.get(credentials, "client_secret"))
        :refresh -> refresh_token(access_token)
        :none -> :unchanged
      end

    case result do
      {:ok, new_token, new_expires_at} ->
        Logger.info("Instagram: long-lived access token renewed successfully")

        credentials
        |> Map.delete("token_expires_at")
        |> Map.merge(%{
          "access_token" => new_token,
          "expires_at" => new_expires_at,
          "long_lived" => true
        })

      {:error, reason} ->
        Logger.error("Instagram: token renewal failed: #{inspect(reason)}")
        credentials

      :unchanged ->
        credentials
    end
  end

  # Exchanges a short-lived token for a long-lived (60 day) token
  defp exchange_token(access_token, client_secret) do
    query =
      URI.encode_query(%{
        "grant_type" => "ig_exchange_token",
        "client_secret" => client_secret,
        "access_token" => access_token
      })

    request_token("#{@graph_base}/access_token?#{query}")
  end

  # Refreshes a long-lived token, extending it by another 60 days
  defp refresh_token(access_token) do
    query =
      URI.encode_query(%{
        "grant_type" => "ig_refresh_token",
        "access_token" => access_token
      })

    request_token("#{@graph_base}/refresh_access_token?#{query}")
  end

  defp request_token(url) do
    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get(url, headers, recv_timeout: 15_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"access_token" => new_token, "expires_in" => expires_in}}
          when is_integer(expires_in) ->
            {:ok, new_token, System.system_time(:second) + expires_in}

          {:ok, _response} ->
            {:error, "Unexpected token response"}

          {:error, reason} ->
            {:error, "JSON decode error: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, "Token request HTTP #{status}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Network error: #{inspect(reason)}"}
    end
  end

  # ---------------------------------------------------------------------------
  # Media fetching
  # ---------------------------------------------------------------------------

  defp fetch_media(access_token, max_posts) do
    url =
      "#{@graph_base}/me/media" <>
        "?fields=#{@media_fields}" <>
        "&limit=#{max_posts}" <>
        "&access_token=#{URI.encode(access_token)}"

    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get(url, headers, recv_timeout: 15_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"data" => posts}} when is_list(posts) ->
            {:ok, posts}

          {:ok, %{"error" => %{"message" => message}}} ->
            {:error, message}

          {:ok, _other} ->
            {:error, :unexpected_response}

          {:error, reason} ->
            {:error, "JSON decode error: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: 401}} ->
        {:error, :unauthorized}

      {:ok, %HTTPoison.Response{status_code: 429}} ->
        {:error, :rate_limited}

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "HTTP #{status}: #{body}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Network error: #{inspect(reason)}"}
    end
  end

  defp fetch_username(access_token) do
    url =
      "#{@graph_base}/me?fields=username&access_token=#{URI.encode(access_token)}"

    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get(url, headers, recv_timeout: 10_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"username" => username}} -> username
          _ -> ""
        end

      _ ->
        ""
    end
  end

  # ---------------------------------------------------------------------------
  # Data transformation
  # ---------------------------------------------------------------------------

  defp build_response(posts, username) do
    transformed =
      Enum.map(posts, fn post ->
        %{
          "id" => post["id"],
          "media_type" => post["media_type"] || "IMAGE",
          "media_url" => post["media_url"] || "",
          "thumbnail_url" => post["thumbnail_url"] || post["media_url"] || "",
          "caption" => post["caption"] || "",
          "timestamp" => post["timestamp"] || "",
          "timestamp_formatted" => format_timestamp(post["timestamp"]),
          "permalink" => post["permalink"] || "",
          "username" => username
        }
      end)

    %{
      "posts" => transformed,
      "username" => username,
      "last_updated" => System.system_time(:second)
    }
  end

  @doc false
  def format_timestamp(nil), do: ""

  @doc false
  def format_timestamp(ts) when is_binary(ts) do
    case DateTime.from_iso8601(ts) do
      {:ok, dt, _offset} ->
        "#{month_abbr(dt.month)} #{dt.day}, #{dt.year}"

      _ ->
        ts
    end
  end

  @doc false
  def format_timestamp(_), do: ""

  defp month_abbr(1), do: "Jan"
  defp month_abbr(2), do: "Feb"
  defp month_abbr(3), do: "Mar"
  defp month_abbr(4), do: "Apr"
  defp month_abbr(5), do: "May"
  defp month_abbr(6), do: "Jun"
  defp month_abbr(7), do: "Jul"
  defp month_abbr(8), do: "Aug"
  defp month_abbr(9), do: "Sep"
  defp month_abbr(10), do: "Oct"
  defp month_abbr(11), do: "Nov"
  defp month_abbr(12), do: "Dec"

  defp parse_max_posts(value) when is_integer(value) do
    value |> max(1) |> min(@max_allowed_posts)
  end

  defp parse_max_posts(value) when is_binary(value) do
    case Integer.parse(value) do
      {n, _} -> parse_max_posts(n)
      :error -> @default_max_posts
    end
  end

  defp parse_max_posts(_), do: @default_max_posts
end

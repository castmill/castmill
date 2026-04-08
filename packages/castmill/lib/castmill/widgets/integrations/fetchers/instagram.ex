defmodule Castmill.Widgets.Integrations.Fetchers.Instagram do
  @moduledoc """
  Instagram Graph API fetcher for the Instagram Feed widget.

  Fetches a user's recent media posts (images and videos) using a long-lived
  access token obtained via the Instagram Basic Display API OAuth flow.

  Long-lived tokens last 60 days and can be refreshed before expiry by calling
  the refresh endpoint.  The fetcher automatically refreshes the token when it
  has less than 7 days remaining.

  ## Credentials

  - `access_token`   – Long-lived Instagram access token.
  - `token_expires_at` – Unix timestamp (seconds) when the token expires.
                         Stored so that the fetcher can schedule refreshes.

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
  @default_max_posts 10
  @max_allowed_posts 30

  @doc """
  Fetches recent media from the authenticated user's Instagram account.

  Automatically refreshes the long-lived token if it expires within 7 days.

  ## Parameters

    - `credentials` – Map with `access_token` and optionally `token_expires_at`.
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
      credentials = maybe_refresh_token(credentials)
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

  defp maybe_refresh_token(credentials) do
    expires_at = Map.get(credentials, "token_expires_at")
    access_token = Map.get(credentials, "access_token")

    should_refresh =
      case expires_at do
        nil ->
          false

        ts when is_number(ts) ->
          System.system_time(:second) >= ts - @refresh_threshold_seconds
      end

    if should_refresh do
      case refresh_token(access_token) do
        {:ok, new_token, new_expires_at} ->
          Logger.info("Instagram: long-lived token refreshed successfully")

          Map.merge(credentials, %{
            "access_token" => new_token,
            "token_expires_at" => new_expires_at
          })

        {:error, reason} ->
          Logger.error("Instagram: token refresh failed: #{inspect(reason)}")
          credentials
      end
    else
      credentials
    end
  end

  defp refresh_token(access_token) do
    url =
      "#{@graph_base}/refresh_access_token" <>
        "?grant_type=ig_refresh_token&access_token=#{URI.encode(access_token)}"

    headers = [{"Accept", "application/json"}, {"User-Agent", "Castmill/1.0"}]

    case HTTPoison.get(url, headers, recv_timeout: 15_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"access_token" => new_token, "expires_in" => expires_in}} ->
            new_expires_at = System.system_time(:second) + expires_in
            {:ok, new_token, new_expires_at}

          {:ok, response} ->
            {:error, "Unexpected refresh response: #{inspect(response)}"}

          {:error, reason} ->
            {:error, "JSON decode error: #{inspect(reason)}"}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "Token refresh HTTP #{status}: #{body}"}

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

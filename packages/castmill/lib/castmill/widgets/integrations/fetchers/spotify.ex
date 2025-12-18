defmodule Castmill.Widgets.Integrations.Fetchers.Spotify do
  @moduledoc """
  Spotify Web API fetcher for Now Playing widget.

  Handles OAuth 2.0 authentication, token refresh, and fetches currently playing track data.
  Transforms Spotify API response to match widget's data_schema.

  ## OAuth 2.0 Flow

  1. User authorizes via Spotify OAuth (handled by dashboard)
  2. Backend exchanges authorization code for access_token + refresh_token
  3. Credentials stored (encrypted) with expiration timestamp
  4. This fetcher automatically refreshes tokens when they expire

  ## Required Credentials

  - `client_id`: Spotify OAuth client ID
  - `client_secret`: Spotify OAuth client secret
  - `access_token`: Current OAuth access token
  - `refresh_token`: OAuth refresh token for renewing access
  - `expires_at`: Unix timestamp when access_token expires

  ## Data Schema

  Returns data matching the Spotify Now Playing widget's data_schema:

  - `track_name`: Name of the currently playing track
  - `artist_name`: Artist name(s), comma-separated
  - `album_name`: Album name
  - `album_art_url`: URL to album artwork (640x640 preferred)
  - `duration_ms`: Track duration in milliseconds
  - `duration_formatted`: Track duration as "MM:SS"
  - `progress_ms`: Current playback position in milliseconds
  - `progress_formatted`: Current position as "MM:SS"
  - `progress_percent`: Playback progress as percentage string
  - `is_playing`: Boolean indicating if track is currently playing
  """
  @behaviour Castmill.Widgets.Integrations.Fetcher

  require Logger

  @api_base "https://api.spotify.com/v1"
  @token_endpoint "https://accounts.spotify.com/api/token"

  @doc """
  Fetches currently playing track from Spotify API.

  Automatically refreshes OAuth token if expired.
  Returns data matching the widget's data_schema and updated credentials (if token was refreshed).

  ## Parameters

  - `credentials`: Map containing OAuth tokens and client credentials
  - `options`: Widget configuration options (currently unused)

  ## Returns

  - `{:ok, data, updated_credentials}`: Success with track data and possibly refreshed credentials
  - `{:error, reason, credentials}`: Error with reason and current credentials

  ## Examples

      iex> credentials = %{
      ...>   "access_token" => "BQD...",
      ...>   "refresh_token" => "AQD...",
      ...>   "client_id" => "abc123",
      ...>   "client_secret" => "xyz789",
      ...>   "expires_at" => 1234567890
      ...> }
      iex> Spotify.fetch(credentials, %{})
      {:ok, %{"track_name" => "Bohemian Rhapsody", ...}, updated_credentials}
  """
  @impl true
  def fetch(credentials, _options) do
    # Check if token needs refresh (if expires in next 5 minutes)
    credentials = maybe_refresh_token(credentials)

    # Fetch currently playing track
    case fetch_currently_playing(credentials) do
      {:ok, track_data} ->
        data = transform_to_widget_data(track_data)
        {:ok, data, credentials}

      {:error, :no_track_playing} ->
        # Not an error - just nothing playing right now
        data = get_no_track_data()
        {:ok, data, credentials}

      {:error, :unauthorized} ->
        # Token invalid - try refresh
        case refresh_access_token(credentials) do
          {:ok, new_credentials} ->
            # Retry with new token
            case fetch_currently_playing(new_credentials) do
              {:ok, track_data} ->
                {:ok, transform_to_widget_data(track_data), new_credentials}

              error ->
                Logger.error("Spotify API error after token refresh: #{inspect(error)}")
                {:error, :api_error, new_credentials}
            end

          {:error, reason} ->
            Logger.error("Spotify token refresh failed: #{inspect(reason)}")
            {:error, :token_refresh_failed, credentials}
        end

      {:error, {:rate_limited, retry_after}} ->
        Logger.warning("Spotify API rate limited, retry after #{retry_after}s")
        {:error, {:rate_limited, retry_after}, credentials}

      {:error, reason} ->
        Logger.error("Spotify API error: #{inspect(reason)}")
        {:error, reason, credentials}
    end
  end

  # Private functions

  defp maybe_refresh_token(credentials) do
    expires_at = Map.get(credentials, "expires_at", 0)
    current_time = System.system_time(:second)

    # Refresh if token expires in next 5 minutes
    if current_time >= (expires_at - 300) do
      case refresh_access_token(credentials) do
        {:ok, new_credentials} ->
          Logger.info("Spotify token refreshed successfully")
          new_credentials

        {:error, reason} ->
          Logger.error("Token refresh failed: #{inspect(reason)}")
          credentials
      end
    else
      credentials
    end
  end

  defp refresh_access_token(credentials) do
    refresh_token = Map.get(credentials, "refresh_token")
    client_id = Map.get(credentials, "client_id")
    client_secret = Map.get(credentials, "client_secret")

    if !refresh_token || !client_id || !client_secret do
      {:error, :missing_credentials}
    else
      headers = [
        {"Content-Type", "application/x-www-form-urlencoded"},
        {"Authorization", "Basic " <> Base.encode64("#{client_id}:#{client_secret}")}
      ]

      body = URI.encode_query(%{
        "grant_type" => "refresh_token",
        "refresh_token" => refresh_token
      })

      case HTTPoison.post(@token_endpoint, body, headers) do
        {:ok, %{status_code: 200, body: response_body}} ->
          response = Jason.decode!(response_body)

          new_credentials = Map.merge(credentials, %{
            "access_token" => response["access_token"],
            "expires_at" => System.system_time(:second) + response["expires_in"]
          })

          {:ok, new_credentials}

        {:ok, %{status_code: status, body: body}} ->
          {:error, "Token refresh failed: #{status} - #{body}"}

        {:error, reason} ->
          {:error, "HTTP request failed: #{inspect(reason)}"}
      end
    end
  end

  defp fetch_currently_playing(credentials) do
    access_token = Map.get(credentials, "access_token")

    if !access_token do
      {:error, :missing_access_token}
    else
      headers = [
        {"Authorization", "Bearer #{access_token}"},
        {"Content-Type", "application/json"}
      ]

      case HTTPoison.get("#{@api_base}/me/player/currently-playing", headers) do
        {:ok, %{status_code: 200, body: body}} ->
          data = Jason.decode!(body)

          if data["item"] do
            {:ok, data}
          else
            {:error, :no_track_playing}
          end

        {:ok, %{status_code: 204}} ->
          # 204 No Content = nothing playing
          {:error, :no_track_playing}

        {:ok, %{status_code: 401}} ->
          {:error, :unauthorized}

        {:ok, %{status_code: 429, headers: headers}} ->
          # Rate limited
          retry_after = get_header(headers, "retry-after", "60")
          {:error, {:rate_limited, String.to_integer(retry_after)}}

        {:ok, %{status_code: status, body: body}} ->
          {:error, "API error: #{status} - #{body}"}

        {:error, reason} ->
          {:error, "HTTP request failed: #{inspect(reason)}"}
      end
    end
  end

  defp transform_to_widget_data(spotify_data) do
    item = spotify_data["item"]
    progress_ms = spotify_data["progress_ms"] || 0
    duration_ms = item["duration_ms"]
    is_playing = spotify_data["is_playing"]

    # Get largest album artwork
    album_art = item["album"]["images"]
    |> Enum.sort_by(& &1["height"], :desc)
    |> List.first()

    # Format artist names
    artists = item["artists"]
    |> Enum.map(& &1["name"])
    |> Enum.join(", ")

    # Include timestamp for client-side progress interpolation
    # The client can calculate: current_progress = progress_ms + (Date.now() - timestamp)
    # This allows smooth progress bar updates without constant polling
    timestamp = System.system_time(:millisecond)

    %{
      "track_name" => item["name"],
      "artist_name" => artists,
      "album_name" => item["album"]["name"],
      "album_art_url" => album_art["url"],
      "duration_ms" => duration_ms,
      "duration_formatted" => format_time(duration_ms),
      "progress_ms" => progress_ms,
      "progress_formatted" => format_time(progress_ms),
      "progress_percent" => "#{Float.round(progress_ms / duration_ms * 100, 1)}%",
      "is_playing" => is_playing,
      # Timestamp when this data was fetched - used for client-side interpolation
      "timestamp" => timestamp
    }
  end

  defp get_no_track_data do
    %{
      "track_name" => "No track playing",
      "artist_name" => "Spotify",
      "album_name" => "",
      "album_art_url" => "/widgets/spotify-now-playing/placeholder.png",
      "duration_ms" => 0,
      "duration_formatted" => "0:00",
      "progress_ms" => 0,
      "progress_formatted" => "0:00",
      "progress_percent" => "0%",
      "is_playing" => false,
      "timestamp" => System.system_time(:millisecond)
    }
  end

  defp format_time(ms) when is_number(ms) do
    total_seconds = div(ms, 1000)
    minutes = div(total_seconds, 60)
    seconds = rem(total_seconds, 60)
    "#{minutes}:#{String.pad_leading(Integer.to_string(seconds), 2, "0")}"
  end

  defp format_time(_), do: "0:00"

  defp get_header(headers, key, default) do
    headers
    |> Enum.find(fn {k, _v} -> String.downcase(k) == String.downcase(key) end)
    |> case do
      {_k, v} -> v
      nil -> default
    end
  end
end

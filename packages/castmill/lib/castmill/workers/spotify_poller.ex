defmodule Castmill.Workers.SpotifyPoller do
  @moduledoc """
  Oban worker that polls Spotify's API to fetch currently playing track data.

  This worker is scheduled periodically for each widget config that uses the
  Spotify integration. It fetches the currently playing track and updates
  the widget_integration_data table.

  ## Known Limitations (TODO for production)

  Currently, each widget_config has its own poller, but when using organization-scoped
  credentials, all widgets in an org share the same Spotify account. This means:
  - N widgets = N redundant API calls for the same data
  - All widgets show the same song anyway

  Future improvement: Poll at (organization_id, integration_id) level instead,
  and have widget_configs share the cached data.

  ## Scheduling

  Jobs are scheduled when:
  - A user completes Spotify OAuth and credentials are stored
  - The application starts (for existing configs with valid credentials)

  Jobs reschedule themselves after completion based on the integration's
  `pull_interval_seconds` setting.

  ## Error Handling

  - Token expired: Attempts to refresh using refresh_token
  - Token refresh failed: Marks credentials as invalid, stops polling
  - HTTP errors: Retries with exponential backoff (Oban default)
  - No track playing: Stores "not_playing" status
  """
  use Oban.Worker,
    queue: :integration_polling,
    max_attempts: 3,
    # Unique constraint based on widget_config_id OR organization_id
    # period: 10 allows scheduling next job immediately after completion
    unique: [period: 10, states: [:available, :scheduled, :executing]]

  require Logger
  import Ecto.Query

  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.OAuth.Spotify, as: SpotifyOAuth

  @spotify_currently_playing_url "https://api.spotify.com/v1/me/player/currently-playing"

  # Default polling interval (30 seconds) if not specified in integration
  @default_poll_interval_seconds 30

  @doc """
  Schedules a Spotify polling job for an organization.

  This is the preferred method when credentials are organization-scoped.
  All widgets in the org will share the same polling data.

  ## Parameters

    - organization_id: The organization ID
    - opts: Optional scheduling options
      - :delay_seconds - Delay before first execution (default: 0)

  ## Examples

      iex> SpotifyPoller.schedule_for_org("org-uuid")
      {:ok, %Oban.Job{}}
  """
  def schedule_for_org(organization_id, opts \\ []) do
    delay_seconds = Keyword.get(opts, :delay_seconds, 0)

    result =
      %{organization_id: organization_id}
      |> new(schedule_in: delay_seconds)
      |> Oban.insert()

    case result do
      {:ok, %{conflict?: true}} ->
        Logger.warning("SpotifyPoller: Job already exists for organization_id=#{organization_id}")

      {:ok, job} ->
        Logger.info(
          "SpotifyPoller: Scheduled org poll in #{delay_seconds}s for org=#{organization_id} (job_id=#{job.id})"
        )

      {:error, reason} ->
        Logger.error("SpotifyPoller: Failed to schedule org job: #{inspect(reason)}")
    end

    result
  end

  @doc """
  Schedules a Spotify polling job for a widget config.

  ## Parameters

    - widget_config_id: The widget configuration ID
    - opts: Optional scheduling options
      - :delay_seconds - Delay before first execution (default: 0)
      - :poll_interval - Override poll interval in seconds

  ## Examples

      iex> SpotifyPoller.schedule("widget-config-uuid")
      {:ok, %Oban.Job{}}

      iex> SpotifyPoller.schedule("widget-config-uuid", delay_seconds: 30)
      {:ok, %Oban.Job{}}
  """
  def schedule(widget_config_id, opts \\ []) do
    delay_seconds = Keyword.get(opts, :delay_seconds, 0)

    result =
      %{widget_config_id: widget_config_id}
      |> new(schedule_in: delay_seconds)
      |> Oban.insert()

    case result do
      {:ok, %{conflict?: true}} ->
        Logger.warning(
          "SpotifyPoller: Job already exists for widget_config_id=#{widget_config_id}"
        )

      {:ok, job} ->
        Logger.info("SpotifyPoller: Scheduled next poll in #{delay_seconds}s (job_id=#{job.id})")

      {:error, reason} ->
        Logger.error("SpotifyPoller: Failed to schedule job: #{inspect(reason)}")
    end

    result
  end

  @doc """
  Cancels any scheduled polling jobs for a widget config.

  Call this when:
  - Widget config is deleted
  - Credentials are revoked or deleted
  - User disconnects Spotify
  """
  def cancel(widget_config_id) do
    from(j in Oban.Job,
      where: j.queue == "integration_polling",
      where: j.state in ["available", "scheduled", "retryable"],
      where: fragment("?->>'widget_config_id' = ?", j.args, ^widget_config_id)
    )
    |> Castmill.Repo.delete_all()
  end

  @doc """
  Cancels any scheduled polling jobs for an organization.
  """
  def cancel_for_org(organization_id) do
    from(j in Oban.Job,
      where: j.queue == "integration_polling",
      where: j.state in ["available", "scheduled", "retryable"],
      where: fragment("?->>'organization_id' = ?", j.args, ^organization_id)
    )
    |> Castmill.Repo.delete_all()
  end

  # Organization-level polling
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"organization_id" => organization_id}})
      when is_binary(organization_id) do
    Logger.info("SpotifyPoller: Polling for organization_id=#{organization_id}")

    with {:ok, integration, credentials} <- get_org_integration_and_credentials(organization_id),
         {:ok, valid_credentials} <-
           ensure_valid_token_for_org(organization_id, integration, credentials),
         {:ok, spotify_data} <- fetch_currently_playing(valid_credentials),
         {:ok, _data} <- store_org_integration_data(organization_id, integration.id, spotify_data) do
      # Schedule next poll
      poll_interval = integration.pull_interval_seconds || @default_poll_interval_seconds
      schedule_for_org(organization_id, delay_seconds: poll_interval)

      Logger.info(
        "SpotifyPoller: Successfully updated org data for organization_id=#{organization_id}"
      )

      :ok
    else
      {:error, :no_credentials} ->
        Logger.warning(
          "SpotifyPoller: No credentials for organization_id=#{organization_id}, stopping"
        )

        :ok

      {:error, :credentials_invalid} ->
        Logger.warning(
          "SpotifyPoller: Credentials invalid for organization_id=#{organization_id}, stopping"
        )

        :ok

      {:error, :token_refresh_failed} ->
        Logger.error("SpotifyPoller: Token refresh failed for organization_id=#{organization_id}")
        mark_org_credentials_invalid(organization_id)
        :ok

      {:error, reason} ->
        Logger.error(
          "SpotifyPoller: Error for organization_id=#{organization_id}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  # Widget config-level polling (fallback)
  def perform(%Oban.Job{args: %{"widget_config_id" => widget_config_id}}) do
    Logger.info("SpotifyPoller: Polling for widget_config_id=#{widget_config_id}")

    with {:ok, integration, credentials} <- get_integration_and_credentials(widget_config_id),
         {:ok, valid_credentials} <-
           ensure_valid_token(widget_config_id, integration, credentials),
         {:ok, spotify_data} <- fetch_currently_playing(valid_credentials),
         {:ok, _data} <- store_integration_data(widget_config_id, integration.id, spotify_data) do
      # Schedule next poll
      poll_interval = integration.pull_interval_seconds || @default_poll_interval_seconds
      schedule(widget_config_id, delay_seconds: poll_interval)

      Logger.info(
        "SpotifyPoller: Successfully updated data for widget_config_id=#{widget_config_id}"
      )

      :ok
    else
      {:error, :no_credentials} ->
        Logger.warning(
          "SpotifyPoller: No credentials for widget_config_id=#{widget_config_id}, stopping"
        )

        :ok

      {:error, :credentials_invalid} ->
        Logger.warning(
          "SpotifyPoller: Credentials invalid for widget_config_id=#{widget_config_id}, stopping"
        )

        :ok

      {:error, :token_refresh_failed} ->
        Logger.error(
          "SpotifyPoller: Token refresh failed for widget_config_id=#{widget_config_id}"
        )

        mark_credentials_invalid(widget_config_id)
        :ok

      {:error, reason} ->
        Logger.error(
          "SpotifyPoller: Error for widget_config_id=#{widget_config_id}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  # Get integration and credentials for the widget config
  defp get_integration_and_credentials(widget_config_id) do
    # Get the widget config to find the organization
    case Castmill.Widgets.get_organization_id_for_widget_config(widget_config_id) do
      nil ->
        {:error, :widget_config_not_found}

      organization_id ->
        # Get the Spotify integration (find by name)
        case get_spotify_integration() do
          nil ->
            {:error, :spotify_integration_not_found}

          integration ->
            # Try organization-scoped credentials first
            case Integrations.get_organization_credentials(organization_id, integration.id) do
              {:ok, credentials} ->
                {:ok, integration, credentials}

              {:error, :not_found} ->
                # Try widget-scoped credentials
                case Integrations.get_widget_credentials(widget_config_id, integration.id) do
                  {:ok, credentials} ->
                    {:ok, integration, credentials}

                  {:error, _} ->
                    {:error, :no_credentials}
                end

              {:error, _} ->
                {:error, :no_credentials}
            end
        end
    end
  end

  # Get integration and credentials for organization-level polling
  defp get_org_integration_and_credentials(organization_id) do
    case get_spotify_integration() do
      nil ->
        {:error, :spotify_integration_not_found}

      integration ->
        case Integrations.get_organization_credentials(organization_id, integration.id) do
          {:ok, credentials} ->
            {:ok, integration, credentials}

          {:error, _} ->
            {:error, :no_credentials}
        end
    end
  end

  defp get_spotify_integration do
    # Find the Spotify integration by name
    Integrations.list_integrations(name: "spotify")
    |> List.first()
  end

  # Ensure the access token is valid, refresh if needed
  defp ensure_valid_token(widget_config_id, integration, credentials) do
    expires_at = credentials["expires_at"] || 0

    if SpotifyOAuth.token_expired?(expires_at) do
      Logger.info("SpotifyPoller: Token expired, refreshing...")

      # Get organization ID first
      organization_id = Castmill.Widgets.get_organization_id_for_widget_config(widget_config_id)

      # Get client credentials from network level
      case Integrations.get_client_credentials(integration.id, organization_id) do
        {:ok, %{client_id: client_id, client_secret: client_secret}} ->
          # Use the new function that accepts credentials
          case SpotifyOAuth.refresh_token_with_credentials(
                 credentials["refresh_token"],
                 client_id,
                 client_secret
               ) do
            {:ok, new_tokens} ->
              # Update stored credentials with new tokens
              updated_credentials =
                Map.merge(credentials, %{
                  "access_token" => new_tokens.access_token,
                  "expires_at" => new_tokens.expires_at,
                  "refresh_token" => new_tokens[:refresh_token] || credentials["refresh_token"]
                })

              # Store updated credentials
              Integrations.upsert_organization_credentials(
                organization_id,
                integration.id,
                updated_credentials
              )

              {:ok, updated_credentials}

            {:error, reason} ->
              Logger.error("SpotifyPoller: Token refresh failed: #{inspect(reason)}")
              {:error, :token_refresh_failed}
          end

        {:error, reason} ->
          Logger.error("SpotifyPoller: Could not get client credentials: #{inspect(reason)}")
          {:error, :no_client_credentials}
      end
    else
      {:ok, credentials}
    end
  end

  # Fetch currently playing track from Spotify API
  defp fetch_currently_playing(credentials) do
    headers = [
      {"Authorization", "Bearer #{credentials["access_token"]}"},
      {"Content-Type", "application/json"}
    ]

    case HTTPoison.get(@spotify_currently_playing_url, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        parse_currently_playing(body)

      {:ok, %HTTPoison.Response{status_code: 204}} ->
        # No track currently playing - use empty strings to avoid template errors
        {:ok,
         %{
           "is_playing" => false,
           "track_name" => "Not Playing",
           "artist_name" => "",
           "album_name" => "",
           "album_art_url" => "",
           "progress_ms" => 0,
           "duration_ms" => 0,
           "progress_percent" => "0%",
           "progress_formatted" => "0:00",
           "duration_formatted" => "0:00",
           "remaining_seconds" => 0,
           "timestamp" => System.system_time(:millisecond)
         }}

      {:ok, %HTTPoison.Response{status_code: 401}} ->
        # Token expired or invalid
        {:error, :unauthorized}

      {:ok, %HTTPoison.Response{status_code: 403}} ->
        # Forbidden - user may have revoked access
        {:error, :forbidden}

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        Logger.error("SpotifyPoller: Unexpected status #{status}: #{body}")
        {:error, {:http_error, status}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("SpotifyPoller: HTTP error: #{inspect(reason)}")
        {:error, {:http_error, reason}}
    end
  end

  defp parse_currently_playing(body) do
    case Jason.decode(body) do
      {:ok, data} ->
        track = data["item"]

        if is_nil(track) do
          # Might be playing something that's not a track (podcast, etc.)
          {:ok,
           %{
             "is_playing" => data["is_playing"] || false,
             "track_name" => "Not Playing",
             "artist_name" => "",
             "album_name" => "",
             "album_art_url" => "",
             "progress_ms" => data["progress_ms"] || 0,
             "duration_ms" => 0,
             "progress_percent" => "0%",
             "progress_formatted" => "0:00",
             "duration_formatted" => "0:00",
             "remaining_seconds" => 0,
             "timestamp" => System.system_time(:millisecond)
           }}
        else
          # Extract album art (prefer 300x300 size)
          album_images = get_in(track, ["album", "images"]) || []
          album_art_url = get_preferred_image(album_images)

          # Extract artist names
          artists = track["artists"] || []
          artist_name = artists |> Enum.map(& &1["name"]) |> Enum.join(", ")

          progress_ms = data["progress_ms"] || 0
          duration_ms = track["duration_ms"] || 0

          # Calculate progress percentage and remaining time for animation
          progress_percent =
            if duration_ms > 0, do: round(progress_ms / duration_ms * 100), else: 0

          remaining_ms = max(0, duration_ms - progress_ms)
          remaining_seconds = div(remaining_ms, 1000)

          # Include timestamp for client-side progress interpolation
          # The client can calculate: current_progress = progress_ms + (Date.now() - timestamp)
          # This allows smooth progress bar updates without constant polling
          timestamp = System.system_time(:millisecond)

          {:ok,
           %{
             "is_playing" => data["is_playing"] || false,
             "track_name" => track["name"],
             "artist_name" => artist_name,
             "album_name" => get_in(track, ["album", "name"]),
             "album_art_url" => album_art_url,
             "progress_ms" => progress_ms,
             "duration_ms" => duration_ms,
             "progress_percent" => "#{progress_percent}%",
             "progress_formatted" => format_duration(progress_ms),
             "duration_formatted" => format_duration(duration_ms),
             "remaining_seconds" => remaining_seconds,
             "spotify_url" => get_in(track, ["external_urls", "spotify"]),
             "track_id" => track["id"],
             "timestamp" => timestamp
           }}
        end

      {:error, _} ->
        {:error, :json_parse_error}
    end
  end

  # Format milliseconds as m:ss
  defp format_duration(ms) when is_integer(ms) do
    total_seconds = div(ms, 1000)
    minutes = div(total_seconds, 60)
    seconds = rem(total_seconds, 60)
    "#{minutes}:#{String.pad_leading(Integer.to_string(seconds), 2, "0")}"
  end

  defp format_duration(_), do: "0:00"

  # Get preferred image size (around 300x300)
  defp get_preferred_image(images) do
    case images do
      [] ->
        nil

      images ->
        # Spotify returns images in descending size order
        # Try to find one around 300px, otherwise use the middle one
        preferred =
          Enum.find(images, fn img ->
            width = img["width"] || 0
            width >= 200 and width <= 400
          end)

        (preferred || Enum.at(images, div(length(images), 2)) || List.first(images))["url"]
    end
  end

  # Store the fetched data in widget_integration_data
  defp store_integration_data(widget_config_id, integration_id, data) do
    Integrations.upsert_integration_data(%{
      widget_integration_id: integration_id,
      widget_config_id: widget_config_id,
      data: data,
      fetched_at: DateTime.utc_now(),
      status: if(data["is_playing"], do: "playing", else: "not_playing")
    })
  end

  # Store organization-level integration data and broadcast update
  defp store_org_integration_data(organization_id, integration_id, data) do
    status = if(data["is_playing"], do: "playing", else: "not_playing")

    result =
      Integrations.upsert_organization_integration_data(
        organization_id,
        integration_id,
        data,
        status: status
      )

    # Broadcast update to organization channel for real-time updates
    case result do
      {:ok, %{widget_integration_id: _int_id}} ->
        # Get the widget_id from the integration for the broadcast
        case Integrations.get_integration(integration_id) do
          %{widget_id: widget_id} ->
            discriminator_id = "org:#{organization_id}"

            Integrations.broadcast_widget_config_data_update(
              organization_id,
              widget_id,
              integration_id,
              data,
              discriminator_id
            )

          _ ->
            :ok
        end

      _ ->
        :ok
    end

    result
  end

  # Ensure the access token is valid for organization-level credentials
  defp ensure_valid_token_for_org(organization_id, integration, credentials) do
    expires_at = credentials["expires_at"] || 0

    if SpotifyOAuth.token_expired?(expires_at) do
      Logger.info("SpotifyPoller: Token expired for org, refreshing...")

      # Get client credentials from network level
      case Integrations.get_client_credentials(integration.id, organization_id) do
        {:ok, %{client_id: client_id, client_secret: client_secret}} ->
          case SpotifyOAuth.refresh_token_with_credentials(
                 credentials["refresh_token"],
                 client_id,
                 client_secret
               ) do
            {:ok, new_tokens} ->
              # Update stored credentials with new tokens
              updated_credentials =
                Map.merge(credentials, %{
                  "access_token" => new_tokens.access_token,
                  "expires_at" => new_tokens.expires_at,
                  "refresh_token" => new_tokens[:refresh_token] || credentials["refresh_token"]
                })

              # Store updated credentials
              Integrations.upsert_organization_credentials(
                organization_id,
                integration.id,
                updated_credentials
              )

              {:ok, updated_credentials}

            {:error, reason} ->
              Logger.error("SpotifyPoller: Token refresh failed for org: #{inspect(reason)}")
              {:error, :token_refresh_failed}
          end

        {:error, reason} ->
          Logger.error(
            "SpotifyPoller: Could not get client credentials for org: #{inspect(reason)}"
          )

          {:error, :no_client_credentials}
      end
    else
      {:ok, credentials}
    end
  end

  # Mark credentials as invalid when refresh fails
  defp mark_credentials_invalid(widget_config_id) do
    organization_id = Castmill.Widgets.get_organization_id_for_widget_config(widget_config_id)

    if organization_id do
      case get_spotify_integration() do
        nil ->
          :ok

        integration ->
          Integrations.mark_credentials_invalid(organization_id, integration.id)
      end
    end
  end

  # Mark org credentials as invalid when refresh fails
  defp mark_org_credentials_invalid(organization_id) do
    case get_spotify_integration() do
      nil ->
        :ok

      integration ->
        Integrations.mark_credentials_invalid(organization_id, integration.id)
    end
  end
end

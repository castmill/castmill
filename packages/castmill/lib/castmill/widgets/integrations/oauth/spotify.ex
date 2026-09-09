defmodule Castmill.Widgets.Integrations.OAuth.Spotify do
  @moduledoc """
  Spotify OAuth 2.0 implementation for widget integrations.

  Handles the OAuth authorization flow including:
  - Authorization URL generation with state parameter
  - Authorization code exchange for access/refresh tokens
  - Token refresh when access tokens expire
  - State validation to prevent CSRF attacks

  ## Configuration

  Requires the following configuration in config.exs or runtime.exs:

      config :castmill, :spotify_oauth,
        client_id: "your_client_id",
        client_secret: "your_client_secret",
        redirect_uri: "http://localhost:4000/auth/spotify/callback",
        scopes: ["user-read-currently-playing", "user-read-playback-state"]

  ## Usage

      # Generate authorization URL
      {:ok, url, state} = Spotify.authorization_url(widget_config_id)

      # Exchange code for tokens (in callback)
      {:ok, tokens} = Spotify.exchange_code(code)

      # Refresh expired token
      {:ok, new_tokens} = Spotify.refresh_token(refresh_token)
  """

  require Logger

  @authorize_url "https://accounts.spotify.com/authorize"
  @token_url "https://accounts.spotify.com/api/token"

  # State tokens expire after 10 minutes
  @state_ttl_seconds 600

  @type tokens :: %{
          access_token: String.t(),
          refresh_token: String.t(),
          expires_at: integer(),
          token_type: String.t(),
          scope: String.t()
        }

  @type error_reason ::
          :missing_config
          | :invalid_state
          | :state_expired
          | :token_exchange_failed
          | :refresh_failed
          | {:http_error, term()}

  @doc """
  Returns the Spotify OAuth configuration.

  Raises if required configuration is missing.
  """
  @spec config() :: keyword()
  def config do
    Application.get_env(:castmill, :spotify_oauth, [])
  end

  @doc """
  Validates that required configuration is present.
  """
  @spec validate_config() :: :ok | {:error, :missing_config}
  def validate_config do
    cfg = config()

    if cfg[:client_id] && cfg[:client_secret] && cfg[:redirect_uri] do
      :ok
    else
      {:error, :missing_config}
    end
  end

  @doc """
  Generates the Spotify authorization URL with state parameter.

  The state parameter encodes the widget_config_id and a timestamp for CSRF protection.
  Store the returned state to validate the callback.

  ## Parameters

    - widget_config_id: The widget configuration ID to associate with the OAuth flow
    - organization_id: The organization ID for the widget

  ## Returns

    - `{:ok, url, state}` - Authorization URL and state token
    - `{:error, :missing_config}` - Configuration is incomplete

  ## Examples

      iex> Spotify.authorization_url("widget-123", "org-456")
      {:ok, "https://accounts.spotify.com/authorize?...", "base64_state"}
  """
  @spec authorization_url(String.t(), String.t()) ::
          {:ok, String.t(), String.t()} | {:error, error_reason()}
  def authorization_url(widget_config_id, organization_id) do
    with :ok <- validate_config() do
      cfg = config()
      state = generate_state(widget_config_id, organization_id)

      params =
        URI.encode_query(%{
          "client_id" => cfg[:client_id],
          "response_type" => "code",
          "redirect_uri" => cfg[:redirect_uri],
          "scope" => Enum.join(cfg[:scopes] || [], " "),
          "state" => state,
          "show_dialog" => "true"
        })

      url = "#{@authorize_url}?#{params}"
      {:ok, url, state}
    end
  end

  @doc """
  Validates and decodes the state parameter from the OAuth callback.

  Checks that:
  - State is properly formatted
  - State has not expired (10 minute TTL)
  - State signature is valid

  ## Parameters

    - state: The state parameter from the callback

  ## Returns

    - `{:ok, widget_config_id, organization_id}` - Valid state with extracted IDs
    - `{:error, :invalid_state}` - State is malformed
    - `{:error, :state_expired}` - State has expired

  ## Examples

      iex> Spotify.validate_state("valid_state_token")
      {:ok, "widget-123", "org-456"}
  """
  @spec validate_state(String.t()) ::
          {:ok, String.t(), String.t()} | {:error, :invalid_state | :state_expired}
  def validate_state(state) do
    with {:ok, decoded} <- Base.url_decode64(state, padding: false),
         {:ok, data} <- Jason.decode(decoded),
         %{
           "widget_config_id" => widget_config_id,
           "organization_id" => organization_id,
           "timestamp" => timestamp,
           "signature" => signature
         } <- data,
         :ok <- validate_signature(widget_config_id, organization_id, timestamp, signature),
         :ok <- validate_not_expired(timestamp) do
      {:ok, widget_config_id, organization_id}
    else
      {:error, :invalid_signature} -> {:error, :invalid_state}
      {:error, :expired} -> {:error, :state_expired}
      _ -> {:error, :invalid_state}
    end
  end

  @doc """
  Exchanges an authorization code for access and refresh tokens.

  ## Parameters

    - code: The authorization code from the OAuth callback

  ## Returns

    - `{:ok, tokens}` - Map containing access_token, refresh_token, expires_at, etc.
    - `{:error, :token_exchange_failed}` - Exchange failed
    - `{:error, {:http_error, reason}}` - HTTP request failed

  ## Examples

      iex> Spotify.exchange_code("authorization_code")
      {:ok, %{access_token: "...", refresh_token: "...", expires_at: 1234567890}}
  """
  @spec exchange_code(String.t()) :: {:ok, tokens()} | {:error, error_reason()}
  def exchange_code(code) do
    with :ok <- validate_config() do
      cfg = config()

      body =
        URI.encode_query(%{
          "grant_type" => "authorization_code",
          "code" => code,
          "redirect_uri" => cfg[:redirect_uri]
        })

      headers = [
        {"Content-Type", "application/x-www-form-urlencoded"},
        {"Authorization", "Basic " <> Base.encode64("#{cfg[:client_id]}:#{cfg[:client_secret]}")}
      ]

      case HTTPoison.post(@token_url, body, headers) do
        {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
          parse_token_response(response_body)

        {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
          Logger.error("Spotify token exchange failed: #{status} - #{error_body}")
          {:error, :token_exchange_failed}

        {:error, %HTTPoison.Error{reason: reason}} ->
          Logger.error("Spotify token exchange HTTP error: #{inspect(reason)}")
          {:error, {:http_error, reason}}
      end
    end
  end

  @doc """
  Refreshes an expired access token using a refresh token.

  ## Parameters

    - refresh_token: The refresh token from a previous authorization

  ## Returns

    - `{:ok, tokens}` - Map containing new access_token and updated expires_at
    - `{:error, :refresh_failed}` - Refresh failed (token may be revoked)
    - `{:error, {:http_error, reason}}` - HTTP request failed

  ## Examples

      iex> Spotify.refresh_token("refresh_token")
      {:ok, %{access_token: "new_token", expires_at: 1234567890}}
  """
  @spec refresh_token(String.t()) :: {:ok, tokens()} | {:error, error_reason()}
  def refresh_token(refresh_token) do
    with :ok <- validate_config() do
      cfg = config()

      body =
        URI.encode_query(%{
          "grant_type" => "refresh_token",
          "refresh_token" => refresh_token
        })

      headers = [
        {"Content-Type", "application/x-www-form-urlencoded"},
        {"Authorization", "Basic " <> Base.encode64("#{cfg[:client_id]}:#{cfg[:client_secret]}")}
      ]

      case HTTPoison.post(@token_url, body, headers) do
        {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
          # Keep the original refresh_token if not provided in response
          case parse_token_response(response_body) do
            {:ok, tokens} ->
              tokens =
                if Map.has_key?(tokens, :refresh_token) do
                  tokens
                else
                  Map.put(tokens, :refresh_token, refresh_token)
                end

              {:ok, tokens}

            error ->
              error
          end

        {:ok, %HTTPoison.Response{status_code: 400, body: error_body}} ->
          Logger.warning("Spotify token refresh failed (possibly revoked): #{error_body}")
          {:error, :refresh_failed}

        {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
          Logger.error("Spotify token refresh failed: #{status} - #{error_body}")
          {:error, :refresh_failed}

        {:error, %HTTPoison.Error{reason: reason}} ->
          Logger.error("Spotify token refresh HTTP error: #{inspect(reason)}")
          {:error, {:http_error, reason}}
      end
    end
  end

  @doc """
  Refreshes an expired access token using provided client credentials.

  This function is used when client credentials are stored in the database
  (at network level) rather than in application configuration.

  ## Parameters

    - refresh_token: The refresh token from a previous authorization
    - client_id: Spotify client ID from network credentials
    - client_secret: Spotify client secret from network credentials

  ## Returns

    - `{:ok, tokens}` - Map containing new access_token and updated expires_at
    - `{:error, :refresh_failed}` - Refresh failed (token may be revoked)
    - `{:error, {:http_error, reason}}` - HTTP request failed

  ## Examples

      iex> Spotify.refresh_token_with_credentials("refresh_token", "client_id", "secret")
      {:ok, %{access_token: "new_token", expires_at: 1234567890}}
  """
  @spec refresh_token_with_credentials(String.t(), String.t(), String.t()) ::
          {:ok, tokens()} | {:error, error_reason()}
  def refresh_token_with_credentials(refresh_token, client_id, client_secret) do
    body =
      URI.encode_query(%{
        "grant_type" => "refresh_token",
        "refresh_token" => refresh_token
      })

    headers = [
      {"Content-Type", "application/x-www-form-urlencoded"},
      {"Authorization", "Basic " <> Base.encode64("#{client_id}:#{client_secret}")}
    ]

    case HTTPoison.post(@token_url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        # Keep the original refresh_token if not provided in response
        case parse_token_response(response_body) do
          {:ok, tokens} ->
            tokens =
              if Map.has_key?(tokens, :refresh_token) do
                tokens
              else
                Map.put(tokens, :refresh_token, refresh_token)
              end

            {:ok, tokens}

          error ->
            error
        end

      {:ok, %HTTPoison.Response{status_code: 400, body: error_body}} ->
        Logger.warning("Spotify token refresh failed (possibly revoked): #{error_body}")
        {:error, :refresh_failed}

      {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
        Logger.error("Spotify token refresh failed: #{status} - #{error_body}")
        {:error, :refresh_failed}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("Spotify token refresh HTTP error: #{inspect(reason)}")
        {:error, {:http_error, reason}}
    end
  end

  @doc """
  Checks if an access token is expired or will expire soon.

  Returns true if token expires within the next 5 minutes.

  ## Parameters

    - expires_at: Unix timestamp when the token expires

  ## Examples

      iex> Spotify.token_expired?(System.system_time(:second) - 100)
      true

      iex> Spotify.token_expired?(System.system_time(:second) + 3600)
      false
  """
  @spec token_expired?(integer()) :: boolean()
  def token_expired?(expires_at) when is_integer(expires_at) do
    # Consider expired if less than 5 minutes remaining
    System.system_time(:second) >= expires_at - 300
  end

  def token_expired?(_), do: true

  @doc """
  Builds credentials map from token response for storage.

  ## Parameters

    - tokens: Token map from exchange_code/1 or refresh_token/1
    - client_id: Spotify client ID
    - client_secret: Spotify client secret

  ## Returns

    Map suitable for encrypting and storing as widget credentials.
  """
  @spec build_credentials(tokens(), String.t(), String.t()) :: map()
  def build_credentials(tokens, client_id, client_secret) do
    %{
      "client_id" => client_id,
      "client_secret" => client_secret,
      "access_token" => tokens.access_token,
      "refresh_token" => tokens.refresh_token,
      "expires_at" => tokens.expires_at,
      "token_type" => Map.get(tokens, :token_type, "Bearer"),
      "scope" => Map.get(tokens, :scope, "")
    }
  end

  # Private functions
  #
  # Note: The signature functions follow the same parameter order as Generic OAuth module:
  # (integration_id, widget_config_id, organization_id, timestamp)
  # For Spotify, integration_id is always "spotify" since this is a dedicated implementation.

  @spotify_integration_id "spotify"

  defp generate_state(widget_config_id, organization_id) do
    timestamp = System.system_time(:second)

    signature =
      compute_signature(@spotify_integration_id, widget_config_id, organization_id, timestamp)

    data =
      Jason.encode!(%{
        "integration_id" => @spotify_integration_id,
        "widget_config_id" => widget_config_id,
        "organization_id" => organization_id,
        "timestamp" => timestamp,
        "signature" => signature
      })

    Base.url_encode64(data, padding: false)
  end

  defp compute_signature(integration_id, widget_config_id, organization_id, timestamp) do
    secret = get_signing_secret()

    # Signature format matches Generic OAuth: "integration_id:widget_config_id:organization_id:timestamp"
    data = "#{integration_id}:#{widget_config_id}:#{organization_id}:#{timestamp}"

    :crypto.mac(:hmac, :sha256, secret, data)
    |> Base.encode64()
  end

  defp valid_signature?(widget_config_id, organization_id, timestamp, signature) do
    expected =
      compute_signature(@spotify_integration_id, widget_config_id, organization_id, timestamp)

    Plug.Crypto.secure_compare(expected, signature)
  end

  defp validate_signature(widget_config_id, organization_id, timestamp, signature) do
    if valid_signature?(widget_config_id, organization_id, timestamp, signature) do
      :ok
    else
      {:error, :invalid_signature}
    end
  end

  defp not_expired?(timestamp) when is_integer(timestamp) do
    System.system_time(:second) - timestamp < @state_ttl_seconds
  end

  defp not_expired?(_), do: false

  defp validate_not_expired(timestamp) do
    if not_expired?(timestamp) do
      :ok
    else
      {:error, :expired}
    end
  end

  defp get_signing_secret do
    # Use the endpoint secret key base for signing state
    Application.get_env(:castmill, CastmillWeb.Endpoint)[:secret_key_base] ||
      raise "Missing secret_key_base configuration"
  end

  defp parse_token_response(body) do
    case Jason.decode(body) do
      {:ok, data} ->
        tokens = %{
          access_token: data["access_token"],
          refresh_token: data["refresh_token"],
          expires_at: System.system_time(:second) + (data["expires_in"] || 3600),
          token_type: data["token_type"] || "Bearer",
          scope: data["scope"] || ""
        }

        {:ok, tokens}

      {:error, _} ->
        {:error, :token_exchange_failed}
    end
  end
end

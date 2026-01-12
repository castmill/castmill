defmodule Castmill.Widgets.Integrations.OAuth.Generic do
  @moduledoc """
  Generic OAuth 2.0 implementation that works with any provider
  based on credential_schema configuration.

  This module provides a provider-agnostic OAuth 2.0 implementation
  that reads configuration from the widget integration's credential_schema.

  ## Supported OAuth 2.0 Flows

  - Authorization Code Flow (standard)
  - Authorization Code Flow with PKCE
  - Client Credentials Flow (planned)

  ## Configuration

  The OAuth configuration is read from `credential_schema.oauth2`:

  ```json
  {
    "auth_type": "oauth2",
    "oauth2": {
      "authorization_url": "https://provider.com/authorize",
      "token_url": "https://provider.com/token",
      "scopes": ["scope1", "scope2"],
      "client_auth": "basic",
      "pkce": false,
      "token_placement": "header",
      "refresh_margin_seconds": 300
    },
    "fields": {
      "client_id": {...},
      "client_secret": {...}
    }
  }
  ```

  ## State Security

  The state parameter is HMAC-signed with the server's secret key and includes:
  - Integration ID
  - Widget config ID (if widget-scoped)
  - Organization ID
  - Timestamp (for expiry)
  - Signature (HMAC-SHA256)

  States expire after 10 minutes to prevent replay attacks.
  """

  require Logger

  @state_ttl_seconds 600
  @default_refresh_margin 300

  @type oauth_config :: %{
          authorization_url: String.t(),
          token_url: String.t(),
          scopes: [String.t()],
          client_auth: String.t(),
          pkce: boolean(),
          token_placement: String.t(),
          refresh_margin_seconds: integer()
        }

  @type tokens :: %{
          access_token: String.t(),
          refresh_token: String.t() | nil,
          expires_at: integer(),
          token_type: String.t(),
          scope: String.t()
        }

  @type context :: %{
          integration_id: String.t() | integer(),
          widget_config_id: String.t() | nil,
          organization_id: String.t()
        }

  @type error_reason ::
          :missing_oauth_config
          | :invalid_state
          | :state_expired
          | :token_exchange_failed
          | {:http_error, any()}

  @doc """
  Extracts and normalizes OAuth configuration from credential_schema.

  ## Parameters

    - credential_schema: The credential_schema map from widget integration

  ## Returns

    - `{:ok, oauth_config}` - Normalized OAuth configuration
    - `{:error, :missing_oauth_config}` - OAuth2 config not found
  """
  @spec get_oauth_config(map()) :: {:ok, oauth_config()} | {:error, :missing_oauth_config}
  def get_oauth_config(credential_schema) when is_map(credential_schema) do
    auth_type = Map.get(credential_schema, "auth_type", "custom")

    if auth_type in ["oauth2", "oauth2_client_credentials"] do
      oauth2 = Map.get(credential_schema, "oauth2", %{})

      config = %{
        authorization_url: oauth2["authorization_url"],
        token_url: oauth2["token_url"],
        scopes: oauth2["scopes"] || [],
        client_auth: oauth2["client_auth"] || "basic",
        pkce: oauth2["pkce"] || false,
        token_placement: oauth2["token_placement"] || "header",
        refresh_margin_seconds: oauth2["refresh_margin_seconds"] || @default_refresh_margin
      }

      if config.authorization_url && config.token_url do
        {:ok, config}
      else
        {:error, :missing_oauth_config}
      end
    else
      {:error, :missing_oauth_config}
    end
  end

  def get_oauth_config(_), do: {:error, :missing_oauth_config}

  @doc """
  Generates the authorization URL for the OAuth flow.

  ## Parameters

    - oauth_config: OAuth configuration from get_oauth_config/1
    - client_id: The OAuth client ID
    - redirect_uri: The callback URL
    - context: Map containing integration_id, widget_config_id, organization_id

  ## Returns

    - `{:ok, url, state}` - Authorization URL and state token
  """
  @spec authorization_url(oauth_config(), String.t(), String.t(), context()) ::
          {:ok, String.t(), String.t()}
  def authorization_url(oauth_config, client_id, redirect_uri, context) do
    state = generate_state(context)

    params = %{
      "client_id" => client_id,
      "response_type" => "code",
      "redirect_uri" => redirect_uri,
      "scope" => Enum.join(oauth_config.scopes, " "),
      "state" => state,
      "show_dialog" => "true"
    }

    # Add PKCE if configured
    # NOTE: PKCE support is currently incomplete - verifier storage is not implemented.
    # This will fail at the callback stage. See store_pkce_verifier/2 for details.
    params =
      if oauth_config.pkce do
        Logger.warning(
          "PKCE is enabled but verifier storage is not implemented. " <>
            "OAuth callback will fail. Disable PKCE in credential_schema or implement storage."
        )

        {challenge, verifier} = generate_pkce()
        store_pkce_verifier(state, verifier)

        Map.merge(params, %{
          "code_challenge" => challenge,
          "code_challenge_method" => "S256"
        })
      else
        params
      end

    url = "#{oauth_config.authorization_url}?#{URI.encode_query(params)}"
    {:ok, url, state}
  end

  @doc """
  Validates and decodes the state parameter from OAuth callback.

  ## Parameters

    - state: Base64-encoded state string

  ## Returns

    - `{:ok, context}` - Decoded context with integration_id, widget_config_id, organization_id
    - `{:error, :invalid_state}` - State is malformed or signature invalid
    - `{:error, :state_expired}` - State has expired
  """
  @spec validate_state(String.t()) ::
          {:ok, context()} | {:error, :invalid_state | :state_expired}
  def validate_state(state) do
    with {:ok, decoded} <- Base.url_decode64(state, padding: false),
         {:ok, data} <- Jason.decode(decoded),
         %{
           "integration_id" => integration_id,
           "organization_id" => organization_id,
           "timestamp" => timestamp,
           "signature" => signature
         } <- data,
         widget_config_id = Map.get(data, "widget_config_id"),
         redirect_url = Map.get(data, "redirect_url"),
         :ok <-
           validate_signature(
             integration_id,
             widget_config_id,
             organization_id,
             timestamp,
             signature
           ),
         :ok <- validate_not_expired(timestamp) do
      {:ok,
       %{
         integration_id: integration_id,
         widget_config_id: widget_config_id,
         organization_id: organization_id,
         redirect_url: redirect_url
       }}
    else
      {:error, :invalid_signature} -> {:error, :invalid_state}
      {:error, :expired} -> {:error, :state_expired}
      _ -> {:error, :invalid_state}
    end
  end

  @doc """
  Exchanges an authorization code for access and refresh tokens.

  ## Parameters

    - oauth_config: OAuth configuration from get_oauth_config/1
    - code: Authorization code from callback
    - client_id: OAuth client ID
    - client_secret: OAuth client secret
    - redirect_uri: Callback URL used in authorization

  ## Returns

    - `{:ok, tokens}` - Map containing access_token, refresh_token, expires_at
    - `{:error, :token_exchange_failed}` - Exchange failed
    - `{:error, {:http_error, reason}}` - HTTP request failed
  """
  @spec exchange_code(oauth_config(), String.t(), String.t(), String.t(), String.t()) ::
          {:ok, tokens()} | {:error, error_reason()}
  def exchange_code(oauth_config, code, client_id, client_secret, redirect_uri) do
    body_params = %{
      "grant_type" => "authorization_code",
      "code" => code,
      "redirect_uri" => redirect_uri
    }

    {headers, body_params} =
      case oauth_config.client_auth do
        "basic" ->
          auth_header = "Basic " <> Base.encode64("#{client_id}:#{client_secret}")
          {[{"Authorization", auth_header}], body_params}

        "post" ->
          {[],
           Map.merge(body_params, %{
             "client_id" => client_id,
             "client_secret" => client_secret
           })}

        _ ->
          auth_header = "Basic " <> Base.encode64("#{client_id}:#{client_secret}")
          {[{"Authorization", auth_header}], body_params}
      end

    body = URI.encode_query(body_params)
    headers = headers ++ [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(oauth_config.token_url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        parse_token_response(response_body)

      {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
        Logger.error("OAuth token exchange failed: #{status} - #{error_body}")
        {:error, :token_exchange_failed}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("OAuth token exchange HTTP error: #{inspect(reason)}")
        {:error, {:http_error, reason}}
    end
  end

  @doc """
  Refreshes an expired access token.

  ## Parameters

    - oauth_config: OAuth configuration
    - refresh_token: The refresh token
    - client_id: OAuth client ID
    - client_secret: OAuth client secret

  ## Returns

    - `{:ok, tokens}` - New tokens (may include new refresh_token)
    - `{:error, :refresh_failed}` - Refresh failed
    - `{:error, {:http_error, reason}}` - HTTP request failed
  """
  @spec refresh_token(oauth_config(), String.t(), String.t(), String.t()) ::
          {:ok, tokens()} | {:error, error_reason()}
  def refresh_token(oauth_config, refresh_token, client_id, client_secret) do
    body_params = %{
      "grant_type" => "refresh_token",
      "refresh_token" => refresh_token
    }

    {headers, body_params} =
      case oauth_config.client_auth do
        "basic" ->
          auth_header = "Basic " <> Base.encode64("#{client_id}:#{client_secret}")
          {[{"Authorization", auth_header}], body_params}

        "post" ->
          {[],
           Map.merge(body_params, %{
             "client_id" => client_id,
             "client_secret" => client_secret
           })}

        _ ->
          auth_header = "Basic " <> Base.encode64("#{client_id}:#{client_secret}")
          {[{"Authorization", auth_header}], body_params}
      end

    body = URI.encode_query(body_params)
    headers = headers ++ [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(oauth_config.token_url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case parse_token_response(response_body) do
          {:ok, tokens} ->
            # Keep original refresh_token if not provided in response
            tokens =
              if Map.has_key?(tokens, :refresh_token) && tokens.refresh_token do
                tokens
              else
                Map.put(tokens, :refresh_token, refresh_token)
              end

            {:ok, tokens}

          error ->
            error
        end

      {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
        Logger.error("OAuth token refresh failed: #{status} - #{error_body}")
        {:error, :refresh_failed}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("OAuth token refresh HTTP error: #{inspect(reason)}")
        {:error, {:http_error, reason}}
    end
  end

  @doc """
  Checks if a token is expired or will expire soon.

  ## Parameters

    - expires_at: Unix timestamp of token expiration
    - margin_seconds: Consider expired if less than this many seconds remaining (default: 300)

  ## Returns

    - true if token is expired or expiring soon
    - false if token is still valid
  """
  @spec token_expired?(integer() | nil, integer()) :: boolean()
  def token_expired?(expires_at, margin_seconds \\ @default_refresh_margin)

  def token_expired?(expires_at, margin_seconds) when is_integer(expires_at) do
    System.system_time(:second) >= expires_at - margin_seconds
  end

  def token_expired?(_, _), do: true

  @doc """
  Builds a credentials map suitable for encrypted storage.

  ## Parameters

    - tokens: Token response from exchange_code/5 or refresh_token/4
    - client_id: OAuth client ID
    - client_secret: OAuth client secret

  ## Returns

    Map with all credential fields for storage.
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

  defp generate_state(context) do
    timestamp = System.system_time(:second)

    signature =
      compute_signature(
        context.integration_id,
        context[:widget_config_id],
        context.organization_id,
        timestamp
      )

    data =
      Jason.encode!(%{
        "integration_id" => context.integration_id,
        "widget_config_id" => context[:widget_config_id],
        "organization_id" => context.organization_id,
        "redirect_url" => context[:redirect_url],
        "timestamp" => timestamp,
        "signature" => signature
      })

    Base.url_encode64(data, padding: false)
  end

  defp compute_signature(integration_id, widget_config_id, organization_id, timestamp) do
    secret = get_signing_secret()
    data = "#{integration_id}:#{widget_config_id}:#{organization_id}:#{timestamp}"

    :crypto.mac(:hmac, :sha256, secret, data)
    |> Base.encode64()
  end

  defp validate_signature(integration_id, widget_config_id, organization_id, timestamp, signature) do
    expected = compute_signature(integration_id, widget_config_id, organization_id, timestamp)

    if Plug.Crypto.secure_compare(expected, signature) do
      :ok
    else
      {:error, :invalid_signature}
    end
  end

  defp validate_not_expired(timestamp) when is_integer(timestamp) do
    if System.system_time(:second) - timestamp < @state_ttl_seconds do
      :ok
    else
      {:error, :expired}
    end
  end

  defp validate_not_expired(_), do: {:error, :expired}

  defp get_signing_secret do
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

  # PKCE support (for future use)
  defp generate_pkce do
    verifier =
      :crypto.strong_rand_bytes(32)
      |> Base.url_encode64(padding: false)

    challenge =
      :crypto.hash(:sha256, verifier)
      |> Base.url_encode64(padding: false)

    {challenge, verifier}
  end

  defp store_pkce_verifier(_state, _verifier) do
    # TODO: PKCE verifier storage is not implemented.
    #
    # To complete PKCE support, implement storage using one of these approaches:
    #
    # Option 1: ETS table (simple, single-node)
    #   - Create an ETS table in application startup
    #   - Store: :ets.insert(:pkce_verifiers, {state, verifier, expiry})
    #   - Retrieve: :ets.lookup(:pkce_verifiers, state)
    #   - Add periodic cleanup for expired entries
    #
    # Option 2: Cachex (distributed, recommended for multi-node)
    #   - Add {:cachex, "~> 3.6"} to deps
    #   - Start cache: Cachex.start_link(name: :pkce_cache, expiration: [default: :timer.minutes(10)])
    #   - Store: Cachex.put(:pkce_cache, state, verifier)
    #   - Retrieve: Cachex.get(:pkce_cache, state)
    #
    # Also update exchange_code/5 to:
    # 1. Accept state parameter
    # 2. Retrieve verifier: get_pkce_verifier(state)
    # 3. Include "code_verifier" => verifier in the token request body
    #
    # Until implemented, PKCE flows will fail at callback stage with "invalid_grant" error.
    :ok
  end
end

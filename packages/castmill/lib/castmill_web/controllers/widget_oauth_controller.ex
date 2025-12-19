defmodule CastmillWeb.WidgetOAuthController do
  @moduledoc """
  Generic OAuth controller for widget integrations.

  This controller handles OAuth 2.0 flows for any widget integration
  that has OAuth configured in its credential_schema. It reads the
  OAuth configuration from the database, making it provider-agnostic.

  ## Routes

      GET /auth/widget-integrations/:integration_id/authorize
      GET /auth/widget-integrations/callback

  ## Security

  The authorize endpoint requires the user to be authenticated and have
  at least 'member' access to the organization. The callback endpoint
  validates the signed state parameter which contains:
  - Integration ID
  - Organization ID
  - Widget config ID (if applicable)
  - HMAC signature
  - Timestamp (10-minute expiry)

  ## Required Parameters

  ### Authorize Endpoint

  - `integration_id`: The widget integration ID (in path)
  - `organization_id`: The organization ID (user must belong to this org)
  - `widget_config_id`: (optional) For widget-scoped credentials
  - `redirect_url`: (optional) URL to redirect after OAuth completes

  ### Callback Endpoint (unified)

  - `code`: Authorization code from OAuth provider
  - `state`: Signed state parameter containing context and CSRF token
  - `error`: (optional) Error code from provider
  - `error_description`: (optional) Error description

  ## Flow

  1. Dashboard initiates OAuth: GET /auth/widget-integrations/:id/authorize
  2. Controller validates user belongs to organization
  3. Controller reads OAuth config from integration's credential_schema
  4. User is redirected to provider's authorization URL with signed state
  5. Provider redirects back to /auth/widget-integrations/callback
  6. Controller validates signed state and exchanges code for tokens
  7. Tokens are encrypted and stored as credentials
  8. User is redirected back to Dashboard
  """

  use CastmillWeb, :controller

  require Logger

  alias Castmill.Organizations
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.OAuth.Generic, as: GenericOAuth

  @doc """
  Initiates the OAuth authorization flow.

  Reads OAuth configuration from the integration's credential_schema
  and redirects the user to the provider's authorization URL.
  """
  def authorize(conn, params) do
    integration_id = params["integration_id"]
    organization_id = params["organization_id"]
    widget_config_id = params["widget_config_id"]
    redirect_url = params["redirect_url"]

    # Validate required parameters and user authorization
    with :ok <- validate_required_params(organization_id, "organization_id"),
         :ok <- authorize_user_for_organization(conn, organization_id),
         {:ok, integration} <- get_integration(integration_id),
         {:ok, oauth_config} <- get_oauth_config(integration),
         {:ok, client_credentials} <- get_client_credentials(integration, organization_id) do
      {client_id, _client_secret} = client_credentials

      # Generate redirect URI (fixed URL for all integrations)
      redirect_uri = generate_redirect_uri(conn)

      # Include redirect_url in context so it survives OAuth round-trip
      # Session-based storage doesn't work reliably when Dashboard is on different port
      context = %{
        integration_id: integration_id,
        widget_config_id: widget_config_id,
        organization_id: organization_id,
        redirect_url: redirect_url || "/dashboard"
      }

      {:ok, url, _state} =
        GenericOAuth.authorization_url(oauth_config, client_id, redirect_uri, context)

      redirect(conn, external: url)
    else
      {:error, :missing_param, param} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "#{param} is required"})

      {:error, :not_authenticated} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{
          error: "Authentication required",
          message: "Please log in to authorize this integration"
        })

      {:error, :not_authorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{
          error: "Not authorized",
          message: "You do not have access to this organization"
        })

      {:error, :integration_not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration not found"})

      {:error, :missing_oauth_config} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Integration does not support OAuth"})

      {:error, :credentials_not_configured} ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          error: "Client credentials not configured",
          message:
            "Please configure the OAuth client_id and client_secret in the integration settings"
        })

      {:error, reason} ->
        Logger.error("OAuth authorization failed: #{inspect(reason)}")

        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to initiate OAuth flow"})
    end
  end

  @doc """
  Handles the OAuth callback from the provider (unified endpoint).

  This is the preferred callback endpoint - uses a fixed URL that can be
  registered with OAuth providers. The integration_id is extracted from
  the state parameter.

  Redirect URI to register: /auth/widget-integrations/callback
  """
  def callback_unified(conn, params) do
    code = params["code"]
    state = params["state"]
    error = params["error"]
    error_description = params["error_description"]

    # Handle OAuth errors from provider
    if error do
      Logger.warning("OAuth denied: #{error} - #{error_description}")
      # Try to get redirect_url from state, fallback to dashboard
      redirect_url = extract_redirect_url_from_state(state) || "/dashboard"
      redirect_with_error(conn, redirect_url, error_description || "Authorization denied")
    else
      # Extract integration_id and redirect_url from state
      case extract_context_from_state(state) do
        {:ok, integration_id, redirect_url} ->
          process_callback(conn, integration_id, code, state, redirect_url || "/dashboard")

        {:error, reason} ->
          Logger.warning("Failed to extract context from state: #{reason}")
          redirect_with_error(conn, "/dashboard", "Invalid OAuth state")
      end
    end
  end

  # Private functions

  defp process_callback(conn, integration_id, code, state, redirect_url) do
    with {:ok, context} <- validate_state(state, integration_id),
         {:ok, integration} <- get_integration(context.integration_id),
         {:ok, oauth_config} <- get_oauth_config(integration),
         {:ok, {client_id, client_secret}} <-
           get_client_credentials(integration, context.organization_id),
         redirect_uri = generate_redirect_uri(conn),
         {:ok, tokens} <-
           GenericOAuth.exchange_code(oauth_config, code, client_id, client_secret, redirect_uri),
         :ok <- store_credentials(integration, context, tokens, client_id, client_secret) do
      Logger.info("OAuth successful for integration #{integration_id}")
      redirect_with_success(conn, redirect_url, context)
    else
      {:error, :invalid_state} ->
        Logger.warning("Invalid OAuth state parameter")
        redirect_with_error(conn, redirect_url, "Invalid state parameter (CSRF protection)")

      {:error, :state_expired} ->
        Logger.warning("OAuth state expired")
        redirect_with_error(conn, redirect_url, "Authorization expired. Please try again.")

      {:error, :token_exchange_failed} ->
        Logger.error("Failed to exchange authorization code for tokens")
        redirect_with_error(conn, redirect_url, "Failed to exchange authorization code")

      {:error, {:http_error, reason}} ->
        Logger.error("HTTP error during token exchange: #{inspect(reason)}")
        redirect_with_error(conn, redirect_url, "Network error during authorization")

      {:error, reason} ->
        Logger.error("OAuth callback error: #{inspect(reason)}")
        redirect_with_error(conn, redirect_url, "Authorization failed")
    end
  end

  defp validate_state(nil, _integration_id), do: {:error, :invalid_state}
  defp validate_state("", _integration_id), do: {:error, :invalid_state}

  defp validate_state(state, integration_id) do
    case GenericOAuth.validate_state(state) do
      {:ok, context} ->
        # Verify the state was for this integration
        if to_string(context.integration_id) == to_string(integration_id) do
          {:ok, context}
        else
          {:error, :invalid_state}
        end

      error ->
        error
    end
  end

  defp get_integration(nil), do: {:error, :integration_not_found}
  defp get_integration(""), do: {:error, :integration_not_found}

  defp get_integration(integration_id) when is_binary(integration_id) do
    case Integer.parse(integration_id) do
      {int_id, ""} -> get_integration(int_id)
      _ -> {:error, :integration_not_found}
    end
  end

  defp get_integration(integration_id) when is_integer(integration_id) do
    case Integrations.get_integration(integration_id) do
      nil -> {:error, :integration_not_found}
      integration -> {:ok, integration}
    end
  end

  defp get_oauth_config(integration) do
    GenericOAuth.get_oauth_config(integration.credential_schema || %{})
  end

  defp get_client_credentials(integration, organization_id) do
    # Use the centralized credential resolution that checks:
    # 1. Network-level credentials (for system widgets)
    # 2. Organization-level credentials (fallback)
    case Integrations.get_client_credentials(integration.id, organization_id) do
      {:ok, %{client_id: client_id, client_secret: client_secret}}
      when is_binary(client_id) and is_binary(client_secret) ->
        {:ok, {client_id, client_secret}}

      {:ok, _incomplete} ->
        # Credentials exist but missing client_id or client_secret, try pull_config
        get_config_credentials(integration)

      {:error, _reason} ->
        # No credentials at network or org level, try pull_config (for tests/dev)
        get_config_credentials(integration)
    end
  end

  # Fallback for pull_config credentials (used in tests and development)
  defp get_config_credentials(integration) do
    pull_config = integration.pull_config || %{}

    client_id = pull_config["client_id"]
    client_secret = pull_config["client_secret"]

    if client_id && client_secret do
      {:ok, {client_id, client_secret}}
    else
      {:error, :credentials_not_configured}
    end
  end

  defp store_credentials(integration, context, tokens, client_id, client_secret) do
    credentials = GenericOAuth.build_credentials(tokens, client_id, client_secret)

    result =
      case integration.credential_scope do
        "organization" ->
          Integrations.upsert_organization_credentials(
            context.organization_id,
            integration.id,
            credentials
          )

        "widget" when not is_nil(context.widget_config_id) ->
          Integrations.upsert_widget_credentials(
            context.widget_config_id,
            integration.id,
            credentials
          )

        _ ->
          # Default to organization scope
          Integrations.upsert_organization_credentials(
            context.organization_id,
            integration.id,
            credentials
          )
      end

    case result do
      {:ok, _} ->
        # Schedule polling for integrations that use PULL mode
        maybe_schedule_polling(integration, context)
        :ok

      {:error, _reason} = error ->
        error
    end
  end

  # Schedule polling for PULL-mode integrations
  # Uses poller_module from pull_config to determine which worker to use
  defp maybe_schedule_polling(integration, context) do
    if integration.integration_type in ["pull", "both"] do
      pull_config = integration.pull_config || %{}
      poller_module = pull_config["poller_module"]

      if poller_module do
        # Dynamically call the poller module
        module = String.to_existing_atom("Elixir." <> poller_module)

        case integration.discriminator_type do
          "organization" ->
            # Organization-level polling - all widgets share the data
            Logger.info(
              "Scheduling #{poller_module} for organization_id=#{context.organization_id}"
            )

            if function_exported?(module, :schedule_for_org, 1) do
              apply(module, :schedule_for_org, [context.organization_id])
            else
              Logger.warning("Poller module #{poller_module} does not export schedule_for_org/1")
            end

          _ when not is_nil(context.widget_config_id) ->
            # Widget-config-level polling
            Logger.info(
              "Scheduling #{poller_module} for widget_config_id=#{context.widget_config_id}"
            )

            if function_exported?(module, :schedule, 1) do
              apply(module, :schedule, [context.widget_config_id])
            else
              Logger.warning("Poller module #{poller_module} does not export schedule/1")
            end

          _ ->
            Logger.warning("OAuth completed but no scheduling target for #{integration.name}")
        end
      end
    end
  rescue
    ArgumentError ->
      # Module doesn't exist - this is fine, just log a warning
      Logger.warning("Poller module #{integration.pull_config["poller_module"]} not found")
  end

  defp generate_redirect_uri(conn) do
    # Use a fixed callback URL - integration ID is passed via state parameter
    # This allows registering a single redirect URI with OAuth providers
    #
    # For local development, set OAUTH_REDIRECT_HOST=127.0.0.1 to use IP instead of localhost
    # (required by Spotify which doesn't allow localhost, only 127.0.0.1)
    configured_host = System.get_env("OAUTH_REDIRECT_HOST")

    host =
      if configured_host && configured_host != "" do
        configured_host
      else
        # Replace localhost with 127.0.0.1 for local development
        # Many OAuth providers (like Spotify) require 127.0.0.1 instead of localhost
        case conn.host do
          "localhost" -> "127.0.0.1"
          other -> other
        end
      end

    scheme = if conn.scheme == :https, do: "https", else: "http"
    port = if conn.port in [80, 443], do: "", else: ":#{conn.port}"

    "#{scheme}://#{host}#{port}/auth/widget-integrations/callback"
  end

  # Authorization helper - verifies user is authenticated and belongs to organization
  defp authorize_user_for_organization(conn, organization_id) do
    case conn.assigns[:current_user] do
      nil ->
        {:error, :not_authenticated}

      user ->
        # Check if user has any role in the organization (admin, manager, regular, or guest)
        case Organizations.get_user_role(organization_id, user.id) do
          nil -> {:error, :not_authorized}
          _role -> :ok
        end
    end
  end

  defp validate_required_params(nil, param), do: {:error, :missing_param, param}
  defp validate_required_params("", param), do: {:error, :missing_param, param}
  defp validate_required_params(_, _), do: :ok

  defp redirect_with_success(conn, base_url, context) do
    params = %{
      "oauth_status" => "success",
      "integration_id" => context.integration_id
    }

    params =
      if context.widget_config_id do
        Map.put(params, "widget_config_id", context.widget_config_id)
      else
        params
      end

    url = append_query_params(base_url, params)
    redirect(conn, external: url)
  end

  defp redirect_with_error(conn, base_url, message) do
    params = %{
      "oauth_status" => "error",
      "error_message" => message
    }

    url = append_query_params(base_url, params)
    redirect(conn, external: url)
  end

  defp append_query_params(url, params) do
    uri = URI.parse(url)
    existing_params = URI.decode_query(uri.query || "")
    new_params = Map.merge(existing_params, params)
    query = URI.encode_query(new_params)

    %{uri | query: query}
    |> URI.to_string()
  end

  # Extract integration_id and redirect_url from URL-safe Base64-encoded state parameter
  defp extract_context_from_state(nil), do: {:error, :missing_state}

  defp extract_context_from_state(state) do
    case Base.url_decode64(state, padding: false) do
      {:ok, json} ->
        case Jason.decode(json) do
          {:ok, %{"integration_id" => integration_id} = data} when not is_nil(integration_id) ->
            redirect_url = Map.get(data, "redirect_url")
            {:ok, integration_id, redirect_url}

          {:ok, _} ->
            {:error, :missing_integration_id}

          {:error, _} ->
            {:error, :invalid_json}
        end

      :error ->
        {:error, :invalid_base64}
    end
  end

  # Extract just the redirect_url from state (for error handling)
  defp extract_redirect_url_from_state(nil), do: nil

  defp extract_redirect_url_from_state(state) do
    case Base.url_decode64(state, padding: false) do
      {:ok, json} ->
        case Jason.decode(json) do
          {:ok, data} -> Map.get(data, "redirect_url")
          _ -> nil
        end

      :error ->
        nil
    end
  end
end

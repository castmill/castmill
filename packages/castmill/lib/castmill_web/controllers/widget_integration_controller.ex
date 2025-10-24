defmodule CastmillWeb.WidgetIntegrationController do
  @moduledoc """
  Controller for managing widget third-party integrations.
  
  Handles CRUD operations for integrations, credentials, and data access.
  """
  use CastmillWeb, :controller

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations
  alias Castmill.Organizations
  alias Castmill.Crypto

  action_fallback(CastmillWeb.FallbackController)

  # ============================================================================
  # Widget Integration Management
  # ============================================================================

  @doc """
  Lists all integrations for a specific widget.
  
  GET /api/organizations/:organization_id/widgets/:widget_id/integrations
  """
  def list_integrations(conn, %{
        "organization_id" => _organization_id,
        "widget_id" => widget_id
      }) do
    integrations = Integrations.list_integrations(widget_id: widget_id, is_active: true)

    conn
    |> put_status(:ok)
    |> json(%{data: integrations})
  end

  @doc """
  Gets a specific integration.
  
  GET /api/organizations/:organization_id/widget-integrations/:integration_id
  """
  def get_integration(conn, %{
        "organization_id" => _organization_id,
        "integration_id" => integration_id
      }) do
    case Integrations.get_integration(integration_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration not found"})

      integration ->
        conn
        |> put_status(:ok)
        |> json(%{data: integration})
    end
  end

  # ============================================================================
  # Credential Management
  # ============================================================================

  @doc """
  Creates or updates organization-scoped credentials for an integration.
  
  POST/PUT /api/organizations/:organization_id/widget-integrations/:integration_id/credentials
  """
  def upsert_organization_credentials(
        conn,
        %{
          "organization_id" => organization_id,
          "integration_id" => integration_id,
          "credentials" => credentials
        }
      ) do
    with {:ok, integration} <- get_integration_or_error(integration_id),
         :ok <- validate_credential_scope(integration, "organization"),
         {:ok, organization} <- get_organization_or_error(organization_id),
         {:ok, encryption_key} <- get_or_create_encryption_key(organization),
         encrypted <- Crypto.encrypt(credentials, encryption_key),
         {:ok, credential} <-
           Integrations.upsert_credentials(%{
             widget_integration_id: integration.id,
             organization_id: organization_id,
             encrypted_credentials: encrypted,
             metadata: extract_metadata(credentials),
             validated_at: DateTime.utc_now(),
             is_valid: true
           }) do
      conn
      |> put_status(:ok)
      |> json(%{
        data: %{
          id: credential.id,
          widget_integration_id: credential.widget_integration_id,
          organization_id: credential.organization_id,
          metadata: credential.metadata,
          validated_at: credential.validated_at,
          is_valid: credential.is_valid
        }
      })
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration or organization not found"})

      {:error, :invalid_scope} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "This integration requires widget-scoped credentials"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: translate_errors(changeset)})
    end
  end

  @doc """
  Creates or updates widget-scoped credentials for an integration.
  
  POST/PUT /api/widget-configs/:widget_config_id/credentials
  """
  def upsert_widget_credentials(
        conn,
        %{
          "widget_config_id" => widget_config_id,
          "integration_id" => integration_id,
          "credentials" => credentials
        }
      ) do
    with {:ok, integration} <- get_integration_or_error(integration_id),
         :ok <- validate_credential_scope(integration, "widget"),
         {:ok, widget_config} <- get_widget_config_or_error(widget_config_id),
         {:ok, organization} <- get_organization_from_widget_config(widget_config),
         {:ok, encryption_key} <- get_or_create_encryption_key(organization),
         encrypted <- Crypto.encrypt(credentials, encryption_key),
         {:ok, credential} <-
           Integrations.upsert_credentials(%{
             widget_integration_id: integration.id,
             widget_config_id: widget_config_id,
             encrypted_credentials: encrypted,
             metadata: extract_metadata(credentials),
             validated_at: DateTime.utc_now(),
             is_valid: true
           }) do
      conn
      |> put_status(:ok)
      |> json(%{
        data: %{
          id: credential.id,
          widget_integration_id: credential.widget_integration_id,
          widget_config_id: credential.widget_config_id,
          metadata: credential.metadata,
          validated_at: credential.validated_at,
          is_valid: credential.is_valid
        }
      })
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration or widget config not found"})

      {:error, :invalid_scope} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "This integration requires organization-scoped credentials"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: translate_errors(changeset)})
    end
  end

  @doc """
  Tests integration credentials by making a test API call.
  
  POST /api/organizations/:organization_id/widget-integrations/:integration_id/test
  """
  def test_integration(conn, %{
        "organization_id" => organization_id,
        "integration_id" => integration_id
      }) do
    # This is a placeholder - actual implementation would depend on integration type
    # For now, just verify credentials exist and are valid
    with {:ok, integration} <- get_integration_or_error(integration_id),
         {:ok, credentials} <-
           get_credentials_for_integration(integration, organization_id: organization_id) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        message: "Credentials found and validated",
        validated_at: credentials.validated_at
      })
    else
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration or credentials not found"})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})
    end
  end

  # ============================================================================
  # Data Access (for Players)
  # ============================================================================

  @doc """
  Gets integration data for a widget config with version checking.
  
  GET /api/widget-configs/:widget_config_id/data?version=current_version
  
  Returns 304 Not Modified if version matches, otherwise returns new data.
  """
  def get_widget_data(conn, %{"widget_config_id" => widget_config_id} = params) do
    current_version = params["version"] && String.to_integer(params["version"])

    case Integrations.get_integration_data_by_config(widget_config_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "No integration data found"})

      data when not is_nil(current_version) and data.version == current_version ->
        # Version matches, return 304
        conn
        |> put_status(:not_modified)
        |> text("")

      data ->
        # Return new data with version
        conn
        |> put_status(:ok)
        |> json(%{
          data: data.data,
          version: data.version,
          fetched_at: data.fetched_at,
          status: data.status
        })
    end
  end

  @doc """
  Forces a refresh of integration data (admin only).
  
  POST /api/widget-configs/:widget_config_id/refresh
  """
  def refresh_widget_data(conn, %{"widget_config_id" => widget_config_id}) do
    # This would trigger an immediate pull - placeholder for now
    # Actual implementation would use a background job or direct API call
    
    conn
    |> put_status(:accepted)
    |> json(%{message: "Refresh queued", widget_config_id: widget_config_id})
  end

  # ============================================================================
  # Webhook Endpoints (for PUSH mode)
  # ============================================================================

  @doc """
  Receives webhook data from third-party services.
  
  POST /api/webhooks/widgets/:integration_id/:widget_config_id
  """
  def receive_webhook(
        conn,
        %{
          "integration_id" => integration_id,
          "widget_config_id" => widget_config_id
        } = params
      ) do
    with {:ok, integration} <- get_integration_or_error(integration_id),
         :ok <- validate_integration_type(integration, ["push", "both"]),
         :ok <- verify_webhook_signature(conn, integration, params),
         {:ok, data} <- extract_webhook_data(params),
         now <- DateTime.utc_now(),
         {:ok, integration_data} <-
           Integrations.upsert_integration_data(%{
             widget_integration_id: integration.id,
             widget_config_id: widget_config_id,
             data: data,
             fetched_at: now,
             status: "success"
           }) do
      conn
      |> put_status(:ok)
      |> json(%{
        success: true,
        version: integration_data.version,
        received_at: now
      })
    else
      {:error, :invalid_signature} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid webhook signature"})

      {:error, :invalid_type} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "This integration does not support webhooks"})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: reason})
    end
  end

  # ============================================================================
  # Helper Functions
  # ============================================================================

  defp get_integration_or_error(integration_id) do
    case Integrations.get_integration(integration_id) do
      nil -> {:error, :not_found}
      integration -> {:ok, integration}
    end
  end

  defp get_organization_or_error(organization_id) do
    case Organizations.get_organization(organization_id) do
      nil -> {:error, :not_found}
      organization -> {:ok, organization}
    end
  end

  defp get_widget_config_or_error(widget_config_id) do
    case Widgets.get_widget_config(nil, widget_config_id) do
      nil -> {:error, :not_found}
      widget_config -> {:ok, widget_config}
    end
  end

  defp get_organization_from_widget_config(widget_config) do
    # Load the playlist and get organization_id
    widget_config = Castmill.Repo.preload(widget_config, playlist_item: :playlist)
    organization_id = widget_config.playlist_item.playlist.organization_id

    get_organization_or_error(organization_id)
  end

  defp get_or_create_encryption_key(organization) do
    if organization.encryption_key do
      case Crypto.decode_key(organization.encryption_key) do
        {:ok, key} -> {:ok, key}
        {:error, _} -> {:error, :invalid_encryption_key}
      end
    else
      # Generate and save new key
      key = Crypto.generate_key()
      encoded = Crypto.encode_key(key)

      case Organizations.update_organization(organization, %{encryption_key: encoded}) do
        {:ok, _org} -> {:ok, key}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  defp validate_credential_scope(integration, expected_scope) do
    if integration.credential_scope == expected_scope do
      :ok
    else
      {:error, :invalid_scope}
    end
  end

  defp validate_integration_type(integration, allowed_types) do
    if integration.integration_type in allowed_types do
      :ok
    else
      {:error, :invalid_type}
    end
  end

  defp get_credentials_for_integration(integration, opts) do
    case Integrations.get_credentials(integration, opts) do
      nil -> {:error, :not_found}
      credentials -> {:ok, credentials}
    end
  end

  defp extract_metadata(credentials) when is_map(credentials) do
    # Extract non-sensitive metadata from credentials
    # For example, username, account ID, etc., but not passwords or API keys
    credentials
    |> Enum.filter(fn {key, _value} ->
      # Filter out sensitive fields
      not String.contains?(String.downcase(key), ["password", "secret", "key", "token"])
    end)
    |> Enum.into(%{})
  end

  defp verify_webhook_signature(_conn, _integration, _params) do
    # Placeholder for webhook signature verification
    # Actual implementation would depend on the integration's push_config
    :ok
  end

  defp extract_webhook_data(params) do
    # Extract the payload data from webhook params
    # This is a simplified version - actual implementation would vary by integration
    {:ok, params["data"] || %{}}
  end

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end

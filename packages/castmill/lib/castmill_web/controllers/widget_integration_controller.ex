defmodule CastmillWeb.WidgetIntegrationController do
  @moduledoc """
  Controller for managing widget third-party integrations.

  Handles CRUD operations for integrations, credentials, and data access.

  ## Authorization

  Integration management requires specific permissions:
  - List/Show integrations: :admin, :manager, :member (via widgets resource)
  - Manage credentials (create/update/delete): :admin, :manager only
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Widgets
  alias Castmill.Widgets.Integrations
  alias Castmill.Organizations
  alias Castmill.Crypto
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  # Authorization plug for credential management actions
  # Note: upsert_widget_credentials is NOT included here because it doesn't have
  # organization_id in URL params - authorization is done inside the function
  plug(
    AuthorizeDash,
    %{}
    when action in [
           :upsert_organization_credentials,
           :delete_organization_credentials,
           :test_integration
         ]
  )

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"organization_id" => organization_id})
      when action in [
             :upsert_organization_credentials,
             :delete_organization_credentials,
             :test_integration
           ] do
    # Only admin and manager can manage integration credentials
    role = Organizations.get_user_role(organization_id, actor_id)

    if role in [:admin, :manager] do
      {:ok, true}
    else
      {:ok, false}
    end
  end

  # Default: allow other actions (list/show are public for authenticated users)
  def check_access(_actor_id, _action, _params), do: {:ok, true}

  # ============================================================================
  # Widget Integration Management
  # ============================================================================

  @doc """
  Lists all integrations for a specific widget.

  GET /dashboard/organizations/:organization_id/widgets/:widget_id/integrations

  The widget_id can be either a numeric ID or a slug.
  Each integration includes a `has_network_credentials` flag indicating whether
  network-level credentials are configured.
  """
  def list_integrations(conn, %{
        "organization_id" => organization_id,
        "widget_id" => widget_id_or_slug
      }) do
    # Try to parse as integer (widget_id), otherwise treat as slug
    widget_id = resolve_widget_id(widget_id_or_slug)

    case widget_id do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      id ->
        integrations = Integrations.list_integrations(widget_id: id, is_active: true)

        # Add has_network_credentials flag to each integration and serialize properly
        integrations_with_network_status =
          Enum.map(integrations, fn integration ->
            has_network_credentials = check_network_credentials(organization_id, integration.id)

            integration
            |> Map.from_struct()
            |> Map.drop([:__meta__, :credentials, :widget, :data_records])
            |> Map.put(:has_network_credentials, has_network_credentials)
          end)

        conn
        |> put_status(:ok)
        |> json(%{data: integrations_with_network_status})
    end
  end

  @doc """
  Checks if a widget's required integration credentials are configured.

  GET /dashboard/organizations/:organization_id/widgets/:widget_id/credentials-status

  Returns status information about the widget's integration credentials:
  - `configured`: true if all required credentials are set up
  - `missing_integrations`: list of integration names that need credentials

  This is used by the frontend to validate before adding a widget to a playlist.
  """
  def check_widget_credentials(conn, %{
        "organization_id" => organization_id,
        "widget_id" => widget_id_or_slug
      }) do
    widget_id = resolve_widget_id(widget_id_or_slug)

    case widget_id do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Widget not found"})

      id ->
        # Use the same validation function that's used when inserting items
        case Widgets.validate_integration_credentials_for_widget(id, organization_id) do
          :ok ->
            conn
            |> put_status(:ok)
            |> json(%{
              data: %{
                configured: true,
                missing_integrations: []
              }
            })

          {:error, :missing_integration_credentials} ->
            # Find which integrations are missing credentials
            integrations = Integrations.list_integrations(widget_id: id, is_active: true)

            missing_integrations =
              integrations
              |> Enum.filter(&integration_requires_credentials?/1)
              |> Enum.filter(fn integration ->
                is_nil(
                  Integrations.get_credentials_by_scope(integration.id,
                    organization_id: organization_id
                  )
                )
              end)
              |> Enum.map(& &1.name)

            conn
            |> put_status(:ok)
            |> json(%{
              data: %{
                configured: false,
                missing_integrations: missing_integrations
              }
            })
        end
    end
  end

  # Checks if an integration requires credentials based on its credential_schema
  defp integration_requires_credentials?(integration) do
    credential_schema = integration.credential_schema

    cond do
      is_nil(credential_schema) -> false
      credential_schema == %{} -> false
      Map.has_key?(credential_schema, "auth_type") -> true
      Map.has_key?(credential_schema, "fields") && credential_schema["fields"] != %{} -> true
      true -> false
    end
  end

  # Resolves a widget ID from either a numeric ID string or a slug
  defp resolve_widget_id(id_or_slug) do
    case Integer.parse(id_or_slug) do
      {id, ""} ->
        id

      _ ->
        # Not an integer, try to find by slug
        case Widgets.get_widget_by_slug(id_or_slug) do
          nil -> nil
          widget -> widget.id
        end
    end
  end

  @doc """
  Gets a specific integration with network credential status.

  GET /api/organizations/:organization_id/widget-integrations/:integration_id

  Returns the integration with a `has_network_credentials` flag indicating
  whether network-level credentials are configured (meaning users don't need
  to enter client_id/client_secret).
  """
  def get_integration(conn, %{
        "organization_id" => organization_id,
        "integration_id" => integration_id
      }) do
    case Integrations.get_integration(integration_id) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Integration not found"})

      integration ->
        # Check if network credentials are configured
        has_network_credentials = check_network_credentials(organization_id, integration.id)

        # Get organization credentials to check status
        credential_info = get_credential_info(organization_id, integration.id)

        # Build response with additional flag, excluding associations that may not be loaded
        integration_data =
          integration
          |> Map.from_struct()
          |> Map.drop([:__meta__, :credentials, :widget, :data_records])
          |> Map.put(:has_network_credentials, has_network_credentials)
          |> Map.put(:credential, credential_info)

        conn
        |> put_status(:ok)
        |> json(%{data: integration_data})
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
    current_user = conn.assigns[:current_user]

    with {:ok, integration} <- get_integration_or_error(integration_id),
         :ok <- validate_credential_scope(integration, "widget"),
         {:ok, widget_config} <- get_widget_config_or_error(widget_config_id),
         {:ok, organization} <- get_organization_from_widget_config(widget_config),
         :ok <- authorize_credential_management(current_user, organization),
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

      {:error, :unauthorized} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "You don't have permission to manage credentials"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: translate_errors(changeset)})
    end
  end

  @doc """
  Deletes organization-scoped credentials for an integration (disconnect).

  DELETE /dashboard/organizations/:organization_id/widget-integrations/:integration_id/credentials
  """
  def delete_organization_credentials(conn, %{
        "organization_id" => organization_id,
        "integration_id" => integration_id
      }) do
    case Integrations.delete_organization_credentials(organization_id, integration_id) do
      {:ok, _} ->
        conn
        |> put_status(:ok)
        |> json(%{message: "Credentials deleted successfully"})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Credentials not found"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to delete credentials: #{inspect(reason)}"})
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

  GET /dashboard/widget-configs/:widget_config_id/data?version=current_version

  Authorization: User must have access to view playlists in the organization
  that owns the widget config.

  Returns 304 Not Modified if version matches, otherwise returns new data.
  """
  def get_widget_data(conn, %{"widget_config_id" => widget_config_id} = params) do
    current_actor = conn.assigns[:current_actor] || conn.assigns[:current_user]

    if is_nil(current_actor) do
      conn
      |> put_status(:unauthorized)
      |> json(%{error: "Authentication required"})
    else
      # Get the organization ID for this widget config
      case Widgets.get_organization_id_for_widget_config(widget_config_id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Widget config not found"})

        organization_id ->
          # Check if user has access to view playlists in this organization
          if Organizations.has_access(organization_id, current_actor.id, "playlists", :show) do
            fetch_and_return_widget_data(conn, widget_config_id, organization_id, params)
          else
            conn
            |> put_status(:forbidden)
            |> json(%{error: "You don't have access to this widget data"})
          end
      end
    end
  end

  defp fetch_and_return_widget_data(conn, widget_config_id, organization_id, params) do
    current_version = params["version"] && String.to_integer(params["version"])

    # Try widget-config-specific data first, then fall back to org-level shared data
    integration_data =
      case Integrations.get_integration_data_by_config(widget_config_id) do
        %Integrations.WidgetIntegrationData{} = data ->
          data

        nil ->
          # Try organization-level shared data
          # Get the widget_id for this config to look up shared data
          case Widgets.get_widget_id_for_config(widget_config_id) do
            nil ->
              nil

            widget_id ->
              Integrations.get_integration_data_for_widget_in_org(organization_id, widget_id)
          end
      end

    case integration_data do
      nil ->
        # No integration data found - this is normal for widgets without integrations
        # Return empty data with version 0 instead of 404
        conn
        |> put_status(:ok)
        |> json(%{data: nil, version: 0, status: "no_integration"})

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

  # Authorize credential management - requires admin or manager role
  defp authorize_credential_management(user, organization) do
    role = Organizations.get_user_role(organization.id, user.id)

    if role in [:admin, :manager] do
      :ok
    else
      {:error, :unauthorized}
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

  # Check if network-level credentials are configured for an integration
  defp check_network_credentials(organization_id, integration_id) do
    case Organizations.get_organization(organization_id) do
      nil ->
        false

      org when is_nil(org.network_id) ->
        false

      org ->
        Integrations.has_network_credentials?(org.network_id, integration_id)
    end
  end

  # Get credential status info for an organization's integration
  defp get_credential_info(organization_id, integration_id) do
    case Integrations.get_credentials_by_scope(integration_id, organization_id: organization_id) do
      nil ->
        nil

      credential ->
        %{
          is_valid: credential.is_valid,
          validated_at: credential.validated_at,
          has_credentials: credential.encrypted_credentials != nil
        }
    end
  end
end

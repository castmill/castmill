defmodule Castmill.Widgets.Integrations do
  @moduledoc """
  The Widgets Integrations context.

  Provides functions for managing widget third-party integrations,
  credentials, and integration data.
  """
  import Ecto.Query, warn: false

  require Logger

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations.{
    WidgetIntegration,
    WidgetIntegrationCredential,
    WidgetIntegrationData,
    NetworkIntegrationCredential
  }

  # ============================================================================
  # Integration Data Broadcasting
  # ============================================================================

  @doc """
  Broadcasts a widget config data update to authorized users in the organization.

  This notification is sent when integration data is updated for widgets that use
  organization-level credentials. Users receive this update because:
  1. They are members of the organization (subscribed to `organization:<org_id>` channel)
  2. They have at least "list" access to playlists (which contain widget_configs)

  Use cases:
  - Dashboard users previewing widgets with live integration data (e.g., Spotify Now Playing)
  - Real-time updates to widget previews without manual refresh

  The broadcast payload includes:
  - `widget_id` - The widget type identifier (e.g., "spotify-now-playing")
  - `integration_id` - The integration that provided the data
  - `discriminator_id` - The cache key (for data routing on the client)
  - `data` - The updated widget data

  ## Security
  Only users who are members of the organization will receive this notification.
  The notification is broadcast to the `organization:<org_id>` PubSub topic,
  which users are only subscribed to if they belong to the organization.

  ## Examples

      iex> broadcast_widget_config_data_update(org_id, widget_id, integration_id, data, discriminator_id)
      :ok
  """
  def broadcast_widget_config_data_update(organization_id, widget_id, integration_id, data, discriminator_id) do
    payload = %{
      type: "widget_config_data_update",
      widget_id: widget_id,
      integration_id: integration_id,
      discriminator_id: discriminator_id,
      data: data,
      updated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    # Broadcast to organization channel (for dashboard previews)
    # Only users who are members of this organization will receive this
    Phoenix.PubSub.broadcast(
      Castmill.PubSub,
      "organization:#{organization_id}",
      {:widget_config_data_update, payload}
    )

    Logger.debug("Broadcasted widget config data update to organization:#{organization_id}")

    :ok
  end

  # ============================================================================
  # Widget Integrations
  # ============================================================================

  @doc """
  Returns the list of widget integrations.

  ## Examples

      iex> list_integrations()
      [%WidgetIntegration{}, ...]

      iex> list_integrations(widget_id: "widget-123")
      [%WidgetIntegration{}, ...]
  """
  def list_integrations(filters \\ []) do
    WidgetIntegration.base_query()
    |> apply_filters(filters)
    |> Repo.all()
  end

  @doc """
  Gets a single widget integration.

  Returns `nil` if the integration does not exist.

  ## Examples

      iex> get_integration(123)
      %WidgetIntegration{}

      iex> get_integration(456)
      nil
  """
  def get_integration(id), do: Repo.get(WidgetIntegration, id)

  @doc """
  Gets a widget integration by widget_id and name.

  ## Examples

      iex> get_integration_by_widget_and_name("widget-123", "openweather")
      %WidgetIntegration{}
  """
  def get_integration_by_widget_and_name(widget_id, name) do
    WidgetIntegration.base_query()
    |> where([wi], wi.widget_id == ^widget_id and wi.name == ^name)
    |> Repo.one()
  end

  @doc """
  Creates a widget integration.

  ## Examples

      iex> create_integration(%{field: value})
      {:ok, %WidgetIntegration{}}

      iex> create_integration(%{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def create_integration(attrs \\ %{}) do
    %WidgetIntegration{}
    |> WidgetIntegration.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a widget integration.

  ## Examples

      iex> update_integration(integration, %{field: new_value})
      {:ok, %WidgetIntegration{}}

      iex> update_integration(integration, %{field: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def update_integration(%WidgetIntegration{} = integration, attrs) do
    integration
    |> WidgetIntegration.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a widget integration.

  ## Examples

      iex> delete_integration(integration)
      {:ok, %WidgetIntegration{}}

      iex> delete_integration(integration)
      {:error, %Ecto.Changeset{}}
  """
  def delete_integration(%WidgetIntegration{} = integration) do
    Repo.delete(integration)
  end

  # ============================================================================
  # Widget Integration Credentials
  # ============================================================================

  @doc """
  Gets credentials for an integration.

  Returns organization-scoped or widget-scoped credentials based on the integration's
  credential_scope and the provided parameters.

  ## Examples

      iex> get_credentials(integration, organization_id: "org-123")
      %WidgetIntegrationCredential{}

      iex> get_credentials(integration, widget_config_id: "config-456")
      %WidgetIntegrationCredential{}
  """
  def get_credentials(%WidgetIntegration{} = integration, opts) do
    query = WidgetIntegrationCredential.base_query()
    query = where(query, [wic], wic.widget_integration_id == ^integration.id)

    cond do
      org_id = Keyword.get(opts, :organization_id) ->
        query
        |> where([wic], wic.organization_id == ^org_id)
        |> Repo.one()

      widget_config_id = Keyword.get(opts, :widget_config_id) ->
        query
        |> where([wic], wic.widget_config_id == ^widget_config_id)
        |> Repo.one()

      true ->
        nil
    end
  end

  @doc """
  Creates or updates credentials for an integration.

  ## Examples

      iex> upsert_credentials(%{
      ...>   widget_integration_id: 123,
      ...>   organization_id: "org-123",
      ...>   encrypted_credentials: <<...>>
      ...> })
      {:ok, %WidgetIntegrationCredential{}}
  """
  def upsert_credentials(attrs) do
    # Check if credentials already exist
    existing =
      if org_id = attrs[:organization_id] do
        get_credentials_by_scope(attrs[:widget_integration_id], organization_id: org_id)
      else
        get_credentials_by_scope(
          attrs[:widget_integration_id],
          widget_config_id: attrs[:widget_config_id]
        )
      end

    if existing do
      update_credentials(existing, attrs)
    else
      create_credentials(attrs)
    end
  end

  @doc """
  Creates new credentials.
  """
  def create_credentials(attrs \\ %{}) do
    %WidgetIntegrationCredential{}
    |> WidgetIntegrationCredential.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates credentials.
  """
  def update_credentials(%WidgetIntegrationCredential{} = credential, attrs) do
    credential
    |> WidgetIntegrationCredential.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes credentials.
  """
  def delete_credentials(%WidgetIntegrationCredential{} = credential) do
    Repo.delete(credential)
  end

  @doc """
  Deletes organization-scoped credentials for an integration.

  ## Parameters

    - organization_id: The organization ID
    - integration_id: The widget integration ID

  ## Returns

    - `{:ok, credential}` - Deleted credential
    - `{:error, :not_found}` - No credentials found
  """
  def delete_organization_credentials(organization_id, integration_id) do
    case get_credentials_by_scope(integration_id, organization_id: organization_id) do
      nil -> {:error, :not_found}
      credential -> delete_credentials(credential)
    end
  end

  @doc """
  Deletes widget-scoped credentials for an integration.

  ## Parameters

    - widget_config_id: The widget config ID
    - integration_id: The widget integration ID

  ## Returns

    - `{:ok, credential}` - Deleted credential
    - `{:error, :not_found}` - No credentials found
  """
  def delete_widget_credentials(widget_config_id, integration_id) do
    case get_credentials_by_scope(integration_id, widget_config_id: widget_config_id) do
      nil -> {:error, :not_found}
      credential -> delete_credentials(credential)
    end
  end

  # ============================================================================
  # Convenience Functions for OAuth and Credential Management
  # ============================================================================

  @doc """
  Gets decrypted organization-scoped credentials for an integration.

  Uses the organization's encryption key to decrypt stored credentials.

  ## Parameters

    - organization_id: The organization ID
    - integration_id: The widget integration ID

  ## Returns

    - `{:ok, credentials_map}` - Decrypted credentials
    - `{:error, :not_found}` - No credentials stored
    - `{:error, reason}` - Decryption or other error
  """
  def get_organization_credentials(organization_id, integration_id) do
    credential = get_credentials_by_scope(integration_id, organization_id: organization_id)

    case credential do
      nil ->
        {:error, :not_found}

      %WidgetIntegrationCredential{encrypted_credentials: encrypted} when is_binary(encrypted) ->
        with {:ok, organization} <- fetch_organization(organization_id),
             {:ok, encryption_key} <- get_or_create_encryption_key(organization),
             {:ok, credentials} <- Castmill.Crypto.decrypt(encrypted, encryption_key) do
          {:ok, credentials}
        end

      _ ->
        {:error, :not_found}
    end
  end

  @doc """
  Creates or updates encrypted organization-scoped credentials.

  Encrypts the credentials using the organization's encryption key.

  ## Parameters

    - organization_id: The organization ID
    - integration_id: The widget integration ID
    - credentials: Map of credentials to store

  ## Returns

    - `{:ok, credential}` - Stored credential record
    - `{:error, reason}` - Storage or encryption error
  """
  def upsert_organization_credentials(organization_id, integration_id, credentials)
      when is_map(credentials) do
    with {:ok, organization} <- fetch_organization(organization_id),
         {:ok, encryption_key} <- get_or_create_encryption_key(organization),
         encrypted <- Castmill.Crypto.encrypt(credentials, encryption_key) do
      upsert_credentials(%{
        widget_integration_id: integration_id,
        organization_id: organization_id,
        encrypted_credentials: encrypted,
        is_valid: true,
        validated_at: DateTime.utc_now()
      })
    end
  end

  @doc """
  Creates or updates encrypted widget-scoped credentials.

  Uses the organization's encryption key for the widget's organization.

  ## Parameters

    - widget_config_id: The widget config ID
    - integration_id: The widget integration ID
    - credentials: Map of credentials to store

  ## Returns

    - `{:ok, credential}` - Stored credential record
    - `{:error, reason}` - Storage or encryption error
  """
  def upsert_widget_credentials(widget_config_id, integration_id, credentials)
      when is_map(credentials) do
    # Widget configs belong to organizations through playlists
    # We need to get the organization to access the encryption key
    with {:ok, organization_id} <- get_organization_for_widget_config(widget_config_id),
         {:ok, organization} <- fetch_organization(organization_id),
         {:ok, encryption_key} <- get_or_create_encryption_key(organization),
         encrypted <- Castmill.Crypto.encrypt(credentials, encryption_key) do
      upsert_credentials(%{
        widget_integration_id: integration_id,
        widget_config_id: widget_config_id,
        encrypted_credentials: encrypted,
        is_valid: true,
        validated_at: DateTime.utc_now()
      })
    end
  end

  defp fetch_organization(organization_id) do
    case Castmill.Organizations.get_organization(organization_id) do
      nil -> {:error, :organization_not_found}
      org -> {:ok, org}
    end
  end

  @doc false
  # Gets or creates the encryption key for an organization.
  # The key is stored Base64-encoded in the database but returned as raw bytes.
  defp get_or_create_encryption_key(organization) do
    if organization.encryption_key do
      Castmill.Crypto.decode_key(organization.encryption_key)
    else
      # Generate and save new key
      key = Castmill.Crypto.generate_key()
      encoded = Castmill.Crypto.encode_key(key)

      case Castmill.Organizations.update_organization(organization, %{encryption_key: encoded}) do
        {:ok, _org} -> {:ok, key}
        {:error, changeset} -> {:error, changeset}
      end
    end
  end

  defp get_organization_for_widget_config(widget_config_id) do
    # Widget configs are linked to medias, which belong to organizations
    query =
      from wc in Castmill.Widgets.WidgetConfig,
        join: m in Castmill.Resources.Media,
        on: m.id == wc.media_id,
        where: wc.id == ^widget_config_id,
        select: m.organization_id

    case Repo.one(query) do
      nil -> {:error, :widget_config_not_found}
      organization_id -> {:ok, organization_id}
    end
  end

  # ============================================================================
  # Discriminator-based Data Caching
  # ============================================================================

  @doc ~S"""
  Computes the discriminator ID for integration data caching.

  The discriminator determines how integration data is grouped and shared:

  - `"organization"` - All widgets in the org share data: discriminator = "org:#{org_id}"
  - `"widget_option"` - Widgets with same option value share: discriminator = "opt:#{option_value}"
  - `"widget_config"` - Each widget unique: discriminator = "cfg:#{widget_config_id}"

  ## Parameters

    - integration: The WidgetIntegration with discriminator_type and discriminator_key
    - organization_id: The organization ID
    - widget_config_id: The widget config ID (optional for org-level)
    - widget_options: Map of widget options (required for widget_option type)

  ## Returns

    - `{:ok, discriminator_id}` on success
    - `{:error, reason}` if required data is missing
  """
  def compute_discriminator_id(%WidgetIntegration{} = integration, organization_id, widget_config_id \\ nil, widget_options \\ %{}) do
    case integration.discriminator_type do
      "organization" ->
        {:ok, "org:#{organization_id}"}

      "widget_option" ->
        key = integration.discriminator_key
        case Map.get(widget_options, key) || Map.get(widget_options, String.to_atom(key)) do
          nil -> {:error, {:missing_option, key}}
          value -> {:ok, "opt:#{value}"}
        end

      "widget_config" ->
        case widget_config_id do
          nil -> {:error, :widget_config_required}
          id -> {:ok, "cfg:#{id}"}
        end

      nil ->
        # Legacy fallback - treat as widget_config
        case widget_config_id do
          nil -> {:ok, "org:#{organization_id}"}
          id -> {:ok, "cfg:#{id}"}
        end
    end
  end

  @doc """
  Gets or fetches integration data using discriminator-based caching.

  This is the main entry point for widgets to get integration data:
  1. Computes the discriminator_id based on integration configuration
  2. Checks cache for existing data
  3. If cached data is fresh enough, returns it
  4. Otherwise fetches new data from the integration endpoint
  5. Updates cache and returns the data

  ## Parameters

    - integration_id: The widget integration ID
    - organization_id: The organization ID
    - opts: Options including:
      - `:widget_config_id` - The widget config ID
      - `:widget_options` - Map of widget options
      - `:max_age_seconds` - Max cache age before refresh (default: uses integration interval)

  ## Returns

    - `{:ok, data_map}` on success
    - `{:error, reason}` on failure
  """
  def get_or_fetch_integration_data(integration_id, organization_id, opts \\ []) do
    widget_config_id = Keyword.get(opts, :widget_config_id)
    widget_options = Keyword.get(opts, :widget_options, %{})

    with %WidgetIntegration{} = integration <- get_integration(integration_id),
         {:ok, discriminator_id} <- compute_discriminator_id(integration, organization_id, widget_config_id, widget_options) do

      # Check cache first
      cached = get_integration_data_by_discriminator(integration_id, discriminator_id)

      max_age = Keyword.get(opts, :max_age_seconds, integration.pull_interval_seconds || 300)

      case cached do
        %WidgetIntegrationData{} = data when not is_nil(data.fetched_at) ->
          age_seconds = DateTime.diff(DateTime.utc_now(), data.fetched_at)

          if age_seconds < max_age do
            # Cache hit - update last_used_at and return
            update_last_used(data)
            {:ok, data.data}
          else
            # Cache stale - fetch fresh data
            fetch_and_cache_data(integration, organization_id, discriminator_id, widget_config_id)
          end

        _ ->
          # No cache - fetch fresh data
          fetch_and_cache_data(integration, organization_id, discriminator_id, widget_config_id)
      end
    else
      nil -> {:error, :integration_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Gets integration data by discriminator ID.
  """
  def get_integration_data_by_discriminator(integration_id, discriminator_id) do
    WidgetIntegrationData.base_query()
    |> where([wid], wid.widget_integration_id == ^integration_id and wid.discriminator_id == ^discriminator_id)
    |> Repo.one()
  end

  @doc """
  Updates the last_used_at timestamp for cache entry tracking.
  """
  def update_last_used(%WidgetIntegrationData{} = data) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    data
    |> Ecto.Changeset.change(last_used_at: now)
    |> Repo.update()
  end

  @doc """
  Fetches data from integration endpoint and caches it.

  This is called when cache is stale or missing.
  """
  def fetch_and_cache_data(%WidgetIntegration{} = integration, organization_id, discriminator_id, widget_config_id) do
    # Get credentials for the fetch
    credentials_result = get_organization_credentials(organization_id, integration.id)

    case credentials_result do
      {:ok, credentials} ->
        # Build the fetch request
        case do_fetch_integration_data(integration, credentials) do
          {:ok, data} ->
            # Cache the result
            upsert_discriminator_data(%{
              widget_integration_id: integration.id,
              organization_id: organization_id,
              discriminator_id: discriminator_id,
              widget_config_id: widget_config_id,
              data: data,
              fetched_at: DateTime.utc_now() |> DateTime.truncate(:second),
              last_used_at: DateTime.utc_now() |> DateTime.truncate(:second),
              status: "ok"
            })
            {:ok, data}

          {:error, reason} ->
            # Cache the error state
            upsert_discriminator_data(%{
              widget_integration_id: integration.id,
              organization_id: organization_id,
              discriminator_id: discriminator_id,
              widget_config_id: widget_config_id,
              data: %{},
              fetched_at: DateTime.utc_now() |> DateTime.truncate(:second),
              last_used_at: DateTime.utc_now() |> DateTime.truncate(:second),
              status: "error",
              error_message: inspect(reason)
            })
            {:error, reason}
        end

      {:error, :not_found} ->
        {:error, :no_credentials}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Performs the actual HTTP fetch from integration endpoint.

  Override this for specific integrations with custom logic.
  """
  def do_fetch_integration_data(%WidgetIntegration{pull_endpoint: endpoint} = integration, credentials) when is_binary(endpoint) do
    # Build URL with any config parameters
    url = build_integration_url(endpoint, integration.pull_config, credentials)
    headers = build_integration_headers(integration.pull_config, credentials)

    case HTTPoison.get(url, headers, timeout: 30_000, recv_timeout: 30_000) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, data} -> {:ok, data}
          {:error, _} -> {:ok, %{"raw" => body}}
        end

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:http_error, status}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:request_failed, reason}}
    end
  end

  def do_fetch_integration_data(_integration, _credentials) do
    {:error, :no_pull_endpoint}
  end

  defp build_integration_url(endpoint, config, credentials) do
    # Replace placeholders in URL
    endpoint
    |> replace_placeholders(config)
    |> replace_placeholders(credentials)
  end

  defp build_integration_headers(config, credentials) do
    headers = Map.get(config, "headers", %{})

    Enum.map(headers, fn {key, value} ->
      {key, replace_placeholders(value, credentials)}
    end)
  end

  defp replace_placeholders(text, params) when is_binary(text) do
    Enum.reduce(params, text, fn {key, value}, acc ->
      String.replace(acc, "{{#{key}}}", to_string(value))
    end)
  end

  defp replace_placeholders(other, _params), do: other

  @doc """
  Creates or updates integration data using discriminator_id as the unique key.
  """
  def upsert_discriminator_data(attrs) do
    integration_id = attrs[:widget_integration_id]
    discriminator_id = attrs[:discriminator_id]

    existing = get_integration_data_by_discriminator(integration_id, discriminator_id)

    if existing do
      # Increment version on update
      attrs = Map.put(attrs, :version, existing.version + 1)
      update_integration_data(existing, attrs)
    else
      attrs = Map.put(attrs, :version, 1)
      create_integration_data(attrs)
    end
  end

  @doc """
  Deletes stale integration data entries.

  Removes cache entries that haven't been used in the specified number of days.
  This should be called periodically by a cleanup job.

  ## Parameters

    - days_old: Number of days since last use to consider stale (default: 30)

  ## Returns

    - `{:ok, count}` with number of deleted entries
  """
  def delete_stale_integration_data(days_old \\ 30) do
    cutoff = DateTime.utc_now() |> DateTime.add(-days_old * 24 * 60 * 60, :second)

    {count, _} =
      from(wid in WidgetIntegrationData,
        where: wid.last_used_at < ^cutoff or is_nil(wid.last_used_at)
      )
      |> Repo.delete_all()

    {:ok, count}
  end

  # ============================================================================
  # Widget Integration Data
  # ============================================================================

  @doc """
  Gets integration data for a specific widget config.

  ## Examples

      iex> get_integration_data(integration_id, widget_config_id)
      %WidgetIntegrationData{}
  """
  def get_integration_data(integration_id, widget_config_id) do
    WidgetIntegrationData.base_query()
    |> where(
      [wid],
      wid.widget_integration_id == ^integration_id and wid.widget_config_id == ^widget_config_id
    )
    |> Repo.one()
  end

  @doc """
  Gets integration data by widget config ID only (for player polling).

  ## Examples

      iex> get_integration_data_by_config("config-123")
      %WidgetIntegrationData{}
  """
  def get_integration_data_by_config(widget_config_id) do
    # Validate UUID before querying to avoid cast errors with integer IDs
    case Ecto.UUID.cast(widget_config_id) do
      {:ok, _uuid} ->
        WidgetIntegrationData.base_query()
        |> where([wid], wid.widget_config_id == ^widget_config_id)
        |> Repo.one()

      :error ->
        # Not a valid UUID (e.g., integer ID from older widget configs)
        nil
    end
  end

  @doc """
  Gets the most recent integration data for a widget in an organization.

  This is used when widgets share integration data at the organization level.
  For example, all Spotify widgets in an organization should show the same
  "Now Playing" data since they're connected to the same Spotify account.

  Looks up by:
  1. Finding the widget integration for the given widget
  2. First checking for organization-level data (organization_id set directly)
  3. Falling back to widget-config-level data if no org-level data exists

  Returns `nil` if no integration or data found.

  ## Examples

      iex> get_integration_data_for_widget_in_org("org-123", 7)
      %WidgetIntegrationData{}
  """
  def get_integration_data_for_widget_in_org(organization_id, widget_id) do
    # First, find the integration for this widget
    integration =
      WidgetIntegration.base_query()
      |> where([wi], wi.widget_id == ^widget_id)
      |> Repo.one()

    case integration do
      nil ->
        nil

      %WidgetIntegration{} = wi ->
        # First, try to get organization-level data (directly associated with org)
        org_level_data = get_organization_integration_data(organization_id, wi.id)

        case org_level_data do
          %WidgetIntegrationData{} = data ->
            data

          nil ->
            # Fall back to finding any widget config data in this org
            WidgetIntegrationData.base_query()
            |> join(:inner, [wid], wc in Castmill.Widgets.WidgetConfig, on: wid.widget_config_id == wc.id)
            |> join(:inner, [wid, wc], pi in Castmill.Resources.PlaylistItem, on: wc.playlist_item_id == pi.id)
            |> join(:inner, [wid, wc, pi], p in Castmill.Resources.Playlist, on: pi.playlist_id == p.id)
            |> where([wid, wc, pi, p], p.organization_id == ^organization_id)
            |> where([wid], wid.widget_integration_id == ^wi.id)
            |> order_by([wid], desc: wid.updated_at)
            |> limit(1)
            |> Repo.one()
        end
    end
  end

  @doc """
  Gets organization-level integration data.

  ## Examples

      iex> get_organization_integration_data("org-123", 1)
      %WidgetIntegrationData{}
  """
  def get_organization_integration_data(organization_id, integration_id) do
    # Use discriminator-based lookup
    discriminator_id = "org:#{organization_id}"
    get_integration_data_by_discriminator(integration_id, discriminator_id)
  end

  @doc """
  Creates or updates organization-level integration data.

  ## Examples

      iex> upsert_organization_integration_data("org-123", 1, %{"track_name" => "Song"})
      {:ok, %WidgetIntegrationData{}}
  """
  def upsert_organization_integration_data(organization_id, integration_id, data, opts \\ []) do
    # Use the discriminator-based lookup for organization-level data
    discriminator_id = "org:#{organization_id}"
    existing = get_integration_data_by_discriminator(integration_id, discriminator_id)

    now = DateTime.utc_now() |> DateTime.truncate(:second)
    status = Keyword.get(opts, :status, "ok")
    error_message = Keyword.get(opts, :error_message)

    attrs = %{
      widget_integration_id: integration_id,
      organization_id: organization_id,
      discriminator_id: discriminator_id,
      data: data,
      fetched_at: now,
      last_used_at: now,
      status: status,
      error_message: error_message
    }

    if existing do
      # Increment version on update
      attrs = Map.put(attrs, :version, existing.version + 1)
      update_integration_data(existing, attrs)
    else
      create_integration_data(attrs)
    end
  end

  @doc """
  Creates or updates integration data.

  Automatically increments version number when updating.

  ## Examples

      iex> upsert_integration_data(%{
      ...>   widget_integration_id: 123,
      ...>   widget_config_id: "config-456",
      ...>   data: %{"temperature" => 72},
      ...>   fetched_at: DateTime.utc_now()
      ...> })
      {:ok, %WidgetIntegrationData{}}
  """
  def upsert_integration_data(attrs) do
    existing = get_integration_data(attrs[:widget_integration_id], attrs[:widget_config_id])

    if existing do
      # Increment version on update
      attrs = Map.put(attrs, :version, existing.version + 1)
      update_integration_data(existing, attrs)
    else
      create_integration_data(attrs)
    end
  end

  @doc """
  Creates new integration data.
  """
  def create_integration_data(attrs \\ %{}) do
    %WidgetIntegrationData{}
    |> WidgetIntegrationData.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates integration data.
  """
  def update_integration_data(%WidgetIntegrationData{} = data, attrs) do
    data
    |> WidgetIntegrationData.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes integration data.
  """
  def delete_integration_data(%WidgetIntegrationData{} = data) do
    Repo.delete(data)
  end

  @doc """
  Lists all integration data that needs to be refreshed (for PULL mode).

  Returns data records where refresh_at is in the past.

  ## Examples

      iex> list_data_to_refresh()
      [%WidgetIntegrationData{}, ...]
  """
  def list_data_to_refresh do
    now = DateTime.utc_now()

    WidgetIntegrationData.base_query()
    |> where([wid], wid.refresh_at <= ^now)
    |> preload(:widget_integration)
    |> Repo.all()
  end

  # ============================================================================
  # Helper Functions
  # ============================================================================

  @doc """
  Gets credentials by scope (organization or widget config).

  ## Examples

      iex> get_credentials_by_scope(integration_id, organization_id: "org-123")
      %WidgetIntegrationCredential{}

      iex> get_credentials_by_scope(integration_id, widget_config_id: "config-456")
      %WidgetIntegrationCredential{}
  """
  def get_credentials_by_scope(integration_id, opts) do
    query = WidgetIntegrationCredential.base_query()
    query = where(query, [wic], wic.widget_integration_id == ^integration_id)

    cond do
      org_id = Keyword.get(opts, :organization_id) ->
        query
        |> where([wic], wic.organization_id == ^org_id)
        |> Repo.one()

      widget_config_id = Keyword.get(opts, :widget_config_id) ->
        query
        |> where([wic], wic.widget_config_id == ^widget_config_id)
        |> Repo.one()

      true ->
        nil
    end
  end

  defp apply_filters(query, []), do: query

  defp apply_filters(query, [{:widget_id, widget_id} | rest]) do
    query
    |> where([wi], wi.widget_id == ^widget_id)
    |> apply_filters(rest)
  end

  defp apply_filters(query, [{:is_active, is_active} | rest]) do
    query
    |> where([wi], wi.is_active == ^is_active)
    |> apply_filters(rest)
  end

  defp apply_filters(query, [_unknown | rest]) do
    apply_filters(query, rest)
  end

  # ============================================================================
  # Network Integration Credentials
  # ============================================================================

  @doc """
  Gets network credentials for a specific integration.

  ## Examples

      iex> get_network_credentials(network_id, integration_id)
      %NetworkIntegrationCredential{}

      iex> get_network_credentials(network_id, missing_integration_id)
      nil
  """
  def get_network_credentials(network_id, integration_id) do
    NetworkIntegrationCredential.by_network_and_integration(network_id, integration_id)
    |> Repo.one()
  end

  @doc """
  Gets and decrypts network credentials for a specific integration.

  ## Returns

    - `{:ok, credentials_map}` - Decrypted credentials
    - `{:error, :not_found}` - No credentials configured
    - `{:error, :disabled}` - Credentials exist but are disabled
    - `{:error, reason}` - Decryption failed
  """
  def get_decrypted_network_credentials(network_id, integration_id) do
    case get_network_credentials(network_id, integration_id) do
      nil ->
        {:error, :not_found}

      %{is_enabled: false} ->
        {:error, :disabled}

      credential ->
        NetworkIntegrationCredential.decrypt_credentials(credential)
    end
  end

  @doc """
  Lists all configured integrations for a network.

  Returns integrations with their credential status.
  """
  def list_network_integrations(network_id) do
    NetworkIntegrationCredential.enabled_for_network(network_id)
    |> Repo.all()
  end

  @doc """
  Creates or updates network credentials for an integration.

  ## Parameters

    - network_id: The network UUID
    - integration_id: The widget integration ID
    - credentials: Plain map of credentials to encrypt

  ## Examples

      iex> upsert_network_credentials(network_id, integration_id, %{"client_id" => "xxx", "client_secret" => "yyy"})
      {:ok, %NetworkIntegrationCredential{}}
  """
  def upsert_network_credentials(network_id, integration_id, credentials) when is_map(credentials) do
    case get_network_credentials(network_id, integration_id) do
      nil ->
        %NetworkIntegrationCredential{}
        |> NetworkIntegrationCredential.changeset_with_encryption(
          %{network_id: network_id, integration_id: integration_id},
          credentials
        )
        |> Repo.insert()

      existing ->
        existing
        |> NetworkIntegrationCredential.changeset_with_encryption(%{}, credentials)
        |> Repo.update()
    end
  end

  @doc """
  Enables or disables network credentials for an integration.
  """
  def set_network_credentials_enabled(network_id, integration_id, enabled) when is_boolean(enabled) do
    case get_network_credentials(network_id, integration_id) do
      nil ->
        {:error, :not_found}

      credential ->
        credential
        |> NetworkIntegrationCredential.changeset(%{is_enabled: enabled})
        |> Repo.update()
    end
  end

  @doc """
  Deletes network credentials for an integration.
  """
  def delete_network_credentials(network_id, integration_id) do
    case get_network_credentials(network_id, integration_id) do
      nil ->
        {:error, :not_found}

      credential ->
        Repo.delete(credential)
    end
  end

  @doc """
  Checks if a network has configured credentials for an integration.
  """
  def has_network_credentials?(network_id, integration_id) do
    case get_network_credentials(network_id, integration_id) do
      %{is_enabled: true} -> true
      _ -> false
    end
  end

  @doc """
  Gets client credentials for OAuth, checking network level first, then organization.

  This is the main credential resolution function used by OAuth flows.

  ## Parameters

    - integration_id: The widget integration ID
    - organization_id: The organization ID (used to find network and as fallback)

  ## Returns

    - `{:ok, %{client_id: ..., client_secret: ...}}` - Credentials found
    - `{:error, :not_configured}` - No credentials at any level
  """
  def get_client_credentials(integration_id, organization_id) do
    # Get organization to find its network
    org = Repo.get(Castmill.Organizations.Organization, organization_id)

    if org && org.network_id do
      # Try network-level first
      case get_decrypted_network_credentials(org.network_id, integration_id) do
        {:ok, credentials} ->
          {:ok, normalize_credentials(credentials)}

        {:error, _} ->
          # Fall back to organization-level credentials (for backward compatibility)
          get_org_client_credentials(integration_id, organization_id)
      end
    else
      # No network, try org-level only
      get_org_client_credentials(integration_id, organization_id)
    end
  end

  defp get_org_client_credentials(integration_id, organization_id) do
    case get_organization_credentials(organization_id, integration_id) do
      {:ok, credentials} ->
        {:ok, normalize_credentials(credentials)}

      {:error, _reason} = error ->
        error
    end
  end

  defp normalize_credentials(credentials) do
    %{
      client_id: credentials["client_id"],
      client_secret: credentials["client_secret"]
    }
  end

  @doc """
  Lists all integrations that require network-level credentials (system widgets).
  """
  def list_system_integrations_requiring_credentials do
    from(wi in WidgetIntegration,
      join: w in assoc(wi, :widget),
      where: w.is_system == true,
      where: not is_nil(wi.credential_schema),
      preload: [:widget]
    )
    |> Repo.all()
  end

  @doc """
  Gets and decrypts widget-scoped credentials for an integration.

  Widget-scoped credentials are used when each widget instance has its own
  authentication (e.g., each user connects their own Spotify account).

  ## Parameters

    - widget_config_id: The widget configuration ID
    - integration_id: The widget integration ID

  ## Returns

    - `{:ok, credentials_map}` - Decrypted credentials
    - `{:error, :not_found}` - No credentials stored
    - `{:error, reason}` - Decryption or other error
  """
  def get_widget_credentials(widget_config_id, integration_id) do
    credential = get_credentials_by_scope(integration_id, widget_config_id: widget_config_id)

    case credential do
      nil ->
        {:error, :not_found}

      %WidgetIntegrationCredential{encrypted_credentials: encrypted, organization_id: organization_id}
          when is_binary(encrypted) ->
        with {:ok, organization} <- fetch_organization(organization_id),
             {:ok, encryption_key} <- get_or_create_encryption_key(organization),
             {:ok, credentials} <- Castmill.Crypto.decrypt(encrypted, encryption_key) do
          {:ok, credentials}
        end

      _ ->
        {:error, :not_found}
    end
  end

  @doc """
  Marks organization credentials as invalid.

  This is called when token refresh fails, indicating the user may have
  revoked access or the refresh token is no longer valid.

  ## Parameters

    - organization_id: The organization ID
    - integration_id: The widget integration ID
  """
  def mark_credentials_invalid(organization_id, integration_id) do
    case get_credentials_by_scope(integration_id, organization_id: organization_id) do
      nil ->
        {:error, :not_found}

      credential ->
        credential
        |> WidgetIntegrationCredential.changeset(%{is_valid: false})
        |> Repo.update()
    end
  end
end

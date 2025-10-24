defmodule Castmill.Widgets.Integrations do
  @moduledoc """
  The Widgets Integrations context.
  
  Provides functions for managing widget third-party integrations,
  credentials, and integration data.
  """
  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Widgets.Integrations.{
    WidgetIntegration,
    WidgetIntegrationCredential,
    WidgetIntegrationData
  }

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
    WidgetIntegrationData.base_query()
    |> where([wid], wid.widget_config_id == ^widget_config_id)
    |> Repo.one()
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

  defp get_credentials_by_scope(integration_id, opts) do
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
end

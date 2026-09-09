defmodule Castmill.Widgets.Integrations.WidgetIntegrationData do
  @moduledoc """
  Schema for widget integration data cache.

  This table acts as a deduplication layer for integration API calls.
  Data is cached based on a discriminator_id that determines sharing:

  - "organization" discriminator: All widgets in org share same data (e.g., Spotify)
  - "widget_option" discriminator: Widgets with same option value share (e.g., Broker with same property_id)
  - "widget_config" discriminator: Each widget instance has unique data (no sharing)

  After data is fetched/cached here, it's copied to widget_config.data for the player.

  ## Cleanup

  Stale entries (not used for 30+ days with no associated widget_configs) are cleaned
  up by the IntegrationDataCleanup Oban worker that runs daily.
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Widgets.WidgetConfig
  alias Castmill.Organizations.Organization

  @primary_key {:id, :binary_id, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :widget_integration_id,
             :organization_id,
             :discriminator_id,
             :widget_config_id,
             :data,
             :version,
             :fetched_at,
             :refresh_at,
             :last_used_at,
             :status,
             :error_message,
             :inserted_at,
             :updated_at
           ]}

  schema "widget_integration_data" do
    belongs_to(:widget_integration, WidgetIntegration)
    belongs_to(:organization, Organization, type: :binary_id)

    # Legacy field - kept for backwards compatibility but discriminator_id is preferred
    belongs_to(:widget_config, WidgetConfig, type: :binary_id)

    # Discriminator ID - the cache key that determines data sharing
    # Computed based on integration's discriminator_type:
    # - "organization": org_id
    # - "widget_option": "org_id:option_value"
    # - "widget_config": widget_config_id
    field(:discriminator_id, :string)

    field(:data, :map, default: %{})
    field(:version, :integer, default: 1)

    field(:fetched_at, :utc_datetime)
    field(:refresh_at, :utc_datetime)

    # Track when this cache entry was last used (for cleanup job)
    field(:last_used_at, :utc_datetime)

    field(:status, :string)
    field(:error_message, :string)

    timestamps()
  end

  @doc false
  def changeset(integration_data, attrs) do
    integration_data
    |> cast(attrs, [
      :widget_integration_id,
      :organization_id,
      :discriminator_id,
      :widget_config_id,
      :data,
      :version,
      :fetched_at,
      :refresh_at,
      :last_used_at,
      :status,
      :error_message
    ])
    |> validate_required([:widget_integration_id, :discriminator_id, :organization_id])
    |> validate_number(:version, greater_than: 0)
    |> unique_constraint([:widget_integration_id, :discriminator_id],
      name: :widget_integration_data_discriminator_unique
    )
  end

  def base_query() do
    from(wid in __MODULE__, as: :widget_integration_data)
  end
end

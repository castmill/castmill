defmodule Castmill.Widgets.Integrations.WidgetIntegrationData do
  @moduledoc """
  Schema for widget integration data.
  
  Caches data retrieved from third-party integrations (PULL mode) or
  pushed via webhooks (PUSH mode). Includes version tracking for efficient
  polling by players.
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Widgets.WidgetConfig

  @primary_key {:id, :binary_id, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :widget_integration_id,
             :widget_config_id,
             :data,
             :version,
             :fetched_at,
             :refresh_at,
             :status,
             :error_message,
             :inserted_at,
             :updated_at
           ]}

  schema "widget_integration_data" do
    belongs_to(:widget_integration, WidgetIntegration)
    belongs_to(:widget_config, WidgetConfig, type: :binary_id)

    field(:data, :map, default: %{})
    field(:version, :integer, default: 1)

    field(:fetched_at, :utc_datetime)
    field(:refresh_at, :utc_datetime)

    field(:status, :string)
    field(:error_message, :string)

    timestamps()
  end

  @doc false
  def changeset(integration_data, attrs) do
    integration_data
    |> cast(attrs, [
      :widget_integration_id,
      :widget_config_id,
      :data,
      :version,
      :fetched_at,
      :refresh_at,
      :status,
      :error_message
    ])
    |> validate_required([:widget_integration_id, :widget_config_id])
    |> validate_number(:version, greater_than: 0)
    |> unique_constraint([:widget_integration_id, :widget_config_id])
  end

  def base_query() do
    from(wid in __MODULE__, as: :widget_integration_data)
  end
end

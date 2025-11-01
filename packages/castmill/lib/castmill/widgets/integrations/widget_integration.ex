defmodule Castmill.Widgets.Integrations.WidgetIntegration do
  @moduledoc """
  Schema for widget integrations.
  
  Defines how a widget type integrates with external third-party services.
  Supports both PULL (periodic data fetching) and PUSH (webhook) modes.
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.Integrations.{WidgetIntegrationCredential, WidgetIntegrationData}

  @integration_types ["pull", "push", "both"]
  @credential_scopes ["organization", "widget"]

  @derive {Jason.Encoder,
           only: [
             :id,
             :widget_id,
             :name,
             :description,
             :integration_type,
             :credential_scope,
             :config_schema,
             :credential_schema,
             :pull_endpoint,
             :pull_interval_seconds,
             :pull_config,
             :push_webhook_path,
             :push_config,
             :is_active,
             :inserted_at,
             :updated_at
           ]}

  schema "widget_integrations" do
    belongs_to(:widget, Widget)

    field(:name, :string)
    field(:description, :string)

    field(:integration_type, :string)
    field(:credential_scope, :string)

    field(:config_schema, :map, default: %{})
    field(:credential_schema, :map, default: %{})

    # PULL configuration
    field(:pull_endpoint, :string)
    field(:pull_interval_seconds, :integer)
    field(:pull_config, :map, default: %{})

    # PUSH configuration
    field(:push_webhook_path, :string)
    field(:push_config, :map, default: %{})

    field(:is_active, :boolean, default: true)

    has_many(:credentials, WidgetIntegrationCredential)
    has_many(:data_records, WidgetIntegrationData)

    timestamps()
  end

  @doc false
  def changeset(integration, attrs) do
    integration
    |> cast(attrs, [
      :widget_id,
      :name,
      :description,
      :integration_type,
      :credential_scope,
      :config_schema,
      :credential_schema,
      :pull_endpoint,
      :pull_interval_seconds,
      :pull_config,
      :push_webhook_path,
      :push_config,
      :is_active
    ])
    |> validate_required([
      :widget_id,
      :name,
      :integration_type,
      :credential_scope
    ])
    |> validate_inclusion(:integration_type, @integration_types)
    |> validate_inclusion(:credential_scope, @credential_scopes)
    |> validate_pull_fields()
    |> validate_push_fields()
    |> unique_constraint([:widget_id, :name])
  end

  defp validate_pull_fields(changeset) do
    integration_type = get_field(changeset, :integration_type)

    if integration_type in ["pull", "both"] do
      changeset
      |> validate_required([:pull_endpoint, :pull_interval_seconds])
      |> validate_number(:pull_interval_seconds, greater_than: 0)
    else
      changeset
    end
  end

  defp validate_push_fields(changeset) do
    integration_type = get_field(changeset, :integration_type)

    if integration_type in ["push", "both"] do
      changeset
      |> validate_required([:push_webhook_path])
    else
      changeset
    end
  end

  def base_query() do
    from(wi in __MODULE__, as: :widget_integration)
  end
end

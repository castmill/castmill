defmodule Castmill.Widgets.Integrations.WidgetIntegrationCredential do
  @moduledoc """
  Schema for widget integration credentials.

  Stores encrypted authentication credentials for widget integrations.
  Credentials can be scoped to either an organization or a specific widget instance.
  """
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  alias Castmill.Widgets.Integrations.WidgetIntegration
  alias Castmill.Organizations.Organization
  alias Castmill.Widgets.WidgetConfig

  @primary_key {:id, :binary_id, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :widget_integration_id,
             :organization_id,
             :widget_config_id,
             :metadata,
             :validated_at,
             :is_valid,
             :inserted_at,
             :updated_at
           ]}

  schema "widget_integration_credentials" do
    belongs_to(:widget_integration, WidgetIntegration)
    belongs_to(:organization, Organization, type: :binary_id)
    belongs_to(:widget_config, WidgetConfig, type: :binary_id)

    # Encrypted credentials (binary data)
    field(:encrypted_credentials, :binary)

    # Non-sensitive metadata
    field(:metadata, :map, default: %{})

    # Validation tracking
    field(:validated_at, :utc_datetime)
    field(:is_valid, :boolean, default: false)

    timestamps()
  end

  @doc false
  def changeset(credential, attrs) do
    credential
    |> cast(attrs, [
      :widget_integration_id,
      :organization_id,
      :widget_config_id,
      :encrypted_credentials,
      :metadata,
      :validated_at,
      :is_valid
    ])
    |> validate_required([:widget_integration_id, :encrypted_credentials])
    |> validate_scope()
    |> unique_constraint([:widget_integration_id, :organization_id])
    |> unique_constraint([:widget_integration_id, :widget_config_id])
  end

  # Ensure exactly one of organization_id or widget_config_id is set
  defp validate_scope(changeset) do
    org_id = get_field(changeset, :organization_id)
    widget_config_id = get_field(changeset, :widget_config_id)

    cond do
      is_nil(org_id) and is_nil(widget_config_id) ->
        add_error(
          changeset,
          :organization_id,
          "either organization_id or widget_config_id must be set"
        )

      not is_nil(org_id) and not is_nil(widget_config_id) ->
        add_error(
          changeset,
          :organization_id,
          "cannot set both organization_id and widget_config_id"
        )

      true ->
        changeset
    end
  end

  def base_query() do
    from(wic in __MODULE__, as: :widget_integration_credential)
  end
end

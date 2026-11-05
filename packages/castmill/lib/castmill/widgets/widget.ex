defmodule Castmill.Widgets.Widget do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :description,
             :slug,
             :template,
             :options_schema,
             :data_schema,
             :meta,
             :icon,
             :small_icon,
             :aspect_ratio,
             :update_interval_seconds,
             :fonts,
             :assets,
             :translations,
             :scope,
             :can_manage
           ]}
  schema "widgets" do
    field(:name, :string)
    field(:slug, :string)
    field(:description, :string)

    field(:template, :map)
    field(:options_schema, :map, default: %{})
    field(:data_schema, :map, default: %{})

    field(:meta, :map)

    field(:icon, :string)
    field(:small_icon, :string)

    # Preferred aspect ratio for the widget (e.g., "16:9", "9:16", "4:3", "1:1", or "liquid" for any)
    field(:aspect_ratio, :string)

    # Scope: system widgets (is_system, no owner) are available everywhere, network
    # widgets to the organizations of `network`, organization widgets only to
    # `organization`. A restricted system/network widget is only available to the
    # organizations it is enabled for (widgets_organizations). Non-system widgets
    # without an owner are unassigned and available to no organization.
    field(:is_system, :boolean, default: false)
    belongs_to(:network, Castmill.Networks.Network, type: Ecto.UUID)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)
    field(:restricted, :boolean, default: false)

    many_to_many(:enabled_organizations, Castmill.Organizations.Organization,
      join_through: Castmill.Widgets.WidgetOrganization,
      join_keys: [widget_id: :id, organization_id: :id]
    )

    # Per-request projection for the requesting organization (see Castmill.Widgets.put_access/2).
    field(:scope, :string, virtual: true)
    field(:can_manage, :boolean, virtual: true)

    # The endpoint in which the widget should ask the server for data updates.
    field(:webhook_url, :string)

    # Granularity in seconds for how often the widget should ask the server for updates.
    field(:update_interval_seconds, :integer, default: 60)

    # Custom fonts included with the widget (list of %{"url" => string, "name" => string})
    field(:fonts, {:array, :map}, default: [])

    # Original assets definition from widget.json (icons, images, fonts metadata)
    field(:assets, :map, default: %{})

    # Widget-provided translations keyed by locale code
    # e.g. %{"en" => %{"name" => "QR Code", ...}, "es" => %{"name" => "Código QR", ...}}
    field(:translations, :map, default: %{})

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [
      :name,
      :slug,
      :description,
      :template,
      :options_schema,
      :data_schema,
      :meta,
      :aspect_ratio,
      :update_interval_seconds,
      :icon,
      :small_icon,
      :is_system,
      :webhook_url,
      :fonts,
      :assets,
      :translations
    ])
    |> validate_required([:name, :template])
    |> unique_constraint(:name)
    |> unique_constraint(:slug)
    |> validate_schema(:options_schema)
    |> validate_schema(:data_schema)
  end

  @doc """
  Sets the widget's scope. Only for trusted callers (Castmill.Widgets scope functions).
  """
  def scope_changeset(widget, attrs) do
    widget
    |> cast(attrs, [:is_system, :network_id, :organization_id, :restricted])
    |> check_constraint(:network_id, name: :widgets_single_owner)
    |> check_constraint(:is_system, name: :widgets_system_has_no_owner)
    |> check_constraint(:restricted, name: :widgets_organization_not_restricted)
    |> foreign_key_constraint(:network_id)
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  The fields an organization may change on a widget it owns.
  """
  def organization_update_changeset(widget, attrs) do
    widget
    |> cast(attrs, [:name, :description])
    |> validate_required([:name])
    |> unique_constraint(:name)
  end

  def base_query() do
    from(widget in Castmill.Widgets.Widget, as: :widget)
  end

  def validate_schema(changeset, field) when is_atom(field) do
    validate_change(changeset, field, fn field, schema ->
      case Castmill.Widgets.Schema.validate_schema(schema) do
        {:ok, nil} ->
          []

        {:error, message} ->
          [{field, message}]
      end
    end)
  end
end

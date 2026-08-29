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
             :is_system,
             :organization_id,
             :translations
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

    # System widgets are global; user-created widgets belong to an organization.
    field(:is_system, :boolean)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)

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
      :organization_id,
      :translations
    ])
    |> validate_required([:name, :template])
    |> unique_constraint(:name)
    |> unique_constraint(:slug)
    |> validate_schema(:options_schema)
    |> validate_schema(:data_schema)
    |> validate_number(:update_interval_seconds,
      greater_than_or_equal_to: 5,
      less_than_or_equal_to: 3600
    )
  end

  def base_query() do
    from(widget in Castmill.Widgets.Widget, as: :widget)
  end

  def validate_schema(changeset, field) when is_atom(field) do
    validate_change(changeset, field, fn field, schema ->
      if schema == %{} do
        []
      else
        case Castmill.Widgets.Schema.validate_schema(schema) do
          {:ok, nil} ->
            []

          {:error, message} ->
            [{field, message}]
        end
      end
    end)
  end
end

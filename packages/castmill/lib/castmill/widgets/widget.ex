defmodule Castmill.Widgets.Widget do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "widgets" do
    field(:name, :string)
    field(:template, :map)
    field(:options_schema, :map)
    field(:data_schema, :map)

    field(:meta, :map)

    field(:icon, :string)
    field(:small_icon, :string)

    # Not sure we need this field. Widgets should be either global, per network or per organization, not sure which
    # would be the best way to model this.
    field(:is_system, :boolean)

    # The endpoint in which the widget should ask the server for data updates.
    field(:webhook_url, :string)

    # Granularity in seconds for how often the widget should ask the server for updates.
    field(:update_granularity, :integer, default: 60)

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [
      :name,
      :template,
      :options_schema,
      :data_schema,
      :meta,
      :update_granularity,
      :icon,
      :small_icon,
      :is_system,
      :webhook_url
    ])
    |> validate_required([:name, :template, :options_schema])
    |> validate_schema(:options_schema)
    |> validate_schema(:data_schema)
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

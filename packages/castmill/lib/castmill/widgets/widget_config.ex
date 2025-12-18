defmodule Castmill.Widgets.WidgetConfig do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, :binary_id, autogenerate: true}

  # TODO: We would possible like to encrypt this data before storing it in the database with a key that is unique
  # for every organization. This since we don't want to store any potentially sensitive data in the database in plain text.
  # Organizations could have an "encryption_key" used for this purpose.

  # Note: Custom Jason.Encoder is implemented below to include integration data
  schema "widgets_config" do
    field(:options, :map, default: %{})
    field(:data, :map, default: %{})

    # Virtual field to hold integration data when loaded
    field(:integration_data, :map, virtual: true, default: nil)

    # Everytime the data is updated we must update the version number.
    field(:version, :integer, default: 1)

    # TODO: rename to requested_at (for consistency with updated_at and inserted_at)
    field(:last_request_at, :utc_datetime, default: nil)

    belongs_to(:widget, Castmill.Widgets.Widget)
    belongs_to :playlist_item, Castmill.Resources.PlaylistItem, foreign_key: :playlist_item_id

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [:options, :data, :last_request_at, :widget_id, :playlist_item_id])
    |> validate_required([:widget_id, :playlist_item_id])
    |> validate_data(:data, :data_schema)
    |> validate_data(:options, :options_schema)
  end

  def base_query() do
    from(widget_config in Castmill.Widgets.WidgetConfig, as: :widget_config)
  end

  def validate_data(changeset, field, schema_field) when is_atom(field) do
    validate_change(changeset, field, fn field, data ->
      widget_id = changeset.changes.widget_id || changeset.data.widget_id

      widget = Castmill.Widgets.get_widget(widget_id)

      case Castmill.Widgets.Schema.validate_data(Map.get(widget, schema_field), data) do
        {:ok, _} ->
          []

        {:error, message} ->
          [{field, message}]
      end
    end)
  end
end

defimpl Jason.Encoder, for: Castmill.Widgets.WidgetConfig do
  def encode(%Castmill.Widgets.WidgetConfig{} = widget_config, opts) do
    # Merge integration_data into data if present
    data =
      case widget_config.integration_data do
        nil -> widget_config.data || %{}
        integration_data -> Map.merge(widget_config.data || %{}, integration_data)
      end

    map = %{
      id: widget_config.id,
      options: widget_config.options,
      data: data
    }

    Jason.Encode.map(map, opts)
  end
end

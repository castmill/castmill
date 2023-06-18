defmodule Castmill.Widgets.WidgetData do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, :binary_id, autogenerate: true}

  # TODO: We would possible like to encrypt this data before storing it in the database with a key that is unique
  # for every organization. This since we don't want to store any potentially sensitive data in the database in plain text.
  # Organizations could have an "encryption_key" used for this purpose.
  schema "widgets_data" do
    field(:options, :map, default: %{})
    field(:data, :map, default: %{})

    # Everytime the data is updated we must update the version number.
    field(:version, :integer, default: 1)

    field(:last_request_at, :naive_datetime, default: nil)

    belongs_to(:widget, Castmill.Widgets.Widget)

    has_one(:playlist_item, Castmill.Resources.PlaylistItem)

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [:options, :data, :last_request_at, :widget_id])
    |> validate_required([:widget_id])
    |> validate_data(:data, :data_schema)
    |> validate_data(:options, :options_schema)
  end

  def base_query() do
    from(widget_data in Castmill.Widgets.WidgetData, as: :widget_data)
  end

  def validate_data(changeset, field, schema_field) when is_atom(field) do
    validate_change(changeset, field, fn field, data ->
      widget = Castmill.Widgets.get_widget(changeset.data.widget_id)

      case Castmill.Widgets.Schema.validate_data(widget[schema_field], data) do
        {:ok, nil} ->
          []

        {:error, message} ->
          [{field, message}]
      end
    end)
  end
end

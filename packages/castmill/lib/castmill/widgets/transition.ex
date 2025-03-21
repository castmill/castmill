defmodule Castmill.Widgets.Transition do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "transitions" do
    field(:name, :string)
    field(:options_schema, :map)

    # uri is used in code to identify the transition and run it appropiately.
    field(:uri, :string)

    field(:meta, :map)

    field(:icon, :string)
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [
      :name,
      :options_schema,
      :uri,
      :meta,
      :icon
    ])
    |> validate_required([:name, :options_schema, :uri])
    |> unique_constraint(:uri)
    |> validate_schema(:options_schema)
  end

  def base_query() do
    from(widget in Castmill.Widgets.Transition, as: :transition)
  end

  # TODO: refactor
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

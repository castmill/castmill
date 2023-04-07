defmodule Castmill.Widgets.Widget do
  use Ecto.Schema
  import Ecto.Changeset

  schema "widgets" do
    field :schema, :map
    field :name, :string
    field :uri, :string
    field :icon, :string
    field :small_icon, :string
    field :is_system, :boolean

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [:name, :uri, :schema, :icon, :small_icon, :is_system])
    |> validate_required([:name, :uri, :schema])
  end
end

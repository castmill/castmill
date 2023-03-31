defmodule Server.Widget do
  use Ecto.Schema
  import Ecto.Changeset

  schema "widgets" do
    field :data, :map
    field :name, :string
    field :uri, :string

    belongs_to :organization, Server.Organization

    timestamps()
  end

  @doc false
  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [:name, :uri, :data])
    |> validate_required([:name, :uri, :data])
  end
end

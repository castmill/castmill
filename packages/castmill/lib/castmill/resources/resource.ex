defmodule Castmill.Resources.Resource do
  use Ecto.Schema
  import Ecto.Changeset

  # Todo maybe change the name to "shareable-resource" to make more explicit the
  # reason we need it.
  schema "resources" do
    field :type, :string # Enum(:playlist, :widget, :media, :calendar, :device)

    timestamps()
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:type])
    |> validate_required([:type])
  end
end

# DEPRECATED: This module is not used anymore, but it's kept here until we remove all references to it.
defmodule Castmill.Resources.Resource do
  use Castmill.Schema
  import Ecto.Changeset

  # Todo maybe change the name to "shareable-resource" to make more explicit the
  # reason we need it.
  schema "resources" do
    field :type, Ecto.Enum,
      values: [:playlist, :widget, :media, :channel, :device],
      default: :playlist

    timestamps()
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:type])
    |> validate_required([:type])
  end
end

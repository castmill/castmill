defmodule Castmill.Resources.Resource do
  use Ecto.Schema
  import Ecto.Changeset

  # Todo maybe change the name to "shareable-resource" to make more explicit the
  # reason we need it.
  schema "resources" do
    field :type, Ecto.Enum,
      values: [:playlist, :widget, :media, :channel, :device],
      default: :playlist

    has_one :media, Castmill.Resources.Media
    has_one :playlist, Castmill.Resources.Playlist
    has_one :channel, Castmill.Resources.Channel
    has_one :device, Castmill.Devices.Device

    timestamps()
  end

  @doc false
  def changeset(team, attrs) do
    team
    |> cast(attrs, [:type])
    |> validate_required([:type])
  end
end

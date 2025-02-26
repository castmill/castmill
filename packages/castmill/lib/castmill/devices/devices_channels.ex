defmodule Castmill.Devices.DevicesChannels do
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key false

  @derive {Jason.Encoder, only: [:device_id, :channel_id, :inserted_at, :updated_at]}
  schema "devices_channels" do
    belongs_to(:devices, Castmill.Devices.Device,
      foreign_key: :device_id,
      type: Ecto.UUID,
      primary_key: true
    )

    belongs_to(:channels, Castmill.Resources.Channel,
      foreign_key: :channel_id,
      primary_key: true
    )

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:device_id, :channel_id])
    |> validate_required([:device_id, :channel_id])
    |> foreign_key_constraint(:device_id, name: :devices_channels_channel_id_fkey)
    |> foreign_key_constraint(:channel_id, name: :devices_channels_channel_id_fkey)
  end
end

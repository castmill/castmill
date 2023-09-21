defmodule Castmill.Devices.DevicesCalendars do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false

  @derive {Jason.Encoder, only: [:device_id, :calendar_id, :inserted_at, :updated_at]}
  schema "devices_calendars" do
    belongs_to(:devices, Castmill.Devices.Device,
      foreign_key: :device_id,
      type: Ecto.UUID,
      primary_key: true
    )

    belongs_to(:calendars, Castmill.Resources.Calendar,
      foreign_key: :calendar_id,
      primary_key: true
    )

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:device_id, :calendar_id])
    |> validate_required([:device_id, :calendar_id])
    |> foreign_key_constraint(:device_id, name: :devices_calendars_calendar_id_fkey)
    |> foreign_key_constraint(:calendar_id, name: :devices_calendars_calendar_id_fkey)
  end
end

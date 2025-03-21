defmodule Castmill.Devices.DevicesEvents do
  use Castmill.Schema

  import Ecto.Changeset
  import Ecto.Query, warn: false

  @derive {Jason.Encoder, only: [:id, :device_id, :timestamp, :type, :msg, :type_name]}

  schema "devices_events" do
    field(:timestamp, :utc_datetime)
    field(:type, :string)
    field(:type_name, :string, virtual: true)
    field(:msg, :string)

    belongs_to(:device, Castmill.Devices.Device, type: Ecto.UUID)
  end

  # Requires ecto hooks to be enabled in the repo
  # def after_get(%__MODULE__{timestamp: timestamp, type: type, msg: msg} = event) do
  #   %__MODULE__{event | type_name: type_name(event)}
  # end

  # Virtual field for the type of log
  def type_name(event) do
    case event.type do
      "o" -> "online"
      "x" -> "offline"
      "e" -> "error"
      "w" -> "warning"
      "i" -> "info"
      _ -> "unknown"
    end
  end

  # Changeset for the device events, should check that the type is valid
  # Since enums are not supported by Elixir, we will use a character instead
  # o => online, x => offline, e => error, w => warning, i => info
  @doc false
  def changeset(log, attrs) do
    log
    |> cast(attrs, [:device_id, :timestamp, :type, :msg])
    |> validate_required([:device_id, :timestamp, :type])
    |> validate_inclusion(:type, ["o", "x", "e", "w", "i"])
  end

  def base_query() do
    from(devices_events in Castmill.Devices.DevicesEvents, as: :devices_events)
  end
end

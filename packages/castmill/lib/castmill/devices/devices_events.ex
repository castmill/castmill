defmodule Castmill.Devices.DevicesEvents do
  use Castmill.Schema

  import Ecto.Changeset
  import Ecto.Query, warn: false

  @derive {Jason.Encoder,
           only: [
             :id,
             :device_id,
             :timestamp,
             :type,
             :msg,
             :type_name,
             :category,
             :code,
             :stack,
             :context,
             :occurrence_count,
             :first_occurred_at,
             :last_occurred_at
           ]}

  schema "devices_events" do
    field(:timestamp, :utc_datetime)
    field(:type, :string)
    field(:type_name, :string, virtual: true)
    field(:msg, :string)
    field(:fingerprint, :string)
    field(:category, :string)
    field(:code, :string)
    field(:stack, :string)
    field(:context, :map)
    field(:occurrence_count, :integer, default: 1)
    field(:first_occurred_at, :utc_datetime)
    field(:last_occurred_at, :utc_datetime)
    field(:last_report_id, :string)

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
    |> cast(attrs, [
      :device_id,
      :timestamp,
      :type,
      :msg,
      :fingerprint,
      :category,
      :code,
      :stack,
      :context,
      :occurrence_count,
      :first_occurred_at,
      :last_occurred_at,
      :last_report_id
    ])
    |> default_occurrence_timestamps()
    |> validate_required([:device_id, :timestamp, :type])
    |> validate_inclusion(:type, ["o", "x", "e", "w", "i"])
  end

  defp default_occurrence_timestamps(changeset) do
    timestamp = get_field(changeset, :timestamp)

    changeset
    |> maybe_put_change(:first_occurred_at, timestamp)
    |> maybe_put_change(:last_occurred_at, timestamp)
  end

  defp maybe_put_change(changeset, _field, nil), do: changeset

  defp maybe_put_change(changeset, field, value) do
    if is_nil(get_field(changeset, field)) do
      put_change(changeset, field, value)
    else
      changeset
    end
  end

  def base_query() do
    from(devices_events in Castmill.Devices.DevicesEvents, as: :devices_events)
  end
end

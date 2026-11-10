defmodule Castmill.Automations.AutomationsDevices do
  @moduledoc "Assignment of an automation to a device, ordered by position."
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key false
  schema "automations_devices" do
    field(:position, :integer, default: 0)

    belongs_to(:automation, Castmill.Automations.Automation, primary_key: true)

    belongs_to(:device, Castmill.Devices.Device,
      type: Ecto.UUID,
      primary_key: true
    )

    timestamps()
  end

  @doc false
  def changeset(assignment, attrs) do
    assignment
    |> cast(attrs, [:automation_id, :device_id, :position])
    |> validate_required([:automation_id, :device_id])
    |> unique_constraint([:automation_id, :device_id], name: :automations_devices_pkey)
  end
end

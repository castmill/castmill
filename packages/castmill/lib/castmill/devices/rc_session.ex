defmodule Castmill.Devices.RcSession do
  @moduledoc """
  Schema for remote control sessions.
  
  An RC session represents an active remote control connection from a dashboard user
  to a device. It manages the WebSocket connections between the device, the media relay,
  and the RC window in the dashboard.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "rc_sessions" do
    field :device_id, :binary_id
    field :user_id, :binary_id
    field :status, :string, default: "active"
    field :started_at, :utc_datetime
    field :stopped_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(rc_session, attrs) do
    rc_session
    |> cast(attrs, [:device_id, :user_id, :status, :started_at, :stopped_at])
    |> validate_required([:device_id, :user_id])
    |> validate_inclusion(:status, ["active", "stopped"])
  end
end

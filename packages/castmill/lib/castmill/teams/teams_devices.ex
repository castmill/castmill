defmodule Castmill.Teams.TeamsDevices do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_devices" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :device, Castmill.Devices.Device,
      foreign_key: :device_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_devices, attrs) do
    teams_devices
    |> cast(attrs, [:access, :team_id, :device_id])
    |> validate_required([:access, :team_id, :device_id])
    |> unique_constraint([:team_id, :device_id], name: :teams_devices_pkey)
  end

  @doc """
  A base query for the TeamsDevices schema.
  """
  def base_query() do
    from(td in __MODULE__, as: :teams_devices)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(td in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsDevices do
  def encode(%Castmill.Teams.TeamsDevices{} = teams_devices, opts) do
    base_map = %{
      team_id: teams_devices.team_id,
      device_id: teams_devices.device_id,
      access: teams_devices.access,
      inserted_at: teams_devices.inserted_at,
      updated_at: teams_devices.updated_at
    }

    # Only embed device if it's actually preloaded
    map =
      if Ecto.assoc_loaded?(teams_devices.device) and teams_devices.device do
        Map.put(base_map, :device, teams_devices.device)
      else
        base_map
      end

    Jason.Encode.map(map, opts)
  end
end

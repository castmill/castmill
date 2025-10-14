defmodule Castmill.Teams.TeamsChannels do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_channels" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :channel, Castmill.Resources.Channel,
      foreign_key: :channel_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_channels, attrs) do
    teams_channels
    |> cast(attrs, [:access, :team_id, :channel_id])
    |> validate_required([:access, :team_id, :channel_id])
    |> unique_constraint([:team_id, :channel_id], name: :teams_channels_pkey)
  end

  @doc """
  A base query for the TeamsChannels schema.
  """
  def base_query() do
    from(tc in __MODULE__, as: :teams_channels)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(tc in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsChannels do
  def encode(%Castmill.Teams.TeamsChannels{} = teams_channels, opts) do
    base_map = %{
      team_id: teams_channels.team_id,
      channel_id: teams_channels.channel_id,
      access: teams_channels.access,
      inserted_at: teams_channels.inserted_at,
      updated_at: teams_channels.updated_at
    }

    # Only embed channel if it's actually preloaded
    map =
      if Ecto.assoc_loaded?(teams_channels.channel) and teams_channels.channel do
        Map.put(base_map, :channel, teams_channels.channel)
      else
        base_map
      end

    Jason.Encode.map(map, opts)
  end
end

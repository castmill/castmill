defmodule Castmill.Teams.TeamsPlaylists do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key false

  schema "teams_playlists" do
    field :access, {:array, Ecto.Enum},
      values: [:read, :write, :delete],
      default: [:read, :write, :delete]

    belongs_to :team, Castmill.Teams.Team, foreign_key: :team_id, primary_key: true

    belongs_to :playlist, Castmill.Resources.Playlist,
      foreign_key: :playlist_id,
      primary_key: true

    timestamps()
  end

  @doc false
  def changeset(teams_playlists, attrs) do
    teams_playlists
    |> cast(attrs, [:access, :team_id, :playlist_id])
    |> validate_required([:access, :team_id, :playlist_id])
    |> unique_constraint([:team_id, :user_id], name: :teams_playlists_pkey)
  end

  @doc """
  A base query for the TeamsPlaylist schema.
  """
  def base_query() do
    from(tm in __MODULE__, as: :teams_playlists)
  end

  @doc """
  A bare query with no named binding.
  """
  def bare_query do
    from(tm in __MODULE__)
  end
end

defimpl Jason.Encoder, for: Castmill.Teams.TeamsPlaylists do
  def encode(%Castmill.Teams.TeamsPlaylists{} = teams_playlists, opts) do
    base_map = %{
      team_id: teams_playlists.team_id,
      playlist_id: teams_playlists.playlist_id,
      access: teams_playlists.access,
      inserted_at: teams_playlists.inserted_at,
      updated_at: teams_playlists.updated_at
    }

    # Only embed playlist if it’s actually preloaded
    # (Ecto.assoc_loaded? avoids errors if playlist not loaded)
    map =
      if Ecto.assoc_loaded?(teams_playlists.playlist) and teams_playlists.playlist do
        Map.put(base_map, :playlist, teams_playlists.playlist)
      else
        base_map
      end

    Jason.Encode.map(map, opts)
  end
end

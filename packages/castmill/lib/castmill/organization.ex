defmodule Castmill.Organization do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "organizations" do
    field :name, :string

    belongs_to :network, Castmill.Network

    has_many :teams, Castmill.Team
    has_many :devices, Castmill.Device
    has_many :calendars, Castmill.Calendar
    has_many :playlists, Castmill.Playlist
    has_many :medias, Castmill.Media
    has_many :widgets, Castmill.Widget

    many_to_many :users, Castmill.User, join_through: "organizations_users"

    timestamps()
  end

  @doc false
  def changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name])
    |> validate_required([:name])
  end
end

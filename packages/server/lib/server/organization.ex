defmodule Server.Organization do
  use Ecto.Schema

  import Ecto.Changeset

  schema "organizations" do
    field :name, :string
    field :owner_id, Ecto.UUID

    belongs_to :network, Server.Network

    has_many :teams, Server.Team

    has_many :devices, Server.Device

    has_many :calendars, Server.Calendar
    has_many :playlists, Server.Playlist
    has_many :medias, Server.Media
    has_many :widgets, Server.Widget

    many_to_many :users, Server.User, join_through: "organizations_users"

    timestamps()
  end

  @doc false
  def changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name, :owner_id])
    |> validate_required([:name, :owner_id])
  end
end

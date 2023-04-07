defmodule Castmill.Organizations.Organization do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "organizations" do
    field :name, :string

    belongs_to :network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID

    has_many :devices, Castmill.Device
    has_many :teams, Castmill.Resources.Team
    has_many :calendars, Castmill.Resources.Calendar
    has_many :playlists, Castmill.Resources.Playlist
    has_many :medias, Castmill.Resources.Media

    many_to_many :users, Castmill.Accounts.User, join_through: "organizations_users", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name, :network_id])
    |> validate_required([:name, :network_id])
    |> unique_constraint([:name, :network_id], name: :org_name_network_id_index)
  end
end

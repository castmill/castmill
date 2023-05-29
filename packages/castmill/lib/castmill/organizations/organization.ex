defmodule Castmill.Organizations.Organization do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "organizations" do
    field :name, :string

    belongs_to :network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID
    belongs_to :organization, Castmill.Organizations.Organization, type: Ecto.UUID

    has_many :devices, Castmill.Devices.Device
    has_many :teams, Castmill.Teams.Team
    has_many :calendars, Castmill.Resources.Calendar
    has_many :playlists, Castmill.Resources.Playlist
    has_many :medias, Castmill.Resources.Media

    many_to_many :users, Castmill.Accounts.User, join_through: "organizations_users", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name, :organization_id, :network_id])
    |> validate_required([:name, :network_id])
    |> unique_constraint([:name, :network_id], name: :org_name_network_id_index)
  end

  def base_query() do
    from e in Castmill.Organizations.Organization, as: :organization
  end

  def where_org_id(query, nil) do
    query
  end

  def where_org_id(query, id) do
    from e in query,
      where: e.organization_id == ^id
  end
end

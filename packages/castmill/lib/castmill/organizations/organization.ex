defmodule Castmill.Organizations.Organization do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID

  schema "organizations" do
    field(:name, :string)
    field(:name_lower, :string)

    field(:country, :string)
    field(:city, :string)
    field(:address, :string)
    field(:postal_code, :string)
    field(:email, :string)

    field(:meta, :map)

    belongs_to(:network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)

    has_many(:devices, Castmill.Devices.Device)
    has_many(:teams, Castmill.Teams.Team)
    has_many(:channels, Castmill.Resources.Channel)
    has_many(:playlists, Castmill.Resources.Playlist)
    has_many(:medias, Castmill.Resources.Media)

    many_to_many(:users, Castmill.Accounts.User,
      join_through: "organizations_users",
      on_replace: :delete
    )

    timestamps()
  end

  @doc false
  def changeset(organization, attrs) do
    organization
    |> cast(attrs, [:name, :organization_id, :network_id])
    |> validate_required([:name, :network_id])
    |> update_change(:name, &String.trim/1)
    |> put_name_lower()
    |> unique_constraint([:name_lower, :network_id],
      name: :org_name_lower_network_id_index,
      message: "has already been taken"
    )
    |> unsafe_validate_unique([:name_lower, :network_id], Castmill.Repo,
      error_key: :name,
      message: "has already been taken"
    )
  end

  # Private function to automatically populate name_lower from name
  defp put_name_lower(changeset) do
    case get_change(changeset, :name) do
      nil -> changeset
      name -> put_change(changeset, :name_lower, String.downcase(name))
    end
  end

  def base_query() do
    from(e in Castmill.Organizations.Organization, as: :organization)
  end

  def where_org_id(query, nil) do
    query
  end

  def where_org_id(query, "") do
    query
  end

  def where_org_id(query, id) do
    from(e in query,
      where: e.organization_id == ^id
    )
  end
end

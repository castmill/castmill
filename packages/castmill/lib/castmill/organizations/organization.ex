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

    # Encryption key for sensitive data (Base64-encoded 32-byte key)
    field(:encryption_key, :string)

    # Castmill 2.0 Permission System Fields
    # Default role for new users joining this organization
    field(:default_role, Ecto.Enum,
      values: [:admin, :manager, :member, :editor, :publisher, :device_manager, :guest],
      default: :member
    )

    # Visibility mode for hierarchical organization access
    # - :full - Parent can see and edit all child org resources
    # - :read_only_parent - Parent can read child resources, child can edit shared parent resources
    # - :isolated - Complete isolation, parent cannot see child resources
    field(:visibility_mode, Ecto.Enum,
      values: [:full, :read_only_parent, :isolated],
      default: :full
    )

    belongs_to(:network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)
    belongs_to(:logo_media, Castmill.Resources.Media, foreign_key: :logo_media_id, type: :id)

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
    |> cast(attrs, [
      :name,
      :organization_id,
      :network_id,
      :default_role,
      :visibility_mode,
      :logo_media_id,
      :encryption_key
    ])
    |> validate_required([:name, :network_id])
    |> validate_inclusion(:default_role, [
      :admin,
      :manager,
      :member,
      :editor,
      :publisher,
      :device_manager,
      :guest
    ])
    |> validate_inclusion(:visibility_mode, [:full, :read_only_parent, :isolated])
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

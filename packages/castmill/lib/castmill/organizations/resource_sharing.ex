defmodule Castmill.Organizations.ResourceSharing do
  @moduledoc """
  Schema for managing resource sharing between parent and child organizations.

  This table tracks which resources (media, playlists, channels, devices, widgets)
  are shared from parent organizations to their children, enabling hierarchical
  content distribution without cluttering resource tables with flags.

  ## Sharing Modes
  - `:children` - Share with direct child organizations only
  - `:descendants` - Share with all descendant organizations (recursive)
  - `:network` - Share across entire network (future use)
  - `:specific_orgs` - Share with specific organizations (future use)

  ## Access Levels
  - `:read` - Child organizations can view only
  - `:read_write` - Child organizations can view and edit
  - `:full` - Child organizations have full control (rare, typically admin use)

  ## Examples

      # Share a playlist with child orgs (read-only)
      %ResourceSharing{}
      |> ResourceSharing.changeset(%{
        resource_type: "playlist",
        resource_id: 123,
        organization_id: parent_org_id,
        sharing_mode: "children",
        access_level: "read"
      })
      |> Repo.insert()

      # Check if resource is shared
      ResourceSharing.is_shared?("media", media_id)
  """

  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  schema "resource_sharing" do
    field :resource_type, Ecto.Enum, values: [:media, :playlist, :channel, :device, :widget]
    field :resource_id, :integer

    field :sharing_mode, Ecto.Enum,
      values: [:children, :descendants, :network, :specific_orgs],
      default: :children

    field :access_level, Ecto.Enum,
      values: [:read, :read_write, :full],
      default: :read

    belongs_to :organization, Castmill.Organizations.Organization, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(resource_sharing, attrs) do
    resource_sharing
    |> cast(attrs, [:resource_type, :resource_id, :organization_id, :sharing_mode, :access_level])
    |> validate_required([:resource_type, :resource_id, :organization_id])
    |> validate_inclusion(:resource_type, [:media, :playlist, :channel, :device, :widget])
    |> validate_inclusion(:sharing_mode, [:children, :descendants, :network, :specific_orgs])
    |> validate_inclusion(:access_level, [:read, :read_write, :full])
    |> unique_constraint([:resource_type, :resource_id],
      name: :resource_sharing_unique_resource,
      message: "This resource is already shared"
    )
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Base query for resource sharing.
  """
  def base_query do
    from(rs in __MODULE__, as: :resource_sharing)
  end

  @doc """
  Check if a specific resource is shared.

  ## Examples

      iex> ResourceSharing.is_shared?("playlist", 123)
      true
  """
  def is_shared?(resource_type, resource_id) do
    from(rs in __MODULE__,
      where: rs.resource_type == ^resource_type and rs.resource_id == ^resource_id
    )
    |> Castmill.Repo.exists?()
  end

  @doc """
  Get sharing configuration for a specific resource.

  Returns the ResourceSharing record or nil if not shared.
  """
  def get_sharing(resource_type, resource_id) do
    from(rs in __MODULE__,
      where: rs.resource_type == ^resource_type and rs.resource_id == ^resource_id
    )
    |> Castmill.Repo.one()
  end

  @doc """
  Get all shared resources of a specific type from an organization.

  ## Examples

      iex> ResourceSharing.list_shared_by_org("playlist", org_id)
      [%ResourceSharing{resource_id: 1, ...}, ...]
  """
  def list_shared_by_org(resource_type, organization_id) do
    from(rs in __MODULE__,
      where: rs.resource_type == ^resource_type and rs.organization_id == ^organization_id
    )
    |> Castmill.Repo.all()
  end

  @doc """
  Get all shared resource IDs of a specific type from an organization.
  Returns just the IDs for efficient joins.

  ## Examples

      iex> ResourceSharing.shared_resource_ids("playlist", org_id)
      [1, 5, 42, ...]
  """
  def shared_resource_ids(resource_type, organization_id) do
    from(rs in __MODULE__,
      where: rs.resource_type == ^resource_type and rs.organization_id == ^organization_id,
      select: rs.resource_id
    )
    |> Castmill.Repo.all()
  end

  @doc """
  Get resource IDs accessible to a child organization from its parent(s).

  Takes into account the organization hierarchy and sharing modes.

  ## Examples

      iex> ResourceSharing.accessible_from_parents("playlist", child_org_id)
      [%{resource_id: 1, access_level: :read, parent_org_id: "..."}]
  """
  def accessible_from_parents(resource_type, child_org_id) do
    # Get the child organization to find its parent
    child_org = Castmill.Organizations.get_organization!(child_org_id)

    if child_org.organization_id do
      # Query shared resources from parent org
      from(rs in __MODULE__,
        where: rs.resource_type == ^resource_type,
        where: rs.organization_id == ^child_org.organization_id,
        where: rs.sharing_mode in [:children, :descendants],
        select: %{
          resource_id: rs.resource_id,
          access_level: rs.access_level,
          parent_org_id: rs.organization_id,
          sharing_mode: rs.sharing_mode
        }
      )
      |> Castmill.Repo.all()
    else
      # No parent, no shared resources
      []
    end
  end
end

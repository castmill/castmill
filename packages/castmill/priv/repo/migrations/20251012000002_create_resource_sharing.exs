defmodule Castmill.Repo.Migrations.CreateResourceSharing do
  use Ecto.Migration

  def change do
    create table(:resource_sharing) do
      # Type of resource being shared: "media", "playlist", "channel", "device", "widget"
      add :resource_type, :string, null: false

      # ID of the specific resource (polymorphic - maps to medias.id, playlists.id, etc.)
      add :resource_id, :integer, null: false

      # Organization that owns and is sharing this resource
      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      # Sharing mode: how this resource is shared
      # - "children": Share with direct child organizations
      # - "descendants": Share with all descendant organizations (children, grandchildren, etc.)
      # - "network": Share across entire network (future use)
      # - "specific_orgs": Share with specific organizations (future use, requires additional table)
      add :sharing_mode, :string, default: "children", null: false

      # Access level granted to shared organizations
      # - "read": Child orgs can view only
      # - "read_write": Child orgs can view and edit
      # - "full": Child orgs have full control (rare)
      add :access_level, :string, default: "read", null: false

      timestamps()
    end

    # Ensure each resource is only shared once (unique sharing config per resource)
    create unique_index(:resource_sharing, [:resource_type, :resource_id],
             name: :resource_sharing_unique_resource
           )

    # Index for querying shared resources by owner organization
    create index(:resource_sharing, [:organization_id])

    # Index for querying by resource type (e.g., "all shared playlists")
    create index(:resource_sharing, [:resource_type])

    # Composite index for efficient "give me shared resources of type X from org Y"
    create index(:resource_sharing, [:organization_id, :resource_type])
  end
end

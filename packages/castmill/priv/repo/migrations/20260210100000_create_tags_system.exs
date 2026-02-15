defmodule Castmill.Repo.Migrations.CreateTagsSystem do
  use Ecto.Migration

  @moduledoc """
  Creates the tags system for flexible resource organization.

  This migration creates:
  - tag_groups: Optional grouping for tags (e.g., "Location", "Campaign")
  - tags: The tags themselves (e.g., "London Office", "Summer 2026")
  - resource_tags: Polymorphic join table linking tags to any resource type

  Tags provide a flexible, user-defined taxonomy for organizing resources
  without the access control implications of Teams.

  Note: resource_tags.resource_id is stored as a string to accommodate both
  integer IDs (media, playlist, channel) and UUIDs (device).
  """

  def change do
    # Tag Groups - optional categorization of tags
    create table(:tag_groups) do
      add :name, :string, null: false
      # Hex color for visual distinction
      add :color, :string
      # Optional icon identifier
      add :icon, :string
      # For ordering groups
      add :position, :integer, default: 0

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      timestamps()
    end

    create index(:tag_groups, [:organization_id])

    create unique_index(:tag_groups, [:organization_id, :name],
             name: :unique_tag_group_name_per_org
           )

    # Tags
    create table(:tags) do
      add :name, :string, null: false
      # Default blue
      add :color, :string, default: "#3B82F6"
      # For ordering within group
      add :position, :integer, default: 0

      # Optional group
      add :tag_group_id, references(:tag_groups, on_delete: :delete_all)

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      timestamps()
    end

    create index(:tags, [:organization_id])
    create index(:tags, [:tag_group_id])
    create unique_index(:tags, [:organization_id, :name], name: :unique_tag_name_per_org)

    # Resource Tags - polymorphic many-to-many relationship
    create table(:resource_tags, primary_key: false) do
      add :tag_id, references(:tags, on_delete: :delete_all), null: false, primary_key: true

      # Polymorphic association
      add :resource_type, :string, null: false, primary_key: true
      add :resource_id, :string, null: false, primary_key: true

      timestamps()
    end

    create index(:resource_tags, [:tag_id])
    create index(:resource_tags, [:resource_type, :resource_id])

    # Unique constraint: a resource can only have each tag once
    create unique_index(:resource_tags, [:tag_id, :resource_type, :resource_id],
             name: :unique_tag_per_resource
           )
  end
end

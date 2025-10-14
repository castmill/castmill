defmodule Castmill.Repo.Migrations.AddOrganizationConfigFields do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      # Default role for new users joining the organization
      # Options: :admin, :manager, :member, :editor, :publisher, :device_manager, :guest
      add :default_role, :string, default: "member", null: false

      # Visibility mode for organization hierarchy
      # Options:
      # - "full": Parent can see and edit all child org resources
      # - "read_only_parent": Parent can read child resources, child can edit shared parent resources
      # - "isolated": Complete isolation, parent cannot see child resources
      add :visibility_mode, :string, default: "full", null: false
    end

    # Add index for faster queries
    create index(:organizations, [:visibility_mode])
  end
end

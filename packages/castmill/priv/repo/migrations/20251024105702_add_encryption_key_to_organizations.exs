defmodule Castmill.Repo.Migrations.AddEncryptionKeyToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      # Base64-encoded 32-byte encryption key for organization-specific data
      add :encryption_key, :text
    end
  end
end

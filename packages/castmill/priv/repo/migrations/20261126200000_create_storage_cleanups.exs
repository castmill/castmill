defmodule Castmill.Repo.Migrations.CreateStorageCleanups do
  use Ecto.Migration

  # Stored objects to delete after their records are gone (e.g. a deleted
  # organization's files). Rows are written with the deletion and removed
  # once the object is deleted, so failures are retried.
  def change do
    create table(:storage_cleanups) do
      add :kind, :string, null: false
      add :data, :map, null: false
      add :attempts, :integer, null: false, default: 0
      add :last_error, :text

      timestamps()
    end
  end
end
